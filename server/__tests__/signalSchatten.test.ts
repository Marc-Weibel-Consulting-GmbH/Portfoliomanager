/**
 * Schattenrechnung: Empfehlung ohne Qualität im Timing-Teil.
 *
 * Anlass: Der Signal-Score mischt Qualität und Momentum mit regimeabhängigen
 * Gewichten — von 35 % Qualität (bull) bis 75 % (crisis). Wird er als «Timing»
 * neben einen eigenen Qualitätsscore gestellt, zählt der Leser Qualität
 * zweimal, ohne zu wissen wie oft.
 *
 * Umgestellt wird nichts. Diese Rechnung läuft parallel mit und hält beide
 * Varianten fest — dieselbe Vorgehensweise wie bei der Regime-Schattenrechnung
 * (#227): erst messen, dann entscheiden.
 */

import { describe, it, expect } from "vitest";
import { rechneSignalSchatten, schattenGewichte, SCHATTEN_GEWICHTE } from "../lib/signalSchatten";
import { DEFAULT_REGIME_BLEND } from "../lib/signalBlend";

const basis = {
  momentumScore: 0.4,
  qualityScoreAlt: 0.6,
  qualitaetNeu: 75,
  bewertungNeu: 40,
  lpplPenalty: 0,
  regime: "default",
};

describe("Der Qualitätsanteil im Live-Score", () => {
  it("wird ausgewiesen und entspricht den Regime-Gewichten", () => {
    expect(rechneSignalSchatten({ ...basis, regime: "crisis" }, DEFAULT_REGIME_BLEND).qualitaetsAnteilLive).toBe(0.75);
    expect(rechneSignalSchatten({ ...basis, regime: "bull" }, DEFAULT_REGIME_BLEND).qualitaetsAnteilLive).toBe(0.35);
    expect(rechneSignalSchatten({ ...basis, regime: "default" }, DEFAULT_REGIME_BLEND).qualitaetsAnteilLive).toBe(0.5);
  });

  it("liegt in jedem Regime bei mindestens einem Drittel — die Doppelzählung in Zahlen", () => {
    for (const regime of Object.keys(DEFAULT_REGIME_BLEND)) {
      const r = rechneSignalSchatten({ ...basis, regime }, DEFAULT_REGIME_BLEND);
      expect(r.qualitaetsAnteilLive).toBeGreaterThanOrEqual(0.35);
    }
  });
});

describe("Timing allein", () => {
  it("ist reines Momentum, auf 0–100 gebracht", () => {
    expect(rechneSignalSchatten({ ...basis, momentumScore: 0 }, DEFAULT_REGIME_BLEND).timingScore).toBe(50);
    expect(rechneSignalSchatten({ ...basis, momentumScore: 1 }, DEFAULT_REGIME_BLEND).timingScore).toBe(100);
    expect(rechneSignalSchatten({ ...basis, momentumScore: -1 }, DEFAULT_REGIME_BLEND).timingScore).toBe(0);
  });

  it("hängt nicht von der Qualität ab — anders als der Live-Score", () => {
    const a = rechneSignalSchatten({ ...basis, qualityScoreAlt: -1 }, DEFAULT_REGIME_BLEND);
    const b = rechneSignalSchatten({ ...basis, qualityScoreAlt: 1 }, DEFAULT_REGIME_BLEND);
    expect(a.timingScore).toBe(b.timingScore);
    expect(a.liveScore).not.toBe(b.liveScore);
  });
});

describe("Die Schattenvariante", () => {
  it("verändert den Live-Score nicht", () => {
    const ohne = rechneSignalSchatten({ ...basis, qualitaetNeu: null, bewertungNeu: null }, DEFAULT_REGIME_BLEND);
    const mit = rechneSignalSchatten(basis, DEFAULT_REGIME_BLEND);
    expect(mit.liveScore).toBe(ohne.liveScore);
  });

  it("bleibt leer, wenn einer der neuen Scores fehlt", () => {
    for (const fehlend of [{ qualitaetNeu: null }, { bewertungNeu: null }]) {
      const r = rechneSignalSchatten({ ...basis, ...fehlend }, DEFAULT_REGIME_BLEND);
      expect(r.schattenScore).toBeNull();
      expect(r.schattenSignal).toBeNull();
      // Der Live-Score bleibt trotzdem vorhanden.
      expect(r.liveScore).toBeGreaterThan(0);
    }
  });

  it("rechnet die drei Achsen mit den Regime-Gewichten", () => {
    const r = rechneSignalSchatten({ ...basis, regime: "bull" }, DEFAULT_REGIME_BLEND);
    const g = SCHATTEN_GEWICHTE.bull;
    const erwartet = (g.qualitaet * 0.75 + g.bewertung * 0.40 + g.timing * 0.70) * 100;
    expect(r.schattenScore).toBeCloseTo(erwartet, 1);
  });

  it("zieht den Blasen-Abschlag in beiden Varianten ab", () => {
    const ohne = rechneSignalSchatten(basis, DEFAULT_REGIME_BLEND);
    const mit = rechneSignalSchatten({ ...basis, lpplPenalty: 0.2 }, DEFAULT_REGIME_BLEND);
    expect(mit.liveScore).toBeCloseTo(ohne.liveScore - 20, 1);
    expect(mit.schattenScore!).toBeCloseTo(ohne.schattenScore! - 20, 1);
  });

  it("bestraft einen teuren Titel stärker als die Live-Formel", () => {
    // Die Live-Formel kennt gar keine Bewertung. Bei sonst gleichen Werten
    // muss die Schattenvariante den teuren Titel schlechter stellen.
    const guenstig = rechneSignalSchatten({ ...basis, bewertungNeu: 90 }, DEFAULT_REGIME_BLEND);
    const teuer = rechneSignalSchatten({ ...basis, bewertungNeu: 10 }, DEFAULT_REGIME_BLEND);
    expect(guenstig.liveScore).toBe(teuer.liveScore);
    expect(guenstig.schattenScore!).toBeGreaterThan(teuer.schattenScore!);
  });
});

describe("Gewichte", () => {
  it("summieren sich in jedem Regime auf 1", () => {
    for (const [regime, g] of Object.entries(SCHATTEN_GEWICHTE)) {
      const summe = g.qualitaet + g.bewertung + g.timing;
      expect(summe, `Regime ${regime}`).toBeCloseTo(1, 6);
    }
  });

  it("geben der Qualität in defensiven Regimen mehr Gewicht", () => {
    expect(SCHATTEN_GEWICHTE.crisis.qualitaet).toBeGreaterThan(SCHATTEN_GEWICHTE.bull.qualitaet);
    expect(SCHATTEN_GEWICHTE.bull.timing).toBeGreaterThan(SCHATTEN_GEWICHTE.crisis.timing);
  });

  it("fallen bei unbekanntem Regime auf die Voreinstellung zurück", () => {
    expect(schattenGewichte("gibtsnicht")).toEqual(SCHATTEN_GEWICHTE.default);
    expect(schattenGewichte("")).toEqual(SCHATTEN_GEWICHTE.default);
    expect(schattenGewichte("SIDEWAYS-HIGH VOL")).toEqual(SCHATTEN_GEWICHTE.sideways_high_vol);
  });
});
