/**
 * Einheit der Dividendenrendite.
 *
 * Anlass: In `stocks.dividendYield` standen Werte wie 151 für ABB (1.51 %),
 * 376 für Nestlé (3.76 %) und 31 für Apple (0.31 %) — alle exakt hundertfach
 * zu hoch.
 *
 * Ursache: `eodhdApi.ts:198` rechnet den EODHD-Bruch korrekt in Prozent um
 * (0.0151 → 1.51). `signalScoreRefreshScheduled` multiplizierte denselben,
 * bereits umgerechneten Wert erneut mit 100.
 *
 * Die sichtbarste Folge war nicht die Anzeige, sondern der damalige
 * Signal-Score `calcSignalScore` (vierte Formel, seit K2 entfernt): Er
 * erwartete einen Bruch (Schwelle 0.06 = 6 %) und bekam Prozent. Jeder Titel
 * mit irgendeiner Ausschüttung erhielt so +15 Punkte — live nachweisbar an
 * «Sehr hohe Dividende (151.0%)» bei ABB. Die Einheiten-Reparatur an der
 * Quelle (dieses Testfile) bleibt — sie schützt alle heutigen Verbraucher.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  alsProzent,
  eodhdBruchZuProzent,
  istPlausibleRendite,
  PLAUSIBEL_MAX_PROZENT,
} from "../lib/dividendenrendite";

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("istPlausibleRendite", () => {
  it("akzeptiert reale Renditen", () => {
    for (const v of [0, 0.31, 1.51, 3.76, 8, 15, PLAUSIBEL_MAX_PROZENT]) {
      expect(istPlausibleRendite(v)).toBe(true);
    }
  });

  it("verwirft die hundertfach zu hohen Altwerte", () => {
    for (const v of [31, 151, 235, 368, 376, 380]) {
      expect(istPlausibleRendite(v)).toBe(false);
    }
  });

  it("verwirft fehlende und unsinnige Werte", () => {
    expect(istPlausibleRendite(null)).toBe(false);
    expect(istPlausibleRendite(undefined)).toBe(false);
    expect(istPlausibleRendite(NaN)).toBe(false);
    expect(istPlausibleRendite(-1)).toBe(false);
  });
});

describe("alsProzent", () => {
  it("lässt einen bereits korrekten Wert unverändert", () => {
    expect(alsProzent(1.51)).toBe(1.51);
    expect(alsProzent(0.31)).toBe(0.31);
    expect(alsProzent(0)).toBe(0);
  });

  it("repariert die echten Altwerte aus der Produktionsdatenbank", () => {
    expect(alsProzent(151)).toBeCloseTo(1.51, 6);   // ABBN.SW
    expect(alsProzent(376)).toBeCloseTo(3.76, 6);   // NESN.SW
    expect(alsProzent(368)).toBeCloseTo(3.68, 6);   // NOVN.SW
    expect(alsProzent(235)).toBeCloseTo(2.35, 6);   // KO.US
    expect(alsProzent(31)).toBeCloseTo(0.31, 6);    // AAPL.US
  });

  it("verwirft, was auch geteilt keine Rendite sein kann", () => {
    expect(alsProzent(90000)).toBeNull();
  });

  it("verwirft fehlende Werte, statt sie zu 0 zu machen", () => {
    expect(alsProzent(null)).toBeNull();
    expect(alsProzent(undefined)).toBeNull();
    expect(alsProzent(-5)).toBeNull();
  });
});

describe("eodhdBruchZuProzent", () => {
  it("rechnet nur den dokumentierten EODHD-Rohbruch einmalig in Prozent um", () => {
    expect(eodhdBruchZuProzent(0.0024)).toBeCloseTo(0.24, 10);
    expect(eodhdBruchZuProzent(0.0002)).toBeCloseTo(0.02, 10);
  });

  it("verwirft fehlende oder ungültige Rohwerte statt ihre Einheit zu raten", () => {
    expect(eodhdBruchZuProzent(null)).toBeNull();
    expect(eodhdBruchZuProzent(-0.01)).toBeNull();
    expect(eodhdBruchZuProzent(Number.NaN)).toBeNull();
  });
});

describe("Regression: der Fehler selbst", () => {
  it("ein Rohwert von 151 wird an der Quelle auf 1.51 % repariert", () => {
    // Vor dem Fix erhielt jeder Titel mit Dividende +15 Punkte in der
    // (inzwischen entfernten) vierten Signalformel. Die Reparatur an der
    // Quelle bleibt der Schutz für alle heutigen Verbraucher.
    expect(alsProzent(151)).toBeCloseTo(1.51, 6);
  });
});
