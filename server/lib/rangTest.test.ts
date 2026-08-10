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

describe("rangTest branchenneutral", () => {
  /**
   * Eine Welt, in der der Score NUR die Branche trifft.
   *
   * «Günstig» ist hier gleichbedeutend mit «Branche A», und Branche A läuft
   * schlecht. Innerhalb einer Branche sagt der Score nichts. Genau die Lage,
   * die in den echten Daten vermutet wird: Der günstige Korb besteht aus
   * Finanz und Energie, der teure aus Technologie.
   */
  const BRANCHE = (t: string) => (Number(t.slice(1)) % 2 === 0 ? "A" : "B");
  const nurBranche = (() => {
    const z = lcg(13);
    const aus: Beobachtung[] = [];
    for (const datum of stichtage(120)) {
      for (let t = 0; t < 100; t++) {
        const inA = t % 2 === 0;
        aus.push({
          ticker: `T${t}`, datum,
          // Branche A durchgehend hoch bewertet, B tief — innerhalb der
          // Branche rein zufällig.
          qualitaet: 50, bewertung: (inA ? 70 : 30) + z() * 10, timing: 50,
          regime: "default",
          vorwaertsRendite: (inA ? -8 : 8) + (z() - 0.5) * 6,
        });
      }
    }
    return aus;
  })();

  it("misst ohne Zentrierung die Branchenwette", () => {
    const r = rangTest(nurBranche, nachBewertung, "Bewertung", 25, 12, BRANCHE, false);
    expect(r.ueberschussNachKosten).toBeLessThan(-5);
    // Der Korb besteht praktisch nur aus der einen Branche — genau das ist die
    // Zahl, die den Streit entscheidet.
    expect(r.sektoren[0].sektor).toBe("A");
    expect(r.sektoren[0].anteil).toBeGreaterThan(0.9);
  });

  it("lässt den Nachteil verschwinden, wenn je Branche zentriert wird", () => {
    const r = rangTest(nurBranche, nachBewertung, "Bewertung", 25, 12, BRANCHE, true);
    expect(r.branchenneutral).toBe(true);
    expect(Math.abs(r.ueberschussNachKosten)).toBeLessThan(2);
    // Und der Korb ist jetzt gemischt statt einseitig.
    expect(r.sektoren[0].anteil).toBeLessThan(0.75);
  });

  it("lässt einen echten Titeleffekt INNERHALB der Branche bestehen", () => {
    // Gegenprobe: Erklärt der Score die Rendite innerhalb der Branche, darf
    // die Zentrierung ihn nicht wegrechnen.
    const z = lcg(17);
    const echt: Beobachtung[] = [];
    for (const datum of stichtage(120)) {
      for (let t = 0; t < 100; t++) {
        const inA = t % 2 === 0;
        const bew = z() * 100;
        echt.push({
          ticker: `T${t}`, datum,
          qualitaet: 50, bewertung: bew, timing: 50, regime: "default",
          // Branchenversatz PLUS echter Zusammenhang zum Score.
          vorwaertsRendite: (inA ? -8 : 8) + (bew - 50) * 0.15 + (z() - 0.5) * 6,
        });
      }
    }
    const r = rangTest(echt, nachBewertung, "Bewertung", 25, 12, BRANCHE, true);
    expect(r.ueberschussNachKosten).toBeGreaterThan(2);
  });

  it("weist die Branchenzusammensetzung auch ohne Zentrierung aus", () => {
    const r = rangTest(welt({ monate: 60 }), nachBewertung, "Bewertung", 25, 1, BRANCHE, false);
    const summe = r.sektoren.reduce((s, x) => s + x.anteil, 0);
    expect(summe).toBeGreaterThan(0.99);
    expect(summe).toBeLessThan(1.01);
  });

  it("kommt ohne Branchenauskunft zurecht", () => {
    const r = rangTest(welt({ monate: 60 }), nachBewertung, "Bewertung", 25, 1);
    expect(r.sektoren).toEqual([]);
    expect(r.branchenneutral).toBe(false);
  });
});

