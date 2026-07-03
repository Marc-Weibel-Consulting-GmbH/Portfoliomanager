import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Info } from "lucide-react";

// Tooltip component for KPI explanations
function KpiTooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-block ml-1">
      <button
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(!show)}
        className="text-gray-600 hover:text-gray-400 transition-colors"
        aria-label="Info"
      >
        <Info className="w-3 h-3" />
      </button>
      {show && (
        <span className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-52 bg-[#1a1f2e] border border-white/20 rounded-lg px-3 py-2 text-[11px] text-gray-300 leading-relaxed shadow-xl pointer-events-none">
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#1a1f2e]" />
        </span>
      )}
    </span>
  );
}

// Bubble-Indikator Detail Modal
function BubbleDetailModal({ open, onClose, bubble }: { open: boolean; onClose: () => void; bubble: any }) {
  if (!bubble) return null;
  const bubbleColor = bubble.label === "Hoch" ? "text-red-400" : bubble.label === "Mittel" ? "text-amber-400" : "text-[#00CFC1]";
  const bubbleBar = bubble.label === "Hoch" ? "bg-red-400" : bubble.label === "Mittel" ? "bg-amber-400" : "bg-[#00CFC1]";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#0f1420] border-[#00CFC1]/30 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Info className="w-4 h-4 text-[#00CFC1]" />
            Bubble-Indikator – Zusammensetzung
          </DialogTitle>
          <DialogDescription className="text-gray-400 text-xs">
            Log-Periodic Power Law (LPPL) · S&amp;P 500 · Sornette Lab
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          {/* Score */}
          <div className="flex items-end gap-3">
            <span className={`text-4xl font-bold font-mono ${bubbleColor}`}>{bubble.score}</span>
            <span className={`text-lg font-medium mb-1 ${bubbleColor}`}>{bubble.label}</span>
            <span className="text-xs text-gray-500 mb-1.5">/ 100</span>
          </div>
          <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
            <div className={`h-2 rounded-full ${bubbleBar}`} style={{ width: `${Math.min(100, bubble.score ?? 0)}%` }} />
          </div>

          {/* Interpretation */}
          <p className="text-sm text-gray-300 leading-relaxed">{bubble.interpretation}</p>

          {/* Composition details from Sornette API */}
          {bubble.source === 'sornette_api' && (
            <div className="space-y-3 border-t border-white/10 pt-3">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Zusammensetzung</h4>
              {bubble.longTermBubble !== undefined && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Langfrist-Bubble (6J)</span>
                  <span className={`font-mono font-semibold ${bubble.longTermBubble > 50 ? 'text-red-400' : 'text-[#00CFC1]'}`}>
                    {bubble.longTermBubble?.toFixed(0) ?? '—'}
                  </span>
                </div>
              )}
              {bubble.bestPositiveT1_2_6y !== undefined && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Beste Fit-Qualität (T1 2–6J)</span>
                  <span className="font-mono text-gray-300">{bubble.bestPositiveT1_2_6y?.toFixed(2) ?? '—'}</span>
                </div>
              )}
              {bubble.positiveByScale && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Positive Signale nach Zeitskala</p>
                  <div className="flex gap-2 flex-wrap">
                    {Object.entries(bubble.positiveByScale).map(([scale, val]: [string, any]) => (
                      <span key={scale} className="text-[10px] bg-[#00CFC1]/10 text-[#00CFC1] px-2 py-0.5 rounded">
                        {scale}: {typeof val === 'number' ? val.toFixed(0) : val}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {bubble.negativeByScale && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Negative Signale nach Zeitskala</p>
                  <div className="flex gap-2 flex-wrap">
                    {Object.entries(bubble.negativeByScale).map(([scale, val]: [string, any]) => (
                      <span key={scale} className="text-[10px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded">
                        {scale}: {typeof val === 'number' ? val.toFixed(0) : val}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {bubble.dataDate && (
                <p className="text-[10px] text-gray-600">Datenstand: {bubble.dataDate}</p>
              )}
            </div>
          )}

          {/* F-08: Erklärung des Indikators für alle übrigen Quellen (lokale
              LPPL-Engine / Fallback), damit das Modal nie fast leer ist. */}
          {bubble.source !== 'sornette_api' && (
            <div className="space-y-2 border-t border-white/10 pt-3">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Wie der Indikator berechnet wird</h4>
              <p className="text-xs text-gray-400 leading-relaxed">
                Das Log-Periodic-Power-Law-Modell (LPPL, nach Didier Sornette) sucht in den Kursen des
                S&amp;P 500 nach dem typischen Muster einer spekulativen Blase: überexponentielles Wachstum
                mit immer schnelleren Schwingungen, das auf einen kritischen Zeitpunkt zuläuft.
              </p>
              <p className="text-xs text-gray-400 leading-relaxed">
                Gewichtung: Der Score kombiniert LPPL-Fits über sechs Zeitskalen (2–4 Wochen bis 2–6 Jahre).
                Aus dem Mittel der positiven Blasen-Signale abzüglich des Mittels der negativen
                (Anti-Blasen-)Signale entsteht ein Wert von 0–100, wobei 50 neutral ist. Die langfristige
                Skala (2–6 Jahre) ist für die Blasen-Erkennung am wichtigsten.
              </p>
              <p className="text-xs text-gray-400 leading-relaxed">
                Lesart: unter 33 = geringes Blasen-Risiko, 33–66 = erhöhte Wachsamkeit,
                über 66 = starke Blasen-Signale.
              </p>
              {bubble.source === 'local_db' && (
                <p className="text-[10px] text-gray-600">Quelle: lokale LPPL-Berechnung (Sornette-API nicht erreichbar).</p>
              )}
            </div>
          )}

          {/* History sparkline */}
          {bubble.history && bubble.history.length > 0 && (
            <div className="border-t border-white/10 pt-3">
              <p className="text-xs text-gray-500 mb-2">Verlauf (letzte {bubble.history.length} Messungen)</p>
              <div className="flex items-end gap-1 h-12">
                {bubble.history.map((h: number, i: number) => (
                  <div
                    key={i}
                    className={`flex-1 rounded-sm ${h > 66 ? 'bg-red-400/60' : h > 33 ? 'bg-amber-400/60' : 'bg-[#00CFC1]/60'}`}
                    style={{ height: `${Math.max(4, Math.min(100, h))}%` }}
                    title={`${h.toFixed(0)}`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Risiko-Tab (Mockup S.05): Risiko-Kennzahlen + Bubble-Indikator (LPPL).
export default function RiskTab({ portfolioId }: { portfolioId: number }) {
  const [bubbleModalOpen, setBubbleModalOpen] = useState(false);

  const { data: risk, isLoading: riskLoading } = trpc.dashboard.getRiskMetrics.useQuery(
    { scope: portfolioId },
    { enabled: portfolioId > 0 }
  );
  const { data: bubble, isLoading: bubbleLoading } = trpc.dashboard.getBubbleIndicator.useQuery(
    { scope: portfolioId },
    { enabled: portfolioId > 0 }
  );

  // F-08: Der Server liefert dataAvailable=false, wenn keine Risiko-Kennzahlen
  // berechnet werden konnten (kein Portfolio, keine Kurshistorie). Dann keine
  // irreführenden 0.0%-Werte anzeigen.
  const riskData = risk && risk.dataAvailable !== false ? risk : undefined;

  const metrics: {
    label: string;
    value: string;
    sub?: string;
    tone?: "good" | "bad" | "neutral";
    tooltip: string;
    benchmark?: string;
    benchmarkTone?: "good" | "bad" | "neutral";
  }[] = [
    {
      label: "Volatilität (p.a.)",
      value: riskData ? `${riskData.volatility.toFixed(1)}%` : "—",
      sub: riskData ? `Bench ${riskData.volBenchmark.toFixed(1)}%` : undefined,
      tone: riskData ? (riskData.volatility < riskData.volBenchmark ? "good" : "neutral") : "neutral",
      tooltip: "Annualisierte Standardabweichung der täglichen Renditen. Misst die Schwankungsbreite des Portfolios. Niedrigere Volatilität = geringeres Risiko.",
      benchmark: riskData ? `Benchmark: ${riskData.volBenchmark.toFixed(1)}%` : undefined,
    },
    {
      label: "Max Drawdown",
      value: riskData ? `${riskData.maxDrawdown.toFixed(1)}%` : "—",
      sub: riskData ? `Bench ${riskData.drawdownBenchmark.toFixed(1)}%` : undefined,
      tone: riskData ? (Math.abs(riskData.maxDrawdown) < Math.abs(riskData.drawdownBenchmark) ? "good" : "bad") : "neutral",
      tooltip: "Maximaler Wertverlust vom Höchststand bis zum Tiefststand. Zeigt das schlimmste Szenario für einen Anleger der zum ungünstigsten Zeitpunkt investiert hat.",
    },
    {
      label: "Beta",
      value: riskData ? riskData.beta.toFixed(2) : "—",
      sub: "vs. SMI",
      tone: "neutral",
      tooltip: "Sensitivität des Portfolios gegenüber dem Markt (SMI). Beta > 1 = stärkere Bewegungen als der Markt. Beta < 1 = defensiver als der Markt.",
    },
    {
      label: "VaR (95%, 1T)",
      value: riskData ? `${riskData.var95.toFixed(1)}%` : "—",
      sub: "Tagesverlust-Schwelle",
      tone: riskData ? "bad" : "neutral",
      tooltip: "Value at Risk: Mit 95% Wahrscheinlichkeit wird der Tagesverlust diesen Wert nicht überschreiten. Beispiel: VaR -2% bedeutet, an 95 von 100 Tagen verliert das Portfolio weniger als 2%.",
    },
    {
      label: "Sharpe Ratio",
      value: riskData ? riskData.sharpeRatio.toFixed(2) : "—",
      sub: riskData ? `Bench ${riskData.sharpeBenchmark.toFixed(2)}` : undefined,
      tone: riskData && riskData.sharpeRatio >= 1 ? "good" : "neutral",
      tooltip: "Rendite pro Risikoeinheit (Überrendite / Volatilität). Sharpe > 1 = gut. Sharpe > 2 = sehr gut. Vergleich mit Benchmark zeigt ob das Risiko belohnt wird.",
    },
    {
      label: "Konzentration Top 3",
      value: riskData ? `${riskData.concentrationTop3.toFixed(1)}%` : "—",
      sub: "Anteil der 3 grössten Positionen",
      tone: riskData && riskData.concentrationTop3 > 60 ? "bad" : riskData && riskData.concentrationTop3 < 40 ? "good" : "neutral",
      tooltip: "Prozentualer Anteil der drei grössten Positionen am Gesamtportfolio. Werte über 60% deuten auf Klumpenrisiko hin.",
    },
  ];

  const toneClass = (t?: "good" | "bad" | "neutral") =>
    t === "good" ? "text-[#00CFC1]" : t === "bad" ? "text-red-400" : "text-white";

  const bubbleColor =
    bubble?.label === "Hoch" ? "text-red-400" : bubble?.label === "Mittel" ? "text-amber-400" : "text-[#00CFC1]";
  const bubbleBar =
    bubble?.label === "Hoch" ? "bg-red-400" : bubble?.label === "Mittel" ? "bg-amber-400" : "bg-[#00CFC1]";

  // Determine risk assessment text for green boxes
  const riskAssessment = riskData ? {
    overall: riskData.sharpeRatio >= 1 && riskData.concentrationTop3 < 50 ? "Gut diversifiziert" :
             riskData.concentrationTop3 > 60 ? "Klumpenrisiko erkannt" : "Ausgewogen",
    overallTone: riskData.sharpeRatio >= 1 && riskData.concentrationTop3 < 50 ? "good" :
                 riskData.concentrationTop3 > 60 ? "bad" : "neutral",
    volatilityAssessment: riskData.volatility < 15 ? "Niedrig (defensiv)" :
                          riskData.volatility < 25 ? "Moderat (ausgewogen)" : "Hoch (aggressiv)",
    volatilityTone: riskData.volatility < 15 ? "good" : riskData.volatility < 25 ? "neutral" : "bad",
    sharpeAssessment: riskData.sharpeRatio >= 1.5 ? "Ausgezeichnet" :
                      riskData.sharpeRatio >= 1 ? "Gut" :
                      riskData.sharpeRatio >= 0.5 ? "Akzeptabel" : "Verbesserungswürdig",
    sharpeTone: riskData.sharpeRatio >= 1 ? "good" : riskData.sharpeRatio >= 0.5 ? "neutral" : "bad",
  } : null;

  return (
    <div className="space-y-4">
      <div className="grid lg:grid-cols-5 gap-4">
        {/* Risiko-Kennzahlen */}
        <div className="lg:col-span-3">
          <div className="bg-[#0f1420] border border-white/10 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Risiko-Kennzahlen</h3>
            {riskLoading ? (
              <div className="flex items-center justify-center h-40">
                <div className="w-5 h-5 border-2 border-[#00CFC1] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-white/10 rounded-lg overflow-hidden">
                {metrics.map((m) => (
                  <div key={m.label} className="bg-[#0f1420] p-4">
                    <div className="flex items-center mb-1.5">
                      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">{m.label}</p>
                      <KpiTooltip text={m.tooltip} />
                    </div>
                    <p className={`text-xl font-bold font-mono ${toneClass(m.tone)}`}>{m.value}</p>
                    {m.sub && <p className="text-xs text-gray-500 mt-0.5">{m.sub}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Bubble-Indikator (LPPL) */}
        <div className="lg:col-span-2">
          <div className="bg-[#0f1420] border border-white/10 rounded-lg p-5 h-full">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold text-white">Bubble-Indikator</h3>
              <button
                onClick={() => setBubbleModalOpen(true)}
                className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-[#00CFC1] transition-colors px-2 py-1 rounded hover:bg-white/5"
              >
                <Info className="w-3 h-3" />
                Details
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-1">LPPL · S&amp;P 500</p>
            <p className="text-[10px] text-amber-500/70 mb-3">⚠ Globaler Markt-Indikator – identisch für alle Portfolios</p>
            {bubbleLoading ? (
              <div className="flex items-center justify-center h-40">
                <div className="w-5 h-5 border-2 border-[#00CFC1] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <>
                <div className="flex items-end gap-2 mb-2">
                  <span className={`text-3xl font-bold font-mono ${bubbleColor}`}>{bubble?.score ?? 0}</span>
                  <span className={`text-sm font-medium mb-1 ${bubbleColor}`}>{bubble?.label ?? "—"}</span>
                </div>
                <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden mb-4">
                  <div className={`h-2 rounded-full ${bubbleBar}`} style={{ width: `${Math.min(100, bubble?.score ?? 0)}%` }} />
                </div>
                {bubble?.history && bubble.history.length > 0 && (
                  <div className="flex items-end gap-1 h-12 mb-4">
                    {bubble.history.map((h: number, i: number) => (
                      <div key={i} className={`flex-1 rounded-sm ${h > 66 ? 'bg-red-400/40' : h > 33 ? 'bg-amber-400/40' : 'bg-[#00CFC1]/40'}`} style={{ height: `${Math.max(4, Math.min(100, h))}%` }} title={`${h}`} />
                    ))}
                  </div>
                )}
                <p className="text-xs text-gray-400 leading-relaxed">{bubble?.interpretation}</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Risk Assessment Summary: «Keine Daten»-Zustand statt 0.0%-Werten (F-08) */}
      {!riskLoading && !riskData && (
        <div className="grid grid-cols-3 gap-4">
          {["Gesamtbewertung", "Volatilität", "Rendite/Risiko"].map((label) => (
            <div key={label} className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border border-white/10 rounded-lg p-4">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1">{label}</p>
              <p className="text-lg font-bold text-gray-500">Keine Daten verfügbar</p>
              <p className="text-xs text-gray-600 mt-1">Für die Risikoberechnung liegt noch keine ausreichende Kurshistorie vor.</p>
            </div>
          ))}
        </div>
      )}

      {/* Risk Assessment Summary (green boxes) */}
      {riskAssessment && (
        <div className="grid grid-cols-3 gap-4">
          <div className={`bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border rounded-lg p-4 ${
            riskAssessment.overallTone === 'good' ? 'border-[#00CFC1]/30' :
            riskAssessment.overallTone === 'bad' ? 'border-red-500/30' : 'border-white/10'
          }`}>
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1">Gesamtbewertung</p>
            <p className={`text-lg font-bold ${toneClass(riskAssessment.overallTone as any)}`}>{riskAssessment.overall}</p>
            <p className="text-xs text-gray-500 mt-1">
              {riskAssessment.overallTone === 'good' ? 'Risiko gut verteilt' :
               riskAssessment.overallTone === 'bad' ? 'Handlungsbedarf' : 'Risiko im Rahmen'}
            </p>
          </div>
          <div className={`bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border rounded-lg p-4 ${
            riskAssessment.volatilityTone === 'good' ? 'border-[#00CFC1]/30' :
            riskAssessment.volatilityTone === 'bad' ? 'border-red-500/30' : 'border-white/10'
          }`}>
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1">Volatilität</p>
            <p className={`text-lg font-bold ${toneClass(riskAssessment.volatilityTone as any)}`}>{riskAssessment.volatilityAssessment}</p>
            <p className="text-xs text-gray-500 mt-1">{riskData?.volatility.toFixed(1)}% p.a.</p>
          </div>
          <div className={`bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border rounded-lg p-4 ${
            riskAssessment.sharpeTone === 'good' ? 'border-[#00CFC1]/30' :
            riskAssessment.sharpeTone === 'bad' ? 'border-red-500/30' : 'border-white/10'
          }`}>
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1">Rendite/Risiko</p>
            <p className={`text-lg font-bold ${toneClass(riskAssessment.sharpeTone as any)}`}>{riskAssessment.sharpeAssessment}</p>
            <p className="text-xs text-gray-500 mt-1">Sharpe {riskData?.sharpeRatio.toFixed(2)}</p>
          </div>
        </div>
      )}

      {/* Bubble Detail Modal */}
      <BubbleDetailModal
        open={bubbleModalOpen}
        onClose={() => setBubbleModalOpen(false)}
        bubble={bubble}
      />
    </div>
  );
}
