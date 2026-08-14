/**
 * Rekonstruktion der Score-Reihe.
 *
 * Der Lauf ist so gebaut, dass Abruf und Rechnung getrennt sind — dadurch
 * lässt sich das Wesentliche ohne EODHD-Zugang prüfen: dass kein Kurs aus der
 * Zukunft verwendet wird und dass eine Reihe Lücken zeigt, statt sie zu füllen.
 */

import { describe, it, expect, vi } from "vitest";

vi.mock("./punktInZeitStore", () => ({
  haltefestHistorie: async (s: unknown[]) => s.length,
  FASSUNG: 2,
}));

import { kursAm, kursZeileAm, reiheFuerTitel, rekonstruiere } from "./punktInZeitRekonstruktion";

const KURSE = [
  { date: "2024-03-27", close: 20 },
  { date: "2024-03-28", close: 21 },
  // 29.–31.03. Feiertag/Wochenende
  { date: "2024-04-02", close: 25 },
];

describe("kursAm", () => {
  it("liefert für einen Wochenend-Stichtag den tatsächlichen letzten Handelstag", () => {
    expect(kursZeileAm(KURSE, "2024-03-31")).toEqual({ date: "2024-03-28", close: 21 });
  });

  it("nimmt den letzten Handelstag vor dem Stichtag", () => {
    expect(kursAm(KURSE, "2024-03-31")).toBe(21);
  });

  it("nimmt NIE einen Kurs von nach dem Stichtag", () => {
    // Der Kern: Am 31.03. war der Kurs vom 02.04. nicht bekannt. Würde die
    // Suche den nächstgelegenen statt den letzten vorherigen nehmen, flösse
    // ein Zukunftskurs in die Bewertung.
    expect(kursAm(KURSE, "2024-03-31")).not.toBe(25);
  });

  it("gibt null zurück, wenn die Reihe erst später beginnt", () => {
    expect(kursAm(KURSE, "2023-01-31")).toBeNull();
  });
});

const FUNDAMENTALS = {
  Financials: {
    Balance_Sheet: {
      yearly: {
        "2022-12-31": { totalStockholderEquity: 4000, longTermDebt: 1000, cash: 500,
                        commonStockSharesOutstanding: 1000, totalAssets: 9000,
                        totalCurrentAssets: 3000, totalCurrentLiabilities: 1500,
                        filing_date: "2023-03-10" },
        "2023-12-31": { totalStockholderEquity: 4500, longTermDebt: 900, cash: 600,
                        commonStockSharesOutstanding: 1000, totalAssets: 9500,
                        totalCurrentAssets: 3400, totalCurrentLiabilities: 1500,
                        filing_date: "2024-03-08" },
      },
    },
    Income_Statement: {
      yearly: {
        "2022-12-31": { totalRevenue: 10000, grossProfit: 3500, operatingIncome: 1200,
                        netIncome: 850, incomeBeforeTax: 1100, incomeTaxExpense: 250,
                        depreciationAndAmortization: 400, filing_date: "2023-03-10" },
        "2023-12-31": { totalRevenue: 11000, grossProfit: 4000, operatingIncome: 1500,
                        netIncome: 1100, incomeBeforeTax: 1400, incomeTaxExpense: 300,
                        depreciationAndAmortization: 420, filing_date: "2024-03-08" },
      },
    },
    Cash_Flow: {
      yearly: {
        "2022-12-31": { totalCashFromOperatingActivities: 1000, capitalExpenditures: 300,
                        dividendsPaid: -200, filing_date: "2023-03-10" },
        "2023-12-31": { totalCashFromOperatingActivities: 1400, capitalExpenditures: 350,
                        dividendsPaid: -250, filing_date: "2024-03-08" },
      },
    },
  },
  Earnings: {
    Annual: Object.fromEntries(
      [0.80, 0.85, 0.92, 0.88, 0.97, 1.05, 1.10].map((eps, i) => [`${2017 + i}-12-31`, { epsActual: eps }]),
    ),
    History: {},
  },
  Highlights: { PERatio: 99 },
  Valuation: { ForwardPE: 99 },
};