describe("rangTest als Ausschluss statt Auswahl", () => {
  /**
   * Der Bestätigungstest zur Strategie: Gemessen ist, dass die BESTEN zu kaufen
   * verliert. Ob es hilft, die SCHLECHTESTEN zu meiden, ist damit NICHT
   * beantwortet — ein Ausschluss ist keine umgekehrte Auswahl.
   *
   * Die Welt hier trennt beides sauber: Das schlechteste Zehntel stürzt ab,
   * der Rest verhält sich völlig zufällig. Ein Ausschluss muss hier wirken,
   * eine Bestenauswahl darf es nicht.
   */
  const mitSchrott = (() => {
    const z = lcg(29);
    const aus: Beobachtung[] = [];
    for (const datum of stichtage(120)) {
      for (let t = 0; t < 100; t++) {
        const schrott = t < 10;
        aus.push({
          ticker: `T${t}`, datum,
          qualitaet: schrott ? z() * 10 : 20 + z() * 80,
          bewertung: 50, timing: 50, regime: "default",
          vorwaertsRendite: (schrott ? -40 : 0) + (z() - 0.5) * 20,
        });
      }
    }
    return aus;
  })();
  const nachQualitaet = (b: Beobachtung) => b.qualitaet;

  it("gewinnt, wenn das schlechteste Zehntel ausgeschlossen wird", () => {
    const r = rangTest(mitSchrott, nachQualitaet, "ohne schlechtestes Zehntel",
      25, 12, undefined, false, 0.9);
    expect(r.anteilBehalten).toBe(0.9);
    expect(r.ueberschussNachKosten).toBeGreaterThan(2);
    expect(r.ueberschussNachKosten).toBeGreaterThan(r.spurStreuung);
  });

  it("hält dabei fast das ganze Universum, nicht 25 Titel", () => {
    const r = rangTest(mitSchrott, nachQualitaet, "ohne schlechtestes Zehntel",
      25, 12, undefined, false, 0.9);
    expect(r.gehalten).toBe(90);
  });

  it("verursacht kaum Umschlag, weil der Rest gehalten wird", () => {
    // Der wirtschaftliche Kern: Ein Ausschluss tauscht nur den Rand aus. Wer
    // die besten 25 kauft, tauscht bei jeder Umschichtung das halbe Depot.
    const ausschluss = rangTest(mitSchrott, nachQualitaet, "Ausschluss",
      25, 12, undefined, false, 0.9);
    const auswahl = rangTest(mitSchrott, nachQualitaet, "Auswahl", 25, 12);
    expect(ausschluss.umschlag).toBeLessThan(auswahl.umschlag);
  });

  it("misst den Umschlag am tatsächlich Gehaltenen, nicht an `positionen`", () => {
    // Sonst käme bei 90 gehaltenen Titeln und 25 als Nenner eine Wechselquote
    // über 100 % heraus — und die Kosten wären um das Dreifache zu hoch.
    const r = rangTest(mitSchrott, nachQualitaet, "Ausschluss", 25, 12, undefined, false, 0.9);
    expect(r.umschlag).toBeLessThanOrEqual(1);
  });

  it("bringt nichts, wo es nichts auszuschliessen gibt", () => {
    const r = rangTest(welt({ monate: 120, effekt: 0 }), nachBewertung, "Ausschluss",
      25, 12, undefined, false, 0.9);
    expect(Math.abs(r.ueberschussNachKosten)).toBeLessThan(r.spurStreuung + 0.5);
  });

  it("nennt sich im Klartext Ausschluss und nicht Auswahl", () => {
    const r = rangTest(mitSchrott, nachQualitaet, "Ausschluss", 25, 12, undefined, false, 0.9);
    expect(rangKlartext(r)).toContain("Ausschluss");
    expect(rangKlartext(r)).not.toContain("25 besten");
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
