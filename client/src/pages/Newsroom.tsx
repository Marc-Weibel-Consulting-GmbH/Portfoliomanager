import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Plus, Trash2, Edit2 } from "lucide-react";

interface NewsItem {
  id: string;
  ticker: string;
  title: string;
  content: string;
  date: string;
  importance: "high" | "medium" | "low";
}

export default function Newsroom() {
  const { isAuthenticated } = useAuth();
  const { data: stocks = [] } = trpc.stocks.list.useQuery();
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingNews, setEditingNews] = useState<NewsItem | null>(null);
  const [formData, setFormData] = useState<Partial<NewsItem>>({});
  const [newsItems, setNewsItems] = useState<NewsItem[]>([
    {
      id: "1",
      ticker: "NVDA",
      title: "NVIDIA Q3 Earnings Beat Expectations",
      content: "NVIDIA reported strong Q3 earnings with record data center revenue growth of 217% YoY.",
      date: "2024-10-22",
      importance: "high",
    },
    {
      id: "2",
      ticker: "MSFT",
      title: "Microsoft Expands AI Partnerships",
      content: "Microsoft announced new partnerships with leading AI companies to integrate advanced models into its cloud services.",
      date: "2024-10-21",
      importance: "medium",
    },
    {
      id: "3",
      ticker: "TSLA",
      title: "Tesla Announces New Production Facility",
      content: "Tesla plans to open a new Gigafactory in Mexico, expected to produce 1 million vehicles annually.",
      date: "2024-10-20",
      importance: "high",
    },
  ]);

  const handleAddNews = () => {
    if (formData.ticker && formData.title && formData.content) {
      const newItem: NewsItem = {
        id: Date.now().toString(),
        ticker: formData.ticker,
        title: formData.title,
        content: formData.content,
        date: new Date().toISOString().split("T")[0],
        importance: (formData.importance as "high" | "medium" | "low") || "medium",
      };
      setNewsItems([newItem, ...newsItems]);
      setIsAddDialogOpen(false);
      setFormData({});
    }
  };

  const handleDeleteNews = (id: string) => {
    setNewsItems(newsItems.filter(item => item.id !== id));
  };

  const filteredNews = selectedTicker
    ? newsItems.filter(item => item.ticker === selectedTicker)
    : newsItems;

  const importanceColors = {
    high: "bg-red-900/30 border-red-700 text-red-400",
    medium: "bg-yellow-900/30 border-yellow-700 text-yellow-400",
    low: "bg-blue-900/30 border-blue-700 text-blue-400",
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-800 text-white py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl font-bold mb-2">Newsroom</h1>
          <p className="text-purple-100">Aktuelle Nachrichten und Informationen zu deinen Aktien</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 space-y-6">
        {/* Navigation Tabs */}
        <div className="flex gap-2 mb-4">
          <a href="/" className="px-4 py-2 bg-slate-700 text-white rounded hover:bg-slate-600">
            Portfolio
          </a>
          <a href="/newsroom" className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">
            Newsroom
          </a>
        </div>
        {/* Controls */}
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="w-full md:w-48">
            <select
              value={selectedTicker || "all"}
              onChange={(e) => setSelectedTicker(e.target.value === "all" ? null : e.target.value)}
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 text-white rounded"
            >
              <option value="all">Alle Aktien</option>
              {stocks.map(stock => (
                <option key={stock.ticker} value={stock.ticker}>
                  {stock.ticker} - {stock.companyName}
                </option>
              ))}
            </select>
          </div>

          {isAuthenticated && (
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-purple-600 hover:bg-purple-700 text-white">
                  <Plus className="w-4 h-4 mr-2" />
                  Neue Nachricht
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-slate-800 border-slate-700">
                <DialogHeader>
                  <DialogTitle className="text-white">Neue Nachricht hinzufügen</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <select
                    value={formData.ticker || ""}
                    onChange={(e) => setFormData({ ...formData, ticker: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 text-white rounded"
                  >
                    <option value="">Aktie wählen</option>
                    {stocks.map(stock => (
                      <option key={stock.ticker} value={stock.ticker}>
                        {stock.ticker} - {stock.companyName}
                      </option>
                    ))}
                  </select>
                  <Input
                    placeholder="Titel"
                    value={formData.title || ""}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                  <textarea
                    placeholder="Inhalt"
                    value={formData.content || ""}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 text-white rounded"
                    rows={4}
                  />
                  <select
                    value={formData.importance || "medium"}
                    onChange={(e) => setFormData({ ...formData, importance: e.target.value as any })}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 text-white rounded"
                  >
                    <option value="low">Niedrig</option>
                    <option value="medium">Mittel</option>
                    <option value="high">Hoch</option>
                  </select>
                  <Button onClick={handleAddNews} className="w-full bg-green-600 hover:bg-green-700">
                    Hinzufügen
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* News Feed */}
        <div className="space-y-4">
          {filteredNews.length === 0 ? (
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="py-8">
                <p className="text-center text-slate-400">Keine Nachrichten verfügbar</p>
              </CardContent>
            </Card>
          ) : (
            filteredNews.map(news => (
              <Card key={news.id} className={`border ${importanceColors[news.importance]}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-1 bg-slate-700 text-slate-200 rounded text-xs font-semibold">
                          {news.ticker}
                        </span>
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${importanceColors[news.importance]}`}>
                          {news.importance === "high" ? "Wichtig" : news.importance === "medium" ? "Mittel" : "Niedrig"}
                        </span>
                      </div>
                      <CardTitle className="text-white text-lg">{news.title}</CardTitle>
                      <p className="text-sm text-slate-400 mt-1">{news.date}</p>
                    </div>
                    {isAuthenticated && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-600 hover:bg-red-700/20"
                        onClick={() => handleDeleteNews(news.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-300">{news.content}</p>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

