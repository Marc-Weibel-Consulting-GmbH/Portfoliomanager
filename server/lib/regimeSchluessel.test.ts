/**
 * Der Alias ist der ganze Zweck dieser Datei — deshalb prüfen die Tests ihn
 * nicht nur hier, sondern an allen drei Gewichtstabellen, die ihn brauchen.
 * Ein Test allein am Normalisierer hätte den Fehler nicht gefunden: Er lag
 * jedes Mal an der Aufrufstelle.
 */

import { describe, it, expect } from "vitest";
import { normalisiereRegime, gewichtsZeile } from "./regimeSchluessel";
import { gewichteFuerRegime, DEFAULT_SIGNAL_GEWICHTE } from "./dreiScoreSignal";
import { schattenGewichte, SCHATTEN_GEWICHTE } from "./signalSchatten";
import { resolveWeights, DEFAULT_REGIME_BLEND } from "./signalBlend";
import { classifyRegime, computeRegimeFeatures } from "./signals/regimeEngine";

describe("normalisiereRegime", () => {
  it("vereinheitlicht Schreibweisen", () => {
    expect(normalisiereRegime("SIDEWAYS-HIGH VOL")).toBe("sideways_high_vol");
    expect(normalisiereRegime("  Bull_Trend ")).toBe("bull_trend");
  });

  it("verträgt null und undefined", () => {
    expect(normalisiereRegime(null)).toBe("");
    expect(normalisiereRegime(undefined)).toBe("");
  });
});

describe("gewichtsZeile", () => {
  const tabelle = { bull: 1, bear: 2, default: 9, bull_trend: 42 };

  it("bildet die Engine-Namen auf die Tabellen-Namen ab", () => {
    expect(gewichtsZeile("bear_trend", { bear: 2, default: 9 })).toBe(2);
  });

  it("lässt den exakten Treffer vor dem Alias gelten", () => {
    // Eine Tabelle, die `bull_trend` ausdrücklich führt, soll nicht gegen
    // ihren Willen auf `bull` umgebogen werden.
    expect(gewichtsZeile("bull_trend", tabelle)).toBe(42);
  });

  it("fällt bei wirklich unbekanntem Regime auf default", () => {
    expect(gewichtsZeile("gibtsnicht", tabelle)).toBe(9);
    expect(gewichtsZeile(null, tabelle)).toBe(9);
  });
});

describe("die Regime-Namen der Engine treffen alle drei Gewichtstabellen", () => {
  /**
   * Die Engine-Namen sind die Wahrheit — sie stehen in `classifyRegime`.
   * Wenn eine Tabelle sie nicht auflösen kann, ist sie für dieses Regime
   * wirkungslos, ohne dass es irgendwo auffiele.
   *
   * Geprüft wird auf REFERENZGLEICHHEIT, nicht auf Werte: `sideways_low_vol`
   * trägt in allen drei Tabellen zufällig dieselben Zahlen wie `default`. Ein
   * Wertvergleich könnte den stillen Rückfall dort also gar nicht erkennen —
   * genau die Nachlässigkeit, die den Fehler zweimal überleben liess.
   */
  const ENGINE_ZU_ZEILE: Record<string, string> = {
    bull_trend: "bull",
    bear_trend: "bear",
    crisis: "crisis",
    recovery: "recovery",
    sideways_high_vol: "sideways_high_vol",
    sideways_low_vol: "sideways_low_vol",
  };
  const ENGINE_REGIMES = Object.keys(ENGINE_ZU_ZEILE);

  it("trifft für jedes Engine-Regime die benannte Zeile der Signal-Gewichte", () => {
    for (const [engine, zeile] of Object.entries(ENGINE_ZU_ZEILE)) {
      expect(gewichteFuerRegime(engine), engine).toBe(DEFAULT_SIGNAL_GEWICHTE[zeile]);
    }
  });

  it("trifft für jedes Engine-Regime die benannte Zeile der Schatten-Gewichte", () => {
    for (const [engine, zeile] of Object.entries(ENGINE_ZU_ZEILE)) {
      expect(schattenGewichte(engine), engine).toBe(SCHATTEN_GEWICHTE[zeile]);
    }
  });

  it("trifft für jedes Engine-Regime die benannte Zeile der Blend-Mischung", () => {
    for (const [engine, zeile] of Object.entries(ENGINE_ZU_ZEILE)) {
      expect(resolveWeights(engine, DEFAULT_REGIME_BLEND), engine)
        .toBe(DEFAULT_REGIME_BLEND[zeile]);
    }
  });

  it("beschreibt genau die Regimes, die die Engine wirklich vergibt", () => {
    // Gegenprobe gegen eine veraltete Liste: Was `classifyRegime` für eine
    // steigende Reihe ausgibt, muss oben drinstehen.
    const steigend = Array.from({ length: 400 }, (_, i) => 100 + i * 0.5);
    const { regime } = classifyRegime(computeRegimeFeatures(steigend));
    expect(ENGINE_REGIMES).toContain(regime);
  });
});

describe("die Trendregimes bekommen wirklich ihre eigene Gewichtung", () => {
  it("gewichtet Timing im Bullentrend höher als Qualität", () => {
    // Der inhaltliche Punkt, der ohne Alias verloren ging: Im Aufschwung soll
    // der Zeitpunkt zählen. Mit `default` (0.35/0.30/0.35) tat er das nicht.
    const w = gewichteFuerRegime("bull_trend");
    expect(w.timing).toBeGreaterThan(w.qualitaet);
    expect(w).toEqual(DEFAULT_SIGNAL_GEWICHTE.bull);
  });

  it("gewichtet Qualität im Bärentrend höher als Timing", () => {
    const w = gewichteFuerRegime("bear_trend");
    expect(w.qualitaet).toBeGreaterThan(w.timing);
    expect(w).toEqual(DEFAULT_SIGNAL_GEWICHTE.bear);
  });
});
