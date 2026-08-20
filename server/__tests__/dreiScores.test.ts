/**
 * Qualität, Bewertung und Timing — die Dreiteilung.
 *
 * Umsetzung von `design/KONZEPT_SCORE_DREITEILUNG.md`.
 *
 * Der Anlass steht dort im Detail; kurz: Der bisherige «Qualitäts-Score»
 * enthält keinen einzigen Qualitätsfaktor. ABB erhielt 31 «schwach» — getragen
 * zu 70 % von Dividendenrendite und KGV, die beide dasselbe sagen: teuer.
 * *The Market* führt dieselbe Aktie mit Piotroski 7 von 9 unter den besten
 * Schweizer Titeln.
 */

import { describe, it, expect } from "vitest";
import { berechnePiotroski, piotroskiKlartext, MIN_KRITERIEN } from "../lib/piotroski";
import {
  berechneNiveau,
  berechneQualitaet,
  berechneBewertung,
  qualitaetsBand,
  bewertungsBand,
  punkteAus,
  kgvDeckel,
  wachstumsFaktor,
  nutztBuchwert,
  qualitaetsRechnung,
} from "../lib/dreiScores";

// ─── Testdaten: zwei Geschäftsjahre eines sich verbessernden Unternehmens ─────

function abschluss(opts: {
  cfo: number; gewinn: number; aktiva: number; ltd: number;
  ua: number; kv: number; aktien: number; umsatz: number; brutto: number;
}) {
  return {
    bs: {
      totalAssets: opts.aktiva, longTermDebt: opts.ltd,
      totalCurrentAssets: opts.ua, totalCurrentLiabilities: opts.kv,
      commonStockSharesOutstanding: opts.aktien, totalStockholderEquity: opts.aktiva * 0.5,
    },
    is: { netIncome: opts.gewinn, totalRevenue: opts.umsatz, grossProfit: opts.brutto },
    cf: { totalCashFromOperatingActivities: opts.cfo },
  };
}

function financials(vorjahr: ReturnType<typeof abschluss>, jetzt: ReturnType<typeof abschluss>) {
  return {
    Balance_Sheet: { yearly: { "2024-12-31": vorjahr.bs, "2025-12-31": jetzt.bs } },
    Income_Statement: { yearly: { "2024-12-31": vorjahr.is, "2025-12-31": jetzt.is } },
    Cash_Flow: { yearly: { "2024-12-31": vorjahr.cf, "2025-12-31": jetzt.cf } },
  };
}

const schwach = abschluss({ cfo: 80, gewinn: 100, aktiva: 1000, ltd: 300, ua: 200, kv: 200, aktien: 100, umsatz: 800, brutto: 240 });
const stark = abschluss({ cfo: 200, gewinn: 150, aktiva: 1100, ltd: 220, ua: 300, kv: 200, aktien: 98, umsatz: 1000, brutto: 350 });

