import { useMemo, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceDot,
} from "recharts";
import { ArrowUpRight, ArrowDownRight, Target, AlertTriangle, CheckCircle, Info } from "lucide-react";

// ─── Diversification Rule Check ───────────────────────────────────────────────
// F2: Die Schwellen kommen aus der Admin-Konfig (trpc.analytics.getDiversificationRules),
// nicht mehr hartkodiert. Optimizer + diese Ansicht nutzen denselben Regelsatz.
interface DivRule {
  id: string;
  label: string;
  description: string;
  passed: boolean;
  detail: string;
}

export interface DiversificationRules {
  maxPositionPercent: number;
  minPositionPercent: number;
  minPositionAmountCHF: number;
  minTitles: number;
  maxTitles: number;
  maxSectorPercent: number;
  maxCurrencyPercent: number;
}

// Fallback, falls die Konfig noch lädt oder nicht verfügbar ist (identisch mit Server-Defaults).
const DEFAULT_RULES: DiversificationRules = {
  maxPositionPercent: 10,
  minPositionPercent: 1,
  minPositionAmountCHF: 3000,
  minTitles: 15,
  maxTitles: 20,
  maxSectorPercent: 30,
  maxCurrencyPercent: 100,
};

const fmtChf = (v: number) => `CHF ${Math.round(v).toLocaleString("de-CH")}`;

