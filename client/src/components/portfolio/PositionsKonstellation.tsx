// Positions-Konstellation: bubble scatter of the holdings.
//   x = erw. Gewinnwachstum (PE / PEG)   y = KGV (PE)
//   Farbe = Gesamtscore (scoring.ts)      Grösse = Marktkap. (CHF Mrd)
//
// IST  = aktuelle Positionen (echte Fundamentaldaten aus enrichedStocks).
// SOLL = KI-Optimierungsvorschlag — kommt aus demselben analytics.optimize
//        wie der Optimieren-Tab (Gewichts-Reallokation), damit beide Ansichten
//        konsistent bleiben. Es werden keine erfundenen Titel ergänzt.
//
// Hand-rolled SVG (kein Chart-Lib deckt diese Encodings sauber ab).

import * as React from "react";
import { trpc } from "@/lib/trpc";
import { Sparkles, Brain, ArrowUpRight, ArrowDownRight } from "lucide-react";

// ── Design tokens (an die App angelehnt: #0a0f1a / #00CFC1) ────────────
const T = {
  card: "#0f1620",
  cardAlt: "#131b27",
  border: "rgba(255,255,255,0.08)",
  borderHi: "rgba(255,255,255,0.16)",
  borderAccent: "rgba(0,207,193,0.35)",
  text: "#ffffff",
  textMuted: "#9ca3af",
  textDim: "#6b7280",
  accent: "#00CFC1",
  accentSoft: "rgba(0,207,193,0.12)",
  warn: "#fbbf24",
  bad: "#f87171",
  good: "#34d399",
  mono: "ui-monospace, SFMono-Regular, Menlo, monospace",
};

type Flag = "up" | "reduce" | "out" | undefined;

interface KPos {
  ticker: string;
  name: string;
  sector: string;
  pe: number;
  g: number;     // erw. Gewinnwachstum % (PE/PEG)
  mcap: number;  // CHF Mrd
  mom: number;   // 0..4
  score: number; // 0..100
  flag?: Flag;
}

const MOM = [
  { label: "Sehr schwach", hex: "#f87171" },
  { label: "Schwach", hex: "#fb923c" },
  { label: "Neutral", hex: "#fbbf24" },
  { label: "Gut", hex: "#4ade80" },
  { label: "Sehr gut", hex: "#16a34a" },
];
const momIdx = (m: number) => Math.max(0, Math.min(4, m));
const momColor = (m: number) => MOM[momIdx(m)].hex;
const momLabel = (m: number) => MOM[momIdx(m)].label;
const momBucket = (ytd: number) => (ytd < 0 ? 0 : ytd < 5 ? 1 : ytd < 15 ? 2 : ytd < 30 ? 3 : 4);

