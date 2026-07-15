import { describe, it, expect } from "vitest";
import { formatPortfolioBriefing, APP_HANDBUCH } from "./copilotContext";

describe("formatPortfolioBriefing — Steckbrief für den Copilot", () => {
  it("listet alle Portfolios und rechnet die Fokus-Performance aus echten Zahlen", () => {
    const s = formatPortfolioBriefing({
      portfolios: [
        { name: "KI-Portfolio #1", isLive: true, positionCount: 25, isFocus: true },
        { name: "Test Portfolio", isLive: false, positionCount: 14, isFocus: false },
      ],
      focus: {
        name: "KI-Portfolio #1",
        totalValueChf: 499_200,
        totalInvestedChf: 450_000,
        positions: [
          { ticker: "NESN", name: "Nestlé", valueChf: 50_000, weightPct: 10.0, ytdPct: 4.2 },
          { ticker: "AAPL", name: "Apple", valueChf: 45_000, weightPct: 9.0, ytdPct: null },
        ],
        skippedPositions: 23,
        recentTransactions: [{ date: "2026-07-10", type: "Kauf", ticker: "NESN", shares: 20 }],
      },
    });

    expect(s).toContain("KI-Portfolio #1 (LIVE, 25 Positionen) ← Detail unten");
    expect(s).toContain("Test Portfolio (Test, 14 Positionen)");
    // Tausendertrenner ist ICU-abhängig (’ vs ') — trennerneutral prüfen.
    expect(s).toMatch(/Wert CHF 499.200 · investiert CHF 450.000 · Performance \+10\.9%/);
    expect(s).toMatch(/NESN Nestlé: CHF 50.000 \(10\.0%\), YTD \+4\.2%/);
    expect(s).toMatch(/AAPL Apple: CHF 45.000 \(9\.0%\)\n/); // ohne YTD-Behauptung
    expect(s).toContain("… und 23 weitere Positionen");
    expect(s).toContain("2026-07-10: Kauf 20 × NESN");
  });

  it("ohne Fokus-Bewertung: nur die ehrliche Portfolio-Liste, keine erfundenen Werte", () => {
    const s = formatPortfolioBriefing({
      portfolios: [{ name: "Yvonne", isLive: true, positionCount: 22, isFocus: false }],
      focus: null,
    });
    expect(s).toContain("Yvonne (LIVE, 22 Positionen)");
    expect(s).not.toContain("Wert CHF");
    expect(s).not.toContain("Performance");
  });

  it("App-Handbuch existiert und warnt vor erfundenen Funktionen", () => {
    expect(APP_HANDBUCH).toContain("erfinde keine");
    expect(APP_HANDBUCH).toContain("Preisalarme");
    expect(APP_HANDBUCH).toContain("Anlageprofil");
  });
});
