import { describe, expect, it } from "vitest";
import { detectBank, extractPositionsViaLlm, type LlmInvokeFn } from "./index";

// ─── detectBank ─────────────────────────────────────────────────────────────

describe("detectBank", () => {
  it("erkennt Swissquote im Kopfbereich", () => {
    const r = detectBank("Swissquote Bank AG\nDepotauszug per 31.12.2025\n...");
    expect(r.bankId).toBe("swissquote");
    expect(r.confidence).toBeGreaterThan(0.5);
  });

  it("erkennt die Luzerner Kantonalbank (LUKB)", () => {
    const r = detectBank(
      "Luzerner Kantonalbank\nHeller Dora Erben\nDepotauszug Reichmuth per 23.04.2025"
    );
    expect(r.bankId).toBe("lukb");
    expect(r.bankName).toBe("Luzerner Kantonalbank");
  });

  it("erkennt LUKB auch ueber das Kuerzel", () => {
    const r = detectBank("LUKB Depot 12.34567.89\nAuszug per 01.01.2026");
    expect(r.bankId).toBe("lukb");
  });

  it("erkennt UBS", () => {
    const r = detectBank(
      "UBS Switzerland AG\nDepot 0243-567890\nValorenverzeichnis"
    );
    expect(r.bankId).toBe("ubs");
  });

  it("gibt 'unknown' zurueck bei unbekannter Bank", () => {
    const r = detectBank(
      "Musterbank AG\nDepotauszug per 01.01.2026\nTotal CHF 100'000"
    );
    expect(r.bankId).toBe("unknown");
    expect(r.confidence).toBe(0);
  });
});

// ─── extractPositionsViaLlm ─────────────────────────────────────────────────

const llmOkResponse = JSON.stringify({
  reportDate: "2025-04-23",
  accountHolder: "Heller Dora Erben",
  totalValueCHF: 250000,
  positions: [
    {
      name: "Nestlé SA",
      isin: "CH0038863350",
      currency: "CHF",
      quantity: 100,
      avgPurchasePrice: 80.5,
      marketPrice: 85.2,
      marketValueCHF: 8520,
      assetType: "stock",
    },
    {
      name: "Bitcoin",
      isin: null,
      currency: "USD",
      quantity: 0.5,
      avgPurchasePrice: 60000,
      marketPrice: 95000,
      marketValueCHF: 42000,
      assetType: "crypto",
    },
  ],
});

function mockLlm(content: string): LlmInvokeFn {
  return async () => ({
    choices: [{ message: { content } }],
  });
}

describe("extractPositionsViaLlm", () => {
  const detection = detectBank("Luzerner Kantonalbank Depotauszug");

  it("normalisiert eine valide LLM-Antwort", async () => {
    const r = await extractPositionsViaLlm(
      "...",
      detection,
      mockLlm(llmOkResponse)
    );
    expect(r.positions).toHaveLength(2);
    expect(r.reportDate).toBe("2025-04-23");
    expect(r.accountHolder).toBe("Heller Dora Erben");
    expect(r.totalValueCHF).toBe(250000);
    expect(r.positions[0]).toMatchObject({
      name: "Nestlé SA",
      isin: "CH0038863350",
      currency: "CHF",
      quantity: 100,
      assetType: "stock",
    });
    expect(r.positions[1].assetType).toBe("crypto");
    expect(r.warnings[0]).toContain("Luzerner Kantonalbank");
  });

  it("verwirft ungueltige ISINs, behaelt die Position", async () => {
    const badIsin = JSON.stringify({
      positions: [
        {
          name: "Roche Holding",
          isin: "RO-INVALID",
          currency: "CHF",
          quantity: 10,
          avgPurchasePrice: null,
          marketPrice: 250,
          marketValueCHF: null,
          assetType: "stock",
        },
      ],
    });
    const r = await extractPositionsViaLlm("...", detection, mockLlm(badIsin));
    expect(r.positions).toHaveLength(1);
    expect(r.positions[0].isin).toBeNull();
    expect(r.warnings.some(w => w.includes("ungueltige ISIN"))).toBe(true);
  });

  it("filtert Positionen mit ungueltiger Stueckzahl und Duplikate", async () => {
    const dup = JSON.stringify({
      positions: [
        {
          name: "Alpha AG",
          isin: null,
          currency: "CHF",
          quantity: 5,
          assetType: "stock",
        },
        {
          name: "Alpha AG",
          isin: null,
          currency: "CHF",
          quantity: 5,
          assetType: "stock",
        },
        {
          name: "Beta AG",
          isin: null,
          currency: "CHF",
          quantity: 0,
          assetType: "stock",
        },
        {
          name: "Xenon AG",
          isin: null,
          currency: "CHF",
          quantity: -3,
          assetType: "stock",
        },
      ],
    });
    const r = await extractPositionsViaLlm("...", detection, mockLlm(dup));
    expect(r.positions).toHaveLength(1);
    expect(r.positions[0].name).toBe("Alpha AG");
  });

  it("wirft bei ungueltigem JSON einen klaren Fehler", async () => {
    await expect(
      extractPositionsViaLlm("...", detection, mockLlm("kein JSON {"))
    ).rejects.toThrow("kein valides JSON");
  });

  it("wirft bei leerer LLM-Antwort einen Fehler", async () => {
    await expect(
      extractPositionsViaLlm("...", detection, mockLlm("   "))
    ).rejects.toThrow("leere Antwort");
  });

  it("akzeptiert 0 als legitimen Zahlenwert (nicht null)", async () => {
    const withZero = JSON.stringify({
      positions: [
        {
          name: "Zero AG",
          isin: null,
          currency: "CHF",
          quantity: 10,
          avgPurchasePrice: 0,
          marketPrice: 12,
          marketValueCHF: 120,
          assetType: "stock",
        },
      ],
    });
    const r = await extractPositionsViaLlm("...", detection, mockLlm(withZero));
    expect(r.positions[0].avgPurchasePrice).toBe(0);
  });
});
