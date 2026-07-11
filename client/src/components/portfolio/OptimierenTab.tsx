import { useMemo, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceDot,
} from "recharts";
import { ArrowUpRight, ArrowDownRight, Target, AlertTriangle, CheckCircle, Info, TrendingUp, Plus, RefreshCw, SlidersHorizontal, Zap, Play, CheckSquare, Square } from "lucide-react";

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
  minSectorPercent: number;
  maxSectorPercent: number;
  maxCurrencyPercent: number;
  upgradeScoreThreshold: number;
}

// Fallback, falls die Konfig noch lädt oder nicht verfügbar ist.
// Neu: maxPositionPercent = 25% (Bandbreite statt fix 10%), minTitles = 10.
const DEFAULT_RULES: DiversificationRules = {
  maxPositionPercent: 25,
  minPositionPercent: 1,
  minPositionAmountCHF: 3000,
  minTitles: 10,
  maxTitles: 30,
  minSectorPercent: 0,
  maxSectorPercent: 40,
  maxCurrencyPercent: 100,
  upgradeScoreThreshold: 55,
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

  // Regel: Einzelposition-Bandbreite (min/max)
  const overweighted = nonCash.filter((h: any) => parseFloat(h.weight || "0") > rules.maxPositionPercent);
  out.push({
    id: "max_weight",
    label: `Max. ${rules.maxPositionPercent}% pro Position`,
    description: `Keine einzelne Position soll mehr als ${rules.maxPositionPercent}% des Portfolios ausmachen (Klumpenrisiko).`,
    passed: overweighted.length === 0,
    detail: overweighted.length === 0
      ? `Alle Positionen ≤ ${rules.maxPositionPercent}%`
      : `${overweighted.length} Position(en) über ${rules.maxPositionPercent}%: ${overweighted.map((h: any) => `${h.ticker} (${parseFloat(h.weight || "0").toFixed(1)}%)`).join(", ")}`,
  });

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

// ─── Score-Badge ───────────────────────────────────────────────────────────────
function ScoreBadge({ score }: { score: number }) {
  const color = score >= 70 ? "text-emerald-400 bg-emerald-400/10" : score >= 55 ? "text-[#00CFC1] bg-[#00CFC1]/10" : score >= 45 ? "text-yellow-400 bg-yellow-400/10" : "text-red-400 bg-red-400/10";
  return (
    <span className={`inline-flex items-center justify-center text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded ${color}`}>
      {Math.round(score)}
    </span>
  );
}

// ─── Signal-Typ-Badge ──────────────────────────────────────────────────────────
function SignalBadge({ type }: { type: string | null }) {
  if (!type) return null;
  const cfg: Record<string, { label: string; cls: string }> = {
    buy: { label: "Kauf", cls: "text-emerald-400 bg-emerald-400/10" },
    sell: { label: "Verkauf", cls: "text-red-400 bg-red-400/10" },
    hold: { label: "Halten", cls: "text-gray-400 bg-white/5" },
  };
  const c = cfg[type] ?? cfg.hold;
  return <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${c.cls}`}>{c.label}</span>;
}

export default function OptimierenTab({
  portfolioId,
  holdings,
  totalValueCHF,
  method = "max_sharpe",
  strategyNote,
  onNavigateToTransactions,
}: {
  portfolioId: number;
  holdings: any[];
  totalValueCHF?: number;
  /** F3: Optimierungs-Methode, aus dem Anlageprofil abgeleitet. */
  method?: OptimizeMethod;
  /** F3: kurze Begründung, warum diese Strategie (aus dem Profil). */
  strategyNote?: string;
  /** Callback: navigiert zum Transaktionen-Tab nach erfolgreicher Umsetzung */
  onNavigateToTransactions?: () => void;
}) {
  const [showDivRules, setShowDivRules] = useState(true);
  const [showUpgrades, setShowUpgrades] = useState(true);
  const [showAllWeak, setShowAllWeak] = useState(false);
  const [showAllAdditions, setShowAllAdditions] = useState(false);

  // Transaktions-Umsetzung: Checkboxen + Bestätigungs-Dialog
  const [selectedTickers, setSelectedTickers] = useState<Set<string>>(new Set());
  const [showApplyConfirm, setShowApplyConfirm] = useState(false);
  const [applyResult, setApplyResult] = useState<{ count: number; transactions: { ticker: string; type: string; amountCHF: number }[] } | null>(null);

  const applyMut = trpc.analytics.applyOptimization.useMutation({
    onSuccess: (data) => {
      setApplyResult({ count: data.transactionsCreated, transactions: data.transactions });
      setShowApplyConfirm(false);
      setSelectedTickers(new Set());
      // Automatically navigate to the transactions tab after 1.5s
      if (onNavigateToTransactions) {
        setTimeout(() => onNavigateToTransactions(), 1500);
      }
    },
  });

  // Portfolio-Kopie vor Umsetzung
  const [showCloneOption, setShowCloneOption] = useState(false);
  const [cloneName, setCloneName] = useState('');
  const [cloneCreated, setCloneCreated] = useState<{ id: number; name: string } | null>(null);
  const [autoSnapshotInfo, setAutoSnapshotInfo] = useState<{ id: number; name: string } | null>(null);
  const cloneMut = trpc.analytics.clonePortfolio.useMutation({
    onSuccess: (data) => {
      setCloneCreated({ id: data.cloneId, name: data.cloneName });
    },
  });
  // Automatischer Snapshot vor der Umsetzung (ohne Dialog)
  const autoSnapshotMut = trpc.analytics.clonePortfolio.useMutation({
    onSuccess: (data) => {
      setAutoSnapshotInfo({ id: data.cloneId, name: data.cloneName });
    },
  });

  // Wöchentliches Optimierungs-Abo
  const { data: subData, refetch: refetchSub } = trpc.analytics.getOptimizationSubscription.useQuery(
    { portfolioId },
    { enabled: portfolioId > 0, staleTime: 5 * 60 * 1000 }
  );
  const subscribeMut = trpc.analytics.subscribeOptimizationAlert.useMutation({
    onSuccess: () => refetchSub(),
  });
  const unsubscribeMut = trpc.analytics.unsubscribeOptimizationAlert.useMutation({
    onSuccess: () => refetchSub(),
  });
  const isSubscribed = !!(subData && subData.isActive);
  const [driftThreshold, setDriftThreshold] = useState<number>(
    subData?.driftThresholdPp ?? 5
  );

  // Manuelle Optimierungsziele (Soft-Constraints)
  const [constraintMinDiv, setConstraintMinDiv] = useState<string>("");
  const [constraintMaxVol, setConstraintMaxVol] = useState<string>("");
  const [constraintMinSharpe, setConstraintMinSharpe] = useState<string>("");
  const [showConstraints, setShowConstraints] = useState(false);

  // Parsed constraints (nur wenn gültige Zahlen eingegeben)
  const userConstraints = useMemo(() => {
    const c: { minDividendYield?: number; maxVolatility?: number; minSharpe?: number } = {};
    const div = parseFloat(constraintMinDiv);
    if (!isNaN(div) && div > 0) c.minDividendYield = div / 100; // % → Anteil
    const vol = parseFloat(constraintMaxVol);
    if (!isNaN(vol) && vol > 0) c.maxVolatility = vol / 100;
    const sharpe = parseFloat(constraintMinSharpe);
    if (!isNaN(sharpe)) c.minSharpe = sharpe;
    return Object.keys(c).length > 0 ? c : undefined;
  }, [constraintMinDiv, constraintMaxVol, constraintMinSharpe]);

  const hasActiveConstraints = userConstraints !== undefined;

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

  // Signals für Score-Daten der aktuellen Positionen (für upgradeProposals benötigt)
  const { data: signalsData } = trpc.signals.generate.useQuery(
    { portfolioId },
    { enabled: portfolioId > 0, staleTime: 4 * 60 * 60 * 1000 }
  );
  const signalMap = useMemo(() => {
    const map = new Map<string, any>();
    if (signalsData) (signalsData as any[]).forEach((s: any) => map.set(s.ticker, s));
    return map;
  }, [signalsData]);

  // Holdings mit Signal-Scores angereichert (für upgradeProposals)
  const holdingsWithScores = useMemo(() =>
    holdings
      .filter((h: any) => h.ticker && h.ticker !== "CASH")
      .map((h: any) => ({
        ticker: h.ticker,
        weight: parseFloat(h.weight || "0") / 100,
        sector: h.sector ?? null,
        signalScore: signalMap.get(h.ticker)?.combinedScore ?? null,
        companyName: h.companyName ?? h.ticker,
      })),
    [holdings, signalMap]
  );

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
      // Manuelle Optimierungsziele
      ...(userConstraints ? { userConstraints } : {}),
    },
    { enabled: portfolioId > 0 && tickers.length >= 2, staleTime: 0 }
  );

  // Upgrade-Vorschläge aus Watchlist + Empfehlungen
  const { data: upgradeData, isFetching: isUpgradeFetching, refetch: refetchUpgrades } = trpc.analytics.upgradeProposals.useQuery(
    {
      portfolioId: String(portfolioId),
      holdings: holdingsWithScores,
      portfolioValue: totalValueCHF ?? 0,
    },
    {
      enabled: portfolioId > 0 && holdingsWithScores.length > 0,
      staleTime: 5 * 60 * 1000,
    }
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

  // KI-Vorschläge: ALLE Abweichungen optimal vs. aktuell (kein Limit mehr)
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
      .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
    // Kein .slice(0, 6) mehr — alle Empfehlungen anzeigen
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
      {/* ─── R-34: Warnung bei zu wenigen Titeln ─── */}
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

      {/* ─── Manuelle Optimierungsziele (Soft-Constraints) ─── */}
      <div className={`border rounded-lg overflow-hidden ${hasActiveConstraints ? 'border-[#00CFC1]/40' : 'border-white/10'}`}>
        <button
          onClick={() => setShowConstraints(!showConstraints)}
          className="w-full flex items-center justify-between px-4 py-3 bg-[#0f1420] hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-2">
            <SlidersHorizontal className={`w-4 h-4 ${hasActiveConstraints ? 'text-[#00CFC1]' : 'text-gray-500'}`} />
            <span className="text-sm font-semibold text-white">Optimierungsziele</span>
            {hasActiveConstraints ? (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-[#00CFC1]/20 text-[#00CFC1]">
                {Object.keys(userConstraints!).length} aktiv
              </span>
            ) : (
              <span className="text-[10px] text-gray-600">Optionale Nebenbedingungen für den Optimizer</span>
            )}
          </div>
          <span className="text-gray-500 text-xs">{showConstraints ? '▲ Schliessen' : '▼ Aufklappen'}</span>
        </button>

        {showConstraints && (
          <div className="border-t border-white/10 bg-[#0a0e1a] px-4 py-4">
            <p className="text-xs text-gray-500 mb-4">
              Geben Sie quantitative Ziele ein — der Optimizer berücksichtigt diese als Soft-Constraints
              (Penalty-Terme) und strebt sie an, ohne die Optimierung zu blockieren.
            </p>
            <div className="grid sm:grid-cols-3 gap-4">
              {/* Mindest-Dividendenrendite */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5">
                  Mindest-Dividendenrendite
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="20"
                    step="0.1"
                    placeholder="z.B. 3.0"
                    value={constraintMinDiv}
                    onChange={(e) => setConstraintMinDiv(e.target.value)}
                    className="w-full bg-[#0f1420] border border-white/20 text-white text-sm rounded-lg px-3 py-2 pr-8 focus:outline-none focus:border-[#00CFC1] placeholder-gray-600"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">%</span>
                </div>
                {constraintMinDiv && !isNaN(parseFloat(constraintMinDiv)) && (
                  <p className="text-[10px] text-[#00CFC1] mt-1">
                    Ziel: ≥ {parseFloat(constraintMinDiv).toFixed(1)}% Dividendenrendite
                  </p>
                )}
              </div>

              {/* Maximale Volatilität */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5">
                  Maximale Volatilität (p.a.)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    placeholder="z.B. 12.0"
                    value={constraintMaxVol}
                    onChange={(e) => setConstraintMaxVol(e.target.value)}
                    className="w-full bg-[#0f1420] border border-white/20 text-white text-sm rounded-lg px-3 py-2 pr-8 focus:outline-none focus:border-[#00CFC1] placeholder-gray-600"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">%</span>
                </div>
                {constraintMaxVol && !isNaN(parseFloat(constraintMaxVol)) && (
                  <p className="text-[10px] text-[#00CFC1] mt-1">
                    Ziel: ≤ {parseFloat(constraintMaxVol).toFixed(1)}% Volatilität
                  </p>
                )}
              </div>

              {/* Mindest-Sharpe */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5">
                  Mindest-Sharpe-Ratio
                </label>
                <input
                  type="number"
                  min="-5"
                  max="10"
                  step="0.1"
                  placeholder="z.B. 1.0"
                  value={constraintMinSharpe}
                  onChange={(e) => setConstraintMinSharpe(e.target.value)}
                  className="w-full bg-[#0f1420] border border-white/20 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#00CFC1] placeholder-gray-600"
                />
                {constraintMinSharpe && !isNaN(parseFloat(constraintMinSharpe)) && (
                  <p className="text-[10px] text-[#00CFC1] mt-1">
                    Ziel: Sharpe ≥ {parseFloat(constraintMinSharpe).toFixed(2)}
                  </p>
                )}
              </div>
            </div>

            {/* Constraint-Erreichung (nach Optimierung) */}
            {hasActiveConstraints && (result as any)?.constraintAchievement && (
              <div className="mt-4 pt-4 border-t border-white/10">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-3.5 h-3.5 text-[#00CFC1]" />
                  <span className="text-xs font-semibold text-white">Zielerreichung nach Optimierung</span>
                </div>
                <div className="grid sm:grid-cols-3 gap-3">
                  {(result as any).constraintAchievement.minDividendYield && (() => {
                    const ca = (result as any).constraintAchievement.minDividendYield;
                    return (
                      <div className={`rounded-lg px-3 py-2.5 border ${ca.met ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-amber-500/5 border-amber-500/30'}`}>
                        <p className="text-[10px] text-gray-500 mb-1">Dividendenrendite</p>
                        <div className="flex items-center gap-1.5">
                          {ca.met
                            ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                            : <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
                          <span className={`text-sm font-mono font-semibold ${ca.met ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {ca.achieved !== null ? `${(ca.achieved * 100).toFixed(2)}%` : '—'}
                          </span>
                          <span className="text-[10px] text-gray-600">/ Ziel: {(ca.target * 100).toFixed(1)}%</span>
                        </div>
                        {ca.current !== null && (
                          <p className="text-[10px] text-gray-600 mt-0.5">Aktuell: {(ca.current * 100).toFixed(2)}%</p>
                        )}
                      </div>
                    );
                  })()}
                  {(result as any).constraintAchievement.maxVolatility && (() => {
                    const ca = (result as any).constraintAchievement.maxVolatility;
                    return (
                      <div className={`rounded-lg px-3 py-2.5 border ${ca.met ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-amber-500/5 border-amber-500/30'}`}>
                        <p className="text-[10px] text-gray-500 mb-1">Volatilität (p.a.)</p>
                        <div className="flex items-center gap-1.5">
                          {ca.met
                            ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                            : <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
                          <span className={`text-sm font-mono font-semibold ${ca.met ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {(ca.achieved * 100).toFixed(1)}%
                          </span>
                          <span className="text-[10px] text-gray-600">/ Ziel: ≤ {(ca.target * 100).toFixed(1)}%</span>
                        </div>
                        <p className="text-[10px] text-gray-600 mt-0.5">Aktuell: {(ca.current * 100).toFixed(1)}%</p>
                      </div>
                    );
                  })()}
                  {(result as any).constraintAchievement.minSharpe && (() => {
                    const ca = (result as any).constraintAchievement.minSharpe;
                    return (
                      <div className={`rounded-lg px-3 py-2.5 border ${ca.met ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-amber-500/5 border-amber-500/30'}`}>
                        <p className="text-[10px] text-gray-500 mb-1">Sharpe-Ratio</p>
                        <div className="flex items-center gap-1.5">
                          {ca.met
                            ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                            : <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
                          <span className={`text-sm font-mono font-semibold ${ca.met ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {ca.achieved.toFixed(2)}
                          </span>
                          <span className="text-[10px] text-gray-600">/ Ziel: ≥ {ca.target.toFixed(2)}</span>
                        </div>
                        <p className="text-[10px] text-gray-600 mt-0.5">Aktuell: {ca.current.toFixed(2)}</p>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {hasActiveConstraints && (
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => { setConstraintMinDiv(""); setConstraintMaxVol(""); setConstraintMinSharpe(""); }}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  Alle Ziele zurücksetzen
                </button>
              </div>
            )}
          </div>
        )}
      </div>

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
            <span className="text-[10px] text-gray-600 ml-1">Bandbreite: {rules.minPositionPercent}–{rules.maxPositionPercent}% pro Titel</span>
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

      {/* ─── Upgrade-Vorschläge ─── */}
      <div className="border border-indigo-500/30 rounded-lg overflow-hidden">
        <button
          onClick={() => setShowUpgrades(!showUpgrades)}
          className="w-full flex items-center justify-between px-4 py-3 bg-[#0f1420] hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-400" />
            <span className="text-sm font-semibold text-white">Upgrade-Vorschläge</span>
            {upgradeData && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-indigo-500/20 text-indigo-300">
                {upgradeData.weakPositions.length} schwach · {upgradeData.additionSuggestions.length} Kandidaten
              </span>
            )}
            {upgradeData && upgradeData.avgScoreCurrent > 0 && upgradeData.avgScoreAfterUpgrade > upgradeData.avgScoreCurrent && (
              <span className="text-[10px] text-emerald-400 font-medium">
                Ø Score: {upgradeData.avgScoreCurrent} → {upgradeData.avgScoreAfterUpgrade} (+{upgradeData.avgScoreAfterUpgrade - upgradeData.avgScoreCurrent})
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); refetchUpgrades(); }}
              className="text-gray-600 hover:text-gray-400 transition-colors p-1"
              title="Aktualisieren"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isUpgradeFetching ? 'animate-spin' : ''}`} />
            </button>
            <span className="text-gray-500 text-xs">{showUpgrades ? '▲ Schliessen' : '▼ Aufklappen'}</span>
          </div>
        </button>

        {showUpgrades && (
          <div className="border-t border-white/10 bg-[#0a0e1a]">
            {isUpgradeFetching ? (
              <div className="flex items-center justify-center py-8 gap-3">
                <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-gray-400">Kandidaten werden analysiert…</span>
              </div>
            ) : !upgradeData ? (
              <div className="py-6 text-center text-gray-500 text-sm">
                Keine Daten verfügbar. Stellen Sie sicher, dass Watchlist oder Empfehlungen vorhanden sind.
              </div>
            ) : (
              <div className="divide-y divide-white/5">

                {/* Score-KPIs */}
                {upgradeData.avgScoreCurrent > 0 && (
                  <div className="px-4 py-3 flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Ø Portfolio-Score aktuell:</span>
                      <ScoreBadge score={upgradeData.avgScoreCurrent} />
                    </div>
                    {upgradeData.avgScoreAfterUpgrade > upgradeData.avgScoreCurrent && (
                      <>
                        <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">Nach Upgrade:</span>
                          <ScoreBadge score={upgradeData.avgScoreAfterUpgrade} />
                          <span className="text-xs text-emerald-400 font-semibold">
                            +{upgradeData.avgScoreAfterUpgrade - upgradeData.avgScoreCurrent} Punkte
                          </span>
                        </div>
                      </>
                    )}
                    <span className="text-[10px] text-gray-600 ml-auto">
                      {upgradeData.totalCandidates} Kandidaten in Watchlist/Empfehlungen · Schwelle: Score &lt; {upgradeData.upgradeScoreThreshold}
                    </span>
                  </div>
                )}

                {/* Schwache Positionen + Ersatz-Vorschläge */}
                {upgradeData.replacementSuggestions.length > 0 && (
                  <div className="px-4 py-3">
                    <h4 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Schwache Positionen — Ersatz-Vorschläge
                    </h4>
                    <div className="space-y-3">
                      {(showAllWeak ? upgradeData.replacementSuggestions : upgradeData.replacementSuggestions.slice(0, 5)).map((rep) => (
                        <div key={rep.weakTicker} className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
                          {/* Schwache Position */}
                          <div className="flex items-center gap-2 mb-2">
                            <ArrowDownRight className="w-4 h-4 text-red-400 flex-shrink-0" />
                            <span className="font-mono text-sm font-semibold text-red-300">{rep.weakTicker}</span>
                            <span className="text-xs text-gray-500 truncate">{rep.weakCompanyName}</span>
                            <ScoreBadge score={rep.weakScore} />
                            <span className="text-xs text-gray-600 ml-auto">{(rep.weakWeight * 100).toFixed(1)}%</span>
                          </div>
                          {/* Ersatz-Kandidaten */}
                          {rep.suggestions.length === 0 ? (
                            <p className="text-xs text-gray-600 pl-6">Kein besserer Kandidat im gleichen Sektor gefunden.</p>
                          ) : (
                            <div className="space-y-1.5 pl-6">
                              {rep.suggestions.map((s) => (
                                <div key={s.ticker} className="flex items-center gap-2 text-xs">
                                  <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                                  <span className="font-mono font-semibold text-emerald-300 w-16">{s.ticker}</span>
                                  <span className="text-gray-400 truncate flex-1">{s.companyName}</span>
                                  <ScoreBadge score={s.signalScore} />
                                  <SignalBadge type={s.signalType} />
                                  <span className="text-emerald-400 font-semibold w-12 text-right">+{s.scoreDelta}</span>
                                  {s.dividendYield && <span className="text-gray-500 w-12 text-right">{s.dividendYield}%</span>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    {upgradeData.replacementSuggestions.length > 5 && (
                      <button
                        onClick={() => setShowAllWeak(!showAllWeak)}
                        className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                      >
                        {showAllWeak
                          ? '▲ Weniger anzeigen'
                          : `▼ Alle ${upgradeData.replacementSuggestions.length} schwachen Positionen anzeigen`}
                      </button>
                    )}
                  </div>
                )}

                {upgradeData.replacementSuggestions.length === 0 && upgradeData.avgScoreCurrent > 0 && (
                  <div className="px-4 py-3 flex items-center gap-2 text-[#00CFC1] text-sm">
                    <CheckCircle className="w-4 h-4" />
                    <span>Alle Positionen liegen über der Score-Schwelle ({upgradeData.upgradeScoreThreshold}) — kein Ersatz nötig.</span>
                  </div>
                )}

                {/* Ergänzungs-Vorschläge */}
                {upgradeData.additionSuggestions.length > 0 && (
                  <div className="px-4 py-3">
                    <h4 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Plus className="w-3.5 h-3.5" />
                      Neue Kandidaten — Ergänzungs-Vorschläge (Score ≥ 65)
                    </h4>
                    <div className="space-y-1.5">
                      {(showAllAdditions ? upgradeData.additionSuggestions : upgradeData.additionSuggestions.slice(0, 8)).map((c: any) => (
                        <div key={c.ticker} className="flex items-center gap-2 text-xs bg-white/[0.02] rounded px-3 py-2">
                          <Plus className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                          <span className="font-mono font-semibold text-indigo-300 w-16">{c.ticker}</span>
                          <span className="text-gray-400 truncate flex-1">{c.companyName}</span>
                          {c.sector && <span className="text-gray-600 text-[10px] hidden sm:block">{c.sector}</span>}
                          <ScoreBadge score={c.signalScore} />
                          <SignalBadge type={c.signalType} />
                          <span className={`text-[10px] px-1 py-0.5 rounded ${c.listType === 'empfehlung' ? 'bg-[#00CFC1]/10 text-[#00CFC1]' : 'bg-white/5 text-gray-500'}`}>
                            {c.listType === 'empfehlung' ? 'Empfehlung' : 'Watchlist'}
                          </span>
                          {c.dividendYield && <span className="text-gray-500 w-12 text-right">{c.dividendYield}%</span>}
                        </div>
                      ))}
                    </div>
                    {upgradeData.additionSuggestions.length > 8 && (
                      <button
                        onClick={() => setShowAllAdditions(!showAllAdditions)}
                        className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                      >
                        {showAllAdditions
                          ? '▲ Weniger anzeigen'
                          : `▼ Alle ${upgradeData.additionSuggestions.length} Kandidaten anzeigen`}
                      </button>
                    )}
                  </div>
                )}

              </div>
            )}
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

          {/* Erfolgsmeldung nach Umsetzung */}
          {applyResult && (
            <div className="flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/40 rounded-lg px-4 py-3">
              <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-emerald-300">{applyResult.count} Transaktion{applyResult.count !== 1 ? 'en' : ''} erstellt</p>
                <p className="text-xs text-emerald-400/70 mt-0.5">
                  {applyResult.transactions.map(t =>
                    `${t.ticker}: ${t.type === 'buy' ? 'Kauf' : 'Verkauf'} CHF ${t.amountCHF.toLocaleString('de-CH')}`
                  ).join(' · ')}
                </p>
                {autoSnapshotInfo && (
                  <p className="text-xs text-gray-500 mt-1.5">
                    📸 Snapshot gespeichert: <span className="text-gray-400 font-medium">{autoSnapshotInfo.name}</span> — im Dashboard unter «Snapshots» vergleichbar.
                  </p>
                )}
              </div>
              <button onClick={() => { setApplyResult(null); setAutoSnapshotInfo(null); }} className="text-gray-500 hover:text-gray-300 text-xs">Schliessen</button>
            </div>
          )}

          {/* Bestätigungs-Dialog */}
          {showApplyConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
              <div className="bg-[#0f1420] border border-white/20 rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
                <h3 className="text-base font-semibold text-white mb-1">Transaktionen erstellen?</h3>
                <p className="text-xs text-gray-400 mb-4">
                  {selectedTickers.size} Transaktion{selectedTickers.size !== 1 ? 'en' : ''} · Gesamtportfoliowert: {fmtChf(totalValueCHF ?? 0)}
                </p>

                {/* Transaktionsliste mit Stückzahl */}
                <div className="space-y-1.5 mb-4 max-h-52 overflow-y-auto">
                  {suggestions.filter(s => selectedTickers.has(s.ticker)).map(s => {
                    const amtCHF = Math.abs(s.diff) * (totalValueCHF ?? 0);
                    const price = (s as any).currentPriceCHF;
                    const shares = price && price > 0 ? (amtCHF / price).toFixed(2) : null;
                    return (
                      <div key={s.ticker} className="flex items-center justify-between text-xs bg-white/[0.03] rounded px-3 py-2">
                        <div>
                          <span className="font-mono font-semibold text-gray-200">{s.ticker}</span>
                          {shares && (
                            <span className="text-gray-500 ml-2">{shares} Aktien à {price ? `CHF ${price.toFixed(2)}` : '–'}</span>
                          )}
                        </div>
                        <span className={s.diff > 0 ? 'text-[#00CFC1] font-semibold' : 'text-red-400 font-semibold'}>
                          {s.diff > 0 ? '↑ Kauf' : '↓ Verkauf'} {fmtChf(amtCHF)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Portfolio-Kopie Option */}
                <div className="border border-white/10 rounded-lg p-3 mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <button
                      onClick={() => {
                        setShowCloneOption(v => !v);
                        if (!cloneName) {
                          const today = new Date().toLocaleDateString('de-CH');
                          setCloneName(`Snapshot vor Optimierung (${today})`);
                        }
                      }}
                      className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                        showCloneOption ? 'bg-[#00CFC1] border-[#00CFC1]' : 'border-white/30 bg-transparent'
                      }`}
                    >
                      {showCloneOption && <span className="text-black text-[10px] font-bold">✓</span>}
                    </button>
                    <span className="text-xs text-gray-300">Portfolio vor Umsetzung als Kopie speichern</span>
                  </div>
                  {showCloneOption && (
                    <div className="flex gap-2 items-center">
                      <input
                        value={cloneName}
                        onChange={e => setCloneName(e.target.value)}
                        placeholder="Name der Kopie…"
                        className="flex-1 text-xs bg-white/5 border border-white/10 rounded px-2 py-1.5 text-gray-200 placeholder-gray-600 focus:outline-none focus:border-[#00CFC1]/50"
                      />
                      {cloneCreated ? (
                        <span className="text-xs text-emerald-400 flex-shrink-0">✓ Gespeichert</span>
                      ) : (
                        <button
                          onClick={() => cloneMut.mutate({ portfolioId, cloneName: cloneName || 'Snapshot' })}
                          disabled={cloneMut.isPending}
                          className="text-xs px-2.5 py-1.5 bg-white/10 hover:bg-white/20 rounded text-gray-300 flex-shrink-0 transition-colors"
                        >
                          {cloneMut.isPending ? 'Kopiere…' : 'Jetzt kopieren'}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Wöchentliches Abo */}
                <div className="border border-white/10 rounded-lg px-3 py-2.5 mb-5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-300 font-medium">Wöchentliche Optimierungsprüfung</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">Benachrichtigung wenn Portfolio &gt;{driftThreshold} pp vom Optimum abweicht</p>
                    </div>
                    <button
                      onClick={() => {
                        if (isSubscribed) {
                          unsubscribeMut.mutate({ portfolioId });
                        } else {
                          subscribeMut.mutate({ portfolioId, driftThresholdPp: driftThreshold });
                        }
                      }}
                      disabled={subscribeMut.isPending || unsubscribeMut.isPending}
                      className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${
                        isSubscribed ? 'bg-[#00CFC1]' : 'bg-white/20'
                      }`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                        isSubscribed ? 'translate-x-5' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>
                  {/* Drift-Schwelle Slider */}
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-gray-500 w-16 shrink-0">Schwelle:</span>
                    <input
                      type="range"
                      min={2}
                      max={15}
                      step={1}
                      value={driftThreshold}
                      onChange={(e) => setDriftThreshold(Number(e.target.value))}
                      className="flex-1 h-1 accent-[#00CFC1] cursor-pointer"
                    />
                    <span className="text-[10px] text-[#00CFC1] font-mono w-10 text-right shrink-0">{driftThreshold} pp</span>
                  </div>
                  <div className="flex justify-between text-[9px] text-gray-600 px-16">
                    <span>2 pp (sensitiv)</span>
                    <span>15 pp (tolerant)</span>
                  </div>
                  {isSubscribed && subData?.driftThresholdPp !== driftThreshold && (
                    <button
                      onClick={() => subscribeMut.mutate({ portfolioId, driftThresholdPp: driftThreshold })}
                      disabled={subscribeMut.isPending}
                      className="text-[10px] text-[#00CFC1] hover:underline"
                    >Schwelle aktualisieren ({driftThreshold} pp)</button>
                  )}
                </div>

                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setShowApplyConfirm(false)}
                    className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                  >Abbrechen</button>
                  <button
                    onClick={() => {
                      const items = suggestions
                        .filter(s => selectedTickers.has(s.ticker))
                        .map(s => ({ ticker: s.ticker, currentWeight: s.cur, targetWeight: s.opt }));
                      // Automatischer Snapshot vor der Umsetzung (ohne Dialog)
                      const snapshotName = `Snapshot vor Optimierung ${new Date().toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: '2-digit' })}`;
                      autoSnapshotMut.mutate({ portfolioId, cloneName: snapshotName });
                      applyMut.mutate({ portfolioId, totalValueCHF: totalValueCHF ?? 0, items });
                    }}
                    disabled={applyMut.isPending}
                    className="px-4 py-2 text-sm bg-[#00CFC1] text-black font-semibold rounded-lg hover:bg-[#00b8ab] disabled:opacity-50 transition-colors flex items-center gap-2"
                  >
                    {applyMut.isPending ? (
                      <><span className="w-4 h-4 border-2 border-black/40 border-t-black rounded-full animate-spin" />Wird erstellt…</>
                    ) : (
                      <><Play className="w-4 h-4" />Jetzt umsetzen</>
                    )}
                  </button>
                </div>
                {applyMut.error && (
                  <p className="text-red-400 text-xs mt-2">{(applyMut.error as any)?.message}</p>
                )}
              </div>
            </div>
          )}

          <div className="grid lg:grid-cols-2 gap-5">
            {/* KI-Vorschläge (Re-Allocation) — alle Positionen, kein Limit */}
            <div className="bg-[#0f1420] border border-white/10 rounded-lg p-5">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-semibold text-white">Gewichts-Empfehlungen</h3>
                {suggestions.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (selectedTickers.size === suggestions.length) {
                          setSelectedTickers(new Set());
                        } else {
                          setSelectedTickers(new Set(suggestions.map(s => s.ticker)));
                        }
                      }}
                      className="text-xs text-gray-400 hover:text-white transition-colors flex items-center gap-1"
                    >
                      {selectedTickers.size === suggestions.length
                        ? <><CheckSquare className="w-3.5 h-3.5" />Alle abwählen</>
                        : <><Square className="w-3.5 h-3.5" />Alle wählen</>
                      }
                    </button>
                    {selectedTickers.size > 0 && (
                      <button
                        onClick={() => setShowApplyConfirm(true)}
                        className="flex items-center gap-1.5 px-3 py-1 text-xs bg-[#00CFC1] text-black font-semibold rounded-md hover:bg-[#00b8ab] transition-colors"
                      >
                        <Play className="w-3 h-3" />
                        {selectedTickers.size === suggestions.length ? 'Alle umsetzen' : `${selectedTickers.size} umsetzen`}
                      </button>
                    )}
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 mb-4">Re-Allocation für maximale risikoadjustierte Rendite · Bandbreite {rules.minPositionPercent}–{rules.maxPositionPercent}%</p>
              {suggestions.length === 0 ? (
                <div className="flex items-center gap-2 text-[#00CFC1] text-sm">
                  <CheckCircle className="w-4 h-4" />
                  <span>Portfolio liegt nahe am Optimum — keine wesentliche Umschichtung nötig.</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {suggestions.map((s) => {
                    const up = s.diff > 0;
                    const isSelected = selectedTickers.has(s.ticker);
                    const amtCHF = Math.abs(s.diff) * (totalValueCHF ?? 0);
                    return (
                      <div
                        key={s.ticker}
                        onClick={() => {
                          const next = new Set(selectedTickers);
                          if (isSelected) next.delete(s.ticker); else next.add(s.ticker);
                          setSelectedTickers(next);
                        }}
                        className={`flex items-center justify-between rounded-md px-3 py-2.5 cursor-pointer transition-colors ${
                          isSelected ? 'bg-[#00CFC1]/10 border border-[#00CFC1]/30' : 'bg-white/[0.03] border border-transparent hover:bg-white/[0.05]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center ${
                            isSelected ? 'bg-[#00CFC1] border-[#00CFC1]' : 'border-gray-600'
                          }`}>
                            {isSelected && <CheckCircle className="w-3 h-3 text-black" />}
                          </span>
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
                          {totalValueCHF && amtCHF >= 10 && (
                            <span className="text-gray-600 w-20 text-right">{fmtChf(amtCHF)}</span>
                          )}
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