describe("Piotroski F-Score", () => {
  it("ein durchweg verbessertes Unternehmen erreicht alle neun Punkte", () => {
    const r = berechnePiotroski(financials(schwach, stark));
    expect(r.berechenbar).toBe(9);
    expect(r.score).toBe(9);
    expect(r.hochgerechnet).toBe(9);
    expect(piotroskiKlartext(r.score, r.berechenbar)).toContain("Sehr gut");
  });

  it("die umgekehrte Richtung ergibt einen tiefen Score", () => {
    const r = berechnePiotroski(financials(stark, schwach));
    expect(r.berechenbar).toBe(9);
    expect(r.score).toBeLessThanOrEqual(2);
    expect(piotroskiKlartext(r.score, r.berechenbar)).toContain("Warnsignal");
  });

  it("erkennt Verwässerung durch eine gestiegene Aktienzahl", () => {
    const mehrAktien = { ...stark, bs: { ...stark.bs, commonStockSharesOutstanding: 120 } };
    const r = berechnePiotroski(financials(schwach, mehrAktien));
    const k = r.kriterien.find((x) => x.schluessel === "keineVerwaesserung")!;
    expect(k.erfuellt).toBe(false);
    expect(k.erlaeuterung).toContain("gestiegen");
  });

  it("erkennt einen Gewinn, den der Zahlungsstrom nicht deckt", () => {
    const schoengerechnet = { ...stark, cf: { totalCashFromOperatingActivities: 50 } };
    const r = berechnePiotroski(financials(schwach, schoengerechnet));
    const k = r.kriterien.find((x) => x.schluessel === "cashflowUeberGewinn")!;
    expect(k.erfuellt).toBe(false);
    expect(k.erlaeuterung).toContain("übersteigt");
  });

  it("fehlende Angaben zählen nicht als «nicht erfüllt»", () => {
    // Ohne Cashflow-Abschluss fallen genau die zwei Cashflow-Kriterien weg.
    const ohneCf = {
      Balance_Sheet: financials(schwach, stark).Balance_Sheet,
      Income_Statement: financials(schwach, stark).Income_Statement,
      Cash_Flow: { yearly: {} },
    };
    const r = berechnePiotroski(ohneCf);
    expect(r.berechenbar).toBe(0); // ohne alle drei Abschlüsse kein gemeinsames Jahr
    expect(r.hochgerechnet).toBeNull();
    expect(r.kriterien.every((k) => k.erfuellt === null)).toBe(true);
  });

  it("ohne Vorjahr gibt es keinen Score", () => {
    const nurEinJahr = {
      Balance_Sheet: { yearly: { "2025-12-31": stark.bs } },
      Income_Statement: { yearly: { "2025-12-31": stark.is } },
      Cash_Flow: { yearly: { "2025-12-31": stark.cf } },
    };
    const r = berechnePiotroski(nurEinJahr);
    expect(r.berechenbar).toBe(0);
    expect(r.hochgerechnet).toBeNull();
    expect(piotroskiKlartext(r.score, r.berechenbar)).toBe("Zu wenige Abschlussdaten");
  });

  it("verkraftet fehlende Eingaben ohne Absturz", () => {
    for (const eingabe of [null, undefined, {}, { Balance_Sheet: null }]) {
      const r = berechnePiotroski(eingabe);
      expect(r.kriterien).toHaveLength(9);
      expect(r.hochgerechnet).toBeNull();
    }
  });

  it("die Hochrechnung greift erst ab der Mindestzahl an Kriterien", () => {
    expect(MIN_KRITERIEN).toBe(6);
  });
});

describe("punkteAus", () => {
  it("bildet zwischen den Ankern linear ab", () => {
    expect(punkteAus(0, 0, 10)).toBe(0);
    expect(punkteAus(5, 0, 10)).toBe(50);
    expect(punkteAus(10, 0, 10)).toBe(100);
  });

  it("begrenzt ausserhalb der Anker", () => {
    expect(punkteAus(-5, 0, 10)).toBe(0);
    expect(punkteAus(99, 0, 10)).toBe(100);
  });

  it("kehrt um, wenn der gute Anker kleiner ist — etwa beim KGV", () => {
    expect(punkteAus(10, 40, 10)).toBe(100);
    expect(punkteAus(40, 40, 10)).toBe(0);
    expect(punkteAus(25, 40, 10)).toBe(50);
  });

  it("gibt für fehlende Werte null zurück, nicht 0", () => {
    expect(punkteAus(null, 0, 10)).toBeNull();
    expect(punkteAus(NaN, 0, 10)).toBeNull();
  });
});

