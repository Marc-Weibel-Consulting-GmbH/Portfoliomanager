/**
 * Der RSI hat jetzt drei Aufrufer statt zwei Kopien. Diese Tests halten das
 * Verhalten fest, das aus `signalCacheCron` übernommen wurde — damit eine
 * spätere Vereinfachung nicht unbemerkt Live-Betrieb und Backtest verstellt.
 */

import { describe, it, expect } from "vitest";
import { rsiWilder } from "./rsi";

describe("rsiWilder", () => {
  it("gibt 100 bei ausschliesslich steigenden Kursen", () => {
    const steigend = Array.from({ length: 60 }, (_, i) => 100 + i);
    expect(rsiWilder(steigend, 14)).toBe(100);
  });

  it("liegt bei ausschliesslich fallenden Kursen nahe null", () => {
    const fallend = Array.from({ length: 60 }, (_, i) => 200 - i);
    expect(rsiWilder(fallend, 14)!).toBeCloseTo(0, 6);
  });

  it("liegt bei einer Zickzack-Reihe um die Mitte", () => {
    const zickzack = Array.from({ length: 60 }, (_, i) => 100 + (i % 2 === 0 ? 0 : 1));
    const r = rsiWilder(zickzack, 14)!;
    expect(r).toBeGreaterThan(30);
    expect(r).toBeLessThan(70);
  });

  it("gibt null zurück, wenn die Reihe kürzer als die Periode ist", () => {
    expect(rsiWilder([1, 2, 3], 14)).toBeNull();
    expect(rsiWilder([], 14)).toBeNull();
  });

  it("hängt nicht davon ab, wie viel Historie geladen wurde", () => {
    // Die Glättung setzt bewusst auf den letzten `period * 3` Änderungen auf.
    // Sonst ergäbe derselbe Tag je nach Ladefenster einen anderen Wert.
    const lang = Array.from({ length: 400 }, (_, i) => 100 + Math.sin(i / 7) * 5);
    const kurz = lang.slice(-60);
    expect(rsiWilder(lang, 14)).toBe(rsiWilder(kurz, 14));
  });
});
