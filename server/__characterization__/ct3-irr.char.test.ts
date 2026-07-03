/**
 * CT-3 — Charakterisierungstests für calculateIRR (Newton-Raphson + Bisektion-Fallback)
 * (server/lib/performanceEngine.ts)
 *
 * Pinnt das IST-Verhalten inkl. Day-Count/Annualisierung (R-16) und dem
 * stillschweigenden Verhalten bei Nichtkonvergenz (R-25-Klasse).
 * Erwartungswerte wurden durch AUSFÜHREN des aktuellen Codes ermittelt.
 *
 * Hinweis zur Bisektion: Ein Input, bei dem Newton-Raphson scheitert, die
 * Bisektion aber eine Wurzel findet, konnte mit realistischen Fixtures nicht
 * konstruiert werden — das gedämpfte/geklemmte Newton-Verfahren konvergiert
 * überall dort, wo die Bisektion überhaupt einklammern könnte. Gepinnt wird
 * deshalb der tatsächlich erreichbare Fallback-Ausgang: Bisektion wird
 * versucht, kann nicht einklammern (return null) und der geklemmte
 * Newton-Wert wird mit converged=false zurückgegeben.
 */

import { describe, it, expect } from "vitest";
import { calculateIRR, type CashFlow } from "../lib/performanceEngine";

const YEAR_START = "2025-01-01";
const YEAR_END_364 = "2025-12-31"; // 364 Tage
const YEAR_END_365 = "2026-01-01"; // 365 Tage
const MID_YEAR = "2025-07-01";

const deposit = (date: string, amount: number): CashFlow => ({ date, amount, type: "deposit" });
const withdrawal = (date: string, amount: number): CashFlow => ({ date, amount, type: "withdrawal" });

describe("CT-3 calculateIRR — Basispfade", () => {
  it("ohne Cashflows: Simple-Return-Pfad, 364 Tage gelten als < 1 Jahr (R-16)", () => {
    const r = calculateIRR(10000, 11000, [], YEAR_START, YEAR_END_364);
    expect(r.periodicIRR).toBeCloseTo(0.10000000000000009, 10);
    // ISTZUSTAND — bekannt falsch, siehe OPTIMIZATION_PLAN.md R-16:
    // 01.01.–31.12. (364 Tage) wird NICHT annualisiert (Grenze ist >= 365),
    // annualizedIRR == periodicIRR — inkonsistent zur 365-Tage-Konvention.
    expect(r.annualizedIRR).toBeCloseTo(0.10000000000000009, 10);
    expect(r.converged).toBe(true);
    expect(r.iterations).toBe(0);
  });

  it("ohne Cashflows über exakt 365 Tage: annualisiert == periodisch", () => {
    const r = calculateIRR(10000, 11000, [], YEAR_START, YEAR_END_365);
    expect(r.annualizedIRR).toBeCloseTo(0.10000000000000009, 10);
    expect(r.periodicIRR).toBeCloseTo(0.10000000000000009, 10);
    expect(r.converged).toBe(true);
  });

  it("Szenario 1/2-Klasse: Deposit zur Jahresmitte (Newton-Raphson konvergiert)", () => {
    const r = calculateIRR(10000, 21000, [deposit(MID_YEAR, 10000)], YEAR_START, YEAR_END_364);
    expect(r.annualizedIRR).toBeCloseTo(0.06709502378951321, 10);
    expect(r.periodicIRR).toBeCloseTo(0.0669051853959981, 10);
    expect(r.converged).toBe(true);
    expect(r.iterations).toBe(4);
  });

  it("Szenario 2: korrekt negative Entnahme vs. sign-geflippte Entnahme (R-01-Kontrast)", () => {
    // Soll-Vorzeichen (negativ = Outflow), wie es die Aufrufer nach Map-Schritt liefern:
    const correct = calculateIRR(20000, 10500, [withdrawal(MID_YEAR, -10000)], YEAR_START, YEAR_END_364);
    expect(correct.annualizedIRR).toBeCloseTo(0.033396413877604336, 10);
    expect(correct.converged).toBe(true);

    // ISTZUSTAND — bekannt falsch, siehe OPTIMIZATION_PLAN.md R-01:
    // Kommt die Entnahme (wie aus extractPortfolioCashFlows bei negativ
    // gespeicherten Beträgen, vgl. CT-2) mit POSITIVEM Vorzeichen an, kippt
    // die IRR von +3.3 % auf −73.4 %.
    const flipped = calculateIRR(20000, 10500, [withdrawal(MID_YEAR, 10000)], YEAR_START, YEAR_END_364);
    expect(flipped.annualizedIRR).toBeCloseTo(-0.7335796341084446, 10);
    expect(flipped.converged).toBe(true);
    expect(flipped.iterations).toBe(6);
  });

  it("MVB = 0 mit Deposit am Starttag", () => {
    const r = calculateIRR(0, 12000, [deposit(YEAR_START, 10000)], YEAR_START, YEAR_END_364);
    expect(r.annualizedIRR).toBeCloseTo(0.20060121063298558, 10);
    expect(r.periodicIRR).toBeCloseTo(0.19999999999999996, 10);
    expect(r.converged).toBe(true);
    expect(r.iterations).toBe(4);
  });
});

