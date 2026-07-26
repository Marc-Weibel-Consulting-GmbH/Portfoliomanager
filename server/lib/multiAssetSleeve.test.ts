import { describe, it, expect } from "vitest";
import {
  applyMultiAssetSleeve,
  buildDeviationNote,
  MULTI_ASSET_ALLOCATION,
  MULTI_ASSET_ETFS,
  STRATEGIC_EQUITY_SHARE,
  type ResolvePriceFn,
  type SleeveEquityInput,
} from "./multiAssetSleeve";
import type { RiskProfile } from "./investorProfileScoring";

const PROFILES: RiskProfile[] = ["konservativ", "ausgewogen", "wachstum", "aggressiv"];

/** Alle kuratierten Ticker mit festem Testpreis bepreisen. */
const allAvailable: ResolvePriceFn = async (ticker) => ({
  price: 100,
  currency: "CHF",
  name: `Test ${ticker}`,
});

/** Resolver-Factory: nur die übergebenen Ticker sind bepreisbar. */
const only =
  (available: string[], price = 100): ResolvePriceFn =>
  async (ticker) =>
    available.includes(ticker) ? { price, currency: "CHF", name: `Test ${ticker}` } : null;

const equity = (weights: number[]): SleeveEquityInput[] =>
  weights.map((w, i) => ({ ticker: `STOCK${i + 1}`, name: `Aktie ${i + 1}`, weight: w }));

const sumWeights = (positions: Array<{ weight: number }>) =>
  positions.reduce((s, p) => s + p.weight, 0);

describe("MULTI_ASSET_ALLOCATION Matrix", () => {
  it("Summe je Profil = 100", () => {
    for (const profile of PROFILES) {
      const total = Object.values(MULTI_ASSET_ALLOCATION[profile]).reduce((a, b) => a + b, 0);
      expect(total).toBe(100);
    }
  });

  it("STRATEGIC_EQUITY_SHARE spiegelt die equity-Quote", () => {
    for (const profile of PROFILES) {
      expect(STRATEGIC_EQUITY_SHARE[profile]).toBe(MULTI_ASSET_ALLOCATION[profile].equity);
    }
  });

  it("jede Klasse hat mindestens einen ETF-Kandidaten", () => {
    for (const list of Object.values(MULTI_ASSET_ETFS)) {
      expect(list.length).toBeGreaterThan(0);
    }
  });
});

describe("applyMultiAssetSleeve — stocksOnly", () => {
  it("stocksOnly=true → Gewichte unverändert, deviationNote mit Profil-Quote", async () => {
    const result = await applyMultiAssetSleeve({
      equityPositions: equity([40, 35, 25]),
      riskProfile: "ausgewogen",
      stocksOnly: true,
      resolvePrice: allAvailable,
    });
    expect(result.positions.map((p) => p.weight)).toEqual([40, 35, 25]);
    expect(result.positions.every((p) => p.assetType === "stock")).toBe(true);
    expect(result.deviationNote).not.toBeNull();
    expect(result.deviationNote).toContain("ausgewogen");
    expect(result.deviationNote).toContain("55%");
    expect(result.allocation.equity).toBe(100);
    expect(result.allocation.bond).toBe(0);
    // Resolver darf bei stocksOnly nicht aufgerufen werden müssen — aber tolerant
  });

  it("buildDeviationNote enthält Profil und Quote", () => {
    expect(buildDeviationNote("konservativ")).toContain("30%");
    expect(buildDeviationNote("aggressiv")).toContain("aggressiv");
    expect(buildDeviationNote("aggressiv")).toContain("80%");
  });
});

describe("applyMultiAssetSleeve — Profil-Mix (ausgewogen)", () => {
  it("skaliert Aktien auf 55%, ETF-Positionen mit Zielgewichten, Summe = 100", async () => {
    const result = await applyMultiAssetSleeve({
      equityPositions: equity([40, 35, 25]),
      riskProfile: "ausgewogen",
      stocksOnly: false,
      resolvePrice: allAvailable,
    });
    const stocks = result.positions.filter((p) => p.assetClass === "equity");
    expect(stocks.map((p) => p.weight)).toEqual([22, 19.25, 13.75]);
    expect(sumWeights(stocks)).toBeCloseTo(55, 2);

    const etfs = result.positions.filter((p) => p.assetType === "etf");
    const byClass = (cls: string) => etfs.filter((p) => p.assetClass === cls);
    expect(sumWeights(byClass("bond"))).toBeCloseTo(25, 2);
    expect(sumWeights(byClass("gold"))).toBeCloseTo(7, 2);
    expect(sumWeights(byClass("commodity"))).toBeCloseTo(4, 2);
    expect(sumWeights(byClass("realestate"))).toBeCloseTo(6, 2);
    expect(sumWeights(byClass("crypto"))).toBeCloseTo(3, 2);
    expect(etfs.every((p) => p.price === 100 && p.currency === "CHF")).toBe(true);

    expect(result.allocation).toEqual({
      equity: 55, bond: 25, commodity: 4, gold: 7, realestate: 6, crypto: 3,
    });
    expect(sumWeights(result.positions)).toBeCloseTo(100, 1);
    expect(result.deviationNote).toBeNull();
  });
});

