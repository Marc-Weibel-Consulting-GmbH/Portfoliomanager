/**
 * Kennzahlen für Qualität und Bewertung — ausschliesslich aus datierten Quellen.
 *
 * `beschneideFundamentals` entfernt `Highlights` und `Valuation` vollständig,
 * weil jede Zahl darin ein Tageswert von heute ist. Damit fallen aber auch die
 * bequemen Felder weg, aus denen `qualityMetricsService` seine Kennzahlen holt
 * (PERatio, OperatingMarginTTM, MarketCapitalization …). Dieses Modul bildet
 * sie aus den Abschlüssen und dem Kurs von damals nach.
 *
 * WAS SICH NICHT REKONSTRUIEREN LÄSST — und deshalb hier fehlt:
 *
 *  - **Forward-KGV und PEG.** Sie beruhen auf Analystenschätzungen. Was 2024
 *    geschätzt wurde, steht in keiner heutigen Antwort; die Schätzung von heute
 *    auf 2024 anzuwenden wäre Rückschau in Reinform. Die Punkt-in-Zeit-Bewertung
 *    ist deshalb rein rückwärtsgerichtet.
 *  - **Analysten-Überraschungsquote** für Zeiträume ohne Berichtshistorie.
 *
 * FOLGE, DIE MAN KENNEN MUSS: Die so gerechnete Bewertung ist NICHT identisch
 * mit der live gerechneten, weil dort Forward-KGV und PEG mitzählen. Gewichte,
 * die auf dieser Reihe optimiert werden, gelten streng genommen für die
 * rückwärtsgerichtete Variante. Wer das sauber haben will, muss die Live-
 * Bewertung ebenfalls rückwärtsgerichtet rechnen — das ist eine bewusste
 * Entscheidung und keine Nebensache.
 */

import { berechnePiotroski } from "./piotroski";
import { stabilitaetAusJahresEps } from "./gewinnStabilitaet";

