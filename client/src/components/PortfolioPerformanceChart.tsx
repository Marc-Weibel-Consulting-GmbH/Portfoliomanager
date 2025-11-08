import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, useMemo } from 'react';

interface PortfolioPerformanceChartProps {
  stocks?: any[];
  portfolioName?: string;
}

type TimePeriod = '1M' | '3M' | '6M' | 'YTD' | '1Y' | '3Y' | '5Y' | 'Max';

export function PortfolioPerformanceChart({ stocks = [], portfolioName = 'Portfolio BIG' }: PortfolioPerformanceChartProps) {
  const [selectedBenchmark, setSelectedBenchmark] = useState('sp500');
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('5Y');

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

  // Calculate years based on selected period
  const years = useMemo(() => {
    switch (selectedPeriod) {
      case '1M': return 0.1;
      case '3M': return 0.25;
      case '6M': return 0.5;
      case 'YTD': return 1;
      case '1Y': return 1;
      case '3Y': return 3;
      case '5Y': return 5;
      case 'Max': return 10;
      default: return 5;
    }
  }, [selectedPeriod]);

  // Fetch portfolio historical data
  const { data: portfolioData, isLoading: isLoadingPortfolio } = trpc.portfolioPerformance.getHistoricalData.useQuery(
    { tickers, weights, years },
    { enabled: tickers.length > 0 && weights.length > 0 }
  );

  // Fetch benchmark data
  const { data: benchmarkData, isLoading: isLoadingBenchmark } = trpc.portfolioPerformance.getBenchmarkData.useQuery(
    { benchmark: selectedBenchmark, years },
    { enabled: !!selectedBenchmark }
  );

  // Combine and normalize data
  const chartData = useMemo(() => {
    if (!portfolioData || !portfolioData.dates || portfolioData.dates.length === 0) return [];
    if (!benchmarkData || !benchmarkData.dates || benchmarkData.dates.length === 0) return [];
    
    // Find common dates
    let commonDates = portfolioData.dates.filter(date => benchmarkData.dates.includes(date));
    
    if (commonDates.length === 0) return [];
    
    // Filter dates based on selected period
    const now = new Date();
    const cutoffDate = new Date();
    
    if (selectedPeriod === 'YTD') {
      cutoffDate.setMonth(0, 1); // January 1st of current year
    } else if (selectedPeriod === '1M') {
      cutoffDate.setMonth(now.getMonth() - 1);
    } else if (selectedPeriod === '3M') {
      cutoffDate.setMonth(now.getMonth() - 3);
    } else if (selectedPeriod === '6M') {
      cutoffDate.setMonth(now.getMonth() - 6);
    } else if (selectedPeriod === '1Y') {
      cutoffDate.setFullYear(now.getFullYear() - 1);
    } else if (selectedPeriod === '3Y') {
      cutoffDate.setFullYear(now.getFullYear() - 3);
    } else if (selectedPeriod === '5Y') {
      cutoffDate.setFullYear(now.getFullYear() - 5);
    }
    // 'Max' uses all available dates
    
    if (selectedPeriod !== 'Max') {
      commonDates = commonDates.filter(date => new Date(date) >= cutoffDate);
    }
    
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
    
    // Normalize to start at 0% after filtering
    const portfolioStart = portfolioValues[0] || 0;
    const benchmarkStart = benchmarkValues[0] || 0;
    
    return commonDates.map((date, index) => ({
      date: new Date(date).toLocaleDateString('de-CH', { 
        year: '2-digit', 
        month: 'short' 
      }),
      portfolio: portfolioValues[index] - portfolioStart,
      benchmark: benchmarkValues[index] - benchmarkStart,
    }));
  }, [portfolioData, benchmarkData, selectedPeriod]);

  const benchmarkOptions = [
    { value: 'sp500', label: 'S&P 500' },
    { value: 'nasdaq', label: 'Nasdaq' },
    { value: 'smi', label: 'SMI' },
    { value: 'msci_world', label: 'MSCI World' },
    { value: 'eurostoxx', label: 'Eurostoxx' },
  ];

  const periodOptions: { value: TimePeriod; label: string }[] = [
    { value: '1M', label: '1M' },
    { value: '3M', label: '3M' },
    { value: '6M', label: '6M' },
    { value: 'YTD', label: 'YTD' },
    { value: '1Y', label: '1J' },
    { value: '3Y', label: '3J' },
    { value: '5Y', label: '5J' },
    { value: 'Max', label: 'Max' },
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
            {portfolioName}: {data.portfolio >= 0 ? '+' : ''}{data.portfolio.toFixed(2)}%
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
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white">Portfolio Performance</CardTitle>
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
          
          {/* Time Period Selector */}
          <div className="flex items-center gap-2 flex-wrap">
            {periodOptions.map(option => (
              <button
                key={option.value}
                onClick={() => setSelectedPeriod(option.value)}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  selectedPeriod === option.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {option.label}
              </button>
            ))}
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
              <Line 
                type="monotone" 
                dataKey="portfolio" 
                stroke="#3b82f6" 
                strokeWidth={2}
                dot={false}
                name={portfolioName}
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
          
          <div className="mt-4 flex items-center justify-center gap-8 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 bg-blue-400"></div>
              <span className="text-slate-300">{portfolioName}</span>
              <span className={`font-semibold ml-1 ${portfolioReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {portfolioReturn >= 0 ? '+' : ''}{portfolioReturn.toFixed(2)}%
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 bg-red-400"></div>
              <span className="text-slate-300">{benchmarkOptions.find(b => b.value === selectedBenchmark)?.label}</span>
              <span className={`font-semibold ml-1 ${benchmarkReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {benchmarkReturn >= 0 ? '+' : ''}{benchmarkReturn.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
