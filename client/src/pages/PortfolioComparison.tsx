import { useState, useEffect } from "react";
import { useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { ArrowLeft, BarChart3, PieChart, Camera, ArrowUpRight, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const COLOR_A = "#00CFC1";
const COLOR_B = "#a78bfa";

function MetricCard({ label, valueA, valueB, nameA, nameB, format = "num", higherIsBetter = true }: {
  label: string; valueA: number; valueB: number; nameA: string; nameB: string;
  format?: "pct" | "num" | "chf"; higherIsBetter?: boolean;
}) {
  const fmt = (v: number) => {
    if (format === "pct") return `${v.toFixed(2)}%`;
    if (format === "chf") return `CHF ${v.toLocaleString("de-CH", { maximumFractionDigits: 0 })}`;
    return v.toFixed(2);
  };
  const aWins = higherIsBetter ? valueA > valueB : valueA < valueB;
  const bWins = higherIsBetter ? valueB > valueA : valueB < valueA;
  return (
    <div className="bg-[#0f1420] border border-white/10 rounded-lg p-3">
      <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">{label}</p>
      <div className="flex justify-between items-end gap-2">
        <div className="flex-1">
          <p className="text-[10px] text-gray-500 truncate mb-0.5">{nameA}</p>
          <p className={`text-sm font-bold font-mono ${aWins ? "text-[#00CFC1]" : "text-gray-300"}`}>
            {fmt(valueA)}{aWins && <span className="ml-1 text-[10px]">▲</span>}
          </p>
        </div>
        <div className="text-gray-600 text-xs shrink-0">vs</div>
        <div className="flex-1 text-right">
          <p className="text-[10px] text-gray-500 truncate mb-0.5">{nameB}</p>
          <p className={`text-sm font-bold font-mono ${bWins ? "text-[#a78bfa]" : "text-gray-300"}`}>
            {fmt(valueB)}{bWins && <span className="ml-1 text-[10px]">▲</span>}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function PortfolioComparison() {
  const [selectedA, setSelectedA] = useState<number | null>(null);
  const [selectedB, setSelectedB] = useState<number | null>(null);
  const search = useSearch();

  useEffect(() => {
    const params = new URLSearchParams(search);
    const a = params.get("a");
    const b = params.get("b");
    if (a && b) {
      const idA = parseInt(a), idB = parseInt(b);
      if (!isNaN(idA) && !isNaN(idB)) { setSelectedA(idA); setSelectedB(idB); }
    }
  }, [search]);

  const { data: portfolios = [], isLoading } = trpc.portfolios.list.useQuery();

  const canCompare = selectedA !== null && selectedB !== null && selectedA !== selectedB;
  const { data: cmp, isLoading: cmpLoading } = trpc.analytics.comparePortfolios.useQuery(
    { portfolioIdA: selectedA!, portfolioIdB: selectedB! },
    { enabled: canCompare }
  );

  const radarData = cmp ? [
    { metric: "Sharpe",    A: Math.min(cmp.a.sharpeRatio * 50, 100),              B: Math.min(cmp.b.sharpeRatio * 50, 100) },
    { metric: "Rendite",   A: Math.min(cmp.a.expectedReturn * 5, 100),            B: Math.min(cmp.b.expectedReturn * 5, 100) },
    { metric: "Dividende", A: Math.min(cmp.a.avgDividendYield * 20, 100),         B: Math.min(cmp.b.avgDividendYield * 20, 100) },
    { metric: "Diversif.", A: Math.min(cmp.a.numberOfPositions * 5, 100),         B: Math.min(cmp.b.numberOfPositions * 5, 100) },
    { metric: "Stabilität",A: Math.max(0, 100 - cmp.a.volatility * 8),           B: Math.max(0, 100 - cmp.b.volatility * 8) },
  ] : [];

  const allSectors = cmp ? Array.from(new Set([
    ...cmp.a.sectors.map((s: any) => s.name),
    ...cmp.b.sectors.map((s: any) => s.name),
  ])) : [];
  const sectorChartData = allSectors.map(sector => ({
    sector: sector.length > 14 ? sector.slice(0, 14) + "…" : sector,
    [cmp?.a.name ?? "A"]: cmp?.a.sectors.find((s: any) => s.name === sector)?.weight ?? 0,
    [cmp?.b.name ?? "B"]: cmp?.b.sectors.find((s: any) => s.name === sector)?.weight ?? 0,
  }));

  return (
    // UX2-6: in die App-Navigation eingebettet (vorher eigene Vollbild-Seite
    // ohne Sidebar — Kunde «verlor» die Anwendung beim Vergleich)
    <DashboardLayout>
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => window.history.back()} className="text-gray-400 hover:text-white transition-colors flex items-center gap-1.5 text-sm">
            <ArrowLeft className="w-4 h-4" />Zurück
          </button>
          <div className="h-4 w-px bg-white/10" />
          <div>
            <h1 className="text-xl font-bold text-white">Portfolio-Vergleich</h1>
            <p className="text-xs text-gray-500">Zwei Portfolios direkt vergleichen — Metriken, Sektoren, Positionen</p>
          </div>
        </div>

        {/* Portfolio Selection */}
        {isLoading ? (
          <div className="text-center text-gray-500 py-12">Lade Portfolios…</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {[{ label: "Portfolio A", color: COLOR_A, selected: selectedA, setSelected: setSelectedA, other: selectedB },
              { label: "Portfolio B", color: COLOR_B, selected: selectedB, setSelected: setSelectedB, other: selectedA }
            ].map(({ label, color, selected, setSelected, other }) => (
              <div key={label}>
                <p className="text-xs uppercase tracking-wider mb-2 font-medium" style={{ color }}>{label}</p>
                <div className="space-y-1.5">
                  {(portfolios as any[]).map((p: any) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        if (selected === p.id) { setSelected(null); return; }
                        if (other === p.id) { toast.error("Bereits als anderes Portfolio ausgewählt"); return; }
                        setSelected(p.id);
                      }}
                      className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all flex items-center justify-between gap-2 ${
                        selected === p.id ? "border-current bg-current/10" : "border-white/10 bg-[#0f1420] hover:border-white/20"
                      }`}
                      style={selected === p.id ? { borderColor: color, backgroundColor: `${color}15` } : {}}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium text-white truncate">{p.name}</span>
                        {p.isSnapshot === 1 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">Snapshot</span>
                        )}
                      </div>
                      <span className={`text-[10px] shrink-0 ${p.isLive === 1 ? "text-emerald-400" : "text-gray-500"}`}>
                        {p.isLive === 1 ? "Live" : "Demo"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Comparison Results */}
        {canCompare && (
          cmpLoading ? (
            <div className="text-center text-gray-500 py-12">Vergleich wird geladen…</div>
          ) : cmp ? (
            <div className="space-y-6">
              {/* Snapshot note */}
              {(cmp.a.isSnapshot === 1 || cmp.b.isSnapshot === 1) && (
                <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3">
                  <Camera className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                  <div className="text-xs text-amber-300 space-y-0.5">
                    {cmp.a.isSnapshot === 1 && <p><strong>{cmp.a.name}</strong> ist ein Snapshot{cmp.a.snapshotNote ? `: ${cmp.a.snapshotNote}` : ""}.</p>}
                    {cmp.b.isSnapshot === 1 && <p><strong>{cmp.b.name}</strong> ist ein Snapshot{cmp.b.snapshotNote ? `: ${cmp.b.snapshotNote}` : ""}.</p>}
                  </div>
                </div>
              )}

              {/* Key Metrics */}
              <div>
                <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-[#00CFC1]" />Kennzahlen-Vergleich
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <MetricCard label="Sharpe Ratio"     valueA={cmp.a.sharpeRatio}       valueB={cmp.b.sharpeRatio}       nameA={cmp.a.name} nameB={cmp.b.name} />
                  <MetricCard label="Erw. Rendite p.a." valueA={cmp.a.expectedReturn}   valueB={cmp.b.expectedReturn}    nameA={cmp.a.name} nameB={cmp.b.name} format="pct" />
                  <MetricCard label="Volatilität p.a."  valueA={cmp.a.volatility}       valueB={cmp.b.volatility}        nameA={cmp.a.name} nameB={cmp.b.name} format="pct" higherIsBetter={false} />
                  <MetricCard label="Ø Dividende"       valueA={cmp.a.avgDividendYield} valueB={cmp.b.avgDividendYield}  nameA={cmp.a.name} nameB={cmp.b.name} format="pct" />
                  <MetricCard label="Positionen"        valueA={cmp.a.numberOfPositions} valueB={cmp.b.numberOfPositions} nameA={cmp.a.name} nameB={cmp.b.name} />
                  <MetricCard label="Investiert"        valueA={cmp.a.investmentAmount} valueB={cmp.b.investmentAmount}  nameA={cmp.a.name} nameB={cmp.b.name} format="chf" />
                </div>
              </div>

              {/* Radar Chart */}
              <div className="bg-[#0f1420] border border-white/10 rounded-lg p-4">
                <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#00CFC1]" />Profil-Vergleich
                </h2>
                <div className="flex flex-col md:flex-row items-center gap-4">
                  <ResponsiveContainer width="100%" height={260}>
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="#ffffff15" />
                      <PolarAngleAxis dataKey="metric" tick={{ fill: "#9ca3af", fontSize: 11 }} />
                      <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                      <Radar name={cmp.a.name} dataKey="A" stroke={COLOR_A} fill={COLOR_A} fillOpacity={0.15} strokeWidth={2} />
                      <Radar name={cmp.b.name} dataKey="B" stroke={COLOR_B} fill={COLOR_B} fillOpacity={0.15} strokeWidth={2} />
                      <Legend wrapperStyle={{ fontSize: 11, color: "#9ca3af" }} />
                      <Tooltip contentStyle={{ backgroundColor: "#0f1420", border: "1px solid #ffffff20", borderRadius: 8, fontSize: 11 }} />
                    </RadarChart>
                  </ResponsiveContainer>
                  <div className="text-xs text-gray-500 space-y-1 shrink-0 md:w-40">
                    <p className="text-gray-400 font-medium mb-2">Score-Basis (0–100)</p>
                    <p>Sharpe ×50</p><p>Rendite ×5</p><p>Dividende ×20</p>
                    <p>Diversif. ×5 Pos.</p><p>Stabilität: 100−Vol×8</p>
                  </div>
                </div>
              </div>

              {/* Sector Bar Chart */}
              {sectorChartData.length > 0 && (
                <div className="bg-[#0f1420] border border-white/10 rounded-lg p-4">
                  <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-[#00CFC1]" />Sektor-Allokation
                  </h2>
                  <ResponsiveContainer width="100%" height={Math.max(220, sectorChartData.length * 30)}>
                    <BarChart data={sectorChartData} layout="vertical" margin={{ left: 8, right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" horizontal={false} />
                      <XAxis type="number" tick={{ fill: "#9ca3af", fontSize: 10 }} tickFormatter={(v) => `${Number(v).toFixed(0)}%`} />
                      <YAxis type="category" dataKey="sector" tick={{ fill: "#9ca3af", fontSize: 10 }} width={100} />
                      <Tooltip contentStyle={{ backgroundColor: "#0f1420", border: "1px solid #ffffff20", borderRadius: 8, fontSize: 11 }} formatter={(v: any) => `${Number(v).toFixed(1)}%`} />
                      <Legend wrapperStyle={{ fontSize: 11, color: "#9ca3af" }} />
                      <Bar dataKey={cmp.a.name} fill={COLOR_A} radius={[0, 3, 3, 0]} maxBarSize={14} />
                      <Bar dataKey={cmp.b.name} fill={COLOR_B} radius={[0, 3, 3, 0]} maxBarSize={14} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Position Overlap */}
              {(() => {
                const tickersA = new Set(cmp.a.stocks.map((s: any) => s.ticker));
                const tickersB = new Set(cmp.b.stocks.map((s: any) => s.ticker));
                const overlap = cmp.a.stocks.filter((s: any) => tickersB.has(s.ticker));
                const onlyA = cmp.a.stocks.filter((s: any) => !tickersB.has(s.ticker));
                const onlyB = cmp.b.stocks.filter((s: any) => !tickersA.has(s.ticker));
                return (
                  <div className="bg-[#0f1420] border border-white/10 rounded-lg p-4">
                    <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                      <ArrowUpRight className="w-4 h-4 text-[#00CFC1]" />Positionen-Überschneidung
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                      <div>
                        <p className="font-medium mb-2" style={{ color: COLOR_A }}>Nur in {cmp.a.name} ({onlyA.length})</p>
                        <div className="space-y-1">
                          {onlyA.map((s: any) => (
                            <div key={s.ticker} className="flex justify-between text-gray-400">
                              <span className="font-mono">{s.ticker}</span><span>{s.weight.toFixed(1)}%</span>
                            </div>
                          ))}
                          {onlyA.length === 0 && <p className="text-gray-600">—</p>}
                        </div>
                      </div>
                      <div>
                        <p className="text-gray-400 font-medium mb-2 text-center">Gemeinsam ({overlap.length})</p>
                        <div className="space-y-1">
                          {overlap.map((s: any) => {
                            const bStock = cmp.b.stocks.find((x: any) => x.ticker === s.ticker);
                            return (
                              <div key={s.ticker} className="flex justify-between gap-1 text-gray-300">
                                <span className="font-mono">{s.ticker}</span>
                                <span style={{ color: COLOR_A }}>{s.weight.toFixed(1)}%</span>
                                <span style={{ color: COLOR_B }}>{bStock?.weight.toFixed(1) ?? "—"}%</span>
                              </div>
                            );
                          })}
                          {overlap.length === 0 && <p className="text-gray-600 text-center">Keine Überschneidung</p>}
                        </div>
                      </div>
                      <div>
                        <p className="font-medium mb-2 text-right" style={{ color: COLOR_B }}>Nur in {cmp.b.name} ({onlyB.length})</p>
                        <div className="space-y-1">
                          {onlyB.map((s: any) => (
                            <div key={s.ticker} className="flex justify-between text-gray-400">
                              <span className="font-mono">{s.ticker}</span><span>{s.weight.toFixed(1)}%</span>
                            </div>
                          ))}
                          {onlyB.length === 0 && <p className="text-gray-600">—</p>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : null
        )}

        {!canCompare && !isLoading && (
          <div className="text-center text-gray-500 py-16 border border-white/10 rounded-lg bg-[#0f1420]">
            <BarChart3 className="w-8 h-8 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Wählen Sie je ein Portfolio A und B aus, um den Vergleich zu starten.</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
