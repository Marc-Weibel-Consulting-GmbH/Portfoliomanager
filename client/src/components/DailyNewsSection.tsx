import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";

interface DailyNewsSectionProps {
  ticker: string;
  companyName: string;
}

export function DailyNewsSection({ ticker, companyName }: DailyNewsSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { data: newsData, isLoading, error } = trpc.stocks.dailyNews.useQuery(
    { ticker, companyName },
    { enabled: isExpanded } // Only fetch when expanded
  );

  return (
    <div className="pt-4 border-t border-slate-700">
      <Button
        onClick={() => setIsExpanded(!isExpanded)}
        variant="outline"
        className="w-full bg-slate-700/50 hover:bg-slate-700 text-white border-slate-600 justify-between"
      >
        <span className="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
          KI-Tagesüberblick
        </span>
        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </Button>

      {isExpanded && (
        <div className="mt-3 space-y-3">
          {isLoading && (
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-4 flex items-center justify-center gap-2 text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Generiere KI-Tagesüberblick...</span>
              </CardContent>
            </Card>
          )}

          {error && (
            <Card className="bg-red-900/20 border-red-700">
              <CardContent className="p-4 text-red-400">
                Fehler beim Laden der News: {error.message}
              </CardContent>
            </Card>
          )}

          {newsData && (
            <>
              {/* Earnings Releases */}
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-yellow-400 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                    </svg>
                    {newsData.earningsReleases.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-slate-300">
                  {newsData.earningsReleases.content}
                </CardContent>
              </Card>

              {/* Company News */}
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-blue-400 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                    </svg>
                    {newsData.companyNews.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-slate-300">
                  {newsData.companyNews.content}
                </CardContent>
              </Card>

              {/* Related Articles */}
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-green-400 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                    </svg>
                    {newsData.relatedArticles.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-slate-300">
                  {newsData.relatedArticles.content}
                </CardContent>
              </Card>

              {/* Timestamp */}
              <p className="text-xs text-slate-500 text-center">
                Generiert am {new Date(newsData.generatedAt).toLocaleString("de-CH", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
