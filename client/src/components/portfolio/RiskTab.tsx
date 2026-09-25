import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Info } from "lucide-react";
import { KpiTooltip as RichKpiTooltip, type KpiKey } from "@/components/ui/KpiTooltip";

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
                  {/* longTermBubble ist ein BOOLEAN (sornetteApi.ts) — die frühere
                      Zahlen-Formatierung (`.toFixed`) warf bei `true` und riss den
                      ganzen Risiko-Tab in den ErrorBoundary (Live-Befund 20.08.). */}
                  <span className={`font-mono font-semibold ${bubble.longTermBubble ? 'text-red-400' : 'text-[#00CFC1]'}`}>
                    {bubble.longTermBubble ? 'Ja' : 'Nein'}
                  </span>
                </div>
              )}
              {bubble.bestPositiveT1_2_6y != null && (
                <div className="flex items-center justify-between text-sm">
                  {/* bestPositiveT1 ist ein DATUM: t1 (Fensterbeginn) des besten
                      2–6J-Fits — seit wann der Fit den Anstieg als Bubble-Aufbau
                      einstuft. Kein Qualitätsmass und kein kritischer Zeitpunkt. */}
                  <span className="text-gray-400">Bubble-Aufbau seit (bester 2–6J-Fit)</span>
                  <span className="font-mono text-gray-300">{String(bubble.bestPositiveT1_2_6y)}</span>
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

  const {
    data: risk,
    isLoading: riskLoading,
    isError: riskError,
    isFetching: riskFetching,
    refetch: refetchRisk,
  } = trpc.dashboard.getRiskMetrics.useQuery(
    { scope: portfolioId },
    {
      enabled: portfolioId > 0,
      retry: 3,
      retryDelay: attempt => Math.min(1_000 * 2 ** attempt, 5_000),
    }
  );
  const { data: bubble, isLoading: bubbleLoading } = trpc.dashboard.getBubbleIndicator.useQuery(
    { scope: portfolioId },
    { enabled: portfolioId > 0 }
  );

  // F-08: Der Server liefert dataAvailable=false, wenn keine Risiko-Kennzahlen
  // berechnet werden konnten (kein Portfolio, keine Kurshistorie). Dann keine
  // irreführenden 0.0%-Werte anzeigen.
  const riskData = risk && risk.dataAvailable !== false ? risk : undefined;
  const riskDataUnavailable = risk?.dataAvailable === false;
  const riskRequestFailed = riskError || riskDataUnavailable;
  const riskDetail = riskData as any;
  const hasValidatedFiveYearRisk = riskDetail?.riskWindowStatus === "five_year_with_stress";
  const numberOrNull = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) ? value : null;
  const volatility = numberOrNull(riskData?.volatility);
  const benchmarkVolatility = numberOrNull(riskData?.volBenchmark);
  const maxDrawdown = numberOrNull(riskData?.maxDrawdown);
  const benchmarkDrawdown = numberOrNull(riskData?.drawdownBenchmark);
  const var95 = numberOrNull(riskData?.var95);
  const sharpeRatio = numberOrNull(riskData?.sharpeRatio);
  const benchmarkSharpe = numberOrNull(riskData?.sharpeBenchmark);
  const riskWindowStatus: string | null = typeof riskDetail?.riskWindowStatus === "string" ? riskDetail.riskWindowStatus : null;
  const coverageIssues: Array<{ key: string; kind: "price" | "fx" }> = Array.isArray(riskDetail?.coverage?.issues)
    ? riskDetail.coverage.issues
    : [];
  const benchmarkOutlierCount = numberOrNull(riskDetail?.coverage?.benchmarkOutlierCount) ?? 0;
  const stressEvidence = riskDetail?.stressEvidence as {
    qualified?: boolean;
    benchmark?: string;
    observedDrawdownPct?: number | null;
    requiredDrawdownPct?: number;
    peakDate?: string | null;
    troughDate?: string | null;
  } | undefined;

  const riskGateExplanation = riskError
    ? "Der Risikoabruf ist vorübergehend fehlgeschlagen. Das ist keine Datenlücke und wird nicht als 0.00 angezeigt."
    : riskDataUnavailable
      ? "Der Server konnte keine qualifizierte Risikoreihe liefern. Das ist keine Kennzahl von 0.00; der Abruf kann erneut gestartet werden."
    : riskWindowStatus === "five_year_with_stress"
    ? `5 Jahre qualifizierte Historie inklusive Marktstress über ${stressEvidence?.benchmark ?? "Benchmark"}.`
    : riskWindowStatus === "five_year_without_stress"
      ? "Die Fünfjahresreihe enthält keine objektiv bestätigte Stressphase; deshalb wird kein Max.-Drawdown ausgewiesen."
      : riskWindowStatus === "incompatible_history"
        ? "Für mindestens eine Fremdwährungsposition fehlt eine kompatible historische FX-Reihe. Es wird keine CHF-Risikokennzahl geschätzt."
        : riskWindowStatus === "insufficient_history"
          ? "Die vollständige Fünfjahresreihe ist noch nicht nachgewiesen. Es wird bewusst kein verkürzter Max.-Drawdown angezeigt."
          : "Für die Risikoberechnung liegt noch keine ausreichende Kurshistorie vor.";

  const metrics: {
    label: string;
    value: string;
    sub?: string;
    tone?: "good" | "bad" | "neutral";
    tooltip: string;
    kpiKey?: KpiKey;
    benchmark?: string;
    benchmarkTone?: "good" | "bad" | "neutral";
  }[] = [
    {
      label: "Volatilität (5J p.a.)",
      value: volatility === null ? "—" : `${volatility.toFixed(1)}%`,
      sub: riskRequestFailed ? "Risikodaten nicht verfügbar" : benchmarkVolatility === null ? "5J-Gate erforderlich" : `Bench ${benchmarkVolatility.toFixed(1)}%`,
      tone: volatility !== null && benchmarkVolatility !== null && volatility < benchmarkVolatility ? "good" : "neutral",
      tooltip: "Annualisierte Standardabweichung der täglichen Renditen über das qualifizierte Fünfjahresfenster.",
      kpiKey: "volatility",
      benchmark: benchmarkVolatility === null ? undefined : `Benchmark: ${benchmarkVolatility.toFixed(1)}%`,
    },
    {
      label: "Verlustrisiko · Max. (5J)",
      value: maxDrawdown === null ? "—" : `${maxDrawdown.toFixed(1)}%`,
      sub: riskRequestFailed ? "Abruf fehlgeschlagen – erneut versuchen" : benchmarkDrawdown === null ? "Kein verkürztes Ersatzfenster" : `Bench ${benchmarkDrawdown.toFixed(1)}%`,
      tone: maxDrawdown !== null && benchmarkDrawdown !== null && Math.abs(maxDrawdown) < Math.abs(benchmarkDrawdown) ? "good" : maxDrawdown !== null ? "bad" : "neutral",
      tooltip: "Maximaler Rückgang vom bisherigen Hoch bis zum späteren Tief im qualifizierten Fünfjahres-Allokationsproxy; keine Prognose und keine rückwirkende Depottransaktionshistorie.",
      kpiKey: "maxDrawdown",
    },
    {
      label: "Beta",
      value: riskData?.beta != null ? riskData.beta.toFixed(2) : "—",
      sub: riskRequestFailed ? "Risikoabruf fehlgeschlagen" : riskData?.beta != null ? "vs. SPI" : "Datenlücke vs. SPI",
      tone: "neutral",
      tooltip: "Sensitivität des Portfolios gegenüber dem SPI. Sie wird aus tagesgleich gepaarten Portfolio- und Benchmarkrenditen berechnet; bei unzureichenden gemeinsamen Handelstagen erscheint eine Datenlücke statt 0.00.",
      kpiKey: "beta",
    },
    {
      label: "VaR (95%, 1T)",
      value: var95 === null ? "—" : `${var95.toFixed(1)}%`,
      sub: riskRequestFailed ? "Risikodaten nicht verfügbar" : var95 === null ? "5J-Gate erforderlich" : "Tagesverlust-Schwelle",
      tone: var95 === null ? "neutral" : "bad",
      tooltip: "Value at Risk: Tagesverlust-Schwelle auf Basis des qualifizierten Fünfjahresfensters.",
      kpiKey: "var",
    },
    {
      label: "Sharpe Ratio",
      value: sharpeRatio === null ? "—" : sharpeRatio.toFixed(2),
      sub: riskRequestFailed ? "Abruf fehlgeschlagen – erneut versuchen" : benchmarkSharpe === null ? "5J-Gate erforderlich" : `Bench ${benchmarkSharpe.toFixed(2)}`,
      tone: sharpeRatio !== null && sharpeRatio >= 1 ? "good" : "neutral",
      tooltip: "Rendite pro Risikoeinheit im qualifizierten Fünfjahresfenster.",
      kpiKey: "sharpe",
    },
    {
      label: "Konzentration Top 3",
      value: riskData ? `${riskData.concentrationTop3.toFixed(1)}%` : "—",
      sub: riskRequestFailed ? "Risikoabruf fehlgeschlagen" : "Anteil der 3 grössten Positionen",
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
  const riskAssessment = riskData && hasValidatedFiveYearRisk && sharpeRatio !== null && volatility !== null ? {
    overall: sharpeRatio >= 1 && riskData.concentrationTop3 < 50 ? "Gut diversifiziert" :
             riskData.concentrationTop3 > 60 ? "Klumpenrisiko erkannt" : "Ausgewogen",
    overallTone: sharpeRatio >= 1 && riskData.concentrationTop3 < 50 ? "good" :
                 riskData.concentrationTop3 > 60 ? "bad" : "neutral",
    volatilityAssessment: volatility < 15 ? "Niedrig (defensiv)" :
                          volatility < 25 ? "Moderat (ausgewogen)" : "Hoch (aggressiv)",
    volatilityTone: volatility < 15 ? "good" : volatility < 25 ? "neutral" : "bad",
    sharpeAssessment: sharpeRatio >= 1.5 ? "Ausgezeichnet" :
                      sharpeRatio >= 1 ? "Gut" :
                      sharpeRatio >= 0.5 ? "Akzeptabel" : "Verbesserungswürdig",
    sharpeTone: sharpeRatio >= 1 ? "good" : sharpeRatio >= 0.5 ? "neutral" : "bad",
  } : null;

  return (
    <div className="space-y-4">
      <div className="grid lg:grid-cols-5 gap-4">
        {/* Risiko-Kennzahlen */}
        <div className="lg:col-span-3">
          <div className="bg-[#0f1420] border border-white/10 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Risiko-Kennzahlen</h3>
            {riskLoading || (riskFetching && !risk) ? (
              <div className="flex items-center justify-center h-40">
                <div className="w-5 h-5 border-2 border-[#00CFC1] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <>
                {riskRequestFailed && (
                  <div className="mb-4 flex flex-col gap-2 rounded-lg border border-amber-400/30 bg-amber-400/5 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs leading-relaxed text-amber-100">{riskGateExplanation}</p>
                    <button
                      type="button"
                      onClick={() => void refetchRisk()}
                      disabled={riskFetching}
                      className="shrink-0 text-xs font-semibold text-[#00CFC1] hover:text-[#44e0d5] disabled:cursor-wait disabled:opacity-60"
                    >
                      {riskFetching ? "Berechnung läuft…" : "Analyse erneut starten"}
                    </button>
                  </div>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-white/10 rounded-lg overflow-hidden">
                  {metrics.map((m) => (
                    <div key={m.label} className="bg-[#0f1420] p-4">
                      <div className="flex items-center mb-1.5">
                        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">{m.label}</p>
                        {m.kpiKey
                          ? <RichKpiTooltip kpi={m.kpiKey} iconOnly side="top" />
                          : (
                            <span className="relative inline-block ml-1 group">
                              <Info className="w-3 h-3 text-gray-600 hover:text-gray-400 cursor-help" />
                              <span className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-52 bg-[#1a1f2e] border border-white/20 rounded-lg px-3 py-2 text-[11px] text-gray-300 leading-relaxed shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                                {m.tooltip}
                              </span>
                            </span>
                          )
                        }
                      </div>
                      <p className={`text-xl font-bold font-mono ${toneClass(m.tone)}`}>{m.value}</p>
                      {m.sub && <p className="text-xs text-gray-500 mt-0.5">{m.sub}</p>}
                    </div>
                  ))}
                </div>
              </>
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

      {!riskLoading && riskData && (
        <div className={`rounded-lg border p-4 ${hasValidatedFiveYearRisk ? "border-[#00CFC1]/30 bg-[#00CFC1]/5" : "border-amber-400/30 bg-amber-400/5"}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className={`text-xs font-semibold uppercase tracking-widest ${hasValidatedFiveYearRisk ? "text-[#00CFC1]" : "text-amber-300"}`}>
                Verlust-Risiko · {hasValidatedFiveYearRisk ? "5J validiert" : "Datenlücke statt Ersatzwert"}
              </p>
              <p className="mt-1 text-sm text-gray-200">{riskGateExplanation}</p>
            </div>
            <div className="text-right text-xs text-gray-400">
              <p>Zeitraum: {riskDetail?.riskWindowStart ?? "—"} bis {riskDetail?.riskWindowEnd ?? "—"}</p>
              <p>{riskDetail?.coverage?.qualifiedObservationCount ?? 0} qualifizierte Beobachtungen</p>
            </div>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-gray-400">
            {riskDetail?.riskProxyType === "historical_allocation_proxy_not_actual_depot_history"
              ? "Demoportfolio: Die Reihe bewertet die heutige Allokation mit festen Stückzahlen und konstanter Cash-Reserve rückwirkend in CHF. Sie ist ein historischer Allokations-/Risikoproxy und keine tatsächliche Depot- oder Transaktionshistorie vor dem Portfolio-Start."
              : "Die Reihe basiert auf verfügbaren historischen Marktwerten und ersetzt keine fehlende Transaktions- oder Cash-Historie."}
          </p>
          {hasValidatedFiveYearRisk && stressEvidence?.qualified && (
            <p className="mt-2 text-xs text-gray-300">
              Krisennachweis: {stressEvidence.benchmark} erreichte vom {stressEvidence.peakDate ?? "—"} bis {stressEvidence.troughDate ?? "—"} einen Drawdown von {stressEvidence.observedDrawdownPct?.toFixed(1) ?? "—"}% (Gate: höchstens {stressEvidence.requiredDrawdownPct ?? -15}%).
            </p>
          )}
          {benchmarkOutlierCount > 0 && (
            <p className="mt-2 text-xs text-gray-400">
              Audit-Hinweis: {benchmarkOutlierCount} isolierte Benchmark-Massstabsbrüche wurden als Datenlücke ausgeschlossen; die Quellzeilen bleiben unverändert erhalten.
            </p>
          )}
          {!hasValidatedFiveYearRisk && coverageIssues.length > 0 && (
            <p className="mt-2 text-xs text-amber-200/90">
              Fehlende Fünfjahresabdeckung: {coverageIssues.map((issue) => `${issue.key}${issue.kind === "fx" ? " (FX)" : ""}`).join(", ")}.
            </p>
          )}
        </div>
      )}

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
            <p className="text-xs text-gray-500 mt-1">{volatility?.toFixed(1)}% p.a.</p>
          </div>
          <div className={`bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border rounded-lg p-4 ${
            riskAssessment.sharpeTone === 'good' ? 'border-[#00CFC1]/30' :
            riskAssessment.sharpeTone === 'bad' ? 'border-red-500/30' : 'border-white/10'
          }`}>
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1">Rendite/Risiko</p>
            <p className={`text-lg font-bold ${toneClass(riskAssessment.sharpeTone as any)}`}>{riskAssessment.sharpeAssessment}</p>
            <p className="text-xs text-gray-500 mt-1">Sharpe {sharpeRatio?.toFixed(2)}</p>
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
