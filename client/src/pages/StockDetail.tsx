import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from "recharts";

export default function StockDetail() {
  const [match, params] = useRoute("/stock/:ticker");
  const ticker = params?.ticker as string;

  const { data: stock } = trpc.stocks.byTicker.useQuery(ticker, {
    enabled: !!ticker,
  });

  if (!match) return null;

  if (!stock) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400 mb-4">Aktie nicht gefunden</p>
          <a href="/" className="text-blue-400 hover:text-blue-300">
            Zurück zur Übersicht
          </a>
        </div>
      </div>
    );
  }

  // Mock data for chart - in real app, this would come from an API
  const chartData = [
    { date: "Mo", price: parseFloat(stock.currentPrice || "0") * 0.95 },
    { date: "Di", price: parseFloat(stock.currentPrice || "0") * 0.97 },
    { date: "Mi", price: parseFloat(stock.currentPrice || "0") * 0.99 },
    { date: "Do", price: parseFloat(stock.currentPrice || "0") * 1.01 },
    { date: "Fr", price: parseFloat(stock.currentPrice || "0") * 1.02 },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-8 px-4">
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
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-400">Aktueller Kurs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">
                {stock.currentPrice} {stock.currency}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-400">P/E Ratio</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">{stock.peRatio || "-"}</div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-400">Dividendenrendite</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-400">{stock.dividendYield ? `${stock.dividendYield}%` : "-"}</div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-400">Kategorie</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold text-blue-400">{stock.category}</div>
            </CardContent>
          </Card>
        </div>

        {/* Chart */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Kursverlauf (letzte 5 Tage)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                <XAxis dataKey="date" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    border: "1px solid #475569",
                    borderRadius: "8px",
                  }}
                  labelStyle={{ color: "#e2e8f0" }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: "#3b82f6", r: 5 }}
                  activeDot={{ r: 7 }}
                  name="Kurs"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Moats */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Wettbewerbsvorteile (Moats)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stock.moat1 && (
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                    1
                  </div>
                  <div>
                    <p className="text-white font-medium">{stock.moat1}</p>
                  </div>
                </div>
              )}
              {stock.moat2 && (
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                    2
                  </div>
                  <div>
                    <p className="text-white font-medium">{stock.moat2}</p>
                  </div>
                </div>
              )}
              {stock.moat3 && (
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                    3
                  </div>
                  <div>
                    <p className="text-white font-medium">{stock.moat3}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Additional Info */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Zusätzliche Informationen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-slate-400 text-sm">Währung</p>
                <p className="text-white font-medium">{stock.currency}</p>
              </div>
              <div>
                <p className="text-slate-400 text-sm">Wechselkurs zu CHF</p>
                <p className="text-white font-medium">{stock.exchangeRateToChf}</p>
              </div>
              <div>
                <p className="text-slate-400 text-sm">PEG Ratio</p>
                <p className="text-white font-medium">{stock.pegRatio || "-"}</p>
              </div>
              <div>
                <p className="text-slate-400 text-sm">Kategorie</p>
                <p className="text-white font-medium">{stock.category}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

