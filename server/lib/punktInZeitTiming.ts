/**
 * Timing-Score und Regime eines Titels zu einem vergangenen Stichtag.
 *
 * Die Rekonstruktion aus #253 liefert Qualität und Bewertung. Für das Signal
 * fehlt der dritte Score — und ohne ihn lassen sich die Gewichte, um die es in
 * Schritt 3 geht, gar nicht optimieren: Zwei von drei Grössen zu tunen und die
 * dritte wegzulassen ergibt Gewichte für ein anderes Modell als das laufende.
 *
 * Der Timing-Score kommt vollständig aus der Kursreihe. Die ist bei EODHD
 * zehn Jahre und länger verfügbar und wird für die Rekonstruktion ohnehin
 * geholt — dieser Teil kostet also keinen zusätzlichen Abruf.
 *
 * ZWEI ABWEICHUNGEN VOM LIVE-BETRIEB, beide bewusst:
 *
 *  1. **Kein Blasensignal.** Der LPPL-Wert (Gewicht 0.10) ist rückwirkend nicht
 *     zu rekonstruieren, ohne die Anpassung für jeden Stichtag neu zu rechnen.
 *     Sein Gewicht verteilt sich auf die übrigen Faktoren; die Abdeckung sinkt
 *     auf 0.90 und wird mitgeschrieben, damit die Lücke in der Auswertung
 *     sichtbar bleibt statt stillschweigend als Messung durchzugehen.
 *  2. **Kein Totband beim Regime.** `regimeMitTotband` glättet das Flattern an
 *     Regimegrenzen von Tag zu Tag. Die Stichtage liegen einen Monat
 *     auseinander — dort gibt es nichts zu glätten, und das Totband würde
 *     stattdessen eine Trägheit einbauen, die es im Monatsraster nicht gibt.
 *
 * Alles andere ist dieselbe Rechnung wie im `signalCacheCron`: dasselbe
 * 400-Tage-Fenster, dieselbe Momentum-Engine, derselbe RSI, dieselbe
 * `berechneTiming`-Funktion.
 */

import { berechneTiming } from "./dreiScoreSignal";
import { rsiWilder } from "./rsi";
import { calculateMomentumScore } from "../analytics/qualityMomentumEngine";
import { computeRegime } from "./signals/regimeEngine";
import { MS_PER_DAY } from "./dateMath";

/**
 * Länge des Kursfensters in KALENDERtagen.
 *
 * 400 wie im `signalCacheCron` (`Date.now() - 400 * 24 * 60 * 60 * 1000`).
 * Das sind rund 275 Handelstage — knapp genug für die 12-Monats-Komponente der
 * Momentum-Engine (braucht 253) und für den SMA-200 der Regime-Engine. Ein
 * anderes Fenster ergäbe andere Zahlen als der Live-Betrieb; die Rekonstruktion
 * würde dann etwas messen, das es so nie gab.
 */
export const FENSTER_KALENDERTAGE = 400;

/** Kürzeste Reihe, aus der die Regime-Engine überhaupt etwas ableiten darf. */
const MIN_KURSE_REGIME = 60;

export interface TimingAmStichtag {
  /** 0–100, oder null, wenn zu wenige Zeitfaktoren belegt sind. */
  timing: number | null;
  /** Anteil des belegten Gewichts, 0–1. Ohne Blasensignal höchstens 0.90. */
  abdeckung: number;
  /** Regime-Schlüssel der Engine (`bull_trend`, `crisis`, …) oder `default`. */
  regime: string;
  /** Kurse im Fenster — macht eine dünne Reihe sichtbar. */
  kurseImFenster: number;
}

/** Ein Stichtag minus `tage` Kalendertage, als `YYYY-MM-DD`. */
function minusTage(stichtag: string, tage: number): string {
  return new Date(Date.parse(`${stichtag}T00:00:00Z`) - tage * MS_PER_DAY)
    .toISOString()
    .slice(0, 10);
}

/**
 * Timing und Regime, wie sie an diesem Stichtag berechenbar gewesen wären.
 *
 * `kurse` muss aufsteigend nach Datum sortiert sein. Kurse NACH dem Stichtag
 * werden verworfen — sonst entstünde genau die Rückschau, die die ganze
 * Rekonstruktion vermeiden soll.
 */
export function timingUndRegimeAm(
  kurse: { date: string; close: number }[],
  stichtag: string,
): TimingAmStichtag {
  const leer: TimingAmStichtag = {
    timing: null, abdeckung: 0, regime: "default", kurseImFenster: 0,
  };

  const von = minusTage(stichtag, FENSTER_KALENDERTAGE);
  const fenster = (kurse ?? []).filter(
    (k) => k && k.date >= von && k.date <= stichtag && Number.isFinite(k.close) && k.close > 0,
  );
  if (fenster.length < 2) return { ...leer, kurseImFenster: fenster.length };

  const prices = fenster.map((k) => k.close);
  const letzter = prices[prices.length - 1];

  // Momentum: dieselbe Engine wie live, ohne Sektorreihe. Die relative Stärke
  // fällt damit weg und ihr Gewicht verteilt sich — genauso wie im
  // `signalCacheCron`, der `calculateMomentumScore({ prices })` ebenfalls ohne
  // `sectorPrices` aufruft.
  let momentum: number | null = null;
  try {
    const m = calculateMomentumScore({ prices });
    if (m.dataAvailable) momentum = m.score;
  } catch { /* eine kaputte Reihe darf den Stichtag nicht sprengen */ }

  const rsi14 = prices.length >= 15 ? rsiWilder(prices, 14) : null;

  const hoch = Math.max(...prices);
  const tief = Math.min(...prices);
  const positionIn52W = hoch > tief ? (letzter - tief) / (hoch - tief) : null;

  // Seit Jahresbeginn — gerechnet auf das Jahr DES STICHTAGS, nicht auf heute.
  const jahresanfang = `${stichtag.slice(0, 4)}-01-01`;
  const ersterImJahr = fenster.find((k) => k.date >= jahresanfang) ?? fenster[0];
  const ytdPerformance = ersterImJahr.close > 0
    ? ((letzter - ersterImJahr.close) / ersterImJahr.close) * 100
    : null;

  const t = berechneTiming({
    momentum,
    rsi14,
    positionIn52W,
    ytdPerformance,
    // Nicht rekonstruierbar; siehe Kopf der Datei.
    blasenScore: null,
  });

  let regime = "default";
  if (prices.length >= MIN_KURSE_REGIME) {
    try {
      regime = computeRegime(prices, null, stichtag).regime;
    } catch { /* bleibt `default` — in `rechneSignal` die neutrale Zeile */ }
  }

  return {
    timing: t.score,
    abdeckung: t.abdeckung,
    regime,
    kurseImFenster: fenster.length,
  };
}