const TAGESKURSE = (() => {
  const aus: { date: string; close: number }[] = [];
  for (let jahr = 2023; jahr <= 2024; jahr++) {
    for (let m = 1; m <= 12; m++) {
      aus.push({ date: `${jahr}-${String(m).padStart(2, "0")}-15`, close: 20 + m * 0.5 });
    }
  }
  return aus;
})();

describe("reiheFuerTitel", () => {
  const stichtage = ["2023-06-30", "2023-12-31", "2024-06-30"];
  const reihe = reiheFuerTitel("TEST.SW", FUNDAMENTALS, TAGESKURSE, stichtage, "Industrials");

  it("liefert eine Zeile je Stichtag mit Datengrundlage", () => {
    expect(reihe.map((r) => r.datum)).toEqual(stichtage);
  });

  it("die Scores ändern sich, wenn ein neuer Abschluss veröffentlicht wird", () => {
    // Im Juni 2023 trägt der Abschluss 2022, im Juni 2024 der von 2023.
    const juni23 = reihe.find((r) => r.datum === "2023-06-30")!;
    const juni24 = reihe.find((r) => r.datum === "2024-06-30")!;
    expect(juni23.qualitaet).not.toBe(juni24.qualitaet);
  });

  it("hält fest, worauf die Zeile beruht", () => {
    for (const r of reihe) {
      expect(r.belegt).toBeGreaterThan(0);
      expect(r.meldefristTage).toBe(90);
      expect(r.kurs).not.toBeNull();
    }
  });

  it("lässt Stichtage ohne Datengrundlage aus, statt Nullen zu schreiben", () => {
    const frueh = reiheFuerTitel("TEST.SW", FUNDAMENTALS, TAGESKURSE, ["2016-06-30"]);
    expect(frueh).toEqual([]);
  });

  it("schreibt bei dünner Kursreihe KEINEN Timing-Wert", () => {
    // `TAGESKURSE` hat einen Kurs je Monat. Daraus einen Timing-Score zu
    // bilden hiesse, aus dreizehn Punkten einen RSI und ein Momentum zu
    // behaupten. Die Zeile bleibt an dieser Stelle leer — das ist die
    // Aussage, nicht ein Mangel.
    for (const r of reihe) {
      expect(r.timing).toBeNull();
      expect(r.regime).toBe("default");
    }
  });
});

