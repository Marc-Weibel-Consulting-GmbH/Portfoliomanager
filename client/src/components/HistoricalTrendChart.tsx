import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface HistoricalTrendChartProps {
  ticker: string;
}

export function HistoricalTrendChart({ ticker }: HistoricalTrendChartProps) {
  const [days, setDays] = useState(30);
  
  const { data, isLoading, error } = trpc.stocks.getHistoricalMetrics.useQuery({
    ticker,
    days,
  });

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <p className="text-slate-400 mt-2">Lade historische Daten...</p>
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

  if (!data || data.history.length === 0) {
    return (
      <Alert className="bg-yellow-900/20 border-yellow-700">
        <AlertTriangle className="h-4 w-4 text-yellow-500" />
        <AlertDescription className="text-yellow-200">
          Keine historischen Daten verfügbar. Daten werden bei jedem Refresh aufgezeichnet.
        </AlertDescription>
      </Alert>
    );
  }

  // Prepare chart data
  const chartData = data.history
    .slice()
    .reverse() // Oldest first for chart
    .map((record) => ({
      date: new Date(record.recordedAt).toLocaleDateString('de-DE', { 
        month: 'short', 
        day: 'numeric',
        year: '2-digit'
      }),
      sharpeRatio: record.sharpeRatio ? parseFloat(record.sharpeRatio) : null,
      peRatio: record.peRatio ? parseFloat(record.peRatio) : null,
      dividendYield: record.dividendYield ? parseFloat(record.dividendYield) : null,
      price: record.currentPrice ? parseFloat(record.currentPrice) : null,
    }));

  const getTrendIcon = (change: number | null) => {
    if (change === null) return <Minus className="w-4 h-4 text-slate-400" />;
    if (change > 0) return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (change < 0) return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-slate-400" />;
  };

  const getTrendColor = (change: number | null) => {
    if (change === null) return "text-slate-400";
    if (change > 0) return "text-green-400";
    if (change < 0) return "text-red-400";
    return "text-slate-400";
  };

  return (
    <div className="space-y-4">
      {/* Time Range Selector */}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={days === 7 ? "default" : "outline"}
          onClick={() => setDays(7)}
          className={days === 7 ? "" : "bg-transparent border-slate-600 text-slate-300"}
        >
          7 Tage
        </Button>
        <Button
          size="sm"
          variant={days === 30 ? "default" : "outline"}
          onClick={() => setDays(30)}
          className={days === 30 ? "" : "bg-transparent border-slate-600 text-slate-300"}
        >
          30 Tage
        </Button>
        <Button
          size="sm"
          variant={days === 90 ? "default" : "outline"}
          onClick={() => setDays(90)}
          className={days === 90 ? "" : "bg-transparent border-slate-600 text-slate-300"}
        >
          90 Tage
        </Button>
      </div>

      {/* Trend Summary */}
      {data.trend && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-slate-700 p-3 rounded-lg">
            <div className="text-xs text-slate-400 mb-1">Sharpe Ratio</div>
            <div className="flex items-center gap-2">
              {getTrendIcon(data.trend.sharpeRatioChange)}
              <span className={`text-lg font-bold ${getTrendColor(data.trend.sharpeRatioChange)}`}>
                {data.trend.sharpeRatioChange !== null 
                  ? `${data.trend.sharpeRatioChange > 0 ? '+' : ''}${data.trend.sharpeRatioChange.toFixed(1)}%`
                  : 'N/A'}
              </span>
            </div>
          </div>

          <div className="bg-slate-700 p-3 rounded-lg">
            <div className="text-xs text-slate-400 mb-1">KGV (PE)</div>
            <div className="flex items-center gap-2">
              {getTrendIcon(data.trend.peRatioChange)}
              <span className={`text-lg font-bold ${getTrendColor(data.trend.peRatioChange)}`}>
                {data.trend.peRatioChange !== null 
                  ? `${data.trend.peRatioChange > 0 ? '+' : ''}${data.trend.peRatioChange.toFixed(1)}%`
                  : 'N/A'}
              </span>
            </div>
          </div>

          <div className="bg-slate-700 p-3 rounded-lg">
            <div className="text-xs text-slate-400 mb-1">Dividende</div>
            <div className="flex items-center gap-2">
              {getTrendIcon(data.trend.dividendYieldChange)}
              <span className={`text-lg font-bold ${getTrendColor(data.trend.dividendYieldChange)}`}>
                {data.trend.dividendYieldChange !== null 
                  ? `${data.trend.dividendYieldChange > 0 ? '+' : ''}${data.trend.dividendYieldChange.toFixed(1)}%`
                  : 'N/A'}
              </span>
            </div>
          </div>

          <div className="bg-slate-700 p-3 rounded-lg">
            <div className="text-xs text-slate-400 mb-1">Kurs</div>
            <div className="flex items-center gap-2">
              {getTrendIcon(data.trend.priceChange)}
              <span className={`text-lg font-bold ${getTrendColor(data.trend.priceChange)}`}>
                {data.trend.priceChange !== null 
                  ? `${data.trend.priceChange > 0 ? '+' : ''}${data.trend.priceChange.toFixed(1)}%`
                  : 'N/A'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Sharpe Ratio Chart */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white text-sm">Sharpe Ratio Entwicklung</CardTitle>
          <CardDescription className="text-slate-400 text-xs">
            {data.history.length} Datenpunkte über {days} Tage
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" stroke="#9CA3AF" style={{ fontSize: '12px' }} />
              <YAxis stroke="#9CA3AF" style={{ fontSize: '12px' }} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                labelStyle={{ color: '#9CA3AF' }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Line 
                type="monotone" 
                dataKey="sharpeRatio" 
                stroke="#3B82F6" 
                strokeWidth={2}
                dot={{ fill: '#3B82F6', r: 3 }}
                name="Sharpe Ratio"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* PE Ratio Chart */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white text-sm">KGV (PE Ratio) Entwicklung</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" stroke="#9CA3AF" style={{ fontSize: '12px' }} />
              <YAxis stroke="#9CA3AF" style={{ fontSize: '12px' }} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                labelStyle={{ color: '#9CA3AF' }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Line 
                type="monotone" 
                dataKey="peRatio" 
                stroke="#10B981" 
                strokeWidth={2}
                dot={{ fill: '#10B981', r: 3 }}
                name="KGV"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
