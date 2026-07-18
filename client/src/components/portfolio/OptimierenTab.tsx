import { useMemo, useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
} from "recharts";
import { ArrowUpRight, ArrowDownRight, Target, AlertTriangle, CheckCircle, Info, TrendingUp, Plus, RefreshCw, SlidersHorizontal, Zap, Play, CheckSquare, Square, Search, X, LineChart as LineChartIcon } from "lucide-react";
import { PriceChart } from "@/components/charts";
import { InsightExpandable } from "@/components/InsightPanel";

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
type OptimizeMethod = "max_sharpe" | "min_variance" | "equal_weight" | "max_dividend" | "hrp" | "min_cvar";

const METHOD_LABEL: Record<OptimizeMethod, string> = {
  max_sharpe: "Max. Sharpe",
  min_variance: "Min. Varianz",
  equal_weight: "Gleichgewichtet",
  max_dividend: "Max. Dividende",
  hrp: "HRP (Risk Parity)",
  min_cvar: "Min. Tail-Risiko (CVaR)",
};

const METHOD_DESCRIPTION: Record<OptimizeMethod, string> = {
  max_sharpe: "Maximiert die risikoadjustierte Rendite (Sharpe Ratio)",
  min_variance: "Minimiert die Portfolio-Volatilität",
  equal_weight: "Gleichmässige Verteilung auf alle Positionen",
  max_dividend: "Maximiert die Dividendenrendite",
  hrp: "Hierarchical Risk Parity: Verteilt Risiko gleichmässig über Korrelations-Cluster (kein Rendite-Schätzer benötigt)",
  min_cvar: "Minimiert das Tail-Risiko (CVaR 95 %): dämpft die grössten Verlusttage — für sicherheitsorientierte Anleger",
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
  cashBalance = 0,
  method = "max_sharpe",
  strategyNote,
  onNavigateToTransactions,
  onNavigateToPositions,
  portfolioCreatedAt,
  portfolioType,
  profileMismatch,
}: {
  portfolioId: number;
  holdings: any[];
  totalValueCHF?: number;
  cashBalance?: number;
  /** F3: Optimierungs-Methode, aus dem Anlageprofil abgeleitet. */
  method?: OptimizeMethod;
  /** F3: kurze Begründung, warum diese Strategie (aus dem Profil). */
  strategyNote?: string;
  /** Callback: navigiert zum Transaktionen-Tab nach erfolgreicher Umsetzung */
  onNavigateToTransactions?: () => void;
  /** Callback: navigiert zum Positionen-Tab nach erfolgreicher Buchung */
  onNavigateToPositions?: () => void;
  /** P-ALIGN: Portfolio-Erstellungsdatum (ISO-String) für frisch-Portfolio-Hinweis */
  portfolioCreatedAt?: string | null;
  /** P-ALIGN: Portfolio-Typ ('demo' | 'live') */
  portfolioType?: string | null;
  /** Profil-Mismatch: Gründe und KI-Vorschlag wenn Portfolio nicht mehr zum Anlegerprofil passt */
  profileMismatch?: { reasons: string[]; severity: "low" | "medium" | "high"; aiSuggestion: string | null } | null;
}) {
  // P-ALIGN: Frisch erstelltes KI-Portfolio (demo, < 7 Tage)?
  const isFreshDemoPortfolio = useMemo(() => {
    if (!portfolioCreatedAt || portfolioType !== 'demo') return false;
    const ageDays = (Date.now() - new Date(portfolioCreatedAt).getTime()) / (1000 * 60 * 60 * 24);
    return ageDays < 7;
  }, [portfolioCreatedAt, portfolioType]);
  const [showDivRules, setShowDivRules] = useState(true);
  const [showUpgrades, setShowUpgrades] = useState(true);
  const [showAllWeak, setShowAllWeak] = useState(false);
  const [showAllAdditions, setShowAllAdditions] = useState(false);
  // Empfehlungs-Umsetzung: "Optimierung anwenden" Dialog
  const [showRecommendDialog, setShowRecommendDialog] = useState(false);
  const [recommendResult, setRecommendResult] = useState<{ count: number; netCashChange: number; transactionIds: number[]; buysScaledDown?: boolean; scaleFactor?: number } | null>(null);
  const [cloneFirst, setCloneFirst] = useState(false);
  const [numAdditions, setNumAdditions] = useState(5);
  // Upgrade-Vorschläge: Per-Item-Auswahl
  // deselectedReplacements: Set of weakTicker strings that are unchecked
  const [deselectedReplacements, setDeselectedReplacements] = useState<Set<string>>(new Set());
  // deselectedAdditions: Set of candidate tickers that are unchecked
  const [deselectedAdditions, setDeselectedAdditions] = useState<Set<string>>(new Set());
  // overrideReplacementTicker: map weakTicker → chosen replacement ticker (overrides suggestions[0])
  const [overrideReplacementTicker, setOverrideReplacementTicker] = useState<Record<string, string>>({});
  // openReplacementPicker: weakTicker of the row whose picker is open
  const [openReplacementPicker, setOpenReplacementPicker] = useState<string | null>(null);
  // openAdditionPicker: whether the "add another candidate" picker is open
  const [openAdditionPicker, setOpenAdditionPicker] = useState(false);
  const utils = trpc.useUtils();
  const applyRecMut = trpc.analytics.applyRecommendations.useMutation({
    onSuccess: (data) => {
      setRecommendResult({ count: data.transactionsCreated, netCashChange: data.netCashChange, transactionIds: data.transactionIds ?? [], buysScaledDown: data.buysScaledDown ?? false, scaleFactor: data.scaleFactor });
      setShowRecommendDialog(false);
      // Invalidate all portfolio-related queries so holdings refresh immediately
      utils.portfolios.getWithCurrency.invalidate();
      utils.portfolios.list.invalidate();
      utils.portfolioTransactions.list.invalidate();
      utils.analytics.upgradeProposals.invalidate();
      // Auto-navigate to Positionen-Tab after 1.5s so user sees new holdings
      if (onNavigateToPositions) {
        setTimeout(() => onNavigateToPositions(), 1500);
      }
    },
  });
  const undoRecMut = trpc.analytics.undoRecommendations.useMutation({
    onSuccess: () => {
      setRecommendResult(null);
      utils.portfolios.getWithCurrency.invalidate();
      utils.portfolios.list.invalidate();
    },
  });

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
  // FX exposure: load investor profile for reference currency and FX limit
  const { data: investorProfile } = trpc.investmentProfile.get.useQuery(undefined, { staleTime: 60_000 });

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

  // ─── Backtest der optimierten Ziel-Allokation ───────────────────────────────
  const [showBacktest, setShowBacktest] = useState(false);
  const [btRebalance, setBtRebalance] = useState<"monthly" | "none">("monthly");
  const optimizedWeights = useMemo(() => {
    const w = (result as any)?.weights as Record<string, number> | undefined;
    if (!w) return null;
    const entries = Object.entries(w).filter(([, val]) => (val ?? 0) > 0);
    if (entries.length < 1) return null;
    return { tickers: entries.map(([t]) => t), weights: entries.map(([, v]) => v) };
  }, [result]);
  const { data: backtest, isFetching: isBacktesting, error: backtestError } =
    trpc.analytics.backtestPortfolio.useQuery(
      {
        tickers: optimizedWeights?.tickers ?? [],
        weights: optimizedWeights?.weights ?? [],
        lookbackDays: 756,
        rebalance: btRebalance,
      },
      { enabled: showBacktest && !!optimizedWeights, staleTime: 5 * 60 * 1000, retry: false },
    );

  // Alle Aktien aus der DB (für Ersatz-Picker)
  const { data: allStocksData } = trpc.stocks.list.useQuery(undefined, { staleTime: 5 * 60 * 1000 });
  const allStocks = useMemo(() => (allStocksData ?? []) as any[], [allStocksData]);

  // Upgrade-Vorschläge aus Watchlist + Empfehlungen (zielbasiertes Ranking je nach method)
  const { data: upgradeData, isFetching: isUpgradeFetching, refetch: refetchUpgrades } = trpc.analytics.upgradeProposals.useQuery(
    {
      portfolioId: String(portfolioId),
      holdings: holdingsWithScores,
      portfolioValue: totalValueCHF ?? 0,
      cashBalance: cashBalance ?? 0,
      method,
    },
    {
      enabled: portfolioId > 0 && holdingsWithScores.length > 0,
      staleTime: 0, // Kein Cache: Ranking ändert sich mit method
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
            {(upgradeData as any)?.rankBy && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                ▲ {(upgradeData as any).rankBy}
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
                      {(upgradeData as any).rankBy && (
                        <span className="ml-2 px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 font-medium">
                          Sortiert nach: {(upgradeData as any).rankBy}
                        </span>
                      )}
                    </span>
                  </div>
                )}

                {/* FX-Risikowarnung: Fremdwährungsanteil über Profil-Limit */}
                {(() => {
                  if (!investorProfile || !holdings || holdings.length === 0) return null;
                  const refCurrency: string = (investorProfile.referenceCurrency as string) || 'CHF';
                  const maxFxPct: number = investorProfile.maxFxExposurePct != null ? parseFloat(String(investorProfile.maxFxExposurePct)) : 60;
                  const total = holdings.reduce((s: number, h: any) => s + (parseFloat(h.totalValueCHF || h.value || '0')), 0) || 1;
                  const fxValue = holdings
                    .filter((h: any) => h.ticker && h.ticker !== 'CASH')
                    .filter((h: any) => {
                      const cur = (h.currency || 'CHF') === 'GBp' ? 'GBP' : (h.currency || 'CHF');
                      return cur !== refCurrency;
                    })
                    .reduce((s: number, h: any) => s + parseFloat(h.totalValueCHF || h.value || '0'), 0);
                  const fxPct = (fxValue / total) * 100;
                  if (fxPct <= maxFxPct) return null;
                  return (
                    <div className="px-4 py-3 flex items-start gap-3 bg-red-500/5 border-b border-red-500/20">
                      <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-red-300 mb-1">
                          Fremdwährungsrisiko überschreitet Ihr Profil-Limit
                        </p>
                        <p className="text-xs text-red-200/70">
                          Aktueller Fremdwährungsanteil: <span className="font-semibold text-red-300">{fxPct.toFixed(0)}%</span> · Ihr Limit: <span className="font-semibold">{maxFxPct}%</span> · Referenzwährung: <span className="font-mono">{refCurrency}</span>
                        </p>
                        <p className="text-xs text-red-200/50 mt-1">
                          Erwägen Sie, einige Fremdwährungspositionen durch {refCurrency}-denominierte Alternativen zu ersetzen oder Währungsabsicherungen (Hedging) einzusetzen.
                        </p>
                      </div>
                    </div>
                  );
                })()}

                {/* Profil-Mismatch-Warnung */}
                {profileMismatch && profileMismatch.reasons.length > 0 && (
                  <div className="px-4 py-3 flex items-start gap-3 bg-amber-500/5 border-b border-amber-500/20">
                    <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-amber-300 mb-1">Portfolio entspricht nicht mehr Ihrem Anlegerprofil</p>
                      <ul className="text-xs text-amber-200/70 space-y-0.5 list-disc list-inside">
                        {profileMismatch.reasons.map((r, i) => <li key={i}>{r}</li>)}
                      </ul>
                      {profileMismatch.aiSuggestion && (
                        <div className="mt-2 pt-2 border-t border-amber-500/20">
                          <p className="text-[11px] text-amber-400/80 font-medium mb-0.5">KI-Empfehlung:</p>
                          <p className="text-xs text-amber-200/70">{profileMismatch.aiSuggestion}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* P-ALIGN: Hinweis für frisch erstellte KI-Portfolios */}
                {(upgradeData as any).isFreshAiPortfolio && (upgradeData as any).freshAiNotice && (
                  <div className="px-4 py-3 flex items-start gap-3 bg-[#00CFC1]/5 border-b border-[#00CFC1]/20">
                    <CheckCircle className="w-4 h-4 text-[#00CFC1] flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-[#00CFC1]/90">{(upgradeData as any).freshAiNotice}</p>
                  </div>
                )}

                {/* Schwache Positionen + Ersatz-Vorschläge */}
                {upgradeData.replacementSuggestions.length > 0 && (
                  <div className="px-4 py-3">
                    <h4 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Schwache Positionen — Ersatz-Vorschläge
                      <span className="ml-auto text-[10px] font-normal text-gray-500 normal-case">
                        {upgradeData.replacementSuggestions.filter(r => !deselectedReplacements.has(r.weakTicker) && r.suggestions.length > 0).length} von {upgradeData.replacementSuggestions.filter(r => r.suggestions.length > 0).length} ausgewählt
                      </span>
                    </h4>
                    <div className="space-y-3">
                      {(showAllWeak ? upgradeData.replacementSuggestions : upgradeData.replacementSuggestions.slice(0, 5)).map((rep) => {
                        const isChecked = !deselectedReplacements.has(rep.weakTicker);
                        const chosenTicker = overrideReplacementTicker[rep.weakTicker] ?? rep.suggestions[0]?.ticker;
                        const chosenSuggestion = rep.suggestions.find(s => s.ticker === chosenTicker) ?? rep.suggestions[0];
                        const pickerOpen = openReplacementPicker === rep.weakTicker;
                        return (
                          <div key={rep.weakTicker} className={`bg-white/[0.02] border rounded-lg p-3 transition-opacity ${
                            (rep as any).hasSufficientCash === false ? 'border-amber-500/30' : 'border-white/5'
                          } ${!isChecked ? 'opacity-40' : ''}`}>
                            {/* Schwache Position + Checkbox */}
                            <div className="flex items-center gap-2 mb-2">
                              <button
                                onClick={() => setDeselectedReplacements(prev => {
                                  const next = new Set(prev);
                                  if (next.has(rep.weakTicker)) next.delete(rep.weakTicker); else next.add(rep.weakTicker);
                                  return next;
                                })}
                                className="flex-shrink-0 text-gray-400 hover:text-white transition-colors"
                                title={isChecked ? 'Abwählen' : 'Auswählen'}
                              >
                                {isChecked ? <CheckSquare className="w-4 h-4 text-amber-400" /> : <Square className="w-4 h-4" />}
                              </button>
                              <ArrowDownRight className="w-4 h-4 text-red-400 flex-shrink-0" />
                              <span className="font-mono text-sm font-semibold text-red-300">{rep.weakTicker}</span>
                              <span className="text-xs text-gray-500 truncate">{rep.weakCompanyName}</span>
                              <ScoreBadge score={rep.weakScore} />
                              <span className="text-xs text-gray-600">{(rep.weakWeight * 100).toFixed(1)}%</span>
                              {(rep as any).cashRequired > 0 && (
                                <span className={`ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                                  (rep as any).hasSufficientCash === false
                                    ? 'bg-amber-500/20 text-amber-400'
                                    : 'bg-emerald-500/10 text-emerald-500'
                                }`}>
                                  {(rep as any).hasSufficientCash === false ? '⚠ Kein Cash' : '✓ Cash ok'}
                                  {' '}CHF {Math.round((rep as any).cashRequired).toLocaleString('de-CH')}
                                </span>
                              )}
                            </div>
                            {/* KI-Erklärung warum dieser Titel ersetzt werden soll */}
                            <InsightExpandable
                              title={`Warum ${rep.weakTicker} ersetzen?`}
                              summary={`${rep.weakTicker} hat einen Score von ${rep.weakScore}/100 und liegt damit unter der Qualitätsschwelle von ${upgradeData.upgradeScoreThreshold}. ${chosenSuggestion ? `${chosenSuggestion.ticker} wäre ein stärkerer Ersatz mit Score ${chosenSuggestion.signalScore}/100 (+${chosenSuggestion.scoreDelta} Punkte).` : ''}`}
                              factors={[
                                { label: 'Aktueller Score', value: `${rep.weakScore}/100`, sentiment: rep.weakScore >= 55 ? 'positive' : rep.weakScore >= 40 ? 'neutral' : 'negative', description: 'Kombinierter Score aus Momentum, Qualität und LPPL-Risikomodell' },
                                { label: 'Score-Schwelle', value: `${upgradeData.upgradeScoreThreshold}/100`, sentiment: 'neutral', description: 'Mindest-Score für eine Halteempfehlung im Portfolio' },
                                ...(chosenSuggestion ? [{ label: `Ersatz ${chosenSuggestion.ticker}`, value: `${chosenSuggestion.signalScore}/100`, sentiment: 'positive' as const, description: `Signal: ${chosenSuggestion.signalType?.toUpperCase() ?? '—'} · Score-Gewinn: +${chosenSuggestion.scoreDelta} Punkte` }] : []),
                                { label: 'Gewicht im Portfolio', value: `${(rep.weakWeight * 100).toFixed(1)}%`, sentiment: 'neutral', description: 'Aktueller Anteil dieser Position am Gesamtportfolio' },
                                ...((rep as any).cashRequired > 0 ? [{ label: 'Benötigtes Cash', value: `CHF ${Math.round((rep as any).cashRequired).toLocaleString('de-CH')}`, sentiment: (rep as any).hasSufficientCash === false ? 'negative' as const : 'positive' as const, description: (rep as any).hasSufficientCash === false ? 'Nicht genügend Cash verfügbar für diesen Tausch' : 'Genügend Cash für den Tausch vorhanden' }] : []),
                              ]}
                              riskNote={(rep as any).hasSufficientCash === false ? 'Kein ausreichendes Cash für diesen Tausch. Verkäufe oder Einlagen nötig.' : undefined}
                              variant="warning"
                              triggerLabel="KI-Begründung"
                              className="mb-2"
                            />
                            {/* Ersatz-Kandidaten */}
                            {rep.suggestions.length === 0 ? (
                              <p className="text-xs text-gray-600 pl-6">Kein besserer Kandidat im gleichen Sektor gefunden.</p>
                            ) : (
                              <div className="pl-6">
                                {/* Aktiver Ersatz-Kandidat */}
                                <div className="flex items-center gap-2 text-xs mb-1.5">
                                  <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                                  <span className="font-mono font-semibold text-emerald-300 w-16">{chosenSuggestion?.ticker ?? '—'}</span>
                                  <span className="text-gray-400 truncate flex-1">{chosenSuggestion?.companyName ?? ''}</span>
                                  {chosenSuggestion && <ScoreBadge score={chosenSuggestion.signalScore} />}
                                  {chosenSuggestion && <SignalBadge type={chosenSuggestion.signalType} />}
                                  {chosenSuggestion && <span className="text-emerald-400 font-semibold w-12 text-right">+{chosenSuggestion.scoreDelta}</span>}
                                  {/* Andere Kandidaten wählen */}
                                  {rep.suggestions.length > 1 && (
                                    <div className="relative ml-1">
                                      <button
                                        onClick={() => setOpenReplacementPicker(pickerOpen ? null : rep.weakTicker)}
                                        className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                                        title="Anderen Ersatz wählen"
                                      >
                                        ⇄ {rep.suggestions.length}
                                      </button>
                                      {pickerOpen && (
                                        <div className="absolute z-40 right-0 top-full mt-1 bg-[#1a2035] border border-white/20 rounded-lg shadow-xl min-w-[220px]">
                                          {rep.suggestions.map((s) => (
                                            <button
                                              key={s.ticker}
                                              onClick={() => {
                                                setOverrideReplacementTicker(prev => ({ ...prev, [rep.weakTicker]: s.ticker }));
                                                setOpenReplacementPicker(null);
                                              }}
                                              className={`w-full text-left px-3 py-2 text-xs hover:bg-white/5 transition-colors flex items-center gap-2 ${
                                                s.ticker === chosenTicker ? 'bg-emerald-500/10 text-emerald-300' : 'text-gray-300'
                                              }`}
                                            >
                                              <span className="font-mono font-semibold w-14 shrink-0">{s.ticker}</span>
                                              <span className="truncate flex-1">{s.companyName}</span>
                                              <ScoreBadge score={s.signalScore} />
                                            </button>
                                          ))}
                                          <div className="border-t border-white/10 px-2 py-1.5">
                                            <p className="text-[10px] text-gray-600">Anderen Titel aus DB suchen:</p>
                                            <div className="relative mt-1">
                                              <div className="flex items-center gap-1.5 bg-white/5 rounded px-2 py-1">
                                                <Search className="w-3 h-3 text-gray-500 shrink-0" />
                                                <input
                                                  autoFocus
                                                  placeholder="Ticker oder Name…"
                                                  className="bg-transparent text-white text-xs outline-none flex-1 placeholder:text-gray-600 w-28"
                                                  onChange={(e) => {
                                                    const q = e.target.value.toLowerCase();
                                                    if (!q) return;
                                                    // handled inline via state
                                                    (e.target as any)._q = q;
                                                    e.target.dispatchEvent(new Event('input'));
                                                  }}
                                                  onInput={(e) => {
                                                    const q = (e.target as HTMLInputElement).value.toLowerCase();
                                                    const list = document.getElementById(`picker-list-${rep.weakTicker}`);
                                                    if (!list) return;
                                                    const items = list.querySelectorAll('[data-ticker]');
                                                    items.forEach((el: any) => {
                                                      const t = (el.dataset.ticker ?? '').toLowerCase();
                                                      const n = (el.dataset.name ?? '').toLowerCase();
                                                      el.style.display = (!q || t.includes(q) || n.includes(q)) ? '' : 'none';
                                                    });
                                                  }}
                                                />
                                              </div>
                                              <div id={`picker-list-${rep.weakTicker}`} className="max-h-32 overflow-y-auto mt-1">
                                                {allStocks.slice(0, 50).map((s: any) => (
                                                  <button
                                                    key={s.ticker}
                                                    data-ticker={s.ticker}
                                                    data-name={s.companyName ?? s.name ?? ''}
                                                    onClick={() => {
                                                      setOverrideReplacementTicker(prev => ({ ...prev, [rep.weakTicker]: s.ticker }));
                                                      setOpenReplacementPicker(null);
                                                    }}
                                                    className="w-full text-left px-2 py-1 text-xs hover:bg-white/5 transition-colors flex items-center gap-2 text-gray-400"
                                                  >
                                                    <span className="font-mono w-14 shrink-0 text-teal-400">{s.ticker}</span>
                                                    <span className="truncate">{s.companyName ?? s.name}</span>
                                                  </button>
                                                ))}
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                                {/* Weitere Alternativen (collapsed, nur als Info) */}
                                {rep.suggestions.length > 1 && (
                                  <p className="text-[10px] text-gray-600">
                                    {rep.suggestions.filter(s => s.ticker !== chosenTicker).map(s => s.ticker).join(', ')} als Alternativen verfügbar
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
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
                      <span className="ml-auto text-[10px] font-normal text-gray-500 normal-case">
                        {upgradeData.additionSuggestions.filter((c: any) => !deselectedAdditions.has(c.ticker)).length} ausgewählt
                      </span>
                    </h4>
                    <div className="space-y-1.5">
                      {(showAllAdditions ? upgradeData.additionSuggestions : upgradeData.additionSuggestions.slice(0, 8)).map((c: any) => {
                        const isAddChecked = !deselectedAdditions.has(c.ticker);
                        return (
                          <div key={c.ticker} className={`bg-white/[0.02] rounded px-3 py-2 transition-opacity ${!isAddChecked ? 'opacity-40' : ''}`}>
                            <div className="flex items-center gap-2 text-xs">
                              <button
                                onClick={() => setDeselectedAdditions(prev => {
                                  const next = new Set(prev);
                                  if (next.has(c.ticker)) next.delete(c.ticker); else next.add(c.ticker);
                                  return next;
                                })}
                                className="flex-shrink-0 text-gray-400 hover:text-white transition-colors"
                                title={isAddChecked ? 'Abwählen' : 'Auswählen'}
                              >
                                {isAddChecked ? <CheckSquare className="w-3.5 h-3.5 text-indigo-400" /> : <Square className="w-3.5 h-3.5" />}
                              </button>
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
                            {/* KI-Begründung für Ergänzungs-Vorschlag */}
                            <InsightExpandable
                              title={`Warum ${c.ticker} hinzufügen?`}
                              summary={`${c.ticker} (${c.companyName}) hat einen Score von ${c.signalScore}/100 und ein ${c.signalType?.toUpperCase() ?? 'HOLD'}-Signal. ${c.listType === 'empfehlung' ? 'Dieser Titel ist eine aktive KI-Empfehlung.' : 'Dieser Titel steht auf Ihrer Watchlist.'} ${c.dividendYield ? `Dividendenrendite: ${c.dividendYield}%.` : ''}`}
                              factors={[
                                { label: 'Score', value: `${c.signalScore}/100`, sentiment: c.signalScore >= 65 ? 'positive' : c.signalScore >= 50 ? 'neutral' : 'negative', description: 'Kombinierter Score aus Momentum, Qualität und LPPL-Risikomodell' },
                                { label: 'Signal', value: c.signalType?.toUpperCase() ?? '—', sentiment: c.signalType === 'buy' ? 'positive' : c.signalType === 'sell' ? 'negative' : 'neutral', description: 'Aktuelles Handelssignal basierend auf technischer und fundamentaler Analyse' },
                                { label: 'Sektor', value: c.sector ?? '—', sentiment: 'neutral', description: 'Sektorzugehörigkeit des Titels' },
                                { label: 'Quelle', value: c.listType === 'empfehlung' ? 'KI-Empfehlung' : 'Watchlist', sentiment: c.listType === 'empfehlung' ? 'positive' : 'neutral', description: c.listType === 'empfehlung' ? 'Aktiv von der KI als Kaufkandidat eingestuft' : 'Von Ihnen manuell auf die Watchlist gesetzt' },
                                ...(c.dividendYield ? [{ label: 'Dividendenrendite', value: `${c.dividendYield}%`, sentiment: parseFloat(c.dividendYield) >= 3 ? 'positive' as const : 'neutral' as const, description: 'Jährliche Dividendenrendite basierend auf aktuellem Kurs' }] : []),
                              ]}
                              variant="info"
                              triggerLabel="KI-Begründung"
                              className="mt-1.5"
                            />
                          </div>
                        );
                      })}
                    </div>
                    {/* Anderen Titel aus DB hinzufügen */}
                    <div className="mt-2 relative">
                      <button
                        onClick={() => setOpenAdditionPicker(!openAdditionPicker)}
                        className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> Anderen Titel manuell hinzufügen
                      </button>
                      {openAdditionPicker && (
                        <div className="absolute z-40 left-0 top-full mt-1 bg-[#1a2035] border border-white/20 rounded-lg shadow-xl w-72">
                          <div className="p-2 border-b border-white/10">
                            <div className="flex items-center gap-2">
                              <Search className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                              <input
                                autoFocus
                                placeholder="Ticker oder Name suchen…"
                                className="bg-transparent text-white text-sm outline-none flex-1 placeholder:text-gray-600"
                                onInput={(e) => {
                                  const q = (e.target as HTMLInputElement).value.toLowerCase();
                                  const list = document.getElementById('addition-picker-list');
                                  if (!list) return;
                                  const items = list.querySelectorAll('[data-ticker]');
                                  items.forEach((el: any) => {
                                    const t = (el.dataset.ticker ?? '').toLowerCase();
                                    const n = (el.dataset.name ?? '').toLowerCase();
                                    el.style.display = (!q || t.includes(q) || n.includes(q)) ? '' : 'none';
                                  });
                                }}
                              />
                              <button onClick={() => setOpenAdditionPicker(false)} className="text-gray-500 hover:text-white">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          <div id="addition-picker-list" className="max-h-48 overflow-y-auto">
                            {allStocks.slice(0, 100).map((s: any) => (
                              <button
                                key={s.ticker}
                                data-ticker={s.ticker}
                                data-name={s.companyName ?? s.name ?? ''}
                                onClick={() => {
                                  // Add to additionSuggestions as a custom entry by removing from deselected if present
                                  // and storing as a custom addition
                                  setDeselectedAdditions(prev => {
                                    const next = new Set(prev);
                                    next.delete(s.ticker);
                                    return next;
                                  });
                                  // Store as custom addition override
                                  setOverrideReplacementTicker(prev => ({ ...prev, [`__add__${s.ticker}`]: s.ticker }));
                                  setOpenAdditionPicker(false);
                                }}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 transition-colors flex items-center gap-2 text-gray-300"
                              >
                                <span className="font-mono w-16 shrink-0 text-teal-400">{s.ticker}</span>
                                <span className="truncate flex-1">{s.companyName ?? s.name}</span>
                                <span className="text-gray-600 shrink-0">{s.currency ?? s.exchange}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
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
                {/* ─── Optimierung anwenden Button ─── */}
                {(upgradeData.replacementSuggestions.some((r) => r.suggestions.length > 0) || upgradeData.additionSuggestions.length > 0) && (
                  <div className="px-4 py-4 border-t border-white/5">
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-gray-500">
                        {upgradeData.replacementSuggestions.filter((r) => r.suggestions.length > 0 && !deselectedReplacements.has(r.weakTicker)).length > 0 && (
                          <span className="text-amber-400 font-medium">
                            {upgradeData.replacementSuggestions.filter((r) => r.suggestions.length > 0 && !deselectedReplacements.has(r.weakTicker)).length} Ersatz-Transaktionen
                          </span>
                        )}
                        {upgradeData.replacementSuggestions.filter((r) => r.suggestions.length > 0 && !deselectedReplacements.has(r.weakTicker)).length > 0 && upgradeData.additionSuggestions.filter((c: any) => !deselectedAdditions.has(c.ticker)).length > 0 && (
                          <span className="text-gray-600"> + </span>
                        )}
                        {upgradeData.additionSuggestions.filter((c: any) => !deselectedAdditions.has(c.ticker)).length > 0 && (
                          <span className="text-indigo-400 font-medium">
                            {upgradeData.additionSuggestions.filter((c: any) => !deselectedAdditions.has(c.ticker)).length} neue Kandidaten
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => setShowRecommendDialog(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg transition-colors"
                      >
                        <Zap className="w-4 h-4" />
                        Optimierung anwenden
                      </button>
                    </div>
                    {recommendResult && (
                      <div className="mt-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2 text-xs text-emerald-400">
                          <CheckCircle className="w-4 h-4 flex-shrink-0" />
                          <span>
                            {recommendResult.count} Transaktion{recommendResult.count !== 1 ? 'en' : ''} erstellt
                            {recommendResult.netCashChange !== 0 && (
                              <> · Cashänderung: {recommendResult.netCashChange > 0 ? '+' : ''}{fmtChf(recommendResult.netCashChange)}</>
                            )}
                          </span>
                          <button onClick={() => setRecommendResult(null)} className="ml-auto text-gray-500 hover:text-gray-300">✕</button>
                        </div>
                        {recommendResult.buysScaledDown && (
                          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-amber-400">
                            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                            <span>Käufe wurden auf verfügbares Cash begrenzt (Faktor: {((recommendResult.scaleFactor ?? 1) * 100).toFixed(0)}%)</span>
                          </div>
                        )}
                        {recommendResult.transactionIds.length > 0 && (
                          <div className="mt-2 flex items-center gap-2">
                            <button
                              onClick={() => undoRecMut.mutate({ portfolioId, transactionIds: recommendResult.transactionIds })}
                              disabled={undoRecMut.isPending}
                              className="flex items-center gap-1.5 px-3 py-1 text-[11px] text-amber-400 border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 rounded-md transition-colors disabled:opacity-50"
                            >
                              {undoRecMut.isPending ? (
                                <><span className="w-3 h-3 border border-amber-400/40 border-t-amber-400 rounded-full animate-spin" />Rückgängig…</>
                              ) : (
                                <>↩ Rückgängig machen ({recommendResult.transactionIds.length} Transaktionen löschen)</>
                              )}
                            </button>
                            {undoRecMut.isError && (
                              <span className="text-[10px] text-red-400">{(undoRecMut.error as any)?.message}</span>
                            )}
                          </div>
                        )}
                      </div>
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
          {(() => {
            const optCvar = (result.optimalPortfolio as any).cvar95 as number | undefined;
            const currCvar = (result.currentPortfolio as any).cvar95 as number | undefined;
            const kpis: { label: string; value: string; tone: string; sub?: string }[] = [
              { label: "Erw. Rendite (p.a.)", value: `${(result.optimalPortfolio.expectedReturn * 100).toFixed(1)}%`, tone: "text-[#00CFC1]" },
              { label: "Volatilität (p.a.)", value: `${(result.optimalPortfolio.volatility * 100).toFixed(1)}%`, tone: "text-white" },
              { label: "Sharpe Ratio", value: result.optimalPortfolio.sharpe.toFixed(2), tone: result.optimalPortfolio.sharpe >= 1 ? "text-[#00CFC1]" : "text-amber-400" },
            ];
            if (typeof optCvar === "number") {
              // CVaR 95 %: mittlerer Verlust an den schlechtesten 5 % der Handelstage.
              // Niedriger = weniger Tail-Risiko; bei «Min. Tail-Risiko» hervorgehoben.
              kpis.push({
                label: "CVaR 95 % (Tag)",
                value: `−${Math.abs(optCvar).toFixed(2)}%`,
                tone: method === "min_cvar" ? "text-[#00CFC1]" : "text-white",
                sub: typeof currCvar === "number" ? `aktuell −${Math.abs(currCvar).toFixed(2)}%` : undefined,
              });
            }
            kpis.push({ label: "Methode", value: METHOD_LABEL[method], tone: "text-white" });
            return (
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-0 border border-white/10 rounded-lg overflow-hidden">
                {kpis.map((k, i) => (
                  <div key={k.label} className={`bg-[#0f1420] p-4 ${i < kpis.length - 1 ? "border-r border-white/10" : ""}`}>
                    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5">{k.label}</p>
                    <p className={`text-xl font-bold font-mono ${k.tone}`}>{k.value}</p>
                    {k.sub && <p className="text-[10px] text-gray-600 mt-0.5">{k.sub}</p>}
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Backtest der optimierten Ziel-Allokation (EODHD-Historie, CHF) */}
          <div className="border border-white/10 rounded-lg bg-[#0f1420] overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <LineChartIcon className="w-4 h-4 text-[#00CFC1]" />
                <span className="text-sm font-semibold text-white">Backtest der Ziel-Allokation</span>
                <span className="text-[11px] text-gray-500">— historische Entwicklung (3 J.), in CHF</span>
              </div>
              <div className="flex items-center gap-2">
                {showBacktest && (
                  <div className="inline-flex rounded-md border border-white/10 bg-[#1a2332] p-0.5" role="group" aria-label="Rebalancing wählen">
                    {([["monthly", "Monatl. Rebalancing"], ["none", "Buy & Hold"]] as const).map(([val, lbl]) => (
                      <button
                        key={val}
                        onClick={() => setBtRebalance(val)}
                        className={`px-2.5 py-1 text-xs rounded ${btRebalance === val ? "bg-[#00CFC1] text-black font-semibold" : "text-gray-400 hover:text-gray-200"}`}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                )}
                {!showBacktest ? (
                  <button
                    onClick={() => setShowBacktest(true)}
                    disabled={!optimizedWeights}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-[#00CFC1] text-black hover:bg-[#00b3a6] disabled:opacity-40"
                  >
                    <Play className="w-3.5 h-3.5" /> Backtest anzeigen
                  </button>
                ) : (
                  <button onClick={() => setShowBacktest(false)} className="text-xs text-gray-400 hover:text-gray-200">Ausblenden</button>
                )}
              </div>
            </div>

            {showBacktest && (
              <div className="p-4">
                {isBacktesting ? (
                  <div className="h-64 flex items-center justify-center text-sm text-gray-400">
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Backtest wird berechnet …
                  </div>
                ) : backtestError ? (
                  <div className="flex items-start gap-2 text-sm text-amber-300">
                    <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{backtestError.message}</span>
                  </div>
                ) : backtest && backtest.equityCurve.length >= 2 ? (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-0 border border-white/10 rounded-lg overflow-hidden mb-4">
                      {[
                        { label: "Gesamtrendite", value: `${backtest.stats.totalReturnPct >= 0 ? "+" : ""}${backtest.stats.totalReturnPct.toFixed(1)}%`, tone: backtest.stats.totalReturnPct >= 0 ? "text-[#00CFC1]" : "text-negative" },
                        { label: "CAGR (p.a.)", value: `${backtest.stats.cagrPct >= 0 ? "+" : ""}${backtest.stats.cagrPct.toFixed(1)}%`, tone: "text-white" },
                        { label: "Volatilität", value: `${backtest.stats.annualVolPct.toFixed(1)}%`, tone: "text-white" },
                        { label: "Sharpe", value: backtest.stats.sharpe.toFixed(2), tone: backtest.stats.sharpe >= 1 ? "text-[#00CFC1]" : "text-amber-400" },
                        { label: "Max Drawdown", value: `${backtest.stats.maxDrawdownPct.toFixed(1)}%`, tone: "text-negative" },
                      ].map((k, i) => (
                        <div key={k.label} className={`bg-[#111827] p-3 ${i < 4 ? "border-r border-white/10" : ""}`}>
                          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1">{k.label}</p>
                          <p className={`text-base font-bold font-mono ${k.tone}`}>{k.value}</p>
                        </div>
                      ))}
                    </div>
                    <PriceChart
                      seriesType="area"
                      height={260}
                      values={backtest.equityCurve.map((p) => ({ time: p.date, value: +(p.value * 100).toFixed(2) }))}
                    />
                    <p className="text-[11px] text-gray-500 mt-2">
                      Indexiert auf 100 zum Start ({backtest.fromDate}). Simulation der Ziel-Gewichte auf
                      historischen EODHD-Kursen{backtest.excludedTickers.length > 0
                        ? ` — ohne ${backtest.excludedTickers.join(", ")} (keine Historie)`
                        : ""}. Vergangene Wertentwicklung ist keine Garantie für die Zukunft.
                    </p>
                  </>
                ) : (
                  <div className="h-32 flex items-center justify-center text-sm text-gray-400">
                    Kein Backtest-Ergebnis verfügbar (zu wenig Kurshistorie).
                  </div>
                )}
              </div>
            )}
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

          {/* Empfehlungs-Umsetzung Dialog */}
          {showRecommendDialog && upgradeData && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
              <div className="bg-[#0f1420] border border-white/20 rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
                <h3 className="text-base font-semibold text-white mb-1">Optimierung anwenden?</h3>
                <p className="text-xs text-gray-400 mb-4">
                  Folgende Transaktionen werden automatisch im Portfolio gebucht.
                </p>
                {/* Sells: Schwache Positionen (nur ausgewählte) */}
                {upgradeData.replacementSuggestions.filter((r) => r.suggestions.length > 0 && !deselectedReplacements.has(r.weakTicker)).length > 0 && (
                  <div className="mb-3">
                    <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider mb-1.5">Verkäufe — Schwache Positionen</p>
                    <div className="space-y-1">
                      {upgradeData.replacementSuggestions.filter((r) => r.suggestions.length > 0 && !deselectedReplacements.has(r.weakTicker)).map((rep) => {
                        const priceCHF = holdings.find((h: any) => h.ticker === rep.weakTicker)?.currentPriceCHF;
                        const shares = priceCHF && priceCHF > 0 ? (rep.cashRequired / priceCHF).toFixed(2) : null;
                        return (
                          <div key={rep.weakTicker} className="flex items-center justify-between text-xs bg-white/[0.03] rounded px-3 py-2">
                            <div>
                              <span className="font-mono font-semibold text-red-300">{rep.weakTicker}</span>
                              {shares && <span className="text-gray-500 ml-2">{shares} Aktien à {priceCHF ? `CHF ${priceCHF.toFixed(2)}` : '–'}</span>}
                            </div>
                            <span className="text-red-400 font-semibold">↓ Verkauf {fmtChf(rep.cashRequired)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {/* Buys: Ersatz-Kandidaten + Neue Kandidaten — mit Skalierung wenn Cash-Constraint */}
                {(() => {
                  const activeReplSuggestions = upgradeData.replacementSuggestions.filter((r) => r.suggestions.length > 0 && !deselectedReplacements.has(r.weakTicker));
                  const activeAdditions = upgradeData.additionSuggestions.filter((c: any) => !deselectedAdditions.has(c.ticker));
                  const sellTotal = activeReplSuggestions.reduce((s, r) => s + r.cashRequired, 0);
                  const buyReplTotal = activeReplSuggestions.reduce((s, r) => s + r.cashRequired, 0);
                  const buyAddTotal = activeAdditions.reduce((s: number, c: any) => s + c.estimatedWeight * (totalValueCHF ?? 0), 0);
                  const totalBuys = buyReplTotal + buyAddTotal;
                  const availableBudget = (cashBalance ?? 0) + sellTotal;
                  const willScale = totalBuys > availableBudget + 0.01;
                  const scaleFactor = willScale ? availableBudget / totalBuys : 1;
                  return (
                    <>
                      {activeReplSuggestions.length > 0 && (
                        <div className="mb-3">
                          <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider mb-1.5">Käufe — Ersatz-Kandidaten</p>
                          <div className="space-y-1">
                            {activeReplSuggestions.map((rep) => {
                              const chosenTick = overrideReplacementTicker[rep.weakTicker] ?? rep.suggestions[0].ticker;
                              const scaledAmt = rep.cashRequired * scaleFactor;
                              return (
                                <div key={chosenTick} className="flex items-center justify-between text-xs bg-white/[0.03] rounded px-3 py-2">
                                  <span className="font-mono font-semibold text-emerald-300">{chosenTick}</span>
                                  <span className="text-emerald-400 font-semibold">
                                    ↑ Kauf {fmtChf(scaledAmt)}
                                    {willScale && <span className="text-gray-500 ml-1 line-through text-[10px]">{fmtChf(rep.cashRequired)}</span>}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {activeAdditions.length > 0 && (
                        <div className="mb-4">
                          <p className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider mb-1.5">Käufe — Neue Kandidaten</p>
                          <div className="space-y-1">
                            {activeAdditions.map((c: any) => {
                              const amtCHF = c.estimatedWeight * (totalValueCHF ?? 0);
                              const scaledAmt = amtCHF * scaleFactor;
                              return (
                                <div key={c.ticker} className="flex items-center justify-between text-xs bg-white/[0.03] rounded px-3 py-2">
                                  <span className="font-mono font-semibold text-indigo-300">{c.ticker}</span>
                                  <span className="text-indigo-400 font-semibold">
                                    ↑ Kauf {fmtChf(scaledAmt)}
                                    {willScale && <span className="text-gray-500 ml-1 line-through text-[10px]">{fmtChf(amtCHF)}</span>}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
                {/* Snapshot-Checkbox */}
                <div className="mb-4 space-y-3">
                  <label className="flex items-center gap-2.5 px-3 py-2.5 bg-white/[0.03] rounded cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={cloneFirst}
                      onChange={(e) => setCloneFirst(e.target.checked)}
                      className="w-4 h-4 accent-indigo-500 cursor-pointer"
                    />
                    <div>
                      <p className="text-xs text-gray-300 font-medium">Snapshot vor Umsetzung erstellen</p>
                      <p className="text-[10px] text-gray-500">Sichert den aktuellen Zustand als separates Portfolio — jederzeit wiederherstellbar</p>
                    </div>
                  </label>
                </div>
                {/* Cash-Effekt Zusammenfassung */}
                {(() => {
                  const activeReplSuggestions2 = upgradeData.replacementSuggestions.filter((r) => r.suggestions.length > 0 && !deselectedReplacements.has(r.weakTicker));
                  const activeAdditions2 = upgradeData.additionSuggestions.filter((c: any) => !deselectedAdditions.has(c.ticker));
                  const sellTotal = activeReplSuggestions2.reduce((s, r) => s + r.cashRequired, 0);
                  const buyReplTotal = activeReplSuggestions2.reduce((s, r) => s + r.cashRequired, 0);
                  const buyAddTotal = activeAdditions2.reduce((s: number, c: any) => s + c.estimatedWeight * (totalValueCHF ?? 0), 0);
                  const totalBuys = buyReplTotal + buyAddTotal;
                  const availableBudget = (cashBalance ?? 0) + sellTotal;
                  const willScale = totalBuys > availableBudget + 0.01;
                  const effectiveBuys = willScale ? availableBudget : totalBuys;
                  const netChange = sellTotal - effectiveBuys;
                  return (
                    <div className="mb-4 space-y-1.5">
                      <div className="px-3 py-2 bg-white/[0.03] rounded text-xs flex items-center justify-between">
                        <span className="text-gray-400">Verfügbares Budget (Cash + Verkäufe)</span>
                        <span className="text-gray-300 font-semibold">{fmtChf(availableBudget)}</span>
                      </div>
                      <div className="px-3 py-2 bg-white/[0.03] rounded text-xs flex items-center justify-between">
                        <span className="text-gray-400">Geplante Käufe{willScale ? ' (auf Budget begrenzt)' : ''}</span>
                        <span className={willScale ? 'text-amber-400 font-semibold' : 'text-gray-300 font-semibold'}>{fmtChf(effectiveBuys)}{willScale && <span className="text-gray-500 ml-1 line-through">{fmtChf(totalBuys)}</span>}</span>
                      </div>
                      {willScale && (
                        <div className="px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded text-xs flex items-center gap-2 text-amber-400">
                          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>Käufe werden auf verfügbares Cash begrenzt — Faktor {((availableBudget / totalBuys) * 100).toFixed(0)}%</span>
                        </div>
                      )}
                      <div className="px-3 py-2 bg-white/[0.03] rounded text-xs flex items-center justify-between">
                        <span className="text-gray-400">Cash-Effekt (netto)</span>
                        <span className={netChange >= 0 ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'}>
                          {netChange >= 0 ? '+' : ''}{fmtChf(netChange)}
                        </span>
                      </div>
                    </div>
                  );
                })()}
                {applyRecMut.error && (
                  <p className="text-red-400 text-xs mb-3">{(applyRecMut.error as any)?.message}</p>
                )}
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setShowRecommendDialog(false)}
                    className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                  >Abbrechen</button>
                  <button
                    onClick={() => {
                      const activeRepl = upgradeData.replacementSuggestions.filter((r) => r.suggestions.length > 0 && !deselectedReplacements.has(r.weakTicker));
                      const activeAdd = upgradeData.additionSuggestions.filter((c: any) => !deselectedAdditions.has(c.ticker));
                      const sells = activeRepl.map((rep) => ({
                          ticker: rep.weakTicker,
                          companyName: rep.weakCompanyName,
                          totalCHF: rep.cashRequired,
                          priceCHF: holdings.find((h: any) => h.ticker === rep.weakTicker)?.currentPriceCHF,
                          shares: (() => {
                            const p = holdings.find((h: any) => h.ticker === rep.weakTicker)?.currentPriceCHF;
                            return p && p > 0 ? rep.cashRequired / p : undefined;
                          })(),
                        }));
                      const buys = [
                        ...activeRepl.map((rep) => {
                            const chosenTick = overrideReplacementTicker[rep.weakTicker] ?? rep.suggestions[0].ticker;
                            const chosenSug = rep.suggestions.find(s => s.ticker === chosenTick) ?? rep.suggestions[0];
                            return {
                              ticker: chosenTick,
                              companyName: chosenSug.companyName,
                              totalCHF: rep.cashRequired,
                              priceCHF: (chosenSug as any).currentPriceCHF ?? undefined,
                              shares: (() => {
                                const p = (chosenSug as any).currentPriceCHF;
                                return p && p > 0 ? rep.cashRequired / p : undefined;
                              })(),
                            };
                          }),
                        ...activeAdd.map((c: any) => ({
                          ticker: c.ticker,
                          companyName: c.companyName,
                          totalCHF: c.estimatedWeight * (totalValueCHF ?? 0),
                          priceCHF: c.currentPriceCHF ?? undefined,
                          shares: (() => {
                            const p = c.currentPriceCHF;
                            const amt = c.estimatedWeight * (totalValueCHF ?? 0);
                            return p && p > 0 ? amt / p : undefined;
                          })(),
                        })),
                      ];
                      applyRecMut.mutate({ portfolioId, sells, buys, cloneFirst });
                    }}
                    disabled={applyRecMut.isPending}
                    className="px-4 py-2 text-sm bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-500 disabled:opacity-50 transition-colors flex items-center gap-2"
                  >
                    {applyRecMut.isPending ? (
                      <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Wird gebucht…</>
                    ) : (
                      <><Zap className="w-4 h-4" />Jetzt anwenden</>
                    )}
                  </button>
                </div>
              </div>
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
                        .map(s => ({
                          ticker: s.ticker,
                          currentWeight: s.cur,
                          targetWeight: s.opt,
                          currentPriceCHF: (holdings as any[]).find(h => h.ticker === s.ticker)?.currentPriceCHF ?? undefined,
                        }));
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
              {/* P-ALIGN: Hinweis für frisch erstellte KI-Portfolios */}
              {isFreshDemoPortfolio && (
                <div className="flex items-start gap-2 bg-[#00CFC1]/5 border border-[#00CFC1]/20 rounded-lg px-3 py-2.5 mb-4">
                  <CheckCircle className="w-3.5 h-3.5 text-[#00CFC1] flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-[#00CFC1]/90">
                    Dieses Portfolio wurde kürzlich durch den KI-Builder erstellt. Der Optimizer verwendet eine andere Gewichtungslogik (Mean-Variance). Die angezeigten Umschichtungen sind optional — wir empfehlen, sie erst nach einigen Wochen Laufzeit zu prüfen.
                  </p>
                </div>
              )}
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
                        <Scatter name="Frontier" data={frontierData} fill="#6366f1" opacity={0.5} />
                        {optimalPoint && (
                          <Scatter
                            name="Optimum"
                            data={[{ x: optimalPoint.x, y: optimalPoint.y, label: 'Opt.' }]}
                            fill="#00CFC1"
                            shape={(props: any) => {
                              const { cx, cy } = props;
                              return (
                                <g>
                                  <circle cx={cx} cy={cy} r={8} fill="#00CFC1" stroke="#fff" strokeWidth={2} />
                                  <text x={cx} y={cy - 12} textAnchor="middle" fill="#00CFC1" fontSize={9} fontWeight="bold">Opt.</text>
                                </g>
                              );
                            }}
                          />
                        )}
                        {currentPoint && (
                          <Scatter
                            name="Aktuell"
                            data={[{ x: currentPoint.x, y: currentPoint.y, label: 'Aktuell' }]}
                            fill="#f59e0b"
                            shape={(props: any) => {
                              const { cx, cy } = props;
                              return (
                                <g>
                                  <circle cx={cx} cy={cy} r={7} fill="#f59e0b" stroke="#fff" strokeWidth={2} />
                                  <text x={cx} y={cy - 11} textAnchor="middle" fill="#f59e0b" fontSize={9} fontWeight="bold">Aktuell</text>
                                </g>
                              );
                            }}
                          />
                        )}
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

      {/* ─── Optimierungs-Verlauf ─── */}
      <OptimierungsVerlauf portfolioId={portfolioId} />
    </div>
  );
}

function OptimierungsVerlauf({ portfolioId }: { portfolioId: number }) {
  const [open, setOpen] = useState(false);
  const { data: history, isLoading } = trpc.portfolioTransactions.getOptimizationHistory.useQuery(
    { portfolioId },
    { enabled: portfolioId > 0 && open, staleTime: 60_000 }
  );
  const fmtDate = (d: Date | string) => {
    const dt = new Date(d);
    return dt.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };
  const fmtChfLocal = (v: number) => `CHF ${Math.round(v).toLocaleString('de-CH')}`;
  return (
    <div className="bg-[#0f1420] border border-white/10 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-white hover:bg-white/5 transition-colors"
      >
        <span className="flex items-center gap-2">
          <CheckSquare className="w-4 h-4 text-[#00CFC1]" />
          Optimierungs-Verlauf
          {history && history.length > 0 && (
            <span className="text-xs font-normal text-gray-400">({history.length} Buchung{history.length !== 1 ? 'en' : ''})</span>
          )}
        </span>
        <span className="text-gray-500 text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="border-t border-white/10 px-4 py-3">
          {isLoading ? (
            <p className="text-xs text-gray-500 py-2">Lade Verlauf…</p>
          ) : !history || history.length === 0 ? (
            <p className="text-xs text-gray-500 py-2">Noch keine Optimierungen durchgeführt.</p>
          ) : (
            <div className="space-y-2">
              {history.map((batch) => (
                <div key={batch.batchKey} className="flex flex-wrap items-start gap-x-4 gap-y-1 py-2 border-b border-white/5 last:border-0">
                  <span className="text-xs text-gray-400 w-36 flex-shrink-0">{fmtDate(batch.executedAt)}</span>
                  <span className="text-xs text-white font-medium">
                    {batch.transactionCount} Tx
                    {batch.sellCount > 0 && <span className="text-red-400 ml-1">↓{batch.sellCount} Verk.</span>}
                    {batch.buyCount > 0 && <span className="text-emerald-400 ml-1">↑{batch.buyCount} Käufe</span>}
                  </span>
                  <span className={`text-xs font-mono ${
                    batch.netCashChangeCHF >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {batch.netCashChangeCHF >= 0 ? '+' : ''}{fmtChfLocal(batch.netCashChangeCHF)} Cash
                  </span>
                  <span className="text-[11px] text-gray-600 flex-1 min-w-0 truncate">
                    {(batch.tickers as string[]).filter(Boolean).join(', ')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
