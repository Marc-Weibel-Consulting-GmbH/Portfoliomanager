/**
 * Die Gewichtssuche.
 *
 * Ein Optimizer, der auf zufälligen Zahlen einen «Gewinner» findet, sieht
 * genauso aus wie einer, der etwas gelernt hat — deshalb prüfen die Tests
 * beides: dass ein eingebauter Zusammenhang gefunden WIRD, und dass ohne
 * Zusammenhang nichts Belastbares herauskommt.
 */

import { describe, it, expect } from "vitest";
import {
  beobachtungenAusReihe,
  bewerteGewichte,
  gewichtsRaster,
  zeitSchnitt,
  sucheGewichte,
  KAUF_SCHWELLE,
  MIN_SIGNALE,
  MIN_UEBERANPASSUNG,
  IN_SAMPLE_ANTEIL,
  type ReihenZeile,
} from "./signalGewichteBacktest";
import { rundlaufKostenPct } from "./backtestKennzahlen";
import { DEFAULT_SIGNAL_GEWICHTE } from "./dreiScoreSignal";

/** Reproduzierbare Pseudozufallszahlen — `Math.random` machte den Test launisch. */
function lcg(saat: number) {
  let s = saat >>> 0;
  return () => {
    s = (s * 1_664_525 + 1_013_904_223) >>> 0;
    return s / 4_294_967_296;
  };
}

/** Monatsletzte ab `startJahr`. */
function stichtage(n: number, startJahr = 2016): string[] {
  const aus: string[] = [];
  for (let i = 0; i < n; i++) {
    const jahr = startJahr + Math.floor(i / 12);
    const monat = (i % 12) + 1;
    const letzter = new Date(Date.UTC(jahr, monat, 0));
    aus.push(letzter.toISOString().slice(0, 10));
  }
  return aus;
}

describe("beobachtungenAusReihe", () => {
  const reihe: ReihenZeile[] = [
    { ticker: "A", datum: "2024-01-31", qualitaet: 70, bewertung: 60, timing: 50, regime: "bull_trend", kurs: 100 },
    { ticker: "A", datum: "2024-02-29", qualitaet: 71, bewertung: 61, timing: 51, regime: "bull_trend", kurs: 110 },
    { ticker: "A", datum: "2024-03-31", qualitaet: 72, bewertung: 62, timing: 52, regime: "bull_trend", kurs: 99 },
  ];

  it("rechnet die Vorwärtsrendite zum nächsten Stichtag", () => {
    const b = beobachtungenAusReihe(reihe);
    expect(b).toHaveLength(2);
    expect(b[0].vorwaertsRendite).toBeCloseTo(10, 6);
    expect(b[1].vorwaertsRendite).toBeCloseTo(-10, 6);
  });

  it("trägt die Scores des Stichtags, nicht die des Zielmonats", () => {
    // Sonst flösse die Zukunft in die Eingangsgrössen — der Fehler, gegen den
    // die ganze Punkt-in-Zeit-Rechnung gebaut ist.
    const b = beobachtungenAusReihe(reihe);
    expect(b[0].qualitaet).toBe(70);
    expect(b[0].timing).toBe(50);
  });

  it("lässt ein Paar aus, wenn dazwischen Monate fehlen", () => {
    // Eine Lücke in der Reihe hiesse sonst: Rendite über vier Monate, gemessen
    // und annualisiert, als wären es dreissig Tage.
    const mitLuecke: ReihenZeile[] = [
      { ...reihe[0] },
      { ...reihe[0], datum: "2024-07-31", kurs: 150 },
      { ...reihe[0], datum: "2024-08-31", kurs: 160 },
    ];
    const b = beobachtungenAusReihe(mitLuecke);
    expect(b.map((x) => x.datum)).toEqual(["2024-07-31"]);
  });

  it("verträgt fehlende Kurse und leere Reihen", () => {
    expect(beobachtungenAusReihe([])).toEqual([]);
    expect(beobachtungenAusReihe([{ ...reihe[0], kurs: null }])).toEqual([]);
    expect(beobachtungenAusReihe([{ ...reihe[0], kurs: 0 }, reihe[1]])).toEqual([]);
  });

  it("kommt mit einer unsortierten Reihe zurecht", () => {
    const gedreht = [...reihe].reverse();
    expect(beobachtungenAusReihe(gedreht)).toEqual(beobachtungenAusReihe(reihe));
  });

  it("misst über mehrere Monate, wenn ein längerer Horizont verlangt ist", () => {
    const b = beobachtungenAusReihe(reihe, 2);
    expect(b).toHaveLength(1);
    expect(b[0].vorwaertsRendite).toBeCloseTo(-1, 6);
  });
});

