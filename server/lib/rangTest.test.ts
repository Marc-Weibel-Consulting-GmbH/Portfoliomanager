/**
 * Der Rangtest.
 *
 * Die drei Eigenschaften, auf die es ankommt und die man einer Zahl nicht
 * ansieht: Er darf keine überlappenden Fenster als unabhängige Perioden
 * ausgeben, er muss den echten Umschlag zählen (nicht einen angenommenen), und
 * er muss sagen, wenn ein Vorsprung nur vom Startmonat abhängt.
 */

import { describe, it, expect } from "vitest";
import { rangTest, rangKlartext, STANDARD_POSITIONEN } from "./rangTest";
import { rundlaufKostenPct } from "./backtestKennzahlen";
import type { Beobachtung } from "./signalGewichteBacktest";

function lcg(saat: number) {
  let s = saat >>> 0;
  return () => { s = (s * 1_664_525 + 1_013_904_223) >>> 0; return s / 4_294_967_296; };
}

function stichtage(n: number, startJahr = 2016): string[] {
  const aus: string[] = [];
  for (let i = 0; i < n; i++) {
    aus.push(new Date(Date.UTC(startJahr + Math.floor(i / 12), (i % 12) + 1, 0))
      .toISOString().slice(0, 10));
  }
  return aus;
}

/** `effekt` = wie stark der Score die Folgerendite erklärt. */
function welt(opts: { monate?: number; titel?: number; effekt?: number; saat?: number } = {}): Beobachtung[] {
  const { monate = 120, titel = 100, effekt = 0, saat = 3 } = opts;
  const z = lcg(saat);
  const aus: Beobachtung[] = [];
  for (const datum of stichtage(monate)) {
    for (let t = 0; t < titel; t++) {
      const score = z() * 100;
      aus.push({
        ticker: `T${t}`, datum,
        qualitaet: score, bewertung: score, timing: z() * 100,
        regime: "default",
        vorwaertsRendite: (score - 50) * effekt + (z() - 0.5) * 10,
      });
    }
  }
  return aus;
}

const nachBewertung = (b: Beobachtung) => b.bewertung;

describe("rangTest zählt Perioden ehrlich", () => {
  it("gibt bei zwölf Monaten Haltedauer nur zehn unabhängige Perioden je Spur aus", () => {
    // Der Kern: Zehn Jahre Historie und zwölf Monate Haltedauer sind zehn
    // Beobachtungen — nicht 120. Wer jeden Monatsstichtag zählt, hat dieselben
    // zehn Jahre zwölfmal.
    const r = rangTest(welt({ monate: 120 }), nachBewertung, "Bewertung", 25, 12);
    expect(r.periodenJeSpur).toBe(10);
    expect(r.spuren).toHaveLength(12);
  });

  it("hat bei einem Monat Haltedauer genau eine Spur", () => {
    const r = rangTest(welt({ monate: 60 }), nachBewertung, "Bewertung", 25, 1);
    expect(r.spuren).toHaveLength(1);
    expect(r.periodenJeSpur).toBe(60);
  });

  it("lässt Stichtage mit zu dünnem Universum aus", () => {
    // Aus dreissig Titeln die besten 25 zu nehmen ist keine Auswahl.
    const r = rangTest(welt({ monate: 24, titel: 30 }), nachBewertung, "Bewertung", 25, 1);
    expect(r.hinweis).toContain("Zu wenige Stichtage");
  });
});

describe("rangTest misst den Umschlag, statt ihn anzunehmen", () => {
  it("meldet bei stabiler Rangfolge kaum Umschlag", () => {
    // Score hängt nur am Titel, nicht am Stichtag → dieselben 25 bleiben drin.
    const tage = stichtage(60);
    const beob: Beobachtung[] = [];
    for (const datum of tage) {
      for (let t = 0; t < 100; t++) {
        beob.push({
          ticker: `T${t}`, datum, qualitaet: t, bewertung: t, timing: 50,
          regime: "default", vorwaertsRendite: 1,
        });
      }
    }
    const r = rangTest(beob, nachBewertung, "Bewertung", 25, 1);
    expect(r.umschlag).toBe(0);
    expect(r.ueberschussNachKosten).toBeCloseTo(r.ueberschuss, 6);
  });

  it("belastet nur den gewechselten Teil mit Kosten", () => {
    // Zufälliger Score je Stichtag → fast vollständiger Wechsel.
    const r = rangTest(welt({ monate: 60 }), nachBewertung, "Bewertung", 25, 1);
    expect(r.umschlag).toBeGreaterThan(0.5);
    expect(r.ueberschuss - r.ueberschussNachKosten)
      .toBeCloseTo(r.umschlag * rundlaufKostenPct(), 6);
  });

  it("zählt den Aufbau des Depots nicht als Umschichtung", () => {
    // Die erste Auswahl hat keinen Vorgänger — sie als 100 % Umschlag zu
    // buchen würde jede Spur mit einem Rundlauf zu viel belasten.
    const tage = stichtage(24);
    const beob: Beobachtung[] = [];
    for (const datum of tage) {
      for (let t = 0; t < 100; t++) {
        beob.push({
          ticker: `T${t}`, datum, qualitaet: t, bewertung: t, timing: 50,
          regime: "default", vorwaertsRendite: 1,
        });
      }
    }
    expect(rangTest(beob, nachBewertung, "Bewertung", 25, 1).umschlag).toBe(0);
  });
});

