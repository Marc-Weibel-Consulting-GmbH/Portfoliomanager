/**
 * K13 — Variations-Loop der Lernwerkstatt (AVO-Muster, L3-gegated).
 *
 * Der Planer erzeugt kleine, benannte Variationen um die Betriebs-Gewichte;
 * der Bewerter misst jeden Kandidaten mit derselben Rechnung wie «Signal-
 * Gewichte messen» (Zeit-Holdout, nach Kosten, gegen «alles kaufen»).
 * Übernommen wird hier NICHTS — das ist der Kern des Pakets.
 */
import { describe, it, expect } from "vitest";
import {
  kandidatenSchluessel,
  planeVariationen,
  bewerteKandidatenSatz,
  stopHinweis,
  VARIATION_SCHRITT_PP,
  LAUF_BUDGET,
} from "./variationsLoop";
import { DEFAULT_SIGNAL_GEWICHTE } from "./dreiScoreSignal";
import type { Beobachtung } from "./signalGewichteBacktest";

describe("kandidatenSchluessel", () => {
  it("ist stabil gegen Schlüsselreihenfolge und identisch für gleiche Sätze", () => {
    const a = { bull: { qualitaet: 0.35, bewertung: 0, timing: 0.65 } };
    const b = { bull: { timing: 0.65, qualitaet: 0.35, bewertung: 0 } } as any;
    expect(kandidatenSchluessel(a)).toBe(kandidatenSchluessel(b));
    expect(kandidatenSchluessel(a)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("unterscheidet verschiedene Sätze", () => {
    const a = { bull: { qualitaet: 0.35, bewertung: 0, timing: 0.65 } };
    const c = { bull: { qualitaet: 0.4, bewertung: 0, timing: 0.6 } };
    expect(kandidatenSchluessel(a)).not.toBe(kandidatenSchluessel(c));
  });
});

describe("planeVariationen", () => {
  it("variiert je Regime nur die Qualität↔Timing-Achse — die Bewertung bleibt bei 0 (E1)", () => {
    const plan = planeVariationen(DEFAULT_SIGNAL_GEWICHTE, new Set());
    expect(plan.length).toBeGreaterThan(0);
    for (const k of plan) {
      for (const w of Object.values(k.gewichte)) {
        expect(w.bewertung).toBe(0);
        expect(w.qualitaet + w.timing).toBeCloseTo(1, 6);
        expect(w.qualitaet).toBeGreaterThanOrEqual(0.05);
        expect(w.qualitaet).toBeLessThanOrEqual(0.95);
      }
    }
  });

  it("benennt jede Variation und führt die Herkunft auf die Basis zurück", () => {
    const basisSchluessel = kandidatenSchluessel(DEFAULT_SIGNAL_GEWICHTE);
    const plan = planeVariationen(DEFAULT_SIGNAL_GEWICHTE, new Set());
    for (const k of plan) {
      expect(k.beschreibung.length).toBeGreaterThan(0);
      expect(k.elternSchluessel).toBe(basisSchluessel);
    }
    // ±1 und ±2 Schritte je Regime — bull 0.35 → u. a. 0.40 und 0.45.
    const bullQ = plan
      .filter((k) => k.beschreibung.startsWith("bull"))
      .map((k) => k.gewichte.bull.qualitaet)
      .sort((a, b) => a - b);
    const s = VARIATION_SCHRITT_PP / 100;
    expect(bullQ).toContain(Number((0.35 - 2 * s).toFixed(4)));
    expect(bullQ).toContain(Number((0.35 + 2 * s).toFixed(4)));
  });

  it("lässt bereits gemessene Kandidaten aus und hält das Budget ein", () => {
    const alles = planeVariationen(DEFAULT_SIGNAL_GEWICHTE, new Set());
    const schonGemessen = new Set(alles.slice(0, 5).map((k) => k.schluessel));
    const rest = planeVariationen(DEFAULT_SIGNAL_GEWICHTE, schonGemessen);
    expect(rest.length).toBe(alles.length - 5);
    expect(rest.every((k) => !schonGemessen.has(k.schluessel))).toBe(true);
    expect(alles.length).toBeLessThanOrEqual(LAUF_BUDGET);
  });
});

/** Deterministische Reihe: hohes Timing sagt die Rendite voraus. */
function beobachtungen(n: number): Beobachtung[] {
  const aus: Beobachtung[] = [];
  for (let i = 0; i < n; i++) {
    const monat = String(1 + (i % 12)).padStart(2, "0");
    const jahr = 2018 + Math.floor(i / 12);
    const timing = (i * 37) % 101;
    aus.push({
      ticker: `T${i % 25}`,
      datum: `${jahr}-${monat}-01`,
      qualitaet: 50 + ((i * 13) % 41) - 20,
      bewertung: null,
      timing,
      regime: i % 2 === 0 ? "bull" : "bear",
      vorwaertsRendite: timing > 60 ? 4 : -1,
    });
  }
  return aus;
}

describe("bewerteKandidatenSatz", () => {
  it("liefert Training, Prüfung, Überanpassung und ein Tauglichkeits-Urteil", () => {
    const e = bewerteKandidatenSatz(beobachtungen(1200), DEFAULT_SIGNAL_GEWICHTE, 1);
    expect(e.training.signal.n).toBeGreaterThan(0);
    expect(e.pruefung.basis.n).toBeGreaterThan(0);
    expect(typeof e.taugt).toBe("boolean");
    expect(Number.isFinite(e.ueberanpassung)).toBe(true);
  });

  it("auf zu dünner Reihe: nicht tauglich, mit Grund", () => {
    const e = bewerteKandidatenSatz(beobachtungen(40), DEFAULT_SIGNAL_GEWICHTE, 1);
    expect(e.taugt).toBe(false);
    expect(e.hinweis).toBeTruthy();
  });
});

describe("stopHinweis", () => {
  it("meldet nach genug Runden ohne Verbesserung den Stopp", () => {
    expect(stopHinweis(0)).toBeNull();
    expect(stopHinweis(2)).toBeNull();
    expect(stopHinweis(3)).toContain("ohne Verbesserung");
  });
});
