/**
 * qualityMetricsService.ts
 * Berechnet erweiterte Qualitätskennzahlen aus EODHD-Fundamentaldaten:
 * - ROIC (Return on Invested Capital)
 * - EPS-CV (Historische Gewinnvolatilität, Variationskoeffizient)
 * - Adjusted PEG (korrigiert für Volatilität und Qualität)
 * - EPS Surprise-Rate (Beat-Konsistenz)
 * - Forward PEG
 * - PEG-Quadrant (4 Felder: PE-Niveau × Wachstum)
 */

import { ENV } from "../_core/env";
import { retryWithBackoff } from "../_core/retryUtil";
import { toEodhdSymbol } from "./eodhdSymbol";
import { berechnePiotroski, type PiotroskiErgebnis } from "./piotroski";
import { bereinigtesPeg } from "./bereinigtesPeg";
import { stabilitaetAusJahresEps } from "./gewinnStabilitaet";

// ─── Typen ────────────────────────────────────────────────────────────────────

export interface QualityMetrics {
  // Bewertung
  trailingPeg: number | null;
  forwardPeg: number | null;
  adjustedPeg: number | null;
  /** Warum `adjustedPeg` null ist (Wächter aus `bereinigtesPeg`); null bei belegtem Wert. */
  adjustedPegGrund: string | null;
  /** Deutscher Anzeigetext zum Ausblendgrund — für den Faktor-Hinweis. */
  adjustedPegHinweis: string | null;
  /** Komplette PEG-Herleitung (Quelle, Nenner, Bereinigung) — für die Klick-Nachvollziehbarkeit. */
  adjustedPegRechnung: string | null;
  pegQuadrant: PegQuadrant;
  pegQuadrantLabel: string;

  // Qualität
  roic: number | null;              // % Return on Invested Capital
  returnOnEquity: number | null;    // % ROE
  grossMargin: number | null;       // % Bruttomarge
  operatingMargin: number | null;   // % Betriebsmarge
  qualityScore: number;             // 0–100

  // Wachstum
  epsGrowthTTM: number | null;      // % EPS-Wachstum (YoY)
  revenueGrowthTTM: number | null;  // % Umsatzwachstum (YoY)
  epsGrowth5y: number | null;       // % p.a. EPS-CAGR 5 Jahre

  // Risiko / Stabilität
  epsVolatility: number | null;     // CV der jährlichen EPS-Wachstumsraten (0–1+)
  /** % p.a. — robustes Mittel der Jahres-EPS-Raten (Quelle des Qualitätsfaktors «Gewinnwachstum», FASSUNG 6). */
  epsWachstumRobust: number | null;
  /** 0–100 (100 = sehr gleichmässige Gewinne); null = nicht berechenbar. */
  epsStabilityScore: number | null;
  /** Belegtext zur Stabilität (verwendete Raten + Streuung) — macht die Zahl nachprüfbar. */
  epsStabilitaetHinweis: string | null;
  surpriseRate: number | null;      // % Quartale mit positivem EPS-Surprise (letzte 8Q)
  netDebtToEbitda: number | null;   // Verschuldungsgrad

  // Bewertung auf Cashflow-Basis
  /**
   * % Free-Cash-Flow-Rendite = freier Cashflow ÷ Marktkapitalisierung.
   *
   * Schwerer zu beschönigen als der Gewinn und deshalb die belastbarere
   * Bewertungsgrösse. Ersetzt den Platzhalter in `signalsRouter`, der den Wert
   * aus Bändern des Qualitätsscores ableitete (`> 60 → 3.0`) — womit der
   * Qualitätsscore zu einem Viertel aus sich selbst entstand.
   */
  fcfYield: number | null;
  /** Freier Cashflow des letzten Geschäftsjahres, Konzernwährung. */
  freeCashflow: number | null;
  /** Unternehmenswert ÷ EBITDA. Kapitalstrukturneutral, anders als das KGV. */
  evToEbitda: number | null;
  /** Kurs-Buchwert-Verhältnis. Für Banken und Versicherer die aussagekräftigste Bewertungsgrösse. */
  priceToBook: number | null;

