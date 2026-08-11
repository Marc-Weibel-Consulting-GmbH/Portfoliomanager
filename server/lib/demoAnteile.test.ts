/**
 * Die eine Stückzahl-Antwort für alle Bewertungspfade.
 *
 * Der Fall, der den Fehler sichtbar machte: Depotkarte 158'520, Depotseite
 * 149'262 — dieselben Positionen, zwei Ersatzformeln. Die Tests halten fest,
 * dass die Teilung durch den KAUFPREIS gilt und die Teilung durch den heutigen
 * Preis nur der gekennzeichnete Notnagel ist.
 */

import { describe, it, expect } from "vitest";
import { anteileFuerPosition } from "./demoAnteile";

const BASIS = {
  gespeicherteStueck: 0,
  investmentAmount: 150_000,
  gewichtPct: 10,
  kaufpreisCHF: 100,
  heutigerPreisCHF: 110,
};

describe("anteileFuerPosition", () => {
  it("nimmt gespeicherte Stückzahlen vor jeder Rechnung", () => {
    const r = anteileFuerPosition({ ...BASIS, gespeicherteStueck: 42 });
    expect(r).toEqual({ stueck: 42, herkunft: "gespeichert" });
  });

  it("teilt die Allokation durch den KAUFPREIS, nicht den heutigen Preis", () => {
    // 15'000 CHF Allokation, Kaufpreis 100 → 150 Stück. Zum heutigen Preis von
    // 110 ist die Position 16'500 wert: +10 % — die Marktbewegung seit Kauf.
    const r = anteileFuerPosition(BASIS);
    expect(r.herkunft).toBe("kaufpreis");
    expect(r.stueck).toBeCloseTo(150, 9);
    expect(r.stueck * BASIS.heutigerPreisCHF).toBeCloseTo(16_500, 6);
  });

  it("fällt ohne Kaufpreis auf den heutigen Preis zurück — gekennzeichnet", () => {
    // Der Notnagel: Wert ≡ Allokation, keine Marktbewegung. Genau deshalb
    // trägt er eine eigene Herkunft — die Aufrufer können ihn ausweisen.
    const r = anteileFuerPosition({ ...BASIS, kaufpreisCHF: null });
    expect(r.herkunft).toBe("heutiger_preis");
    expect(r.stueck * BASIS.heutigerPreisCHF).toBeCloseTo(15_000, 6);
  });

  it("liefert 0 mit Herkunft «keine», wenn nichts berechenbar ist", () => {
    expect(anteileFuerPosition({ ...BASIS, kaufpreisCHF: null, heutigerPreisCHF: 0 }))
      .toEqual({ stueck: 0, herkunft: "keine" });
    expect(anteileFuerPosition({ ...BASIS, investmentAmount: 0 }))
      .toEqual({ stueck: 0, herkunft: "keine" });
    expect(anteileFuerPosition({ ...BASIS, gewichtPct: 0 }))
      .toEqual({ stueck: 0, herkunft: "keine" });
  });

  it("verträgt NaN als gespeicherte Stückzahl", () => {
    const r = anteileFuerPosition({ ...BASIS, gespeicherteStueck: NaN });
    expect(r.herkunft).toBe("kaufpreis");
  });

  it("verwirft einen Kaufpreis von 0 oder darunter", () => {
    const r = anteileFuerPosition({ ...BASIS, kaufpreisCHF: 0 });
    expect(r.herkunft).toBe("heutiger_preis");
  });
});
