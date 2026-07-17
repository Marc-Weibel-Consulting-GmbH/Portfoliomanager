/**
 * Portfolio Quality History — E2 Redesign
 *
 * Architecture (from KONZEPT_PORTFOLIO_QUALITAET.md §4):
 *   - Top row: 6 KPI cards with deltas
 *   - Middle row: 3 Small-Multiple panels (no dual Y-axis)
 *   - Optimization events: Vorher/Nachher cards
 *   - Bottom: Regelbasierte Interpretation
 *
 * Color system (§4.6):
 *   - Performance/Sharpe: Cyan #00CFC1
 *   - Risiko/Volatilität: Violett #A78BFA
 *   - Bewertung/PEG/PE: Orange #F59E0B
 *   - Ertrag/Dividende: Grün #10B981
 *   - Warnung: Rot #EF4444
 *   - Optimierungs-Event: Amber #F59E0B
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Shield,
  BarChart3,
  Coins,
  Info,
  Zap,
} from "lucide-react";

// Color constants (§4.6)
const COLORS = {
  sharpe: "#00CFC1",
  volatility: "#A78BFA",
  peg: "#F59E0B",
  pe: "#FB923C",
  dividend: "#10B981",
  warning: "#EF4444",
  event: "#F59E0B",
};

const PERIODS = ["1M", "3M", "6M", "1Y", "MAX"] as const;

interface Props {
  portfolioId: number;
}

export default function PortfolioQualityHistory({ portfolioId }: Props) {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>("1Y");

  const { data, isLoading } = trpc.dashboard.getPortfolioMetricsHistory.useQuery(
    { portfolioId, period },
    { staleTime: 60_000 }
  );

  if (isLoading) {
    return (
      <div className="mt-8 animate-pulse">
        <div className="h-6 w-48 bg-white/10 rounded mb-4" />
        <div className="grid grid-cols-6 gap-3 mb-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 bg-white/5 rounded-lg" />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-48 bg-white/5 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.snapshots.length === 0) {
    return (
      <div className="mt-8 p-6 rounded-lg bg-white/5 border border-white/10 text-center text-sm text-white/50 space-y-3">
        <BarChart3 className="w-8 h-8 mx-auto opacity-50" />
        <p>Noch keine Qualitäts-Historie verfügbar.</p>
        <p className="text-xs text-white/30">Klicke auf „Qualitäts-Historie berechnen“ (unten rechts) um die Daten für dieses Portfolio zu berechnen. Der Backfill dauert ca. 1–2 Minuten.</p>
      </div>
    );
  }

  const latest = data.latestSnapshot;
  const delta = data.deltaSnapshot;
  const events = data.optimizationEvents;

  // Get latest values (prefer latestSnapshot, fallback to last in array)
  const lastSnap = data.snapshots[data.snapshots.length - 1];
  const sharpe = latest?.avgSharpe ?? lastSnap?.avgSharpe ?? null;
  const volatility = latest?.volatility ?? lastSnap?.volatility ?? null;
  const maxDrawdown = latest?.maxDrawdown ?? lastSnap?.maxDrawdown ?? null;
  const avgBeta = latest?.avgBeta ?? lastSnap?.avgBeta ?? null;
  const avgPEG = latest?.avgPEG ?? lastSnap?.avgPEG ?? null;
  const avgDivYield = latest?.avgDividendYield ?? lastSnap?.avgDividendYield ?? null;
  const qualityScore = latest?.qualityScore ?? null;

  // Compute deltas (vs 30 days ago)
  const calcDelta = (current: number | null, prev: number | null) => {
    if (current == null || prev == null) return null;
    const d = current - prev;
    return Math.abs(d) < 0.001 ? null : d;
  };
  const sharpeDelta = calcDelta(sharpe, delta?.avgSharpe ?? null);
  const qualityDelta = calcDelta(qualityScore, delta?.qualityScore ?? null);

  return (
    <div className="mt-8 space-y-6">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Shield className="w-5 h-5 text-cyan-400" />
          Portfolio-Qualität
        </h3>
        <div className="flex gap-1 bg-white/5 rounded-lg p-1">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                period === p
                  ? "bg-cyan-500/20 text-cyan-400 font-medium"
                  : "text-white/50 hover:text-white/80"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards (§4.1) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPICard
          label="Quality Score"
          value={qualityScore != null ? `${qualityScore}` : "—"}
          unit="/100"
          delta={qualityDelta}
          icon={<Shield className="w-4 h-4" />}
          color="text-cyan-400"
          tooltip="Gewichteter Score aus 5 Komponenten (Rendite 30%, Bewertung 25%, Risiko 20%, Ertrag 15%, Diversifikation 10%)"
        />
        <KPICard
          label="Sharpe"
          value={sharpe != null ? sharpe.toFixed(2) : "—"}
          delta={sharpeDelta}
          icon={<TrendingUp className="w-4 h-4" />}
          color="text-cyan-400"
          tooltip="> 1 = gut, > 1.5 = exzellent. Portfolio-Sharpe aus Wertreihe (rf = 2%)"
        />
        <KPICard
          label="Max Drawdown"
          value={maxDrawdown != null ? `${(maxDrawdown * 100).toFixed(1)}%` : "—"}
          icon={<TrendingDown className="w-4 h-4" />}
          color="text-violet-400"
          tooltip="Grösster Wertverlust vom Höchststand. < -10% = moderat, < -20% = hoch"
        />
        <KPICard
          label="Beta"
          value={avgBeta != null ? avgBeta.toFixed(2) : "—"}
          suffix="aktuell"
          icon={<Shield className="w-4 h-4" />}
          color="text-violet-400"
          tooltip="Gewichteter Ø der Einzeltitel-Betas. < 1 = defensiver als Markt"
        />
        <KPICard
          label="Ø PEG"
          value={avgPEG != null ? avgPEG.toFixed(2) : "—"}
          icon={<BarChart3 className="w-4 h-4" />}
          color="text-amber-400"
          tooltip="< 1.5 = günstig, 1.5–2.5 = fair, > 3 = teuer"
        />
        <KPICard
          label="Div. Rendite"
          value={avgDivYield != null ? `${avgDivYield.toFixed(2)}%` : "—"}
          suffix="brutto"
          icon={<Coins className="w-4 h-4" />}
          color="text-emerald-400"
          tooltip="Gewichtete Brutto-Dividendenrendite des Portfolios"
        />
      </div>

      {/* Small Multiple Panels (§4.2) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SmallMultiplePanel
          title="Risiko & Performance"
          data={data.snapshots}
          lines={[
            { key: "avgSharpe", label: "Sharpe", color: COLORS.sharpe, dominant: true },
            // Volatilität NICHT als Linie: sie ist ein Anteil (0.12 = 12 %) und
            // klebt auf der Sharpe-Skala als flache Null-Linie — stattdessen als
            // aktueller Wert in der Panel-Kopfzeile.
          ]}
          headerNote={volatility != null ? `Volatilität ${(volatility * 100).toFixed(1)} % p.a.` : undefined}
          events={events}
        />
        <SmallMultiplePanel
          title="Bewertung"
          data={data.snapshots}
          lines={[
            { key: "avgPEG", label: "Ø PEG", color: COLORS.peg, dominant: true },
            { key: "avgPE", label: "Ø PE", color: COLORS.pe, dominant: false },
          ]}
          events={events}
          emptyHint="Bewertungs-Historie wächst ab 07/2026"
        />
        <SmallMultiplePanel
          title="Ertrag"
          data={data.snapshots}
          lines={[
            { key: "avgDividendYield", label: "Div. Rendite %", color: COLORS.dividend, dominant: true },
          ]}
          events={events}
        />
      </div>

      {/* Optimization Events (§4.3) */}
      {events.length > 0 && (
        <OptimizationEvents events={events} snapshots={data.snapshots} />
      )}

      {/* Interpretation (§4.5) */}
      <Interpretation
        qualityScore={qualityScore}
        components={latest?.qualityComponents ?? null}
        sharpe={sharpe}
        avgPEG={avgPEG}
        avgDivYield={avgDivYield}
        maxDrawdown={maxDrawdown}
      />
    </div>
  );
}


