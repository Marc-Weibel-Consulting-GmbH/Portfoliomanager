/**
 * Sprint zu KIMIs Punkten 3 und 4.
 *
 * Punkt 4: Note und Handlungsempfehlung kamen aus getrennten Schwellen und
 * widersprachen sich zwischen 55.0 und 59.9 («Note C, Signal Kaufen»).
 * Punkt 3: Die Wirkungsmessung war brutto — ohne Courtage, Stempelabgabe,
 * Spanne und laufende Gebühren.
 */
import { describe, it, expect } from "vitest";
import { SCORE_BAENDER, bandFuerScore, blendCombinedScore } from "../lib/signalBlend";
import {
  STANDARD_KOSTEN,
  berechneKosten,
  nettoRendite,
  regimeWechselBestaetigt,
} from "../lib/kostenModell";

describe("Score-Bänder (Punkt 4)", () => {
  it("kennt keinen Score mehr, bei dem Note und Signal sich widersprechen", () => {
    const kaufNoten = new Set(["A", "B"]);
    const verkaufNoten = new Set(["D", "F"]);
    for (let v = 0; v <= 100; v++) {
      const b = bandFuerScore(v / 100);
      if (b.signal.includes("BUY")) {
        expect(kaufNoten.has(b.grade), `Score ${v}: ${b.grade} + ${b.signal}`).toBe(true);
      }
      if (b.signal.includes("SELL")) {
        expect(verkaufNoten.has(b.grade), `Score ${v}: ${b.grade} + ${b.signal}`).toBe(true);
      }
      if (b.grade === "C") expect(b.signal).toBe("HOLD");
    }
  });

  it("löst genau den gemeldeten Fall auf: 58 ist jetzt C und HALTEN", () => {
    const b = bandFuerScore(0.58);
    expect(b.grade).toBe("C");
    expect(b.signal).toBe("HOLD"); // vorher: BUY
  });

  it("vergibt «stark kaufen» erst ab Note A", () => {
    expect(bandFuerScore(0.72).signal).toBe("BUY");        // vorher: STRONG BUY bei Note B
    expect(bandFuerScore(0.75).signal).toBe("STRONG BUY");
    expect(bandFuerScore(0.75).grade).toBe("A");
  });

  it("hat lückenlose, absteigende Grenzen", () => {
    for (let i = 1; i < SCORE_BAENDER.length; i++) {
      expect(SCORE_BAENDER[i].abScore).toBeLessThan(SCORE_BAENDER[i - 1].abScore);
    }
    expect(SCORE_BAENDER[SCORE_BAENDER.length - 1].abScore).toBe(0);
  });

  it("gibt zu jedem Band einen Klartext für die Oberfläche", () => {
    for (const b of SCORE_BAENDER) expect(b.klartext.length).toBeGreaterThan(5);
  });

  it("bleibt für Nestlé bei Note B und Kaufen", () => {
    // Der live gemessene Fall (60.4) liegt oberhalb von 60 und ist unberührt.
    const r = blendCombinedScore({ momentumScore: -0.02, qualityScore: 0.36, regime: "sideways_high_vol" });
    expect(r.combinedScore).toBe(60.4);
    expect(r.grade).toBe("B");
    expect(r.signalLabel).toBe("BUY");
  });
});

