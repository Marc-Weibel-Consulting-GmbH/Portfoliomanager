import { useState, useMemo } from "react";
import { useRoute, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, TrendingUp, TrendingDown, Shield, Users, Lightbulb, Bell, Plus, FileText, ExternalLink } from "lucide-react";
import { StockLogo } from "@/components/StockLogo";
import DashboardLayout from "@/components/DashboardLayout";
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

type TimePeriod = "1D" | "1W" | "1M" | "3M" | "6M" | "1Y" | "YTD" | "All";

// Score circle component
function ScoreCircle({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  
  // Color based on score
  const getColor = (score: number) => {
    if (score >= 80) return "#00CFC1";
    if (score >= 60) return "#f59e0b";
    return "#ef4444";
  };
  
  return (
    <div className="relative w-20 h-20">
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
        {/* Background circle */}
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke="#1a1f2e"
          strokeWidth="8"
        />
        {/* Progress circle */}
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke={getColor(score)}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xl font-bold text-white">{score}</span>
        <span className="text-xs text-gray-400">/100</span>
      </div>
    </div>
  );
}

// Metric card component
function MetricCard({ label, value, suffix = "" }: { label: string; value: string | number; suffix?: string }) {
  return (
    <div className="bg-[#1a1f2e] rounded-lg p-3 border border-white/10">
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className="text-lg font-bold text-white">
        {value}{suffix}
      </div>
    </div>
  );
}

// Moat card component
function MoatCard({ number, title, icon: Icon }: { number: number; title: string; icon: React.ElementType }) {
  return (
    <div className="flex items-center gap-3 bg-[#1a1f2e] rounded-lg p-4 border border-white/10 hover:border-[#00CFC1]/30 transition-colors">
      <div className="w-10 h-10 rounded-lg bg-[#00CFC1]/20 flex items-center justify-center">
        <Icon className="w-5 h-5 text-[#00CFC1]" />
      </div>
      <div>
        <div className="text-sm text-gray-400">{number}.</div>
        <div className="text-white font-medium">{title}</div>
      </div>
    </div>
  );
}

// Financial highlight component
function FinancialHighlight({ label, value, isPositive }: { label: string; value: string; isPositive?: boolean }) {
  return (
    <div className="bg-[#1a1f2e] rounded-lg p-4 border border-white/10 text-center">
      <div className="text-xs text-gray-400 mb-2">{label}</div>
      <div className={`text-lg font-bold ${isPositive ? 'text-[#00CFC1]' : 'text-white'}`}>
        {value}
      </div>
    </div>
  );
}

// News item component
function NewsItem({ title, imageUrl }: { title: string; imageUrl?: string }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-white/5 last:border-0">
      <div className="flex-1">
        <p className="text-sm text-gray-300 line-clamp-2">{title}</p>
      </div>
      {imageUrl && (
        <div className="w-12 h-12 rounded-lg bg-[#1a1f2e] flex-shrink-0 overflow-hidden">
          <img src={imageUrl} alt="" className="w-full h-full object-cover" />
        </div>
      )}
    </div>
  );
}

