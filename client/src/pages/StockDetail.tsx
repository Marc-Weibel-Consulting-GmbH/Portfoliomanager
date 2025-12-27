import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export default function StockDetail() {
  const [match, params] = useRoute<{ ticker: string }>("/stock/:ticker");
  const ticker = params?.ticker || '';

  const { data: stock } = trpc.stocks.byTicker.useQuery(ticker, {
    enabled: !!ticker,
  });

  if (!match) return null;

  if (!stock) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Aktie nicht gefunden</p>
          <a href="/" className="text-blue-400 hover:text-blue-300">
            Zurück zur Übersicht
          </a>
        </div>
      </div>
    );
  }

  // Generate realistic intraday price data with multiple points per day
  const basePrice = parseFloat(stock.currentPrice || "0");
  const generateChartData = () => {
    const data: Array<{ time: string; price: number; day: string }> = [];
    const days = ["Mo", "Di", "Mi", "Do", "Fr"];
    
    days.forEach((day, dayIndex) => {
      const dayVariation = (Math.random() - 0.5) * 0.04; // ±2% daily variation
      const dayBasePrice = basePrice * (1 + dayVariation);
      
      // Generate 4 intraday points per day (opening, mid-morning, afternoon, closing)
      const times = ["09:30", "12:00", "15:00", "17:30"];
      times.forEach((time, timeIndex) => {
        const intraVariation = (Math.random() - 0.5) * 0.015; // ±0.75% intraday variation
        const price = dayBasePrice * (1 + intraVariation);
        data.push({
          time: `${day} ${time}`,
          price: parseFloat(price.toFixed(2)),
          day,
        });
      });
    });
    
    return data;
  };

  const chartData = generateChartData();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="gradient-primary text-white py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <a href="/" className="inline-flex items-center text-blue-100 hover:text-white mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Zurück
          </a>
          <h1 className="text-4xl font-bold mb-2">{stock.companyName}</h1>
          <p className="text-blue-100">{stock.ticker}</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="gradient-card border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Aktueller Kurs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">
                {stock.currentPrice} {stock.currency}
              </div>
            </CardContent>
          </Card>

          <Card className="gradient-card border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">P/E Ratio</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">{stock.peRatio || "-"}</div>
            </CardContent>
          </Card>

          <Card className="gradient-card border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Dividendenrendite</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-400">{stock.dividendYield ? `${stock.dividendYield}%` : "-"}</div>
            </CardContent>
          </Card>

          <Card className="gradient-card border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Portfolio %</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-400">{stock.portfolioWeight || "0"}%</div>
            </CardContent>
          </Card>
        </div>

        {/* Price Chart */}
        <Card className="gradient-card border-border/50">
          <CardHeader>
            <CardTitle className="text-white">Kursverlauf (Intraday)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis 
                  dataKey="time" 
                  stroke="#94a3b8"
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  stroke="#94a3b8"
                  tick={{ fontSize: 12 }}
                  domain={["dataMin - 5", "dataMax + 5"]}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #475569" }}
                  labelStyle={{ color: "#e2e8f0" }}
                  formatter={(value: any) => `${typeof value === 'number' ? value.toFixed(2) : value} ${stock.currency}`}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="price" 
                  stroke="#3b82f6" 
                  dot={false}
                  strokeWidth={2}
                  name="Kurs"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Moats */}
        <Card className="gradient-card border-border/50">
          <CardHeader>
            <CardTitle className="text-white">Wettbewerbsvorteile (Moats)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stock.moat1 && (
                <div className="p-4 bg-slate-700 rounded-lg border border-slate-600">
                  <h3 className="font-semibold text-white mb-2">1. Moat</h3>
                  <p className="text-foreground">{stock.moat1}</p>
                </div>
              )}
              {stock.moat2 && (
                <div className="p-4 bg-slate-700 rounded-lg border border-slate-600">
                  <h3 className="font-semibold text-white mb-2">2. Moat</h3>
                  <p className="text-foreground">{stock.moat2}</p>
                </div>
              )}
              {stock.moat3 && (
                <div className="p-4 bg-slate-700 rounded-lg border border-slate-600">
                  <h3 className="font-semibold text-white mb-2">3. Moat</h3>
                  <p className="text-foreground">{stock.moat3}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Additional Info */}
        <Card className="gradient-card border-border/50">
          <CardHeader>
            <CardTitle className="text-white">Weitere Informationen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-muted-foreground text-sm">Kategorie</p>
                <p className="text-white font-semibold">{stock.category}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-sm">PEG Ratio</p>
                <p className="text-white font-semibold">{stock.pegRatio ? parseFloat(stock.pegRatio).toFixed(2) : "-"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