  /**
   * Operativer Cashflow ÷ Nettogewinn — die Ertragsqualität.
   *
   * Über 1 heisst: Der ausgewiesene Gewinn ist durch Zahlungsströme gedeckt.
   * Der wirksamste Schutz gegen buchhalterisch erzeugte Gewinne.
   */
  ertragsdeckung: number | null;

  /** Piotroski F-Score — die fundamentale Richtung gegenüber dem Vorjahr. */
  piotroski: PiotroskiErgebnis;

  // Rohdaten für Transparenz
  trailingPE: number | null;
  forwardPE: number | null;
  eps: number | null;
  epsEstimateNextYear: number | null;
  investedCapital: number | null;
  nopat: number | null;

  // Metadaten
  dataSource: string;
  lastUpdated: string;
}

export type PegQuadrant =
  | "value_growth"      // Niedriges PE + Hohes Wachstum → Attraktiv
  | "value_slow"        // Niedriges PE + Niedriges Wachstum → Value-Falle?
  | "growth_premium"    // Hohes PE + Hohes Wachstum → Wachstumsprämie
  | "expensive_slow"    // Hohes PE + Niedriges Wachstum → Teuer
  | "unknown";

// ─── Cache ────────────────────────────────────────────────────────────────────

const cache = new Map<string, { data: QualityMetrics; expiresAt: number }>();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 Stunden (reduziert von 24h für frischere Daten)

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

function resolveEodhdTicker(ticker: string): string {
  // Erst Suffix hinzufügen falls nötig
  let resolved = ticker;
  if (!ticker.includes('.')) {
    resolved = `${ticker}.US`;
  }
  // Dann zentrale EODHD-Mapping anwenden
  return toEodhdSymbol(resolved);
}

function calcCAGR(startValue: number, endValue: number, years: number): number | null {
  if (startValue <= 0 || endValue <= 0 || years <= 0) return null;
  return (Math.pow(endValue / startValue, 1 / years) - 1) * 100;
}

function calcPegQuadrant(pe: number | null, epsGrowth: number | null): PegQuadrant {
  if (pe === null || epsGrowth === null) return "unknown";
  const highPE = pe > 25;
  const highGrowth = epsGrowth > 10; // > 10% p.a.
  if (!highPE && highGrowth) return "value_growth";
  if (!highPE && !highGrowth) return "value_slow";
  if (highPE && highGrowth) return "growth_premium";
  return "expensive_slow";
}

function pegQuadrantLabel(q: PegQuadrant): string {
  switch (q) {
    case "value_growth":    return "Value + Wachstum";
    case "value_slow":      return "Value / Niedriges Wachstum";
    case "growth_premium":  return "Wachstumsprämie";
    case "expensive_slow":  return "Teuer / Niedriges Wachstum";
    default:                return "Unbekannt";
  }
}

// ─── Hauptfunktion ────────────────────────────────────────────────────────────

export async function getQualityMetrics(ticker: string): Promise<QualityMetrics> {
  const cacheKey = ticker.toUpperCase();
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const eodhdTicker = resolveEodhdTicker(ticker);
  const apiKey = ENV.eodhdApiKey;

  if (!apiKey) {
    return buildFallback(ticker, "EODHD API Key fehlt");
  }

  try {
    const url = `https://eodhd.com/api/fundamentals/${eodhdTicker}?api_token=${apiKey}&fmt=json`;
    // Jede Wiederholung erhält einen eigenen Timeout. Ein einmaliger EODHD-
    // Aussetzer darf nicht als dauerhaft fehlende Fundamentaldaten in einen
    // Screener-Lauf eingehen; nach den begrenzten Versuchen bleibt der
    // Fallback weiterhin explizit und fehlertolerant.
    const res = await retryWithBackoff(async () => {
      const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) {
        const error: Error & { status?: number } = new Error(`EODHD HTTP ${response.status}`);
        error.status = response.status;
        throw error;
      }
      return response;
    }, { maxRetries: 2, baseDelay: 250, maxDelay: 1000 });

    const d = await res.json();
    const metrics = extractMetrics(d, ticker);

    cache.set(cacheKey, { data: metrics, expiresAt: Date.now() + CACHE_TTL_MS });
    return metrics;

  } catch (err: any) {
    console.error(`[QualityMetrics] Error for ${ticker}:`, err.message);
    return buildFallback(ticker, err.message);
  }
}

