import { useState } from "react";
import { Sparkles, TrendingUp, CalendarClock, Target, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

/**
 * KI-Einzeltitel-Briefing (Earnings-Hub-Stil). On-demand: der Nutzer löst die
 * Analyse per Button aus (spart LLM-Aufrufe). Zeigt die KI-Prosa plus einen
 * kompakten Datenstreifen (Beats, nächster Termin, Analysten-Kursziel).
 */
export default function StockBriefingCard({ ticker }: { ticker: string }) {
  const [result, setResult] = useState<{ briefing: string; data: any } | null>(null);
  const briefing = trpc.stocks.stockBriefing.useMutation({
    onSuccess: (r) => setResult(r as any),
  });

  const data = result?.data;
  const analyst = data?.earnings?.analyst;
  const upside = analyst?.targetPrice && data?.price ? Math.round(((analyst.targetPrice / data.price) - 1) * 100) : null;

  return (
    <div className="mb-6 rounded-xl border border-[#00CFC1]/30 bg-gradient-to-br from-[#00CFC1]/[0.07] to-transparent p-5">
      <div className="flex items-center justify-between gap-3 mb-1">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-[#00CFC1]" />
          <h2 className="text-base font-semibold text-white">KI-Briefing</h2>
        </div>
        {!result && (
          <Button
            size="sm"
            onClick={() => briefing.mutate({ ticker })}
            disabled={briefing.isPending}
            className="h-8 text-xs bg-[#00CFC1] text-black hover:bg-[#00CFC1]/80"
          >
            {briefing.isPending ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Analysiere…</> : "Briefing erstellen"}
          </Button>
        )}
      </div>

      {!result && !briefing.isPending && (
        <p className="text-sm text-gray-400">
          Eine ehrliche, ausgewogene Einschätzung in einfachen Worten: Bewertung, Qualität, Earnings-Verlauf,
          nächster Termin und Analysten-Stimmung — mit klarer Pro/Contra-Abwägung.
        </p>
      )}

      {briefing.isError && (
        <p className="text-sm text-red-400">Briefing konnte nicht erstellt werden. Bitte später erneut versuchen.</p>
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
          <div className="space-y-2 text-[15px] leading-relaxed text-gray-200">
            {result.briefing.split(/\n{1,}/).map((p, i) => p.trim() && <p key={i}>{p.trim()}</p>)}
          </div>

          <p className="text-[11px] text-gray-500">
            KI-generiert auf Basis von Kurs-, Fundamental- und Analystendaten. Keine Anlageberatung — die Entscheidung liegt bei Ihnen.
          </p>
        </div>
      )}
    </div>
  );
}
