/**
 * Qualität, Bewertung und Timing — drei Scores statt einem.
 *
 * Umsetzung von `design/KONZEPT_SCORE_DREITEILUNG.md`.
 *
 * Der bisherige «Qualitäts-Score» (`server/scoring.ts`) enthält keinen einzigen
 * Qualitätsfaktor. Abgrenzungstest: Ein Faktor gehört in einen Qualitätsscore,
 * wenn er sich *nicht* ändert, sobald allein der Kurs sich ändert. Unter diesem
 * Test verlassen alle neun heutigen Faktoren den Score — sie messen Bewertung,
 * vergangene Kursentwicklung oder Kursrisiko.
 *
 * Belegfall ABB: Score 31 «schwach», getragen zu 70 % von Dividendenrendite
 * 1.51 % und KGV 36. Beide sagen dasselbe — teuer. Dieselbe Aktie führt *The
 * Market* mit Piotroski 7 von 9 unter den besten Schweizer Titeln.
 *
 * Aufteilung:
 *
 *   Qualität   Ist das ein gutes Unternehmen?     kursunabhängig
 *   Bewertung  Ist der Preis angemessen?          hoch = günstig
 *   Timing     Ist jetzt der Zeitpunkt?           = bestehender Signal-Score
 *
 * Timing wird hier nicht berechnet: Der Signal-Score erfüllt diese Aufgabe
 * bereits. Was ihm noch fehlt, sind Sharpe und Momentum aus dem alten
 * Qualitätsprofil — ein eigener Schritt.
 */

import { MIN_ABDECKUNG_SCORE } from "./scoreAbdeckung";
import { berechnePiotroski, MIN_KRITERIEN, type PiotroskiErgebnis } from "./piotroski";

// ─── Gemeinsame Bausteine ─────────────────────────────────────────────────────

export interface Teilfaktor {
  name: string;
  /** Rohwert der Kennzahl, `null` wenn nicht verfügbar. */
  wert: number | null;
  /** 0–100, `null` wenn `wert` fehlt. */
  punkte: number | null;
  gewicht: number;
  /** Klartext für die Oberfläche. */
  hinweis: string;
  /**
   * Beruht dieser Faktor auf einer SCHÄTZUNG statt auf berichteten Zahlen?
   *
   * Betrifft heute nur das PEG: Es enthält eine Wachstumserwartung, und
   * Erwartungen von damals sind nirgends gespeichert. Solche Faktoren lassen
   * sich nicht rückwirkend prüfen — der Backtest sieht sie nie. Die Markierung
   * hält fest, welcher Teil der Bewertung gemessen und welcher geglaubt ist.
   */
  geschaetzt?: boolean;
}

export interface TeilScore {
  /** 0–100, oder `null` wenn zu wenig belegt. */
  score: number | null;
  /** Anteil der Gewichtung, der auf Daten beruht (0–1). */
  abdeckung: number;
  faktoren: Teilfaktor[];
  /**
   * Derselbe Score, aber nur aus berichteten Zahlen — ohne Schätzfaktoren.
   *
   * Diese Grösse existiert AUCH in der Vergangenheit und ist deshalb die
   * einzige, gegen die sich ehrlich backtesten lässt. `null`, wenn nach dem
   * Weglassen der Schätzfaktoren zu wenig Gewicht übrig bleibt.
   */
  scoreGemessen?: number | null;
  /** Anteil des belegten Gewichts, der auf Schätzungen beruht (0–1). */
  anteilGeschaetzt?: number;
}

/**
 * Lineare Bewertung zwischen zwei Ankern, begrenzt auf 0–100.
 *
 * `beiSchlecht` und `beiGut` sind die Kennzahlwerte, denen 0 bzw. 100 Punkte
 * entsprechen. `beiGut` darf kleiner sein als `beiSchlecht` — dann ist die
 * Kennzahl invertiert (tiefer ist besser, etwa beim KGV).
 */
export function punkteAus(wert: number | null, beiSchlecht: number, beiGut: number): number | null {
  if (wert === null || !Number.isFinite(wert)) return null;
  if (beiGut === beiSchlecht) return 50;
  const anteil = (wert - beiSchlecht) / (beiGut - beiSchlecht);
  return Math.max(0, Math.min(100, anteil * 100));
}

