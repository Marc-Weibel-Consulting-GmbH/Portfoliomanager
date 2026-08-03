/**
 * Obligationen, Fonds und Zertifikate dürfen nicht wie Aktien beurteilt werden.
 *
 * Anlass: In der Produktionsdatenbank stehen 17 solcher Papiere unter der
 * Kategorie «Wachstumsaktien» — Wikifolio-Importe, deren Ticker noch die ISIN
 * ist. Sie wurden nach Sharpe Ratio, PEG und Momentum beurteilt und trugen
 * KGV = 0, PEG = 0 und Dividendenrendite = 0 bei einem Kurs von 99.53. Das
 * sind Nullen, die «nicht anwendbar» bedeuten, aber wie «extrem günstig»
 * aussehen.
 *
 * Der Name trägt die Information, die der Kategorie fehlt:
 * «0.35% NTS Lonza Swiss Finanz AG» ist unmissverständlich eine Anleihe.
 */

import { describe, it, expect } from "vitest";
import { detectAssetClass, istBewertbar, ASSET_CLASS_LABEL, kuponAusName } from "../lib/assetClassSignal";
import { calculateStockScore } from "../scoring";

// Echte Datensätze aus der Produktionsdatenbank (03.08.2026).
const BESTAND: [string, string, string][] = [
  ["CH0564642061", "0.35% NTS Lonza Swiss Finanz AGGuaranteed", "bond"],
  ["CH1154887132", "3/8% EMTN Holcim Helvetia Finance AGGuarante", "bond"],
  ["CH1160188343", "5/8% NTS Axpo Holding AG", "bond"],
  ["CH0344583791", "1/4% NTS Pfandbriefzentr der CHKantonalbanken", "bond"],
  ["CH0419041659", "0.1525% NTS Cembra Money Bank AG Reg S", "bond"],
  ["CH0521617305", "1.5% NTS Helvetia Schw Vers AG 2020-", "bond"],
  ["CH0595154060", "Zert VONT 2021-ohne festen Verfall auf", "certificate"],
  ["LU0158903558.EUFUND", "Ant Acatis Champion Sel FCP- Fair Value", "fund"],
  ["GG00BZ4BLM23", "Akt CS Invest PCC Ltd-L/S CHF Bond F", "bond"],
  ["CH0197484386", "Ant AMG Gold, Minen & Metalle Klasse", "gold"],
  ["C6JC.DU", "Ant CS Euroreal CHF-Tranche", "fund"],
];

describe("detectAssetClass — Erkennung trotz falscher Kategorie", () => {
  it.each(BESTAND)("%s wird als %s erkannt, obwohl die Kategorie «Wachstumsaktien» lautet", (ticker, name, erwartet) => {
    expect(detectAssetClass("Wachstumsaktien", null, name, ticker)).toBe(erwartet);
  });

  it("eine echte Aktie bleibt eine Aktie", () => {
    for (const [t, n] of [["ABBN.SW", "ABB"], ["NESN.SW", "Nestlé SA"], ["AAPL.US", "Apple Inc"]]) {
      expect(detectAssetClass("Dividendenaktien", null, n, t), t).toBe("equity");
    }
  });

  it("die Kategorie hat Vorrang, wenn sie etwas aussagt", () => {
    expect(detectAssetClass("Obligationen", null, "Irgendwas AG", "XY")).toBe("bond");
    expect(detectAssetClass("Gold", null, "Irgendwas AG", "XY")).toBe("gold");
  });

  it("ein Prozentzeichen im Firmennamen macht aus einer Aktie keine Anleihe", () => {
    // Der Kupon-Test greift nur bei ISIN-Tickern.
    expect(detectAssetClass(null, null, "5% Discount Retail AG", "DRA.DE")).toBe("equity");
  });

  it("kommt ohne Name und Ticker aus (Rückwärtskompatibilität)", () => {
    expect(detectAssetClass("Wachstumsaktien")).toBe("equity");
    expect(detectAssetClass("Obligationen")).toBe("bond");
  });
});