describe("reiheFuerTitel mit täglichen Kursen", () => {
  // Dieselbe Bilanz, aber eine echte Tagesreihe: Erst damit ist der dritte
  // Score überhaupt berechenbar.
  const TAEGLICH = (() => {
    const aus: { date: string; close: number }[] = [];
    const d = new Date("2022-01-03T00:00:00Z");
    let i = 0;
    while (d < new Date("2024-07-01T00:00:00Z")) {
      const wd = d.getUTCDay();
      if (wd !== 0 && wd !== 6) {
        aus.push({ date: d.toISOString().slice(0, 10), close: 20 * 1.001 ** i++ });
      }
      d.setUTCDate(d.getUTCDate() + 1);
    }
    return aus;
  })();

  const reihe = reiheFuerTitel("TEST.SW", FUNDAMENTALS, TAEGLICH, ["2023-12-29", "2024-06-28"], "Industrials");

  it("füllt Timing und Regime aus der Kursreihe", () => {
    for (const r of reihe) {
      expect(r.timing).not.toBeNull();
      expect(r.timing!).toBeGreaterThanOrEqual(0);
      expect(r.timing!).toBeLessThanOrEqual(100);
      expect(r.regime).toBe("bull_trend");
    }
  });

  it("hält die fehlende Blasen-Komponente in der Abdeckung fest", () => {
    // 0.90 statt 1.0 — der LPPL-Wert ist rückwirkend nicht rekonstruierbar.
    // Ohne diese Zahl sähe die Reihe später aus wie eine vollständige Messung.
    for (const r of reihe) expect(r.timingAbdeckung).toBe(0.9);
  });

  it("liefert einen Bewertungs-Score OHNE das rückwirkend fehlende PEG", () => {
    // Der Fehler der ersten Fassung: `berechneBewertung().score` verlangt 60 %
    // Abdeckung, das PEG trägt 0.45 davon und ist rückwirkend nicht zu haben.
    // FCF-Rendite und Dividende ergeben 0.55 — der Score fiel für jeden Titel
    // ausser Finanzwerten auf null, und alles, was auf dieser Spalte gemessen
    // wurde, galt nur für Banken und Versicherer.
    for (const r of reihe) {
      expect(r.bewertung, `Stichtag ${r.datum}`).not.toBeNull();
    }
  });

  it("schreibt die Roh-Kennzahlen mit, damit eine Formeländerung keinen neuen Abruf kostet", () => {
    for (const r of reihe) {
      expect(r.fassung).toBe(2);
      expect(r.kennzahlen).not.toBeNull();
      // Die Eingangsgrössen beider Scores, und keine Texte.
      expect(Object.keys(r.kennzahlen!)).toEqual(
        expect.arrayContaining(["roic", "kgv", "fcfRendite", "dividendenrendite"]));
      expect(r.kennzahlen).not.toHaveProperty("sektor");
      for (const v of Object.values(r.kennzahlen!)) {
        expect(v === null || typeof v === "number").toBe(true);
      }
    }
  });

  it("bewertet jeden Stichtag mit dem Kursstand von damals", () => {
    const [dez, juni] = reihe;
    expect(dez.kurs).not.toBe(juni.kurs);
    expect(dez.kurs!).toBeLessThan(juni.kurs!);
  });

  it("braucht Kurse VOR dem ersten Stichtag, sonst bleibt das Timing leer", () => {
    // Der Grund für den Kursvorlauf im Admin-Lauf: Timing und Regime schauen
    // 400 Kalendertage zurück. Beginnt die Kursreihe erst am Stichtag, ist das
    // Fenster leer — und die ersten rund 15 Monate jedes Titels hätten still
    // kein Timing.
    const ersterStichtag = "2022-01-31";
    const ohneVorlauf = TAEGLICH.filter((k) => k.date >= "2022-01-03");
    const kurz = reiheFuerTitel("TEST.SW", FUNDAMENTALS, ohneVorlauf, [ersterStichtag], "Industrials");
    expect(kurz[0]?.timing ?? null).toBeNull();

    // Mit Vorlauf trägt derselbe Stichtag einen Wert.
    const mitVorlauf = [
      ...(() => {
        const aus: { date: string; close: number }[] = [];
        const d = new Date("2020-06-01T00:00:00Z");
        let i = 0;
        while (d < new Date("2022-01-03T00:00:00Z")) {
          const wd = d.getUTCDay();
          if (wd !== 0 && wd !== 6) aus.push({ date: d.toISOString().slice(0, 10), close: 18 * 1.0005 ** i++ });
          d.setUTCDate(d.getUTCDate() + 1);
        }
        return aus;
      })(),
      ...ohneVorlauf,
    ];
    const lang = reiheFuerTitel("TEST.SW", FUNDAMENTALS, mitVorlauf, [ersterStichtag], "Industrials");
    expect(lang[0].timing).not.toBeNull();
  });
});

