import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { ExternalLink } from "lucide-react";
import { useLocation } from "wouter";

interface NewsroomProps {
  onBackClick?: () => void;
  [key: string]: any; // For wouter route compatibility
}

export default function Newsroom({ onBackClick, ...props }: NewsroomProps = {}) {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { data: allNews = [] } = trpc.news.getAll.useQuery();
  const [selectedTicker, setSelectedTicker] = useState<string>("all");

  // Get unique tickers
  const uniqueTickers = useMemo(() => {
    const tickers = new Set(allNews.map(n => n.ticker));
    return Array.from(tickers).sort();
  }, [allNews]);

  // Filter news by selected ticker
  const filteredNews = useMemo(() => {
    if (selectedTicker === "all") {
      return allNews;
    }
    return allNews.filter(n => n.ticker === selectedTicker);
  }, [allNews, selectedTicker]);

  // Sort by date descending
  const sortedNews = useMemo(() => {
    return [...filteredNews].sort((a, b) => {
      const dateA = new Date(a.publishedAt || 0).getTime();
      const dateB = new Date(b.publishedAt || 0).getTime();
      return dateB - dateA;
    });
  }, [filteredNews]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "Wichtig":
        return "border-red-500 bg-red-950";
      case "Mittel":
        return "border-orange-500 bg-orange-950";
      case "Niedrig":
        return "border-green-500 bg-green-950";
      default:
        return "border-slate-500 bg-slate-800";
    }
  };

  const getPriorityBadgeColor = (priority: string) => {
    switch (priority) {
      case "Wichtig":
        return "bg-red-600 text-white";
      case "Mittel":
        return "bg-orange-600 text-white";
      case "Niedrig":
        return "bg-green-600 text-white";
      default:
        return "bg-slate-600 text-white";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-gradient-to-r from-purple-600 to-purple-800 text-white py-8 px-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold mb-2">Newsroom</h1>
            <p className="text-purple-100">Aktuelle Nachrichten zu deinen Aktien</p>
          </div>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (onBackClick) {
                onBackClick();
              } else {
                // Try to find and click the Portfolio tab button
                const portfolioBtn = Array.from(document.querySelectorAll('button')).find(
                  btn => btn.textContent.trim() === 'Portfolio'
                );
                if (portfolioBtn) {
                  portfolioBtn.click();
                } else {
                  setLocation("/");
                }
              }
            }}
            className="px-4 py-2 bg-purple-500 hover:bg-purple-700 text-white rounded font-medium transition-colors cursor-pointer"
            type="button"
          >
            ← Zurück
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Filter Dropdown */}
        <div className="flex gap-4">
          <select
            value={selectedTicker}
            onChange={(e) => setSelectedTicker(e.target.value)}
            className="px-4 py-2 bg-muted text-white border border-border rounded hover:border-purple-500 focus:outline-none focus:border-purple-500"
          >
            <option value="all">Alle Aktien</option>
            {uniqueTickers.map(ticker => (
              <option key={ticker} value={ticker}>{ticker}</option>
            ))}
          </select>
        </div>

        {/* News Items */}
        {sortedNews.length === 0 ? (
          <Card className="gradient-card border-border/50">
            <CardContent className="pt-6">
              <p className="text-foreground text-center">Keine Nachrichten verfügbar. Die NewsAPI-Integration wird täglich aktualisiert.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {sortedNews.map((newsItem, idx) => (
              <div
                key={idx}
                className={`border-l-4 rounded-lg p-6 ${getPriorityColor(newsItem.priority || "Mittel")} hover:border-l-8 transition-all cursor-pointer`}
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="px-2 py-1 bg-blue-600 text-white text-xs font-semibold rounded">
                        {newsItem.ticker}
                      </span>
                      <span className={`px-2 py-1 text-xs font-semibold rounded ${getPriorityBadgeColor(newsItem.priority || "Mittel")}`}>
                        {newsItem.priority || "Mittel"}
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">{newsItem.title}</h3>
                    <p className="text-foreground mb-3">{newsItem.publishedAt ? new Date(newsItem.publishedAt).toLocaleDateString("de-CH") : ""}</p>
                    <p className="text-slate-200 leading-relaxed">{newsItem.description}</p>
                  </div>
                  {newsItem.url && (
                    <a
                      href={newsItem.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-400 hover:text-purple-300 flex-shrink-0 mt-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="w-5 h-5" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
