/**
 * Piotroski F-Score — neun binäre Kriterien zur fundamentalen Richtung.
 *
 * Joseph D. Piotroski (Stanford) entwarf ihn, um bei Value-Aktien die
 * Bewertungsfallen auszusortieren: Unternehmen, die günstig aussehen, deren
 * Geschäft sich aber Jahr für Jahr verschlechtert. Jedes Kriterium ergibt 1
 * (erfüllt) oder 0, Maximum 9. Ab 8 gilt ein Titel als sehr gut, unter 3 als
 * Warnsignal.
 *
 * Der Score misst **Veränderung, nicht Güte**. Ein mittelmässiges Unternehmen,
 * das sich überall verbessert, erreicht 9; ein hervorragendes auf hohem Plateau
 * kaum 4. Deshalb bildet er hier nur den Richtungsteil des Qualitätsscores und
 * ersetzt die Niveaubetrachtung nicht — siehe `design/KONZEPT_SCORE_DREITEILUNG.md`.
 *
 * Datenquelle: dieselbe EODHD-Fundamentaldaten-Antwort, die
 * `qualityMetricsService` ohnehin holt. Sie enthält mehrere Geschäftsjahre;
 * bisher wurde nur das jüngste ausgewertet und der Rest verworfen.
 *
 * Referenz: Sandro Rosa, «Qualitätsaktien für unsichere Zeiten»,
 * The Market NZZ, 30.07.2026.
 */

export type KriteriumSchluessel =
  | "cashflowPositiv"
  | "cashflowUeberGewinn"
  | "roaPositiv"
  | "roaGestiegen"
  | "verschuldungGesunken"
  | "liquiditaetGestiegen"
  | "keineVerwaesserung"
  | "bruttomargeGestiegen"
  | "kapitalumschlagGestiegen";

export interface Kriterium {
  schluessel: KriteriumSchluessel;
  gruppe: "Profitabilität" | "Bilanz" | "Operative Effizienz";
  frage: string;
  /** `null` = nicht berechenbar, zählt weder als erfüllt noch als verfehlt. */
  erfuellt: boolean | null;
  /** Klartext für die Oberfläche, z. B. «ROA 8.4 % gegenüber 7.1 % im Vorjahr». */
  erlaeuterung: string;
}

export interface PiotroskiErgebnis {
  /** 0–9. Nur erfüllte Kriterien zählen. */
  score: number;
  /** Wie viele der neun Kriterien überhaupt berechnet werden konnten. */
  berechenbar: number;
  /** `score / berechenbar * 9`, auf die volle Skala hochgerechnet — oder null. */
  hochgerechnet: number | null;
  kriterien: Kriterium[];
}

/**
 * Mindestzahl berechenbarer Kriterien.
 *
 * Unter sechs von neun ist die Hochrechnung auf die Neunerskala nicht mehr
 * tragfähig: Bei vier fehlenden Kriterien entscheidet jedes verbleibende über
 * mehr als zwei Punkte. Dann lieber kein Wert — dieselbe Konsequenz wie bei
 * `MIN_ABDECKUNG_SCORE`.
 */
export const MIN_KRITERIEN = 6;

