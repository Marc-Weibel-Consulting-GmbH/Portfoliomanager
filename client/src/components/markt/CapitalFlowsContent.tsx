import { Card, CardContent } from "@/components/ui/card";
import { Waves, Landmark, TrendingUp, TrendingDown, Minus, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";

/**
 * Markt-Hub-Tab «Kapitalströme»:
 *  1. Sektor-Flow-Proxy (Volumen + Momentum der US-Sektor-ETFs) — ehrlich als
 *     Näherung beschriftet, keine effektiven Fondsflüsse.
 *  2. CFTC-COT: echte Futures-Positionierung der Grossanleger (wöchentlich).
 * Nur Anzeige — bewusst (noch) ohne Einfluss auf Portfolio-Tilts.
 */
export function CapitalFlowsContent() {
  const { data, isLoading } = trpc.marketRegime.getCapitalFlows.useQuery(undefined, {
    staleTime: 30 * 60 * 1000,
    retry: 1,
  });

  const fmtNet = (n: number) => `${n > 0 ? "+" : ""}${n.toLocaleString("de-CH")}`;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-400 py-8 justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-[#00CFC1]" /> Kapitalströme werden geladen…
      </div>
    );
  }

  const sectorFlows = data?.sectorFlows ?? [];
  const cot = data?.cot ?? [];

  return (
    <div className="space-y-6">
      {/* Sektor-Flow-Proxy */}
      <Card className="bg-[#10141f] border-white/10">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-1">
            <Waves className="h-5 w-5 text-[#00CFC1]" />
            <h2 className="text-base font-semibold text-white">Sektor-Kapitalströme</h2>
            <span className="text-[10px] uppercase tracking-wider text-amber-400/80 bg-amber-500/10 rounded px-1.5 py-0.5">Näherung</span>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            Wohin wandert Geld? Näherung über Handelsvolumen und Kurstrend der US-Sektor-ETFs
            (erhöhtes Volumen bei steigenden Kursen ≈ Zufluss, bei fallenden ≈ Abfluss) — keine effektiven Fondsflüsse.
          </p>

          {sectorFlows.length === 0 ? (
            <p className="text-sm text-gray-500">Derzeit keine Daten verfügbar.</p>
          ) : (
            <div className="divide-y divide-white/5">
              {sectorFlows.map((s) => (
                <div key={s.ticker} className="flex items-center gap-3 py-2.5">
                  <div className="w-40 shrink-0">
                    <span className="text-sm text-gray-200">{s.sector}</span>
                    <span className="ml-2 text-[11px] text-gray-500 font-mono">{s.ticker}</span>
                  </div>
                  <div className={`w-24 text-sm font-mono text-right ${s.momentum20Pct > 0 ? "text-emerald-400" : s.momentum20Pct < 0 ? "text-red-400" : "text-gray-400"}`}>
                    {s.momentum20Pct > 0 ? "+" : ""}{s.momentum20Pct.toFixed(1)}%
                    <span className="block text-[10px] text-gray-500 font-sans">Kurs 20 Tage</span>
                  </div>
                  <div className="w-24 text-sm font-mono text-right text-gray-300">
                    {s.relVolume.toFixed(2)}×
                    <span className="block text-[10px] text-gray-500 font-sans">rel. Volumen</span>
                  </div>
                  <div className="flex-1 flex justify-end">
                    {s.direction === "zufluss" && (
                      <span className="inline-flex items-center gap-1 text-xs rounded-md bg-emerald-500/10 text-emerald-300 px-2 py-1"><TrendingUp className="h-3.5 w-3.5" /> Zufluss</span>
                    )}
                    {s.direction === "abfluss" && (
                      <span className="inline-flex items-center gap-1 text-xs rounded-md bg-red-500/10 text-red-300 px-2 py-1"><TrendingDown className="h-3.5 w-3.5" /> Abfluss</span>
                    )}
                    {s.direction === "neutral" && (
                      <span className="inline-flex items-center gap-1 text-xs rounded-md bg-slate-500/10 text-gray-400 px-2 py-1"><Minus className="h-3.5 w-3.5" /> Neutral</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* COT-Positionierung */}
      <Card className="bg-[#10141f] border-white/10">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-1">
            <Landmark className="h-5 w-5 text-[#00CFC1]" />
            <h2 className="text-base font-semibold text-white">Positionierung der Grossanleger</h2>
            <span className="text-[10px] uppercase tracking-wider text-sky-400/80 bg-sky-500/10 rounded px-1.5 py-0.5">CFTC · wöchentlich</span>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            Echte Futures-Positionierung institutioneller Anleger (Non-Commercials) aus dem
            Commitment-of-Traders-Report der US-Aufsicht CFTC. Einordnung relativ zu den letzten ~30 Wochen.
          </p>

          {cot.length === 0 ? (
            <p className="text-sm text-gray-500">Derzeit keine Daten verfügbar.</p>
          ) : (
            <div className="divide-y divide-white/5">
              {cot.map((m) => (
                <div key={m.market} className="flex items-center gap-3 py-2.5 flex-wrap">
                  <div className="w-48 shrink-0">
                    <span className="text-sm text-gray-200">{m.market}</span>
                    <span className="block text-[10px] text-gray-500">Report {m.reportDate}</span>
                  </div>
                  <div className={`w-28 text-sm font-mono text-right ${m.netPosition > 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {fmtNet(m.netPosition)}
                    <span className="block text-[10px] text-gray-500 font-sans">Netto-Kontrakte</span>
                  </div>
                  <div className={`w-24 text-sm font-mono text-right ${m.weeklyChange > 0 ? "text-emerald-400" : m.weeklyChange < 0 ? "text-red-400" : "text-gray-400"}`}>
                    {fmtNet(m.weeklyChange)}
                    <span className="block text-[10px] text-gray-500 font-sans">zur Vorwoche</span>
                  </div>
                  <div className="flex-1 flex justify-end">
                    <span className={`inline-flex items-center text-xs rounded-md px-2 py-1 ${
                      m.percentile >= 60 ? "bg-emerald-500/10 text-emerald-300"
                      : m.percentile > 40 ? "bg-slate-500/10 text-gray-400"
                      : "bg-red-500/10 text-red-300"
                    }`}>
                      {m.stance}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="text-[11px] text-gray-500 mt-4">
            Hinweis: Bei Anleihe-Futures bedeutet «bärisch positioniert» eine Wette auf steigende Zinsen.
            Reine Beobachtungsdaten — noch ohne Einfluss auf Portfolio-Vorschläge.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
