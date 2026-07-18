/**
 * KpiTooltip — Rich tooltip for financial KPIs.
 *
 * Renders a dark-themed popover with:
 *  - Title + short definition
 *  - Visual scale bar (optional) with colored zones
 *  - Benchmark / interpretation table
 *  - Formula (optional)
 *  - A small inline SVG sparkline / gauge (optional)
 *
 * Usage:
 *   <KpiTooltip kpi="pe"><span>KGV 26.1</span></KpiTooltip>
 */
import React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";
import { Info } from "lucide-react";

// ─── Scale bar ───────────────────────────────────────────────────────────────

interface Zone { label: string; color: string; width: number }

function ScaleBar({ zones, marker, markerLabel }: { zones: Zone[]; marker?: number; markerLabel?: string }) {
  const total = zones.reduce((s, z) => s + z.width, 0);
  return (
    <div className="mt-2 mb-1">
      <div className="flex h-3 rounded overflow-hidden w-full">
        {zones.map((z, i) => (
          <div key={i} style={{ width: `${(z.width / total) * 100}%`, backgroundColor: z.color }} className="relative" title={z.label} />
        ))}
      </div>
      <div className="flex justify-between mt-0.5">
        {zones.map((z, i) => (
          <span key={i} style={{ color: z.color }} className="text-[9px] font-medium">{z.label}</span>
        ))}
      </div>
    </div>
  );
}

// ─── Benchmark table ─────────────────────────────────────────────────────────

interface BenchRow { range: string; label: string; color: string }

