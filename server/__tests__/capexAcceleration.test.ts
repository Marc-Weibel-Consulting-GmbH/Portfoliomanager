import { describe, it, expect } from "vitest";
import { berechneBeschleunigung, aktuellePhase } from "../lib/capexAcceleration";

const reihe = (werte: Array<number | null>) =>
  werte.map((w, i) => ({ recordedAt: `2026-0${i + 1}-01T00:00:00Z`, wachstumPct: w }));

describe("berechneBeschleunigung", () => {
  it("bildet die Veraenderung der Wachstumsrate ab", () => {
    const r = berechneBeschleunigung(reihe([51, 81, 77, 52]));
    expect(r.map((p) => p.beschleunigungPp)).toEqual([null, 30, -4, -25]);
  });

  it("laesst den ersten Punkt ohne Beschleunigung", () => {
    expect(berechneBeschleunigung(reihe([40]))[0].beschleunigungPp).toBeNull();
  });

  it("ueberspringt fehlende Messungen statt sie als 0 zu werten", () => {
    const r = berechneBeschleunigung(reihe([50, null, 60]));
    expect(r).toHaveLength(2);
    expect(r[1].beschleunigungPp).toBe(10);
  });

  it("sortiert unsortierte Eingaben chronologisch", () => {
    const r = berechneBeschleunigung([
      { recordedAt: "2026-03-01T00:00:00Z", wachstumPct: 70 },
      { recordedAt: "2026-01-01T00:00:00Z", wachstumPct: 50 },
    ]);
    expect(r[0].wachstumPct).toBe(50);
    expect(r[1].beschleunigungPp).toBe(20);
  });

  it("kommt mit leerer Eingabe klar", () => {
    expect(berechneBeschleunigung([])).toEqual([]);
  });
});

describe("aktuellePhase", () => {
  it("erkennt das Fenster, das Niveau und Wachstum verbergen", () => {
    // Wachstum mit 52 % weiterhin hoch — aber die Rate faellt.
    expect(aktuellePhase(berechneBeschleunigung(reihe([51, 81, 77, 52])))).toBe("verlangsamt");
  });

  it("erkennt zunehmendes Wachstum", () => {
    expect(aktuellePhase(berechneBeschleunigung(reihe([51, 81])))).toBe("beschleunigt");
  });

  it("meldet Rueckgang unabhaengig von der Beschleunigung", () => {
    expect(aktuellePhase(berechneBeschleunigung(reihe([10, -5])))).toBe("schrumpft");
  });

  it("bleibt unbestimmt ohne Vorgaenger", () => {
    expect(aktuellePhase(berechneBeschleunigung(reihe([40])))).toBe("unbestimmt");
    expect(aktuellePhase([])).toBe("unbestimmt");
  });
});

describe("konstante Reihen", () => {
  it("meldet «konstant» statt Beschleunigung 0", () => {
    // Der Live-Fall: hyperscalerCapexWachstum steht seit Monaten auf 81,
    // weil bei jedem Snapshot dieselbe Konstante mitgeschrieben wird.
    const r = berechneBeschleunigung(
      Array.from({ length: 6 }, (_, i) => ({ recordedAt: `2026-0${i + 1}-01T00:00:00Z`, wachstumPct: 81 })),
    );
    expect(r.every((p) => p.beschleunigungPp === null || p.beschleunigungPp === 0)).toBe(true);
    expect(aktuellePhase(r)).toBe("konstant");
  });

  it("erkennt Variation, sobald sie auftritt", () => {
    const r = berechneBeschleunigung([
      { recordedAt: "2026-01-01T00:00:00Z", wachstumPct: 81 },
      { recordedAt: "2026-02-01T00:00:00Z", wachstumPct: 81 },
      { recordedAt: "2026-03-01T00:00:00Z", wachstumPct: 77 },
    ]);
    expect(aktuellePhase(r)).toBe("verlangsamt");
  });
});
