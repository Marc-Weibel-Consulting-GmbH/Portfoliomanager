import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function PortfolioPerformanceChart() {
  const { data: performanceData, isLoading, error } = trpc.stocks.portfolioPerformance.useQuery();

  if (isLoading) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Portfolio Performance (5 Jahre)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="text-slate-400">Lade Performance-Daten...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !performanceData || performanceData.length === 0) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Portfolio Performance (5 Jahre)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="text-slate-400">
              {error ? 'Fehler beim Laden der Daten' : 'Keine Daten verfügbar'}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate statistics
  const latestPoint = performanceData[performanceData.length - 1];
  const totalReturn = latestPoint?.percentChange || 0;
  const initialValue = 10000;
  const currentValue = latestPoint?.value || initialValue;
  const absoluteReturn = currentValue - initialValue;

  // Format data for chart (sample every 7 days to reduce points)
  const chartData = performanceData
    .filter((_, index) => index % 7 === 0 || index === performanceData.length - 1)
    .map((point) => ({
      date: new Date(point.date).toLocaleDateString('de-CH', { 
        year: '2-digit', 
        month: 'short' 
      }),
      value: point.value,
      percentChange: point.percentChange,
    }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 shadow-lg">
          <p className="text-white font-semibold">{data.date}</p>
          <p className="text-blue-400">
            Wert: CHF {data.value.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className={data.percentChange >= 0 ? 'text-green-400' : 'text-red-400'}>
            {data.percentChange >= 0 ? '+' : ''}{data.percentChange.toFixed(2)}%
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center justify-between">
          <span>Portfolio Performance (5 Jahre)</span>
          <div className="text-sm font-normal space-y-1">
            <div className={`text-right ${totalReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {totalReturn >= 0 ? '+' : ''}{totalReturn.toFixed(2)}%
            </div>
            <div className={`text-right text-xs ${absoluteReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {absoluteReturn >= 0 ? '+' : ''}CHF {absoluteReturn.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="bg-slate-900/50 rounded-lg p-4">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis 
                dataKey="date" 
                stroke="#94a3b8"
                tick={{ fill: '#94a3b8', fontSize: 12 }}
                interval="preserveStartEnd"
              />
              <YAxis 
                stroke="#94a3b8"
                tick={{ fill: '#94a3b8', fontSize: 12 }}
                tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine 
                y={initialValue} 
                stroke="#64748b" 
                strokeDasharray="3 3"
                label={{ value: 'Start', fill: '#64748b', fontSize: 12 }}
              />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke="#3b82f6" 
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 6, fill: '#3b82f6' }}
              />
            </LineChart>
          </ResponsiveContainer>
          
          <div className="mt-4 grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-slate-400 text-xs">Startwert</div>
              <div className="text-white font-semibold">
                CHF {initialValue.toLocaleString('de-CH')}
              </div>
            </div>
            <div>
              <div className="text-slate-400 text-xs">Aktueller Wert</div>
              <div className="text-white font-semibold">
                CHF {currentValue.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div>
              <div className="text-slate-400 text-xs">Gesamtrendite</div>
              <div className={`font-semibold ${totalReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {totalReturn >= 0 ? '+' : ''}{totalReturn.toFixed(2)}%
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