function BenchTable({ rows }: { rows: BenchRow[] }) {
  return (
    <div className="mt-2 space-y-0.5">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: r.color }} />
          <span className="text-[10px] font-mono text-gray-300 w-16 flex-shrink-0">{r.range}</span>
          <span className="text-[10px] text-gray-400">{r.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Mini gauge SVG ──────────────────────────────────────────────────────────

function MiniGauge({ value, min, max, color }: { value: number; min: number; max: number; color: string }) {
  const pct = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const angle = -135 + pct * 270; // -135° to +135°
  const r = 22, cx = 30, cy = 30;
  const toXY = (deg: number) => {
    const rad = (deg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };
  const start = toXY(-135), end = toXY(135), needle = toXY(angle);
  return (
    <svg width="60" height="40" viewBox="0 0 60 40" className="overflow-visible">
      {/* Track */}
      <path d={`M ${start.x} ${start.y} A ${r} ${r} 0 1 1 ${end.x} ${end.y}`} fill="none" stroke="#334155" strokeWidth="4" strokeLinecap="round" />
      {/* Fill */}
      <path d={`M ${start.x} ${start.y} A ${r} ${r} 0 ${pct > 0.5 ? 1 : 0} 1 ${needle.x} ${needle.y}`} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" />
      {/* Needle dot */}
      <circle cx={needle.x} cy={needle.y} r="3" fill={color} />
    </svg>
  );
}

// ─── KPI definitions ─────────────────────────────────────────────────────────

export type KpiKey =
  | "pe" | "peg" | "beta" | "dividend" | "sharpe" | "volatility"
  | "maxDrawdown" | "var" | "correlation" | "alpha" | "treynor"
  | "score" | "momentum" | "earningsGrowth" | "debtEquity" | "roe";

interface KpiDef {
  title: string;
  subtitle: string;
  formula?: string;
  description: string;
  scaleZones?: Zone[];
  benchRows?: BenchRow[];
  tip?: string;
}

const KPI_DEFS: Record<KpiKey, KpiDef> = {
  pe: {
    title: "KGV — Kurs-Gewinn-Verhältnis",
    subtitle: "Price-to-Earnings Ratio (P/E)",
    formula: "KGV = Aktienkurs ÷ Gewinn je Aktie",
    description:
      "Zeigt, wie viel Anleger bereit sind, für jeden Franken Unternehmensgewinn zu bezahlen. Ein niedriges KGV kann auf eine Unterbewertung hindeuten, ein hohes auf hohe Wachstumserwartungen.",
    scaleZones: [
      { label: "Günstig", color: "#22c55e", width: 25 },
      { label: "Normal", color: "#f59e0b", width: 35 },
      { label: "Teuer", color: "#ef4444", width: 40 },
    ],
    benchRows: [
      { range: "< 15", label: "Günstig bewertet (Value-Bereich)", color: "#22c55e" },
      { range: "15 – 25", label: "Faire Bewertung (Marktdurchschnitt ~20)", color: "#f59e0b" },
      { range: "25 – 40", label: "Wachstumsaktie, erhöhte Erwartungen", color: "#f97316" },
      { range: "> 40", label: "Sehr teuer oder Verlustphase", color: "#ef4444" },
    ],
    tip: "Historischer S&P 500-Durchschnitt: ~17–20. Tech-Sektor oft 30–50+.",
  },
  peg: {
    title: "PEG — Price/Earnings-to-Growth",
    subtitle: "KGV bereinigt um Gewinnwachstum",
    formula: "PEG = KGV ÷ Erwartetes Gewinnwachstum (%)",
    description:
      "Setzt das KGV ins Verhältnis zum Gewinnwachstum. Ein PEG < 1 gilt als günstig, weil das Wachstum die hohe Bewertung rechtfertigt. Erfunden von Peter Lynch.",
    scaleZones: [
      { label: "Günstig", color: "#22c55e", width: 33 },
      { label: "Fair", color: "#f59e0b", width: 34 },
      { label: "Teuer", color: "#ef4444", width: 33 },
    ],
    benchRows: [
      { range: "< 1.0", label: "Günstig — Wachstum rechtfertigt Preis", color: "#22c55e" },
      { range: "1.0 – 2.0", label: "Fair bewertet", color: "#f59e0b" },
      { range: "> 2.0", label: "Teuer relativ zum Wachstum", color: "#ef4444" },
      { range: "negativ", label: "Negatives Wachstum — nicht aussagekräftig", color: "#64748b" },
    ],
    tip: "PEG ignoriert Schulden und Qualität. Nur in Kombination mit anderen Kennzahlen verwenden.",
  },
  beta: {
    title: "Beta — Marktrisiko",
    subtitle: "Sensitivität gegenüber dem Gesamtmarkt",
    formula: "Beta = Kovarianz(Aktie, Markt) ÷ Varianz(Markt)",
    description:
      "Misst, wie stark eine Aktie auf Marktbewegungen reagiert. Beta 1.0 = bewegt sich wie der Markt. Beta 0.5 = halb so volatil. Beta 2.0 = doppelt so volatil.",
    scaleZones: [
      { label: "Defensiv", color: "#22c55e", width: 30 },
      { label: "Markt", color: "#f59e0b", width: 30 },
      { label: "Aggressiv", color: "#ef4444", width: 40 },
    ],
    benchRows: [
      { range: "< 0.8", label: "Defensiv — weniger volatil als der Markt", color: "#22c55e" },
      { range: "0.8 – 1.2", label: "Marktähnlich — normale Schwankungen", color: "#f59e0b" },
      { range: "1.2 – 1.8", label: "Aggressiv — stärker als der Markt", color: "#f97316" },
      { range: "> 1.8", label: "Sehr aggressiv — hohes Risiko", color: "#ef4444" },
    ],
    tip: "Negative Beta (z.B. Gold) bedeutet: Aktie steigt wenn Markt fällt — natürlicher Hedge.",
  },
  dividend: {
    title: "Dividendenrendite",
    subtitle: "Jährliche Ausschüttung in % des Kurses",
    formula: "Dividendenrendite = Dividende je Aktie ÷ Aktienkurs × 100",
    description:
      "Zeigt, wie viel Prozent des investierten Kapitals jährlich als Dividende ausgeschüttet wird. Hohe Rendite kann attraktiv sein, aber auch auf Kursrückgang oder Risiko hinweisen.",
    scaleZones: [
      { label: "Niedrig", color: "#64748b", width: 25 },
      { label: "Moderat", color: "#22c55e", width: 35 },
      { label: "Hoch", color: "#f59e0b", width: 25 },
      { label: "Risiko?", color: "#ef4444", width: 15 },
    ],
    benchRows: [
      { range: "0 – 1%", label: "Wachstumsorientiert, kaum Ausschüttung", color: "#64748b" },
      { range: "1 – 3%", label: "Moderat — typischer Schweizer Markt", color: "#22c55e" },
      { range: "3 – 6%", label: "Attraktiv — guter Einkommensstrom", color: "#f59e0b" },
      { range: "> 6%", label: "Sehr hoch — Nachhaltigkeit prüfen!", color: "#ef4444" },
    ],
    tip: "Dividenden-Aristokraten: Unternehmen mit 25+ Jahren steigender Dividende.",
  },
  sharpe: {
    title: "Sharpe Ratio",
    subtitle: "Rendite pro Risikoeinheit",
    formula: "Sharpe = (Portfolio-Rendite − Risikofreier Zins) ÷ Volatilität",
    description:
      "Misst die risikobereinigte Rendite. Je höher, desto besser wird das eingegangene Risiko entlohnt. Entwickelt von William F. Sharpe (Nobelpreisträger 1990).",
    scaleZones: [
      { label: "Schlecht", color: "#ef4444", width: 25 },
      { label: "Akzeptabel", color: "#f59e0b", width: 35 },
      { label: "Gut", color: "#22c55e", width: 25 },
      { label: "Exzellent", color: "#00CFC1", width: 15 },
    ],
    benchRows: [
      { range: "< 0.5", label: "Schlechte Risikovergütung", color: "#ef4444" },
      { range: "0.5 – 1.0", label: "Akzeptabel", color: "#f59e0b" },
      { range: "1.0 – 2.0", label: "Gut — empfehlenswert", color: "#22c55e" },
      { range: "> 2.0", label: "Exzellent (selten nachhaltig)", color: "#00CFC1" },
    ],
    tip: "S&P 500 langfristig: ~0.4–0.6. Hedge Funds streben > 1.0 an.",
  },
  volatility: {
    title: "Volatilität (Standardabweichung)",
    subtitle: "Schwankungsbreite der Renditen",
    formula: "σ = Standardabweichung der täglichen/jährlichen Renditen",
    description:
      "Misst, wie stark die Renditen um den Durchschnitt schwanken. Hohe Volatilität = grosse Ausschläge nach oben UND unten. Annualisiert (×√252 für Tagesrenditen).",
    scaleZones: [
      { label: "Defensiv", color: "#22c55e", width: 30 },
      { label: "Normal", color: "#f59e0b", width: 35 },
      { label: "Aggressiv", color: "#ef4444", width: 35 },
    ],
    benchRows: [
      { range: "< 10%", label: "Sehr defensiv (Anleihen, Versorger)", color: "#22c55e" },
      { range: "10 – 20%", label: "Normaler Aktienmarkt (S&P 500 ~15%)", color: "#f59e0b" },
      { range: "20 – 35%", label: "Erhöht — Wachstums-/Technologieaktien", color: "#f97316" },
      { range: "> 35%", label: "Sehr hoch — Spekulation / Krypto-Niveau", color: "#ef4444" },
    ],
    tip: "Volatilität ist symmetrisch — sie misst auch positive Ausschläge.",
  },
  maxDrawdown: {
    title: "Maximum Drawdown",
    subtitle: "Grösster historischer Verlust vom Höchststand",
    formula: "MDD = (Tiefstkurs − Höchstkurs) ÷ Höchstkurs × 100",
    description:
      "Zeigt den grössten prozentualen Verlust vom Höchststand bis zum Tiefpunkt in einem bestimmten Zeitraum. Wichtige Kennzahl für das Verlustrisiko.",
    scaleZones: [
      { label: "Gering", color: "#22c55e", width: 30 },
      { label: "Moderat", color: "#f59e0b", width: 35 },
      { label: "Hoch", color: "#ef4444", width: 35 },
    ],
    benchRows: [
      { range: "0 – 10%", label: "Gering — defensives Portfolio", color: "#22c55e" },
      { range: "10 – 20%", label: "Moderat — normaler Bärenmarkt", color: "#f59e0b" },
      { range: "20 – 40%", label: "Hoch — S&P 500 in Krisen (~34% in 2020)", color: "#f97316" },
      { range: "> 40%", label: "Sehr hoch — erhebliches Verlustrisiko", color: "#ef4444" },
    ],
    tip: "S&P 500 Drawdown: 2000–2002: −49%, 2008–2009: −57%, 2020: −34%.",
  },
  var: {
    title: "Value at Risk (VaR)",
    subtitle: "Maximaler erwarteter Verlust (95% Konfidenz)",
    formula: "VaR₉₅ = μ − 1.645 × σ (bei Normalverteilung)",
    description:
      "Gibt an, welchen Verlust das Portfolio in einem bestimmten Zeitraum mit 95% Wahrscheinlichkeit nicht überschreiten wird. Beispiel: VaR = −3% bedeutet: In 95% aller Tage verliert das Portfolio nicht mehr als 3%.",
    benchRows: [
      { range: "0 – 1%", label: "Sehr defensiv", color: "#22c55e" },
      { range: "1 – 2%", label: "Normal für diversifiziertes Portfolio", color: "#f59e0b" },
      { range: "2 – 4%", label: "Erhöht — konzentriertes Portfolio", color: "#f97316" },
      { range: "> 4%", label: "Hoch — Klumpenrisiken vorhanden", color: "#ef4444" },
    ],
    tip: "VaR sagt nichts über Verluste jenseits der 5% aus (Tail Risk).",
  },
  correlation: {
    title: "Durchschnittliche Korrelation",
    subtitle: "Gleichlauf der Positionen untereinander",
    formula: "ρ = Kovarianz(A,B) ÷ (σ_A × σ_B), Bereich: −1 bis +1",
    description:
      "Misst, wie stark sich die Positionen im Portfolio gemeinsam bewegen. Niedrige Korrelation = bessere Diversifikation = weniger Gesamtrisiko.",
    scaleZones: [
      { label: "Gut diversifiziert", color: "#22c55e", width: 35 },
      { label: "Moderat", color: "#f59e0b", width: 35 },
      { label: "Klumpenrisiko", color: "#ef4444", width: 30 },
    ],
    benchRows: [
      { range: "< 0.3", label: "Sehr gut diversifiziert", color: "#22c55e" },
      { range: "0.3 – 0.6", label: "Moderate Diversifikation", color: "#f59e0b" },
      { range: "0.6 – 0.8", label: "Erhöhter Gleichlauf", color: "#f97316" },
      { range: "> 0.8", label: "Klumpenrisiko — kaum Diversifikation", color: "#ef4444" },
    ],
    tip: "Aktien im gleichen Sektor haben oft Korrelationen von 0.7–0.9.",
  },
  alpha: {
    title: "Alpha (Jensen's Alpha)",
    subtitle: "Mehrrendite gegenüber dem Benchmark",
    formula: "α = Portfolio-Rendite − [Rf + β × (Rm − Rf)]",
    description:
      "Misst die Überrendite eines Portfolios gegenüber dem, was aufgrund seines Marktrisikos (Beta) erwartet wird. Positives Alpha = Manager-Mehrwert.",
    benchRows: [
      { range: "< 0%", label: "Underperformance gegenüber Benchmark", color: "#ef4444" },
      { range: "0 – 2%", label: "Leichte Outperformance", color: "#f59e0b" },
      { range: "2 – 5%", label: "Gute Outperformance", color: "#22c55e" },
      { range: "> 5%", label: "Exzellente Outperformance (selten)", color: "#00CFC1" },
    ],
    tip: "Langfristig schlagen ~80% der aktiven Fonds ihren Benchmark nicht.",
  },
  treynor: {
    title: "Treynor Ratio",
    subtitle: "Rendite pro Marktrisiko-Einheit (Beta)",
    formula: "Treynor = (Portfolio-Rendite − Risikofreier Zins) ÷ Beta",
    description:
      "Ähnlich wie Sharpe, aber dividiert durch Beta statt Volatilität. Misst, wie gut das systematische Marktrisiko entlohnt wird. Besonders nützlich für diversifizierte Portfolios.",
    benchRows: [
      { range: "< 0.05", label: "Schlechte Risikovergütung", color: "#ef4444" },
      { range: "0.05 – 0.15", label: "Akzeptabel", color: "#f59e0b" },
      { range: "> 0.15", label: "Gut", color: "#22c55e" },
    ],
    tip: "Treynor ist sinnvoller als Sharpe wenn das Portfolio Teil eines grösseren Portfolios ist.",
  },
  score: {
    title: "Qualitäts-Score",
    subtitle: "KI-basierter Gesamtscore 0–100",
    description:
      "Kombiniert Fundamentaldaten (KGV, PEG, Wachstum, Dividende), technische Signale (Momentum, Trend) und Risikokennzahlen zu einem einzigen Score. Höher = besser.",
    scaleZones: [
      { label: "Schwach", color: "#ef4444", width: 25 },
      { label: "Neutral", color: "#f59e0b", width: 25 },
      { label: "Gut", color: "#22c55e", width: 25 },
      { label: "Top", color: "#00CFC1", width: 25 },
    ],
    benchRows: [
      { range: "0 – 40", label: "Schwach — Verkaufskandidat", color: "#ef4444" },
      { range: "40 – 60", label: "Neutral — Halten", color: "#f59e0b" },
      { range: "60 – 75", label: "Gut — Kaufkandidat", color: "#22c55e" },
      { range: "75 – 100", label: "Top — starke Kaufempfehlung", color: "#00CFC1" },
    ],
    tip: "Score basiert auf EODHD-Fundamentaldaten und historischen Preisdaten.",
  },
  momentum: {
    title: "Momentum (YTD-Performance)",
    subtitle: "Kursveränderung seit Jahresbeginn",
    formula: "Momentum = (Aktueller Kurs − Kurs 01.01.) ÷ Kurs 01.01. × 100",
    description:
      "Misst die Kursentwicklung seit Jahresbeginn. Starkes positives Momentum deutet auf Marktstärke hin. Momentum-Effekt: Gewinner tendieren kurzfristig dazu, weiter zu gewinnen.",
    scaleZones: [
      { label: "Schwach", color: "#ef4444", width: 25 },
      { label: "Neutral", color: "#f59e0b", width: 25 },
      { label: "Stark", color: "#22c55e", width: 25 },
      { label: "Sehr stark", color: "#00CFC1", width: 25 },
    ],
    benchRows: [
      { range: "< −10%", label: "Schwaches Momentum — Vorsicht", color: "#ef4444" },
      { range: "−10 – 0%", label: "Leicht negativ", color: "#f97316" },
      { range: "0 – 15%", label: "Positiv — Marktkonform", color: "#22c55e" },
      { range: "> 15%", label: "Sehr stark — Outperformer", color: "#00CFC1" },
    ],
    tip: "Momentum-Strategien funktionieren gut über 6–12 Monate, aber nicht über 1 Monat.",
  },
  earningsGrowth: {
    title: "Gewinnwachstum (EPS Growth)",
    subtitle: "Erwartetes Wachstum des Gewinns je Aktie",
    formula: "EPS Growth = (EPS_neu − EPS_alt) ÷ EPS_alt × 100",
    description:
      "Zeigt, wie stark der Gewinn je Aktie wächst. Hohes Wachstum rechtfertigt höhere Bewertungen (KGV). Basis für die PEG-Berechnung.",
    scaleZones: [
      { label: "Schrumpfend", color: "#ef4444", width: 20 },
      { label: "Stagnierend", color: "#f59e0b", width: 25 },
      { label: "Wachsend", color: "#22c55e", width: 30 },
      { label: "Stark", color: "#00CFC1", width: 25 },
    ],
    benchRows: [
      { range: "< 0%", label: "Schrumpfender Gewinn — negatives Signal", color: "#ef4444" },
      { range: "0 – 5%", label: "Stagnierendes Wachstum", color: "#f59e0b" },
      { range: "5 – 15%", label: "Gesundes Wachstum", color: "#22c55e" },
      { range: "> 15%", label: "Starkes Wachstum — Wachstumsaktie", color: "#00CFC1" },
    ],
    tip: "S&P 500 langfristiges EPS-Wachstum: ~7% p.a.",
  },
  debtEquity: {
    title: "Verschuldungsgrad (Debt/Equity)",
    subtitle: "Verhältnis Fremd- zu Eigenkapital",
    formula: "D/E = Gesamtschulden ÷ Eigenkapital",
    description:
      "Misst, wie stark ein Unternehmen mit Fremdkapital finanziert ist. Hoher Wert = mehr Schulden = höheres Finanzierungsrisiko, aber auch Hebeleffekt auf Rendite.",
    scaleZones: [
      { label: "Konservativ", color: "#22c55e", width: 30 },
      { label: "Normal", color: "#f59e0b", width: 35 },
      { label: "Hoch", color: "#ef4444", width: 35 },
    ],
    benchRows: [
      { range: "< 0.5", label: "Konservativ — starke Bilanz", color: "#22c55e" },
      { range: "0.5 – 1.5", label: "Normal für die meisten Sektoren", color: "#f59e0b" },
      { range: "1.5 – 3.0", label: "Erhöht — sektorabhängig bewerten", color: "#f97316" },
      { range: "> 3.0", label: "Sehr hoch — Finanzierungsrisiko", color: "#ef4444" },
    ],
    tip: "Banken und Versorger haben strukturell hohe D/E-Ratios — Sektorvergleich wichtig.",
  },
  roe: {
    title: "Eigenkapitalrendite (ROE)",
    subtitle: "Return on Equity",
    formula: "ROE = Jahresgewinn ÷ Eigenkapital × 100",
    description:
      "Misst, wie effizient ein Unternehmen das Eigenkapital der Aktionäre einsetzt. Hoher ROE = effizientes Unternehmen. Warren Buffett bevorzugt ROE > 15%.",
    scaleZones: [
      { label: "Schwach", color: "#ef4444", width: 25 },
      { label: "Normal", color: "#f59e0b", width: 35 },
      { label: "Gut", color: "#22c55e", width: 25 },
      { label: "Exzellent", color: "#00CFC1", width: 15 },
    ],
    benchRows: [
      { range: "< 5%", label: "Schwach — ineffizienter Kapitaleinsatz", color: "#ef4444" },
      { range: "5 – 15%", label: "Normal — Marktdurchschnitt", color: "#f59e0b" },
      { range: "15 – 25%", label: "Gut — Buffett-Benchmark übertroffen", color: "#22c55e" },
      { range: "> 25%", label: "Exzellent — starker Wettbewerbsvorteil", color: "#00CFC1" },
    ],
    tip: "Sehr hoher ROE kann durch hohe Verschuldung entstehen — immer mit D/E kombinieren.",
  },
};

// ─── Main component ───────────────────────────────────────────────────────────

interface KpiTooltipProps {
  kpi: KpiKey;
  children?: React.ReactNode;
  /** Show just an info icon if no children provided */
  iconOnly?: boolean;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
}

export function KpiTooltip({ kpi, children, iconOnly = false, side = "top", align = "center" }: KpiTooltipProps) {
  const def = KPI_DEFS[kpi];
  if (!def) return <>{children}</>;

  const trigger = iconOnly
    ? <Info className="w-3 h-3 text-gray-500 hover:text-gray-300 cursor-help inline-block ml-1 flex-shrink-0" />
    : children;

  return (
    <TooltipPrimitive.Provider delayDuration={200}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>
          <span className="cursor-help">{trigger}</span>
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            align={align}
            sideOffset={8}
            className={cn(
              "z-50 w-72 rounded-xl border border-white/10 bg-[#0d1220] shadow-2xl shadow-black/50",
              "animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
              "data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2"
            )}
          >
            {/* Header */}
            <div className="px-4 pt-3 pb-2 border-b border-white/10">
              <div className="text-[11px] font-bold text-white leading-tight">{def.title}</div>
              <div className="text-[10px] text-[#00CFC1] mt-0.5">{def.subtitle}</div>
            </div>

            {/* Body */}
            <div className="px-4 py-3 space-y-2.5">
              {/* Description */}
              <p className="text-[11px] text-gray-300 leading-relaxed">{def.description}</p>

              {/* Formula */}
              {def.formula && (
                <div className="bg-white/5 rounded-md px-2.5 py-1.5">
                  <span className="text-[10px] font-mono text-[#00CFC1]">{def.formula}</span>
                </div>
              )}

              {/* Scale bar */}
              {def.scaleZones && <ScaleBar zones={def.scaleZones} />}

              {/* Benchmark table */}
              {def.benchRows && <BenchTable rows={def.benchRows} />}

              {/* Tip */}
              {def.tip && (
                <div className="flex gap-1.5 pt-1 border-t border-white/5">
                  <span className="text-[10px] text-amber-400 flex-shrink-0">💡</span>
                  <span className="text-[10px] text-gray-400 leading-relaxed">{def.tip}</span>
                </div>
              )}
            </div>

            <TooltipPrimitive.Arrow className="fill-[#0d1220]" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}

export default KpiTooltip;