// --- Sub-Components ---

function KPICard({
  label,
  value,
  unit,
  delta,
  suffix,
  icon,
  color,
  tooltip,
}: {
  label: string;
  value: string;
  unit?: string;
  delta?: number | null;
  suffix?: string;
  icon: React.ReactNode;
  color: string;
  tooltip: string;
}) {
  return (
    <div className="relative group bg-white/5 border border-white/10 rounded-lg p-3 hover:bg-white/[0.08] transition-colors">
      <div className="flex items-center gap-1.5 mb-1">
        <span className={color}>{icon}</span>
        <span className="text-[11px] text-white/50 uppercase tracking-wide">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-xl font-bold text-white">{value}</span>
        {unit && <span className="text-xs text-white/40">{unit}</span>}
      </div>
      {delta != null && (
        <div className={`text-xs mt-0.5 ${delta > 0 ? "text-emerald-400" : "text-red-400"}`}>
          {delta > 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(2)}
        </div>
      )}
      {delta == null && <div className="text-xs mt-0.5 text-white/30">—</div>}
      {suffix && <div className="text-[10px] text-white/30 mt-0.5">{suffix}</div>}
      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 border border-white/20 rounded-lg text-xs text-white/80 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 w-52 text-center whitespace-normal">
        {tooltip}
      </div>
    </div>
  );
}

