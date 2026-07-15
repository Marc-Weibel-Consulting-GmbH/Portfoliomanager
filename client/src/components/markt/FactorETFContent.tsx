/**
 * Faktor-ETF Performance Tab
 * Zeigt MSCI-Faktor-Proxies: Value, Momentum, Quality, Min Volatility, Small Cap
 * via iShares UCITS ETFs (IWVL, IWMO, IWQU, MVOL, WSML)
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { TrendingUp, TrendingDown, Minus, Info } from "lucide-react";

const PERIOD_OPTIONS = [
  { value: "ytd", label: "YTD" },
  { value: "1y",  label: "1J" },
  { value: "3y",  label: "3J" },
  { value: "5y",  label: "5J" },
] as const;

type Period = "ytd" | "1y" | "3y" | "5y";

const FACTOR_DESCRIPTIONS: Record<string, string> = {
  value:    "Günstig bewertete Aktien (niedriges KBV/KGV). Outperformance in Erholungsphasen.",
  momentum: "Aktien mit starker relativer Stärke der letzten 12 Monate. Outperformance in Trendmärkten.",
  quality:  "Hohe Eigenkapitalrendite, stabiler Cashflow, geringe Verschuldung. Defensiv mit Wachstum.",
  minvol:   "Minimale Portfoliovolatilität. Schutz in Abschwüngen, Underperformance in Rallyes.",
  smallcap: "Kleinere Unternehmen mit höherem Wachstumspotenzial und höherem Risiko.",
};

const FACTOR_PROXY: Record<string, string> = {
  value:    "IWVL.L",
  momentum: "IWMO.L",
  quality:  "IWQU.L",
  minvol:   "MVOL.L",
  smallcap: "WSML.L",
};

function ReturnBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-gray-500 text-xs">—</span>;
  const positive = value >= 0;
  const Icon = value > 0.5 ? TrendingUp : value < -0.5 ? TrendingDown : Minus;
  return (
    <span className={`inline-flex items-center gap-1 text-sm font-semibold font-mono ${positive ? "text-emerald-400" : "text-red-400"}`}>
      <Icon className="w-3.5 h-3.5" />
      {positive ? "+" : ""}{value.toFixed(2)}%
    </span>
  );
}

export function FactorETFContent() {
  const [period, setPeriod] = useState<Period>("ytd");
  const [hoveredFactor, setHoveredFactor] = useState<string | null>(null);

  const { data, isLoading } = trpc.marketRegime.getFactorETFs.useQuery(
    { period },
    { staleTime: 10 * 60 * 1000, retry: 1 }
  );

  const factors = data?.factors ?? [];
  const chart = data?.chart ?? [];

  // Sort factors by return descending
  const sortedFactors = [...factors].sort((a, b) => (b.totalReturn ?? -999) - (a.totalReturn ?? -999));

  const periodLabel = PERIOD_OPTIONS.find(p => p.value === period)?.label ?? "YTD";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">MSCI Faktor-Performance</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            iShares UCITS ETFs als Proxies für MSCI World Faktorindizes · Normalisiert auf 0% am Startdatum
          </p>
        </div>
        {/* Period selector */}
        <div className="flex gap-1 bg-[#0f1420] border border-white/10 rounded-lg p-1">
          {PERIOD_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                period === opt.value
                  ? "bg-[#00CFC1]/20 text-[#00CFC1]"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Factor Score Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-[#0f1420] border border-white/10 rounded-lg p-4 animate-pulse">
                <div className="h-3 w-16 bg-white/10 rounded mb-2" />
                <div className="h-5 w-20 bg-white/10 rounded mb-1" />
                <div className="h-3 w-12 bg-white/10 rounded" />
              </div>
            ))
          : sortedFactors.map((f, i) => (
              <div
                key={f.key}
                onMouseEnter={() => setHoveredFactor(f.key)}
                onMouseLeave={() => setHoveredFactor(null)}
                className={`bg-[#0f1420] border rounded-lg p-4 cursor-pointer transition-colors ${
                  hoveredFactor === f.key ? "border-white/30" : "border-white/10"
                }`}
                style={{ borderLeftColor: f.color, borderLeftWidth: "3px" }}
              >
                {i === 0 && (
                  <span className="text-[9px] font-semibold text-amber-400 uppercase tracking-wider">
                    ★ Bester {periodLabel}
                  </span>
                )}
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mt-1">{f.label}</p>
                <div className="mt-1">
                  <ReturnBadge value={f.totalReturn} />
                </div>
                <p className="text-[10px] text-gray-600 mt-1">{FACTOR_PROXY[f.key]}</p>
              </div>
            ))
        }
      </div>

      {/* Chart */}
      <div className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border border-[#00CFC1]/20 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white">
            Relative Performance ({periodLabel}, normalisiert auf 0%)
          </h3>
          {/* Legend */}
          <div className="flex flex-wrap gap-3">
            {factors.map(f => (
              <button
                key={f.key}
                onMouseEnter={() => setHoveredFactor(f.key)}
                onMouseLeave={() => setHoveredFactor(null)}
                className={`flex items-center gap-1.5 text-xs transition-opacity ${
                  hoveredFactor && hoveredFactor !== f.key ? "opacity-30" : "opacity-100"
                }`}
              >
                <span className="w-3 h-0.5 rounded-full inline-block" style={{ backgroundColor: f.color }} />
                <span className="text-gray-400">{f.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="h-72">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-5 h-5 border-2 border-[#00CFC1] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : chart.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500 text-sm">Keine Daten verfügbar</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="#444"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(d) => {
                    const date = new Date(d);
                    if (period === "ytd" || period === "1y") {
                      return date.toLocaleDateString("de-CH", { month: "short" });
                    }
                    return date.toLocaleDateString("de-CH", { month: "short", year: "2-digit" });
                  }}
                  minTickGap={40}
                />
                <YAxis
                  stroke="#444"
                  fontSize={10}
                  tickFormatter={(v) => `${v >= 0 ? "+" : ""}${v.toFixed(0)}%`}
                  tickLine={false}
                  axisLine={false}
                  width={45}
                />
                <ReferenceLine y={0} stroke="#444" strokeDasharray="3 3" />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1a1f2e", border: "1px solid #00CFC1", borderRadius: "6px", fontSize: "12px" }}
                  labelStyle={{ color: "#fff" }}
                  formatter={(value: number, name: string) => {
                    const f = factors.find(f => f.key === name);
                    return [`${value >= 0 ? "+" : ""}${value.toFixed(2)}%`, f?.label ?? name];
                  }}
                  labelFormatter={(label) => new Date(label).toLocaleDateString("de-CH", { day: "numeric", month: "short", year: "numeric" })}
                />
                {factors.map(f => (
                  <Line
                    key={f.key}
                    type="monotone"
                    dataKey={f.key}
                    stroke={f.color}
                    strokeWidth={hoveredFactor === f.key ? 2.5 : hoveredFactor ? 1 : 1.5}
                    dot={false}
                    connectNulls
                    opacity={hoveredFactor && hoveredFactor !== f.key ? 0.2 : 1}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Factor Descriptions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {factors.map(f => (
          <div key={f.key} className="flex items-start gap-3 bg-[#0f1420] border border-white/10 rounded-lg p-4">
            <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: f.color }} />
            <div>
              <p className="text-sm font-semibold text-white">{f.label} <span className="text-gray-500 font-normal text-xs">({FACTOR_PROXY[f.key]})</span></p>
              <p className="text-xs text-gray-400 mt-0.5">{FACTOR_DESCRIPTIONS[f.key]}</p>
            </div>
          </div>
        ))}
        <div className="flex items-start gap-3 bg-[#0f1420] border border-white/10 rounded-lg p-4">
          <Info className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-white">Datenquelle</p>
            <p className="text-xs text-gray-400 mt-0.5">
              iShares UCITS ETFs (London Stock Exchange) als Proxies für MSCI World Faktorindizes.
              Adjusted Close Prices via EODHD. Alle Werte in GBP (Notierungswährung).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
