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
    ertragsdeckung: 1.3, epsStabilitaet: 80, netDebtToEbitda: 0.5,
  };

  it("ein starkes Unternehmen erreicht ein hohes Niveau", () => {
    const r = berechneNiveau(gut);
    expect(r.abdeckung).toBe(1);
    expect(r.score).toBeGreaterThan(70);
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

  it("ABB: hohes KGV und hoher Buchwertaufschlag ergeben «teuer»", () => {
    // Werte aus der Schweizer F-Score-Tabelle von The Market (30.07.2026):
    // KGV 2027e 26.5, Kurs-Buchwert 10.9, FCF-Rendite 2.8 %.
    const r = berechneBewertung({
      adjustedPeg: null, kgv: 26.5, fcfRendite: 2.8, dividendenrendite: 1.51, kursBuchwert: 10.9,
    });
    expect(r.score).not.toBeNull();
    expect(r.score!).toBeLessThan(50);
  });

  it("greift die Mindestabdeckung", () => {
    const r = berechneBewertung({
      adjustedPeg: null, kgv: null, fcfRendite: null, dividendenrendite: 3, kursBuchwert: null,
    });
    expect(r.abdeckung).toBeCloseTo(0.15, 2);
    expect(r.score).toBeNull();
  });

  it("ein negatives KGV wird nicht als günstig gelesen", () => {
    const verlust = berechneBewertung({
      adjustedPeg: null, kgv: -12, fcfRendite: 3, dividendenrendite: 2, kursBuchwert: 2,
    });
    const kgvFaktor = verlust.faktoren.find((f) => f.name === "KGV")!;
    expect(kgvFaktor.punkte).toBeNull();
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