interface LineConfig {
  key: string;
  label: string;
  color: string;
  dominant: boolean;
}

function SmallMultiplePanel({
  title,
  data,
  lines,
  events,
  emptyHint,
  headerNote,
}: {
  title: string;
  data: any[];
  lines: LineConfig[];
  events: { date: string; label: string }[];
  emptyHint?: string;
  /** Aktueller Zusatzwert in der Kopfzeile (z. B. «Volatilität 14.2 % p.a.»). */
  headerNote?: string;
}) {
  const hasData = data.some((d) => lines.some((l) => d[l.key] != null));

  if (!hasData && emptyHint) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-lg p-4">
        <h4 className="text-sm font-medium text-white/70 mb-3">{title}</h4>
        <div className="h-36 flex items-center justify-center text-xs text-white/40">
          {emptyHint}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-white/70">{title}</h4>
        <div className="flex items-center gap-3">
          {headerNote && (
            <span className="text-[10px] text-white/40">{headerNote}</span>
          )}
          {lines.map((l) => (
            <span key={l.key} className="flex items-center gap-1 text-[10px]">
              <span
                className="w-2.5 h-0.5 rounded-full inline-block"
                style={{ backgroundColor: l.color, opacity: l.dominant ? 1 : 0.5 }}
              />
              <span className="text-white/50">{l.label}</span>
            </span>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }}
            tickFormatter={(v: string) => {
              const d = new Date(v);
              return `${d.getDate()}.${d.getMonth() + 1}`;
            }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }}
            width={35}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "rgba(15,23,42,0.95)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "8px",
              fontSize: "11px",
            }}
            labelFormatter={(v: string) => new Date(v).toLocaleDateString("de-CH")}
          />
          {events.map((ev) => (
            <ReferenceLine
              key={ev.date}
              x={ev.date}
              stroke={COLORS.event}
              strokeDasharray="4 2"
              strokeWidth={1}
              opacity={0.6}
            />
          ))}
          {lines.map((l) => (
            <Line
              key={l.key}
              type="monotone"
              dataKey={l.key}
              stroke={l.color}
              strokeWidth={l.dominant ? 2.5 : 1.5}
              strokeOpacity={l.dominant ? 1 : 0.5}
              dot={false}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function OptimizationEvents({
  events,
  snapshots,
}: {
  events: { date: string; label: string }[];
  snapshots: any[];
}) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-white/70 flex items-center gap-2">
        <Zap className="w-4 h-4 text-amber-400" />
        Optimierungs-Events
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {events.slice(-3).map((ev) => {
          const evDate = ev.date;
          const before = snapshots.filter((s) => s.date < evDate).slice(-1)[0];
          const afterDate = addDays(evDate, 7);
          const after = snapshots.filter((s) => s.date > evDate && s.date <= afterDate).slice(-1)[0];

          return (
            <div key={ev.date} className="bg-white/5 border border-amber-500/20 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs text-white/60">
                  {new Date(ev.date).toLocaleDateString("de-CH")} · {ev.label}
                </span>
              </div>
              {before && after ? (
                <div className="space-y-1.5 text-xs">
                  <MetricDelta label="Sharpe" before={before.avgSharpe} after={after.avgSharpe} />
                  <MetricDelta label="Ø PEG" before={before.avgPEG} after={after.avgPEG} invert />
                  <MetricDelta label="Div. %" before={before.avgDividendYield} after={after.avgDividendYield} />
                  <MetricDelta label="Beta" before={before.avgBeta} after={after.avgBeta} invert />
                </div>
              ) : (
                <div className="text-xs text-white/40">
                  {!before ? "Keine Vorher-Daten verfügbar" : "Nachher-Daten noch nicht verfügbar"}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MetricDelta({
  label,
  before,
  after,
  invert = false,
}: {
  label: string;
  before: number | null;
  after: number | null;
  invert?: boolean;
}) {
  if (before == null || after == null) return null;
  const diff = after - before;
  const isGood = invert ? diff < 0 : diff > 0;

  return (
    <div className="flex items-center justify-between">
      <span className="text-white/50">{label}</span>
      <span className="flex items-center gap-2">
        <span className="text-white/40">{before.toFixed(2)}</span>
        <span className="text-white/30">→</span>
        <span className="text-white/80">{after.toFixed(2)}</span>
        <span className={isGood ? "text-emerald-400" : "text-red-400"}>
          {isGood ? "▲" : "▼"}
        </span>
      </span>
    </div>
  );
}

function Interpretation({
  qualityScore,
  components,
  sharpe,
  avgPEG,
  avgDivYield,
  maxDrawdown,
}: {
  qualityScore: number | null;
  components: any[] | null;
  sharpe: number | null;
  avgPEG: number | null;
  avgDivYield: number | null;
  maxDrawdown: number | null;
}) {
  if (qualityScore == null || !components) return null;

  // Build interpretation text (§4.5 — regelbasiert, deterministisch)
  const parts: string[] = [];

  if (qualityScore >= 75) {
    parts.push(`Das Portfolio erreicht einen Quality Score von ${qualityScore}/100 — eine starke Gesamtbewertung.`);
  } else if (qualityScore >= 50) {
    parts.push(`Das Portfolio erreicht einen Quality Score von ${qualityScore}/100 — solide, mit Verbesserungspotenzial.`);
  } else {
    parts.push(`Das Portfolio erreicht einen Quality Score von ${qualityScore}/100 — hier besteht deutliches Optimierungspotenzial.`);
  }

  const sorted = [...components].filter((c: any) => c.available).sort((a: any, b: any) => b.score - a.score);
  if (sorted.length >= 2) {
    parts.push(
      `Stärkste Komponente: ${sorted[0].name} (${sorted[0].score}/100). Schwächste: ${sorted[sorted.length - 1].name} (${sorted[sorted.length - 1].score}/100).`
    );
  }

  if (sharpe != null && sharpe < 0) {
    parts.push("Achtung: Die Sharpe-Ratio ist negativ — das Portfolio hat risikoadjustiert an Wert verloren.");
  }
  if (avgPEG != null && avgPEG > 3) {
    parts.push(`Der Ø-PEG von ${avgPEG.toFixed(1)} deutet auf eine hohe Bewertung hin.`);
  }
  if (maxDrawdown != null && maxDrawdown < -0.20) {
    parts.push(`Der Max Drawdown von ${(maxDrawdown * 100).toFixed(1)}% ist erheblich — Risikomanagement prüfen.`);
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-4">
      <div className="flex items-start gap-2">
        <Info className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
        <div>
          <h4 className="text-sm font-medium text-white/70 mb-1">Aktuelle Einschätzung</h4>
          <p className="text-xs text-white/60 leading-relaxed">
            {parts.join(" ")}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {components
              .filter((c: any) => c.available)
              .map((c: any) => (
                <span
                  key={c.name}
                  className={`text-[10px] px-2 py-0.5 rounded-full border ${
                    c.score >= 70
                      ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                      : c.score >= 40
                      ? "border-amber-500/30 text-amber-400 bg-amber-500/10"
                      : "border-red-500/30 text-red-400 bg-red-500/10"
                  }`}
                >
                  {c.name}: {c.score}
                </span>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