describe("Kostenmodell (Punkt 3)", () => {
  const zwoelfAktien = Array.from({ length: 12 }, () => ({
    gewichtPct: 100 / 12, inlaendisch: true, istFonds: false,
  }));

  it("rechnet Courtage, Stempelabgabe und Spanne in den Aufbau ein", () => {
    const k = berechneKosten(zwoelfAktien, 120_000, 30);
    // 10'000 je Position: Courtage 40 bp = 40 CHF (ueber dem Mindestsatz),
    // Stempel 7.5 bp = 7.50, Spanne 5 bp = 5 -> 52.50 je Position = 0.525 %.
    expect(k.einmaligPct).toBeCloseTo(0.525, 3);
    expect(k.laufendPct).toBe(0); // keine Fonds im Depot
    expect(k.gesamtPct).toBeCloseTo(0.525, 3);
  });

  it("macht sichtbar, dass viele Kleinpositionen teurer sind", () => {
    const wenige = berechneKosten(
      Array.from({ length: 12 }, () => ({ gewichtPct: 100 / 12, inlaendisch: true, istFonds: false })),
      60_000, 30,
    );
    const viele = berechneKosten(
      Array.from({ length: 30 }, () => ({ gewichtPct: 100 / 30, inlaendisch: true, istFonds: false })),
      60_000, 30,
    );
    // Bei 2'000 CHF je Position greift die Mindestcourtage — genau das soll
    // die Messung zeigen, statt es unter einem Prozentsatz zu verstecken.
    expect(viele.einmaligPct).toBeGreaterThan(wenige.einmaligPct);
  });

  it("belastet ausländische Titel mit der höheren Stempelabgabe", () => {
    const inland = berechneKosten([{ gewichtPct: 100, inlaendisch: true, istFonds: false }], 100_000, 30);
    const ausland = berechneKosten([{ gewichtPct: 100, inlaendisch: false, istFonds: false }], 100_000, 30);
    expect(ausland.einmaligPct).toBeGreaterThan(inland.einmaligPct);
    // Differenz genau die halbe Promille Unterschied: 15 − 7.5 bp = 0.075 %.
    expect(ausland.einmaligPct - inland.einmaligPct).toBeCloseTo(0.075, 4);
  });

  it("rechnet die laufende Gebühr anteilig, nicht für ein ganzes Jahr", () => {
    const k = berechneKosten([{ gewichtPct: 100, inlaendisch: true, istFonds: true }], 100_000, 30);
    // 25 bp p.a. auf 30 Tage = 0.25 % * 30/365 = 0.0205 %
    expect(k.laufendPct).toBeCloseTo(0.0205, 4);
  });

  it("liefert für ein leeres Depot keine erfundenen Kosten", () => {
    expect(berechneKosten([], 100_000, 30).gesamtPct).toBe(0);
    expect(berechneKosten(zwoelfAktien, 0, 30).gesamtPct).toBe(0);
  });

  it("zieht die Kosten von der Bruttorendite ab", () => {
    const k = berechneKosten(zwoelfAktien, 120_000, 30);
    expect(nettoRendite(2.0, k)).toBeCloseTo(2.0 - k.gesamtPct, 4);
    // Und kann eine knapp positive Bruttorendite ins Minus drehen — genau der
    // Fall, den die Bruttomessung verschwieg.
    expect(nettoRendite(0.3, k)).toBeLessThan(0);
  });

  it("nutzt dokumentierte Schweizer Stempelsätze", () => {
    expect(STANDARD_KOSTEN.stempelInlandBps).toBe(7.5);
    expect(STANDARD_KOSTEN.stempelAuslandBps).toBe(15);
  });
});

describe("Totband für Regimewechsel (Punkt 3)", () => {
  it("bestätigt einen Wechsel erst nach mehreren gleichen Tagen", () => {
    expect(regimeWechselBestaetigt(["bull", "bull", "sideways_high_vol"], "sideways_high_vol")).toBe(false);
    expect(regimeWechselBestaetigt(
      ["bull", "sideways_high_vol", "sideways_high_vol", "sideways_high_vol"],
      "sideways_high_vol",
    )).toBe(true);
  });

  it("lässt Flattern an der Grenze nicht durch", () => {
    // Genau der Fall, der ohne Totband Umschichtungen ausloest.
    const flattern = ["sideways_low_vol", "sideways_high_vol", "sideways_low_vol"];
    expect(regimeWechselBestaetigt(flattern, "sideways_low_vol")).toBe(false);
  });

  it("bestätigt nichts ohne genügend Historie", () => {
    expect(regimeWechselBestaetigt(["bull"], "bull")).toBe(false);
    expect(regimeWechselBestaetigt([], "bull")).toBe(false);
    expect(regimeWechselBestaetigt(["bull", "bull", "bull"], "")).toBe(false);
  });
});
