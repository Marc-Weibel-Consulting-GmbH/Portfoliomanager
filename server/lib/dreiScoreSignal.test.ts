/**
 * Signal aus den drei Scores.
 *
 * Die Tests halten vor allem zwei Eigenschaften fest, an denen das bisherige
 * Modell scheiterte: dass Qualität nur EINMAL zählt, und dass ein Titel ohne
 * genügend Grundlage gar kein Signal bekommt statt eines schwachen.
 */

import { describe, it, expect } from "vitest";
import {
  rechneSignal,
  berechneTiming,
  gewichteFuerRegime,
  DEFAULT_SIGNAL_GEWICHTE,
  MIN_ABDECKUNG_SIGNAL,
} from "./dreiScoreSignal";

describe("Regime-Gewichte", () => {
  it("summieren je Regime auf 1", () => {
    for (const [name, w] of Object.entries(DEFAULT_SIGNAL_GEWICHTE)) {
      const summe = w.qualitaet + w.bewertung + w.timing;
      expect(summe, `Regime ${name}`).toBeCloseTo(1, 6);
    }
  });

  it("E1: die Bewertung trägt in keinem Regime positives Gewicht — sie ist Wächter, kein Renditefaktor", () => {
    // IC-Diagnose: Bewertung −0.021/−0.063/−0.093 über 1/6/12 Monate, nur 22 %
    // der Stichtage richtig herum; der Rangtest belohnte die SCHLECHTESTEN
    // Bewertungs-Titel. «Günstig» gibt keine Punkte mehr — Extreme deckeln unten.
    for (const [name, w] of Object.entries(DEFAULT_SIGNAL_GEWICHTE)) {
      expect(w.bewertung, `Regime ${name}`).toBe(0);
    }
  });

  it("gewichten in der Krise das Unternehmen höher als den Zeitpunkt", () => {
    const krise = DEFAULT_SIGNAL_GEWICHTE.crisis;
    expect(krise.qualitaet).toBeGreaterThan(krise.timing);
  });

  it("gewichten im Aufschwung den Zeitpunkt höher als das Unternehmen", () => {
    const hausse = DEFAULT_SIGNAL_GEWICHTE.bull;
    expect(hausse.timing).toBeGreaterThan(hausse.qualitaet);
  });

  it("fallen bei unbekanntem Regime auf den Standard zurück", () => {
    expect(gewichteFuerRegime("gibt_es_nicht")).toEqual(DEFAULT_SIGNAL_GEWICHTE.default);
    expect(gewichteFuerRegime(null)).toEqual(DEFAULT_SIGNAL_GEWICHTE.default);
  });
});