function baueTeilScore(faktoren: Teilfaktor[]): TeilScore {
  let gewichtet = 0;
  let belegt = 0;
  let gesamt = 0;
  for (const f of faktoren) {
    gesamt += f.gewicht;
    if (f.punkte !== null) {
      gewichtet += f.punkte * f.gewicht;
      belegt += f.gewicht;
    }
  }
  const abdeckung = gesamt > 0 ? belegt / gesamt : 0;

  // Dieselbe Rechnung ohne die Schätzfaktoren. Das Gewicht der weggelassenen
  // verteilt sich auf die übrigen — sonst verglichen wir eine gekürzte Summe
  // mit einer vollen.
  let gewichtetGemessen = 0;
  let belegtGemessen = 0;
  let gesamtGemessen = 0;
  let belegtGeschaetzt = 0;
  for (const f of faktoren) {
    if (f.geschaetzt) {
      if (f.punkte !== null) belegtGeschaetzt += f.gewicht;
      continue;
    }
    gesamtGemessen += f.gewicht;
    if (f.punkte !== null) {
      gewichtetGemessen += f.punkte * f.gewicht;
      belegtGemessen += f.gewicht;
    }
  }
  const abdeckungGemessen = gesamtGemessen > 0 ? belegtGemessen / gesamtGemessen : 0;

  return {
    score: abdeckung < MIN_ABDECKUNG_SCORE ? null : parseFloat((gewichtet / belegt).toFixed(1)),
    abdeckung: parseFloat(abdeckung.toFixed(3)),
    faktoren,
    scoreGemessen: abdeckungGemessen < MIN_ABDECKUNG_SCORE || belegtGemessen === 0
      ? null
      : parseFloat((gewichtetGemessen / belegtGemessen).toFixed(1)),
    anteilGeschaetzt: belegt > 0 ? parseFloat((belegtGeschaetzt / belegt).toFixed(3)) : 0,
  };
}

// ─── Qualität ─────────────────────────────────────────────────────────────────

export interface QualitaetsEingang {
  /** % Return on Invested Capital. */
  roic: number | null;
  /** % Betriebsmarge. */
  betriebsmarge: number | null;
  /** % Bruttomarge. */
  bruttomarge: number | null;
  /** Operativer Cashflow ÷ Nettogewinn. Über 1 heisst gedeckt. */
  ertragsdeckung: number | null;
  /** 0–100, aus `qualityMetricsService.epsStabilityScore`. */
  epsStabilitaet: number | null;
  /** Belegtext zur Stabilität (Raten + Streuung) — erscheint im Faktor-Hinweis. */
  epsStabilitaetHinweis?: string | null;
  /** Nettoverschuldung ÷ EBITDA. */
  netDebtToEbitda: number | null;
}

export interface QualitaetsScore {
  /** 0–100 aus Niveau (60 %) und Richtung (40 %), oder `null`. */
  gesamt: number | null;
  niveau: TeilScore;
  richtung: {
    /** 0–100, aus dem F-Score skaliert. */
    score: number | null;
    /** Roher F-Score 0–9 — die verständlichere Zahl. */
    fScore: number;
    berechenbar: number;
    details: PiotroskiErgebnis;
  };
}

/** Gewichtung zwischen Niveau und Richtung. */
export const ANTEIL_NIVEAU = 0.60;
export const ANTEIL_RICHTUNG = 0.40;

/**
 * Niveau: Ist das Geschäft gut?
 *
 * Die Anker orientieren sich an gängigen Schwellen: ROIC über den Kapitalkosten
 * (rund 8 %) ist die Grenze zur Wertschaffung, 25 % gilt als hervorragend.
 * Die Eigenkapitalrendite fehlt bewusst — sie misst weitgehend dasselbe wie
 * ROIC, reagiert aber zusätzlich auf die Verschuldung, wodurch ein hoch
 * fremdfinanziertes Unternehmen besser erschiene.
 */