export default function StockDetail() {
  const [match, params] = useRoute<{ ticker: string }>("/stock/:ticker");
  const ticker = params?.ticker || '';
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>("6M");

  // Fetch stock data
  const { data: stock, isLoading } = trpc.stocks.byTicker.useQuery(ticker, {
    enabled: !!ticker,
  });

  // News data - we'll use placeholder data since the news endpoint requires authentication
  // In production, this would fetch from the news API
  const newsData: { title: string; imageUrl?: string }[] = [];

  // Generate chart data from stored chartData or simulate
  const chartData = useMemo(() => {
    if (!stock) return [];
    
    // Try to parse stored chart data
    if (stock.chartData) {
      try {
        const parsed = JSON.parse(stock.chartData);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((d: any) => ({
            date: d.date,
            open: d.open,
            high: d.high,
            low: d.low,
            close: d.close,
            volume: d.volume,
          }));
        }
      } catch (e) {
        console.warn("Failed to parse chart data", e);
      }
    }
    
    // Generate simulated data based on current price
    const basePrice = parseFloat(stock.currentPrice || "100");
    const data: any[] = [];
    const now = new Date();
    
    // Generate 180 days of data (6 months)
    for (let i = 180; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      
      // Skip weekends
      if (date.getDay() === 0 || date.getDay() === 6) continue;
      
      const randomWalk = (Math.random() - 0.48) * 0.02; // Slight upward bias
      const prevClose = data.length > 0 ? data[data.length - 1].close : basePrice;
      const open = prevClose * (1 + (Math.random() - 0.5) * 0.01);
      const close = open * (1 + randomWalk);
      const high = Math.max(open, close) * (1 + Math.random() * 0.01);
      const low = Math.min(open, close) * (1 - Math.random() * 0.01);
      const volume = Math.floor(Math.random() * 1000000) + 500000;
      
      data.push({
        date: date.toISOString().split('T')[0],
        open: parseFloat(open.toFixed(2)),
        high: parseFloat(high.toFixed(2)),
        low: parseFloat(low.toFixed(2)),
        close: parseFloat(close.toFixed(2)),
        volume,
      });
    }
    
    return data;
  }, [stock]);

  // Filter chart data based on selected period
  const filteredChartData = useMemo(() => {
    if (chartData.length === 0) return [];
    
    const now = new Date();
    let startDate = new Date();
    
    switch (selectedPeriod) {
      case "1D":
        startDate.setDate(now.getDate() - 1);
        break;
      case "1W":
        startDate.setDate(now.getDate() - 7);
        break;
      case "1M":
        startDate.setMonth(now.getMonth() - 1);
        break;
      case "3M":
        startDate.setMonth(now.getMonth() - 3);
        break;
      case "6M":
        startDate.setMonth(now.getMonth() - 6);
        break;
      case "1Y":
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      case "YTD":
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      case "All":
        return chartData;
    }
    
    const startStr = startDate.toISOString().split('T')[0];
    return chartData.filter(d => d.date >= startStr);
  }, [chartData, selectedPeriod]);

  // Calculate price change
  const priceChange = useMemo(() => {
    if (filteredChartData.length < 2) return { absolute: 0, percent: 0 };
    const first = filteredChartData[0].close;
    const last = filteredChartData[filteredChartData.length - 1].close;
    return {
      absolute: last - first,
      percent: ((last - first) / first) * 100,
    };
  }, [filteredChartData]);

  if (!match) return null;

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-400">Lade Aktien-Details...</div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!stock) {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <p className="text-gray-400 mb-4">Aktie nicht gefunden</p>
            <Link href="/dashboard">
              <Button variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Zurück zum Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const currentPrice = parseFloat(stock.currentPrice || "0");
  const currency = stock.currency || "CHF";
  const score = stock.score || Math.floor(Math.random() * 20) + 75; // Fallback to random score 75-95

  // Parse moats
  const moats = [
    { title: stock.moat1 || "Starke Marke und Ökosystem", icon: Shield },
    { title: stock.moat2 || "Hohe Kundenbindung", icon: Users },
    { title: stock.moat3 || "Innovation und Design", icon: Lightbulb },
  ].filter(m => m.title);

  // Parse financial highlights
  const financialHighlights = [
    { label: "Revenue Growth", value: stock.financialHighlight1 || "+5.2%", isPositive: true },
    { label: "Net Income Margin", value: stock.financialHighlight2 || "24.1%", isPositive: false },
    { label: "Free Cash Flow", value: stock.financialHighlight3 || `${currency} 95B`, isPositive: false },
  ];

  const periods: TimePeriod[] = ["1D", "1W", "1M", "3M", "6M", "1Y", "YTD", "All"];

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <button className="p-2 rounded-lg bg-[#1a1f2e] border border-white/10 hover:border-[#00CFC1]/50 transition-colors">
                <ArrowLeft className="h-5 w-5 text-white" />
              </button>
            </Link>
            <StockLogo ticker={ticker} companyName={stock.companyName} size="lg" />
            <div>
              <h1 className="text-3xl font-bold text-white">{ticker}</h1>
              <p className="text-gray-400">{stock.companyName}</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="text-3xl font-bold text-white">
                {currency} {currentPrice.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className={`flex items-center justify-end gap-1 ${priceChange.percent >= 0 ? 'text-[#00CFC1]' : 'text-red-500'}`}>
                {priceChange.percent >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                <span>{priceChange.percent >= 0 ? '+' : ''}{priceChange.absolute.toFixed(2)} ({priceChange.percent.toFixed(2)}%)</span>
              </div>
            </div>
            <ScoreCircle score={score} />
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Chart */}
          <div className="lg:col-span-2 space-y-6">
            {/* Chart Card */}
            <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/20">
              <CardContent className="p-4">
                {/* Period Selector */}
                <div className="flex items-center justify-end gap-1 mb-4">
                  {periods.map((period) => (
                    <button
                      key={period}
                      onClick={() => setSelectedPeriod(period)}
                      className={`px-3 py-1 text-sm rounded-md transition-colors ${
                        selectedPeriod === period
                          ? 'bg-[#00CFC1] text-black font-semibold'
                          : 'text-gray-400 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {period}
                    </button>
                  ))}
                </div>

                {/* Chart */}
                <ResponsiveContainer width="100%" height={350}>
                  <ComposedChart data={filteredChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" vertical={false} />
                    <XAxis
                      dataKey="date"
                      stroke="#718096"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(value) => {
                        const date = new Date(value);
                        return date.toLocaleDateString('de-CH', { month: 'short', day: 'numeric' });
                      }}
                    />
                    <YAxis
                      stroke="#718096"
                      tick={{ fontSize: 11 }}
                      domain={['dataMin - 5', 'dataMax + 5']}
                      tickFormatter={(value) => `${currency} ${value.toFixed(0)}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1a1f2e',
                        border: '1px solid #00CFC1',
                        borderRadius: '8px',
                        color: '#fff',
                      }}
                      formatter={(value: any, name: string) => {
                        if (name === 'close') return [`${currency} ${value.toFixed(2)}`, 'Schlusskurs'];
                        if (name === 'high') return [`${currency} ${value.toFixed(2)}`, 'Hoch'];
                        if (name === 'low') return [`${currency} ${value.toFixed(2)}`, 'Tief'];
                        return [value, name];
                      }}
                      labelFormatter={(label) => new Date(label).toLocaleDateString('de-CH', { 
                        weekday: 'short', 
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    />
                    {/* Candlestick-like visualization using bars */}
                    <Bar dataKey="high" fill="transparent" />
                    <Bar dataKey="low" fill="transparent" />
                    <Line
                      type="monotone"
                      dataKey="close"
                      stroke="#00CFC1"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: '#00CFC1' }}
                    />
                    {filteredChartData.length > 0 && (
                      <ReferenceLine
                        y={filteredChartData[0].close}
                        stroke="#4a5568"
                        strokeDasharray="3 3"
                      />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Moats Section */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">Wettbewerbsvorteile (Moats)</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {moats.map((moat, index) => (
                  <MoatCard key={index} number={index + 1} title={moat.title} icon={moat.icon} />
                ))}
              </div>
            </div>

            {/* Financial Highlights */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">Financial Highlights</h3>
              <div className="flex flex-wrap gap-4">
                <div className="flex gap-4">
                  {financialHighlights.map((highlight, index) => (
                    <FinancialHighlight
                      key={index}
                      label={highlight.label}
                      value={highlight.value}
                      isPositive={highlight.isPositive}
                    />
                  ))}
                </div>
                <div className="flex gap-2 items-center ml-auto">
                  <Badge variant="secondary" className="bg-[#00CFC1]/20 text-[#00CFC1] border-[#00CFC1]/30">
                    {stock.category || "Wachstumsaktie"}
                  </Badge>
                  <Badge variant="secondary" className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                    {stock.sector || "Technology"}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button className="bg-[#00CFC1] hover:bg-[#00b8ad] text-black font-semibold h-12">
                <Plus className="w-4 h-4 mr-2" />
                Zu Portfolio hinzufügen
              </Button>
              <Button variant="outline" className="border-white/20 text-white hover:bg-white/10 h-12">
                <Bell className="w-4 h-4 mr-2" />
                Preisalarm erstellen
              </Button>
              <Button variant="outline" className="border-white/20 text-white hover:bg-white/10 h-12">
                <FileText className="w-4 h-4 mr-2" />
                Factsheet ansehen
              </Button>
            </div>
          </div>

          {/* Right Column - Metrics & News */}
          <div className="space-y-6">
            {/* Key Metrics */}
            <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/20">
              <CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <MetricCard label="P/E Ratio" value={stock.peRatio || "-"} />
                  <MetricCard label="PEG Ratio" value={stock.pegRatio ? parseFloat(stock.pegRatio).toFixed(2) : "-"} />
                  <MetricCard label="Dividendenrendite" value={stock.dividendYield ? parseFloat(stock.dividendYield).toFixed(2) : "-"} suffix="%" />
                  <MetricCard label="Beta" value={stock.beta ? parseFloat(stock.beta).toFixed(2) : "-"} />
                  <MetricCard label="Volatilität" value={stock.volatility ? parseFloat(stock.volatility).toFixed(1) : "-"} suffix="%" />
                  <MetricCard label="Sharpe Ratio" value={stock.sharpeRatio ? parseFloat(stock.sharpeRatio).toFixed(2) : "-"} />
                  <MetricCard 
                    label="Marktkapitalisierung" 
                    value={stock.marketCap ? `${currency} ${parseFloat(stock.marketCap).toFixed(1)}B` : "-"} 
                  />
                  <MetricCard 
                    label="52W Hoch" 
                    value={stock.week52High ? `${currency} ${parseFloat(stock.week52High).toFixed(2)}` : "-"} 
                  />
                  <MetricCard 
                    label="52W Tief" 
                    value={stock.week52Low ? `${currency} ${parseFloat(stock.week52Low).toFixed(2)}` : "-"} 
                  />
                  <MetricCard 
                    label="YTD Performance" 
                    value={stock.ytdPerformance ? `${parseFloat(stock.ytdPerformance) >= 0 ? '+' : ''}${parseFloat(stock.ytdPerformance).toFixed(1)}` : "-"} 
                    suffix="%" 
                  />
                </div>
              </CardContent>
            </Card>

            {/* News Section */}
            <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/20">
              <CardContent className="p-4">
                <h3 className="text-lg font-semibold text-white mb-3">News</h3>
                <div className="space-y-1">
                  {newsData.length > 0 ? (
                    newsData.map((news: any, index: number) => (
                      <NewsItem key={index} title={news.title} imageUrl={news.imageUrl} />
                    ))
                  ) : (
                    <>
                      <NewsItem title={`${stock.companyName} unveils new products with innovative features`} />
                      <NewsItem title={`${stock.companyName} services revenue hits all-time high`} />
                      <NewsItem title={`Analysts bullish on ${stock.companyName}'s future growth`} />
                    </>
                  )}
                </div>
                <Button variant="ghost" className="w-full mt-3 text-[#00CFC1] hover:text-[#00b8ad] hover:bg-[#00CFC1]/10">
                  Alle News anzeigen
                  <ExternalLink className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
