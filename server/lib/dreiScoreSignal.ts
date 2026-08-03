/**
 * Kauf-/Verkaufssignal aus den drei Scores.
 *
 * Bisher entstand das Signal aus «40 % Momentum + 40 % Qualität − 20 % LPPL»
 * (`blendCombinedScore`). Zwei Dinge stimmten daran nicht:
 *
 *  1. Der Wert hiess «Signal», bestand aber zu 40 % aus Qualität — gerechnet
 *     nach einer VIERTEN Formel, unabhängig vom Qualitäts-Score der Seite. Wer
 *     Qualität und Signal nebeneinander las, zählte Qualität doppelt.
 *  2. Der Klammerzusatz «(Strategie)» in der Oberfläche war kein Name, sondern
 *     die Erklärung für genau diesen Widerspruch.
 *
 * Jetzt ist die Trennung sauber: Qualität misst das Unternehmen, Bewertung den
 * Preis, Timing den Zeitpunkt. Das Signal ist ihre gewichtete Kombination —
 * eine Rechnung, die man aufschreiben und prüfen kann.
 *
 * DIE GEWICHTE SIND VON HAND GESETZT und tragen die Richtung des bisherigen
 * Modells weiter: in der Krise zählt das Unternehmen mehr, im Aufschwung der
 * Zeitpunkt. Sie sind bewusst NICHT als gemessen ausgegeben — die bisherigen
 * 40/40/20 waren es ebenso wenig. Sobald Punkt-in-Zeit-Scores vorliegen, kann
 * der Optimizer genau diese Gewichte tunen; bis dahin sind sie eine begründete
 * Annahme, nicht ein Messergebnis.
 */

import { SCORE_BAENDER, bandFuerScore } from "./signalBlend";

export interface SignalGewichte {
  qualitaet: number;
  bewertung: number;
  timing: number;
}

/**
 * Gewichte je Marktregime.
 *
 * Abgeleitet aus der Logik des bisherigen Modells (`DEFAULT_REGIME_BLEND`):
 * Dort verschob sich das Verhältnis Qualität/Handel von 75:25 in der Krise auf
 * 35:65 im Aufschwung. Dieselbe Richtung, nur mit der Bewertung als eigenem,
 * bisher fehlendem Faktor.
 */
export const DEFAULT_SIGNAL_GEWICHTE: Record<string, SignalGewichte> = {
  crisis:            { qualitaet: 0.55, bewertung: 0.25, timing: 0.20 },
  bear:              { qualitaet: 0.45, bewertung: 0.30, timing: 0.25 },
  recovery:          { qualitaet: 0.30, bewertung: 0.30, timing: 0.40 },
  bull:              { qualitaet: 0.25, bewertung: 0.25, timing: 0.50 },
  sideways_high_vol: { qualitaet: 0.40, bewertung: 0.30, timing: 0.30 },
  sideways_low_vol:  { qualitaet: 0.35, bewertung: 0.30, timing: 0.35 },
  default:           { qualitaet: 0.35, bewertung: 0.30, timing: 0.35 },
};

/**
 * Mindestens so viel Gewicht muss mit Scores belegt sein, sonst kein Signal.
 *
 * Aus einem einzigen der drei Scores eine Kaufempfehlung abzuleiten wäre keine
 * Empfehlung, sondern eine Verkleidung. Dieselbe Haltung wie bei
 * `MIN_ABDECKUNG_SCORE`.
 */
export const MIN_ABDECKUNG_SIGNAL = 0.60;

export interface TimingEingaben {
  /** Momentum-Engine, −1..+1. */
  momentum?: number | null;
  /** Wilder-RSI(14), 0..100. */
  rsi14?: number | null;
  /** Position in der 52-Wochen-Spanne, 0..1 (0 = am Tief). */
  positionIn52W?: number | null;
  /** Kursentwicklung seit Jahresbeginn, in %. */
  ytdPerformance?: number | null;
  /** Blasensignal (LPPL), 0..1 — höher heisst überhitzter. */
  blasenScore?: number | null;
}

export interface TimingErgebnis {
  /** 0–100, oder null, wenn zu wenige Zeitfaktoren vorliegen. */
  score: number | null;
  abdeckung: number;
  faktoren: { name: string; wert: number | null; punkte: number | null; gewicht: number }[];
}

/** Lineare Abbildung von `von`→0 und `bis`→100, gekappt. Fällt `von` > `bis`, dreht die Richtung. */
function punkteAus(wert: number | null | undefined, von: number, bis: number): number | null {
  if (wert === null || wert === undefined || !Number.isFinite(wert)) return null;
  if (von === bis) return 50;
  const anteil = (wert - von) / (bis - von);
  return Math.max(0, Math.min(100, anteil * 100));
}

/**
 * Timing-Score — ausschliesslich aus Grössen, die sich mit der Zeit ändern.
 *
 * KGV, PEG und Dividendenrendite sind hier bewusst NICHT enthalten, obwohl der
 * bisherige `generateSignal` sie mitgewichtete. Sie beschreiben den Preis, und
 * der Preis hat einen eigenen Score. Sie hier erneut zu bewerten hiesse, die
 * Bewertung zweimal zu zählen — derselbe Fehler wie zuvor bei der Qualität,
 * nur eine Ebene tiefer.
 */