function zahl(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

/** Prozentwert mit einer Nachkommastelle, für die Erläuterungen. */
function pct(v: number): string {
  return `${(v * 100).toFixed(1)} %`;
}

interface Jahresdaten {
  /** Betrieblicher Cashflow. */
  cashflowBetrieb: number | null;
  nettogewinn: number | null;
  gesamtkapital: number | null;
  langfristigeSchulden: number | null;
  umlaufvermoegen: number | null;
  kurzfristigeVerbindlichkeiten: number | null;
  aktienzahl: number | null;
  umsatz: number | null;
  bruttogewinn: number | null;
}

function leseJahr(bs: any, is: any, cf: any): Jahresdaten {
  return {
    cashflowBetrieb: zahl(cf?.totalCashFromOperatingActivities),
    nettogewinn: zahl(is?.netIncome),
    gesamtkapital: zahl(bs?.totalAssets),
    langfristigeSchulden: zahl(bs?.longTermDebt) ?? zahl(bs?.longTermDebtTotal) ?? 0,
    umlaufvermoegen: zahl(bs?.totalCurrentAssets),
    kurzfristigeVerbindlichkeiten: zahl(bs?.totalCurrentLiabilities),
    aktienzahl: zahl(bs?.commonStockSharesOutstanding),
    umsatz: zahl(is?.totalRevenue),
    bruttogewinn: zahl(is?.grossProfit),
  };
}

/**
 * Berechnet den F-Score aus dem `Financials`-Block einer EODHD-Antwort.
 *
 * Erwartet mindestens zwei Geschäftsjahre. Nicht berechenbare Kriterien
 * bleiben `null` statt als «nicht erfüllt» zu zählen — sonst würde ein
 * Datenloch wie eine Verschlechterung aussehen.
 */
export function berechnePiotroski(financials: any): PiotroskiErgebnis {
  const bsY = financials?.Balance_Sheet?.yearly ?? {};
  const isY = financials?.Income_Statement?.yearly ?? {};
  const cfY = financials?.Cash_Flow?.yearly ?? {};

  // Nur Jahre verwenden, für die alle drei Abschlüsse vorliegen.
  const jahre = Object.keys(bsY)
    .filter((j) => isY[j] && cfY[j])
    .sort();

  const kriterien: Kriterium[] = [];
  const setze = (
    schluessel: KriteriumSchluessel,
    gruppe: Kriterium["gruppe"],
    frage: string,
    erfuellt: boolean | null,
    erlaeuterung: string,
  ) => kriterien.push({ schluessel, gruppe, frage, erfuellt, erlaeuterung });

  const ohneDaten = "Nicht berechenbar — Abschlussdaten fehlen";

  if (jahre.length < 2) {
    for (const [s, g, f] of KRITERIEN_KATALOG) setze(s, g, f, null, ohneDaten);
    return { score: 0, berechenbar: 0, hochgerechnet: null, kriterien };
  }

  const jetzt = jahre.at(-1)!;
  const vorher = jahre.at(-2)!;
  const a = leseJahr(bsY[jetzt], isY[jetzt], cfY[jetzt]);
  const v = leseJahr(bsY[vorher], isY[vorher], cfY[vorher]);

  // ── Profitabilität ────────────────────────────────────────────────────────

  setze(
    "cashflowPositiv", "Profitabilität", "Betrieblicher Cashflow ist positiv",
    a.cashflowBetrieb === null ? null : a.cashflowBetrieb > 0,
    a.cashflowBetrieb === null ? ohneDaten
      : `Betrieblicher Cashflow ${a.cashflowBetrieb > 0 ? "positiv" : "negativ"}`,
  );

  setze(
    "cashflowUeberGewinn", "Profitabilität", "Betrieblicher Cashflow übertrifft den Gewinn",
    a.cashflowBetrieb === null || a.nettogewinn === null ? null : a.cashflowBetrieb > a.nettogewinn,
    a.cashflowBetrieb === null || a.nettogewinn === null ? ohneDaten
      : a.cashflowBetrieb > a.nettogewinn
        ? "Der Gewinn ist durch Zahlungsströme gedeckt"
        : "Der ausgewiesene Gewinn übersteigt den Zahlungsstrom",
  );

  // Gesamtkapitalrendite auf dem mittleren Gesamtkapital — so verzerrt ein
  // Zukauf im Berichtsjahr die Kennzahl nicht.
  const mittleresKapital = a.gesamtkapital !== null && v.gesamtkapital !== null
    ? (a.gesamtkapital + v.gesamtkapital) / 2 : null;
  const roaJetzt = a.nettogewinn !== null && mittleresKapital !== null && mittleresKapital > 0
    ? a.nettogewinn / mittleresKapital : null;
  const roaVorher = v.nettogewinn !== null && v.gesamtkapital !== null && v.gesamtkapital > 0
    ? v.nettogewinn / v.gesamtkapital : null;

  setze(
    "roaPositiv", "Profitabilität", "Gesamtkapitalrendite ist positiv",
    roaJetzt === null ? null : roaJetzt > 0,
    roaJetzt === null ? ohneDaten : `Gesamtkapitalrendite ${pct(roaJetzt)}`,
  );

  setze(
    "roaGestiegen", "Profitabilität", "Gesamtkapitalrendite höher als im Vorjahr",
    roaJetzt === null || roaVorher === null ? null : roaJetzt > roaVorher,
    roaJetzt === null || roaVorher === null ? ohneDaten
      : `${pct(roaJetzt)} gegenüber ${pct(roaVorher)} im Vorjahr`,
  );

  // ── Bilanz ────────────────────────────────────────────────────────────────

  // Verschuldungsgrad als Anteil am Gesamtkapital, nicht als absoluter Betrag:
  // Ein wachsendes Unternehmen darf mehr Schulden tragen.
  const verschJetzt = a.langfristigeSchulden !== null && a.gesamtkapital !== null && a.gesamtkapital > 0
    ? a.langfristigeSchulden / a.gesamtkapital : null;
  const verschVorher = v.langfristigeSchulden !== null && v.gesamtkapital !== null && v.gesamtkapital > 0
    ? v.langfristigeSchulden / v.gesamtkapital : null;

  setze(
    "verschuldungGesunken", "Bilanz", "Geringere langfristige Verschuldung als im Vorjahr",
    verschJetzt === null || verschVorher === null ? null : verschJetzt < verschVorher,
    verschJetzt === null || verschVorher === null ? ohneDaten
      : `${pct(verschJetzt)} des Gesamtkapitals gegenüber ${pct(verschVorher)}`,
  );

  const liqJetzt = a.umlaufvermoegen !== null && a.kurzfristigeVerbindlichkeiten !== null && a.kurzfristigeVerbindlichkeiten > 0
    ? a.umlaufvermoegen / a.kurzfristigeVerbindlichkeiten : null;
  const liqVorher = v.umlaufvermoegen !== null && v.kurzfristigeVerbindlichkeiten !== null && v.kurzfristigeVerbindlichkeiten > 0
    ? v.umlaufvermoegen / v.kurzfristigeVerbindlichkeiten : null;

  setze(
    "liquiditaetGestiegen", "Bilanz", "Current Ratio über dem Vorjahreswert",
    liqJetzt === null || liqVorher === null ? null : liqJetzt > liqVorher,
    liqJetzt === null || liqVorher === null ? ohneDaten
      : `${liqJetzt.toFixed(2)} gegenüber ${liqVorher.toFixed(2)}`,
  );

  setze(
    "keineVerwaesserung", "Bilanz", "Aktienzahl konstant oder gesunken",
    a.aktienzahl === null || v.aktienzahl === null ? null : a.aktienzahl <= v.aktienzahl,
    a.aktienzahl === null || v.aktienzahl === null ? ohneDaten
      : a.aktienzahl <= v.aktienzahl
        ? "Keine Verwässerung"
        : `Aktienzahl um ${pct(a.aktienzahl / v.aktienzahl - 1)} gestiegen`,
  );

  // ── Operative Effizienz ───────────────────────────────────────────────────

  const bmJetzt = a.bruttogewinn !== null && a.umsatz !== null && a.umsatz > 0
    ? a.bruttogewinn / a.umsatz : null;
  const bmVorher = v.bruttogewinn !== null && v.umsatz !== null && v.umsatz > 0
    ? v.bruttogewinn / v.umsatz : null;

  setze(
    "bruttomargeGestiegen", "Operative Effizienz", "Bruttomarge höher als im Vorjahr",
    bmJetzt === null || bmVorher === null ? null : bmJetzt > bmVorher,
    bmJetzt === null || bmVorher === null ? ohneDaten
      : `${pct(bmJetzt)} gegenüber ${pct(bmVorher)}`,
  );

  const umschlagJetzt = a.umsatz !== null && mittleresKapital !== null && mittleresKapital > 0
    ? a.umsatz / mittleresKapital : null;
  const umschlagVorher = v.umsatz !== null && v.gesamtkapital !== null && v.gesamtkapital > 0
    ? v.umsatz / v.gesamtkapital : null;

  setze(
    "kapitalumschlagGestiegen", "Operative Effizienz", "Kapitalumschlag höher als im Vorjahr",
    umschlagJetzt === null || umschlagVorher === null ? null : umschlagJetzt > umschlagVorher,
    umschlagJetzt === null || umschlagVorher === null ? ohneDaten
      : `${umschlagJetzt.toFixed(2)} gegenüber ${umschlagVorher.toFixed(2)}`,
  );

  const berechenbar = kriterien.filter((k) => k.erfuellt !== null).length;
  const score = kriterien.filter((k) => k.erfuellt === true).length;
  const hochgerechnet = berechenbar >= MIN_KRITERIEN
    ? parseFloat(((score / berechenbar) * 9).toFixed(2))
    : null;

  return { score, berechenbar, hochgerechnet, kriterien };
}

/** Reihenfolge und Beschriftung, auch wenn nichts berechenbar ist. */
const KRITERIEN_KATALOG: [KriteriumSchluessel, Kriterium["gruppe"], string][] = [
  ["cashflowPositiv", "Profitabilität", "Betrieblicher Cashflow ist positiv"],
  ["cashflowUeberGewinn", "Profitabilität", "Betrieblicher Cashflow übertrifft den Gewinn"],
  ["roaPositiv", "Profitabilität", "Gesamtkapitalrendite ist positiv"],
  ["roaGestiegen", "Profitabilität", "Gesamtkapitalrendite höher als im Vorjahr"],
  ["verschuldungGesunken", "Bilanz", "Geringere langfristige Verschuldung als im Vorjahr"],
  ["liquiditaetGestiegen", "Bilanz", "Current Ratio über dem Vorjahreswert"],
  ["keineVerwaesserung", "Bilanz", "Aktienzahl konstant oder gesunken"],
  ["bruttomargeGestiegen", "Operative Effizienz", "Bruttomarge höher als im Vorjahr"],
  ["kapitalumschlagGestiegen", "Operative Effizienz", "Kapitalumschlag höher als im Vorjahr"],
];

/** Einordnung nach Piotroski: ab 8 sehr gut, unter 3 Warnsignal. */
export function piotroskiKlartext(score: number, berechenbar: number): string {
  if (berechenbar < MIN_KRITERIEN) return "Zu wenige Abschlussdaten";
  if (score >= 8) return "Sehr gut — fundamental auf breiter Front verbessert";
  if (score >= 6) return "Gut — überwiegend positive Entwicklung";
  if (score >= 3) return "Gemischt";
  return "Warnsignal — fundamental rückläufig";
}
