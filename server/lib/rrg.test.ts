import { describe, it, expect } from "vitest";
import { wochenSchluss, rrgReihe, quadrant, RS_FENSTER_WOCHEN, MOMENTUM_FENSTER_WOCHEN } from "./rrg";

/** Tagesreihe über `wochen` Wochen (Mo–Fr), Kurs aus einer Funktion je Handelstag. */
function tagesReihe(wochen: number, kurs: (tag: number) => number) {
  const punkte: Array<{ date: string; close: number }> = [];
  const start = new Date(Date.UTC(2024, 0, 1)); // ein Montag
  let handelstag = 0;
  for (let t = 0; t < wochen * 7; t++) {
    const d = new Date(start.getTime() + t * 24 * 3600 * 1000);
    const wochentag = (d.getUTCDay() + 6) % 7;
    if (wochentag >= 5) continue; // Wochenende
    punkte.push({ date: d.toISOString().slice(0, 10), close: kurs(handelstag++) });
  }
  return punkte;
}

const WOCHEN = RS_FENSTER_WOCHEN + MOMENTUM_FENSTER_WOCHEN + 12;

describe("wochenSchluss", () => {
  it("nimmt den letzten Handelstag jeder Woche", () => {
    const reihe = tagesReihe(3, (t) => 100 + t);
    const wochen = wochenSchluss(reihe);
    expect(wochen).toHaveLength(3);
    // Jeder Wochenpunkt ist ein Freitag (letzter Handelstag der Testreihe).
    for (const p of wochen) {
      expect(new Date(`${p.date}T00:00:00Z`).getUTCDay()).toBe(5);
    }
  });

  it("verwirft ungültige Kurse", () => {
    expect(wochenSchluss([{ date: "2024-01-03", close: 0 }, { date: "2024-01-04", close: NaN }])).toHaveLength(0);
  });
});

describe("rrgReihe", () => {
  it("ein dauerhafter Outperformer steht rechts (RS-Ratio > 100)", () => {
    // Sektor wächst 0.4 % je Handelstag, Markt 0.1 % — relative Stärke steigt stetig.
    // Bei KONSTANTER Outperformance ist die RS-Ratio konstant über dem Mittel
    // und das Momentum exakt neutral (100): stärker als der Markt, aber nicht
    // MEHR als bisher. Das ist die korrekte Lesart, kein Fehler.
    const sektor = tagesReihe(WOCHEN, (t) => 100 * Math.pow(1.004, t));
    const markt = tagesReihe(WOCHEN, (t) => 100 * Math.pow(1.001, t));
    const punkte = rrgReihe(sektor, markt);
    expect(punkte.length).toBeGreaterThan(5);
    const letzter = punkte.at(-1)!;
    expect(letzter.rsRatio).toBeGreaterThan(100);
    expect(letzter.rsMomentum).toBeGreaterThanOrEqual(100);
    expect(quadrant(letzter)).toBe("fuehrend");
  });

  it("kippende Outperformance wird als nachlassend erkannt", () => {
    // Erst stark, die letzten 3 Wochen fällt der Sektor leicht gegen den Markt
    // zurück: noch über dem 6-Monats-Mittel (stark), aber fallendes Momentum.
    const knick = (WOCHEN - 3) * 5;
    const sektor = tagesReihe(WOCHEN, (t) =>
      t < knick ? 100 * Math.pow(1.004, t) : 100 * Math.pow(1.004, knick) * Math.pow(0.998, t - knick));
    const markt = tagesReihe(WOCHEN, (t) => 100 * Math.pow(1.001, t));
    const letzter = rrgReihe(sektor, markt).at(-1)!;
    expect(letzter.rsRatio).toBeGreaterThan(100);
    expect(letzter.rsMomentum).toBeLessThan(100);
    expect(quadrant(letzter)).toBe("nachlassend");
  });

  it("gleichläufige Reihen bleiben nahe 100/100", () => {
    const sektor = tagesReihe(WOCHEN, (t) => 50 * Math.pow(1.002, t));
    const markt = tagesReihe(WOCHEN, (t) => 200 * Math.pow(1.002, t));
    const letzter = rrgReihe(sektor, markt).at(-1)!;
    expect(letzter.rsRatio).toBeCloseTo(100, 0);
    expect(letzter.rsMomentum).toBeCloseTo(100, 0);
  });

  it("zu kurze Reihen ergeben keine Punkte statt erfundener", () => {
    const kurz = tagesReihe(10, (t) => 100 + t);
    expect(rrgReihe(kurz, kurz)).toHaveLength(0);
  });

  it("Wochen ohne Benchmark-Kurs fallen weg statt ein Verhältnis zu verfälschen", () => {
    const sektor = tagesReihe(WOCHEN, (t) => 100 * Math.pow(1.002, t));
    const markt = tagesReihe(WOCHEN, (t) => 100 * Math.pow(1.002, t))
      .filter((p) => p.date < "2024-03-01" || p.date > "2024-03-31"); // ein Monat Lücke
    const punkte = rrgReihe(sektor, markt);
    expect(punkte.length).toBeGreaterThan(0);
    for (const p of punkte) {
      expect(p.rsRatio).toBeGreaterThan(95);
      expect(p.rsRatio).toBeLessThan(105);
    }
  });
});

describe("quadrant", () => {
  it("ordnet die vier Felder korrekt zu", () => {
    expect(quadrant({ rsRatio: 105, rsMomentum: 103 })).toBe("fuehrend");
    expect(quadrant({ rsRatio: 105, rsMomentum: 97 })).toBe("nachlassend");
    expect(quadrant({ rsRatio: 95, rsMomentum: 97 })).toBe("zurueckliegend");
    expect(quadrant({ rsRatio: 95, rsMomentum: 103 })).toBe("aufholend");
  });
});