function checkDiversificationRules(holdings: any[], totalValueCHF: number, rules: DiversificationRules): DivRule[] {
  const nonCash = holdings.filter((h: any) => h.ticker && h.ticker !== "CASH");
  const titleCount = nonCash.length;
  const out: DivRule[] = [];

  // Regel: Mindestanzahl Titel
  out.push({
    id: "min_titles",
    label: `Mindestens ${rules.minTitles} Titel`,
    description: `Portfolio soll mindestens ${rules.minTitles} verschiedene Positionen enthalten.`,
    passed: titleCount >= rules.minTitles,
    detail: `${titleCount} Titel vorhanden${titleCount < rules.minTitles ? ` (${rules.minTitles - titleCount} fehlen)` : ""}`,
  });

  // Regel: Höchstanzahl Titel
  if (rules.maxTitles > 0) {
    out.push({
      id: "max_titles",
      label: `Höchstens ${rules.maxTitles} Titel`,
      description: `Portfolio soll nicht mehr als ${rules.maxTitles} Positionen enthalten (Überdiversifikation vermeiden).`,
      passed: titleCount <= rules.maxTitles,
      detail: titleCount <= rules.maxTitles
        ? `${titleCount} Titel vorhanden`
        : `${titleCount} Titel — ${titleCount - rules.maxTitles} über dem Maximum`,
    });
  }

  // Regel: Einzelposition-Obergrenze
  const overweighted = nonCash.filter((h: any) => parseFloat(h.weight || "0") > rules.maxPositionPercent);
  out.push({
    id: "max_weight",
    label: `Max. ${rules.maxPositionPercent}% pro Position`,
    description: `Keine einzelne Position soll mehr als ${rules.maxPositionPercent}% des Portfolios ausmachen.`,
    passed: overweighted.length === 0,
    detail: overweighted.length === 0
      ? `Alle Positionen ≤ ${rules.maxPositionPercent}%`
      : `${overweighted.length} Position(en) über ${rules.maxPositionPercent}%: ${overweighted.map((h: any) => `${h.ticker} (${parseFloat(h.weight || "0").toFixed(1)}%)`).join(", ")}`,
  });

  // Regel: Einzelposition-Untergrenze
  const underweighted = nonCash.filter((h: any) => {
    const w = parseFloat(h.weight || "0");
    return w < rules.minPositionPercent && w > 0;
  });
  out.push({
    id: "min_weight",
    label: `Min. ${rules.minPositionPercent}% pro Position`,
    description: `Keine Position soll weniger als ${rules.minPositionPercent}% des Portfolios ausmachen (Kleinstpositionen vermeiden).`,
    passed: underweighted.length === 0,
    detail: underweighted.length === 0
      ? `Alle Positionen ≥ ${rules.minPositionPercent}%`
      : `${underweighted.length} Position(en) unter ${rules.minPositionPercent}%: ${underweighted.map((h: any) => `${h.ticker} (${parseFloat(h.weight || "0").toFixed(1)}%)`).join(", ")}`,
  });

  // Regel: Mindest-Positionsgrösse in CHF
  const tooSmall = nonCash.filter((h: any) => {
    const posValue = (parseFloat(h.weight || "0") / 100) * totalValueCHF;
    return posValue < rules.minPositionAmountCHF && posValue > 0;
  });
  out.push({
    id: "min_chf",
    label: `Min. ${fmtChf(rules.minPositionAmountCHF)} pro Position`,
    description: `Jede Position soll mindestens ${fmtChf(rules.minPositionAmountCHF)} wert sein (Transaktionskosten-Effizienz).`,
    passed: tooSmall.length === 0,
    detail: tooSmall.length === 0
      ? `Alle Positionen ≥ ${fmtChf(rules.minPositionAmountCHF)}`
      : `${tooSmall.length} Position(en) unter ${fmtChf(rules.minPositionAmountCHF)}: ${tooSmall.map((h: any) => {
          const v = (parseFloat(h.weight || "0") / 100) * totalValueCHF;
          return `${h.ticker} (${fmtChf(v)})`;
        }).join(", ")}`,
  });

  // Regel: Sektor-Obergrenze (nur wenn aktiv, d.h. < 100%)
  if (rules.maxSectorPercent > 0 && rules.maxSectorPercent < 100) {
    const bySector: Record<string, number> = {};
    nonCash.forEach((h: any) => {
      const s = h.sector || "Andere";
      bySector[s] = (bySector[s] || 0) + parseFloat(h.weight || "0");
    });
    const over = Object.entries(bySector).filter(([, w]) => w > rules.maxSectorPercent);
    out.push({
      id: "max_sector",
      label: `Max. ${rules.maxSectorPercent}% pro Sektor`,
      description: `Kein Sektor soll mehr als ${rules.maxSectorPercent}% des Portfolios ausmachen (Klumpenrisiko).`,
      passed: over.length === 0,
      detail: over.length === 0
        ? `Alle Sektoren ≤ ${rules.maxSectorPercent}%`
        : `${over.length} Sektor(en) über ${rules.maxSectorPercent}%: ${over.map(([s, w]) => `${s} (${w.toFixed(1)}%)`).join(", ")}`,
    });
  }

  // Regel: Währungs-Obergrenze (nur wenn aktiv, d.h. < 100%)
  if (rules.maxCurrencyPercent > 0 && rules.maxCurrencyPercent < 100) {
    const byCurrency: Record<string, number> = {};
    nonCash.forEach((h: any) => {
      const c = h.currency || "CHF";
      byCurrency[c] = (byCurrency[c] || 0) + parseFloat(h.weight || "0");
    });
    const over = Object.entries(byCurrency).filter(([, w]) => w > rules.maxCurrencyPercent);
    out.push({
      id: "max_currency",
      label: `Max. ${rules.maxCurrencyPercent}% pro Währung`,
      description: `Kein Währungsraum soll mehr als ${rules.maxCurrencyPercent}% des Portfolios ausmachen.`,
      passed: over.length === 0,
      detail: over.length === 0
        ? `Alle Währungen ≤ ${rules.maxCurrencyPercent}%`
        : `${over.length} Währung(en) über ${rules.maxCurrencyPercent}%: ${over.map(([c, w]) => `${c} (${w.toFixed(1)}%)`).join(", ")}`,
    });
  }

  return out;
}

// ─── Optimieren-Tab ────────────────────────────────────────────────────────────
type OptimizeMethod = "max_sharpe" | "min_variance" | "equal_weight" | "max_dividend" | "hrp";

const METHOD_LABEL: Record<OptimizeMethod, string> = {
  max_sharpe: "Max. Sharpe",
  min_variance: "Min. Varianz",
  equal_weight: "Gleichgewichtet",
  max_dividend: "Max. Dividende",
  hrp: "HRP (Risk Parity)",
};

