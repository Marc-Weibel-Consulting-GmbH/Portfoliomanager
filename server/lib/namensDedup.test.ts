/**
 * Namensabgleich als LETZTE Dedup-Stufe — nur wenn ISIN und Primärticker
 * fehlen (KIMI Punkt 4, Manus-Befund «14 identische Namensgruppen»).
 *
 * Der wichtigste Test ist der Sixt-Fall: Stamm- und Vorzugsaktie tragen
 * denselben Namen und sind KEINE Duplikate — eine reine Namensbereinigung
 * wäre fachlich unzulässig (Manus). Deshalb greift die Stufe nur mit
 * Gattungs-Schutz, Börsen-Ungleichheit und identifizierter Partnerzeile.
 */

import { describe, it, expect } from "vitest";
import { normalisierterName, namensDuplikate } from "./namensDedup";

const zeile = (t: Partial<Parameters<typeof namensDuplikate>[0][number]>) => ({
  ticker: "X", name: null, boerse: null, sektor: null, isin: null, primaerTicker: null, ...t,
});

describe("normalisierterName", () => {
  it("streift Rechtsform-Suffixe und Interpunktion ab", () => {
    expect(normalisierterName("Capgemini SE")).toBe("capgemini");
    expect(normalisierterName("TotalEnergies SE")).toBe("totalenergies");
    expect(normalisierterName("Koninklijke Philips N.V.")).toBe("koninklijke philips");
    expect(normalisierterName("easyJet plc")).toBe("easyjet");
    expect(normalisierterName("Safran S.A.")).toBe("safran");
  });

  it("lässt den Kern des Namens unangetastet — «Holding» gehört zur Identität", () => {
    expect(normalisierterName("Roche Holding AG")).toBe("roche holding");
  });

  it("liefert für leere Namen einen leeren Schlüssel", () => {
    expect(normalisierterName(null)).toBe("");
    expect(normalisierterName("  ")).toBe("");
  });
});

describe("namensDuplikate", () => {
  const capgemini = [
    zeile({ ticker: "CAP.PA", name: "Capgemini SE", boerse: "PA", sektor: "Technology", isin: "FR0000125338", primaerTicker: "CAP.PA" }),
    zeile({ ticker: "CGM.DE", name: "Capgemini SE", boerse: "XETRA", sektor: "Technology" }),
  ];

  it("sortiert die Zweitnotiz ohne Anbieteridentität aus, wenn die Primärnotiz identifiziert ist", () => {
    const treffer = namensDuplikate(capgemini);
    expect(treffer).toHaveLength(1);
    expect(treffer[0].ticker).toBe("CGM.DE");
    expect(treffer[0].grund).toContain("CAP.PA");
  });

  it("verschont Zeilen, die selbst ISIN oder Primärticker tragen — dafür gibt es die ISIN-Stufe", () => {
    const beideIdentifiziert = [
      capgemini[0],
      zeile({ ticker: "CGM.DE", name: "Capgemini SE", boerse: "XETRA", sektor: "Technology", isin: "FR0000125338" }),
    ];
    expect(namensDuplikate(beideIdentifiziert)).toHaveLength(0);
  });

  it("Sixt-Fall: Gattungs-Marker im Namen schützt vor dem Abgleich", () => {
    const sixt = [
      zeile({ ticker: "SIX2.DE", name: "Sixt SE", boerse: "XETRA", sektor: "Industrials", isin: "DE0007231326" }),
      zeile({ ticker: "SIX3.DE", name: "Sixt SE Vorzugsaktien", boerse: "XETRA", sektor: "Industrials" }),
    ];
    expect(namensDuplikate(sixt)).toHaveLength(0);
  });

  it("gleiche Börse heisst Gattung, nicht Kreuznotierung — kein Abgleich", () => {
    // BP-Klasse: zwei Linien desselben Emittenten an derselben Börse.
    const gleicheBoerse = [
      zeile({ ticker: "AAA.L", name: "Beispiel plc", boerse: "LSE", isin: "GB000000000" }),
      zeile({ ticker: "AAB.L", name: "Beispiel plc", boerse: "LSE" }),
    ];
    expect(namensDuplikate(gleicheBoerse)).toHaveLength(0);
  });

  it("widersprechende Sektoren stoppen den Abgleich — Namensgleichheit allein genügt nicht", () => {
    const konflikt = [
      zeile({ ticker: "AAA.PA", name: "Beispiel SA", boerse: "PA", sektor: "Energy", isin: "FR000000000" }),
      zeile({ ticker: "BBB.DE", name: "Beispiel SA", boerse: "XETRA", sektor: "Utilities" }),
    ];
    expect(namensDuplikate(konflikt)).toHaveLength(0);
  });

  it("fehlt der Sektor auf einer Seite, zählt die übrige Evidenz", () => {
    const einseitig = [
      zeile({ ticker: "SAF.PA", name: "Safran S.A.", boerse: "PA", sektor: "Industrials", isin: "FR0000073272" }),
      zeile({ ticker: "SEJ1.DE", name: "Safran S.A.", boerse: "XETRA" }),
    ];
    expect(namensDuplikate(einseitig)).toHaveLength(1);
  });

  it("ohne identifizierte Partnerzeile bleibt alles stehen — Manus' Review-Queue übernimmt", () => {
    const ohneAnker = [
      zeile({ ticker: "AAA.PA", name: "Beispiel SA", boerse: "PA" }),
      zeile({ ticker: "BBB.DE", name: "Beispiel SA", boerse: "XETRA" }),
    ];
    expect(namensDuplikate(ohneAnker)).toHaveLength(0);
  });
});