describe("Qualität — Niveau", () => {
  const gut = {
    roic: 22, betriebsmarge: 25, bruttomarge: 55,
    ertragsdeckung: 1.3, gewinnwachstum: 12, epsStabilitaet: 80, netDebtToEbitda: 0.5,
  };

  it("ein starkes Unternehmen erreicht ein hohes Niveau", () => {
    const r = berechneNiveau(gut);
    expect(r.abdeckung).toBe(1);
    expect(r.score).toBeGreaterThan(70);
  });

  // FASSUNG 6: Die Wachstums-Höhe zählt zur Qualität. Vorher holte ein
  // stabiler Null-Wächser Bestnoten — Stabilität misst nur Gleichmässigkeit,
  // der F-Score nur das binäre Vorjahres-Delta.
  it("FASSUNG 6: ein stabiler Null-Wächser verliert gegenüber einem Wächser", () => {
    const nullWachser = berechneNiveau({ ...gut, gewinnwachstum: 0 });
    const wachser = berechneNiveau({ ...gut, gewinnwachstum: 20 });
    expect(nullWachser.score!).toBeLessThan(wachser.score!);
    // Anker 0 → 0 Punkte, 20 → 100 Punkte, Gewicht 15 %: exakt 15 Punkte Abstand.
    expect(wachser.score! - nullWachser.score!).toBeCloseTo(15, 1);
  });

  it("FASSUNG 6: fehlendes Wachstum wird ausgeblendet und renormiert, nie als 0 gewertet", () => {
    const ohne = berechneNiveau({ ...gut, gewinnwachstum: null });
    expect(ohne.abdeckung).toBeCloseTo(0.85, 3);
    expect(ohne.score).not.toBeNull();
    const alsNull = berechneNiveau({ ...gut, gewinnwachstum: 0 });
    expect(ohne.score!).toBeGreaterThan(alsNull.score!);
  });

  it("ein schwaches Unternehmen fällt deutlich ab", () => {
    const r = berechneNiveau({
      roic: 3, betriebsmarge: 1, bruttomarge: 8,
      ertragsdeckung: 0.5, epsStabilitaet: 20, netDebtToEbitda: 5,
    });
    expect(r.score).toBeLessThan(20);
  });

  it("greift die Mindestabdeckung — zwei von sechs Faktoren reichen nicht", () => {
    const r = berechneNiveau({
      roic: 22, betriebsmarge: 25, bruttomarge: null,
      ertragsdeckung: null, epsStabilitaet: null, netDebtToEbitda: null,
    });
    expect(r.abdeckung).toBeCloseTo(0.45, 2);
    expect(r.score).toBeNull();
  });

  // Expedia-Befund (19.08.): ROIC 399 % durch rückkaufgeschrumpftes
  // Eigenkapital — der Nenner (Eigenkapital + Nettoschulden) ist ein
  // Restposten, die Zahl misst die Kapitalstruktur, nicht das Geschäft.
  // Volle Punkte für eine Zahl ohne Aussage sind dieselbe Fehlerklasse wie
  // das PEG jenseits der Obergrenze: ausblenden, nicht belohnen.
  it("FASSUNG 7: ein ROIC jenseits der Obergrenze wird ausgeblendet, nicht mit Bestnote belohnt", () => {
    const artefakt = berechneNiveau({ ...gut, roic: 399.36 });
    const f = artefakt.faktoren.find((x) => x.name === "Kapitalrendite (ROIC)")!;
    expect(f.punkte).toBeNull();
    expect(f.hinweis).toContain("Nenner");
    // Renormierung statt erfundener 0: gleiche Rechnung wie ohne ROIC.
    const ohne = berechneNiveau({ ...gut, roic: null });
    expect(artefakt.score).toBe(ohne.score);
  });

  it("FASSUNG 7: hohe, aber realistische ROIC-Werte bleiben — mit Netto-Cash-Hinweis", () => {
    const hoch = berechneNiveau({ ...gut, roic: 80 });
    const f = hoch.faktoren.find((x) => x.name === "Kapitalrendite (ROIC)")!;
    expect(f.punkte).toBe(100);
    expect(f.hinweis).toContain("Kapitalnenner");
  });

  it("ein Nettoguthaben wird nicht schlechter bewertet als keine Schulden", () => {
    const mitGuthaben = berechneNiveau({ ...gut, netDebtToEbitda: -2 });
    const ohneSchulden = berechneNiveau({ ...gut, netDebtToEbitda: 0 });
    expect(mitGuthaben.score).toBe(ohneSchulden.score);
  });

  it("die Erläuterung benennt eine ungedeckte Ertragslage", () => {
    const r = berechneNiveau({ ...gut, ertragsdeckung: 0.7 });
    const f = r.faktoren.find((x) => x.name === "Ertragsqualität")!;
    expect(f.hinweis).toContain("nur 70 %");
  });
});

