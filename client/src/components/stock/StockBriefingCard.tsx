import { useState } from "react";
import { Sparkles, TrendingUp, CalendarClock, Target, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import ReactMarkdown from "react-markdown";

/** Markdown-Komponenten für das Briefing — kompaktes, lesbares Layout */
const mdComponents: React.ComponentProps<typeof ReactMarkdown>["components"] = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
  em: ({ children }) => <em className="text-gray-300">{children}</em>,
  ul: ({ children }) => <ul className="list-disc list-inside space-y-1 mb-2">{children}</ul>,
  li: ({ children }) => <li className="text-gray-200">{children}</li>,
  h1: ({ children }) => <h3 className="text-sm font-semibold text-white mt-3 mb-1">{children}</h3>,
  h2: ({ children }) => <h3 className="text-sm font-semibold text-white mt-3 mb-1">{children}</h3>,
  h3: ({ children }) => <h3 className="text-sm font-semibold text-white mt-3 mb-1">{children}</h3>,
};

/**
 * KI-Einzeltitel-Briefing (Earnings-Hub-Stil). On-demand: der Nutzer löst die
 * Analyse per Button aus (spart LLM-Aufrufe). Zeigt die KI-Prosa plus einen
 * kompakten Datenstreifen (Beats, nächster Termin, Analysten-Kursziel).
 */
export default function StockBriefingCard({ ticker }: { ticker: string }) {
  const [result, setResult] = useState<{ briefing: string; data: any } | null>(null);
  const briefingMutation = trpc.stocks.stockBriefing.useMutation({
    onSuccess: (r) => setResult(r as any),
  });

  const data = result?.data;
  const analyst = data?.earnings?.analyst;
  const upside = analyst?.targetPrice && data?.price ? Math.round(((analyst.targetPrice / data.price) - 1) * 100) : null;

  const hasBriefingText = result && result.briefing && result.briefing.trim().length > 10;

  return (
    <div className="mb-6 rounded-xl border border-[#00CFC1]/30 bg-gradient-to-br from-[#00CFC1]/[0.07] to-transparent p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-[#00CFC1]" />
          <h2 className="text-base font-semibold text-white">KI-Briefing</h2>
        </div>
        {(!result || !hasBriefingText) && (
          <Button
            size="sm"
            onClick={() => briefingMutation.mutate({ ticker })}
            disabled={briefingMutation.isPending}
            className="h-8 text-xs bg-[#00CFC1] text-black hover:bg-[#00CFC1]/80"
          >
            {briefingMutation.isPending
              ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Analysiere…</>
              : result && !hasBriefingText
                ? <><RefreshCw className="h-3.5 w-3.5 mr-1" /> Erneut versuchen</>
                : "Briefing erstellen"
            }
          </Button>
        )}
        {result && hasBriefingText && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => { setResult(null); briefingMutation.mutate({ ticker }); }}
            disabled={briefingMutation.isPending}
            className="h-8 text-xs text-gray-400 hover:text-white"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Aktualisieren
          </Button>
        )}
      </div>

      {!result && !briefingMutation.isPending && (
        <p className="text-sm text-gray-400">
          Eine ehrliche, ausgewogene Einschätzung in einfachen Worten: Bewertung, Qualität, Earnings-Verlauf,
          nächster Termin und Analysten-Stimmung — mit klarer Pro/Contra-Abwägung.
        </p>
      )}

      {briefingMutation.isPending && (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
          <Loader2 className="h-4 w-4 animate-spin text-[#00CFC1]" />
          KI analysiert {ticker}…
        </div>
      )}

      {briefingMutation.isError && (
        <p className="text-sm text-red-400">Briefing konnte nicht erstellt werden: {briefingMutation.error?.message ?? "Unbekannter Fehler"}</p>
      )}

      {result && (
        <div className="space-y-4">
          {/* Datenstreifen */}
          <div className="flex flex-wrap gap-2">
            {typeof data?.earnings?.beatCount === "number" && data.earnings.surprises?.length > 0 && (
              <span className="inline-flex items-center gap-1 text-xs rounded-md bg-emerald-500/10 text-emerald-300 px-2 py-1">
                <TrendingUp className="h-3.5 w-3.5" /> {data.earnings.beatCount}/{data.earnings.surprises.length} Quartale übertroffen
              </span>
            )}
            {data?.earnings?.nextEarningsDate && (
              <span className="inline-flex items-center gap-1 text-xs rounded-md bg-amber-500/10 text-amber-300 px-2 py-1">
                <CalendarClock className="h-3.5 w-3.5" /> Nächste Zahlen: {data.earnings.nextEarningsDate}
              </span>
            )}
            {analyst?.targetPrice && (
              <span className="inline-flex items-center gap-1 text-xs rounded-md bg-sky-500/10 text-sky-300 px-2 py-1">
                <Target className="h-3.5 w-3.5" /> Kursziel {data.currency} {analyst.targetPrice}
                {upside != null && <span className={upside >= 0 ? "text-emerald-300" : "text-red-300"}>({upside >= 0 ? "+" : ""}{upside}%)</span>}
              </span>
            )}
          </div>

          {/* KI-Text */}
          {hasBriefingText ? (
            <div className="text-[15px] leading-relaxed text-gray-200">
              <ReactMarkdown components={mdComponents}>
                {result.briefing}
              </ReactMarkdown>
            </div>
          ) : (
            <p className="text-sm text-amber-400">
              Das KI-Briefing konnte nicht generiert werden. Bitte erneut versuchen.
            </p>
          )}

          <p className="text-[11px] text-gray-500">
            KI-generiert auf Basis von Kurs-, Fundamental- und Analystendaten. Keine Anlageberatung — die Entscheidung liegt bei Ihnen.
          </p>
        </div>
      )}
    </div>
  );
}
