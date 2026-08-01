/**
 * Identität und Rechenbasis der Vergleichsindizes.
 *
 * Die Tests halten zwei Fehler fest, die sich gegenseitig verdeckt haben:
 *  - Der Schlüssel «SMI» wird aus einem SPI-ETF gefüllt.
 *  - Der echte SMI lief an mehreren Stellen unter der Beschriftung «SPI».
 *
 * Wichtiger als die Namen ist die Basis: Benchmark und Titel müssen beide auf
 * Kursrendite stehen, sonst enthält jedes Alpha die Dividendenrendite des
 * Marktes als stillen Abzug.
 */
import { describe, it, expect } from "vitest";
import {
  BENCHMARKS,
  benchmarkLabel,
  benchmarkTicker,
  preisFeldFuerBasis,
  BENCHMARK_LOOKBACK_TAGE,
} from "../lib/benchmarkIdentity";

describe("Benchmark-Identität", () => {
  it("nennt den Schweizer Benchmark beim echten Index — er stammt aus einem SPI-ETF", () => {
    expect(benchmarkTicker("SMI")).toBe("CHSPI.SW");
    expect(BENCHMARKS.SMI.index).toBe("SPI");
    expect(benchmarkLabel("SMI")).toContain("SPI");
    // Der Schluessel bleibt «SMI» (Datenbank-Enum), der Anzeigename nicht.
    expect(benchmarkLabel("SMI")).not.toBe("SMI");
  });

  it("weist aus, wo Schlüssel und Index auseinandergehen", () => {
    expect(BENCHMARKS.SMI.hinweis).toBeTruthy();
    expect(BENCHMARKS.MSCI_WORLD.hinweis).toBeTruthy(); // ACWI, nicht MSCI World
    expect(BENCHMARKS.SP500.hinweis).toBeUndefined();   // hier stimmt beides
  });

  it("führt alle drei Benchmarks auf Kursbasis", () => {
    for (const b of Object.values(BENCHMARKS)) {
      expect(b.basis).toBe("kurs");
    }
  });
});

describe("preisFeldFuerBasis", () => {
  const zeile = { close: 100, adjusted_close: 103 };

  it("nimmt auf Kursbasis den unbereinigten Schlusskurs", () => {
    // Genau hier sass der Fehler: adjusted_close enthaelt die Ausschuettungen,
    // die Titelseite kennt sie nicht — das Alpha war dauerhaft zu tief.
    expect(preisFeldFuerBasis(zeile, "kurs")).toBe(100);
  });

  it("nimmt auf Gesamtrendite-Basis den bereinigten Kurs", () => {
    expect(preisFeldFuerBasis(zeile, "gesamtrendite")).toBe(103);
  });

  it("faellt auf close zurueck, wenn kein bereinigter Kurs geliefert wird", () => {
    expect(preisFeldFuerBasis({ close: 100 }, "gesamtrendite")).toBe(100);
  });

  it("erzeugt bei gemischten Basen einen messbaren Unterschied", () => {
    // Belegt, warum die Reihe nicht teilweise umgestellt werden darf: Ein
    // Fenster ueber die Basisgrenze zeigte sonst einen Sprung von 3 %.
    const kurs = preisFeldFuerBasis(zeile, "kurs");
    const gesamt = preisFeldFuerBasis(zeile, "gesamtrendite");
    expect(gesamt / kurs - 1).toBeCloseTo(0.03, 5);
  });
});

describe("Rückschreibfenster", () => {
  it("deckt jedes Messfenster ab, damit keine zwei Basen in einer Reihe stehen", () => {
    // Der Auswertungshorizont sind 30 Tage; der Optimizer schaut deutlich
    // weiter zurueck. Drei Jahre decken beides mit Reserve.
    expect(BENCHMARK_LOOKBACK_TAGE).toBeGreaterThan(365 * 2);
  });
});
