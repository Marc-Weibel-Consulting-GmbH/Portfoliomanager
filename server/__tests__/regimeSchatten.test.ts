/**
 * Schattenrechnung Marktregime vs. Titel-Kursphase.
 *
 * Die Zahlen im ersten Block stammen aus dem Live-Endpunkt für NESN.SW am
 * 1.8.2026 (combinedScore 60.4, Grade B, BUY bei momentum −0.02 / quality 0.36
 * / lppl 0). Sie sind hier Anker: Wenn die Live-Variante von diesem Wert
 * abweicht, hat sich der echte Score-Pfad geändert und nicht nur der Schatten.
 */
import { describe, it, expect } from "vitest";
import { mischungsSchluessel, marktRegimeLabel } from "../lib/marktRegimeBlend";
import {
  rechneSchatten,
  richtungAusSignal,
  richtungKorrekt,
  bilanziere,
} from "../lib/regimeSchatten";

describe("mischungsSchluessel", () => {
  it.each([
    ["Risk-Off", undefined, "crisis"],
    ["Defensive", undefined, "bear"],
    ["Risk-On", undefined, "bull"],
    ["Neutral", "bullish", "sideways_low_vol"],
    ["Neutral", "bearish", "sideways_high_vol"],
    ["Neutral", "neutral", "sideways_high_vol"],
  ])("%s (Vola %s) -> %s", (regime, vola, erwartet) => {
    expect(mischungsSchluessel({ overallRegime: regime, volatilitaet: vola })).toBe(erwartet);
  });

  it("waehlt bei fehlender Volatilitaetsangabe die vorsichtigere Lesart", () => {
    // Ohne Angabe NICHT die fuer den Titel schmeichelhaftere Variante.
    expect(mischungsSchluessel({ overallRegime: "Neutral" })).toBe("sideways_high_vol");
  });

  it("faellt bei unbekanntem Zustand auf die neutrale Annahme zurueck", () => {
    expect(mischungsSchluessel({ overallRegime: "" })).toBe("default");
    expect(mischungsSchluessel({ overallRegime: "Wolkig" })).toBe("default");
  });

  it("ist unempfindlich gegen Schreibweise", () => {
    expect(mischungsSchluessel({ overallRegime: "  risk-on " })).toBe("bull");
  });

  it("vergibt niemals recovery — ein Uebergang ist aus einer Momentaufnahme nicht ablesbar", () => {
    const alle = ["Risk-On", "Neutral", "Defensive", "Risk-Off", "irgendwas"].map((r) =>
      mischungsSchluessel({ overallRegime: r }),
    );
    expect(alle).not.toContain("recovery");
  });

  it("benennt die Zustaende deutsch", () => {
    expect(marktRegimeLabel("Risk-On")).toBe("Risikofreudig");
    expect(marktRegimeLabel("unbekannt")).toBe("Unbekannt");
  });
});

describe("rechneSchatten", () => {
  const nestle = {
    momentumScore: -0.02,
    qualityScore: 0.36,
    lpplPenalty: 0,
    titelRegime: "sideways_high_vol",
  };

  it("reproduziert den live gemessenen Score von NESN.SW (1.8.2026)", () => {
    const r = rechneSchatten({ ...nestle, markt: { overallRegime: "Risk-On" } });
    // 0.60 * 0.68 + 0.40 * 0.49 = 0.604 -> 60.4
    expect(r.liveScore).toBe(60.4);
    expect(r.liveSignal).toBe("BUY");
  });

  it("rechnet den Schatten mit dem Marktregime — an jenem Tag Risk-On", () => {
    const r = rechneSchatten({ ...nestle, markt: { overallRegime: "Risk-On" } });
    // bull = 35/65: 0.35 * 0.68 + 0.65 * 0.49 = 0.5565 -> 55.7 (gerundet 55.6/55.7)
    expect(r.schattenRegime).toBe("bull");
    expect(r.schattenScore).toBeLessThan(r.liveScore);
    expect(r.differenz).toBeLessThan(0);
  });

  it("tauscht ausschliesslich den Mischungsschluessel", () => {
    // Gleiches Regime auf beiden Seiten -> identischer Score, Differenz 0.
    const r = rechneSchatten({
      ...nestle,
      titelRegime: "bull",
      markt: { overallRegime: "Risk-On" },
    });
    expect(r.schattenScore).toBe(r.liveScore);
    expect(r.differenz).toBe(0);
  });

  it("gewichtet in der Krise die Qualitaet staerker als im Bullenmarkt", () => {
    const krise = rechneSchatten({ ...nestle, markt: { overallRegime: "Risk-Off" } });
    const bulle = rechneSchatten({ ...nestle, markt: { overallRegime: "Risk-On" } });
    // Nestlé ist qualitativ stark (+0.36) und momentum-schwach (−0.02):
    // In der Krise muss der Schatten hoeher liegen als im Bullenmarkt.
    expect(krise.schattenScore).toBeGreaterThan(bulle.schattenScore);
  });
});

