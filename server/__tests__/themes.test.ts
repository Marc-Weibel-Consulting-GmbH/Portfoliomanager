import { describe, it, expect } from "vitest";
import { themeOfTicker, THEME_LABELS, THEME_BY_TICKER } from "../../shared/themes";

/** Themen-Anteil wie in checkDiversificationRules — bezogen aufs investierte Vermoegen. */
function themenAnteil(holdings: Array<{ ticker: string; weight: string }>): Record<string, number> {
  const investiert = holdings.reduce((s, h) => s + parseFloat(h.weight), 0);
  const out: Record<string, number> = {};
  for (const h of holdings) {
    const key = themeOfTicker(h.ticker);
    if (!key) continue;
    const label = THEME_LABELS[key];
    out[label] = (out[label] ?? 0) + (parseFloat(h.weight) / investiert) * 100;
  }
  return out;
}

describe("themeOfTicker", () => {
  it("erkennt die KI-Infrastruktur-Kette ueber Sektorgrenzen hinweg", () => {
    for (const t of ["NVDA", "AVGO", "MRVL", "ARM", "IREN", "ORCL"]) {
      expect(themeOfTicker(t)).toBe("ai_infra");
    }
  });

  it("erkennt Krypto-Proxies", () => {
    expect(themeOfTicker("MSTR")).toBe("crypto_proxy");
    expect(themeOfTicker("COIN")).toBe("crypto_proxy");
  });

  it("ist unabhaengig von der Schreibweise", () => {
    expect(themeOfTicker("nvda")).toBe("ai_infra");
  });

  it("liefert null fuer Titel ohne Thema", () => {
    for (const t of ["NESN.SW", "JNJ", "RO.SW", "MO", null, undefined, ""]) {
      expect(themeOfTicker(t as string)).toBeNull();
    }
  });

  it("ordnet jeden Eintrag einem bekannten Label zu", () => {
    for (const key of Object.values(THEME_BY_TICKER)) {
      expect(THEME_LABELS[key]).toBeTruthy();
    }
  });
});

describe("Themen-Konzentration", () => {
  it("macht sichtbar, was die Sektor-Regel nicht sieht", () => {
    // Nachgebildet aus dem Swissquote-Bestand: fuenf Titel, mehrere GICS-
    // Sektoren, eine gemeinsame Nachfragequelle.
    const depot = [
      { ticker: "NVDA", weight: "12" },
      { ticker: "AVGO", weight: "6" },
      { ticker: "MRVL", weight: "4" },
      { ticker: "ARM", weight: "3" },
      { ticker: "IREN", weight: "5" },
      { ticker: "NESN.SW", weight: "40" },
      { ticker: "JNJ", weight: "30" },
    ];
    const anteile = themenAnteil(depot);
    expect(anteile["KI-Infrastruktur"]).toBeCloseTo(30, 1);
    expect(anteile["KI-Infrastruktur"]).toBeGreaterThan(25); // Default-Obergrenze
  });

  it("zaehlt Themen getrennt", () => {
    const anteile = themenAnteil([
      { ticker: "NVDA", weight: "20" },
      { ticker: "MSTR", weight: "30" },
      { ticker: "JNJ", weight: "50" },
    ]);
    expect(anteile["KI-Infrastruktur"]).toBeCloseTo(20, 6);
    expect(anteile["Krypto-Proxy"]).toBeCloseTo(30, 6);
  });

  it("meldet nichts bei einem Depot ohne Thementitel", () => {
    expect(themenAnteil([{ ticker: "NESN.SW", weight: "100" }])).toEqual({});
  });
});