describe("Qualität — Niveau und Richtung zusammen", () => {
  const gut = {
    roic: 22, betriebsmarge: 25, bruttomarge: 55,
    ertragsdeckung: 1.3, epsStabilitaet: 80, netDebtToEbitda: 0.5,
  };

  it("gewichtet Niveau mit 60 % und Richtung mit 40 %", () => {
    const p = berechnePiotroski(financials(schwach, stark)); // F-Score 9 -> 100
    const r = berechneQualitaet(gut, p);
    expect(r.richtung.score).toBe(100);
    expect(r.richtung.fScore).toBe(9);
    expect(r.gesamt).toBeCloseTo(r.niveau.score! * 0.6 + 100 * 0.4, 1);
  });

  it("ein hervorragendes Unternehmen auf Plateau verliert nicht alles", () => {
    // F-Score tief, Niveau hoch — das Ergebnis bleibt im oberen Mittelfeld.
    const p = berechnePiotroski(financials(stark, schwach));
    const r = berechneQualitaet(gut, p);
    expect(r.richtung.score).toBeLessThan(30);
    expect(r.gesamt).toBeGreaterThan(40);
    expect(r.gesamt).toBeLessThan(r.niveau.score!);
  });

  it("ohne Abschlüsse trägt das Niveau allein", () => {
    const r = berechneQualitaet(gut, berechnePiotroski(null));
    expect(r.richtung.score).toBeNull();
    expect(r.gesamt).toBe(r.niveau.score);
  });

  it("ohne beides gibt es keinen Score", () => {
    const leer = { roic: null, betriebsmarge: null, bruttomarge: null, ertragsdeckung: null, epsStabilitaet: null, netDebtToEbitda: null };
    const r = berechneQualitaet(leer, berechnePiotroski(null));
    expect(r.gesamt).toBeNull();
    expect(qualitaetsBand(r.gesamt)).toBe("nicht beurteilbar");
  });

  it("die angezeigte Rechnung reproduziert die Kopfzahl (Befund BCHN: 74 aus 64.4 und 88.9)", () => {
    // Der Prüf-Fall: Niveau 64.4 aus den sechs Faktoren, F-Score 8/9 → 88.9.
    // Wer nur die Faktoren aufsummiert, bekommt 64.4 und hält 74 für falsch —
    // der Rechnungs-Satz macht die 60/40-Klammer sichtbar.
    const text = qualitaetsRechnung({ gesamt: 74.2, niveau: 64.4, richtung: 88.9, fScore: 8 });
    expect(text).toBe("Niveau 64.4 × 60 % + Richtung 88.9 (F-Score 8/9) × 40 % = 74.2");
    // Und die Klammer stimmt arithmetisch.
    expect(0.6 * 64.4 + 0.4 * 88.9).toBeCloseTo(74.2, 1);
  });

  it("die Rechnung folgt der tatsächlichen Aggregation auch bei einer Säule", () => {
    const nurNiveau = qualitaetsRechnung({ gesamt: 64.4, niveau: 64.4, richtung: null, fScore: null });
    expect(nurNiveau).toContain("Nur das Niveau");
    expect(qualitaetsRechnung({ gesamt: null, niveau: null, richtung: null, fScore: null })).toBeNull();
  });
});

