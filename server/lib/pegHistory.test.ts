import { describe, expect, it } from "vitest";
import {
  MIN_WACHSTUM_FUER_PEG,
  pegZeitreihe,
  trailingPeg,
  type PegStichtag,
} from "./pegHistory";

describe("MIN_WACHSTUM_FUER_PEG", () => {
  it("haelt denselben Schwellenwert wie qualityMetricsService.MIN_WACHSTUM_FUER_PEG", () => {
    // Die Konstante ist bewusst dupliziert (siehe Kopfkommentar in pegHistory.ts):
    // Der Live-Service exportiert sie nicht. Aendert sich der Wert dort,
    // muss dieser Test angepasst werden — dann ist das Modul wieder synchron.
    expect(MIN_WACHSTUM_FUER_PEG).toBe(2);
  });
});

describe("trailingPeg", () => {
  it("teilt KGV durch das 5-Jahres-Wachstum", () => {
    const r = trailingPeg({ kgv: 28, epsWachstum5j: 8, epsWachstumTTM: 12 });
    expect(r.peg).toBeCloseTo(3.5, 10);
    expect(r.wachstum).toBe(8);
    expect(r.wachstumsQuelle).toBe("5j");
    expect(r.grund).toBeNull();
  });

  it("nimmt TTM als Fallback, wenn kein 5j-CAGR belegt ist", () => {
    const r = trailingPeg({ kgv: 15, epsWachstum5j: null, epsWachstumTTM: 10 });
    expect(r.peg).toBeCloseTo(1.5, 10);
    expect(r.wachstumsQuelle).toBe("ttm");
  });

  it("zieht 5j auch dann vor, wenn TTM anders aussage", () => {
    // Konsistenz mit qualityMetricsService.forwardPeg: das glattere Mass zuerst.
    const r = trailingPeg({ kgv: 40, epsWachstum5j: 5, epsWachstumTTM: 20 });
    expect(r.peg).toBeCloseTo(8, 10);
    expect(r.wachstumsQuelle).toBe("5j");
  });

  it("akzeptiert die Schwelle von 2 % p.a. exakt", () => {
    const r = trailingPeg({ kgv: 20, epsWachstum5j: 2, epsWachstumTTM: null });
    expect(r.peg).toBeCloseTo(10, 10);
    expect(r.grund).toBeNull();
  });

  it("blendet bei Wachstum unter 2 % aus statt durch fast null zu teilen", () => {
    // Der PEG-47-Fall aus dem Kommentar in qualityMetricsService: arithmetisch
    // moeglich, inhaltlich wertlos — also null mit Grund, nicht eine Zahl.
    const r = trailingPeg({ kgv: 32.9, epsWachstum5j: 0.7, epsWachstumTTM: null });
    expect(r.peg).toBeNull();
    expect(r.grund).toBe("wachstum_zu_gering");
    expect(r.wachstum).toBe(0.7); // das Wachstum bleibt als Aussage sichtbar
  });

  it("blendet negatives Wachstum aus", () => {
    const r = trailingPeg({ kgv: 18, epsWachstum5j: -3, epsWachstumTTM: null });
    expect(r.peg).toBeNull();
    expect(r.grund).toBe("wachstum_zu_gering");
  });

  it("blendet bei null Wachstum aus", () => {
    const r = trailingPeg({ kgv: 18, epsWachstum5j: 0, epsWachstumTTM: null });
    expect(r.peg).toBeNull();
    expect(r.grund).toBe("wachstum_zu_gering");
  });

  it("blendet ohne jede Wachstumsangabe aus", () => {
    const r = trailingPeg({ kgv: 22, epsWachstum5j: null, epsWachstumTTM: null });
    expect(r.peg).toBeNull();
    expect(r.grund).toBe("wachstum_fehlt");
    expect(r.wachstumsQuelle).toBeNull();
  });

  it("blendet bei fehlendem KGV aus (EPS <= 0 oder kein Kurs zum Stichtag)", () => {
    const r = trailingPeg({ kgv: null, epsWachstum5j: 6, epsWachstumTTM: 4 });
    expect(r.peg).toBeNull();
    expect(r.grund).toBe("kgv_fehlt");
  });

  it("blendet bei nicht positivem KGV aus (Vorzeichen-Artefakt)", () => {
    const r = trailingPeg({ kgv: -5, epsWachstum5j: 6, epsWachstumTTM: null });
    expect(r.peg).toBeNull();
    expect(r.grund).toBe("kgv_nicht_positiv");
  });
});