export function berechneTiming(e: TimingEingaben): TimingErgebnis {
  const faktoren = [
    {
      name: "Momentum",
      wert: e.momentum ?? null,
      // −1..+1 → 0..100.
      punkte: punkteAus(e.momentum, -1, 1),
      gewicht: 0.35,
    },
    {
      name: "RSI (Rücksetzer)",
      wert: e.rsi14 ?? null,
      // Rückläufig: 30 gilt als überverkauft (gute Gelegenheit), 70 als
      // überkauft. Deshalb von 70 nach 30 abgebildet.
      punkte: punkteAus(e.rsi14, 70, 30),
      gewicht: 0.25,
    },
    {
      name: "Position 52 Wochen",
      wert: e.positionIn52W ?? null,
      // Am Tief ist der Einstieg günstiger als am Hoch.
      punkte: punkteAus(e.positionIn52W, 0.9, 0.1),
      gewicht: 0.20,
    },
    {
      name: "Trend (YTD)",
      wert: e.ytdPerformance ?? null,
      punkte: punkteAus(e.ytdPerformance, -20, 20),
      gewicht: 0.10,
    },
    {
      name: "Blasensignal",
      wert: e.blasenScore ?? null,
      // Rückläufig: je überhitzter, desto schlechter der Zeitpunkt.
      punkte: punkteAus(e.blasenScore, 1, 0),
      gewicht: 0.10,
    },
  ];

  let gewichtet = 0;
  let belegt = 0;
  let gesamt = 0;
  for (const f of faktoren) {
    gesamt += f.gewicht;
    if (f.punkte !== null) {
      gewichtet += f.punkte * f.gewicht;
      belegt += f.gewicht;
    }
  }
  const abdeckung = gesamt > 0 ? belegt / gesamt : 0;
  const score = abdeckung >= MIN_ABDECKUNG_SIGNAL
    ? Math.round((gewichtet / belegt) * 10) / 10
    : null;

  return { score, abdeckung: Math.round(abdeckung * 1000) / 1000, faktoren };
}

export interface SignalEingaben {
  /** Qualitäts-Score 0–100; null = nicht beurteilbar. */
  qualitaet: number | null;
  /** Bewertungs-Score 0–100; null = nicht beurteilbar. */
  bewertung: number | null;
  /** Timing-Score 0–100; null = nicht beurteilbar. */
  timing: number | null;
  /** Regime-Schlüssel; unbekannte fallen auf `default`. */
  regime?: string | null;
}

export interface SignalErgebnis {
  /** 0–100, oder null, wenn zu wenig Gewicht belegt ist. */
  score: number | null;
  label: (typeof SCORE_BAENDER)[number]["signal"] | null;
  grade: (typeof SCORE_BAENDER)[number]["grade"] | null;
  klartext: string;
  /** Die tatsächlich verwendeten, auf die belegten Faktoren normierten Gewichte. */
  gewichte: SignalGewichte;
  abdeckung: number;
  /** Beitrag je Score in Punkten des Endergebnisses — macht die Zahl prüfbar. */
  beitraege: { name: string; score: number | null; gewicht: number; beitrag: number | null }[];
}

export function gewichteFuerRegime(
  regime: string | null | undefined,
  config: Record<string, SignalGewichte> = DEFAULT_SIGNAL_GEWICHTE,
): SignalGewichte {
  return (regime && config[regime]) || config.default;
}

/**
 * Das Signal aus den drei Scores.
 *
 * Fehlt ein Score, wird sein Gewicht auf die übrigen verteilt — aber nur, wenn
 * genug Gewicht übrig bleibt. Eine Obligation ohne Bewertungs-Score bekommt so
 * weiterhin ein Signal aus Qualität und Timing; ein Titel, von dem nur das
 * Timing bekannt ist, bekommt keines.
 */
export function rechneSignal(
  e: SignalEingaben,
  config: Record<string, SignalGewichte> = DEFAULT_SIGNAL_GEWICHTE,
): SignalErgebnis {
  const w = gewichteFuerRegime(e.regime, config);
  const teile = [
    { name: "Qualität", score: e.qualitaet, gewicht: w.qualitaet },
    { name: "Bewertung", score: e.bewertung, gewicht: w.bewertung },
    { name: "Timing", score: e.timing, gewicht: w.timing },
  ];

  const gesamtGewicht = teile.reduce((s, t) => s + t.gewicht, 0);
  const belegtesGewicht = teile.reduce((s, t) => (t.score === null ? s : s + t.gewicht), 0);
  const abdeckung = gesamtGewicht > 0 ? belegtesGewicht / gesamtGewicht : 0;

  const leer: SignalErgebnis = {
    score: null, label: null, grade: null,
    klartext: "Zu wenige Scores für ein Signal",
    gewichte: w,
    abdeckung: Math.round(abdeckung * 1000) / 1000,
    beitraege: teile.map((t) => ({ name: t.name, score: t.score, gewicht: t.gewicht, beitrag: null })),
  };
  if (abdeckung < MIN_ABDECKUNG_SIGNAL || belegtesGewicht === 0) return leer;

  const roh = teile.reduce((s, t) => (t.score === null ? s : s + t.score * t.gewicht), 0) / belegtesGewicht;
  const score = Math.round(roh * 10) / 10;
  const band = bandFuerScore(score / 100);

  return {
    score,
    label: band.signal,
    grade: band.grade,
    klartext: band.klartext,
    gewichte: w,
    abdeckung: Math.round(abdeckung * 1000) / 1000,
    beitraege: teile.map((t) => ({
      name: t.name,
      score: t.score,
      // Auf die belegten Faktoren normiert — so summieren die Beiträge zum Score.
      gewicht: Math.round((t.gewicht / belegtesGewicht) * 1000) / 1000,
      beitrag: t.score === null ? null : Math.round((t.score * t.gewicht / belegtesGewicht) * 10) / 10,
    })),
  };
}
