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
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('YTD');

  // Get all stocks from the portfolio
  const { data: allStocks } = trpc.stocks.list.useQuery();
  const portfolioStocks = stocks.length > 0 ? stocks : (allStocks || []);

  // Calculate tickers, weights, and ytdStartPrices from portfolio
  const tickers = portfolioStocks.map((s: any) => s.ticker);
  
  // Calculate weights: use portfolioWeight if available, otherwise equal weighting
  const weights = portfolioStocks.map((s: any) => {
    if (s.portfolioWeight !== undefined && s.portfolioWeight !== null) {
      // Use existing portfolio weight (from database)
      return parseFloat(s.portfolioWeight) / 100;
    } else if (s.shares !== undefined && s.shares !== null) {
      // Calculate from shares (optimizer portfolios)
      const totalValue = portfolioStocks.reduce((sum: number, stock: any) => 
        sum + (stock.currentPrice || 0) * (stock.shares || 0), 0);
      const value = (s.currentPrice || 0) * (s.shares || 0);
      return totalValue > 0 ? value / totalValue : 0;
    } else {
      // Equal weighting fallback
      return 1 / portfolioStocks.length;
    }
  });
  
  const ytdStartPrices = portfolioStocks.map((s: any) => parseFloat(s.ytdStartPrice || '0'));

  // Calculate years based on selected period
  const years = useMemo(() => {
    switch (selectedPeriod) {
      case '1M': return 1/12;
      case '3M': return 3/12;
      case '6M': return 6/12;
      case 'YTD': return (new Date().getMonth() + 1) / 12;
      case '1Y': return 1;
      case '3Y': return 3;
      case '5Y': return 5;
      case 'Max': return 10;
      default: return 5;
    }
  }, [selectedPeriod]);

  // Debug logging (updated for EODHD_API_KEY fix)
  console.log('[PortfolioChart] Tickers:', tickers.length, 'Weights:', weights.length, 'Years:', years);

  
  // Fetch YTD performance using database values (matches Performance card)
  const { data: ytdData, isLoading: isLoadingYTD, error: ytdError } = trpc.portfolioPerformance.getYTDPerformance.useQuery(
    { tickers, weights },
    { 
      enabled: selectedPeriod === 'YTD' && tickers.length > 0 && weights.length > 0,
      retry: 2
    }
  );

  // Fetch portfolio historical data (for non-YTD periods)
  const { data: portfolioData, isLoading: isLoadingPortfolio, error: portfolioError } = trpc.portfolioPerformance.getHistoricalData.useQuery(
    { tickers, weights, years },
    { 
      enabled: selectedPeriod !== 'YTD' && tickers.length > 0 && weights.length > 0,
      retry: 2
    }
  );

  // Fetch benchmark data
  const { data: benchmarkData, isLoading: isLoadingBenchmark, error: benchmarkError } = trpc.portfolioPerformance.getBenchmarkData.useQuery(
    { benchmark: selectedBenchmark, years },
    { 
      enabled: !!selectedBenchmark,
      retry: 2
    }
  );

  // Calculate portfolio return from live prices (same as top-right card)
  // MUST be before any early returns to follow Rules of Hooks
  const portfolioReturn = useMemo(() => {
    if (selectedPeriod === 'YTD' && portfolioStocks.length > 0) {
      // Use same calculation as Home.tsx top-right card
      const ytdPerf = portfolioStocks.reduce((sum: number, stock: any) => {
        const currentPrice = parseFloat(stock.currentPrice || "0");
        const ytdStartPrice = parseFloat(stock.ytdStartPrice || "0");
        const weight = parseFloat(stock.portfolioWeight || "0");
        if (currentPrice > 0 && ytdStartPrice > 0 && weight > 0) {
          const stockYTD = ((currentPrice - ytdStartPrice) / ytdStartPrice) * 100;
          return sum + (stockYTD * weight / 100);
        }
        return sum;
      }, 0);
      return ytdPerf;
    }
    // For other periods, return 0 as placeholder (will be overridden by chartData)
    return 0;
  }, [selectedPeriod, portfolioStocks]);

  // Combine and normalize data
  const chartData = useMemo(() => {
    // For YTD, use ytdData instead of portfolioData
    const activePortfolioData = selectedPeriod === 'YTD' ? ytdData : portfolioData;
    
    if (!activePortfolioData || !activePortfolioData.dates || activePortfolioData.dates.length === 0) return [];
    if (!benchmarkData || !benchmarkData.dates || benchmarkData.dates.length === 0) return [];
    
    // Use portfolio dates as primary (backend already filtered correctly)
    // Fill missing benchmark values with forward-fill
    const portfolioDates = activePortfolioData.dates;
    
    if (portfolioDates.length === 0) return [];
    
    // Build benchmark value map with forward-fill for missing dates
    const benchmarkMap = new Map<string, number>();
    let lastBenchmarkValue = 0;
    
    portfolioDates.forEach(date => {
      const benchmarkIndex = benchmarkData.dates.indexOf(date);
      if (benchmarkIndex >= 0) {
        lastBenchmarkValue = benchmarkData.values[benchmarkIndex] || lastBenchmarkValue;
      }
      benchmarkMap.set(date, lastBenchmarkValue);
    });
    
    // Get values for all portfolio dates
    const portfolioValues = portfolioDates.map((date, index) => {
      return activePortfolioData.values[index] || 0;
    });
    
    const benchmarkValues = portfolioDates.map(date => {
      return benchmarkMap.get(date) || 0;
    });
    
    const commonDates = portfolioDates;
    
    // For YTD: Backend already returns values from 0% to ytdPerformance%, no normalization needed
    // For other periods: Normalize to start at 0% by subtracting the first value
    const portfolioStart = selectedPeriod === 'YTD' ? 0 : (portfolioValues[0] || 0);
    const benchmarkStart = selectedPeriod === 'YTD' ? 0 : (benchmarkValues[0] || 0);
    
    return commonDates.map((date, index) => ({
      date: new Date(date).toLocaleDateString('de-CH', { 
        day: 'numeric',
        month: 'short',
        year: '2-digit'
      }),
      portfolio: portfolioValues[index] - portfolioStart,
      benchmark: benchmarkValues[index] - benchmarkStart,
    }));
  }, [ytdData, portfolioData, benchmarkData, selectedPeriod]);

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

  // Check if portfolio is empty
  if (portfolioStocks.length === 0 && !allStocks) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Portfolio Performance (5 Jahre)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="text-slate-400">Keine Aktien im Portfolio</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show error if queries failed
  if (portfolioError || benchmarkError) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Portfolio Performance (5 Jahre)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-64 space-y-2">
            <div className="text-red-400">Fehler beim Laden der Daten</div>
            <div className="text-slate-400 text-sm">
              {portfolioError ? `Portfolio: ${portfolioError.message}` : ''}
              {benchmarkError ? `Benchmark: ${benchmarkError.message}` : ''}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isLoading = (selectedPeriod === 'YTD' ? isLoadingYTD : isLoadingPortfolio) || isLoadingBenchmark;

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
  
  // Use portfolioReturn from useMemo above for YTD, otherwise use chartData
  const finalPortfolioReturn = selectedPeriod === 'YTD' ? portfolioReturn : (latestPoint?.portfolio || 0);
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
    <div className="bg-[#2c3e50] rounded-lg p-6 border border-slate-600">
      {/* Header with Title and Controls */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white text-lg font-semibold">Portfolio Performance</h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-slate-300 text-sm">Zeitraum:</label>
            <Select value={selectedPeriod} onValueChange={(value) => setSelectedPeriod(value as TimePeriod)}>
              <SelectTrigger className="w-[100px] bg-slate-700 border-slate-600 text-white h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-700 border-slate-600">
                {periodOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-slate-300 text-sm">Benchmark:</label>
            <Select value={selectedBenchmark} onValueChange={setSelectedBenchmark}>
              <SelectTrigger className="w-[140px] bg-slate-700 border-slate-600 text-white h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-700 border-slate-600">
                {benchmarkOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Chart Area */}
      <div className="bg-[#34495e] rounded-lg p-4">
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#4a5f7f" vertical={true} horizontal={true} />
            <XAxis 
              dataKey="date" 
              stroke="#8899aa"
              tick={{ fill: '#8899aa', fontSize: 11 }}
              interval="preserveStartEnd"
              tickLine={{ stroke: '#4a5f7f' }}
            />
            <YAxis 
              stroke="#8899aa"
              tick={{ fill: '#8899aa', fontSize: 11 }}
              tickFormatter={(value) => `${value.toFixed(0)}%`}
              tickLine={{ stroke: '#4a5f7f' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line 
              type="monotone" 
              dataKey="portfolio" 
              stroke="#5b9bd5" 
              strokeWidth={2}
              dot={false}
              name={portfolioName}
              activeDot={{ r: 5, fill: '#5b9bd5' }}
            />
            <Line 
              type="monotone" 
              dataKey="benchmark" 
              stroke="#ed7d31" 
              strokeWidth={2}
              dot={false}
              name={benchmarkOptions.find(b => b.value === selectedBenchmark)?.label || 'Benchmark'}
              activeDot={{ r: 5, fill: '#ed7d31' }}
            />
          </LineChart>
        </ResponsiveContainer>
        
        {/* Legend */}
        <div className="mt-3 flex items-center justify-center gap-6 text-sm border-t border-slate-600 pt-3">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#5b9bd5]"></div>
            <span className="text-slate-200">Portfolio</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#ed7d31]"></div>
            <span className="text-slate-200">{benchmarkOptions.find(b => b.value === selectedBenchmark)?.label}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
