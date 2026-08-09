/**
 * Die Diagnose muss zwei Dinge können, die man ihr an einer Zahl nicht ansieht:
 * den Markteffekt herausrechnen und einen unbeständigen Zusammenhang von einem
 * tragfähigen unterscheiden. Beides ist hier festgehalten.
 */

import { describe, it, expect } from "vitest";
import {
  diagnostiziere,
  jeJahr,
  klartext,
  MIN_TITEL_JE_STICHTAG,
  type ScoreFeld,
} from "./scoreDiagnose";
import type { Beobachtung } from "./signalGewichteBacktest";

function lcg(saat: number) {
  let s = saat >>> 0;
  return () => { s = (s * 1_664_525 + 1_013_904_223) >>> 0; return s / 4_294_967_296; };
}

function stichtage(n: number, startJahr = 2016): string[] {
  const aus: string[] = [];
  for (let i = 0; i < n; i++) {
    const jahr = startJahr + Math.floor(i / 12);
    const monat = (i % 12) + 1;
    aus.push(new Date(Date.UTC(jahr, monat, 0)).toISOString().slice(0, 10));
  }
  return aus;
}

/**
 * Baut eine Welt aus `monate` Stichtagen mit je `titel` Titeln.
 *
 * `effekt` steuert, wie stark der Qualitäts-Score die Folgerendite erklärt;
 * `marktSchwankung` erzeugt gemeinsame Monatsbewegungen, die JEDEN Titel
 * gleichermassen heben oder senken. Genau die soll die Diagnose herausrechnen.
 */
function welt(opts: {
  monate?: number; titel?: number; effekt?: number; marktSchwankung?: number;
  saat?: number; nurInDenErstenJahren?: number;
} = {}): Beobachtung[] {
  const { monate = 60, titel = 60, effekt = 0, marktSchwankung = 0, saat = 5 } = opts;
  const z = lcg(saat);
  const aus: Beobachtung[] = [];
  const tage = stichtage(monate);

  for (let m = 0; m < tage.length; m++) {
    // Der gemeinsame Monatseffekt — für alle Titel derselbe.
    const markt = (z() - 0.5) * 2 * marktSchwankung;
    const wirkt = opts.nurInDenErstenJahren === undefined
      ? true
      : m < opts.nurInDenErstenJahren * 12;
    for (let t = 0; t < titel; t++) {
      const qualitaet = z() * 100;
      aus.push({
        ticker: `T${t}`,
        datum: tage[m],
        qualitaet,
        bewertung: z() * 100,
        timing: z() * 100,
        regime: "default",
        vorwaertsRendite: markt + (wirkt ? (qualitaet - 50) * effekt : 0) + (z() - 0.5) * 4,
      });
    }
  }
  return aus;
}

describe("diagnostiziere rechnet den Markteffekt heraus", () => {
  it("findet keinen Zusammenhang, wo nur der Markt schwankt", () => {
    // Der wichtigste Fall: Riesige gemeinsame Monatsbewegungen, aber kein
    // Zusammenhang zum Score. Wer nicht quer je Stichtag rechnet, misst hier
    // die guten Monate und hält sie für Auswahlleistung.
    const d = diagnostiziere(welt({ marktSchwankung: 30, effekt: 0 }), "qualitaet");
    expect(Math.abs(d.ic!)).toBeLessThan(0.05);
    expect(Math.abs(d.spanne!)).toBeLessThan(1);
  });

  it("findet den Zusammenhang auch DURCH grosse Marktschwankungen hindurch", () => {
    const d = diagnostiziere(welt({ marktSchwankung: 30, effekt: 0.08 }), "qualitaet");
    expect(d.ic!).toBeGreaterThan(0.3);
    expect(d.spanne!).toBeGreaterThan(4);
  });

  it("liefert monoton steigende Dezile, wenn der Zusammenhang besteht", () => {
    const d = diagnostiziere(welt({ effekt: 0.08, marktSchwankung: 10 }), "qualitaet");
    const oben = d.dezile[9].ueberschuss;
    const unten = d.dezile[0].ueberschuss;
    expect(unten).toBeLessThan(0);
    expect(oben).toBeGreaterThan(0);
    expect(oben).toBeGreaterThan(d.dezile[4].ueberschuss);
    expect(d.dezile[4].ueberschuss).toBeGreaterThan(unten);
  });

  it("summiert die Überschüsse je Stichtag auf null", () => {
    // Die Probe auf die Rechnung: Gemessen wird gegen den Querschnitt, also
    // muss sich über alle Dezile hinweg alles aufheben.
    const d = diagnostiziere(welt({ effekt: 0.08, marktSchwankung: 20 }), "qualitaet");
    const gewichtet = d.dezile.reduce((s, z) => s + z.ueberschuss * z.n, 0);
    const n = d.dezile.reduce((s, z) => s + z.n, 0);
    expect(gewichtet / n).toBeCloseTo(0, 6);
  });
});

describe("diagnostiziere unterscheidet beständig von zufällig", () => {
  it("meldet bei reinem Zufall einen Anteil positiver Stichtage nahe der Hälfte", () => {
    const d = diagnostiziere(welt({ effekt: 0, marktSchwankung: 5 }), "qualitaet");
    expect(d.icPositivAnteil).toBeGreaterThan(0.35);
    expect(d.icPositivAnteil).toBeLessThan(0.65);
  });

  it("meldet bei echtem Zusammenhang eine grosse Mehrheit gleichgerichteter Stichtage", () => {
    const d = diagnostiziere(welt({ effekt: 0.08 }), "qualitaet");
    expect(d.icPositivAnteil).toBeGreaterThan(0.8);
  });

  it("gibt die Streuung des IC aus, nicht nur seinen Mittelwert", () => {
    const d = diagnostiziere(welt({ effekt: 0.08 }), "qualitaet");
    expect(d.icStreuung).toBeGreaterThan(0);
  });
});