describe("Bewertung — hoch heisst günstig", () => {
  it("ein günstiger Titel erreicht einen hohen Score", () => {
    const r = berechneBewertung({
      adjustedPeg: 0.8, kgv: 10, fcfRendite: 8, dividendenrendite: 5, kursBuchwert: 1,
    });
    expect(r.score).toBeGreaterThan(90);
    expect(bewertungsBand(r.score)).toBe("günstig");
  });

  it("ein teurer Titel erreicht einen tiefen Score", () => {
    const r = berechneBewertung({
      adjustedPeg: 4, kgv: 45, fcfRendite: 0.5, dividendenrendite: 0, kursBuchwert: 12,
    });
    expect(r.score).toBeLessThan(15);
    expect(bewertungsBand(r.score)).toBe("teuer");
  });

  it("greift die Mindestabdeckung", () => {
    // Nur die Dividendenrendite (0.20 von 1.0) — zu wenig.
    const r = berechneBewertung({
      adjustedPeg: null, kgv: null, fcfRendite: null, dividendenrendite: 3, kursBuchwert: null,
    });
    expect(r.abdeckung).toBeCloseTo(0.20, 2);
    expect(r.score).toBeNull();
  });

  it("ein widerlegter Dividenden-Quellenwert wird ausgeblendet, nicht verrechnet (LISP-Fall)", () => {
    // EODHD meldete für LISP.SW 18.98 % — die unabhängige Gegenprobe 1.93 %.
    // Der Wächter blendet aus (Renormierung), er kappt nicht still.
    const mit = berechneBewertung({
      adjustedPeg: 1.2, kgv: 15, fcfRendite: 4, dividendenrendite: 18.98, kursBuchwert: null,
      dividendenWiderlegtHinweis: "18.98 % durch unabhängige Gegenprobe widerlegt (Yahoo 1.93 %) — Faktor ausgeblendet",
    });
    const dividende = mit.faktoren.find((f) => f.name === "Dividendenrendite")!;
    expect(dividende.punkte).toBeNull();
    expect(dividende.hinweis).toContain("widerlegt");
    const ohne = berechneBewertung({
      adjustedPeg: 1.2, kgv: 15, fcfRendite: 4, dividendenrendite: null, kursBuchwert: null,
    });
    expect(mit.score).toBeCloseTo(ohne.score!, 4);
  });

  it("der Gegenprobe-Befund aus kgvMitGegenprobe erscheint am KGV-Faktor (E4b)", () => {
    // Der Widerspruchs-Hinweis darf nicht im Service verhungern — der
    // Erklaerdialog muss zeigen, WARUM hier die vorsichtigere Zahl steht.
    const r = berechneBewertung({
      adjustedPeg: 1.2, kgv: 23, fcfRendite: 4, dividendenrendite: 2, kursBuchwert: 3,
      kgvHinweis: "Eigenes KGV (10.0) und Vendor-KGV (23.0) widersprechen sich (über Faktor 1.5) — vorsichtigere Zahl verwendet",
    });
    const kgvFaktor = r.faktoren.find((f) => f.name === "KGV")!;
    expect(kgvFaktor.hinweis).toContain("widersprechen sich");
    expect(kgvFaktor.hinweis).toContain("23.0-facher Jahresgewinn");
  });

  it("FASSUNG 8: ein KGV um 26 gibt noch Punkte — 0 Punkte erst ab 40", () => {
    // Marc-Befund 20.08.: Im Finanzwerte-Zweig gab KGV 26.4 null Punkte
    // (Anker 20 = 0) — viel zu streng. Neuer 0-Punkte-Anker in beiden
    // Zweigen: 40.
    const immobilie = berechneBewertung({
      adjustedPeg: null, kgv: 26.4, fcfRendite: null, dividendenrendite: 2.5,
      kursBuchwert: 1.4, sektor: "Real Estate",
    });
    const kgvFinanz = immobilie.faktoren.find((f) => f.name === "KGV")!;
    expect(kgvFinanz.punkte).toBeGreaterThan(30);
    expect(kgvFinanz.rechnung).toContain("Anker: 40 = 0 Punkte");

    const tech = berechneBewertung({
      adjustedPeg: 1.5, kgv: 26.4, fcfRendite: 4, dividendenrendite: 1,
      kursBuchwert: 8, sektor: "Technology",
    });
    const kgvTech = tech.faktoren.find((f) => f.name === "KGV")!;
    expect(kgvTech.punkte).toBeGreaterThan(30);

    // Ab 40 bleibt es bei 0 Punkten — die Fallhöhe sehr hoher KGV deckt
    // zusätzlich der KGV-Deckel ab (greift ab 30).
    const teuer = berechneBewertung({
      adjustedPeg: 1.5, kgv: 41, fcfRendite: 4, dividendenrendite: 1,
      kursBuchwert: 8, sektor: "Technology",
    });
    expect(teuer.faktoren.find((f) => f.name === "KGV")!.punkte).toBe(0);
  });

  it("ein negatives KGV wird nicht als günstig gelesen", () => {
    // Ein Verlusttitel darf ueber den KGV-Deckel keinen Vorteil erhalten.
    const verlust = berechneBewertung({
      adjustedPeg: 1.2, kgv: -12, fcfRendite: 3, dividendenrendite: 2, kursBuchwert: 2,
    });
    expect(kgvDeckel(-12)).toBe(100); // kein Deckel, aber auch kein Bonus
    expect(verlust.score).not.toBeNull();
  });
});

