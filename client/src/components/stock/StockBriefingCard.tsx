import { useState } from "react";
import { Sparkles, TrendingUp, CalendarClock, Target, Loader2, RefreshCw, Clock } from "lucide-react";
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

/** Formatiert Cache-Alter als lesbaren String */
function formatCacheAge(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `vor ${h}h ${m}m`;
  if (m > 0) return `vor ${m}m`;
  return "gerade eben";
}

type BriefingResult = {
  briefing: string;
  data: any;
  fromCache?: boolean;
  cacheAge?: number;
  generatedAt?: Date | string | null;
};

/**
 * KI-Einzeltitel-Briefing (Earnings-Hub-Stil). On-demand: der Nutzer löst die
 * Analyse per Button aus (spart LLM-Aufrufe). Zeigt die KI-Prosa plus einen
 * kompakten Datenstreifen (Beats, nächster Termin, Analysten-Kursziel).
 * 24h-Cache: Einmal generierte Briefings werden sofort aus dem Cache geladen.
 */
export default function StockBriefingCard({ ticker }: { ticker: string }) {
  const [result, setResult] = useState<BriefingResult | null>(null);

  const briefingMutation = trpc.stocks.stockBriefing.useMutation({
    onSuccess: (r) => setResult(r as BriefingResult),
  });

  const triggerBriefing = (forceRefresh = false) => {
    briefingMutation.mutate({ ticker, forceRefresh });
  };

  const data = result?.data;
  const analyst = data?.earnings?.analyst;
  const upside = analyst?.targetPrice && data?.price
    ? Math.round(((analyst.targetPrice / data.price) - 1) * 100)
    : null;

  const hasBriefingText = result && result.briefing && result.briefing.trim().length > 10;
  const fromCache = result?.fromCache ?? false;
  const cacheAge = result?.cacheAge ?? 0;

  return (
    <div className="mb-6 rounded-xl border border-[#00CFC1]/30 bg-gradient-to-br from-[#00CFC1]/[0.07] to-transparent p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-[#00CFC1]" />
          <h2 className="text-base font-semibold text-white">KI-Briefing</h2>
          {/* Cache-Altersanzeige */}
          {result && hasBriefingText && fromCache && (
            <span className="inline-flex items-center gap-1 text-[11px] text-gray-500">
              <Clock className="h-3 w-3" />
              {formatCacheAge(cacheAge)}
            </span>
          )}
        </div>

        {/* Primärer Button: nur wenn noch kein Ergebnis oder Fehler */}
        {(!result || !hasBriefingText) && (
          <Button
            size="sm"
            onClick={() => triggerBriefing(false)}
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

        {/* Aktualisieren-Button: wenn Ergebnis vorhanden */}
        {result && hasBriefingText && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => triggerBriefing(true)}
            disabled={briefingMutation.isPending}
            title="Neues Briefing generieren (Cache umgehen)"
            className="h-8 text-xs text-gray-400 hover:text-white"
          >
            {briefingMutation.isPending
              ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Aktualisiere…</>
              : <><RefreshCw className="h-3.5 w-3.5 mr-1" /> Aktualisieren</>
            }
          </Button>
        )}
      </div>

      {/* Beschreibung vor dem ersten Laden */}
      {!result && !briefingMutation.isPending && (
        <p className="text-sm text-gray-400">
          Eine ehrliche, ausgewogene Einschätzung in einfachen Worten: Bewertung, Qualität, Earnings-Verlauf,
          nächster Termin und Analysten-Stimmung — mit klarer Pro/Contra-Abwägung.
        </p>
      )}

      {/* Lade-Indikator */}
      {briefingMutation.isPending && (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
          <Loader2 className="h-4 w-4 animate-spin text-[#00CFC1]" />
          {fromCache ? "Neues Briefing wird generiert…" : `KI analysiert ${ticker}…`}
        </div>
      )}

      {/* Fehler */}
      {briefingMutation.isError && !briefingMutation.isPending && (
        <p className="text-sm text-red-400">
          Briefing konnte nicht erstellt werden: {briefingMutation.error?.message ?? "Unbekannter Fehler"}
        </p>
      )}

      {/* Ergebnis */}
      {result && (
        <div className="space-y-4">
          {/* Datenstreifen */}
          <div className="flex flex-wrap gap-2">
            {typeof data?.earnings?.beatCount === "number" && data.earnings.surprises?.length > 0 && (
              <span className="inline-flex items-center gap-1 text-xs rounded-md bg-emerald-500/10 text-emerald-300 px-2 py-1">
                <TrendingUp className="h-3.5 w-3.5" />
                {data.earnings.beatCount}/{data.earnings.surprises.length} Quartale übertroffen
              </span>
            )}
            {data?.earnings?.nextEarningsDate && (
              <span className="inline-flex items-center gap-1 text-xs rounded-md bg-amber-500/10 text-amber-300 px-2 py-1">
                <CalendarClock className="h-3.5 w-3.5" />
                Nächste Zahlen: {data.earnings.nextEarningsDate}
              </span>
            )}
            {analyst?.targetPrice && (
              <span className="inline-flex items-center gap-1 text-xs rounded-md bg-sky-500/10 text-sky-300 px-2 py-1">
                <Target className="h-3.5 w-3.5" />
                Kursziel {data.currency} {analyst.targetPrice}
                {upside != null && (
                  <span className={upside >= 0 ? "text-emerald-300" : "text-red-300"}>
                    ({upside >= 0 ? "+" : ""}{upside}%)
                  </span>
                )}
              </span>
            )}
            {/* Cache-Badge: nur wenn aus Cache geladen */}
            {fromCache && (
              <span className="inline-flex items-center gap-1 text-xs rounded-md bg-gray-500/10 text-gray-400 px-2 py-1">
                <Clock className="h-3 w-3" />
                Aus Cache · {formatCacheAge(cacheAge)}
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
            KI-generiert auf Basis von Kurs-, Fundamental- und Analystendaten.
            Keine Anlageberatung — die Entscheidung liegt bei Ihnen.
          </p>
        </div>
      )}
    </div>
  );
}