const METHOD_DESCRIPTION: Record<OptimizeMethod, string> = {
  max_sharpe: "Maximiert die risikoadjustierte Rendite (Sharpe Ratio)",
  min_variance: "Minimiert die Portfolio-Volatilität",
  equal_weight: "Gleichmässige Verteilung auf alle Positionen",
  max_dividend: "Maximiert die Dividendenrendite",
  hrp: "Hierarchical Risk Parity: Verteilt Risiko gleichmässig über Korrelations-Cluster (kein Rendite-Schätzer benötigt)",
};

export default function OptimierenTab({
  portfolioId,
  holdings,
  totalValueCHF,
  method = "max_sharpe",
  strategyNote,
}: {
  portfolioId: number;
  holdings: any[];
  totalValueCHF?: number;
  /** F3: Optimierungs-Methode, aus dem Anlageprofil abgeleitet. */
  method?: OptimizeMethod;
  /** F3: kurze Begründung, warum diese Strategie (aus dem Profil). */
  strategyNote?: string;
}) {
  const [showDivRules, setShowDivRules] = useState(true);

  // F2: Diversifikationsregeln aus der Admin-Konfig (statt hartkodiert)
  const { data: rulesData } = trpc.analytics.getDiversificationRules.useQuery(undefined, {
    staleTime: 10 * 60 * 1000,
  });
  const rules: DiversificationRules = { ...DEFAULT_RULES, ...(rulesData ?? {}) };

  const tickers = useMemo(
    () => holdings.filter((h: any) => h.ticker && h.ticker !== "CASH").map((h: any) => h.ticker),
    [holdings]
  );

  // Aktuelle Gewichte (Prozent → Anteil 0..1) je Ticker
  const currentWeights = useMemo(() => {
    const map: Record<string, number> = {};
    holdings.forEach((h: any) => {
      if (!h.ticker || h.ticker === "CASH") return;
      map[h.ticker] = parseFloat(h.weight || "0") / 100;
    });
    return map;
  }, [holdings]);

  const { data: result, isFetching, error } = trpc.analytics.optimize.useQuery(
    {
      tickers,
      lookbackDays: 252,
      riskFreeRate: 0.015,
      method,
      // R-34c: Portfoliowert für die Mindest-Positionsgrösse CHF 3'000 (Server-Post-Filter)
      ...(totalValueCHF && totalValueCHF > 0 ? { portfolioValue: totalValueCHF } : {}),
      // Pass actual weights so backend can compute the real current portfolio point
      ...(Object.keys(currentWeights).length > 0 ? { currentWeights } : {}),
    },
    { enabled: portfolioId > 0 && tickers.length >= 2, staleTime: 5 * 60 * 1000 }
  );

  const frontierData = useMemo(() => {
    if (!result?.efficientFrontier) return [];
    return result.efficientFrontier.map((p: any) => ({
      x: parseFloat((p.volatility * 100).toFixed(2)),
      y: parseFloat((p.expectedReturn * 100).toFixed(2)),
      sharpe: parseFloat(p.sharpe.toFixed(2)),
      topWeights: (p.topWeights ?? []) as Array<{ ticker: string; weight: number }>,
    }));
  }, [result]);

  const optimalPoint = result?.optimalPortfolio
    ? { x: +(result.optimalPortfolio.volatility * 100).toFixed(2), y: +(result.optimalPortfolio.expectedReturn * 100).toFixed(2) }
    : null;
  const currentPoint = result?.currentPortfolio
    ? { x: +(result.currentPortfolio.volatility * 100).toFixed(2), y: +(result.currentPortfolio.expectedReturn * 100).toFixed(2) }
    : null;

  // KI-Vorschläge: grösste Abweichungen optimal vs. aktuell. Der Server
  // garantiert seit R-34 Summe ≈ 1 innerhalb der (bei kleinen Portfolios
  // aufgeweiteten) Bounds — clientseitiges Cappen/Renormalisieren würde die
  // Bounds wieder verletzen und entfällt daher.
  const suggestions = useMemo(() => {
    if (!result?.weights) return [];
    const optimal = result.weights as Record<string, number>;
    const all = new Set([...Object.keys(optimal), ...Object.keys(currentWeights)]);
    return Array.from(all)
      .map((ticker) => {
        const cur = currentWeights[ticker] || 0;
        const opt = optimal[ticker] || 0;
        return { ticker, cur, opt, diff: opt - cur };
      })
      .filter((s) => Math.abs(s.diff) >= 0.02)
      .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
      .slice(0, 6);
  }, [result, currentWeights]);

  // R-34c: vom Server wegen der Mindestgrösse CHF 3'000 auf 0 gesetzte Positionen
  const droppedPositions = useMemo(
    () =>
      ((result as any)?.droppedPositions ?? []) as Array<{
        ticker: string;
        targetWeight: number;
        targetValueCHF: number;
      }>,
    [result]
  );

  // Diversification rules
  const divRules = useMemo(
    () => checkDiversificationRules(holdings, totalValueCHF || 0, rules),
    [holdings, totalValueCHF, rules]
  );
  const passedCount = divRules.filter(r => r.passed).length;
  const allPassed = passedCount === divRules.length;

  if (tickers.length < 2) {
    return (
      <div className="bg-[#0f1420] border border-white/10 rounded-lg p-10 text-center">
        <Target className="h-10 w-10 text-gray-600 mx-auto mb-3" />
        <p className="text-gray-400 text-sm">Mindestens 2 Positionen erforderlich, um eine Optimierung zu berechnen.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ─── R-34: Warnung bei zu wenigen Titeln (der Optimizer kann keine Titel ergänzen) ─── */}
      {tickers.length < rules.minTitles && (
        <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/40 rounded-lg px-4 py-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-200">
            Für eine robuste Optimierung empfehlen wir mindestens {rules.minTitles} Titel — Ihr Portfolio hat{' '}
            {tickers.length}. Die Optimierung verteilt nur bestehende Positionen um; ergänzen Sie
            weitere Positionen über{' '}
            <Link href="/aktien" className="underline font-semibold text-amber-100 hover:text-white">
              Aktien → Empfehlungen
            </Link>
            .
          </p>
        </div>
      )}

      {/* ─── Diversifikationsregeln ─── */}
      <div className={`border rounded-lg overflow-hidden ${allPassed ? 'border-[#00CFC1]/30' : 'border-amber-500/30'}`}>
        <button
          onClick={() => setShowDivRules(!showDivRules)}
          className="w-full flex items-center justify-between px-4 py-3 bg-[#0f1420] hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-2">
            {allPassed
              ? <CheckCircle className="w-4 h-4 text-[#00CFC1]" />
              : <AlertTriangle className="w-4 h-4 text-amber-400" />
            }
            <span className="text-sm font-semibold text-white">Diversifikationsregeln</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${allPassed ? 'bg-[#00CFC1]/20 text-[#00CFC1]' : 'bg-amber-500/20 text-amber-400'}`}>
              {passedCount}/{divRules.length}
            </span>
          </div>
          <span className="text-gray-500 text-xs">{showDivRules ? '▲ Schliessen' : '▼ Aufklappen'}</span>
        </button>
        {showDivRules && (
          <div className="border-t border-white/10 divide-y divide-white/5">
            {divRules.map((rule) => (
              <div key={rule.id} className="flex items-start gap-3 px-4 py-3 bg-[#0a0e1a]">
                <div className="mt-0.5 flex-shrink-0">
                  {rule.passed
                    ? <CheckCircle className="w-4 h-4 text-[#00CFC1]" />
                    : <AlertTriangle className="w-4 h-4 text-amber-400" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{rule.label}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{rule.description}</p>
                  <p className={`text-xs mt-1 font-medium ${rule.passed ? 'text-[#00CFC1]' : 'text-amber-400'}`}>
                    {rule.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Optimierung (MPT) ─── */}
      {isFetching ? (
        <div className="bg-[#0f1420] border border-white/10 rounded-lg p-10 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-[#00CFC1] border-t-transparent rounded-full animate-spin" />
          <span className="ml-3 text-sm text-gray-400">Effizienzgrenze wird berechnet…</span>
        </div>
      ) : error || !result ? (
        <div className="bg-red-950/20 border border-red-800/40 rounded-lg p-6 text-center">
          <p className="text-red-400 text-sm">{(error as any)?.message || "Optimierung nicht verfügbar."}</p>
        </div>
      ) : (
        <>
          {/* F3: Strategie-Herleitung aus dem Anlageprofil */}
          {strategyNote && (
            <div className="flex items-start gap-2 bg-[#00CFC1]/5 border border-[#00CFC1]/20 rounded-lg px-4 py-2.5">
              <Info className="w-4 h-4 text-[#00CFC1] flex-shrink-0 mt-0.5" />
              <p className="text-xs text-gray-300">{strategyNote}</p>
            </div>
          )}

          {/* KPIs des optimalen Portfolios */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-0 border border-white/10 rounded-lg overflow-hidden">
            {[
              { label: "Erw. Rendite (p.a.)", value: `${(result.optimalPortfolio.expectedReturn * 100).toFixed(1)}%`, tone: "text-[#00CFC1]" },
              { label: "Volatilität (p.a.)", value: `${(result.optimalPortfolio.volatility * 100).toFixed(1)}%`, tone: "text-white" },
              { label: "Sharpe Ratio", value: result.optimalPortfolio.sharpe.toFixed(2), tone: result.optimalPortfolio.sharpe >= 1 ? "text-[#00CFC1]" : "text-amber-400" },
              { label: "Methode", value: METHOD_LABEL[method], tone: "text-white" },
            ].map((k, i) => (
              <div key={k.label} className={`bg-[#0f1420] p-4 ${i < 3 ? "border-r border-white/10" : ""}`}>
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5">{k.label}</p>
                <p className={`text-xl font-bold font-mono ${k.tone}`}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* R-34c: Mindest-Positionsgrösse CHF 3'000 — vom Server auf 0 gesetzte Positionen */}
          {droppedPositions.length > 0 && (
            <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/40 rounded-lg px-4 py-3">
              <Info className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-200">
                Mindest-Positionsgrösse CHF 3'000: {droppedPositions.length === 1
                  ? 'Eine Position unterschreitet im Zielportfolio die Mindestgrösse und wurde auf 0 % gesetzt'
                  : `${droppedPositions.length} Positionen unterschreiten im Zielportfolio die Mindestgrösse und wurden auf 0 % gesetzt`}
                {' '}(Gewicht auf die übrigen Titel umverteilt):{' '}
                {droppedPositions
                  .map((d) => `${d.ticker} (CHF ${Math.round(d.targetValueCHF).toLocaleString('de-CH')})`)
                  .join(', ')}
                .
              </p>
            </div>
          )}

          <div className="grid lg:grid-cols-2 gap-5">
            {/* KI-Vorschläge (Re-Allocation) */}
            <div className="bg-[#0f1420] border border-white/10 rounded-lg p-5">
              <h3 className="text-sm font-semibold text-white mb-1">KI-Empfehlungen</h3>
              <p className="text-xs text-gray-500 mb-4">Re-Allocation für maximale risikoadjustierte Rendite</p>
              {suggestions.length === 0 ? (
                <div className="flex items-center gap-2 text-[#00CFC1] text-sm">
                  <CheckCircle className="w-4 h-4" />
                  <span>Portfolio liegt nahe am Optimum — keine wesentliche Umschichtung nötig.</span>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {suggestions.map((s) => {
                    const up = s.diff > 0;
                    return (
                      <div key={s.ticker} className="flex items-center justify-between bg-white/[0.03] rounded-md px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className={`flex items-center justify-center w-6 h-6 rounded ${up ? "bg-[#00CFC1]/15 text-[#00CFC1]" : "bg-red-500/15 text-red-400"}`}>
                            {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                          </span>
                          <span className="font-mono text-xs font-semibold text-gray-200">{s.ticker}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-gray-500">{(s.cur * 100).toFixed(1)}% →</span>
                          <span className="text-white font-medium">{(s.opt * 100).toFixed(1)}%</span>
                          <span className={`font-mono w-14 text-right ${up ? "text-[#00CFC1]" : "text-red-400"}`}>
                            {up ? "+" : ""}{(s.diff * 100).toFixed(1)} pp
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Effizienzgrenze */}
            <div className="bg-[#0f1420] border border-white/10 rounded-lg p-5">
              <div className="flex items-center gap-1 mb-1">
                <h3 className="text-sm font-semibold text-white">Effizienzgrenze</h3>
                <span className="relative group ml-1">
                  <Info className="w-3 h-3 text-gray-600 cursor-help" />
                  <span className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-56 bg-[#1a1f2e] border border-white/20 rounded-lg px-3 py-2 text-[11px] text-gray-300 leading-relaxed shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                    Die Effizienzgrenze zeigt alle optimalen Portfolios (maximale Rendite bei gegebenem Risiko). Punkte unterhalb der Kurve sind suboptimal.
                  </span>
                </span>
              </div>
              <p className="text-xs text-gray-500 mb-3">Rendite vs. Risiko · Aktuell vs. Optimum</p>
              {frontierData.length < 2 ? (
                <div className="flex flex-col items-center justify-center h-52 gap-3 text-center">
                  <AlertTriangle className="w-8 h-8 text-amber-500/50" />
                  <div>
                    <p className="text-gray-400 text-sm font-medium">Effizienzgrenze nicht verfügbar</p>
                    <p className="text-gray-600 text-xs mt-1 max-w-48">
                      Zu wenige historische Preisdaten. Mindestens 60 Handelstage pro Titel erforderlich.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ height: 240 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="x" name="Volatilität" unit="%" tick={{ fontSize: 10, fill: "#9ca3af" }} label={{ value: "Risiko (%)", position: "insideBottom", offset: -10, fill: "#6b7280", fontSize: 10 }} />
                        <YAxis dataKey="y" name="Rendite" unit="%" tick={{ fontSize: 10, fill: "#9ca3af" }} width={38} />
                        <RechartsTooltip
                          cursor={{ strokeDasharray: "3 3" }}
                          content={({ active, payload }: any) => {
                            if (active && payload?.length) {
                              const d = payload[0].payload;
                              return (
                                <div className="bg-[#1a1f2e] border border-[#00CFC1]/40 rounded p-2 text-xs text-white min-w-[160px]">
                                  <p className="font-semibold text-[#00CFC1] mb-1">Frontier-Portfolio</p>
                                  <p>Rendite: <span className="text-green-400">{d.y}%</span></p>
                                  <p>Volatilität: <span className="text-amber-400">{d.x}%</span></p>
                                  {d.sharpe !== undefined && <p>Sharpe: <span className="text-white">{d.sharpe}</span></p>}
                                  {d.topWeights?.length > 0 && (
                                    <div className="mt-2 pt-2 border-t border-white/10">
                                      <p className="text-gray-400 mb-1">Top-Gewichte:</p>
                                      {d.topWeights.map((tw: { ticker: string; weight: number }) => (
                                        <p key={tw.ticker} className="flex justify-between gap-3">
                                          <span className="text-gray-300">{tw.ticker}</span>
                                          <span className="text-white font-medium">{tw.weight}%</span>
                                        </p>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Scatter data={frontierData} fill="#6366f1" opacity={0.5} />
                        {optimalPoint && <ReferenceDot x={optimalPoint.x} y={optimalPoint.y} r={7} fill="#00CFC1" stroke="#fff" strokeWidth={2} label={{ value: "Opt.", position: "top", fill: "#00CFC1", fontSize: 9 }} />}
                        {currentPoint && <ReferenceDot x={currentPoint.x} y={currentPoint.y} r={6} fill="#f59e0b" stroke="#fff" strokeWidth={2} label={{ value: "Aktuell", position: "top", fill: "#f59e0b", fontSize: 9 }} />}
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex gap-4 justify-center mt-1 text-xs text-gray-400">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#00CFC1] inline-block" /> Optimum</span>
                    {currentPoint && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Aktuell</span>}
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-400 inline-block" /> Frontier</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ─── HRP: Cluster-Reihenfolge & Risikobeiträge ─── */}
          {method === 'hrp' && (result as any)?.hrpMeta && (
            <div className="grid lg:grid-cols-2 gap-5">
              {/* Cluster-Reihenfolge */}
              <div className="bg-[#0f1420] border border-white/10 rounded-lg p-5">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-semibold text-white">Hierarchische Cluster-Reihenfolge</h3>
                  <span className="relative group ml-1">
                    <Info className="w-3 h-3 text-gray-600 cursor-help" />
                    <span className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-64 bg-[#1a1f2e] border border-white/20 rounded-lg px-3 py-2 text-[11px] text-gray-300 leading-relaxed shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                      HRP gruppiert Titel nach Korrelation (Single-Linkage Clustering). Benachbarte Titel im Dendrogram sind stärker korreliert — das Risiko wird gleichmässig über alle Cluster verteilt.
                    </span>
                  </span>
                </div>
                <p className="text-xs text-gray-500 mb-3">Titel nach Korrelations-Ähnlichkeit sortiert</p>
                <div className="flex flex-wrap gap-1.5">
                  {((result as any).hrpMeta.clusterOrder as string[]).map((ticker: string, idx: number) => (
                    <div key={ticker} className="flex items-center gap-1">
                      <span className="bg-[#00CFC1]/10 border border-[#00CFC1]/30 text-[#00CFC1] text-[11px] font-mono font-semibold px-2 py-1 rounded">
                        {ticker}
                      </span>
                      {idx < ((result as any).hrpMeta.clusterOrder as string[]).length - 1 && (
                        <span className="text-gray-700 text-[10px]">—</span>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-2">
                  <span className="text-xs text-gray-500">Diversifikations-Ratio:</span>
                  <span className="text-xs font-mono font-semibold text-[#00CFC1]">
                    {((result as any).hrpMeta.diversificationRatio as number).toFixed(2)}
                  </span>
                  <span className="text-[10px] text-gray-600">(je höher, desto besser diversifiziert)</span>
                </div>
              </div>

              {/* Risikobeiträge */}
              <div className="bg-[#0f1420] border border-white/10 rounded-lg p-5">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-semibold text-white">Risikobeiträge</h3>
                  <span className="relative group ml-1">
                    <Info className="w-3 h-3 text-gray-600 cursor-help" />
                    <span className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-64 bg-[#1a1f2e] border border-white/20 rounded-lg px-3 py-2 text-[11px] text-gray-300 leading-relaxed shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                      Anteil jeder Position am Gesamt-Portfolio-Risiko (Varianz). HRP strebt eine gleichmässige Risikoverteilung an — kein Titel dominiert das Risiko.
                    </span>
                  </span>
                </div>
                <p className="text-xs text-gray-500 mb-3">Anteil am Portfolio-Risiko (Varianz)</p>
                <div className="space-y-2">
                  {Object.entries((result as any).hrpMeta.riskContributions as Record<string, number>)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 10)
                    .map(([ticker, contrib]) => (
                      <div key={ticker} className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-gray-300 w-16 flex-shrink-0">{ticker}</span>
                        <div className="flex-1 bg-white/5 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-full bg-[#00CFC1] rounded-full"
                            style={{ width: `${Math.min(100, (contrib as number) * 100).toFixed(1)}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-mono text-gray-400 w-10 text-right">
                          {((contrib as number) * 100).toFixed(1)}%
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* Method description banner */}
          <div className="flex items-start gap-2 bg-white/[0.02] border border-white/10 rounded-lg px-4 py-2.5">
            <Info className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-gray-500">{METHOD_DESCRIPTION[method]}</p>
          </div>

          <p className="text-xs text-gray-600 text-center">
            ⚠️ Basierend auf historischen Renditen (Modern Portfolio Theory). Keine Anlageberatung.
          </p>
        </>
      )}
    </div>
  );
}