describe("KGV als Deckel statt als Summand", () => {
  it("greift bis KGV 30 nicht", () => {
    expect(kgvDeckel(10)).toBe(100);
    expect(kgvDeckel(30)).toBe(100);
  });

  it("senkt die Obergrenze mit steigendem KGV", () => {
    expect(kgvDeckel(50)).toBeCloseTo(60, 1);
    expect(kgvDeckel(80)).toBeCloseTo(35, 1);
    expect(kgvDeckel(128)).toBe(25);
  });

  it("Palantir: tiefes PEG, aber das absolute KGV begrenzt", () => {
    // PEG 0.45 ergaebe fuer sich 100 Punkte. KGV 128 heisst: Der Markt hat
    // viele Jahre Wachstum vorweggenommen — bleibt es aus, ist die Fallhoehe
    // gross. Das kann das PEG nicht ausdruecken.
    const r = berechneBewertung({
      adjustedPeg: 0.451, kgv: 128.19, fcfRendite: 0.952, dividendenrendite: 0,
      kursBuchwert: 34.86, sektor: "Technology",
    });
    expect(r.score).toBe(25);
    const deckel = r.faktoren.find((f) => f.name === "KGV-Deckel");
    expect(deckel).toBeDefined();
    expect(deckel!.hinweis).toContain("PEG allein");
  });

  it("bei moderatem KGV bleibt der Deckel wirkungslos", () => {
    const r = berechneBewertung({
      adjustedPeg: 1.489, kgv: 26.3, fcfRendite: 3.794, dividendenrendite: 2.37,
      kursBuchwert: 10.42, sektor: "Consumer Defensive",
    });
    expect(r.faktoren.find((f) => f.name === "KGV-Deckel")).toBeUndefined();
  });
});