describe("diagnostiziere: Sorgfalt an den Rändern", () => {
  it("lässt Stichtage mit zu wenigen Titeln aus, statt Dezile zu erfinden", () => {
    const duenn = welt({ monate: 12, titel: MIN_TITEL_JE_STICHTAG - 1 });
    const d = diagnostiziere(duenn, "qualitaet");
    expect(d.stichtage).toBe(0);
    expect(d.hinweis).toContain(String(MIN_TITEL_JE_STICHTAG));
  });

  it("übergeht Beobachtungen ohne belegten Score", () => {
    const b = welt({ monate: 12, titel: 40 });
    const ohneTiming = b.map((x) => ({ ...x, timing: null }));
    expect(diagnostiziere(ohneTiming, "timing").stichtage).toBe(0);
    expect(diagnostiziere(ohneTiming, "qualitaet").stichtage).toBe(12);
  });

  it("verträgt leere Eingaben", () => {
    const d = diagnostiziere([], "qualitaet");
    expect(d.ic).toBeNull();
    expect(d.dezile).toEqual([]);
    expect(d.hinweis).not.toBeNull();
  });

  it("kommt mit lauter gleichen Scores zurecht, statt eine Ordnung zu behaupten", () => {
    const gleich = welt({ monate: 12, titel: 40 }).map((b) => ({ ...b, qualitaet: 50 }));
    const d = diagnostiziere(gleich, "qualitaet");
    // Keine Streuung im Score → keine Rangkorrelation. Nicht 0, sondern nichts.
    expect(d.ic).toBeNull();
  });
});

describe("jeJahr", () => {
  it("deckt auf, dass ein Zusammenhang nur früher bestand", () => {
    // Der Fall, den ein einzelner Zehnjahres-Durchschnitt verbirgt: Der Score
    // funktionierte drei Jahre lang und danach nicht mehr.
    const b = welt({ monate: 96, effekt: 0.10, nurInDenErstenJahren: 3 });
    const zeilen = jeJahr(b, "qualitaet");
    expect(zeilen).toHaveLength(8);
    const frueh = zeilen.slice(0, 3).map((z) => z.ic!);
    const spaet = zeilen.slice(4).map((z) => z.ic!);
    expect(Math.min(...frueh)).toBeGreaterThan(0.3);
    expect(Math.max(...spaet)).toBeLessThan(0.15);
  });

  it("gibt die Basisrendite je Jahr aus, damit ein Ausnahmejahr auffällt", () => {
    const zeilen = jeJahr(welt({ monate: 24, marktSchwankung: 20 }), "qualitaet");
    expect(zeilen).toHaveLength(2);
    for (const z of zeilen) expect(Number.isFinite(z.basis)).toBe(true);
  });
});

describe("diagnostiziere macht sichtbar, auf wie vielen Titeln es beruht", () => {
  it("nennt die Titel je Stichtag und die Abdeckung", () => {
    const d = diagnostiziere(welt({ monate: 24, titel: 60 }), "qualitaet");
    expect(d.titelJeStichtag).toBe(60);
    expect(d.abdeckung).toBe(1);
  });

  it("warnt, wenn der Score nur einen Ausschnitt des Universums abdeckt", () => {
    // Genau der Fall aus der Praxis: Der Bewertungs-Score war nur für
    // Finanzwerte berechenbar. Die Diagnose sah 30 statt 212 Titel je Monat
    // und wies nur die Gesamtzahl der Beobachtungen aus — der IC galt für
    // einen Ausschnitt, ohne dass es irgendwo stand.
    const b = welt({ monate: 24, titel: 100 }).map((x, i) =>
      (i % 100) < 25 ? x : { ...x, bewertung: null });
    const d = diagnostiziere(b, "bewertung");
    expect(d.titelJeStichtag).toBe(25);
    expect(d.abdeckung).toBeCloseTo(0.25, 2);
    expect(klartext(d)).toContain("NUR EIN AUSSCHNITT");
  });

  it("warnt NICHT, wenn der Score das Universum abdeckt", () => {
    const d = diagnostiziere(welt({ monate: 24, titel: 60 }), "qualitaet");
    expect(klartext(d)).not.toContain("AUSSCHNITT");
  });
});

describe("klartext", () => {
  it("nennt fehlenden Zusammenhang beim Namen", () => {
    const d = diagnostiziere(welt({ effekt: 0, marktSchwankung: 10 }), "qualitaet");
    expect(klartext(d)).toContain("Kein erkennbarer Zusammenhang");
  });

  it("bestätigt einen beständigen Zusammenhang", () => {
    const d = diagnostiziere(welt({ effekt: 0.08 }), "qualitaet");
    expect(klartext(d)).toContain("Dezilspanne");
  });

  it("gibt den Hinweis weiter, wenn gar nichts messbar war", () => {
    expect(klartext(diagnostiziere([], "bewertung"))).toContain("Stichtag");
  });
});

describe("alle drei Scores lassen sich gleich behandeln", () => {
  it("nimmt jedes der drei Felder", () => {
    const b = welt({ monate: 24, titel: 40 });
    for (const feld of ["qualitaet", "bewertung", "timing"] as ScoreFeld[]) {
      const d = diagnostiziere(b, feld);
      expect(d.feld).toBe(feld);
      expect(d.stichtage).toBe(24);
    }
  });
});