describe("gewichtsRaster", () => {
  const raster = gewichtsRaster();

  it("summiert jeden Satz auf 1", () => {
    for (const w of raster) {
      expect(w.qualitaet + w.bewertung + w.timing).toBeCloseTo(1, 6);
    }
  });

  it("lässt keinen Score ganz weg", () => {
    // Gewicht 0 wäre nicht «wegoptimiert», sondern ein anderes Modell.
    for (const w of raster) {
      expect(Math.min(w.qualitaet, w.bewertung, w.timing)).toBeGreaterThanOrEqual(0.05);
    }
  });

  it("bleibt mit 171 Kandidaten überschaubar", () => {
    // Zu viele Versuche erzeugen allein durch ihre Zahl einen Gewinner.
    expect(raster.length).toBe(171);
  });
});

describe("zeitSchnitt", () => {
  const tage = stichtage(50);
  const beob = tage.flatMap((datum) =>
    ["A", "B"].map((ticker) => ({
      ticker, datum, qualitaet: 50, bewertung: 50, timing: 50,
      regime: "default", vorwaertsRendite: 1,
    })),
  );

  it("teilt nach Zeit, nicht nach Zufall", () => {
    const { training, pruefung, trennDatum } = zeitSchnitt(beob);
    expect(trennDatum).not.toBeNull();
    expect(Math.max(...training.map((b) => b.datum.localeCompare(trennDatum!)))).toBeLessThanOrEqual(0);
    expect(Math.min(...pruefung.map((b) => b.datum.localeCompare(trennDatum!)))).toBeGreaterThan(0);
  });

  it("legt denselben Stichtag NIE auf beide Seiten", () => {
    // Sonst lernte die Suche aus der Zukunft anderer Titel desselben Monats.
    const { training, pruefung } = zeitSchnitt(beob);
    const inTraining = new Set(training.map((b) => b.datum));
    expect(pruefung.some((b) => inTraining.has(b.datum))).toBe(false);
  });

  it("hält sich an die 80 Prozent", () => {
    const { training } = zeitSchnitt(beob);
    const anteil = new Set(training.map((b) => b.datum)).size / 50;
    expect(anteil).toBeCloseTo(IN_SAMPLE_ANTEIL, 1);
  });

  it("gibt bei zu wenigen Stichtagen keinen Prüfteil vor", () => {
    const { pruefung, trennDatum } = zeitSchnitt(beob.slice(0, 2));
    expect(trennDatum).toBeNull();
    expect(pruefung).toEqual([]);
  });
});

describe("bewerteGewichte", () => {
  const beob = [
    { ticker: "A", datum: "2024-01-31", qualitaet: 90, bewertung: 90, timing: 90, regime: null, vorwaertsRendite: 5 },
    { ticker: "B", datum: "2024-01-31", qualitaet: 10, bewertung: 10, timing: 10, regime: null, vorwaertsRendite: 5 },
  ];
  const gleich = { default: { qualitaet: 1 / 3, bewertung: 1 / 3, timing: 1 / 3 } };

  it("zieht die Handelskosten ab", () => {
    const a = bewerteGewichte(beob, gleich);
    expect(a.signal.mittlereRendite).toBeCloseTo(5 - rundlaufKostenPct(), 6);
  });

  it("belastet auch den Vergleichsmassstab mit Kosten", () => {
    // «Alles kaufen» ohne Kosten zu rechnen würde dem Signal einen Vorteil
    // verschaffen, den es in der Wirklichkeit nicht hat.
    const a = bewerteGewichte(beob, gleich);
    expect(a.basis.mittlereRendite).toBeCloseTo(5 - rundlaufKostenPct(), 6);
  });

  it("nimmt nur Titel über der Kaufschwelle ins Signal", () => {
    const a = bewerteGewichte(beob, gleich);
    expect(a.signal.n).toBe(1);
    expect(a.basis.n).toBe(2);
    expect(a.signalAnteil).toBeCloseTo(0.5, 6);
  });

  it("übergeht Beobachtungen, für die kein Score zustande kommt", () => {
    const ohne = [{ ...beob[0], qualitaet: null, bewertung: null, timing: null }];
    const a = bewerteGewichte(ohne, gleich);
    expect(a.signal.n).toBe(0);
    expect(a.basis.n).toBe(1); // Die Rendite gibt es trotzdem.
  });

  it("benutzt die Kaufschwelle des Notenbandes", () => {
    expect(KAUF_SCHWELLE).toBe(60);
  });
});