describe("CT-3 calculateIRR — Randfälle & Guards (Szenario 9)", () => {
  it("Start == Ende (0 Tage) → Nullresultat mit converged=false", () => {
    expect(calculateIRR(10000, 11000, [], "2025-03-03", "2025-03-03")).toEqual({
      annualizedIRR: 0,
      periodicIRR: 0,
      converged: false,
      iterations: 0,
    });
  });

  it("MVB = 0 und keine Flows → 0, converged=true", () => {
    expect(calculateIRR(0, 0, [], YEAR_START, YEAR_END_364)).toEqual({
      annualizedIRR: 0,
      periodicIRR: 0,
      converged: true,
      iterations: 0,
    });
  });

  it("extremer Gewinn ohne Flows: Simple-Return liefert 99'900 % unannualisiert (R-16)", () => {
    const r = calculateIRR(100, 100000, [], YEAR_START, YEAR_END_364);
    // ISTZUSTAND — bekannt falsch, siehe OPTIMIZATION_PLAN.md R-16:
    // 364 Tage → keine Annualisierung; der Simple-Return-Pfad umgeht zudem
    // den [-0.99, 10]-Clamp des Newton-Pfads vollständig.
    expect(r.annualizedIRR).toBe(999);
    expect(r.periodicIRR).toBe(999);
    expect(r.converged).toBe(true);
  });
});

describe("CT-3 calculateIRR — Nichtkonvergenz & Bisektion-Fallback", () => {
  it("IRR jenseits des Clamps: Newton klemmt bei 10, Bisektion kann nicht einklammern", () => {
    const r = calculateIRR(100, 100000, [deposit("2025-06-01", 50)], YEAR_START, YEAR_END_364);
    // ISTZUSTAND — bekannt falsch, siehe OPTIMIZATION_PLAN.md R-25 (Klasse):
    // Wahre IRR ≈ 98'000 % liegt ausserhalb [−0.99, 10]; Newton läuft in den
    // Clamp, Bisektion (lo=−0.999, hi=10) findet keinen Vorzeichenwechsel →
    // stillschweigend annualizedIRR = 10 (= +1'000 %) mit converged=false —
    // kein Fehler, kein null.
    expect(r.annualizedIRR).toBe(10);
    expect(r.periodicIRR).toBeCloseTo(9.9279715203586, 10);
    expect(r.converged).toBe(false);
    expect(r.iterations).toBe(100);
  });

  it("Totalverlust inkl. Nachschuss: klemmt bei −99 % mit converged=false", () => {
    const r = calculateIRR(10000, 0, [deposit(MID_YEAR, 5000)], YEAR_START, YEAR_END_364);
    // ISTZUSTAND — bekannt falsch, siehe OPTIMIZATION_PLAN.md R-25 (Klasse):
    // Wahre IRR ist −100 % (ausserhalb des Definitionsbereichs) → f(r) hat
    // keine Wurzel in (−1, 10]; Newton/Bisektion scheitern und es wird
    // stillschweigend −0.99 zurückgegeben.
    expect(r.annualizedIRR).toBe(-0.99);
    expect(r.periodicIRR).toBeCloseTo(-0.9898730316644156, 10);
    expect(r.converged).toBe(false);
    expect(r.iterations).toBe(100);
  });
});