describe("rechneSignal", () => {
  it("rechnet die gewichtete Kombination nachvollziehbar", () => {
    // default: Qualität 0.50 / Timing 0.50 — die Bewertung trägt kein Gewicht (E1).
    const r = rechneSignal({ qualitaet: 80, bewertung: 40, timing: 60, regime: "default" });
    expect(r.score).toBeCloseTo(0.50 * 80 + 0.50 * 60, 1);
    expect(r.abdeckung).toBe(1);
  });

  it("E1: eine bessere Bewertung hebt das Signal nicht mehr", () => {
    const guenstig = rechneSignal({ qualitaet: 70, bewertung: 95, timing: 50, regime: "default" });
    const teuer = rechneSignal({ qualitaet: 70, bewertung: 40, timing: 50, regime: "default" });
    expect(guenstig.score).toBe(teuer.score);
  });

  it("E1: extreme Überbewertung deckelt das Signal — nie BUY für extrem teure Titel", () => {
    // Bewertung ≤ 20 heisst: KGV-Deckel-Zone, PEG jenseits der Aussage. Ein
    // solcher Titel kann höchstens HOLD sein, egal wie gut Qualität und
    // Timing stehen — die Fallhöhe ist eingepreist, nicht die Chance.
    const r = rechneSignal({ qualitaet: 90, bewertung: 15, timing: 90, regime: "default" });
    expect(r.score).toBe(45);
    expect(r.label).toBe("HOLD");
    expect(r.waechterHinweis).toContain("begrenzt");
    expect(r.beitraege.some((b) => b.name === "Bewertungs-Wächter")).toBe(true);
    // Knapp über der Schwelle greift nichts.
    const frei = rechneSignal({ qualitaet: 90, bewertung: 21, timing: 90, regime: "default" });
    expect(frei.score).toBeCloseTo(90, 1);
    expect(frei.waechterHinweis).toBeNull();
  });

  it("die Beiträge summieren zum Score — die Zahl ist prüfbar (ohne Wächter-Fall)", () => {
    const r = rechneSignal({ qualitaet: 70, bewertung: 48, timing: 73, regime: "bull" });
    const summe = r.beitraege.reduce((s, b) => s + (b.beitrag ?? 0), 0);
    expect(summe).toBeCloseTo(r.score!, 0);
  });

  it("zählt Qualität genau einmal", () => {
    // Der Kern der Umstellung: Steigt allein die Qualität, darf sich das
    // Signal nur um den Qualitätsanteil bewegen — nicht doppelt, weil Qualität
    // vorher auch im Timing-Teil steckte.
    const vorher = rechneSignal({ qualitaet: 40, bewertung: 50, timing: 50, regime: "default" });
    const nachher = rechneSignal({ qualitaet: 80, bewertung: 50, timing: 50, regime: "default" });
    const differenz = nachher.score! - vorher.score!;
    expect(differenz).toBeCloseTo(0.50 * 40, 1);
  });

  it("eine fehlende Bewertung kostet keine Abdeckung mehr — sie trägt ohnehin kein Gewicht", () => {
    // Obligation: kein Bewertungs-Score, aber Qualität (Emittent) und Timing.
    const r = rechneSignal({ qualitaet: 70, bewertung: null, timing: 50, regime: "default" });
    expect(r.score).toBeCloseTo(60, 1);
    expect(r.abdeckung).toBe(1);
  });

  it("gibt kein Signal, wenn nur ein Score vorliegt", () => {
    const r = rechneSignal({ qualitaet: null, bewertung: null, timing: 90, regime: "default" });
    expect(r.score).toBeNull();
    expect(r.label).toBeNull();
    expect(r.abdeckung).toBeLessThan(MIN_ABDECKUNG_SIGNAL);
  });

  it("E2: ohne Timing gibt es kein Signal — der Screener führt die Qualität, keine Kaufliste", () => {
    // Vorher trugen Qualität + Bewertung zusammen 65 % und ergaben ein
    // «Signal ohne Timing». Mit der Bewertung als Wächter bliebe nur die
    // Qualität — ein Signal, das die Qualität dupliziert, sagt nichts Neues.
    const r = rechneSignal({ qualitaet: 85, bewertung: 90, timing: null, regime: "default" });
    expect(r.score).toBeNull();
    expect(r.abdeckung).toBeCloseTo(0.50, 2);
  });

  it("gibt kein Signal, wenn gar nichts vorliegt", () => {
    const r = rechneSignal({ qualitaet: null, bewertung: null, timing: null });
    expect(r.score).toBeNull();
    expect(r.klartext).toMatch(/Zu wenige/);
  });

  it("dasselbe Wertepaar ergibt je nach Regime ein anderes Signal", () => {
    const eingabe = { qualitaet: 85, bewertung: 60, timing: 20 };
    const krise = rechneSignal({ ...eingabe, regime: "crisis" });
    const hausse = rechneSignal({ ...eingabe, regime: "bull" });
    // Starkes Unternehmen, schlechter Zeitpunkt: in der Krise besser bewertet.
    expect(krise.score!).toBeGreaterThan(hausse.score!);
  });

  it("vergibt die Bänder nach derselben Skala wie bisher", () => {
    expect(rechneSignal({ qualitaet: 90, bewertung: 90, timing: 90 }).label).toBe("STRONG BUY");
    expect(rechneSignal({ qualitaet: 50, bewertung: 50, timing: 50 }).label).toBe("HOLD");
    expect(rechneSignal({ qualitaet: 10, bewertung: 10, timing: 10 }).label).toBe("STRONG SELL");
  });
});

describe("berechneTiming", () => {
  it("bewertet einen Rücksetzer bei intaktem Trend gut", () => {
    const r = berechneTiming({
      momentum: 0.4, rsi14: 32, positionIn52W: 0.25, ytdPerformance: 8, blasenScore: 0.1,
    });
    expect(r.score!).toBeGreaterThan(60);
  });

  it("bewertet ein überhitztes Hoch schlecht", () => {
    const r = berechneTiming({
      momentum: 0.2, rsi14: 78, positionIn52W: 0.97, ytdPerformance: 45, blasenScore: 0.85,
    });
    expect(r.score!).toBeLessThan(40);
  });

  it("kennt kein KGV, kein PEG und keine Dividendenrendite", () => {
    // Die Trennung ist der Zweck der Übung: Preisgrössen gehören in die
    // Bewertung, nicht ein zweites Mal in den Zeitpunkt.
    const namen = berechneTiming({ momentum: 0 }).faktoren.map((f) => f.name.toLowerCase());
    expect(namen.some((n) => n.includes("kgv") || n.includes("peg") || n.includes("dividend"))).toBe(false);
  });

  it("gibt null statt einer Zahl, wenn zu wenige Zeitfaktoren vorliegen", () => {
    // Nur Trend (0.10) und Blasensignal (0.10) — 20 % Abdeckung.
    const r = berechneTiming({ ytdPerformance: 5, blasenScore: 0.2 });
    expect(r.score).toBeNull();
    expect(r.abdeckung).toBeCloseTo(0.20, 2);
  });

  it("rechnet weiter, solange genug Gewicht belegt ist", () => {
    // Momentum (0.35) + RSI (0.25) + 52W (0.20) = 80 %.
    const r = berechneTiming({ momentum: 0.5, rsi14: 45, positionIn52W: 0.5 });
    expect(r.score).not.toBeNull();
    expect(r.abdeckung).toBeCloseTo(0.80, 2);
  });

  it("die Faktorgewichte summieren auf 1", () => {
    const summe = berechneTiming({}).faktoren.reduce((s, f) => s + f.gewicht, 0);
    expect(summe).toBeCloseTo(1, 6);
  });
});