describe("rekonstruiere", () => {
  it("meldet übersprungene Titel, statt sie stillschweigend auszulassen", async () => {
    const meldungen: string[] = [];
    const r = await rekonstruiere(
      [{ ticker: "GUT.SW", sektor: null }, { ticker: "OHNE.SW", sektor: null }],
      "2023-06-01", "2024-06-30",
      async (t) => (t === "GUT.SW" ? FUNDAMENTALS : null),
      async () => TAGESKURSE,
      (m) => meldungen.push(m),
    );
    expect(r.titel).toBe(1);
    expect(r.zeilen).toBeGreaterThan(0);
    expect(r.uebersprungen.some((u) => u.startsWith("OHNE.SW"))).toBe(true);
    expect(r.meldungen.join(" ")).toContain("OHNE.SW");
  });

  it("überspringt einen Titel ohne Kurse, statt ihn ohne Bewertung zu schreiben", async () => {
    const r = await rekonstruiere(
      [{ ticker: "STUMM.SW", sektor: null }],
      "2023-06-01", "2024-06-30",
      async () => FUNDAMENTALS,
      async () => [],
      () => {},
    );
    expect(r.zeilen).toBe(0);
    expect(r.uebersprungen[0]).toContain("keine Kurse");
  });

  it("meldet die Zahl der Uebersprungenen waehrend des Laufs, nicht erst am Ende", async () => {
    // Vorher stand in der Fortschrittsmeldung nur «X/Y Titel, Z Zeilen». Ein
    // Lauf, der reihenweise scheiterte, sah damit aus wie einer, der arbeitet
    // — sichtbar wurde es erst nach Stunden.
    const meldungen: string[] = [];
    await rekonstruiere(
      Array.from({ length: 10 }, (_, i) => ({ ticker: `T${i}.SW`, sektor: null })),
      "2023-06-01", "2024-06-30",
      async () => null,
      async () => TAGESKURSE,
      (m) => meldungen.push(m),
    );
    const fortschritt = meldungen.filter((m) => m.startsWith("Fortschritt"));
    expect(fortschritt.length).toBeGreaterThan(0);
    expect(fortschritt.at(-1)).toContain("übersprungen");
  });

  it("setzt fort, statt bereits erfasste Titel erneut zu holen", async () => {
    // Der Fall aus der Praxis: Ein Lauf ueber viele Titel bleibt in der Mitte
    // stehen. Ohne Fortsetzen holt der zweite Versuch alles noch einmal — mit
    // demselben Zeitaufwand und demselben Risiko, an derselben Stelle zu
    // scheitern.
    const geholt: string[] = [];
    const r = await rekonstruiere(
      [{ ticker: "A.SW", sektor: null }, { ticker: "B.SW", sektor: null }, { ticker: "C.SW", sektor: null }],
      "2023-06-01", "2024-06-30",
      async (t) => { geholt.push(t); return FUNDAMENTALS; },
      async () => TAGESKURSE,
      () => {},
      undefined,
      new Set(["A.SW", "B.SW"]),
    );
    expect(geholt).toEqual(["C.SW"]);
    expect(r.bereitsVorhanden).toBe(2);
    expect(r.titel).toBe(1);
  });

  it("nimmt je Lauf hoechstens das Haeppchen und meldet den Rest", async () => {
    // Ein Lauf ueber alle offenen Titel stirbt in der Zielumgebung, bevor er
    // fertig wird. Kleine Haeppchen kommen durch und hinterlassen ihr
    // Ergebnis; die Meldung sagt, dass nachgelegt werden muss.
    const geholt: string[] = [];
    const r = await rekonstruiere(
      Array.from({ length: 7 }, (_, i) => ({ ticker: `T${i}.SW`, sektor: null })),
      "2023-06-01", "2024-06-30",
      async (t) => { geholt.push(t); return FUNDAMENTALS; },
      async () => TAGESKURSE,
      () => {},
      undefined,
      new Set(),
      3,
    );
    expect(geholt).toEqual(["T0.SW", "T1.SW", "T2.SW"]);
    expect(r.nochOffen).toBe(4);
    expect(r.zuletzt).toBe("T2.SW");
  });

  it("meldet nichts mehr offen, wenn das Haeppchen reicht", async () => {
    const r = await rekonstruiere(
      [{ ticker: "A.SW", sektor: null }],
      "2023-06-01", "2024-06-30",
      async () => FUNDAMENTALS,
      async () => TAGESKURSE,
      () => {},
      undefined,
      new Set(),
      25,
    );
    expect(r.nochOffen).toBe(0);
  });

  it("merkt sich Titel, die keine Reihe liefern koennen", async () => {
    // Der Fall aus der Praxis: 22 der 25 Titel eines Haeppchens waren ETFs.
    // Sie koennen keine Fundamentalreihe haben, blockierten aber den Anfang
    // der Warteschlange — bei jedem Lauf erneut, weil sie nie «erfasst»
    // wurden. Der Lauf drehte sich im Kreis.
    const geholt: string[] = [];
    const r = await rekonstruiere(
      [
        { ticker: "SPY.US", sektor: null, kategorie: "ETF", name: "SPDR S&P 500 ETF" },
        { ticker: "NESN.SW", sektor: null, kategorie: "Dividendenaktien", name: "Nestle" },
        { ticker: "QQQ.US", sektor: null, kategorie: "ETF", name: "Invesco QQQ Trust" },
      ],
      "2023-06-01", "2024-06-30",
      async (t) => { geholt.push(t); return t === "NESN.SW" ? FUNDAMENTALS : { Financials: {}, Earnings: {} }; },
      async () => TAGESKURSE,
      () => {},
    );
    // Alle drei werden geholt — vorab lassen sie sich nicht unterscheiden.
    // Entscheidend ist, dass die beiden ETFs DANACH vermerkt werden, damit
    // sie beim naechsten Lauf nicht wieder vorn stehen.
    expect(geholt.length).toBe(3);
    expect(r.ohneReihe).toEqual(["SPY.US", "QQQ.US"]);
  });

  it("holt ohne Bestandsliste weiterhin alles", async () => {
    const geholt: string[] = [];
    const r = await rekonstruiere(
      [{ ticker: "A.SW", sektor: null }, { ticker: "B.SW", sektor: null }],
      "2023-06-01", "2024-06-30",
      async (t) => { geholt.push(t); return FUNDAMENTALS; },
      async () => TAGESKURSE,
      () => {},
    );
    expect(geholt).toEqual(["A.SW", "B.SW"]);
    expect(r.bereitsVorhanden).toBe(0);
  });

  it("faengt einen Fehler je Titel ab, statt den Lauf abzubrechen", async () => {
    const r = await rekonstruiere(
      [{ ticker: "KAPUTT.SW", sektor: null }, { ticker: "GUT.SW", sektor: null }],
      "2023-06-01", "2024-06-30",
      async (t) => { if (t === "KAPUTT.SW") throw new Error("EODHD 500"); return FUNDAMENTALS; },
      async () => TAGESKURSE,
      () => {},
    );
    expect(r.zeilen).toBeGreaterThan(0);
    expect(r.uebersprungen[0]).toContain("EODHD 500");
  });
});

