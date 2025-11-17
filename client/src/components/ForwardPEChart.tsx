import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';

interface ForwardPEChartProps {
  ticker: string;
}

export function ForwardPEChart({ ticker }: ForwardPEChartProps) {
  const [years, setYears] = useState(5);
  
  const { data, isLoading, error } = trpc.stocks.getHistoricalPE.useQuery({
    ticker,
    years,
  });

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <p className="text-slate-400 mt-2">Lade historische P/E Daten...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Alert className="bg-red-900/20 border-red-700">
        <AlertTriangle className="h-4 w-4 text-red-500" />
        <AlertDescription className="text-red-200">
          Fehler beim Laden: {error.message}
        </AlertDescription>
      </Alert>
    );
  }

  if (!data || data.data.length === 0) {
    return (
      <Alert className="bg-yellow-900/20 border-yellow-700">
        <AlertTriangle className="h-4 w-4 text-yellow-500" />
        <AlertDescription className="text-yellow-200">
          Keine historischen P/E Daten verfügbar. Möglicherweise fehlen Earnings-Daten für diesen Ticker.
        </AlertDescription>
      </Alert>
    );
  }

  // Prepare chart data - reduce to monthly points and reverse to chronological order
  const allData = data.data
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); // Sort chronologically
  
  // Sample to monthly data points to reduce clutter
  const monthlyData: typeof data.data = [];
  let lastMonth = '';
  
  allData.forEach((point) => {
    const monthKey = new Date(point.date).toISOString().slice(0, 7); // YYYY-MM
    if (monthKey !== lastMonth) {
      monthlyData.push(point);
      lastMonth = monthKey;
    }
  });
  
  const chartData = monthlyData.map((point) => ({
    date: new Date(point.date).toLocaleDateString('de-DE', { 
      year: 'numeric',
      month: 'short',
    }),
    pe: parseFloat(point.pe.toFixed(2)),
    fullDate: point.date,
  }));

  return (
    <div className="space-y-4">
      {/* Time Range Selector */}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={years === 3 ? "default" : "outline"}
          onClick={() => setYears(3)}
          className={years === 3 ? "" : "bg-transparent border-slate-600 text-slate-300"}
        >
          3 Jahre
        </Button>
        <Button
          size="sm"
          variant={years === 5 ? "default" : "outline"}
          onClick={() => setYears(5)}
          className={years === 5 ? "" : "bg-transparent border-slate-600 text-slate-300"}
        >
          5 Jahre
        </Button>
        <Button
          size="sm"
          variant={years === 10 ? "default" : "outline"}
          onClick={() => setYears(10)}
          className={years === 10 ? "" : "bg-transparent border-slate-600 text-slate-300"}
        >
          10 Jahre
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="bg-slate-700 p-3 rounded-lg">
          <div className="text-xs text-slate-400 mb-1">Aktuelles P/E</div>
          <div className="text-lg font-bold text-white">
            {data.current ? data.current.toFixed(2) : 'N/A'}
          </div>
        </div>

        <div className="bg-slate-700 p-3 rounded-lg">
          <div className="text-xs text-slate-400 mb-1">Median P/E</div>
          <div className="text-lg font-bold text-blue-400">
            {data.median.toFixed(2)}
          </div>
        </div>

        <div className="bg-slate-700 p-3 rounded-lg">
          <div className="text-xs text-slate-400 mb-1">vs. Median</div>
          <div className={`text-lg font-bold ${
            data.current && data.current > data.median ? 'text-red-400' : 'text-green-400'
          }`}>
            {data.current 
              ? `${((data.current / data.median - 1) * 100).toFixed(1)}%`
              : 'N/A'}
          </div>
        </div>
      </div>

      {/* P/E Chart with Median Line */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white text-sm">
            {data.source === 'fiscal' ? 'Forward P/E (Fiscal.ai)' : 'Trailing P/E (TTM)'} Entwicklung
          </CardTitle>
          <CardDescription className="text-slate-400 text-xs">
            {chartData.length} Datenpunkte über {years} Jahre • Median: {data.median.toFixed(2)}
            {data.source === 'fiscal' && ' • Quelle: Fiscal.ai Pro'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="date" 
                stroke="#9CA3AF" 
                style={{ fontSize: '12px' }}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis 
                stroke="#9CA3AF" 
                style={{ fontSize: '12px' }}
                domain={['auto', 'auto']}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1F2937', 
                  border: '1px solid #374151', 
                  borderRadius: '8px' 
                }}
                labelStyle={{ color: '#9CA3AF' }}
                formatter={(value: number) => [value.toFixed(2), 'P/E Ratio']}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              
              {/* Median Line */}
              <ReferenceLine 
                y={data.median} 
                stroke="#60A5FA" 
                strokeDasharray="5 5"
                strokeWidth={2}
                label={{ 
                  value: `Median: ${data.median.toFixed(2)}`, 
                  position: 'insideTopRight',
                  fill: '#60A5FA',
                  fontSize: 12,
                }}
              />
              
              {/* P/E Line */}
              <Line 
                type="monotone" 
                dataKey="pe" 
                stroke="#3B82F6" 
                strokeWidth={2}
                dot={{ fill: '#3B82F6', r: 4 }}
                activeDot={{ r: 6 }}
                name="P/E Ratio"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Info Text */}
      <div className="text-xs text-slate-400 bg-slate-800 p-3 rounded-lg border border-slate-700">
        {data.source === 'fiscal' ? (
          <>
            <p className="mb-1">
              <strong className="text-slate-300">Forward P/E (Fiscal.ai):</strong> Professionelle Forward P/E Daten von Fiscal.ai. 
              Zeigt erwartete Bewertung basierend auf zukünftigen Gewinnschätzungen.
            </p>
            <p>
              <strong className="text-slate-300">Median-Linie:</strong> Durchschnittliches P/E über den gewählten Zeitraum. 
              Werte über dem Median deuten auf eine höhere Bewertung hin.
            </p>
          </>
        ) : (
          <>
            <p className="mb-1">
              <strong className="text-slate-300">Trailing P/E (TTM):</strong> Kurs-Gewinn-Verhältnis basierend auf den letzten 12 Monaten (4 Quartale) tatsächlicher Gewinne.
            </p>
            <p>
              <strong className="text-slate-300">Median-Linie:</strong> Durchschnittliches P/E über den gewählten Zeitraum. 
              Werte über dem Median deuten auf eine höhere Bewertung hin.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
