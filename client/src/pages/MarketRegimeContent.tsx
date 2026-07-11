/**
 * Markt-Regime-Seite (Redesign R1–R3 + R5, Konzept MARKET_REGIME_CONCEPT.md).
 * Marktampel-Gauge (Score −100…+100) + Klartext, 7 benannte/gewichtete Signal-
 * Dimensionen mit divergierenden Balken & Tooltips, Transparenz und persönliche
 * Einordnung (Regime × Anlageprofil). Behebt: Score-Format, leere Balken, Titel.
 */
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { RefreshCw, Info, Target } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type RegimeLevel = "bullish" | "neutral" | "bearish";

// Dimensions-Metadaten: echter Name, was gemessen wird (Klartext), Tooltip, Gewicht.
const DIM_META: Record<string, { name: string; sub: string; tip: string; weight: number }> = {
  trend: { name: "Trend", sub: "Aktien über 200-Tage-Schnitt", weight: 30,
    tip: "Liegt der breite Markt (S&P 500) über seinem 200-Tage-Durchschnitt und zeigt ein «Golden Cross»? Klassischer Trendfilter." },
  volatility: { name: "Volatilität", sub: "VIX-Niveau & -Trend", weight: 20,
    tip: "Der VIX misst die erwartete Schwankung. Niedrig & fallend = ruhiger Markt (gut); hoch & steigend = Stress." },
  breadth: { name: "Marktbreite", sub: "Gleich- vs. kapitalgewichtet", weight: 15,
    tip: "Vergleicht den gleichgewichteten (RSP) mit dem kapitalgewichteten Markt (SPY). Bleibt RSP zurück, tragen nur wenige grosse Titel — schwache Breite." },
  liquidity: { name: "Liquidität", sub: "Zinsen & USD-Impuls", weight: 15,
    tip: "Anleihen (TLT) und US-Dollar als Gradmesser der Finanzierungsbedingungen — locker (gut) vs. straff." },
  credit: { name: "Credit-Spreads", sub: "Ramsch- vs. Qualitätsanleihen", weight: 10,
    tip: "Verhältnis HYG/LQD (High-Yield zu Investment-Grade). Enger werdende Spreads = Vertrauen, weiter werdende = Risikoaversion." },
  sentiment: { name: "Stimmung", sub: "VIX-Extreme (kontrarisch)", weight: 5,
    tip: "Extreme Sorglosigkeit oder Panik als Gegenindikator: sehr niedrige Angst kann Vorsicht rechtfertigen." },
  bubble: { name: "Blasenrisiko", sub: "LPPL-Überhitzung", weight: 5,
    tip: "Ein Modell (LPPL) erkennt exponentiell überhitzte, blasenartige Kursverläufe." },
};
const DIM_ORDER = ["trend", "volatility", "breadth", "liquidity", "credit", "sentiment", "bubble"];

const LEVEL_LABEL: Record<RegimeLevel, string> = { bullish: "Bullish", neutral: "Neutral", bearish: "Bearish" };
const levelColor = (l: RegimeLevel) =>
  l === "bullish" ? "text-emerald-400" : l === "bearish" ? "text-red-400" : "text-amber-400";
const levelBar = (l: RegimeLevel) =>
  l === "bullish" ? "#34d399" : l === "bearish" ? "#f87171" : "#fbbf24";