function stichtag(datum: string, kgv: number | null, w5: number | null, ttm: number | null): PegStichtag {
  return { datum, kgv, epsWachstum5j: w5, epsWachstumTTM: ttm };
}

describe("pegZeitreihe", () => {
  it("wertet aus, wenn mindestens 70 % der Stichtage gueltig sind", () => {
    const reihe = pegZeitreihe([
      stichtag("2020-01-31", 28, 8, null),   // 3.5
      stichtag("2020-04-30", 15, null, 10),  // 1.5
      stichtag("2020-07-31", 20, 4, null),   // 5
      stichtag("2020-10-31", 30, 10, null),  // 3
      stichtag("2021-01-31", 24, 6, null),   // 4
      stichtag("2021-04-30", 18, 9, null),   // 2
      stichtag("2021-07-31", 21, 7, null),   // 3
      stichtag("2021-10-31", null, 6, null), // kgv_fehlt
      stichtag("2022-01-31", 25, 1, null),   // wachstum_zu_gering
      stichtag("2022-04-30", 25, null, null) // wachstum_fehlt
    ]);
    expect(reihe.zeilen).toHaveLength(10);
    expect(reihe.gueltig).toBe(7);
    expect(reihe.abdeckungPct).toBe(70);
    expect(reihe.auswertbar).toBe(true);
    // Mittel aus 3.5, 1.5, 5, 3, 4, 2, 3 = 22 / 7
    expect(reihe.mittelPeg).toBeCloseTo(22 / 7, 10);
  });

  it("gibt unter der Abdeckungsschwelle kein zusammengefasstes Ergebnis", () => {
    // Wie berechneComposite in klassenBenchmark: duenne Reihe = Hochrechnung,
    // also lieber keine Zahl. Die Rohzeilen bleiben zur Diagnose sichtbar.
    const reihe = pegZeitreihe([
      stichtag("2020-01-31", 28, 8, null),
      stichtag("2020-04-30", 15, null, 10),
      stichtag("2020-07-31", 20, 4, null),
      stichtag("2020-10-31", 30, 10, null),
      stichtag("2021-01-31", 24, 6, null),
      stichtag("2021-04-30", 18, 9, null),
      stichtag("2021-07-31", null, 6, null),
      stichtag("2021-10-31", 25, 1, null),
      stichtag("2022-01-31", 25, null, null),
      stichtag("2022-04-30", null, null, null)
    ]);
    expect(reihe.gueltig).toBe(6);
    expect(reihe.abdeckungPct).toBe(60);
    expect(reihe.auswertbar).toBe(false);
    expect(reihe.mittelPeg).toBeNull();
    expect(reihe.zeilen).toHaveLength(10); // Diagnose bleibt
  });

  it("laesst die Abdeckungsschwelle konfigurieren", () => {
    const input = [
      stichtag("2021-01-31", 20, 5, null),
      stichtag("2021-04-30", null, 5, null)
    ];
    expect(pegZeitreihe(input, 50).auswertbar).toBe(true);
    expect(pegZeitreihe(input).auswertbar).toBe(false); // Default 70
  });

  it("behandelt eine leere Reihe als nicht auswertbar", () => {
    const reihe = pegZeitreihe([]);
    expect(reihe.zeilen).toHaveLength(0);
    expect(reihe.abdeckungPct).toBe(0);
    expect(reihe.auswertbar).toBe(false);
    expect(reihe.mittelPeg).toBeNull();
  });
});
