import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceDot,
} from "recharts";
import { ArrowUpRight, ArrowDownRight, Target } from "lucide-react";

// Optimieren-Tab (Mockup S.06): KI-Re-Allocation-Vorschläge + Effizienzgrenze.
// Nutzt den echten Endpoint analytics.optimize (Modern Portfolio Theory) und
// vergleicht die optimale Gewichtung mit der aktuellen Portfolio-Gewichtung.
export default function OptimierenTab({
  portfolioId,
  holdings,
}: {
  portfolioId: number;
  holdings: any[];
}) {
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
    { tickers, lookbackDays: 252, riskFreeRate: 0.015, method: "max_sharpe" },
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

  // KI-Vorschläge: grösste Abweichungen optimal vs. aktuell
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
      .filter((s) => Math.abs(s.diff) >= 0.02) // ab 2 Prozentpunkten relevant
      .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
      .slice(0, 6);
  }, [result, currentWeights]);

  if (tickers.length < 2) {
    return (
      <div className="bg-[#0f1420] border border-white/10 rounded-lg p-10 text-center">
        <Target className="h-10 w-10 text-gray-600 mx-auto mb-3" />
        <p className="text-gray-400 text-sm">Mindestens 2 Positionen erforderlich, um eine Optimierung zu berechnen.</p>
      </div>
    );
  }

  if (isFetching) {
    return (
      <div className="bg-[#0f1420] border border-white/10 rounded-lg p-10 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#00CFC1] border-t-transparent rounded-full animate-spin" />
        <span className="ml-3 text-sm text-gray-400">Effizienzgrenze wird berechnet…</span>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="bg-red-950/20 border border-red-800/40 rounded-lg p-6 text-center">
        <p className="text-red-400 text-sm">{(error as any)?.message || "Optimierung nicht verfügbar."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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

      <div className="grid lg:grid-cols-2 gap-6">
        {/* KI-Vorschläge (Re-Allocation) */}
        <div className="bg-[#0f1420] border border-white/10 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-white mb-1">KI-Empfehlungen</h3>
          <p className="text-xs text-gray-500 mb-4">Re-Allocation für maximale risikoadjustierte Rendite</p>
          {suggestions.length === 0 ? (
            <p className="text-sm text-gray-400">Dein Portfolio liegt bereits nahe am Optimum — keine wesentliche Umschichtung nötig.</p>
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
          <h3 className="text-sm font-semibold text-white mb-1">Effizienzgrenze</h3>
          <p className="text-xs text-gray-500 mb-3">Rendite vs. Risiko · Aktuell vs. Optimum</p>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="x" name="Volatilität" unit="%" tick={{ fontSize: 10, fill: "#9ca3af" }} />
                <YAxis dataKey="y" name="Rendite" unit="%" tick={{ fontSize: 10, fill: "#9ca3af" }} width={36} />
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
                {optimalPoint && <ReferenceDot x={optimalPoint.x} y={optimalPoint.y} r={7} fill="#00CFC1" stroke="#fff" strokeWidth={2} />}
                {currentPoint && <ReferenceDot x={currentPoint.x} y={currentPoint.y} r={6} fill="#f59e0b" stroke="#fff" strokeWidth={2} />}
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-4 justify-center mt-2 text-xs text-gray-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#00CFC1] inline-block" /> Optimum</span>
            {currentPoint && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Aktuell</span>}
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-600 text-center">
        ⚠️ Basierend auf historischen Renditen (Modern Portfolio Theory). Keine Anlageberatung.
      </p>
    </div>
  );
}