function regimeTone(regime: string) {
  const r = (regime || "").toLowerCase();
  if (r.includes("on")) return { label: "Risk-On", cls: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", phrase: "Die Marktampel steht auf Grün" };
  if (r.includes("neutral")) return { label: "Neutral", cls: "bg-amber-500/20 text-amber-400 border-amber-500/30", phrase: "Die Marktampel steht auf Gelb" };
  if (r.includes("defensive")) return { label: "Defensiv", cls: "bg-orange-500/20 text-orange-400 border-orange-500/30", phrase: "Die Ampel mahnt zur Vorsicht" };
  return { label: "Risk-Off", cls: "bg-red-500/20 text-red-400 border-red-500/30", phrase: "Die Ampel steht auf Rot" };
}

// Info-Tooltip (Hover), 50+-tauglich.
function InfoTip({ text }: { text: string }) {
  return (
    <span className="relative group inline-flex">
      <Info className="w-3.5 h-3.5 text-gray-500 cursor-help" />
      <span className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-64 bg-[#1a1f2e] border border-white/20 rounded-lg px-3 py-2 text-[11px] text-gray-300 leading-relaxed shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
        {text}
      </span>
    </span>
  );
}

// Divergierender Balken: Mitte = neutral, links (bearish) rot, rechts (bullish) grün.
function DivBar({ score, level }: { score: number; level: RegimeLevel }) {
  const s = Math.max(-1, Math.min(1, score));
  const pct = Math.min(50, Math.abs(s) * 50);
  const color = levelBar(level);
  return (
    <div className="relative h-3 rounded-full bg-[#0a0f1a] border border-white/5">
      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/20" />
      <div
        className="absolute top-0 bottom-0 rounded-full"
        style={s >= 0
          ? { left: "50%", width: `${pct}%`, background: color }
          : { right: "50%", width: `${pct}%`, background: color }}
      />
    </div>
  );
}

// Marktampel-Gauge: Score −1…+1 → Nadel; Bogen Risk-Off (rot) → Risk-On (grün).
function Gauge({ score }: { score: number }) {
  const s = Math.max(-1, Math.min(1, score));
  const deg = s * 90; // −90° (links) … +90° (rechts)
  const shown = `${s >= 0 ? "+" : ""}${Math.round(s * 100)}`;
  return (
    <svg viewBox="0 0 300 175" className="w-full max-w-[280px]" role="img" aria-label={`Regime-Score ${shown}`}>
      <defs>
        <linearGradient id="regimeGauge" x1="0" x2="1">
          <stop offset="0" stopColor="#f87171" /><stop offset="0.5" stopColor="#fbbf24" /><stop offset="1" stopColor="#34d399" />
        </linearGradient>
      </defs>
      <path d="M30 152 A122 122 0 0 1 270 152" fill="none" stroke="#16212e" strokeWidth="18" strokeLinecap="round" />
      <path d="M30 152 A122 122 0 0 1 270 152" fill="none" stroke="url(#regimeGauge)" strokeWidth="18" strokeLinecap="round" opacity="0.95" />
      <g transform={`rotate(${deg} 150 152)`}>
        <line x1="150" y1="152" x2="150" y2="56" stroke="#eaf3f4" strokeWidth="4" strokeLinecap="round" />
        <circle cx="150" cy="152" r="8" fill="#eaf3f4" />
      </g>
      <text x="34" y="170" fill="#6b7280" fontSize="10">Risk-Off</text>
      <text x="232" y="170" fill="#6b7280" fontSize="10">Risk-On</text>
      <text x="150" y="104" textAnchor="middle" fill="#ffffff" fontSize="30" fontWeight="800" fontFamily="ui-sans-serif,system-ui">{shown}</text>
      <text x="150" y="124" textAnchor="middle" fill="#6b7280" fontSize="10">Skala −100 … +100</text>
    </svg>
  );
}

const RISK_LABEL: Record<string, string> = {
  konservativ: "Konservativ", ausgewogen: "Ausgewogen", wachstum: "Wachstum", aggressiv: "Aggressiv",
};

export default function MarketRegimeContent() {
  const { data: regimeData, isLoading, refetch, isFetching } = trpc.marketRegime.getRegime.useQuery(undefined, {
    staleTime: 60000, retry: 1,
  });
  const { data: profile } = trpc.investmentProfile.get.useQuery(undefined, { retry: false });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-[#00CFC1] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!regimeData) {
    return (
      <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/20">
        <CardContent className="p-6 text-center">
          <p className="text-gray-400">Keine Regime-Daten verfügbar</p>
          <Button onClick={() => refetch()} className="mt-4 bg-[#00CFC1] hover:bg-[#00CFC1]/80 text-black">
            <RefreshCw className="w-4 h-4 mr-2" /> Erneut laden
          </Button>
        </CardContent>
      </Card>
    );
  }

  const tone = regimeTone(regimeData.overallRegime);
  const engines: Record<string, any> = regimeData.engines || {};
  const dims = DIM_ORDER
    .filter((k) => engines[k])
    .map((k) => ({ key: k, meta: DIM_META[k], e: engines[k] as { label: string; score: number; level: RegimeLevel; description: string } }));

  // Klartext-Satz aus den stärksten Treibern/Bremsen (nach Gewicht).
  const withData = dims.filter((d) => d.e.label !== "Ungenügend Daten" && d.e.label !== "Fehler");
  const bulls = withData.filter((d) => d.e.level === "bullish").sort((a, b) => b.meta.weight - a.meta.weight);
  const bears = withData.filter((d) => d.e.level === "bearish").sort((a, b) => b.meta.weight - a.meta.weight);
  const read =
    `${tone.phrase}. ` +
    (bulls.length ? `Getragen von ${bulls.slice(0, 2).map((b) => b.meta.name).join(" und ")}` : "Wenige positive Treiber") +
    (bears.length ? `, gebremst von ${bears.slice(0, 2).map((b) => b.meta.name).join(" und ")}.` : ".");

  const lastUpdated = regimeData.lastUpdated ? new Date(regimeData.lastUpdated).toLocaleString("de-CH") : null;

  // «Für mich» (R5): Regime × Anlageprofil.
  const personal = (() => {
    if (!profile?.isSet) return null;
    const rl = RISK_LABEL[profile.riskProfile] ?? profile.riskProfile;
    const on = tone.label === "Risk-On";
    const off = tone.label === "Risk-Off";
    const range = on ? "im oberen Bereich Ihres Rahmens vertretbar" : off ? "eher am unteren Rand Ihres Rahmens angezeigt" : "in der Mitte Ihres Rahmens angemessen";
    const caveat = bears.length ? ` Achten Sie aber auf ${bears[0].meta.name.toLowerCase()} — behalten Sie Ihren Cash-Puffer.` : "";
    return `${tone.label} trifft auf Ihr Profil «${rl}»: Eine Aktienquote ist ${range}.${caveat}`;
  })();

  return (
    <div className="space-y-6">
      {/* Marktampel */}
      <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/20">
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <h3 className="text-lg font-semibold text-white">Markt-Regime</h3>
              {lastUpdated && <p className="text-xs text-gray-500">Stand: {lastUpdated} · Quelle: EODHD</p>}
            </div>
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${tone.cls}`}>{tone.label}</span>
              <Button onClick={() => refetch()} variant="ghost" size="sm" className="text-gray-400 hover:text-white" disabled={isFetching}>
                <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>

          <div className="grid md:grid-cols-[280px_1fr] gap-6 items-center">
            <div className="flex justify-center"><Gauge score={regimeData.overallScore} /></div>
            <div>
              <p className="text-white text-[15px] font-medium mb-4">{read}</p>
              <div className="flex flex-wrap gap-6">
                <div>
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Empf. Aktienquote</p>
                  <p className="text-2xl font-bold font-mono text-[#00CFC1]">{regimeData.equityAllocation}%</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Regime-Multiplikator</p>
                  <p className="text-2xl font-bold font-mono text-white">{regimeData.regimeMultiplier}×</p>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-3">Diese Grössen steuern Optimierung und Empfehlungen für Ihre Portfolios.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* «Für mich» */}
      {personal ? (
        <Card className="bg-[#1a1f2e] border-white/10">
          <CardContent className="p-5 flex items-start gap-3">
            <Target className="w-4 h-4 text-[#00CFC1] mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-white mb-0.5">Was heisst das für mich?</p>
              <p className="text-sm text-gray-300">{personal}</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-[#1a1f2e] border-white/10">
          <CardContent className="p-5 flex items-center justify-between gap-3">
            <p className="text-sm text-gray-400">Für eine persönliche Einordnung hinterlegen Sie Ihr Anlageprofil.</p>
            <Link href="/einstellungen?tab=anlageprofil" className="text-sm text-[#00CFC1] hover:underline shrink-0">Anlageprofil</Link>
          </CardContent>
        </Card>
      )}

      {/* Signal-Dimensionen */}
      <Card className="bg-[#1a1f2e] border-white/10">
        <CardContent className="p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Signal-Dimensionen</p>
          <div className="divide-y divide-white/5">
            {dims.map(({ key, meta, e }) => {
              const noData = e.label === "Ungenügend Daten" || e.label === "Fehler";
              return (
                <div key={key} className="grid grid-cols-[minmax(120px,180px)_1fr_auto] gap-3 md:gap-4 items-center py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-white truncate">{meta.name}</span>
                      <InfoTip text={meta.tip} />
                    </div>
                    <span className="text-[11px] text-gray-500">{meta.sub} · {meta.weight}%</span>
                  </div>
                  {noData ? (
                    <div className="text-xs text-gray-500 italic">{e.label}</div>
                  ) : (
                    <DivBar score={e.score} level={e.level} />
                  )}
                  <div className="text-right min-w-[110px]">
                    <span className={`text-xs font-semibold ${noData ? "text-gray-500" : levelColor(e.level)}`}>
                      {noData ? "—" : LEVEL_LABEL[e.level]}
                    </span>
                    <p className="text-[11px] text-gray-500 truncate max-w-[220px]">{e.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-gray-500 mt-3">
            Balken: links (rot) = negativ, Mitte = neutral, rechts (grün) = positiv. Der Gesamtscore ist die
            gewichtete Summe (Trend 30 %, Volatilität 20 %, Marktbreite/Liquidität je 15 %, Credit 10 %, Stimmung/Blase je 5 %).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
