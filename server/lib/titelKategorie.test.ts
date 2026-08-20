import { describe, it, expect } from "vitest";
import { titelKategorie } from "./titelKategorie";

describe("titelKategorie", () => {
  it("eine belastbare Ausschüttung schlägt den Sektor", () => {
    // Burkhalter: Industrials, aber 3.9 % Rendite — für die Einkommens-Sicht
    // eine Dividendenaktie, kein Value-Titel.
    expect(titelKategorie("Industrials", 3.9)).toBe("Dividendenaktien");
    expect(titelKategorie("Technology", 4.2)).toBe("Dividendenaktien");
  });

  it("ordnet Sektoren ohne nennenswerte Ausschüttung zu", () => {
    expect(titelKategorie("Communication Services", 0)).toBe("Wachstumsaktien"); // Netflix
    expect(titelKategorie("Technology", null)).toBe("Wachstumsaktien");
    expect(titelKategorie("Financial Services", 1.0)).toBe("Value");
    expect(titelKategorie("Real Estate", null)).toBe("Value");
    expect(titelKategorie("Healthcare", 1.2)).toBe("Dividendenaktien");
    expect(titelKategorie("Industrials", 0.5)).toBe("Value");
    expect(titelKategorie("Energy", null)).toBe("Value");
  });

  it("ohne Sektor und ohne Rendite bleibt der Wachstums-Standard", () => {
    expect(titelKategorie(null, null)).toBe("Wachstumsaktien");
    expect(titelKategorie("", 1.0)).toBe("Wachstumsaktien");
  });
});
