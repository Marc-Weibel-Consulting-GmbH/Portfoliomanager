import { useState, useMemo } from "react";
import { useParams, Link } from "wouter";
import {
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Bell,
  Plus,
  FileText,
  Shield,
  Users,
  Lightbulb,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { StockLogo } from "@/components/StockLogo";

const formatCurrency = (value: number, currency: string = 'CHF') => {
  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

const formatNumber = (value: number) => {
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
  return value.toFixed(2);
};

export default function StockDetailPage() {
  const params = useParams<{ ticker: string }>();
  const ticker = params.ticker || "";
  
  const [selectedPeriod, setSelectedPeriod] = useState("6M");
  
  // Fetch stock data
  const { data, isLoading } = trpc.stocks.getDetailByTicker.useQuery(
    { ticker },
    { enabled: !!ticker }
  );
  
  const stock = data?.stock;
  const news = data?.news || [];
  const historicalPrices = data?.historicalPrices || [];
  
  // Prepare chart data
  const chartData = useMemo(() => {
    if (!historicalPrices || historicalPrices.length === 0) return [];
    
    return historicalPrices.map((price: any) => ({
      date: new Date(price.date).toLocaleDateString('de-CH', { month: 'short', day: 'numeric' }),
      price: parseFloat(price.close || '0'),
      volume: parseFloat(price.volume || '0'),
    }));
  }, [historicalPrices]);
  
  // Calculate Y-axis domain with padding
  const priceRange = useMemo(() => {
    if (chartData.length === 0) return [0, 100];
    
    const prices = chartData.map(d => d.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const padding = (maxPrice - minPrice) * 0.1; // 10% padding
    
    return [
      Math.max(0, minPrice - padding),
      maxPrice + padding
    ];
  }, [chartData]);
  
  // Calculate price change
  const priceChange = useMemo(() => {
    if (!stock || !stock.currentPrice || !stock.ytdStartPrice) return { value: 0, percent: 0 };
    
    const current = parseFloat(stock.currentPrice);
    const ytdStart = parseFloat(stock.ytdStartPrice);
    
    if (ytdStart === 0) return { value: 0, percent: 0 };
    
    const change = current - ytdStart;
    const percent = (change / ytdStart) * 100;
    
    return { value: change, percent };
  }, [stock]);
  
  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-white">Laden...</div>
        </div>
      </DashboardLayout>
    );
  }
  
  if (!stock) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-white">Aktie nicht gefunden</div>
        </div>
      </DashboardLayout>
    );
  }
  
  const currentPrice = parseFloat(stock.currentPrice || '0');
  const score = stock.score || 0;
  
  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Back Button */}
        <Link href="/portfolios">
          <Button variant="ghost" className="text-gray-400 hover:text-white">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zurück zu Portfolios
          </Button>
        </Link>
        
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <StockLogo ticker={stock.ticker} companyName={stock.companyName} size="lg" />
            <div>
              <h1 className="text-4xl font-bold text-white">{stock.ticker}</h1>
              <p className="text-xl text-gray-400">{stock.companyName}</p>
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-4xl font-bold text-white">
              {formatCurrency(currentPrice, stock.currency || 'CHF')}
            </div>
            <div className={`flex items-center justify-end gap-2 text-lg ${priceChange.percent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {priceChange.percent >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
              <span>
                {priceChange.percent >= 0 ? '+' : ''}{priceChange.value.toFixed(2)} ({priceChange.percent.toFixed(2)}%)
              </span>
            </div>
            
            {/* Quality Score */}
            <div className="mt-4 flex items-center justify-end gap-2">
              <div className="relative w-16 h-16">
                <svg className="w-16 h-16 transform -rotate-90">
                  <circle
                    cx="32"
                    cy="32"
                    r="28"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                    className="text-gray-700"
                  />
                  <circle
                    cx="32"
                    cy="32"
                    r="28"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 28}`}
                    strokeDashoffset={`${2 * Math.PI * 28 * (1 - score / 100)}`}
                    className="text-[#00CFC1]"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-bold text-white">{score}</span>
                </div>
              </div>
              <span className="text-sm text-gray-400">/ 100</span>
            </div>
          </div>
        </div>
        
        {/* Period Buttons */}
        <div className="flex gap-2">
          {['1D', '1W', '1M', '3M', '6M', '1Y', 'YTD', 'All'].map((period) => (
            <Button
              key={period}
              variant={selectedPeriod === period ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedPeriod(period)}
              className={selectedPeriod === period ? 'bg-[#00CFC1] text-black' : ''}
            >
              {period}
            </Button>
          ))}
        </div>
        
        {/* Price Chart */}
        <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30">
          <CardContent className="p-6">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#9CA3AF"
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis 
                    yAxisId="price"
                    stroke="#9CA3AF"
                    style={{ fontSize: '12px' }}
                    domain={priceRange}
                    tickFormatter={(value) => formatNumber(value)}
                  />
                  <YAxis 
                    yAxisId="volume"
                    orientation="right"
                    stroke="#9CA3AF"
                    style={{ fontSize: '12px' }}
                    tickFormatter={(value) => formatNumber(value)}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1F2937',
                      border: '1px solid #374151',
                      borderRadius: '8px',
                      color: '#fff',
                    }}
                    formatter={(value: any, name: string) => {
                      if (name === 'price') return [formatCurrency(value, stock.currency || 'CHF'), 'Preis'];
                      if (name === 'volume') return [formatNumber(value), 'Volumen'];
                      return [value, name];
                    }}
                  />
                  <Bar yAxisId="volume" dataKey="volume" fill="#374151" opacity={0.3} />
                  <Area
                    yAxisId="price"
                    type="basis"
                    dataKey="price"
                    stroke="#00CFC1"
                    strokeWidth={2}
                    fill="url(#colorPrice)"
                    fillOpacity={0.2}
                  />
                  <defs>
                    <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00CFC1" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#00CFC1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Moats & Financial Highlights */}
          <div className="lg:col-span-2 space-y-6">
            {/* Wettbewerbsvorteile (Moats) */}
            <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30">
              <CardHeader>
                <CardTitle className="text-white">Wettbewerbsvorteile (Moats)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { icon: <Shield className="h-6 w-6" />, text: stock.moat1 || 'Starke Marke und Ökosystem' },
                    { icon: <Users className="h-6 w-6" />, text: stock.moat2 || 'Hohe Kundenbindung' },
                    { icon: <Lightbulb className="h-6 w-6" />, text: stock.moat3 || 'Innovation und Design' },
                  ].map((moat, idx) => (
                    <div key={idx} className="bg-[#0f1420]/50 p-4 rounded-lg border border-[#00CFC1]/20">
                      <div className="flex items-start gap-3">
                        <div className="text-[#00CFC1] mt-1">{moat.icon}</div>
                        <p className="text-sm text-gray-300">{moat.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            {/* Financial Highlights */}
            <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30">
              <CardHeader>
                <CardTitle className="text-white">Financial Highlights</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { label: 'Revenue Growth', value: stock.financialHighlight1 || '+5.2%' },
                    { label: 'Net Income Margin', value: stock.financialHighlight2 || '24.1%' },
                    { label: 'Free Cash Flow', value: stock.financialHighlight3 || formatCurrency(95800000000, stock.currency || 'CHF') },
                  ].map((highlight, idx) => (
                    <div key={idx} className="bg-[#0f1420]/50 p-4 rounded-lg border border-[#00CFC1]/20 text-center">
                      <div className="text-sm text-gray-400 mb-2">{highlight.label}</div>
                      <div className="text-2xl font-bold text-white">{highlight.value}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            {/* Category & Sector Badges */}
            <div className="flex gap-2">
              {stock.category && (
                <Badge className="bg-[#00CFC1] text-black text-sm px-3 py-1">
                  {stock.category}
                </Badge>
              )}
              {stock.sector && (
                <Badge variant="outline" className="text-[#00CFC1] border-[#00CFC1] text-sm px-3 py-1">
                  {stock.sector}
                </Badge>
              )}
            </div>
          </div>
          
          {/* Right Column - Fundamentals */}
          <div className="space-y-4">
            <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30">
              <CardHeader>
                <CardTitle className="text-white text-lg">Fundamentaldaten</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: 'P/E Ratio', value: stock.peRatio || '28.5' },
                  { label: 'PEG Ratio', value: stock.pegRatio || '2.1' },
                  { label: 'Dividendenrendite', value: `${stock.dividendYield || '0.5'}%` },
                  { label: 'Beta', value: stock.beta || '1.15' },
                  { label: 'Volatilität', value: `${stock.volatility || '22.3'}%` },
                  { label: 'Sharpe Ratio', value: stock.sharpeRatio || '1.85' },
                  { label: 'Marktkapitalisierung', value: formatCurrency(parseFloat(stock.marketCap || '0'), stock.currency || 'CHF') },
                  { label: '52W Hoch', value: formatCurrency(parseFloat(stock.week52High || '0'), stock.currency || 'CHF') },
                  { label: '52W Tief', value: formatCurrency(parseFloat(stock.week52Low || '0'), stock.currency || 'CHF') },
                  { label: 'YTD Performance', value: `${priceChange.percent >= 0 ? '+' : ''}${priceChange.percent.toFixed(2)}%` },
                ].map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                    <span className="text-sm text-gray-400">{item.label}</span>
                    <span className="text-sm font-semibold text-white">{item.value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
        
        {/* News Section */}
        <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30">
          <CardHeader>
            <CardTitle className="text-white">News</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {news.length > 0 ? (
                news.slice(0, 3).map((article: any, idx: number) => (
                  <a
                    key={idx}
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex gap-4 p-4 bg-[#0f1420]/50 rounded-lg border border-[#00CFC1]/20 hover:border-[#00CFC1]/50 transition-colors"
                  >
                    {article.imageUrl && (
                      <img
                        src={article.imageUrl}
                        alt={article.title}
                        className="w-24 h-24 object-cover rounded-lg"
                      />
                    )}
                    <div className="flex-1">
                      <h3 className="text-white font-semibold mb-2">{article.title}</h3>
                      <p className="text-sm text-gray-400 line-clamp-2">{article.description}</p>
                    </div>
                  </a>
                ))
              ) : (
                <p className="text-gray-400 text-center py-4">Keine News verfügbar</p>
              )}
            </div>
          </CardContent>
        </Card>
        
        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Button className="bg-[#00CFC1] text-black hover:bg-[#00CFC1]/90 h-12">
            <Plus className="h-5 w-5 mr-2" />
            Zu Portfolio hinzufügen
          </Button>
          <Button variant="outline" className="border-[#00CFC1] text-[#00CFC1] hover:bg-[#00CFC1]/10 h-12">
            <Bell className="h-5 w-5 mr-2" />
            Preisalarm erstellen
          </Button>
          <Button variant="outline" className="border-[#00CFC1] text-[#00CFC1] hover:bg-[#00CFC1]/10 h-12">
            <FileText className="h-5 w-5 mr-2" />
            Factsheet ansehen
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
