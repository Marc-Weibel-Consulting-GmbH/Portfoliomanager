import { describe, it, expect } from "vitest";
import { COPILOT_TOOLS, matchPortfolioByName, executeCopilotTool } from "./copilotTools";

describe("COPILOT_TOOLS — Schema-Sanity", () => {
  it("alle Tools sind wohlgeformt und eindeutig benannt", () => {
    const names = COPILOT_TOOLS.map((t) => t.function.name);
    expect(new Set(names).size).toBe(names.length);
    for (const t of COPILOT_TOOLS) {
      expect(t.type).toBe("function");
      expect(t.function.description!.length).toBeGreaterThan(20);
      expect((t.function.parameters as any).type).toBe("object");
    }
  });

  it("deckt die versprochenen Datenquellen ab", () => {
    const names = COPILOT_TOOLS.map((t) => t.function.name);
    expect(names).toContain("get_portfolio_details");
    expect(names).toContain("get_upcoming_dividends");
    expect(names).toContain("get_transactions");
    expect(names).toContain("get_stock_info");
    expect(names).toContain("search_stocks");
    expect(names).toContain("get_us_fundamentals");
  });
});

describe("matchPortfolioByName — Portfolio-Auflösung", () => {
  const portfolios = [{ name: "KI-Portfolio #1" }, { name: "Yvonne" }, { name: "Test Portfolio" }];

  it("exakter Treffer gewinnt (case-insensitiv)", () => {
    expect(matchPortfolioByName(portfolios, "yvonne")?.name).toBe("Yvonne");
  });

  it("eindeutiger Teilstring trifft", () => {
    expect(matchPortfolioByName(portfolios, "KI-")?.name).toBe("KI-Portfolio #1");
  });

  it("kein Name / kein Treffer → null", () => {
    expect(matchPortfolioByName(portfolios, undefined)).toBeNull();
    expect(matchPortfolioByName(portfolios, "  ")).toBeNull();
    expect(matchPortfolioByName(portfolios, "Gibtsnicht")).toBeNull();
  });
});

describe("executeCopilotTool — nie werfen", () => {
  it("unbekanntes Tool und kaputtes JSON liefern ehrliche Meldungen", async () => {
    expect(await executeCopilotTool(1, "does_not_exist", "{}")).toContain("Unbekanntes Werkzeug");
    expect(await executeCopilotTool(1, "get_stock_info", "{kein json")).toContain("Ungültige Werkzeug-Argumente");
  });
});