describe("Wachstumsrichtung", () => {
  it("beschleunigtes Wachstum hebt das PEG-Urteil", () => {
    expect(wachstumsFaktor(60, 45)).toBeCloseTo(1.10, 2);
  });

  it("nachlassendes Wachstum senkt es", () => {
    expect(wachstumsFaktor(5, 25)).toBeCloseTo(0.80, 2);
  });

  it("ist begrenzt — auch extreme Sprünge kippen das Urteil nicht", () => {
    expect(wachstumsFaktor(500, 1)).toBe(1.1);
    expect(wachstumsFaktor(1, 500)).toBe(0.8);
  });

  it("bleibt neutral, wenn eine der beiden Zahlen fehlt", () => {
    expect(wachstumsFaktor(null, 10)).toBe(1);
    expect(wachstumsFaktor(10, null)).toBe(1);
    expect(wachstumsFaktor(undefined, undefined)).toBe(1);
  });

  it("wird im Hinweistext benannt", () => {
    const anziehend = berechneBewertung({
      adjustedPeg: 1.5, kgv: 20, fcfRendite: 4, dividendenrendite: 2, kursBuchwert: 3,
      epsWachstumTTM: 30, epsWachstum5j: 10, sektor: "Technology",
    });
    expect(anziehend.faktoren[0].hinweis).toContain("zieht an");

    const nachlassend = berechneBewertung({
      adjustedPeg: 1.5, kgv: 20, fcfRendite: 4, dividendenrendite: 2, kursBuchwert: 3,
      epsWachstumTTM: 2, epsWachstum5j: 20, sektor: "Technology",
    });
    expect(nachlassend.faktoren[0].hinweis).toContain("lässt nach");
    expect(nachlassend.score!).toBeLessThan(anziehend.score!);
  });
});

describe("Kurs-Buchwert nur dort, wo er etwas aussagt", () => {
  it("erkennt Banken, Versicherer und Immobilien", () => {
    for (const s of ["Financial Services", "Banks", "Insurance", "Real Estate", "Immobilien", "Versicherung"]) {
      expect(nutztBuchwert(s), s).toBe(true);
    }
  });

  it("erkennt alle übrigen als Nicht-Buchwert-Sektoren", () => {
    for (const s of ["Technology", "Healthcare", "Industrials", "Consumer Defensive", null, undefined, ""]) {
      expect(nutztBuchwert(s), String(s)).toBe(false);
    }
  });

  it("eine Bank wird nach Buchwert, KGV und Ausschüttung beurteilt", () => {
    const r = berechneBewertung({
      adjustedPeg: 1.2, kgv: 11, fcfRendite: null, dividendenrendite: 5.5,
      kursBuchwert: 1.1, sektor: "Financial Services",
    });
    expect(r.faktoren.map((f) => f.name)).toEqual(["Kurs-Buchwert", "KGV", "Dividendenrendite"]);
    expect(r.abdeckung).toBe(1);
    expect(bewertungsBand(r.score)).toBe("günstig");
  });

  it("ein Softwarehaus wird nicht am Buchwert gemessen", () => {
    // Apple handelt zum 42-fachen Buchwert. Ein fuer Value kalibrierter Anker
    // gaebe null Punkte und sagte damit nichts.
    const r = berechneBewertung({
      adjustedPeg: 1.078, kgv: 35.26, fcfRendite: 3.162, dividendenrendite: 0.34,
      kursBuchwert: 42.21, sektor: "Technology",
    });
    expect(r.faktoren.some((f) => f.name === "Kurs-Buchwert")).toBe(false);
    // FASSUNG 3: Das KGV traegt jetzt eigenes Gewicht — 35-facher Gewinn gibt
    // dort wenig Punkte (seit FASSUNG 8: knapp unter dem 0-Anker 40), der
    // Gesamtscore landet bei «ambitioniert» statt «fair». Entscheidend bleibt:
    // Der Buchwert (42x) hat die Zahl nicht auf null gezogen, der Score sagt
    // weiterhin etwas aus.
    expect(r.score).toBeGreaterThan(40);
    expect(bewertungsBand(r.score)).toBe("ambitioniert");
  });
});

describe("Bänder", () => {
  it("Qualität und Bewertung tragen unterschiedliche Etiketten", () => {
    // Dieselbe Zahl, verschiedene Bedeutung — genau der Fehler, den das
    // Konzept beheben soll.
    expect(qualitaetsBand(80)).toBe("ausgezeichnet");
    expect(bewertungsBand(80)).toBe("günstig");
    expect(qualitaetsBand(20)).toBe("schwach");
    expect(bewertungsBand(20)).toBe("teuer");
  });
});
