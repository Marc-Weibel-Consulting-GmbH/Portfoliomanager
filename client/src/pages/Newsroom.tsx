import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useState, useMemo, useEffect } from "react";
import { ExternalLink, Newspaper } from "lucide-react";
import { useLocation, useSearch } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";

interface NewsroomProps {
  onBackClick?: () => void;
  embedded?: boolean; // when true, renders without DashboardLayout wrapper
  [key: string]: any; // For wouter route compatibility
}

function NewsroomInner({ tickerFromUrl }: { tickerFromUrl?: string | null }) {
  const { data: allNews = [], isLoading } = trpc.news.getAll.useQuery();
  const [selectedTicker, setSelectedTicker] = useState<string>(tickerFromUrl || "all");

  // Update selected ticker when URL changes
  useEffect(() => {
    if (tickerFromUrl) {
      setSelectedTicker(tickerFromUrl);
    }
  }, [tickerFromUrl]);

  // Get unique tickers
  const uniqueTickers = useMemo(() => {
    const tickers = new Set(allNews.map(n => n.ticker));
    return Array.from(tickers).sort();
  }, [allNews]);

  // Filter news by selected ticker
  const filteredNews = useMemo(() => {
    if (selectedTicker === "all") return allNews;
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

  const getPriorityBorder = (priority: string) => {
    switch (priority) {
      case "Wichtig": return "border-l-red-500 bg-red-950/30";
      case "Mittel": return "border-l-orange-500 bg-orange-950/20";
      case "Niedrig": return "border-l-green-500 bg-green-950/20";
      default: return "border-l-white/20 bg-white/5";
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "Wichtig": return "bg-red-600/80 text-white";
      case "Mittel": return "bg-orange-600/80 text-white";
      case "Niedrig": return "bg-green-600/80 text-white";
      default: return "bg-white/10 text-gray-300";
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 rounded-lg bg-white/5 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex gap-3 items-center">
        <select
          value={selectedTicker}
          onChange={e => setSelectedTicker(e.target.value)}
          className="px-3 py-2 bg-[#1a1f2e] text-white border border-white/10 rounded-lg text-sm hover:border-[#00CFC1]/50 focus:outline-none focus:border-[#00CFC1]"
        >
          <option value="all">Alle Aktien ({allNews.length})</option>
          {tickerFromUrl && !uniqueTickers.includes(tickerFromUrl) && (
            <option key={tickerFromUrl} value={tickerFromUrl}>{tickerFromUrl}</option>
          )}
          {uniqueTickers.map(ticker => (
            <option key={ticker} value={ticker}>{ticker}</option>
          ))}
        </select>
        {selectedTicker !== "all" && (
          <button
            onClick={() => setSelectedTicker("all")}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Filter zurücksetzen
          </button>
        )}
        <span className="text-xs text-gray-600 ml-auto">{sortedNews.length} Artikel</span>
      </div>

      {/* News Items */}
      {sortedNews.length === 0 ? (
        <Card className="bg-[#1a1f2e] border-white/10">
          <CardContent className="pt-6 pb-6 text-center">
            <Newspaper className="h-8 w-8 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">
              {selectedTicker !== "all"
                ? `Keine Nachrichten für ${selectedTicker} verfügbar.`
                : "Keine Nachrichten verfügbar. Die News-Integration wird täglich aktualisiert."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sortedNews.map((newsItem, idx) => (
            <div
              key={`${newsItem.ticker}-${idx}`}
              className={`border-l-4 rounded-lg p-4 ${getPriorityBorder(newsItem.priority || "Mittel")} hover:border-l-[6px] transition-all`}
            >
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="px-2 py-0.5 bg-[#00CFC1]/20 text-[#00CFC1] text-xs font-semibold rounded">
                      {newsItem.ticker}
                    </span>
                    {newsItem.priority && (
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded ${getPriorityBadge(newsItem.priority)}`}>
                        {newsItem.priority}
                      </span>
                    )}
                    {newsItem.publishedAt && (
                      <span className="text-xs text-gray-500">
                        {new Date(newsItem.publishedAt).toLocaleDateString("de-CH")}
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-semibold text-white mb-1 leading-snug">{newsItem.title}</h3>
                  {newsItem.description && (
                    <p className="text-xs text-gray-400 leading-relaxed line-clamp-2">{newsItem.description}</p>
                  )}
                </div>
                {newsItem.url && (
                  <a
                    href={newsItem.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-600 hover:text-[#00CFC1] flex-shrink-0 mt-1 transition-colors"
                    onClick={e => e.stopPropagation()}
                    title="Artikel öffnen"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Newsroom({ onBackClick, embedded, ...props }: NewsroomProps = {}) {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const tickerFromUrl = searchParams.get("ticker");

  // When embedded as a tab, just render the inner content
  if (embedded) {
    return <NewsroomInner tickerFromUrl={tickerFromUrl} />;
  }

  // Standalone page with DashboardLayout
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[#00CFC1] uppercase tracking-widest mb-1">MARKT</p>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Newspaper className="h-6 w-6 text-[#00CFC1]" /> Newsroom
            </h1>
            <p className="text-sm text-gray-400 mt-1">Aktuelle Nachrichten zu Ihren Aktien</p>
          </div>
          {onBackClick && (
            <button
              onClick={onBackClick}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              ← Zurück
            </button>
          )}
        </div>
        <NewsroomInner tickerFromUrl={tickerFromUrl} />
      </div>
    </DashboardLayout>
  );
}