/**
 * Der Stillstand bei 107 von 212.
 *
 * `alleOffen.slice(0, 25)` nimmt immer dieselben ersten 25 Titel. Scheitern
 * die, verarbeitet jeder weitere Lauf exakt dieselben — der Fortschritt bleibt
 * stehen, und zwar ohne dass irgendwo ein Fehler sichtbar würde. Bisher wurde
 * nur der Fall «kann keine Reihe haben» vermerkt (#262); eine
 * Zeitüberschreitung fiel durch jedes Raster.
 */
describe("rekonstruiere: gescheiterte Titel blockieren die Schlange nicht", () => {
  const zwanzig = Array.from({ length: 20 }, (_, i) => ({ ticker: `F${i}.SW`, sektor: null }));
  const frisch = Array.from({ length: 5 }, (_, i) => ({ ticker: `N${i}.SW`, sektor: null }));

  it("vermerkt jeden gescheiterten Abruf mit Grund", async () => {
    const r = await rekonstruiere(
      [{ ticker: "ZEIT.SW", sektor: null }, { ticker: "LEER.SW", sektor: null },
       { ticker: "GUT.SW", sektor: null }],
      "2023-06-01", "2024-06-30",
      async (t) => {
        if (t === "ZEIT.SW") throw new Error("The operation was aborted due to timeout");
        if (t === "LEER.SW") return null;
        return FUNDAMENTALS;
      },
      async () => TAGESKURSE,
      () => {},
    );
    expect(r.fehlversuche.map((f) => f.ticker).sort()).toEqual(["LEER.SW", "ZEIT.SW"]);
    expect(r.fehlversuche.find((f) => f.ticker === "ZEIT.SW")!.grund).toContain("timeout");
    expect(r.fehlversuche.find((f) => f.ticker === "LEER.SW")!.grund).toBe("keine Fundamentaldaten");
    // Der Titel, der durchkam, gehoert NICHT dazu — sein Vermerk darf weg.
    expect(r.geglueckt).toEqual(["GUT.SW"]);
  });

  it("stellt vermerkte Titel hinten an, statt sie erneut vorn zu nehmen", async () => {
    // Genau der Fall aus der Praxis: 20 gescheiterte Titel stehen vor 5 frischen.
    // Ohne Nachrang nimmt das Haeppchen zu 5 wieder nur die gescheiterten.
    const geholt: string[] = [];
    await rekonstruiere(
      [...zwanzig, ...frisch],
      "2023-06-01", "2024-06-30",
      async (t) => { geholt.push(t); return FUNDAMENTALS; },
      async () => TAGESKURSE,
      () => {}, undefined, new Set(), 5,
      new Map(zwanzig.map((t) => [t.ticker, 1])),
    );
    expect(geholt).toEqual(frisch.map((t) => t.ticker));
  });

  it("nimmt sie wieder dran, sobald die uebrigen durch sind", async () => {
    // Nachrang ist KEIN Ausschluss. Eine Zeitueberschreitung sagt nichts ueber
    // den Titel — er muss seine zweite Chance bekommen.
    const geholt: string[] = [];
    await rekonstruiere(
      zwanzig,
      "2023-06-01", "2024-06-30",
      async (t) => { geholt.push(t); return FUNDAMENTALS; },
      async () => TAGESKURSE,
      () => {}, undefined, new Set(), 5,
      new Map(zwanzig.map((t) => [t.ticker, 3])),
    );
    expect(geholt).toHaveLength(5);
  });

  it("sortiert die selten Gescheiterten vor die hartnaeckigen", async () => {
    const geholt: string[] = [];
    await rekonstruiere(
      [{ ticker: "OFT.SW", sektor: null }, { ticker: "SELTEN.SW", sektor: null }],
      "2023-06-01", "2024-06-30",
      async (t) => { geholt.push(t); return FUNDAMENTALS; },
      async () => TAGESKURSE,
      () => {}, undefined, new Set(), 1,
      new Map([["OFT.SW", 7], ["SELTEN.SW", 1]]),
    );
    expect(geholt).toEqual(["SELTEN.SW"]);
  });

  it("sagt es, wenn KEIN Titel des Haeppchens durchkam", async () => {
    // Ein Lauf, in dem nichts gelingt, sah bisher aus wie ein langsamer.
    const meldungen: string[] = [];
    const r = await rekonstruiere(
      frisch,
      "2023-06-01", "2024-06-30",
      async () => null,
      async () => TAGESKURSE,
      (m) => meldungen.push(m),
    );
    expect(r.geglueckt).toEqual([]);
    expect(r.meldungen.join(" ")).toContain("KEIN Titel");
    expect(r.fehlversuche).toHaveLength(5);
  });

  it("laesst die Reihenfolge unberuehrt, wenn nichts vermerkt ist", async () => {
    const geholt: string[] = [];
    await rekonstruiere(
      frisch,
      "2023-06-01", "2024-06-30",
      async (t) => { geholt.push(t); return FUNDAMENTALS; },
      async () => TAGESKURSE,
      () => {},
    );
    expect(geholt).toEqual(frisch.map((t) => t.ticker));
  });
});