function scoreColor(s: number): string {
  const t = Math.max(0, Math.min(1, (s - 45) / 40));
  const stops = [[248, 113, 113], [251, 146, 60], [251, 191, 36], [74, 222, 128], [22, 163, 74]];
  const x = t * (stops.length - 1);
  const i = Math.floor(x), f = x - i;
  const a = stops[i], b = stops[Math.min(stops.length - 1, i + 1)];
  const c = a.map((v, k) => Math.round(v + (b[k] - v) * f));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
const fmtMcap = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} Bio` : `${Math.round(m)} Mrd`);
const num = (v: unknown): number => {
  if (v === null || v === undefined || v === "") return NaN;
  return typeof v === "number" ? v : parseFloat(String(v));
};

// Map an enrichedStock to a chart position; null if it lacks the fundamentals
// needed to place a bubble (we don't invent values).
function toKPos(h: any): KPos | null {
  const pe = num(h.peRatio);
  const peg = num(h.pegRatio);
  const mcap = num(h.marketCap);
  const g = peg > 0 && pe > 0 ? pe / peg : NaN;
  if (!Number.isFinite(pe) || !Number.isFinite(g) || !Number.isFinite(mcap) || mcap <= 0) return null;
  const score = Number.isFinite(num(h.qualityScore)) ? num(h.qualityScore) : 50;
  return {
    ticker: h.ticker,
    name: h.companyName || h.ticker,
    sector: h.sector || "—",
    pe,
    g,
    mcap,
    mom: momBucket(num(h.ytdPerformance) || 0),
    score: Math.round(score),
  };
}

// ── Scatter plot ───────────────────────────────────────────────────────
function KonstChart({
  positions,
  hov,
  onHover,
}: {
  positions: KPos[];
  hov: KPos | null;
  onHover: (p: KPos | null) => void;
}) {
  const W = 760, H = 440;
  const padL = 56, padR = 20, padT = 16, padB = 44;
  const iw = W - padL - padR, ih = H - padT - padB;

  // Dynamic domain from data quantiles (p95 + 10% headroom, no fixed floors)
  // so typical portfolios spread across the full canvas.
  // Outliers beyond the domain are placed just inside the edge with an arrow.
  const gs = positions.map((p) => p.g);
  const pes = positions.map((p) => p.pe);
  const sortedGs = [...gs].filter(Number.isFinite).sort((a, b) => a - b);
  const sortedPes = [...pes].filter(Number.isFinite).sort((a, b) => a - b);
  const quantile = (arr: number[], q: number) =>
    arr.length ? arr[Math.min(arr.length - 1, Math.floor(arr.length * q))] : NaN;
  const p95g = quantile(sortedGs, 0.95);
  const p95pe = quantile(sortedPes, 0.95);
  const p10pe = quantile(sortedPes, 0.1);
  const roundUp5 = (v: number) => Math.max(5, Math.ceil(v / 5) * 5);
  const xMax = roundUp5(Number.isFinite(p95g) ? p95g * 1.1 : 30);
  const yMin = Math.max(0, Math.floor((Number.isFinite(p10pe) ? Math.min(p10pe, 99) : 8) / 5) * 5);
  const yMax = Math.max(yMin + 5, roundUp5(Number.isFinite(p95pe) ? p95pe * 1.1 : 40));
  const X_DOM = [0, xMax], Y_DOM = [yMin, yMax];
  const sx = (v: number) => padL + ((v - X_DOM[0]) / (X_DOM[1] - X_DOM[0])) * iw;
  const sy = (v: number) => padT + ih - ((v - Y_DOM[0]) / (Y_DOM[1] - Y_DOM[0])) * ih;

  // Detect outliers: positions outside the visible domain
  const isOutlierX = (v: number) => v < X_DOM[0] || v > X_DOM[1];
  const isOutlierY = (v: number) => v < Y_DOM[0] || v > Y_DOM[1];
  const isOutlier = (p: KPos) => isOutlierX(p.g) || isOutlierY(p.pe);
  // Outliers: clamp to the domain, then pull a few px inside the edge so the
  // bubble is fully visible (arrow marks the true direction).
  const inset = 16;
  const sxC = (v: number) => {
    const px = sx(Math.max(X_DOM[0], Math.min(X_DOM[1], v)));
    return Math.max(padL + inset, Math.min(padL + iw - inset, px));
  };
  const syC = (v: number) => {
    const px = sy(Math.max(Y_DOM[0], Math.min(Y_DOM[1], v)));
    return Math.max(padT + inset, Math.min(padT + ih - inset, px));
  };

  const maxR = Math.max(1, ...positions.map((d) => Math.sqrt(d.mcap)));
  const rOf = (m: number) => 8 + (Math.sqrt(m) / maxR) * 20;

  const ticks = (lo: number, hi: number) => {
    const step = hi - lo > 60 ? 10 : 5;
    const out: number[] = [];
    for (let t = lo; t <= hi + 0.001; t += step) out.push(t);
    return out;
  };
  const xTicks = ticks(0, xMax), yTicks = ticks(yMin <= 0 ? 5 : yMin, yMax);

  // Quadrant split at "fair" PEG≈1.5: günstig/wachstumsstark unten-rechts.
  const qx = sx(Math.min(xMax, 11)), qy = sy(Math.min(yMax, 22));

  // PEG-Fächer: PEG=1 ⇒ pe=g, PEG=2 ⇒ pe=2g, geclippt aufs sichtbare Feld.
  const seg = (k: number) => {
    // pe = k*g, within [yMin,yMax] and g within [0,xMax]
    const gLo = Math.max(0, yMin / k), gHi = Math.min(xMax, yMax / k);
    return { x1: sx(gLo), y1: sy(k * gLo), x2: sx(gHi), y2: sy(k * gHi) };
  };
  const peg1 = seg(1), peg2 = seg(2);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
      <defs>
        <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#fbbf24" opacity="0.9" />
        </marker>
      </defs>
      {/* quadrant tints */}
      <rect x={padL} y={padT} width={Math.max(0, qx - padL)} height={Math.max(0, qy - padT)} fill="#f87171" opacity="0.045" />
      <rect x={qx} y={qy} width={Math.max(0, padL + iw - qx)} height={Math.max(0, padT + ih - qy)} fill="#16a34a" opacity="0.07" />
      <line x1={qx} y1={padT} x2={qx} y2={padT + ih} stroke={T.borderHi} strokeDasharray="3 4" />
      <line x1={padL} y1={qy} x2={padL + iw} y2={qy} stroke={T.borderHi} strokeDasharray="3 4" />
      <text x={padL + 8} y={padT + 15} fill={T.textDim} fontSize="10" fontWeight="600" style={{ textTransform: "uppercase", letterSpacing: ".06em" }}>Teuer · langsam</text>
      <text x={padL + iw - 8} y={padT + ih - 9} textAnchor="end" fill="#4ade80" fontSize="10" fontWeight="600" style={{ textTransform: "uppercase", letterSpacing: ".06em" }}>Günstig · wachstumsstark</text>

      {xTicks.map((t) => <line key={"gx" + t} x1={sx(t)} y1={padT} x2={sx(t)} y2={padT + ih} stroke={T.border} opacity="0.5" />)}
      {yTicks.map((t) => <line key={"gy" + t} x1={padL} y1={sy(t)} x2={padL + iw} y2={sy(t)} stroke={T.border} opacity="0.5" />)}

      {/* Bewertungs-Fächer PEG 1–2 */}
      <polygon points={`${peg1.x1},${peg1.y1} ${peg1.x2},${peg1.y2} ${peg2.x2},${peg2.y2} ${peg2.x1},${peg2.y1}`} fill={T.accent} opacity="0.07" />
      <line x1={peg1.x1} y1={peg1.y1} x2={peg1.x2} y2={peg1.y2} stroke={T.accent} strokeWidth="1.4" strokeDasharray="5 5" opacity="0.75" />
      <line x1={peg2.x1} y1={peg2.y1} x2={peg2.x2} y2={peg2.y2} stroke={T.accent} strokeWidth="1.2" strokeDasharray="2 4" opacity="0.55" />
      <text x={peg1.x2 - 4} y={peg1.y2 + 14} textAnchor="end" fill={T.accent} fontSize="10" fontFamily={T.mono} opacity="0.9">PEG = 1 · fair</text>
      <text x={peg2.x2 + 6} y={peg2.y2 + 13} fill={T.accent} fontSize="10" fontFamily={T.mono} opacity="0.65">PEG = 2</text>

      {/* axes */}
      <line x1={padL} y1={padT + ih} x2={padL + iw} y2={padT + ih} stroke={T.borderHi} />
      <line x1={padL} y1={padT} x2={padL} y2={padT + ih} stroke={T.borderHi} />
      {xTicks.map((t) => <text key={"tx" + t} x={sx(t)} y={padT + ih + 17} textAnchor="middle" fill={T.textDim} fontSize="11" fontFamily={T.mono}>{t}%</text>)}
      {yTicks.map((t) => <text key={"ty" + t} x={padL - 9} y={sy(t) + 4} textAnchor="end" fill={T.textDim} fontSize="11" fontFamily={T.mono}>{t}</text>)}
      <text x={padL + iw / 2} y={H - 7} textAnchor="middle" fill={T.textMuted} fontSize="11" fontWeight="600">Erw. Gewinnwachstum →</text>
      <text x={15} y={padT + ih / 2} textAnchor="middle" fill={T.textMuted} fontSize="11" fontWeight="600" transform={`rotate(-90 15 ${padT + ih / 2})`}>KGV (PE) →</text>

      {/* bubbles */}
      {positions.map((d) => {
        const cx = sxC(d.g);
        const cy = syC(d.pe);
        const r = rOf(d.mcap) * (d.flag === "reduce" ? 0.6 : 1);
        const on = hov?.ticker === d.ticker;
        const dim = d.flag === "out" || d.flag === "reduce";
        const isUp = d.flag === "up";
        const outlier = isOutlier(d);
        // Arrow direction for outliers
        const arrowDx = d.g > X_DOM[1] ? 1 : d.g < X_DOM[0] ? -1 : 0;
        const arrowDy = d.pe > Y_DOM[1] ? -1 : d.pe < Y_DOM[0] ? 1 : 0;
        return (
          <g key={d.ticker} style={{ cursor: "pointer" }}
             onMouseEnter={() => onHover(d)} onMouseLeave={() => onHover(null)}>
            {/* Outlier: dashed border + arrow indicating true direction */}
            {outlier && (
              <>
                <circle cx={cx} cy={cy} r={r + 4} fill="none" stroke={T.warn} strokeWidth="1.5" strokeDasharray="4 3" opacity="0.7" />
                {/* Arrow pointing towards true position */}
                <line
                  x1={cx + arrowDx * (r + 6)}
                  y1={cy + arrowDy * (r + 6)}
                  x2={cx + arrowDx * (r + 20)}
                  y2={cy + arrowDy * (r + 20)}
                  stroke={T.warn} strokeWidth="2" markerEnd="url(#arrowhead)" opacity="0.9"
                />
                <text
                  x={cx + arrowDx * (r + 26)}
                  y={cy + arrowDy * (r + 26) + 4}
                  textAnchor={arrowDx > 0 ? "start" : arrowDx < 0 ? "end" : "middle"}
                  fill={T.warn} fontSize="9" fontFamily={T.mono} opacity="0.85"
                >
                  {d.g > X_DOM[1] ? `g=${d.g.toFixed(0)}%` : d.pe > Y_DOM[1] ? `PE=${d.pe.toFixed(0)}` : d.pe < Y_DOM[0] ? `PE=${d.pe.toFixed(0)}` : ""}
                </text>
              </>
            )}
            <circle cx={cx} cy={cy} r={r} fill={scoreColor(d.score)}
              opacity={outlier ? 0.65 : dim ? 0.3 : on ? 0.97 : 0.82}
              stroke={outlier ? T.warn : isUp ? T.accent : d.flag === "out" ? T.bad : "rgba(0,0,0,0.35)"}
              strokeWidth={outlier ? 2 : isUp ? 2.4 : on ? 2 : 1}
              strokeDasharray={outlier ? "4 3" : d.flag === "out" ? "3 3" : "0"} />
            <text x={cx} y={cy + 5} textAnchor="middle" fill="#0a0f1a" fontSize={r > 22 ? 15 : 12} fontWeight="800" fontFamily={T.mono} opacity={dim ? 0.55 : 1}>{d.score}</text>
            <text x={cx} y={cy + r + 13} textAnchor="middle" fill={outlier ? T.warn : isUp ? T.accent : T.textMuted} fontSize="10" fontWeight={isUp || outlier ? 700 : 600}>{d.ticker.split(".")[0]}</text>
            {isUp && !outlier && <g transform={`translate(${cx + r - 4}, ${cy - r - 2})`}><circle r="8" fill={T.accent} /><text y="4" textAnchor="middle" fill="#0a0f1a" fontSize="12" fontWeight="800">↑</text></g>}
            {d.flag === "out" && !outlier && <g transform={`translate(${cx + r - 4}, ${cy - r - 2})`}><circle r="8" fill={T.bad} /><text y="4.5" textAnchor="middle" fill="#0a0f1a" fontSize="13" fontWeight="800">×</text></g>}
            {d.flag === "reduce" && !outlier && <g transform={`translate(${cx + r - 2}, ${cy - r})`}><circle r="8" fill={T.warn} /><text y="4.5" textAnchor="middle" fill="#0a0f1a" fontSize="13" fontWeight="800">−</text></g>}
          </g>
        );
      })}

      {/* tooltip */}
      {hov && (() => {
        const cx = sxC(hov.g);
        const cy = syC(hov.pe);
        const hovOutlier = isOutlier(hov);
        const outlierValue = hov.g > X_DOM[1] ? `Wachstum ${hov.g.toFixed(0)}%` : hov.pe > Y_DOM[1] || hov.pe < Y_DOM[0] ? `KGV ${hov.pe.toFixed(1)}` : `Wachstum ${hov.g.toFixed(0)}%`;
        const tw = 208, th = hovOutlier ? 110 : 92;
        const tx = Math.min(W - tw - 4, cx + 18);
        const ty = Math.max(4, cy - th - 8);
        return (
          <g pointerEvents="none">
            <rect x={tx} y={ty} width={tw} height={th} rx="8" fill="#05080f" stroke={T.borderHi} />
            <text x={tx + 12} y={ty + 19} fill={T.text} fontSize="13" fontWeight="700">{hov.name.slice(0, 18)}</text>
            <text x={tx + tw - 12} y={ty + 19} textAnchor="end" fill={T.textDim} fontSize="10" fontFamily={T.mono}>{hov.ticker}</text>
            <text x={tx + 12} y={ty + 39} fill={T.textMuted} fontSize="11">KGV <tspan fill={T.text} fontFamily={T.mono}>{hov.pe.toFixed(1)}</tspan>  ·  Wachstum <tspan fill={T.text} fontFamily={T.mono}>{hov.g.toFixed(0)}%</tspan></text>
            <text x={tx + 12} y={ty + 56} fill={T.textMuted} fontSize="11">MCap <tspan fill={T.text} fontFamily={T.mono}>{fmtMcap(hov.mcap)}</tspan>  ·  {hov.sector.slice(0, 12)}</text>
            <circle cx={tx + 17} cy={ty + 71} r="5" fill={momColor(hov.mom)} />
            <text x={tx + 28} y={ty + 75} fill={T.textMuted} fontSize="11">Momentum {momLabel(hov.mom)}</text>
            <text x={tx + tw - 12} y={ty + 75} textAnchor="end" fill={T.accent} fontSize="11" fontWeight="700" fontFamily={T.mono}>Score {hov.score}</text>
            {hovOutlier && (
              <text x={tx + 12} y={ty + 94} fill={T.warn} fontSize="10.5">Wert ausserhalb der Skala: {outlierValue}</text>
            )}
          </g>
        );
      })()}
    </svg>
  );
}

// ── Legends ──────────────────────────────────────────────────────────
function Legends() {
  const label = { fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: "uppercase" as const, letterSpacing: ".06em", marginBottom: 6 };
  return (
    <>
      <div>
        <div style={label}>Farbe · Gesamtscore</div>
        <div style={{ height: 10, borderRadius: 4, background: `linear-gradient(90deg, ${scoreColor(45)}, ${scoreColor(62)}, ${scoreColor(85)})` }} />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
          <span style={{ fontSize: 9.5, color: T.textDim, fontFamily: T.mono }}>45</span>
          <span style={{ fontSize: 9.5, color: T.textDim, fontFamily: T.mono }}>90</span>
        </div>
      </div>
      <div>
        <div style={label}>Fläche · Bewertung</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <svg width="40" height="18"><rect x="2" y="3" width="36" height="12" rx="2" fill={T.accent} opacity="0.18" /><line x1="2" y1="15" x2="38" y2="3" stroke={T.accent} strokeWidth="1.2" strokeDasharray="3 3" opacity="0.7" /></svg>
          <span style={{ fontSize: 10, color: T.textDim }}>PEG 1–2 = ok</span>
        </div>
      </div>
      <div>
        <div style={label}>Grösse · Marktkap.</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 12 }}>
          {[{ r: 8, l: "klein" }, { r: 13, l: "mittel" }, { r: 19, l: "gross" }].map((c) => (
            <div key={c.l} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
              <svg width={c.r * 2} height={c.r * 2}><circle cx={c.r} cy={c.r} r={c.r} fill="none" stroke={T.textDim} strokeWidth="1.3" /></svg>
              <span style={{ fontSize: 9.5, color: T.textDim }}>{c.l}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function DeltaKpi({ label, from, to, good }: { label: string; from: string; to: string; good?: boolean }) {
  return (
    <div style={{ background: T.cardAlt, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 12px" }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 5 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span style={{ fontSize: 13, color: T.textDim, fontFamily: T.mono, textDecoration: "line-through" }}>{from}</span>
        <span style={{ color: T.textDim }}>→</span>
        <span style={{ fontSize: 16, fontWeight: 700, color: good ? T.good : T.text, fontFamily: T.mono }}>{to}</span>
      </div>
    </div>
  );
}

// ── Main ────────────────────────────────────────────────────────────
export default function PositionsKonstellation({
  holdings,
  portfolioId,
  onOptimize,
}: {
  holdings: any[];
  portfolioId: number;
  onOptimize?: () => void;
}) {
  const [mode, setMode] = React.useState<"IST" | "SOLL">("IST");
  const [hov, setHov] = React.useState<KPos | null>(null);
  const isSoll = mode === "SOLL";

  const istPositions = React.useMemo(
    () => holdings.map(toKPos).filter((p): p is KPos => p !== null),
    [holdings]
  );
  const omitted = holdings.filter((h) => h.ticker !== "CASH").length - istPositions.length;

  const tickers = React.useMemo(
    () => holdings.filter((h) => h.ticker && h.ticker !== "CASH").map((h) => h.ticker),
    [holdings]
  );
  const currentWeights = React.useMemo(() => {
    const m: Record<string, number> = {};
    holdings.forEach((h) => {
      if (!h.ticker || h.ticker === "CASH") return;
      m[h.ticker] = (typeof h.weight === "number" ? h.weight : parseFloat(h.weight || "0")) / 100;
    });
    return m;
  }, [holdings]);

  // Same query as the Optimieren-Tab — single source of truth for the SOLL.
  const { data: opt, isFetching, error } = trpc.analytics.optimize.useQuery(
    { tickers, lookbackDays: 252, riskFreeRate: 0.015, method: "max_sharpe" },
    { enabled: isSoll && portfolioId > 0 && tickers.length >= 2, staleTime: 5 * 60 * 1000 }
  );

  const optimalWeights = (opt?.weights as Record<string, number> | undefined) || {};

  // Flag each position by its optimizer reallocation.
  const sollPositions: KPos[] = React.useMemo(() => {
    return istPositions.map((p) => {
      const cur = currentWeights[p.ticker] ?? 0;
      const tgt = optimalWeights[p.ticker] ?? 0;
      const diff = tgt - cur;
      let flag: Flag;
      if (tgt < 0.005 && cur > 0.005) flag = "out";
      else if (diff <= -0.02) flag = "reduce";
      else if (diff >= 0.02) flag = "up";
      return { ...p, flag };
    });
  }, [istPositions, currentWeights, optimalWeights]);

  const positions = isSoll && opt ? sollPositions : istPositions;

  // Weighted average score IST vs SOLL (real, from scoring.ts).
  const wScore = (weights: Record<string, number>) => {
    let s = 0, w = 0;
    istPositions.forEach((p) => {
      const ww = weights[p.ticker] ?? 0;
      s += ww * p.score; w += ww;
    });
    return w > 0 ? s / w : 0;
  };

  const reallocations = React.useMemo(() => {
    if (!opt?.weights) return [];
    const all = new Set([...Object.keys(optimalWeights), ...Object.keys(currentWeights)]);
    return Array.from(all)
      .map((ticker) => ({ ticker, cur: currentWeights[ticker] || 0, tgt: optimalWeights[ticker] || 0, diff: (optimalWeights[ticker] || 0) - (currentWeights[ticker] || 0) }))
      .filter((s) => Math.abs(s.diff) >= 0.02)
      .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
      .slice(0, 5);
  }, [opt, optimalWeights, currentWeights]);

  const topByScore = React.useMemo(
    () => [...istPositions].sort((a, b) => b.score - a.score).slice(0, 5),
    [istPositions]
  );

  return (
    <div style={{ background: T.card, border: `1px solid ${T.borderAccent}`, borderRadius: 14, padding: 20 }}>
      {/* header + IST/SOLL toggle */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 4 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: T.text }}>{isSoll ? "Optimierungs-Vorschlag" : `${istPositions.length} Positionen`}</div>
          <div style={{ fontSize: 12, color: T.textMuted, marginTop: 3 }}>Konstellation · Farbe = Score, Grösse = Marktkap. · Fächer PEG 1–2 = ok bewertet</div>
        </div>
        <div style={{ display: "inline-flex", background: T.cardAlt, border: `1px solid ${T.border}`, borderRadius: 9, padding: 3, gap: 2 }}>
          {(["IST", "SOLL"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} style={{
              border: "none", borderRadius: 6, cursor: "pointer", padding: "5px 16px", fontSize: 12.5, fontWeight: 700, letterSpacing: ".03em",
              display: "inline-flex", alignItems: "center", gap: 6,
              background: mode === m ? (m === "SOLL" ? T.accent : T.accentSoft) : "transparent",
              color: mode === m ? (m === "SOLL" ? "#0a0f1a" : T.accent) : T.textMuted,
            }}>{m === "SOLL" && <Sparkles size={13} color={mode === m ? "#0a0f1a" : T.textMuted} />}{m}</button>
          ))}
        </div>
      </div>

      {isSoll && opt && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "8px 0 4px", padding: "8px 12px", background: T.accentSoft, border: `1px solid ${T.borderAccent}`, borderRadius: 9 }}>
          <Brain size={15} color={T.accent} />
          <span style={{ fontSize: 12.5, color: T.text }}>
            KI-Analyse (Max-Sharpe): <b>{reallocations.length} Umschichtung{reallocations.length === 1 ? "" : "en"}</b> heben die risikoadjustierte Rendite und den Ø Score.
          </span>
        </div>
      )}

      <div style={{ display: "flex", gap: 18, marginTop: 12, alignItems: "stretch", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 460px", minWidth: 0 }}>
          {istPositions.length === 0 ? (
            <div style={{ height: 280, display: "flex", alignItems: "center", justifyContent: "center", color: T.textMuted, fontSize: 13, textAlign: "center", padding: 24 }}>
              Für diese Positionen liegen noch keine Fundamentaldaten (KGV/PEG/Marktkap.) vor.<br />Aktualisiere die Aktiendaten, um die Konstellation zu sehen.
            </div>
          ) : (
            <>
              {isSoll && isFetching && <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 8 }}>Optimierung wird berechnet…</div>}
              {isSoll && error && <div style={{ fontSize: 12, color: T.bad, marginBottom: 8 }}>{(error as any)?.message || "Optimierung nicht verfügbar."}</div>}
              <KonstChart positions={positions} hov={hov} onHover={setHov} />
            </>
          )}
        </div>
        <div style={{ width: 210, flexShrink: 0, display: "flex", flexDirection: "column", gap: 16 }}>
          <Legends />
          {isSoll ? (
            <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>Markierung</div>
              {([["↑", T.accent, "Aufstocken"], ["−", T.warn, "Reduzieren"], ["×", T.bad, "Auflösen"]] as const).map(([s, c, l]) => (
                <div key={l} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ width: 16, height: 16, borderRadius: 5, background: c, color: "#0a0f1a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, flexShrink: 0 }}>{s}</span>
                  <span style={{ fontSize: 11.5, color: T.textMuted }}>{l}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>Top nach Score</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {topByScore.map((p) => (
                  <div key={p.ticker} onMouseEnter={() => setHov(p)} onMouseLeave={() => setHov(null)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "4px 6px", borderRadius: 6, cursor: "pointer" }}>
                    <span style={{ width: 8, height: 8, borderRadius: 8, background: momColor(p.mom), flexShrink: 0 }} />
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: T.text, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: T.accent, fontFamily: T.mono }}>{p.score}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {omitted > 0 && (
        <div style={{ fontSize: 10.5, color: T.textDim, marginTop: 10 }}>
          {omitted} Titel ohne Daten (KGV/PEG/Marktkap. fehlend oder ungültig) — nicht dargestellt.
        </div>
      )}

      {/* SOLL: KPIs + Reallokation + CTA */}
      {isSoll && opt && (
        <div style={{ marginTop: 18, borderTop: `1px solid ${T.border}`, paddingTop: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 18 }}>
            <DeltaKpi label="Erw. Rendite p.a." from={`${(opt.currentPortfolio.expectedReturn * 100).toFixed(1)}%`} to={`${(opt.optimalPortfolio.expectedReturn * 100).toFixed(1)}%`} good={opt.optimalPortfolio.expectedReturn >= opt.currentPortfolio.expectedReturn} />
            <DeltaKpi label="Risiko · Vola" from={`${(opt.currentPortfolio.volatility * 100).toFixed(1)}%`} to={`${(opt.optimalPortfolio.volatility * 100).toFixed(1)}%`} good={opt.optimalPortfolio.volatility <= opt.currentPortfolio.volatility} />
            <DeltaKpi label="Sharpe" from={opt.currentPortfolio.sharpe.toFixed(2)} to={opt.optimalPortfolio.sharpe.toFixed(2)} good={opt.optimalPortfolio.sharpe >= opt.currentPortfolio.sharpe} />
            <DeltaKpi label="Ø Score" from={wScore(currentWeights).toFixed(0)} to={wScore(optimalWeights).toFixed(0)} good={wScore(optimalWeights) >= wScore(currentWeights)} />
          </div>

          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 420px", minWidth: 0 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>Vorgeschlagene Umschichtungen</div>
              {reallocations.length === 0 ? (
                <div style={{ fontSize: 12.5, color: T.textMuted }}>Dein Portfolio liegt bereits nahe am Optimum — keine wesentliche Umschichtung nötig.</div>
              ) : reallocations.map((s) => {
                const up = s.diff > 0;
                return (
                  <div key={s.ticker} style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 0", borderBottom: `1px solid ${T.border}` }}>
                    <span style={{ width: 24, height: 24, borderRadius: 7, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: up ? T.accentSoft : "rgba(251,191,36,0.14)", color: up ? T.accent : T.warn }}>
                      {up ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: T.text, fontFamily: T.mono, flex: 1 }}>{s.ticker}</span>
                    <span style={{ fontSize: 12, color: T.textDim, fontFamily: T.mono }}>{(s.cur * 100).toFixed(1)}% → {(s.tgt * 100).toFixed(1)}%</span>
                    <span style={{ width: 64, textAlign: "right", fontSize: 12.5, fontWeight: 700, fontFamily: T.mono, color: up ? T.accent : T.warn }}>{up ? "+" : ""}{(s.diff * 100).toFixed(1)} pp</span>
                  </div>
                );
              })}
            </div>

            <div style={{ flex: "0 0 280px", display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ background: T.cardAlt, border: `1px solid ${T.border}`, borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 6 }}>Optimierung im Detail</div>
                <div style={{ fontSize: 12, color: T.textMuted, lineHeight: 1.5, marginBottom: 14 }}>
                  Die Gewichte stammen aus der Effizienzgrenze (Max-Sharpe). Im Optimieren-Tab siehst du die vollständige Analyse.
                </div>
                {onOptimize && (
                  <button onClick={onOptimize} style={{ width: "100%", padding: "9px 14px", borderRadius: 8, border: "none", background: T.accent, color: "#0a0f1a", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    <Sparkles size={15} /> Zum Optimieren-Tab
                  </button>
                )}
              </div>
              <div style={{ fontSize: 10.5, color: T.textDim, lineHeight: 1.5, padding: "0 4px" }}>
                Hinweis: Vorschlag auf Basis historischer Renditen (Modern Portfolio Theory) sowie Score, Bewertung &amp; Momentum. Keine Anlageberatung.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
