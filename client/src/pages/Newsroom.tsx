import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { ExternalLink } from "lucide-react";

export default function Newsroom() {
  const { user, isAuthenticated } = useAuth();
  const { data: allNews = [] } = trpc.news.getAll.useQuery();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="bg-gradient-to-r from-purple-600 to-purple-800 text-white py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl font-bold mb-2">Newsroom</h1>
          <p className="text-purple-100">Aktuelle Nachrichten zu deinen Aktien</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 space-y-6">
        {allNews.length === 0 ? (
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6">
              <p className="text-slate-300 text-center">Nachrichten werden geladen... Die NewsAPI-Integration wird täglich aktualisiert.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-white">Aktuelle Nachrichten ({allNews.length})</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {allNews.map((newsItem, idx) => (
                <Card key={idx} className="bg-slate-800 border-slate-700 hover:border-purple-500 transition-colors overflow-hidden">
                  {newsItem.imageUrl && (
                    <div className="w-full h-40 bg-slate-700 overflow-hidden">
                      <img src={newsItem.imageUrl} alt={newsItem.title} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle className="text-sm font-medium text-white line-clamp-2">{newsItem.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-slate-300 line-clamp-3">{newsItem.description}</p>
                    <div className="flex justify-between items-center">
                      <div className="text-xs space-y-1">
                        <p className="text-slate-400">Ticker: <span className="text-blue-400 font-semibold">{newsItem.ticker}</span></p>
                        <p className="text-slate-500">{newsItem.source} • {new Date(newsItem.publishedAt || "").toLocaleDateString()}</p>
                      </div>
                      {newsItem.url && (
                        <a href={newsItem.url} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300">
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
