/**
 * Der Timing-Score der Rekonstruktion.
 *
 * Die zwei Eigenschaften, auf die es ankommt und die man an einer Zahl allein
 * nicht sieht: Er darf NICHTS über den Stichtag hinaus benutzen, und er muss
 * dieselbe Rechnung sein wie im Live-Betrieb. Beides wird hier festgehalten.
 */

import { describe, it, expect } from "vitest";
import {
  timingUndRegimeAm,
  FENSTER_KALENDERTAGE,
} from "./punktInZeitTiming";
import { berechneTiming } from "./dreiScoreSignal";
import { rsiWilder } from "./rsi";
import { calculateMomentumScore } from "../analytics/qualityMomentumEngine";

/** Handelstagreihe (Mo–Fr) ab `start`, Kurse aus `f(i)`. */
function reihe(start: string, tage: number, f: (i: number) => number) {
  const aus: { date: string; close: number }[] = [];
  const d = new Date(`${start}T00:00:00Z`);
  let i = 0;
  while (aus.length < tage) {
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) aus.push({ date: d.toISOString().slice(0, 10), close: f(i++) });
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return aus;
}

describe("timingUndRegimeAm", () => {
  it("ignoriert alles nach dem Stichtag", () => {
    // Kernprüfung gegen Rückschau: Die Reihe steigt bis zum Stichtag und
    // stürzt danach ab. Der Absturz darf das Ergebnis nicht berühren.
    const bisStichtag = reihe("2019-01-01", 400, (i) => 100 + i * 0.3);
    const stichtag = bisStichtag[bisStichtag.length - 1].date;
    const danach = reihe("2020-08-01", 60, (i) => 500 - i * 5);

    const ohne = timingUndRegimeAm(bisStichtag, stichtag);
    const mit = timingUndRegimeAm([...bisStichtag, ...danach], stichtag);
    expect(mit).toEqual(ohne);
  });

  it("rechnet dasselbe wie der Live-Betrieb", () => {
    // Gegenprobe mit den Live-Bausteinen von Hand: Wenn die Rekonstruktion
    // hier abweicht, misst der Backtest ein anderes Modell als das laufende.
    const kurse = reihe("2018-01-01", 300, (i) => 100 * (1 + 0.001 * i));
    const stichtag = kurse[kurse.length - 1].date;
    const r = timingUndRegimeAm(kurse, stichtag);

    const prices = kurse.map((k) => k.close);
    const letzter = prices[prices.length - 1];
    const hoch = Math.max(...prices);
    const tief = Math.min(...prices);
    const jahresanfang = `${stichtag.slice(0, 4)}-01-01`;
    const ersterImJahr = kurse.find((k) => k.date >= jahresanfang)!;

    const erwartet = berechneTiming({
      momentum: calculateMomentumScore({ prices }).score,
      rsi14: rsiWilder(prices, 14),
      positionIn52W: (letzter - tief) / (hoch - tief),
      ytdPerformance: ((letzter - ersterImJahr.close) / ersterImJahr.close) * 100,
      blasenScore: null,
    });
    expect(r.timing).toBe(erwartet.score);
  });

  it("misst «seit Jahresbeginn» am Stichtagsjahr, nicht am heutigen", () => {
    // Ein Stichtag im März 2017 muss den Jahresanfang 2017 nehmen. Nähme er
    // das laufende Jahr, wäre der YTD-Faktor für jede Vergangenheit sinnlos.
    const kurse = reihe("2016-06-01", 300, (i) => 100 + i);
    const maerz = kurse.find((k) => k.date >= "2017-03-01")!.date;
    const bis = kurse.filter((k) => k.date <= maerz);

    const r = timingUndRegimeAm(kurse, maerz);
    const letzter = bis[bis.length - 1].close;
    const ersterImJahr = bis.find((k) => k.date >= "2017-01-01")!.close;
    const ytdErwartet = ((letzter - ersterImJahr) / ersterImJahr) * 100;

    // Der YTD-Faktor geht mit Gewicht 0.10 ein; geprüft wird er über den
    // Vergleich mit einer Rechnung, die genau diesen Wert einsetzt.
    const prices = bis.map((k) => k.close);
    const hoch = Math.max(...prices);
    const tief = Math.min(...prices);
    const erwartet = berechneTiming({
      momentum: calculateMomentumScore({ prices }).score,
      rsi14: rsiWilder(prices, 14),
      positionIn52W: (letzter - tief) / (hoch - tief),
      ytdPerformance: ytdErwartet,
      blasenScore: null,
    });
    expect(r.timing).toBe(erwartet.score);
  });

  it("benutzt nur das 400-Tage-Fenster, nicht die ganze Historie", () => {
    // Ein Kurssturz von vor fünf Jahren darf die 52-Wochen-Spanne von heute
    // nicht mehr aufspannen.
    const alt = reihe("2010-01-01", 250, () => 10);
    const neu = reihe("2019-01-01", 300, (i) => 100 + i * 0.2);
    const stichtag = neu[neu.length - 1].date;

    const mitAlt = timingUndRegimeAm([...alt, ...neu], stichtag);
    const ohneAlt = timingUndRegimeAm(neu, stichtag);
    expect(mitAlt.timing).toBe(ohneAlt.timing);
    expect(mitAlt.kurseImFenster).toBe(ohneAlt.kurseImFenster);
  });

  it("deckt ohne Blasensignal höchstens 90 Prozent ab", () => {
    const kurse = reihe("2018-01-01", 300, (i) => 100 + i * 0.2);
    const r = timingUndRegimeAm(kurse, kurse[kurse.length - 1].date);
    expect(r.abdeckung).toBeLessThanOrEqual(0.9);
    expect(r.abdeckung).toBeGreaterThanOrEqual(0.9);
    expect(r.timing).not.toBeNull();
  });

  it("stuft eine lang steigende Reihe als Bullentrend ein", () => {
    const kurse = reihe("2018-01-01", 300, (i) => 100 * 1.002 ** i);
    const r = timingUndRegimeAm(kurse, kurse[kurse.length - 1].date);
    expect(r.regime).toBe("bull_trend");
  });

  it("liefert bei zu kurzer Reihe kein Regime statt eines geratenen", () => {
    const kurse = reihe("2020-01-01", 30, (i) => 100 + i);
    const r = timingUndRegimeAm(kurse, kurse[kurse.length - 1].date);
    expect(r.regime).toBe("default");
    expect(r.kurseImFenster).toBe(30);
  });

  it("verträgt leere und unbrauchbare Reihen", () => {
    expect(timingUndRegimeAm([], "2020-01-31").timing).toBeNull();
    expect(timingUndRegimeAm([{ date: "2020-01-02", close: 0 }], "2020-01-31").timing).toBeNull();
    // Ein Stichtag vor jedem Kurs: nichts im Fenster, kein Wert.
    const kurse = reihe("2020-01-01", 100, (i) => 100 + i);
    expect(timingUndRegimeAm(kurse, "2015-01-01").timing).toBeNull();
  });

  it("hält das Fenster bei 400 Kalendertagen", () => {
    // Die Zahl stammt aus dem signalCacheCron. Ändert sie sich dort, muss sie
    // sich hier mitändern — sonst rechnen Backtest und Betrieb verschieden.
    expect(FENSTER_KALENDERTAGE).toBe(400);
  });
});
