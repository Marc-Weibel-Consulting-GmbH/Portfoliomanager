import { useMemo, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceDot,
} from "recharts";
import { ArrowUpRight, ArrowDownRight, Target, AlertTriangle, CheckCircle, Info } from "lucide-react";

// ─── Diversification Rule Check ───────────────────────────────────────────────
interface DivRule {
  id: string;
  label: string;
  description: string;
  passed: boolean;
  detail: string;
}

function checkDiversificationRules(holdings: any[], totalValueCHF: number): DivRule[] {
  const nonCash = holdings.filter((h: any) => h.ticker && h.ticker !== "CASH");
  const titleCount = nonCash.length;

  // Rule 1: Min 15 Titel
  const rule1: DivRule = {
    id: "min_titles",
    label: "Mindestens 15 Titel",
    description: "Portfolio soll mindestens 15 verschiedene Positionen enthalten.",
    passed: titleCount >= 15,
    detail: `${titleCount} Titel vorhanden${titleCount < 15 ? ` (${15 - titleCount} fehlen)` : ""}`,
  };

  // Rule 2: Max 10% pro Position
  const overweighted = nonCash.filter((h: any) => parseFloat(h.weight || "0") > 10);
  const rule2: DivRule = {
    id: "max_weight",
    label: "Max. 10% pro Position",
    description: "Keine einzelne Position soll mehr als 10% des Portfolios ausmachen.",
    passed: overweighted.length === 0,
    detail: overweighted.length === 0
      ? "Alle Positionen ≤ 10%"
      : `${overweighted.length} Position(en) über 10%: ${overweighted.map((h: any) => `${h.ticker} (${parseFloat(h.weight || "0").toFixed(1)}%)`).join(", ")}`,
  };

  // Rule 3: Min 1% pro Position
  const underweighted = nonCash.filter((h: any) => parseFloat(h.weight || "0") < 1 && parseFloat(h.weight || "0") > 0);
  const rule3: DivRule = {
    id: "min_weight",
    label: "Min. 1% pro Position",
    description: "Keine Position soll weniger als 1% des Portfolios ausmachen (Kleinstpositionen vermeiden).",
    passed: underweighted.length === 0,
    detail: underweighted.length === 0
      ? "Alle Positionen ≥ 1%"
      : `${underweighted.length} Position(en) unter 1%: ${underweighted.map((h: any) => `${h.ticker} (${parseFloat(h.weight || "0").toFixed(1)}%)`).join(", ")}`,
  };

  // Rule 4: Min CHF 3'000 pro Position
  const tooSmall = nonCash.filter((h: any) => {
    const posValue = (parseFloat(h.weight || "0") / 100) * totalValueCHF;
    return posValue < 3000 && posValue > 0;
  });
  const rule4: DivRule = {
    id: "min_chf",
    label: "Min. CHF 3'000 pro Position",
    description: "Jede Position soll mindestens CHF 3'000 wert sein (Transaktionskosten-Effizienz).",
    passed: tooSmall.length === 0,
    detail: tooSmall.length === 0
      ? "Alle Positionen ≥ CHF 3'000"
      : `${tooSmall.length} Position(en) unter CHF 3'000: ${tooSmall.map((h: any) => {
          const v = (parseFloat(h.weight || "0") / 100) * totalValueCHF;
          return `${h.ticker} (CHF ${v.toFixed(0)})`;
        }).join(", ")}`,
  };

  return [rule1, rule2, rule3, rule4];
}

// ─── Optimieren-Tab ────────────────────────────────────────────────────────────
export default function OptimierenTab({
  portfolioId,
  holdings,
  totalValueCHF,
}: {
  portfolioId: number;
  holdings: any[];
  totalValueCHF?: number;
}) {
  const [showDivRules, setShowDivRules] = useState(true);

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
      method: "max_sharpe",
      // R-34c: Portfoliowert für die Mindest-Positionsgrösse CHF 3'000 (Server-Post-Filter)
      ...(totalValueCHF && totalValueCHF > 0 ? { portfolioValue: totalValueCHF } : {}),
    },
    { enabled: portfolioId > 0 && tickers.length >= 2, staleTime: 5 * 60 * 1000 }
  );

  const frontierData = useMemo(() => {
    if (!result?.efficientFrontier) return [];
    return result.efficientFrontier.map((p: any) => ({
      x: parseFloat((p.volatility * 100).toFixed(2)),
      y: parseFloat((p.expectedReturn * 100).toFixed(2)),
      sharpe: parseFloat(p.sharpe.toFixed(2)),
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
    () => checkDiversificationRules(holdings, totalValueCHF || 0),
    [holdings, totalValueCHF]
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
      {/* ─── R-34: Warnung bei < 15 Titeln (der Optimizer kann keine Titel ergänzen) ─── */}
      {tickers.length < 15 && (
        <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/40 rounded-lg px-4 py-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-200">
            Für eine robuste Optimierung empfehlen wir mindestens 15 Titel — Ihr Portfolio hat{' '}
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
          {/* KPIs des optimalen Portfolios */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-0 border border-white/10 rounded-lg overflow-hidden">
            {[
              { label: "Erw. Rendite (p.a.)", value: `${(result.optimalPortfolio.expectedReturn * 100).toFixed(1)}%`, tone: "text-[#00CFC1]" },
              { label: "Volatilität (p.a.)", value: `${(result.optimalPortfolio.volatility * 100).toFixed(1)}%`, tone: "text-white" },
              { label: "Sharpe Ratio", value: result.optimalPortfolio.sharpe.toFixed(2), tone: result.optimalPortfolio.sharpe >= 1 ? "text-[#00CFC1]" : "text-amber-400" },
              { label: "Methode", value: "Max. Sharpe", tone: "text-white" },
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
                                <div className="bg-[#1a1f2e] border border-[#00CFC1]/40 rounded p-2 text-xs text-white">
                                  <p>Rendite: {d.y}%</p>
                                  <p>Volatilität: {d.x}%</p>
                                  {d.sharpe !== undefined && <p>Sharpe: {d.sharpe}</p>}
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

          <p className="text-xs text-gray-600 text-center">
            ⚠️ Basierend auf historischen Renditen (Modern Portfolio Theory). Keine Anlageberatung.
          </p>
        </>
      )}
    </div>
  );
}