// ─── Extraktion ───────────────────────────────────────────────────────────────

/** Exportiert für den Test — die Netzabfrage ist der einzige Grund, warum
 *  `getQualityMetrics` nicht direkt prüfbar ist. */
export function extractMetrics(d: any, ticker: string): QualityMetrics {
  const highlights = d.Highlights || {};
  const financials = d.Financials || {};
  const earnings = d.Earnings || {};

  // ── Bewertungskennzahlen ──────────────────────────────────────────────────
  const trailingPE = parseFloatOrNull(highlights.PERatio);
  const trailingPeg = parseFloatOrNull(highlights.PEGRatio);
  const eps = parseFloatOrNull(highlights.EarningsShare);
  const epsEstimateNextYear = parseFloatOrNull(highlights.EPSEstimateNextYear);
  const currentPrice = parseFloatOrNull(highlights.MarketCapitalization) &&
    parseFloatOrNull(highlights.EarningsShare)
    ? null : null; // Preis kommt von Yahoo, nicht EODHD

  // Forward PE aus EODHD Valuation
  const valuation = d.Valuation || {};
  const forwardPE = parseFloatOrNull(valuation.ForwardPE) ||
    (eps && epsEstimateNextYear && trailingPE
      ? trailingPE * (eps / epsEstimateNextYear)
      : null);

  // ── EPS-Wachstum (TTM) — korrekt aus Quartals-EPS berechnen ─────────────
  // TTM EPS = Summe der letzten 4 Quartale
  // EPS-Wachstum = (TTM EPS - TTM EPS Vorjahr) / |TTM EPS Vorjahr|
  let epsGrowthTTM: number | null = null;
  const qHistoryForTTM = earnings.History || {};
  const qAllKeys = Object.keys(qHistoryForTTM).sort();
  if (qAllKeys.length >= 8) {
    const last4 = qAllKeys.slice(-4);
    const prev4 = qAllKeys.slice(-8, -4);
    // Exclude zero values — EODHD returns 0 for quarters without reported data
    const ttmEps = last4.reduce((sum, k) => {
      const v = parseFloatOrNull(qHistoryForTTM[k]?.epsActual);
      return (v !== null && v !== 0) ? sum + v : sum;
    }, 0);
    const prevTtmEps = prev4.reduce((sum, k) => {
      const v = parseFloatOrNull(qHistoryForTTM[k]?.epsActual);
      return (v !== null && v !== 0) ? sum + v : sum;
    }, 0);
    if (Math.abs(prevTtmEps) > 0.001) {
      epsGrowthTTM = ((ttmEps - prevTtmEps) / Math.abs(prevTtmEps)) * 100;
    }
  }
  // Fallback: QuarterlyEarningsGrowthYOY wenn nicht genug Quartale
  if (epsGrowthTTM === null) {
    const qGrowth = parseFloatOrNull(highlights.QuarterlyEarningsGrowthYOY);
    if (qGrowth !== null) epsGrowthTTM = qGrowth * 100;
  }

  const revenueGrowthTTM = parseFloatOrNull(highlights.QuarterlyRevenueGrowthYOY) !== null
    ? (highlights.QuarterlyRevenueGrowthYOY as number) * 100
    : null;

  // ── EPS-CAGR 5 Jahre ─────────────────────────────────────────────────────
  const annualEPS = earnings.Annual || {};
  const annualKeys = Object.keys(annualEPS).sort();
  let epsGrowth5y: number | null = null;
  if (annualKeys.length >= 6) {
    const eps5yAgo = parseFloatOrNull(annualEPS[annualKeys.at(-6)]?.epsActual);
    const epsLatest = parseFloatOrNull(annualEPS[annualKeys.at(-1)]?.epsActual);
    epsGrowth5y = calcCAGR(eps5yAgo ?? 0, epsLatest ?? 0, 5);
  }

  // ── Historische Gewinnvolatilität und -stabilität ────────────────────────
  // Rechnung in `gewinnStabilitaet` (rein, getestet): nur benachbarte
  // Geschäftsjahre werden gepaart, Raten bei ±100 % gekappt — Befund 1 der
  // Scoring-Prüfung (Lückenraten und Artefaktjahre nullten den Faktor).
  // null heisst weiterhin «nicht berechenbar», niemals eine erfundene 0.
  const stabilitaet = stabilitaetAusJahresEps(
    annualKeys.slice(-11).map((k) => ({
      jahr: parseInt(k.slice(0, 4), 10),
      eps: parseFloatOrNull(annualEPS[k]?.epsActual),
    })),
  );
  const epsStabilityScore = stabilitaet.score;
  // CV wie bisher (std ÷ |Mittel| bei tragfähigem Mittel, sonst std) — jetzt
  // auf den robusten Raten.
  let epsVolatility: number | null = null;
  if (stabilitaet.streuungPp !== null && stabilitaet.mittel !== null) {
    const std = stabilitaet.streuungPp / 100;
    epsVolatility = Math.abs(stabilitaet.mittel) > 0.01 ? std / Math.abs(stabilitaet.mittel) : std;
  }

  // ── EPS Surprise-Rate (letzte 8 Quartale) ────────────────────────────────
  const qHistory = earnings.History || {};
  const qKeys = Object.keys(qHistory).sort().slice(-8);
  let surpriseRate: number | null = null;
  if (qKeys.length >= 4) {
    const beats = qKeys.filter(k => {
      const q = qHistory[k];
      const actual = parseFloatOrNull(q.epsActual);
      const estimate = parseFloatOrNull(q.epsEstimated);
      return actual !== null && estimate !== null && actual > estimate;
    }).length;
    surpriseRate = (beats / qKeys.length) * 100;
  }

  // ── ROIC ──────────────────────────────────────────────────────────────────
  let roic: number | null = null;
  let investedCapital: number | null = null;
  let nopat: number | null = null;

  const bsYearly = financials.Balance_Sheet?.yearly || {};
  const isYearly = financials.Income_Statement?.yearly || {};
  const bsKeys = Object.keys(bsYearly).sort();
  const isKeys = Object.keys(isYearly).sort();

  if (bsKeys.length > 0 && isKeys.length > 0) {
    const latestBS = bsYearly[bsKeys.at(-1)!];
    const latestIS = isYearly[isKeys.at(-1)!];

    const operatingIncome = parseFloatOrNull(latestIS.operatingIncome);
    const taxProvision = parseFloatOrNull(latestIS.incomeTaxExpense) ||
                         parseFloatOrNull(latestIS.taxProvision);
    const totalRevenue = parseFloatOrNull(latestIS.totalRevenue);
    const longTermDebt = parseFloatOrNull(latestBS.longTermDebt) ?? 0;
    const shortTermDebt = parseFloatOrNull(latestBS.shortTermDebt) ??
                          parseFloatOrNull(latestBS.shortLongTermDebt) ?? 0;
    const cash = parseFloatOrNull(latestBS.cash) ??
                 parseFloatOrNull(latestBS.cashAndEquivalents) ?? 0;
    const equity = parseFloatOrNull(latestBS.totalStockholderEquity) ??
                   parseFloatOrNull(latestBS.totalStockholdersEquity) ??
                   parseFloatOrNull(latestBS.netInvestedCapital);

    if (operatingIncome !== null && totalRevenue !== null && totalRevenue > 0) {
      // Effektiver Steuersatz
      const effectiveTaxRate = taxProvision && operatingIncome > 0
        ? Math.min(0.40, Math.max(0, taxProvision / operatingIncome))
        : 0.21; // Fallback: 21%

      nopat = operatingIncome * (1 - effectiveTaxRate);

      // Invested Capital = Eigenkapital + Nettoverschuldung
      const netDebt = longTermDebt + shortTermDebt - cash;
      if (equity !== null) {
        investedCapital = equity + netDebt;
      } else if (latestBS.netInvestedCapital) {
        investedCapital = parseFloatOrNull(latestBS.netInvestedCapital);
      }

      if (investedCapital !== null && investedCapital > 0) {
        roic = (nopat / investedCapital) * 100;
      }
    }
  }

  // ── Freier Cashflow, FCF-Rendite und EV/EBITDA ────────────────────────────
  //
  // Alles aus derselben EODHD-Antwort, die oben ohnehin geholt wird. `Cash_Flow`
  // wurde bisher gar nicht gelesen.
  const cfYearly = financials.Cash_Flow?.yearly || {};
  const cfKeys = Object.keys(cfYearly).sort();
  const marktkapitalisierung = parseFloatOrNull(highlights.MarketCapitalization);

  let freeCashflow: number | null = null;
  if (cfKeys.length > 0) {
    const latestCF = cfYearly[cfKeys.at(-1)!];
    // EODHD liefert `freeCashFlow` meist direkt. Fehlt es, aus operativem
    // Cashflow abzüglich Investitionen bilden — `capitalExpenditures` ist dort
    // je nach Titel positiv oder negativ vorzeichenbehaftet, deshalb der Betrag.
    freeCashflow = parseFloatOrNull(latestCF.freeCashFlow);
    if (freeCashflow === null) {
      const operativ = parseFloatOrNull(latestCF.totalCashFromOperatingActivities);
      const investitionen = parseFloatOrNull(latestCF.capitalExpenditures);
      if (operativ !== null && investitionen !== null) {
        freeCashflow = operativ - Math.abs(investitionen);
      }
    }
  }

  let fcfYield: number | null = null;
  if (freeCashflow !== null && marktkapitalisierung !== null && marktkapitalisierung > 0) {
    fcfYield = (freeCashflow / marktkapitalisierung) * 100;
    // Plausibilitätswächter: Eine FCF-Rendite jenseits von ±40 % ist in der
    // Praxis kein Bewertungssignal, sondern ein Einheitenkonflikt — beim
    // Samsung-GDR (BC94.LSE) standen Won-Cashflows über einer
    // Dollar-Marktkapitalisierung: «FCF-Rendite 2605 %», Bewertung 100,
    // STRONG BUY. Lieber kein Wert als ein Wechselkurs als Kennzahl.
    if (Math.abs(fcfYield) > 40) {
      fcfYield = null;
    }
  }

  // Ertragsqualität: Deckt der Zahlungsstrom den ausgewiesenen Gewinn?
  // Bei negativem Gewinn ist das Verhältnis nicht sinnvoll interpretierbar —
  // dann lieber kein Wert als ein Vorzeichenartefakt.
  let ertragsdeckung: number | null = null;
  if (cfKeys.length > 0 && isKeys.length > 0) {
    const letzterCF = cfYearly[cfKeys.at(-1)!];
    const letzterIS = isYearly[isKeys.at(-1)!];
    const operativ = parseFloatOrNull(letzterCF?.totalCashFromOperatingActivities);
    const gewinn = parseFloatOrNull(letzterIS?.netIncome);
    if (operativ !== null && gewinn !== null && gewinn > 0) {
      ertragsdeckung = operativ / gewinn;
    }
  }

  // Kurs-Buchwert — EODHD führt es unter `Valuation`, ersatzweise aus
  // Marktkapitalisierung und Eigenkapital.
  let priceToBook = parseFloatOrNull(valuation.PriceBookMRQ);
  if (priceToBook === null && marktkapitalisierung !== null && bsKeys.length > 0) {
    const eigenkapital = parseFloatOrNull(bsYearly[bsKeys.at(-1)!]?.totalStockholderEquity);
    if (eigenkapital !== null && eigenkapital > 0) {
      priceToBook = marktkapitalisierung / eigenkapital;
    }
  }

  // Piotroski aus denselben Abschlüssen — zwei Geschäftsjahre, kein neuer Abruf.
  const piotroski = berechnePiotroski(financials);

  // ── Net Debt / EBITDA ─────────────────────────────────────────────────────
  let netDebtToEbitda: number | null = null;
  let evToEbitda: number | null = null;
  const ebitda = parseFloatOrNull(highlights.EBITDA);
  if (ebitda && ebitda > 0 && bsKeys.length > 0) {
    const latestBS = bsYearly[bsKeys.at(-1)!];
    const netDebt = parseFloatOrNull(latestBS.netDebt);
    if (netDebt !== null) {
      netDebtToEbitda = netDebt / ebitda;
      if (marktkapitalisierung !== null && marktkapitalisierung > 0) {
        // Unternehmenswert = Marktkapitalisierung + Nettoverschuldung.
        evToEbitda = (marktkapitalisierung + netDebt) / ebitda;
      }
    }
  }

  // ── Margen ────────────────────────────────────────────────────────────────
  const grossMargin = parseFloatOrNull(highlights.GrossProfitTTM) &&
    parseFloatOrNull(highlights.RevenueTTM)
    ? (highlights.GrossProfitTTM / highlights.RevenueTTM) * 100
    : null;
  const operatingMargin = parseFloatOrNull(highlights.OperatingMarginTTM) !== null
    ? (highlights.OperatingMarginTTM as number) * 100
    : null;
  const returnOnEquity = parseFloatOrNull(highlights.ReturnOnEquityTTM) !== null
    ? (highlights.ReturnOnEquityTTM as number) * 100
    : null;

  // ── Quality Score (0–100) ─────────────────────────────────────────────────
  let qualityScore = 50;

  if (roic !== null) {
    qualityScore += roic > 20 ? 15 : roic > 12 ? 8 : roic > 6 ? 2 : -8;
  }
  if (returnOnEquity !== null) {
    qualityScore += returnOnEquity > 25 ? 12 : returnOnEquity > 15 ? 6 : returnOnEquity > 8 ? 2 : -5;
  }
  if (grossMargin !== null) {
    qualityScore += grossMargin > 60 ? 10 : grossMargin > 40 ? 5 : grossMargin > 20 ? 1 : -3;
  }
  if (operatingMargin !== null) {
    qualityScore += operatingMargin > 25 ? 8 : operatingMargin > 15 ? 4 : operatingMargin > 5 ? 1 : -5;
  }
  if (surpriseRate !== null) {
    qualityScore += surpriseRate > 80 ? 5 : surpriseRate > 60 ? 2 : surpriseRate < 40 ? -3 : 0;
  }
  qualityScore = Math.max(0, Math.min(100, qualityScore));

  // ── Adjusted PEG ─────────────────────────────────────────────────────────
  // Befund 2 der Scoring-Prüfung: Der bereinigte Pfad lief ohne die Wächter,
  // die das forward PEG längst hatte — ein Vendor-PEG von 15.63 (BCHN.SW)
  // drückte so den Bewertungs-Faktor grundlos auf 0/100. Rechnung und Wächter
  // liegen jetzt in `bereinigtesPeg` (rein, getestet); Formel unverändert.
  // Zwei zusätzliche Wachstumsquellen für das PEG (Schindler-Befund: der
  // 5-Jahres-CAGR ist eine Endpunkt-Rechnung, ein starkes Basisjahr blendete
  // das PEG aus, obwohl die Jahresraten im Mittel klar wuchsen):
  // das robuste Raten-Mittel aus der Stabilitätsrechnung (bereits vorhanden)
  // und das erwartete Wachstum aus der Analystenschätzung (wie Yahoo & Co.).
  const wachstumRatenMittel = stabilitaet.mittel !== null ? stabilitaet.mittel * 100 : null;
  let wachstumErwartet: number | null = null;
  if (eps !== null && eps > 0.1 && epsEstimateNextYear !== null && epsEstimateNextYear > 0) {
    wachstumErwartet = ((epsEstimateNextYear - eps) / eps) * 100;
  }

  const bereinigt = bereinigtesPeg({
    vendorPeg: trailingPeg,
    epsVolatility,
    qualityScore,
    epsWachstum5j: epsGrowth5y,
    epsWachstumTTM: epsGrowthTTM,
    wachstumRatenMittel,
    wachstumErwartet,
    // Rückfall, wenn der Vendor kein PEG führt: selbst rechnen aus KGV und
    // belegtem Wachstum (Screener-Befund — betraf reihenweise Nicht-US-Titel).
    kgv: trailingPE,
  });
  const adjustedPeg = bereinigt.peg;

  // ── Forward PEG ──────────────────────────────────────────────────────────
  // Konzeptionell korrekt: Forward PE / zukunftsgerichtetes Wachstum (5Y CAGR)
  // Nicht: Forward PE / historisches TTM-Wachstum (Vergangenheit ≠ Zukunft)
  //
  // Untergrenze für das Wachstum im Nenner: Unter 2 % p.a. ist das PEG keine
  // Aussage mehr, sondern eine Division durch fast null. Ein Titel mit 0.7 %
  // Wachstum bekam so ein PEG von 47 — arithmetisch richtig, inhaltlich
  // wertlos, weil schon ein Zehntelprozent Messfehler im Nenner das Ergebnis
  // halbiert oder verdoppelt. Bei so wenig Wachstum ist die richtige Antwort
  // nicht «PEG 47», sondern «PEG sagt hier nichts» — die Aussage «kaum
  // Wachstum» steht ohnehin schon im Wachstumsfeld daneben.
  const MIN_WACHSTUM_FUER_PEG = 2; // % p.a.
  let forwardPeg: number | null = null;
  if (forwardPE !== null && forwardPE > 0.1 && epsGrowth5y !== null && epsGrowth5y >= MIN_WACHSTUM_FUER_PEG) {
    forwardPeg = forwardPE / epsGrowth5y;
  } else if (forwardPE !== null && forwardPE > 0.1 && epsGrowthTTM !== null && epsGrowthTTM >= MIN_WACHSTUM_FUER_PEG) {
    // Fallback: TTM als Wachstumsschätzung, nur wenn kein 5Y CAGR verfügbar
    forwardPeg = forwardPE / epsGrowthTTM;
  }

  // ── PEG-Quadrant ─────────────────────────────────────────────────────────
  const growthForQuadrant = epsGrowthTTM ?? epsGrowth5y;
  const pegQuadrant = calcPegQuadrant(trailingPE, growthForQuadrant);

  return {
    trailingPeg,
    forwardPeg,
    adjustedPeg,
    adjustedPegGrund: bereinigt.grund,
    adjustedPegHinweis: bereinigt.hinweis,
    adjustedPegRechnung: bereinigt.rechnung,
    pegQuadrant,
    pegQuadrantLabel: pegQuadrantLabel(pegQuadrant),
    roic,
    returnOnEquity,
    grossMargin,
    operatingMargin,
    qualityScore,
    epsGrowthTTM,
    revenueGrowthTTM,
    epsGrowth5y,
    epsVolatility,
    epsWachstumRobust: wachstumRatenMittel,
    epsStabilityScore,
    epsStabilitaetHinweis: stabilitaet.hinweis,
    surpriseRate,
    netDebtToEbitda,
    fcfYield,
    freeCashflow,
    evToEbitda,
    priceToBook,
    ertragsdeckung,
    piotroski,
    trailingPE,
    forwardPE,
    eps,
    epsEstimateNextYear,
    investedCapital,
    nopat,
    dataSource: "EODHD",
    lastUpdated: new Date().toISOString(),
  };
}

