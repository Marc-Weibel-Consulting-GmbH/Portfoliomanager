import { describe, it, expect } from "vitest";

/**
 * «Seit Kauf» und die Dimensionierung der Positionen — Rechenregeln.
 *
 * Diese Datei hält die Arithmetik fest, an der zwei aufeinanderfolgende
 * Fehlversuche gescheitert sind:
 *
 * 1. Ursprünglich verglich die Kennzahl das Startkapital mit den Positionen und
 *    ignorierte die Liquidität → ein frisch erstelltes Portfolio startete bei
 *    −23.8 %.
 * 2. Der Fix addierte cashBalance — aber `totalValueCHF` enthält die Liquidität
 *    bereits (portfoliosRouter addiert sie vor der Rückgabe). Die Cash-Quote
 *    zählte doppelt → dasselbe Portfolio startete nun bei +18.0 %.
 *
 * Dazu kam ein unabhängiger Fehler: Die Positionsgewichte wurden auf 100 %
 * normiert, obwohl die Liquiditätsquote beim Anlegen separat als Cash gebucht
 * wird. Das Portfolio startete damit mit 110 % des Einsatzes.
 */

/** Kennzahl «Seit Kauf» — `totalValueCHF` schliesst die Liquidität ein. */
function seitKaufPct(totalValueCHF: number, investmentAmount: number): number | null {
  if (!(investmentAmount > 0)) return null;
  return ((totalValueCHF - investmentAmount) / investmentAmount) * 100;
}

/** Zielsumme der Positionsgewichte = investierter Anteil, nicht 100 %. */
function zielSumme(liquidityNeedPct: number): number {
  return liquidityNeedPct > 0 && liquidityNeedPct < 100 ? 100 - liquidityNeedPct : 100;
}

describe("Seit Kauf", () => {
  it("ist 0 % am Erstellungstag, wenn eine Cash-Quote besteht", () => {
    // Kapital 150'000, davon 10 % Liquidität: Positionen 135'000 + Cash 15'000.
    const positionen = 135_000;
    const cash = 15_000;
    expect(seitKaufPct(positionen + cash, 150_000)).toBeCloseTo(0, 6);
  });

  it("ist 0 % am Erstellungstag ohne Cash-Quote", () => {
    expect(seitKaufPct(150_000, 150_000)).toBeCloseTo(0, 6);
  });

  it("zaehlt die Liquiditaet nicht doppelt", () => {
    // Der konkrete Live-Fall: Wert 162'005 (inkl. 15'000 Cash), Einstand 150'000.
    // Die fehlerhafte Variante rechnete 162'005 + 15'000 − 150'000 = +18.0 %.
    const falsch = ((162_005 + 15_000 - 150_000) / 150_000) * 100;
    expect(falsch).toBeCloseTo(18.0, 1);
    expect(seitKaufPct(162_005, 150_000)).toBeCloseTo(8.0, 1);
  });

  it("bildet echte Kursbewegung ab", () => {
    expect(seitKaufPct(165_000, 150_000)).toBeCloseTo(10, 6);
    expect(seitKaufPct(135_000, 150_000)).toBeCloseTo(-10, 6);
  });

  it("liefert null ohne Einsatz", () => {
    expect(seitKaufPct(1000, 0)).toBeNull();
  });
});

describe("Zielsumme der Positionsgewichte", () => {
  it("laesst Raum fuer die Liquiditaetsquote", () => {
    expect(zielSumme(10)).toBe(90);
    expect(zielSumme(24)).toBe(76);
  });

  it("bleibt bei 100 %, wenn keine Reserve vorgesehen ist", () => {
    expect(zielSumme(0)).toBe(100);
  });

  it("ignoriert unsinnige Quoten statt auf 0 zu normieren", () => {
    expect(zielSumme(100)).toBe(100);
    expect(zielSumme(-5)).toBe(100);
  });

  it("ergibt zusammen mit der Cash-Buchung genau das Kapital", () => {
    const kapital = 150_000;
    const liq = 10;
    const positionen = kapital * (zielSumme(liq) / 100);
    const cash = kapital * (liq / 100);
    expect(positionen + cash).toBeCloseTo(kapital, 6);
    expect(seitKaufPct(positionen + cash, kapital)).toBeCloseTo(0, 6);
  });
});
