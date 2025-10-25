import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { TrendingUp, TrendingDown } from "lucide-react";

export default function Performance() {
  const { data: stocks = [] } = trpc.stocks.list.useQuery();

  // Calculate YTD performance for each stock and sort by performance
  const topPerformers = stocks
    .map(stock => ({
      ...stock,
      ytdPerf: parseFloat(stock.ytdPerformance || "0")
    }))
    .filter(stock => stock.ytdPerf !== 0) // Only show stocks with YTD data
    .sort((a, b) => b.ytdPerf - a.ytdPerf)
    .slice(0, 10); // Top 10

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Top 10 YTD Performers</h1>
          <p className="text-slate-300">Die besten Aktien nach Year-to-Date Performance</p>
        </div>

        <div className="grid gap-4">
          {topPerformers.length === 0 ? (
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-8 text-center">
                <p className="text-slate-400">
                  Keine YTD Performance-Daten verfügbar. Die Daten werden beim nächsten automatischen Update geladen.
                </p>
              </CardContent>
            </Card>
          ) : (
            topPerformers.map((stock, index) => (
              <Card key={stock.ticker} className="bg-slate-800 border-slate-700 hover:border-blue-500 transition-colors">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`text-2xl font-bold w-10 h-10 rounded-full flex items-center justify-center ${
                        index === 0 ? 'bg-yellow-500 text-black' :
                        index === 1 ? 'bg-slate-400 text-black' :
                        index === 2 ? 'bg-orange-600 text-white' :
                        'bg-slate-700 text-slate-300'
                      }`}>
                        {index + 1}
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-white">{stock.companyName}</h3>
                        <p className="text-sm text-slate-400">{stock.ticker} • {stock.category}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-3xl font-bold flex items-center gap-2 ${
                        stock.ytdPerf >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {stock.ytdPerf >= 0 ? <TrendingUp size={32} /> : <TrendingDown size={32} />}
                        {stock.ytdPerf >= 0 ? '+' : ''}{stock.ytdPerf.toFixed(1)}%
                      </div>
                      <p className="text-sm text-slate-400 mt-1">
                        Kurs: {parseFloat(stock.currentPrice || "0").toFixed(2)} {stock.currency}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