/**
 * Eine Welt, in der NUR das Timing die Rendite erklärt.
 *
 * Wenn die Suche hier nicht das Timing hochgewichtet, findet sie auch in echten
 * Daten nichts. Der Test misst nicht die Qualität des Marktmodells, sondern ob
 * die Mechanik überhaupt funktioniert.
 */
function weltMitTimingEffekt(saat = 7, effekt = 0.12): ReihenZeile[][] {
  const zufall = lcg(saat);
  const tage = stichtage(72);
  const reihen: ReihenZeile[][] = [];

  for (let n = 0; n < 60; n++) {
    const reihe: ReihenZeile[] = [];
    let kurs = 100;
    for (const datum of tage) {
      const timing = zufall() * 100;
      const qualitaet = zufall() * 100;
      const bewertung = zufall() * 100;
      reihe.push({ ticker: `T${n}`, datum, qualitaet, bewertung, timing, regime: "default", kurs });
      // Der eingebaute Zusammenhang: hoher Timing-Score → höhere Folgerendite.
      // `effekt = 0` ergibt dieselbe Welt ohne jeden Zusammenhang.
      const rendite = (timing - 50) * effekt + (zufall() - 0.5) * 6;
      kurs = kurs * (1 + rendite / 100);
    }
    reihen.push(reihe);
  }
  return reihen;
}

describe("sucheGewichte", () => {
  const beob = weltMitTimingEffekt().flatMap((r) => beobachtungenAusReihe(r));

  it("findet den eingebauten Zusammenhang", () => {
    const e = sucheGewichte(beob, DEFAULT_SIGNAL_GEWICHTE.default);
    expect(e.hinweis).toBeNull();
    // Timing muss das schwerste Gewicht bekommen — es ist der einzige Faktor,
    // der in dieser Welt etwas erklärt.
    expect(e.gewichte.timing).toBeGreaterThan(e.gewichte.qualitaet);
    expect(e.gewichte.timing).toBeGreaterThan(e.gewichte.bewertung);
  });

  it("überträgt sich auf den ungesehenen Prüfzeitraum", () => {
    const e = sucheGewichte(beob, DEFAULT_SIGNAL_GEWICHTE.default);
    expect(e.pruefung.signal.sharpe).toBeGreaterThan(0);
    // Ein echter Zusammenhang übersteht den Zeitschnitt; ein angepasster nicht.
    expect(e.ueberanpassung).toBeLessThan(2);
  });

  it("schlägt «alles kaufen» — sonst wäre die Auswahl wertlos", () => {
    const e = sucheGewichte(beob, DEFAULT_SIGNAL_GEWICHTE.default);
    expect(e.pruefung.signal.mittlereRendite).toBeGreaterThan(e.pruefung.basis.mittlereRendite);
  });

  it("misst die heutigen Gewichte mit derselben Elle", () => {
    const e = sucheGewichte(beob, DEFAULT_SIGNAL_GEWICHTE.default);
    expect(e.heute).not.toBeNull();
    expect(e.heute!.gewichte).toEqual(DEFAULT_SIGNAL_GEWICHTE.default);
    // In dieser Welt muss der gefundene Satz die Handgewichte schlagen.
    expect(e.training.signal.sharpe).toBeGreaterThan(e.heute!.training.signal.sharpe);
  });

  it("verweigert ein Ergebnis, wenn zu wenige Signale zustande kommen", () => {
    const e = sucheGewichte(beob.slice(0, 50));
    expect(e.hinweis).toContain(String(MIN_SIGNALE));
    expect(e.pruefung.signal.n).toBe(0);
  });

  it("verweigert ein Ergebnis ohne Zeitschnitt", () => {
    const einTag = beob.filter((b) => b.datum === beob[0].datum);
    expect(sucheGewichte(einTag).hinweis).toContain("Zeitschnitt");
  });

  it("verträgt eine leere Eingabe", () => {
    const e = sucheGewichte([]);
    expect(e.hinweis).not.toBeNull();
    expect(e.taugt).toBe(false);
    expect(e.training.signal.n).toBe(0);
  });

  it("erklärt den Fund für tauglich, wenn er die Prüfung besteht", () => {
    const e = sucheGewichte(beob, DEFAULT_SIGNAL_GEWICHTE.default);
    expect(e.taugt).toBe(true);
  });

  it("setzt einen Vorbehalt, wenn der Prüfzeitraum viel freundlicher war als das Training", () => {
    // Aus der Praxis: Verhältnis 0.53 bei einem als übernehmbar gemeldeten
    // Satz. Die erste Fassung der Prüfung sah darin nichts — sie fragte nur
    // nach dem umgekehrten Fall. Ein Fund, der ausserhalb seines Trainings
    // doppelt so gut läuft, hat aber kaum ein robustes Muster gefunden.
    const schwach = weltMitTimingEffekt(11, 0.02);
    const stark = weltMitTimingEffekt(11, 0.30);
    // Erste Hälfte der Stichtage aus der schwachen, zweite aus der starken Welt.
    const alle = [...schwach, ...stark].flatMap((r) => beobachtungenAusReihe(r));
    const daten = [...new Set(alle.map((b) => b.datum))].sort();
    const grenze = daten[Math.floor(daten.length * 0.8) - 1];
    const gemischt = [
      ...schwach.flatMap((r) => beobachtungenAusReihe(r)).filter((b) => b.datum <= grenze),
      ...stark.flatMap((r) => beobachtungenAusReihe(r)).filter((b) => b.datum > grenze),
    ];

    const e = sucheGewichte(gemischt, DEFAULT_SIGNAL_GEWICHTE.default);
    expect(e.ueberanpassung).toBeLessThan(MIN_UEBERANPASSUNG);
    expect(e.taugt).toBe(true);          // kein Ausschluss …
    expect(e.hinweis).toContain("Vorbehalt");  // … aber benannt
  });
});

