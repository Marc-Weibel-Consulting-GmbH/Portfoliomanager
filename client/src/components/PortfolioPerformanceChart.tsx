import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, useMemo } from 'react';

interface PortfolioPerformanceChartProps {
  stocks?: any[];
}

export function PortfolioPerformanceChart({ stocks = [] }: PortfolioPerformanceChartProps) {
  const [selectedBenchmark, setSelectedBenchmark] = useState('sp500');

  // Get all stocks from the portfolio
  const { data: allStocks } = trpc.stocks.list.useQuery();
  const portfolioStocks = stocks.length > 0 ? stocks : (allStocks || []);

  // Calculate tickers and weights from portfolio
  const tickers = portfolioStocks.map((s: any) => s.ticker);
  const totalValue = portfolioStocks.reduce((sum: number, s: any) => sum + (s.currentPrice || 0) * (s.shares || 1), 0);
  const weights = portfolioStocks.map((s: any) => {
    const value = (s.currentPrice || 0) * (s.shares || 1);
    return totalValue > 0 ? value / totalValue : 0;
  });

  // Fetch portfolio historical data
  const { data: portfolioData, isLoading: isLoadingPortfolio } = trpc.portfolioPerformance.getHistoricalData.useQuery(
    { tickers, weights, years: 5 },
    { enabled: tickers.length > 0 && weights.length > 0 }
  );

  // Fetch benchmark data
  const { data: benchmarkData, isLoading: isLoadingBenchmark } = trpc.portfolioPerformance.getBenchmarkData.useQuery(
    { benchmark: selectedBenchmark, years: 5 },
    { enabled: !!selectedBenchmark }
  );

  // Combine and normalize data
  const chartData = useMemo(() => {
    if (!portfolioData || !portfolioData.dates || portfolioData.dates.length === 0) return [];
    if (!benchmarkData || !benchmarkData.dates || benchmarkData.dates.length === 0) return [];
    
    // Find common dates
    const commonDates = portfolioData.dates.filter(date => benchmarkData.dates.includes(date));
    
    if (commonDates.length === 0) return [];
    
    // Get values for common dates
    const portfolioValues = commonDates.map(date => {
      const index = portfolioData.dates.indexOf(date);
      return portfolioData.values[index] || 0;
    });
    
    const benchmarkValues = commonDates.map(date => {
      const index = benchmarkData.dates.indexOf(date);
      return benchmarkData.values[index] || 0;
    });
    
    // Normalize both to start at 0%
    const portfolioStart = portfolioValues[0];
    const benchmarkStart = benchmarkValues[0];
    
    return commonDates.map((date, index) => ({
      date: new Date(date).toLocaleDateString('de-CH', { 
        year: '2-digit', 
        month: 'short' 
      }),
      portfolio: portfolioValues[index] - portfolioStart,
      benchmark: benchmarkValues[index] - benchmarkStart,
    }));
  }, [portfolioData, benchmarkData]);

  const benchmarkOptions = [
    { value: 'sp500', label: 'S&P 500' },
    { value: 'nasdaq', label: 'Nasdaq' },
    { value: 'smi', label: 'SMI' },
    { value: 'msci_world', label: 'MSCI World' },
    { value: 'eurostoxx', label: 'Eurostoxx' },
  ];

  const isLoading = isLoadingPortfolio || isLoadingBenchmark;

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

  if (chartData.length === 0) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Portfolio Performance (5 Jahre)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="text-slate-400">Keine Daten verfügbar</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const latestPoint = chartData[chartData.length - 1];
  const portfolioReturn = latestPoint?.portfolio || 0;
  const benchmarkReturn = latestPoint?.benchmark || 0;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 shadow-lg">
          <p className="text-white font-semibold mb-2">{data.date}</p>
          <p className="text-blue-400">
            Portfolio: {data.portfolio >= 0 ? '+' : ''}{data.portfolio.toFixed(2)}%
          </p>
          <p className="text-red-400">
            {benchmarkOptions.find(b => b.value === selectedBenchmark)?.label}: {data.benchmark >= 0 ? '+' : ''}{data.benchmark.toFixed(2)}%
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white">Portfolio Performance (5 Jahre)</CardTitle>
          <div className="flex items-center gap-2">
            <label className="text-slate-400 text-sm">Benchmark:</label>
            <Select value={selectedBenchmark} onValueChange={setSelectedBenchmark}>
              <SelectTrigger className="w-[140px] bg-slate-700 border-slate-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {benchmarkOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
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
                tickFormatter={(value) => `${value.toFixed(0)}%`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                wrapperStyle={{ paddingTop: '20px' }}
                iconType="line"
              />
              <Line 
                type="monotone" 
                dataKey="portfolio" 
                stroke="#3b82f6" 
                strokeWidth={2}
                dot={false}
                name="Portfolio"
                activeDot={{ r: 6, fill: '#3b82f6' }}
              />
              <Line 
                type="monotone" 
                dataKey="benchmark" 
                stroke="#ef4444" 
                strokeWidth={2}
                dot={false}
                name={benchmarkOptions.find(b => b.value === selectedBenchmark)?.label || 'Benchmark'}
                activeDot={{ r: 6, fill: '#ef4444' }}
              />
            </LineChart>
          </ResponsiveContainer>
          
          <div className="mt-4 grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-slate-400 text-xs">Portfolio Performance</div>
              <div className={`font-semibold text-lg ${portfolioReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {portfolioReturn >= 0 ? '+' : ''}{portfolioReturn.toFixed(2)}%
              </div>
            </div>
            <div>
              <div className="text-slate-400 text-xs">{benchmarkOptions.find(b => b.value === selectedBenchmark)?.label} Performance</div>
              <div className={`font-semibold text-lg ${benchmarkReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {benchmarkReturn >= 0 ? '+' : ''}{benchmarkReturn.toFixed(2)}%
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
