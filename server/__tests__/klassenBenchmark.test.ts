/**
 * Vergleichsmassstab für Multi-Asset-Vorschläge.
 *
 * Der zentrale Test ist der erste: Ein Vorschlag nach Profil «ausgewogen» darf
 * nicht mehr gegen reine Aktien gemessen werden, sonst bestraft der Massstab
 * genau die Obligationen- und Goldquote, die das Profil verlangt.
 */
import { describe, it, expect } from "vitest";
import {
  KLASSEN_REFERENZ,
  berechneComposite,
  quotenAusProfil,
} from "../lib/klassenBenchmark";

describe("berechneComposite", () => {
  it("misst ein gemischtes Profil nicht mehr an reinen Aktien", () => {
    // Ausgewogen: 55 % Aktien, 25 % Obligationen, 12 % Gold, 8 % Immobilien.
    // Aktien +4 %, Obligationen +0.5 %, Gold +1 %, Immobilien +2 %.
    const r = berechneComposite([
      { klasse: "equity", sollQuotePct: 55, chfReturn: 0.04 },
      { klasse: "bond", sollQuotePct: 25, chfReturn: 0.005 },
      { klasse: "gold", sollQuotePct: 12, chfReturn: 0.01 },
      { klasse: "realestate", sollQuotePct: 8, chfReturn: 0.02 },
    ])!;
    // 0.022 + 0.00125 + 0.0012 + 0.0016 = 0.02605
    expect(r.compositeReturn).toBeCloseTo(0.02605, 6);
    // Der reine Aktienmassstab laege bei 0.04 — der Vorschlag haette also
    // 1.4 Prozentpunkte «Minderleistung» ausgewiesen, die keine ist.
    expect(r.compositeReturn).toBeLessThan(0.04);
    expect(r.abdeckungPct).toBe(100);
  });

  it("renormiert auf die abgedeckten Klassen", () => {
    const r = berechneComposite([
      { klasse: "equity", sollQuotePct: 80, chfReturn: 0.05 },
      { klasse: "bond", sollQuotePct: 20, chfReturn: null },
    ])!;
    // Nur Aktien vorhanden -> deren Rendite, nicht auf 100 % heruntergerechnet.
    expect(r.compositeReturn).toBeCloseTo(0.05, 6);
    expect(r.abdeckungPct).toBe(80);
  });

  it("liefert kein Ergebnis, wenn zu wenige Klassen abgedeckt sind", () => {
    // Ein Massstab aus einem Drittel der Quoten waere eine Hochrechnung.
    const r = berechneComposite([
      { klasse: "equity", sollQuotePct: 30, chfReturn: 0.05 },
      { klasse: "bond", sollQuotePct: 70, chfReturn: null },
    ]);
    expect(r).toBeNull();
  });

  it("liefert kein Ergebnis ohne jede Rendite", () => {
    expect(berechneComposite([{ klasse: "equity", sollQuotePct: 100, chfReturn: null }])).toBeNull();
  });

  it("liefert kein Ergebnis ohne Quoten", () => {
    expect(berechneComposite([])).toBeNull();
    expect(berechneComposite([{ klasse: "equity", sollQuotePct: 0, chfReturn: 0.05 }])).toBeNull();
  });

  it("weist die Beiträge je Klasse aus", () => {
    const r = berechneComposite([
      { klasse: "equity", sollQuotePct: 60, chfReturn: 0.03 },
      { klasse: "gold", sollQuotePct: 40, chfReturn: -0.01 },
    ])!;
    expect(r.beitraege).toHaveLength(2);
    expect(r.beitraege.find((b) => b.klasse === "gold")?.chfReturn).toBe(-0.01);
  });

  it("bildet negative Marktphasen korrekt ab", () => {
    const r = berechneComposite([
      { klasse: "equity", sollQuotePct: 50, chfReturn: -0.10 },
      { klasse: "bond", sollQuotePct: 50, chfReturn: 0.01 },
    ])!;
    // Die Obligationenquote daempft — genau das soll der Massstab abbilden.
    expect(r.compositeReturn).toBeCloseTo(-0.045, 6);
  });
});

describe("quotenAusProfil", () => {
  it("übernimmt nur Klassen mit Quote über null", () => {
    const q = quotenAusProfil({ equity: 55, bond: 25, gold: 12, realestate: 8, commodity: 0, crypto: 0 });
    expect(q.map((x) => x.klasse)).toEqual(["equity", "bond", "gold", "realestate"]);
  });

  it("kommt mit fehlender Allokation zurecht", () => {
    expect(quotenAusProfil(null)).toEqual([]);
    expect(quotenAusProfil(undefined)).toEqual([]);
  });
});

describe("KLASSEN_REFERENZ", () => {
  it("hat für jede Anlageklasse ein Referenzinstrument", () => {
    for (const k of ["equity", "bond", "commodity", "gold", "realestate", "crypto"] as const) {
      expect(KLASSEN_REFERENZ[k]?.ticker).toBeTruthy();
      expect(KLASSEN_REFERENZ[k]?.currency).toBeTruthy();
    }
  });

  it("nutzt für Aktien dieselbe Reihe wie die übrige Erfolgsmessung", () => {
    expect(KLASSEN_REFERENZ.equity.ticker).toBe("CHSPI.SW");
  });
});