// ─── Fallback ─────────────────────────────────────────────────────────────────

function buildFallback(ticker: string, reason: string): QualityMetrics {
  console.warn(`[QualityMetrics] Fallback for ${ticker}: ${reason}`);
  return {
    trailingPeg: null, forwardPeg: null, adjustedPeg: null,
    adjustedPegGrund: null, adjustedPegHinweis: null, adjustedPegRechnung: null,
    pegQuadrant: "unknown", pegQuadrantLabel: "Unbekannt",
    roic: null, returnOnEquity: null, grossMargin: null, operatingMargin: null,
    fcfYield: null, freeCashflow: null, evToEbitda: null, priceToBook: null,
    ertragsdeckung: null,
    piotroski: berechnePiotroski(null),
    qualityScore: 50,
    epsGrowthTTM: null, revenueGrowthTTM: null, epsGrowth5y: null,
    epsVolatility: null, epsWachstumRobust: null, epsStabilityScore: null, epsStabilitaetHinweis: null,
    surpriseRate: null, netDebtToEbitda: null,
    trailingPE: null, forwardPE: null, eps: null, epsEstimateNextYear: null,
    investedCapital: null, nopat: null,
    dataSource: `Fallback (${reason})`,
    lastUpdated: new Date().toISOString(),
  };
}

// ─── Hilfsfunktion ────────────────────────────────────────────────────────────

function parseFloatOrNull(val: any): number | null {
  if (val === null || val === undefined || val === "" || val === "N/A") return null;
  const n = parseFloat(String(val));
  return isNaN(n) ? null : n;
}

// ─── Cache leeren ─────────────────────────────────────────────────────────────

export function clearQualityMetricsCache(ticker?: string): void {
  if (ticker) {
    cache.delete(ticker.toUpperCase());
  } else {
    cache.clear();
  }
}
