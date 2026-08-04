/**
 * Episoden statt Tage.
 *
 * Der Zweck des Moduls ist, eine schmeichelhafte Zahl (Handelstage) durch eine
 * ehrliche zu ersetzen (unabhängige Vorkommen). Die Tests halten genau die
 * Fälle fest, in denen beide Zahlen weit auseinanderliegen — denn dort
 * entscheidet sich, ob eine regimeeigene Gewichtung tragfähig ist.
 */

import { describe, it, expect } from "vitest";
import {
  regimeUmfang,
  umfangKlartext,
  MIN_EPISODEN,
  MIN_FENSTER,
} from "./regimeEpisoden";

/** Baut eine Tagesreihe aus Blöcken: ["bull", 200] ergibt 200 Bullen-Tage. */
function reihe(...bloecke: [string, number][]) {
  const aus: { datum: string; regime: string }[] = [];
  let tag = 0;
  for (const [regime, laenge] of bloecke) {
    for (let i = 0; i < laenge; i++) {
      const d = new Date(Date.UTC(2015, 0, 1 + tag++));
      aus.push({ datum: d.toISOString().slice(0, 10), regime });
    }
  }
  return aus;
}

describe("regimeUmfang", () => {
  it("zählt einen langen Block als EINE Episode, nicht als 200 Beobachtungen", () => {
    // Der Kern des Moduls: 200 Tage Hausse sind ein einziges Vorkommen.
    const [bull] = regimeUmfang(reihe(["bull", 200]));
    expect(bull.tage).toBe(200);
    expect(bull.episoden).toBe(1);
    expect(bull.fenster).toBe(10); // 200 / 20
    expect(bull.tragfaehig).toBe(false); // zu wenige Episoden
  });

  it("zählt getrennte Vorkommen desselben Regimes einzeln", () => {
    const u = regimeUmfang(reihe(["bull", 100], ["bear", 40], ["bull", 100]));
    const bull = u.find((x) => x.regime === "bull")!;
    expect(bull.episoden).toBe(2);
    expect(bull.tage).toBe(200);
    expect(bull.laengsteEpisode).toBe(100);
  });

  it("rechnet Fenster je Episode, nicht über die Summe", () => {
    // Zwei Episoden à 15 Tage ergeben bei 20 Tagen Horizont KEIN volles
    // Fenster — obwohl 30 Tage zusammenkommen. Über die Summe zu rechnen
    // wäre genau die Schönfärberei, die das Modul verhindern soll.
    const u = regimeUmfang(reihe(["crisis", 15], ["bull", 5], ["crisis", 15]));
    const crisis = u.find((x) => x.regime === "crisis")!;
    expect(crisis.tage).toBe(30);
    expect(crisis.episoden).toBe(2);
    expect(crisis.fenster).toBe(0);
  });

  it("erklärt ein Regime erst bei genug Episoden UND genug Fenstern für tragfähig", () => {
    // Vier Episoden à 60 Tage: 4 Episoden, 12 Fenster.
    const u = regimeUmfang(reihe(
      ["bull", 60], ["bear", 5], ["bull", 60], ["bear", 5],
      ["bull", 60], ["bear", 5], ["bull", 60],
    ));
    const bull = u.find((x) => x.regime === "bull")!;
    expect(bull.episoden).toBe(4);
    expect(bull.fenster).toBe(12);
    expect(bull.tragfaehig).toBe(true);

    // Die Gegenprobe: viele kurze Episoden reichen nicht.
    const bear = u.find((x) => x.regime === "bear")!;
    expect(bear.episoden).toBe(3);
    expect(bear.fenster).toBe(0);
    expect(bear.tragfaehig).toBe(false);
  });

  it("hält die Schwellen ein, die es dokumentiert", () => {
    // Genau an der Grenze: 3 Episoden, 9 Fenster.
    const u = regimeUmfang(reihe(
      ["x", 60], ["y", 1], ["x", 60], ["y", 1], ["x", 60],
    ));
    const x = u.find((r) => r.regime === "x")!;
    expect(x.episoden).toBe(MIN_EPISODEN);
    expect(x.fenster).toBeGreaterThanOrEqual(MIN_FENSTER);
    expect(x.tragfaehig).toBe(true);
  });

  it("sortiert nach Häufigkeit, damit das Seltenste auffällt", () => {
    const u = regimeUmfang(reihe(["bull", 100], ["crisis", 10], ["bear", 40]));
    expect(u.map((r) => r.regime)).toEqual(["bull", "bear", "crisis"]);
  });

  it("verträgt eine unsortierte Reihe", () => {
    const geordnet = reihe(["bull", 30], ["bear", 30]);
    const gemischt = [...geordnet].reverse();
    expect(regimeUmfang(gemischt)).toEqual(regimeUmfang(geordnet));
  });

  it("verträgt leere und unvollständige Eingaben", () => {
    expect(regimeUmfang([])).toEqual([]);
    expect(regimeUmfang([{ datum: "", regime: "bull" }] as any)).toEqual([]);
  });
});

describe("umfangKlartext", () => {
  it("nennt bei zu wenigen Episoden die Episodenzahl als Grund", () => {
    const [u] = regimeUmfang(reihe(["crisis", 200]));
    expect(umfangKlartext(u)).toContain("Episode");
    expect(umfangKlartext(u)).toContain("globalen Gewichte");
  });

  it("unterscheidet «zu selten» von «zu kurz»", () => {
    const zuSelten = regimeUmfang(reihe(["a", 200]))[0];
    const zuKurz = regimeUmfang(reihe(
      ["b", 10], ["z", 1], ["b", 10], ["z", 1], ["b", 10],
    )).find((r) => r.regime === "b")!;
    expect(umfangKlartext(zuSelten)).toContain("zu selten");
    expect(umfangKlartext(zuKurz)).toContain("zu kurze Phasen");
  });

  it("bestätigt ein tragfähiges Regime", () => {
    const u = regimeUmfang(reihe(
      ["k", 60], ["z", 1], ["k", 60], ["z", 1], ["k", 60],
    )).find((r) => r.regime === "k")!;
    expect(umfangKlartext(u)).toContain("reicht für");
  });
});