/**
 * Die wichtigste Absicherung des Moduls.
 *
 * Eine Rastersuche liefert IMMER einen Gewinner — 171 Kandidaten, einer ist der
 * beste. Auf reinem Rauschen findet dieselbe Suche denselben Gewichtssatz wie
 * in der Welt mit Zusammenhang. Der Unterschied steht nicht in den Gewichten,
 * sondern in den Kennzahlen. Wer nur die Gewichte anschaut, übernimmt Rauschen.
 */
describe("sucheGewichte auf reinem Rauschen", () => {
  const rauschen = weltMitTimingEffekt(7, 0).flatMap((r) => beobachtungenAusReihe(r));
  const e = sucheGewichte(rauschen, DEFAULT_SIGNAL_GEWICHTE.default);

  it("findet trotzdem einen «besten» Gewichtssatz", () => {
    // Nicht der Fehler — die Eigenschaft jeder Rastersuche. Sie muss nur
    // benannt sein.
    expect(e.gewichte.qualitaet + e.gewichte.bewertung + e.gewichte.timing).toBeCloseTo(1, 6);
    expect(e.training.signal.n).toBeGreaterThanOrEqual(MIN_SIGNALE);
  });

  it("erklärt ihn aber ausdrücklich für nicht übernehmbar", () => {
    expect(e.taugt).toBe(false);
    expect(e.hinweis).toContain("Nicht übernehmen");
  });

  it("nennt den Grund: die Auswahl schlägt «alles kaufen» nicht", () => {
    expect(e.pruefung.signal.mittlereRendite)
      .toBeLessThanOrEqual(e.pruefung.basis.mittlereRendite);
    expect(e.hinweis).toContain("alles kaufen");
  });

  it("zeigt, dass die Handelskosten allein schon Geld kosten", () => {
    // Bei Monatshorizont trägt jedes Signal einen vollen Rundlauf. Ohne
    // Zusammenhang bleibt die Rendite deshalb systematisch negativ — das ist
    // die Messlatte, die ein echtes Signal überspringen muss.
    expect(e.pruefung.basis.mittlereRendite).toBeLessThan(0);
    expect(e.pruefung.signal.sharpe).toBeLessThan(0);
  });
});