export function berechneNiveau(e: QualitaetsEingang): TeilScore {
  const faktoren: Teilfaktor[] = [
    {
      name: "Kapitalrendite (ROIC)",
      wert: e.roic,
      punkte: punkteAus(e.roic, 4, 25),
      gewicht: 0.25,
      // Sekundärbefund der Scoring-Prüfung: Definition NOPAT ÷ (Eigenkapital +
      // Nettoschulden). Bei Netto-Cash-Gesellschaften schrumpft der Nenner —
      // Werte weit über 50 % messen dann die Kasse, nicht das Geschäft. Auf
      // die Punkte wirkt sich das nicht aus (ab 25 % gilt ohnehin die
      // Bestnote), aber der Rohwert braucht die Einordnung.
      hinweis: e.roic === null ? "nicht verfügbar"
        : `${e.roic.toFixed(1)} % — ${e.roic >= 15 ? "deutlich über den Kapitalkosten" : e.roic >= 8 ? "über den Kapitalkosten" : "knapp oder darunter"}`
          + (e.roic >= 50 ? " · Achtung: sehr hohe Werte entstehen meist durch einen kleinen Kapitalnenner (Netto-Cash), Definition NOPAT ÷ (Eigenkapital + Nettoschulden)" : ""),
    },
    {
      name: "Betriebsmarge",
      wert: e.betriebsmarge,
      punkte: punkteAus(e.betriebsmarge, 2, 30),
      gewicht: 0.20,
      hinweis: e.betriebsmarge === null ? "nicht verfügbar" : `${e.betriebsmarge.toFixed(1)} % vom Umsatz`,
    },
    {
      name: "Ertragsqualität",
      wert: e.ertragsdeckung,
      // Unter 1 ist der Gewinn nicht durch Zahlungsströme gedeckt; ab 1.5
      // deutlich übererfüllt. Darüber bringt mehr keinen Zusatznutzen.
      punkte: punkteAus(e.ertragsdeckung, 0.6, 1.5),
      gewicht: 0.20,
      hinweis: e.ertragsdeckung === null ? "nicht verfügbar"
        : e.ertragsdeckung >= 1
          ? `Cashflow deckt den Gewinn ${e.ertragsdeckung.toFixed(2)}-fach`
          : `Cashflow deckt nur ${(e.ertragsdeckung * 100).toFixed(0)} % des Gewinns`,
    },
    {
      name: "Gewinnstabilität",
      wert: e.epsStabilitaet,
      punkte: e.epsStabilitaet === null ? null : Math.max(0, Math.min(100, e.epsStabilitaet)),
      gewicht: 0.15,
      hinweis: e.epsStabilitaet === null
        ? (e.epsStabilitaetHinweis ?? "nicht verfügbar")
        : (e.epsStabilitaet >= 70 ? "sehr gleichmässige Gewinne"
          : e.epsStabilitaet >= 40 ? "schwankende Gewinne" : "stark schwankende Gewinne")
          + (e.epsStabilitaetHinweis ? ` · ${e.epsStabilitaetHinweis}` : ""),
    },
    {
      name: "Verschuldung",
      wert: e.netDebtToEbitda,
      // Invertiert: 0 ist bestens, ab 4 kritisch. Nettoguthaben (negativ)
      // erhält die Bestnote, nicht mehr.
      punkte: punkteAus(e.netDebtToEbitda === null ? null : Math.max(0, e.netDebtToEbitda), 4, 0),
      gewicht: 0.10,
      hinweis: e.netDebtToEbitda === null ? "nicht verfügbar"
        : e.netDebtToEbitda <= 0 ? "Nettoguthaben statt Schulden"
        : `Nettoschulden entsprechen dem ${e.netDebtToEbitda.toFixed(1)}-fachen EBITDA`,
    },
    {
      name: "Bruttomarge",
      wert: e.bruttomarge,
      punkte: punkteAus(e.bruttomarge, 10, 65),
      gewicht: 0.10,
      hinweis: e.bruttomarge === null ? "nicht verfügbar" : `${e.bruttomarge.toFixed(1)} % vom Umsatz`,
    },
  ];
  return baueTeilScore(faktoren);
}

/**
 * Qualität gesamt: Niveau und Richtung.
 *
 * Fehlt eine der beiden Seiten, trägt die andere allein — aber nur, wenn sie
 * selbst belegt ist. Fehlen beide, gibt es keinen Score.
 *
 * `piotroski` wird fertig übergeben, nicht aus Abschlüssen gerechnet: Der Wert
 * entsteht in `qualityMetricsService` aus derselben EODHD-Antwort und liegt im
 * dortigen Cache. Ihn hier nochmals zu berechnen hiesse, die Abschlüsse ein
 * zweites Mal durchzugehen.
 */