describe("rangTest findet einen echten Vorsprung — und nur einen echten", () => {
  it("erkennt einen eingebauten Zusammenhang", () => {
    const r = rangTest(welt({ effekt: 0.10 }), nachBewertung, "Bewertung", 25, 1);
    expect(r.ueberschuss).toBeGreaterThan(2);
    expect(r.anteilVorn).toBeGreaterThan(0.8);
  });

  it("findet ohne Zusammenhang keinen Vorsprung", () => {
    const r = rangTest(welt({ effekt: 0 }), nachBewertung, "Bewertung", 25, 1);
    expect(Math.abs(r.ueberschuss)).toBeLessThan(0.5);
  });

  it("nimmt wirklich die besten und nicht die schlechtesten", () => {
    // Vorzeichenprobe: Bei umgekehrter Ordnung muss der Vorsprung kippen.
    const b = welt({ effekt: 0.10 });
    const richtig = rangTest(b, nachBewertung, "hoch", 25, 1);
    const falsch = rangTest(b, (x) => -(x.bewertung as number), "tief", 25, 1);
    expect(richtig.ueberschuss).toBeGreaterThan(0);
    expect(falsch.ueberschuss).toBeLessThan(0);
  });
});

describe("rangTest zeigt die Abhängigkeit vom Startmonat", () => {
  it("gibt je Startmonat eine eigene Spur aus", () => {
    const r = rangTest(welt({ monate: 120, effekt: 0.05 }), nachBewertung, "Bewertung", 25, 12);
    expect(r.spuren.map((s) => s.versatz)).toEqual([...Array(12).keys()]);
    expect(r.spurStreuung).toBeGreaterThan(0);
  });

  it("nennt einen Vorsprung unbrauchbar, wenn die Startmonate weiter auseinanderliegen", () => {
    // Feste Rangfolge (kein Umschlag, also keine Kosten) und Renditen ohne
    // jeden Bezug dazu. Dann ist der Überschuss reines Rauschen und schwankt
    // je nach Startmonat stärker, als sein Mittelwert beträgt.
    //
    // Erster Anlauf war ein Zufallsscore je Stichtag — dort wechselt fast das
    // ganze Depot, die Umschlagskosten von rund 1.1 Punkten dominieren alles
    // und schwanken gerade NICHT. Der Mittelwert war dann robust negativ, was
    // richtig ist, aber nicht der Fall, den dieser Test prüfen soll.
    const z = lcg(21);
    const beob: Beobachtung[] = [];
    for (const datum of stichtage(120)) {
      for (let t = 0; t < 100; t++) {
        beob.push({
          ticker: `T${t}`, datum,
          qualitaet: t, bewertung: t, timing: 50,
          regime: "default",
          vorwaertsRendite: (z() - 0.5) * 30,
        });
      }
    }
    const r = rangTest(beob, nachBewertung, "Bewertung", 25, 12);
    expect(r.umschlag).toBe(0);
    expect(Math.abs(r.ueberschussNachKosten)).toBeLessThan(r.spurStreuung);
    expect(rangKlartext(r)).toContain("in welchem Monat man begonnen hätte");
  });

  it("rechnet die Streuung auf dem Netto-Wert, nicht auf dem Brutto-Wert", () => {
    // Sonst hielte die Robustheitsprüfung eine Grösse gegen die Streuung einer
    // anderen. Bei hohem Umschlag sind die Kosten der grösste und zugleich der
    // am wenigsten zufällige Teil des Ergebnisses.
    const r = rangTest(welt({ monate: 120, effekt: 0 }), nachBewertung, "Bewertung", 25, 12);
    for (const s of r.spuren) {
      expect(s.ueberschussNachKosten)
        .toBeCloseTo(s.ueberschuss - s.umschlag * rundlaufKostenPct(), 6);
    }
  });
});

describe("rangTest: Ränder", () => {
  it("verträgt eine leere Eingabe", () => {
    const r = rangTest([], nachBewertung, "Bewertung");
    expect(r.hinweis).not.toBeNull();
    expect(rangKlartext(r)).toBe(r.hinweis);
  });

  it("übergeht Beobachtungen ohne Score", () => {
    const b = welt({ monate: 24 }).map((x) => ({ ...x, bewertung: null }));
    expect(rangTest(b, nachBewertung, "Bewertung").hinweis).not.toBeNull();
  });

  it("hält die Standardgrösse bei 25 Positionen", () => {
    expect(STANDARD_POSITIONEN).toBe(25);
    const r = rangTest(welt({ monate: 24 }), nachBewertung, "Bewertung");
    expect(r.positionen).toBe(25);
  });

  it("gibt eine Jahresaufteilung aus", () => {
    const r = rangTest(welt({ monate: 60 }), nachBewertung, "Bewertung", 25, 1);
    expect(r.jahre.map((j) => j.jahr)).toEqual([2016, 2017, 2018, 2019, 2020]);
    for (const j of r.jahre) {
      expect(j.ueberschuss).toBeCloseTo(j.auswahl - j.universum, 6);
    }
  });
});
