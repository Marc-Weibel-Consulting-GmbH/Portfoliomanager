import { describe, it, expect } from "vitest";
import { stabilitaetAusJahresEps, RATEN_KAPPUNG } from "./gewinnStabilitaet";

/**
 * Befund 1 der Scoring-Prüfung (BCHN.SW): Die Anzeige zeigte Gewinnstabilität
 * 0.00 trotz vier Wachstumsjahren in Folge. Zwei Datenfallen konnten die
 * Streuung künstlich aufblasen: (a) Nach dem Herausfiltern von
 * Null-Platzhalterjahren wurden NICHT benachbarte Jahre als benachbart
 * gepaart — eine «Jahresrate» über eine mehrjährige Lücke. (b) Ein einzelnes
 * Artefaktjahr (Split-Inkonsistenz, ±300 %) dominierte die nicht-robuste
 * Standardabweichung. Null-Semantik bleibt: fehlende Reihe → null, nie 0.
 */

const jahre = (eintraege: Array<[number, number | null]>) =>
  eintraege.map(([jahr, eps]) => ({ jahr, eps }));

describe("stabilitaetAusJahresEps", () => {
  it("vier Wachstumsjahre ergeben niemals 0 — zu kurze Reihe heisst null, nicht 0", () => {
    // Der BCHN-Fall aus der Prüfung: 20.64 → 24.98 → 31.20 → 32.60.
    const r = stabilitaetAusJahresEps(jahre([
      [2023, 20.64], [2024, 24.98], [2025, 31.20], [2026, 32.60],
    ]));
    // Drei Raten sind zu wenig für eine Streuungsaussage → null.
    expect(r.score).toBeNull();
    expect(r.score).not.toBe(0);
  });

  it("eine gleichmässig wachsende Zehnjahresreihe bekommt einen hohen Score", () => {
    const r = stabilitaetAusJahresEps(jahre([
      [2017, 10], [2018, 10.8], [2019, 11.7], [2020, 12.6], [2021, 13.6],
      [2022, 14.7], [2023, 15.9], [2024, 17.2], [2025, 18.5], [2026, 20.0],
    ]));
    expect(r.score).not.toBeNull();
    expect(r.score!).toBeGreaterThan(85);
    // Der Beleg steht dabei — die Zahl ist nachprüfbar.
    expect(r.hinweis).toMatch(/Streuung/);
  });

  it("ein Zykliker mit Abschwung bekommt einen mittleren Score, keine 0", () => {
    // BCHN-artige Dekade inkl. Abschwung 2018–2020 (Raten zwischen −33 % und +37 %).
    const r = stabilitaetAusJahresEps(jahre([
      [2017, 23.5], [2018, 20.5], [2019, 13.7], [2020, 10.7], [2021, 14.7],
      [2022, 17.3], [2023, 20.6], [2024, 25.0], [2025, 31.2], [2026, 32.6],
    ]));
    expect(r.score).not.toBeNull();
    expect(r.score!).toBeGreaterThan(30);
    expect(r.score!).toBeLessThan(80);
  });

  it("bildet keine Rate über eine Jahreslücke", () => {
    // Ohne Lückenschutz ergäbe 2019→2023 eine einzelne «Jahresrate» von +200 %.
    const r = stabilitaetAusJahresEps(jahre([
      [2016, 10], [2017, 11], [2018, 11.5], [2019, 12],
      [2023, 36], [2024, 38], [2025, 40], [2026, 42],
    ]));
    // 3 Raten vor der Lücke + 3 danach = 6, aber KEINE über die Lücke.
    expect(r.raten).toHaveLength(6);
    // Alle Raten klein — der Score bleibt hoch, statt von der Lückenrate ruiniert zu werden.
    expect(r.score!).toBeGreaterThan(80);
  });

  it("ein einzelnes Artefaktjahr wird gekappt und nullt den Faktor nicht", () => {
    // Split-Artefakt: ein Jahr ×5 (Rate +400 %), danach wieder normal.
    const r = stabilitaetAusJahresEps(jahre([
      [2018, 10], [2019, 11], [2020, 55], [2021, 60], [2022, 66],
      [2023, 72], [2024, 79], [2025, 86], [2026, 94],
    ]));
    expect(Math.max(...r.raten)).toBeLessThanOrEqual(RATEN_KAPPUNG);
    expect(r.score).not.toBe(0);
  });

  it("fehlende oder wertlose Reihen ergeben null", () => {
    expect(stabilitaetAusJahresEps([]).score).toBeNull();
    expect(stabilitaetAusJahresEps(jahre([[2024, null], [2025, 0], [2026, Number.NaN]])).score).toBeNull();
  });

  it("negative EPS kippen die Rechnung nicht (Division durch |Vorjahr|)", () => {
    const r = stabilitaetAusJahresEps(jahre([
      [2019, -2], [2020, -1], [2021, 1], [2022, 2], [2023, 3], [2024, 4], [2025, 5], [2026, 6],
    ]));
    expect(r.raten.every((x) => Number.isFinite(x))).toBe(true);
    expect(r.score).not.toBeNull();
  });

  // FASSUNG 5: Kappung ±50 %. Beleg aus Lauf #150001: 167 von 296 berechneten
  // Stabilitätswerten standen auf exakt 0 — ein Faktor, der die Hälfte des
  // Universums identisch bestraft, unterscheidet nicht mehr zwischen «etwas
  // zyklisch» und «chaotisch» und trägt praktisch keine Information.
  it("FASSUNG 5: ein Verdopplungsjahr in einer sonst ruhigen Reihe drückt nicht mehr Richtung 0", () => {
    // Sondereffekt-Jahr (Übernahme, Einmalgewinn): EPS ×2, davor und danach ruhig.
    const r = stabilitaetAusJahresEps(jahre([
      [2019, 10], [2020, 10.5], [2021, 11], [2022, 23], [2023, 24],
      [2024, 25], [2025, 26.5], [2026, 28],
    ]));
    // Mit ±100-%-Kappung blieb die Rate des Sonderjahres bei +100 % und zog
    // die Streuung auf ~36 pp (Score ~31); mit ±50 % bleibt die Reihe als
    // das erkennbar, was sie ist: ruhig mit einem Ereignis.
    expect(r.score!).toBeGreaterThanOrEqual(60);
  });

  it("FASSUNG 5: eine chaotische Wechselreihe bleibt bei 0", () => {
    // Jedes Jahr Verdoppelung/Halbierung im Wechsel — das ist echte
    // Sprunghaftigkeit, kein Einmaleffekt, und muss weiterhin 0 ergeben.
    const r = stabilitaetAusJahresEps(jahre([
      [2020, 1], [2021, 2.2], [2022, 0.9], [2023, 2.1],
      [2024, 0.8], [2025, 2.0], [2026, 0.7],
    ]));
    expect(r.score).toBe(0);
  });
});