describe("richtungKorrekt", () => {
  it("wertet Kaufsignale gegen positive Rendite", () => {
    expect(richtungKorrekt("BUY", 3.1)).toBe(true);
    expect(richtungKorrekt("STRONG BUY", -1.4)).toBe(false);
  });

  it("wertet Verkaufssignale gegen negative Rendite", () => {
    expect(richtungKorrekt("SELL", -2.2)).toBe(true);
    expect(richtungKorrekt("SELL", 0.8)).toBe(false);
  });

  it("bewertet HOLD gar nicht — es behauptet keine Richtung", () => {
    expect(richtungKorrekt("HOLD", 5)).toBeNull();
    expect(richtungAusSignal("HOLD")).toBeNull();
  });
});

describe("bilanziere", () => {
  it("liefert ohne bewertbare Zeilen keine erfundenen Nullen", () => {
    const b = bilanziere([]);
    expect(b.bewertet).toBe(0);
    expect(b.liveTrefferPct).toBeNull();
    expect(b.schattenAlphaPct).toBeNull();
  });

  it("zaehlt nur Paare, bei denen BEIDE eine Richtung behaupten", () => {
    const b = bilanziere([
      { liveSignal: "BUY", schattenSignal: "HOLD", actualReturnPct: 2, benchmarkReturnPct: 0 },
      { liveSignal: "BUY", schattenSignal: "BUY", actualReturnPct: 2, benchmarkReturnPct: 0 },
    ]);
    // Die erste Zeile ist kein Paar — sonst verglichen wir ungleiche Stichproben.
    expect(b.bewertet).toBe(1);
  });

  it("ueberspringt Zeilen ohne Rendite statt sie als Treffer zu werten", () => {
    const b = bilanziere([
      { liveSignal: "BUY", schattenSignal: "BUY", actualReturnPct: null, benchmarkReturnPct: 0 },
    ]);
    expect(b.bewertet).toBe(0);
  });

  it("rechnet Trefferquoten getrennt fuer beide Varianten", () => {
    const b = bilanziere([
      { liveSignal: "BUY", schattenSignal: "SELL", actualReturnPct: 4, benchmarkReturnPct: 1 },
      { liveSignal: "BUY", schattenSignal: "BUY", actualReturnPct: 3, benchmarkReturnPct: 1 },
    ]);
    expect(b.bewertet).toBe(2);
    expect(b.liveTrefferPct).toBe(100);   // beide Male BUY bei positivem Return
    expect(b.schattenTrefferPct).toBe(50); // SELL bei +4 % ist falsch
    expect(b.uneinig).toBe(1);
  });

  it("dreht das Alpha bei Verkaufssignalen um", () => {
    // Titel −5 %, Markt −1 % -> Alpha −4. Fuer ein SELL ist das ein Erfolg.
    const b = bilanziere([
      { liveSignal: "SELL", schattenSignal: "BUY", actualReturnPct: -5, benchmarkReturnPct: -1 },
    ]);
    expect(b.liveAlphaPct).toBe(4);
    expect(b.schattenAlphaPct).toBe(-4);
  });
});