export function berechneQualitaet(e: QualitaetsEingang, piotroski: PiotroskiErgebnis): QualitaetsScore {
  const niveau = berechneNiveau(e);
  const details = piotroski;
  const richtungScore = details.hochgerechnet === null
    ? null
    : parseFloat(((details.hochgerechnet / 9) * 100).toFixed(1));

  let gesamt: number | null = null;
  if (niveau.score !== null && richtungScore !== null) {
    gesamt = parseFloat((niveau.score * ANTEIL_NIVEAU + richtungScore * ANTEIL_RICHTUNG).toFixed(1));
  } else if (niveau.score !== null) {
    gesamt = niveau.score;
  } else if (richtungScore !== null) {
    gesamt = richtungScore;
  }

  return {
    gesamt,
    niveau,
    richtung: {
      score: richtungScore,
      fScore: details.score,
      berechenbar: details.berechenbar,
      details,
    },
  };
}

/**
 * Die Qualitäts-Rechnung als Satz — Befund 3 der Scoring-Prüfung.
 *
 * Die sechs angezeigten Faktoren sind nur das NIVEAU (60 %); wer sie
 * aufsummiert, landet neben der Kopfzahl, weil die Richtung (Piotroski,
 * 40 %) als eigene Säule dazukommt. Dieser Text macht die Klammer sichtbar,
 * damit sich der Score aus dem Angezeigten nachrechnen lässt — das ist das
 * Kernversprechen der Erklärdialoge.
 */
export function qualitaetsRechnung(e: {
  gesamt: number | null;
  niveau: number | null;
  richtung: number | null;
  fScore: number | null;
}): string | null {
  if (e.gesamt === null) return null;
  const pn = Math.round(ANTEIL_NIVEAU * 100);
  const pr = Math.round(ANTEIL_RICHTUNG * 100);
  const f = e.fScore !== null ? ` (F-Score ${e.fScore}/9)` : "";
  if (e.niveau !== null && e.richtung !== null) {
    return `Niveau ${e.niveau.toFixed(1)} × ${pn} % + Richtung ${e.richtung.toFixed(1)}${f} × ${pr} % = ${e.gesamt.toFixed(1)}`;
  }
  if (e.niveau !== null) {
    return `Nur das Niveau ist belegt — Qualität = Niveau ${e.niveau.toFixed(1)}`;
  }
  if (e.richtung !== null) {
    return `Nur die Richtung ist belegt — Qualität = Richtung ${e.richtung.toFixed(1)}${f}`;
  }
  return null;
}

// ─── Bewertung ────────────────────────────────────────────────────────────────

export interface BewertungsEingang {
  /** Qualitäts- und volatilitätsbereinigtes PEG. */
  adjustedPeg: number | null;
  /**
   * Warum das PEG fehlt (Ausblendgrund aus `bereinigtesPeg`) — erscheint als
   * Faktor-Hinweis, damit «kein Wert» von «kein Wert, weil …» unterscheidbar ist.
   */
  pegHinweis?: string | null;
  /** Forward-KGV, ersatzweise trailing. */
  kgv: number | null;
  /** % freier Cashflow ÷ Marktkapitalisierung. */
  fcfRendite: number | null;
  /** % Dividendenrendite. */
  dividendenrendite: number | null;
  /** Kurs-Buchwert-Verhältnis. */
  kursBuchwert: number | null;
  /** % EPS-Wachstum der letzten zwölf Monate. */
  epsWachstumTTM?: number | null;
  /** % EPS-Wachstum p. a. über fünf Jahre. */
  epsWachstum5j?: number | null;
  /** Sektor, entscheidet über das Profil. */
  sektor?: string | null;
}

/**
 * Sektoren, in denen der Buchwert die aussagekräftigste Bewertungsgrösse ist.
 *
 * Bei Banken, Versicherern und Immobiliengesellschaften besteht das Vermögen
 * aus bilanzierten Forderungen und Objekten — der Buchwert ist dort eine echte
 * Grösse. Bei einem Softwarehaus steht das Wesentliche gar nicht in der Bilanz;
 * Apple handelt zum 42-fachen, Palantir zum 35-fachen Buchwert. Ein für Value
 * kalibrierter Anker gäbe beiden null Punkte und sagte damit nichts.
 */
