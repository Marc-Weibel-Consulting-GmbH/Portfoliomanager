/**
 * Portfolio Quality History Charts
 *
 * Chart 1: Time-series LineChart showing Ø Sharpe, Ø PEG, Ø Dividende, Ø Beta
 *          with vertical ReferenceLine markers at optimization event dates.
 *
 * Chart 2: Quadrant ScatterChart (X=PEG, Y=Sharpe) showing portfolio trajectory
 *          over time with color gradient (old=dark → new=bright) and bubble size=dividendYield.
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ReferenceLine,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  ZAxis,
  Legend,
} from "recharts";
import { TrendingUp, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type Period = "1M" | "3M" | "6M" | "1Y" | "MAX";

interface Props {
  portfolioId: number;
}

const PERIOD_LABELS: Record<Period, string> = {
  "1M": "1 Monat",
  "3M": "3 Monate",
  "6M": "6 Monate",
  "1Y": "1 Jahr",
  MAX: "Max",
};

// Color gradient for scatter points: older = more transparent/dark, newer = bright
function getPointColor(index: number, total: number): string {
  const ratio = total <= 1 ? 1 : index / (total - 1);
  // Interpolate from dark teal (old) to bright teal (new)
  const r = Math.round(0 + ratio * 0);
  const g = Math.round(100 + ratio * 107);
  const b = Math.round(100 + ratio * 93);
  const a = 0.3 + ratio * 0.7;
  return `rgba(${r},${g},${b},${a})`;
}

export function PortfolioQualityHistory({ portfolioId }: Props) {
  const [period, setPeriod] = useState<Period>("1Y");

  const { data, isLoading, error } = trpc.dashboard.getPortfolioMetricsHistory.useQuery(
    { portfolioId, period },
    { staleTime: 5 * 60 * 1000 }
  );

  const snapshots = data?.snapshots ?? [];
  const optimizationEvents = data?.optimizationEvents ?? [];

  // Format date for X-axis tick
  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (period === "1M") return d.toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit" });
    if (period === "3M") return d.toLocaleDateString("de-CH", { day: "2-digit", month: "short" });
    return d.toLocaleDateString("de-CH", { month: "short", year: "2-digit" });
  };

  // Prepare scatter data with color index
  const scatterData = useMemo(() => {
    return snapshots
      .filter((s) => s.avgPEG !== null && s.avgSharpe !== null)
      .map((s, i, arr) => ({
        x: s.avgPEG as number,
        y: s.avgSharpe as number,
        z: Math.max(0.5, (s.avgDividendYield ?? 0) * 10), // bubble size
        date: s.date,
        color: getPointColor(i, arr.length),
        isLatest: i === arr.length - 1,
        avgDividendYield: s.avgDividendYield,
        avgBeta: s.avgBeta,
      }));
  }, [snapshots]);

  // Optimization event dates as a Set for quick lookup
  const optEventDates = useMemo(() => new Set(optimizationEvents.map((e) => e.date)), [optimizationEvents]);

  const hasData = snapshots.length > 0;

  // Determine Y-axis domains for dual-axis chart
  const sharpeValues = snapshots.map((s) => s.avgSharpe).filter((v): v is number => v !== null);
  const betaValues = snapshots.map((s) => s.avgBeta).filter((v): v is number => v !== null);
  const pegValues = snapshots.map((s) => s.avgPEG).filter((v): v is number => v !== null);

  const sharpeMin = sharpeValues.length ? Math.min(...sharpeValues) : -1;
  const sharpeMax = sharpeValues.length ? Math.max(...sharpeValues) : 3;
  const pegMax = pegValues.length ? Math.max(...pegValues) : 5;

  return (
    <div className="mt-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-[#00CFC1]" />
          <h3 className="text-sm font-semibold text-white">Portfolio-Qualitäts-History</h3>
          <Tooltip>
            <TooltipTrigger>
              <Info className="h-3.5 w-3.5 text-gray-500 cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs">
              Zeigt die historische Entwicklung der gewichteten Durchschnittswerte für Sharpe-Ratio,
              PEG-Ratio, Dividendenrendite und Beta. Vertikale Linien markieren Optimierungs-Events.
              Das Quadrant-Chart zeigt die Trajektorie des Portfolios im Risiko-Rendite-Raum.
            </TooltipContent>
          </Tooltip>
        </div>
        {/* Period selector */}
        <div className="flex gap-1">
          {(["1M", "3M", "6M", "1Y", "MAX"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-2.5 py-1 text-xs rounded transition-colors ${
                period === p
                  ? "bg-[#00CFC1]/20 text-[#00CFC1] font-medium"
                  : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
          <div className="animate-pulse">Lade Metriken-History...</div>
        </div>
      )}

      {error && (
        <div className="text-xs text-red-400 bg-red-400/10 rounded p-3">
          Fehler beim Laden der Metriken-History: {error.message}
        </div>
      )}

      {!isLoading && !error && !hasData && (
        <div className="flex flex-col items-center justify-center h-32 text-gray-400 text-sm gap-2">
          <p>Noch keine Metriken-Snapshots vorhanden.</p>
          <p className="text-xs text-gray-500">
            Starten Sie den Backfill über das Admin-Dashboard → "Portfolio-Metriken Backfill (1 Jahr)".
          </p>
        </div>
      )}

      {!isLoading && !error && hasData && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* ─── Chart 1: Time-series ─── */}
          <div className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border border-[#00CFC1]/20 rounded-lg p-4">
            <h4 className="text-xs font-medium text-gray-300 mb-3">
              Metriken-Verlauf
              {optimizationEvents.length > 0 && (
                <span className="ml-2 text-[#00CFC1]/70">
                  · {optimizationEvents.length} Optimierungs-Event{optimizationEvents.length > 1 ? "s" : ""}
                </span>
              )}
            </h4>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={snapshots} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  tick={{ fontSize: 9, fill: "#6b7280" }}
                  interval="preserveStartEnd"
                />
                {/* Left Y-axis: Sharpe & Beta */}
                <YAxis
                  yAxisId="left"
                  domain={[Math.floor(sharpeMin - 0.5), Math.ceil(sharpeMax + 0.5)]}
                  tick={{ fontSize: 9, fill: "#6b7280" }}
                  width={32}
                />
                {/* Right Y-axis: PEG */}
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[0, Math.ceil(pegMax + 0.5)]}
                  tick={{ fontSize: 9, fill: "#6b7280" }}
                  width={28}
                />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: "#1a1f2e",
                    border: "1px solid rgba(0,207,193,0.3)",
                    borderRadius: "6px",
                    fontSize: "11px",
                    color: "#fff",
                  }}
                  formatter={(value: any, name: string) => {
                    if (value === null || value === undefined) return ["–", name];
                    return [Number(value).toFixed(2), name];
                  }}
                  labelFormatter={(label) => {
                    const isOpt = optEventDates.has(label);
                    return `${label}${isOpt ? " ⚡ Optimierung" : ""}`;
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "10px", color: "#9ca3af" }} />

                {/* Optimization event vertical lines */}
                {optimizationEvents.map((ev) => (
                  <ReferenceLine
                    key={ev.date}
                    x={ev.date}
                    yAxisId="left"
                    stroke="#f59e0b"
                    strokeDasharray="4 2"
                    strokeWidth={1.5}
                    label={{ value: "⚡", position: "top", fill: "#f59e0b", fontSize: 10 }}
                  />
                ))}

                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="avgSharpe"
                  name="Ø Sharpe"
                  stroke="#00CFC1"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="avgBeta"
                  name="Ø Beta"
                  stroke="#ef4444"
                  strokeWidth={1.5}
                  dot={false}
                  connectNulls
                  strokeDasharray="4 2"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="avgPEG"
                  name="Ø PEG"
                  stroke="#f59e0b"
                  strokeWidth={1.5}
                  dot={false}
                  connectNulls
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="avgDividendYield"
                  name="Ø Div. %"
                  stroke="#22c55e"
                  strokeWidth={1.5}
                  dot={false}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <span className="w-3 h-0.5 bg-[#00CFC1] inline-block" /> Sharpe (links)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-0.5 bg-red-500 inline-block" /> Beta (links)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-0.5 bg-amber-400 inline-block" /> PEG (rechts)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-0.5 bg-green-500 inline-block" /> Div. % (rechts)
              </span>
              {optimizationEvents.length > 0 && (
                <span className="flex items-center gap-1">
                  <span className="text-amber-400">⚡</span> Optimierung
                </span>
              )}
            </div>
          </div>

          {/* ─── Chart 2: Quadrant Scatter (Trajectory) ─── */}
          <div className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border border-[#00CFC1]/20 rounded-lg p-4">
            <h4 className="text-xs font-medium text-gray-300 mb-1">
              Trajektorie: PEG vs. Sharpe
            </h4>
            <p className="text-xs text-gray-500 mb-3">
              Blasengrösse = Ø Dividendenrendite · Farbe: dunkel=alt → hell=aktuell
            </p>
            {scatterData.length < 2 ? (
              <div className="flex items-center justify-center h-[260px] text-gray-500 text-xs">
                Zu wenig Datenpunkte für Trajektorie
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    type="number"
                    dataKey="x"
                    name="PEG"
                    domain={[0, Math.ceil(pegMax + 0.5)]}
                    tick={{ fontSize: 9, fill: "#6b7280" }}
                    label={{ value: "Ø PEG-Ratio", position: "insideBottom", offset: -10, fill: "#6b7280", fontSize: 9 }}
                  />
                  <YAxis
                    type="number"
                    dataKey="y"
                    name="Sharpe"
                    domain={[Math.floor(sharpeMin - 0.3), Math.ceil(sharpeMax + 0.3)]}
                    tick={{ fontSize: 9, fill: "#6b7280" }}
                    width={32}
                    label={{ value: "Ø Sharpe", angle: -90, position: "insideLeft", fill: "#6b7280", fontSize: 9 }}
                  />
                  <ZAxis type="number" dataKey="z" range={[20, 200]} />
                  {/* Quadrant dividers */}
                  <ReferenceLine x={2} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 2" />
                  <ReferenceLine y={1} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 2" />
                  <RechartsTooltip
                    cursor={{ strokeDasharray: "3 3" }}
                    content={({ active, payload }: any) => {
                      if (active && payload?.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="bg-[#1a1f2e] border border-[#00CFC1]/40 rounded p-2 text-xs text-white min-w-[160px]">
                            <p className="font-semibold text-[#00CFC1] mb-1">{d.date}</p>
                            <p>Ø Sharpe: <span className="text-[#00CFC1]">{d.y?.toFixed(2)}</span></p>
                            <p>Ø PEG: <span className="text-amber-400">{d.x?.toFixed(2)}</span></p>
                            {d.avgDividendYield != null && (
                              <p>Ø Div.: <span className="text-green-400">{d.avgDividendYield?.toFixed(2)}%</span></p>
                            )}
                            {d.avgBeta != null && (
                              <p>Ø Beta: <span className="text-red-400">{d.avgBeta?.toFixed(2)}</span></p>
                            )}
                            {d.isLatest && (
                              <p className="mt-1 text-[#00CFC1] font-semibold">← Aktuell</p>
                            )}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Scatter
                    name="Trajektorie"
                    data={scatterData}
                    shape={(props: any) => {
                      const { cx, cy, payload } = props;
                      const r = Math.max(3, Math.sqrt(payload.z) * 1.5);
                      if (payload.isLatest) {
                        return (
                          <g>
                            <circle cx={cx} cy={cy} r={r + 3} fill="none" stroke="#00CFC1" strokeWidth={2} />
                            <circle cx={cx} cy={cy} r={r} fill="#00CFC1" opacity={0.9} />
                            <text x={cx} y={cy - r - 5} textAnchor="middle" fill="#00CFC1" fontSize={8} fontWeight="bold">
                              Aktuell
                            </text>
                          </g>
                        );
                      }
                      return <circle cx={cx} cy={cy} r={r} fill={payload.color} stroke="none" />;
                    }}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            )}
            {/* Quadrant labels */}
            <div className="grid grid-cols-2 gap-1 mt-2 text-xs">
              <div className="text-left text-green-400/70">↖ Günstig &amp; Effizient</div>
              <div className="text-right text-amber-400/70">Teuer &amp; Effizient ↗</div>
              <div className="text-left text-gray-500">↙ Günstig &amp; Ineffizient</div>
              <div className="text-right text-red-400/70">Teuer &amp; Ineffizient ↘</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
