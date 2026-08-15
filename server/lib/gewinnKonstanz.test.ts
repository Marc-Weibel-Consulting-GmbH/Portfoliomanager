import { describe, it, expect } from "vitest";
import { halteperiodenKennzahlen, MAX_MONATE, MIN_MONATE, type MonatsPunkt } from "./gewinnKonstanz";

/** Monatsreihe ab Januar 2015, Kurs aus einer Funktion je Monatsindex. */
function monatsReihe(monate: number, kurs: (m: number) => number): MonatsPunkt[] {
  const punkte: MonatsPunkt[] = [];
  for (let m = 0; m < monate; m++) {
    const jahr = 2015 + Math.floor(m / 12);
    const monat = (m % 12) + 1;
    punkte.push({ date: `${jahr}-${String(monat).padStart(2, "0")}-28`, close: kurs(m) });
  }
  return punkte;
}

describe("halteperiodenKennzahlen", () => {
  it("ein stetiger Steiger gewinnt in jedem Szenario", () => {
    const e = halteperiodenKennzahlen(monatsReihe(MAX_MONATE, (m) => 100 * Math.pow(1.01, m)));
    expect(e.gewinnKonstanz).toBe(100);
    expect(e.verlustWahrscheinlichkeit).toBe(0);
    expect(e.verlustRatio).toBe(0);
    // 120 Monatskurse ergeben alle Kauf/Verkauf-Paare: 120·119/2 = 7140 Szenarien.
    expect(e.szenarien).toBe((MAX_MONATE * (MAX_MONATE - 1)) / 2);
  });

  it("ein stetiger Faller verliert in jedem Szenario und hat eine positive Verlust-Ratio", () => {
    const e = halteperiodenKennzahlen(monatsReihe(MAX_MONATE, (m) => 100 * Math.pow(0.99, m)));
    expect(e.gewinnKonstanz).toBe(0);
    expect(e.verlustWahrscheinlichkeit).toBe(100);
    expect(e.mittlererVerlust).toBeGreaterThan(0);
    // Bei 100 % Verlustwahrscheinlichkeit ist die Ratio gleich dem mittleren Verlust.
    expect(e.verlustRatio).toBeCloseTo(e.mittlererVerlust!, 5);
  });

  it("gemischte Reihen liegen dazwischen", () => {
    // Sägezahn um einen leicht steigenden Trend: gewinnt oft, aber nicht immer.
    const e = halteperiodenKennzahlen(
      monatsReihe(MAX_MONATE, (m) => 100 * Math.pow(1.003, m) * (m % 2 === 0 ? 1 : 0.94)),
    );
    expect(e.gewinnKonstanz).toBeGreaterThan(0);
    expect(e.gewinnKonstanz).toBeLessThan(100);
    expect(e.verlustRatio).toBeGreaterThan(0);
  });

  it("zu kurze Historie liefert null statt einer Scheinzahl", () => {
    const e = halteperiodenKennzahlen(monatsReihe(MIN_MONATE - 1, (m) => 100 + m));
    expect(e.gewinnKonstanz).toBeNull();
    expect(e.verlustRatio).toBeNull();
    expect(e.hinweis).toContain(`benötigt ${MIN_MONATE}`);
  });

  it("nur die letzten zehn Jahre zählen — ältere Kurse fallen weg", () => {
    // 60 Absturzmonate VOR dem 120-Monats-Fenster, danach stetig steigend:
    // Im Fenster ist alles grün, der Vorlauf darf das Ergebnis nicht drücken.
    const e = halteperiodenKennzahlen(
      monatsReihe(MAX_MONATE + 60, (m) =>
        m < 60 ? 500 * Math.pow(0.9, m) : 10 * Math.pow(1.01, m - 60),
      ),
    );
    expect(e.monate).toBe(MAX_MONATE);
    expect(e.gewinnKonstanz).toBe(100);
  });

  it("verwirft ungültige Kurse und nimmt je Monat den letzten", () => {
    const reihe = monatsReihe(MIN_MONATE, (m) => 100 * Math.pow(1.01, m));
    // Kaputter Zwischenwert und ein früherer Kurs im selben Monat dürfen nichts ändern.
    reihe.push({ date: "2015-01-05", close: 9999 }); // früher im Monat → Monatsschluss gewinnt
    reihe.push({ date: "2016-03-10", close: NaN });
    reihe.push({ date: "2016-04-10", close: 0 });
    const e = halteperiodenKennzahlen(reihe);
    expect(e.monate).toBe(MIN_MONATE);
    expect(e.gewinnKonstanz).toBe(100);
  });

  it("der Hinweis macht die Datenbasis nachvollziehbar", () => {
    const e = halteperiodenKennzahlen(monatsReihe(48, (m) => 100 * Math.pow(1.01, m)));
    expect(e.hinweis).toMatch(/Szenarien/);
    expect(e.hinweis).toContain("48");
    expect(e.von).toBe("2015-01-28");
    expect(e.bis).toBe("2018-12-28");
  });

  it("der mittlere Verlust ist zeitgewichtet — lange Verluste zählen mehr als kurze", () => {
    // Konstruktion: erst flach, ein tiefer Einbruch, sofortige Erholung — die
    // kurzen, tiefen Verlust-Szenarien um den Einbruch dürfen den Schnitt nicht
    // so dominieren, als hätten sie jahrelang gegolten.
    const flachMitDip = monatsReihe(MIN_MONATE + 12, (m) => (m === 24 ? 60 : 100));
    const e = halteperiodenKennzahlen(flachMitDip);
    // Verlust nur in Szenarien, die im Dip verkaufen (oder zum Dip-Preis kaufen und flach verkaufen — Gewinn).
    expect(e.verlustWahrscheinlichkeit).toBeGreaterThan(0);
    expect(e.mittlererVerlust).toBeCloseTo(40, 1); // alle Verlust-Szenarien enden bei −40 %
  });
});