export function nutztBuchwert(sektor?: string | null): boolean {
  const s = (sektor || "").toLowerCase();
  return s.includes("financ") || s.includes("bank") || s.includes("insur") ||
    s.includes("versicher") || s.includes("real estate") || s.includes("immobilien");
}

/**
 * Wachstumsrichtung: beschleunigt oder verlangsamt sich das Gewinnwachstum?
 *
 * Differenz in Prozentpunkten zwischen dem Wachstum der letzten zwölf Monate
 * und dem Fünfjahresschnitt. Beide Werte liegen in `qualityMetricsService`
 * bereits vor.
 *
 * Das ist keine Bewertungskennzahl, sondern ein Verlässlichkeitsmass für das
 * PEG: Dessen Nenner ist das Wachstum. Schrumpft der Nenner, steigt das PEG,
 * ohne dass sich der Preis bewegt hat. Ein PEG von 0.45 bei nachlassendem
 * Wachstum ist etwas anderes als dasselbe PEG bei anziehendem.
 */
export function wachstumsFaktor(ttm?: number | null, fuenfJahre?: number | null): number {
  if (ttm == null || fuenfJahre == null || !Number.isFinite(ttm) || !Number.isFinite(fuenfJahre)) {
    return 1;
  }
  const differenz = ttm - fuenfJahre;
  return Math.max(0.8, Math.min(1.1, 1 + differenz / 100));
}

/**
 * KGV als Deckel statt als Summand.
 *
 * Ein tiefes PEG bei sehr hohem KGV heisst nicht «günstig», sondern «günstig,
 * FALLS das Wachstum hält». Der Markt hat dann viele Jahre Wachstum
 * vorweggenommen; bleibt es aus, ist der Rückschlag gross. Diese Asymmetrie
 * kann das PEG nicht ausdrücken — es kennt nur das Verhältnis, nicht die
 * Fallhöhe.
 *
 * Der Deckel begrenzt deshalb, was ein Titel trotz gutem PEG erreichen kann.
 * Bis KGV 30 greift er nicht.
 */
export function kgvDeckel(kgv: number | null): number {
  if (kgv === null || !Number.isFinite(kgv) || kgv <= 0) return 100;
  if (kgv <= 30) return 100;
  if (kgv <= 50) return 100 - ((kgv - 30) / 20) * 40;   // 100 → 60
  if (kgv <= 80) return 60 - ((kgv - 50) / 30) * 25;    // 60 → 35
  return 25;
}

/**
 * Bewertung: Ist der Preis angemessen?
 *
 * **Hoch heisst günstig.** Das ist die entscheidende Leseregel und muss in der
 * Oberfläche ausdrücklich dabeistehen, sonst liest sich «Bewertung 85» als
 * «teuer».
 *
 * Zwei Profile: Für Banken, Versicherer und Immobilien trägt der Buchwert; für
 * alle übrigen das PEG, gedeckelt durch das absolute KGV.
 */