describe("istBewertbar", () => {
  it("Fonds und Zertifikate sind nicht bewertbar", () => {
    expect(istBewertbar("fund")).toBe(false);
    expect(istBewertbar("certificate")).toBe(false);
  });

  it("alle übrigen Klassen schon — für sie gibt es einen Massstab", () => {
    for (const k of ["equity", "bond", "gold", "commodity", "crypto", "realestate"] as const) {
      expect(istBewertbar(k), k).toBe(true);
    }
  });

  it("jede Klasse hat eine deutsche Bezeichnung", () => {
    for (const k of ["equity", "bond", "gold", "commodity", "crypto", "realestate", "fund", "certificate"] as const) {
      expect(ASSET_CLASS_LABEL[k], k).toBeTruthy();
    }
  });
});

describe("calculateStockScore — keine Aktiennote für Nicht-Aktien", () => {
  it("die Lonza-Anleihe wird nach Anleihenkriterien beurteilt, nicht nach Aktienkriterien", () => {
    const r = calculateStockScore(
      "CH0564642061",
      { peRatio: 0, pegRatio: 0, dividendYield: 0, beta: 1, volatility: 5, sharpeRatio: 0.5, ytdPerformance: 1 },
      undefined,
      "Wachstumsaktien",
      "0.35% NTS Lonza Swiss Finanz AGGuaranteed",
    );
    // Kein PEG, kein KGV, kein Sharpe — sondern Rendite, Momentum, Volatilität.
    const namen = r.subScores.map((s) => s.metric);
    expect(namen).toContain("Rendite (Coupon)");
    expect(namen).not.toContain("PEG Ratio");
    expect(namen).not.toContain("KGV");
    // Der Kupon stammt aus dem Namen, nicht aus dem 0-Feld.
    expect(r.subScores.find((s) => s.metric === "Rendite (Coupon)")!.value).toBeCloseTo(0.35, 3);
  });

  it("das Zertifikat ebenfalls nicht", () => {
    const r = calculateStockScore(
      "CH0595154060", { beta: 1, volatility: 10 }, undefined,
      "Wachstumsaktien", "Zert VONT 2021-ohne festen Verfall auf",
    );
    expect(r.totalScore).toBeNull();
  });

  it("eine Aktie behält ihren Score", () => {
    const r = calculateStockScore(
      "ABBN.SW",
      { dividendYield: 1.51, peRatio: 35.98, beta: 1.026, volatility: 27.15 },
      undefined, "Dividendenaktien", "ABB",
    );
    expect(r.totalScore).not.toBeNull();
  });

  it("ein KGV von 0 wird bei einer Anleihe gar nicht erst betrachtet", () => {
    // Genau das war der Fehler: Die Nullen bedeuten «nicht anwendbar», wurden
    // aber wie Messwerte behandelt.
    const anleihe = calculateStockScore(
      "CH1160188343", { peRatio: 0, pegRatio: 0, dividendYield: 0, ytdPerformance: 0.5, volatility: 3 },
      undefined, "Wachstumsaktien", "5/8% NTS Axpo Holding AG",
    );
    expect(anleihe.subScores.map((s) => s.metric)).not.toContain("KGV");
    expect(anleihe.subScores.find((s) => s.metric === "Rendite (Coupon)")!.value).toBeCloseTo(0.625, 3);
  });
});

describe("kuponAusName", () => {
  it("liest Dezimalkupons", () => {
    expect(kuponAusName("0.35% NTS Lonza Swiss Finanz AG")).toBeCloseTo(0.35, 4);
    expect(kuponAusName("1.5% NTS Helvetia Schw Vers AG")).toBeCloseTo(1.5, 4);
    expect(kuponAusName("0.1525% NTS Cembra Money Bank AG")).toBeCloseTo(0.1525, 4);
  });

  it("löst Brüche auf", () => {
    expect(kuponAusName("5/8% NTS Axpo Holding AG")).toBeCloseTo(0.625, 4);
    expect(kuponAusName("3/8% EMTN Holcim Helvetia Finance AG")).toBeCloseTo(0.375, 4);
    expect(kuponAusName("1/4% NTS Pfandbriefzentrale")).toBeCloseTo(0.25, 4);
  });

  it("gibt null zurück, wenn kein Kupon im Namen steht", () => {
    expect(kuponAusName("ABB")).toBeNull();
    expect(kuponAusName("Zert VONT 2021-ohne festen Verfall")).toBeNull();
    expect(kuponAusName(null)).toBeNull();
    expect(kuponAusName("")).toBeNull();
  });
});