describe("applyMultiAssetSleeve — Krypto-Split (wachstum)", () => {
  it("Krypto 4% → 70/30 auf BTC/SOL", async () => {
    const result = await applyMultiAssetSleeve({
      equityPositions: equity([100]),
      riskProfile: "wachstum",
      stocksOnly: false,
      resolvePrice: allAvailable,
    });
    const crypto = result.positions.filter((p) => p.assetClass === "crypto");
    expect(crypto).toHaveLength(2);
    const btc = crypto.find((p) => p.ticker === "ABTC.SW");
    const sol = crypto.find((p) => p.ticker === "ASOL.SW");
    expect(btc?.weight).toBeCloseTo(2.8, 2); // 4 * 0.7
    expect(sol?.weight).toBeCloseTo(1.2, 2); // 4 * 0.3
    expect(sumWeights(result.positions)).toBeCloseTo(100, 1);
  });
});

describe("applyMultiAssetSleeve — Fallbacks", () => {
  it("Primär-ETF nicht auflösbar → Fallback-Ticker wird verwendet", async () => {
    // Bond-Primär AGGH.SW fällt aus, Rest verfügbar
    const resolver = only(["AGG", "CSBGC0.SW", "CMDY", "ZGLD.SW", "REET", "ABTC.SW", "ASOL.SW"]);
    const result = await applyMultiAssetSleeve({
      equityPositions: equity([100]),
      riskProfile: "ausgewogen",
      stocksOnly: false,
      resolvePrice: resolver,
    });
    const bond = result.positions.filter((p) => p.assetClass === "bond");
    expect(bond).toHaveLength(1);
    expect(bond[0].ticker).toBe("AGG");
    expect(bond[0].weight).toBeCloseTo(25, 1);
    expect(result.notes.some((n) => n.includes("Fallback AGG"))).toBe(true);
    expect(result.allocation.bond).toBeCloseTo(25, 1);
  });

  it("Totalfall: alle ETFs einer Klasse null → Rest bleibt Liquidität, Bandbreiten halten", async () => {
    // Alle Bond-ETFs nicht auflösbar (konservativ: bond 50%).
    //
    // Bis Juli 2026 wurde der frei gewordene Anteil proportional auf die
    // übrigen Klassen verteilt und die Summe wieder auf 100 % gebracht. Das
    // verdoppelte hier die Aktienquote von 30 % auf 60 % — aus einem
    // konservativen Profil wurde stillschweigend ein offensives. Neu ist die
    // Bandbreite je Anlageklasse bindend: verteilt wird nur bis Soll +
    // Toleranz, der Rest bleibt als Liquidität stehen und wird gemeldet.
    const resolver = only(["CMDY", "ZGLD.SW", "REET"]);
    const result = await applyMultiAssetSleeve({
      equityPositions: equity([100]),
      riskProfile: "konservativ",
      stocksOnly: false,
      resolvePrice: resolver,
      assetClassTolerancePct: 3,
    });
    expect(result.positions.filter((p) => p.assetClass === "bond")).toHaveLength(0);
    expect(result.notes.some((n) => n.includes("Obligationen"))).toBe(true);
    expect(result.allocation.bond).toBe(0);

    // Aktien: Soll 30 %, Obergrenze 33 % — NICHT mehr 60 %.
    const stocks = result.positions.filter((p) => p.assetClass === "equity");
    expect(stocks[0].weight).toBeCloseTo(33, 1);
    expect(result.allocation.equity).toBeCloseTo(33, 1);
    // Gold: Soll 8 %, Obergrenze 11 % — NICHT mehr 16 %.
    const gold = result.positions.find((p) => p.assetClass === "gold");
    expect(gold?.weight).toBeCloseTo(11, 1);

    // 30+4+8+8 = 50 investiert, je Klasse +3 aufnahmefähig = 62 %.
    // Die fehlenden 38 % bleiben liquide statt die Bänder zu sprengen.
    expect(sumWeights(result.positions)).toBeCloseTo(62, 1);
    expect(result.notes.some((n) => n.includes("Liquidität"))).toBe(true);
  });

  it("ein Krypto-Bein fällt aus → anderes Bein bleibt, Anteil umverteilt", async () => {
    // SOL-ETPs nicht auflösbar, Rest verfügbar (wachstum: crypto 4%)
    const resolver = only(["AGGH.SW", "CMDY", "ZGLD.SW", "REET", "ABTC.SW"]);
    const result = await applyMultiAssetSleeve({
      equityPositions: equity([100]),
      riskProfile: "wachstum",
      stocksOnly: false,
      resolvePrice: resolver,
    });
    const crypto = result.positions.filter((p) => p.assetClass === "crypto");
    expect(crypto).toHaveLength(1);
    expect(crypto[0].ticker).toBe("ABTC.SW");
    expect(result.notes.some((n) => n.includes("Solana"))).toBe(true);
    expect(sumWeights(result.positions)).toBeCloseTo(100, 1);
  });
});

describe("applyMultiAssetSleeve — konservativ ohne Krypto", () => {
  it("crypto-Quote 0 → keine Krypto-Positionen, Resolver wird für Krypto nicht benötigt", async () => {
    const calls: string[] = [];
    const resolver: ResolvePriceFn = async (ticker) => {
      calls.push(ticker);
      return { price: 100, currency: "CHF" };
    };
    const result = await applyMultiAssetSleeve({
      equityPositions: equity([100]),
      riskProfile: "konservativ",
      stocksOnly: false,
      resolvePrice: resolver,
    });
    expect(result.positions.filter((p) => p.assetClass === "crypto")).toHaveLength(0);
    expect(result.allocation.crypto).toBe(0);
    const cryptoTickers = MULTI_ASSET_ETFS.crypto.map((e) => e.ticker);
    expect(calls.some((t) => cryptoTickers.includes(t))).toBe(false);
    expect(sumWeights(result.positions)).toBeCloseTo(100, 1);
  });
});