export function berechneBewertung(e: BewertungsEingang): TeilScore {
  const dividende: Teilfaktor = {
    name: "Dividendenrendite",
    wert: e.dividendenrendite,
    punkte: punkteAus(e.dividendenrendite, 0, 5),
    gewicht: 0,
    hinweis: e.dividendenrendite === null ? "nicht verfügbar" : `${e.dividendenrendite.toFixed(2)} %`,
  };

  if (nutztBuchwert(e.sektor)) {
    const faktoren: Teilfaktor[] = [
      {
        name: "Kurs-Buchwert",
        wert: e.kursBuchwert,
        punkte: punkteAus(e.kursBuchwert === null || e.kursBuchwert <= 0 ? null : e.kursBuchwert, 3, 0.7),
        gewicht: 0.35,
        hinweis: e.kursBuchwert === null ? "nicht verfügbar" : `${e.kursBuchwert.toFixed(2)}-facher Buchwert`,
      },
      {
        name: "KGV",
        wert: e.kgv,
        punkte: punkteAus(e.kgv === null || e.kgv <= 0 ? null : e.kgv, 20, 7),
        gewicht: 0.30,
        hinweis: e.kgv === null ? "nicht verfügbar" : `${e.kgv.toFixed(1)}-facher Jahresgewinn`,
      },
      { ...dividende, gewicht: 0.35 },
    ];
    return baueTeilScore(faktoren);
  }

  const faktor = wachstumsFaktor(e.epsWachstumTTM, e.epsWachstum5j);
  const pegRoh = punkteAus(e.adjustedPeg === null || e.adjustedPeg <= 0 ? null : e.adjustedPeg, 3, 0.8);
  const pegPunkte = pegRoh === null ? null : Math.max(0, Math.min(100, pegRoh * faktor));

  const richtungsText = faktor > 1.02 ? " · Wachstum zieht an"
    : faktor < 0.98 ? " · Wachstum lässt nach" : "";

  const faktoren: Teilfaktor[] = [
    {
      name: "PEG (bereinigt)",
      geschaetzt: true,
      wert: e.adjustedPeg,
      punkte: pegPunkte,
      gewicht: 0.35,
      hinweis: e.adjustedPeg === null ? (e.pegHinweis ?? "nicht verfügbar")
        : `${e.adjustedPeg.toFixed(2)} — Bewertung im Verhältnis zum Wachstum${richtungsText}`,
    },
    // KGV auch als eigener Faktor, nicht nur als Deckel (FASSUNG 3): Das PEG
    // bestraft billige Wenig-Wächser — ein KGV von 12 bei 4 % Wachstum ergibt
    // PEG 3 und damit 0 Punkte, und die Billigkeit selbst bekam nirgends
    // etwas gutgeschrieben. Der Deckel wirkte nur nach oben (teuer begrenzt),
    // nie nach unten (billig belohnt). Anker grosszügiger als im
    // Finanzwerte-Zweig, weil Nicht-Finanzwerte strukturell höhere
    // Multiplikatoren tragen.
    {
      name: "KGV",
      wert: e.kgv,
      punkte: punkteAus(e.kgv === null || e.kgv <= 0 ? null : e.kgv, 35, 10),
      gewicht: 0.15,
      hinweis: e.kgv === null ? "nicht verfügbar" : `${e.kgv.toFixed(1)}-facher Jahresgewinn`,
    },
    {
      name: "Free-Cash-Flow-Rendite",
      wert: e.fcfRendite,
      punkte: punkteAus(e.fcfRendite, 0, 8),
      gewicht: 0.30,
      hinweis: e.fcfRendite === null ? "nicht verfügbar" : `${e.fcfRendite.toFixed(1)} % — schwerer zu beschönigen als der Gewinn`,
    },
    { ...dividende, gewicht: 0.20 },
  ];

  const basis = baueTeilScore(faktoren);
  if (basis.score === null) return basis;

  const deckel = kgvDeckel(e.kgv);
  if (basis.score <= deckel) return basis;

  return {
    ...basis,
    score: parseFloat(deckel.toFixed(1)),
    faktoren: [
      ...basis.faktoren,
      {
        name: "KGV-Deckel",
        wert: e.kgv,
        punkte: parseFloat(deckel.toFixed(1)),
        gewicht: 0,
        hinweis: `KGV ${e.kgv!.toFixed(1)} begrenzt die Bewertung auf ${deckel.toFixed(0)} — `
          + `das PEG allein ergäbe ${basis.score.toFixed(1)}`,
      },
    ],
  };
}

// ─── Bänder ───────────────────────────────────────────────────────────────────

/**
 * Bänder je Dimension.
 *
 * Bewusst unterschiedliche Etiketten: Eine 80 in der Bewertung bedeutet etwas
 * anderes als eine 80 in der Qualität. Dieselben Wörter für beide wären genau
 * der Fehler, der den alten Score unlesbar machte — zwei unvergleichbare Zahlen
 * unter einer Beschriftung.
 */
export function qualitaetsBand(score: number | null): string {
  if (score === null) return "nicht beurteilbar";
  if (score >= 75) return "ausgezeichnet";
  if (score >= 55) return "gut";
  if (score >= 35) return "mittel";
  return "schwach";
}

export function bewertungsBand(score: number | null): string {
  if (score === null) return "nicht beurteilbar";
  if (score >= 75) return "günstig";
  if (score >= 55) return "fair";
  if (score >= 35) return "ambitioniert";
  return "teuer";
}

export { MIN_KRITERIEN };