function zahl(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

/** Jüngster Eintrag einer nach Periode geschlüsselten Sammlung. */
function juengster(sammlung: Record<string, any> | undefined): any | null {
  const keys = Object.keys(sammlung ?? {}).sort();
  return keys.length ? sammlung![keys.at(-1)!] : null;
}

export interface PunktInZeitEingaben {
  /** Bereits zugeschnittene Antwort aus `beschneideFundamentals`. */
  beschnitten: any;
  /** Kurs am Stichtag, in Handelswährung. */
  kurs: number | null;
  /** Sektor — zeitlos genug, kommt aus der Stammdatenzeile. */
  sektor?: string | null;
}

export interface PunktInZeitKennzahlen {
  /** Eingaben für `berechneQualitaet`. */
  qualitaet: {
    roic: number | null;
    betriebsmarge: number | null;
    bruttomarge: number | null;
    ertragsdeckung: number | null;
    epsStabilitaet: number | null;
    netDebtToEbitda: number | null;
  };
  /** Eingaben für `berechneBewertung` — ohne die vorwärtsgerichteten Felder. */
  bewertung: {
    adjustedPeg: number | null;
    kgv: number | null;
    fcfRendite: number | null;
    dividendenrendite: number | null;
    kursBuchwert: number | null;
    epsWachstumTTM: number | null;
    epsWachstum5j: number | null;
    sektor: string | null;
  };
  piotroski: ReturnType<typeof berechnePiotroski>;
  /** Wie viele der zwölf Kennzahlen belegt sind — Warnsignal bei dünnen Jahren. */
  belegt: number;
}

/** EPS-Wachstum p.a. über `jahre` Jahre, in Prozent. */
function cagr(start: number | null, ende: number | null, jahre: number): number | null {
  if (start === null || ende === null || start <= 0 || ende <= 0 || jahre <= 0) return null;
  return (Math.pow(ende / start, 1 / jahre) - 1) * 100;
}

/**
 * Gewinnstabilität aus der Streuung der jährlichen Wachstumsraten —
 * dieselbe Rechnung wie im Live-Pfad (`gewinnStabilitaet`, rein und getestet).
 */
export function stabilitaetAusReihe(epsJahre: Array<{ jahr: number; eps: number | null }>): number | null {
  // Delegiert an die eine, robuste Rechnung (Befund 1 der Scoring-Prüfung:
  // keine Raten über Jahreslücken, Kappung bei ±100 %). Die frühere bewusste
  // Duplikation entfällt — die Rechnung ist jetzt rein importierbar.
  return stabilitaetAusJahresEps(epsJahre).score;
}

export function kennzahlenPerStichtag(e: PunktInZeitEingaben): PunktInZeitKennzahlen {
  const fin = e.beschnitten?.Financials ?? {};
  const bs = juengster(fin.Balance_Sheet?.yearly);
  const is = juengster(fin.Income_Statement?.yearly);
  const cf = juengster(fin.Cash_Flow?.yearly);
  const kurs = e.kurs !== null && e.kurs > 0 ? e.kurs : null;

  // ── Ertragsgrössen ────────────────────────────────────────────────────────
  const umsatz = zahl(is?.totalRevenue);
  const rohertrag = zahl(is?.grossProfit);
  const betriebsergebnis = zahl(is?.operatingIncome);
  const gewinn = zahl(is?.netIncome);
  const steuern = zahl(is?.incomeTaxExpense) ?? zahl(is?.taxProvision);
  const vorSteuern = zahl(is?.incomeBeforeTax);

  const bruttomarge = umsatz && umsatz > 0 && rohertrag !== null ? (rohertrag / umsatz) * 100 : null;
  const betriebsmarge = umsatz && umsatz > 0 && betriebsergebnis !== null ? (betriebsergebnis / umsatz) * 100 : null;

  // ── Bilanzgrössen ─────────────────────────────────────────────────────────
  const eigenkapital = zahl(bs?.totalStockholderEquity) ?? zahl(bs?.totalStockholdersEquity);
  const langfristigeSchulden = zahl(bs?.longTermDebt) ?? 0;
  const kurzfristigeSchulden = zahl(bs?.shortTermDebt) ?? zahl(bs?.shortLongTermDebt) ?? 0;
  const liquiditaet = zahl(bs?.cash) ?? zahl(bs?.cashAndEquivalents) ?? 0;
  const aktien = zahl(bs?.commonStockSharesOutstanding);
  const nettoSchulden = langfristigeSchulden + kurzfristigeSchulden - liquiditaet;

  // ── ROIC ──────────────────────────────────────────────────────────────────
  // NOPAT ÷ investiertes Kapital, wie in `qualityMetricsService`: Betriebs-
  // ergebnis nach effektivem Steuersatz, Kapital aus Eigenkapital plus
  // Nettoschulden.
  let roic: number | null = null;
  if (betriebsergebnis !== null && eigenkapital !== null) {
    const steuersatz = steuern !== null && vorSteuern !== null && vorSteuern > 0
      ? Math.max(0, Math.min(0.5, steuern / vorSteuern))
      : 0.20;
    const nopat = betriebsergebnis * (1 - steuersatz);
    const kapital = eigenkapital + nettoSchulden;
    if (kapital > 0) roic = (nopat / kapital) * 100;
  }

  // ── Cashflow ──────────────────────────────────────────────────────────────
  const operativerCf = zahl(cf?.totalCashFromOperatingActivities);
  let freierCf = zahl(cf?.freeCashFlow);
  if (freierCf === null && operativerCf !== null) {
    const investitionen = zahl(cf?.capitalExpenditures);
    if (investitionen !== null) freierCf = operativerCf - Math.abs(investitionen);
  }
  const ertragsdeckung = operativerCf !== null && gewinn !== null && gewinn > 0
    ? operativerCf / gewinn
    : null;

  // ── Verschuldung ──────────────────────────────────────────────────────────
  // EBITDA aus dem Abschluss statt aus Highlights: Betriebsergebnis plus
  // Abschreibungen.
  const abschreibungen = zahl(is?.depreciationAndAmortization) ?? zahl(cf?.depreciation) ?? 0;
  const ebitda = betriebsergebnis !== null ? betriebsergebnis + abschreibungen : null;
  const netDebtToEbitda = ebitda !== null && ebitda > 0 ? nettoSchulden / ebitda : null;

  // ── EPS-Reihe ─────────────────────────────────────────────────────────────
  const annual = e.beschnitten?.Earnings?.Annual ?? {};
  const annualKeys = Object.keys(annual).sort();
  const epsReihe = annualKeys.map((k) => zahl(annual[k]?.epsActual)).filter((v): v is number => v !== null);
  // Mit Geschäftsjahr, damit keine Rate über eine Datenlücke gebildet wird.
  const epsStabilitaet = stabilitaetAusReihe(
    annualKeys.map((k) => ({ jahr: parseInt(k.slice(0, 4), 10), eps: zahl(annual[k]?.epsActual) })),
  );
  const epsAktuell = epsReihe.at(-1) ?? null;
  const epsVorjahr = epsReihe.at(-2) ?? null;
  const epsVor5 = epsReihe.length >= 6 ? epsReihe.at(-6)! : null;
  const epsWachstumTTM = epsAktuell !== null && epsVorjahr !== null && Math.abs(epsVorjahr) > 0.001
    ? ((epsAktuell - epsVorjahr) / Math.abs(epsVorjahr)) * 100
    : null;
  const epsWachstum5j = cagr(epsVor5, epsAktuell, 5);

  // ── Kursbasierte Grössen ──────────────────────────────────────────────────
  const kgv = kurs !== null && epsAktuell !== null && epsAktuell > 0 ? kurs / epsAktuell : null;
  const buchwertJeAktie = eigenkapital !== null && aktien !== null && aktien > 0 ? eigenkapital / aktien : null;
  const kursBuchwert = kurs !== null && buchwertJeAktie !== null && buchwertJeAktie > 0
    ? kurs / buchwertJeAktie
    : null;
  const marktkapitalisierung = kurs !== null && aktien !== null && aktien > 0 ? kurs * aktien : null;
  const fcfRendite = freierCf !== null && marktkapitalisierung !== null && marktkapitalisierung > 0
    ? (freierCf / marktkapitalisierung) * 100
    : null;
  // Dividende aus dem Zahlungsstrom — `dividendsPaid` ist negativ vorzeichenbehaftet.
  const dividendenZahlung = zahl(cf?.dividendsPaid);
  const dividendenrendite = dividendenZahlung !== null && aktien !== null && aktien > 0 && kurs !== null
    ? (Math.abs(dividendenZahlung) / aktien / kurs) * 100
    : null;

  const qualitaet = { roic, betriebsmarge, bruttomarge, ertragsdeckung, epsStabilitaet, netDebtToEbitda };
  const bewertung = {
    // Kein PEG: Es braucht eine Wachstumsschätzung, und die von heute gehört
    // nicht in eine Rechnung von damals.
    adjustedPeg: null,
    kgv, fcfRendite, dividendenrendite, kursBuchwert,
    epsWachstumTTM, epsWachstum5j,
    sektor: e.sektor ?? null,
  };

  const belegt = [
    ...Object.values(qualitaet),
    kgv, fcfRendite, dividendenrendite, kursBuchwert, epsWachstumTTM, epsWachstum5j,
  ].filter((v) => v !== null).length;

  return {
    qualitaet,
    bewertung,
    piotroski: berechnePiotroski(fin),
    belegt,
  };
}
