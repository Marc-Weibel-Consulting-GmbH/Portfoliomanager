/**
 * Die drei Scores für einen Titel — Qualität, Bewertung, Timing.
 *
 * Bündelt `qualityMetricsService` (EODHD-Fundamentaldaten, 6-Stunden-Cache) mit
 * der Dividendenrendite aus der `stocks`-Tabelle und rechnet daraus die beiden
 * neuen Scores. Timing kommt unverändert aus dem bestehenden Signal-Score und
 * wird hier nur durchgereicht, sofern bekannt.
 *
 * Kein zusätzlicher externer Abruf: `getQualityMetrics` holt die vollständige
 * Fundamentaldaten-Antwort ohnehin.
 */

import {
  berechneQualitaet,
  berechneBewertung,
  qualitaetsBand,
  bewertungsBand,
  type QualitaetsScore,
  type TeilScore,
} from "./dreiScores";

export interface DreiScores {
  ticker: string;
  qualitaet: QualitaetsScore & { band: string };
  bewertung: TeilScore & { band: string };
  timing: {
    /** 0–100 aus `berechneTiming` (Kursreihe), `null` wenn zu wenig Historie. */
    score: number | null;
    /** Belegtes Timing-Gewicht 0–1, wenn bekannt. */
    abdeckung: number | null;
    /** Faktorwerte (Momentum, RSI, …), sofern abgelegt. */
    faktoren?: { name: string; wert: number | null; punkte: number | null; gewicht: number }[];
    hinweis: string;
  };
  /**
   * Das abgeleitete Signal — die EINE Formel (`rechneSignal`), dieselbe, die
   * die Empfehlung im Signal-Cache bestimmt. Die Titelansicht zeigt es als
   * Farbskala unter den drei Kreisen (STRATEGIE_DREI_SCORES.md, Abschnitt 3).
   */
  signal: {
    score: number | null;
    label: string | null;
    klartext: string;
  };
  /** Der bisherige Einzelscore, zum Vergleich während der Umstellung. */
  bisher: number | null;
}

function zahl(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

export async function getDreiScores(ticker: string): Promise<DreiScores> {
  // Zuerst die vorgerechneten Werte: Der stuendliche Signal-Cron legt sie ab.
  // Nur wenn dort nichts steht — neuer Titel, Cron noch nicht gelaufen —, wird
  // live gerechnet. Das spart je Seitenaufruf einen EODHD-Abruf.
  const vorberechnet = await leseVorberechnet(ticker);
  if (vorberechnet) return vorberechnet;

  const { getQualityMetrics } = await import("./qualityMetricsService");
  const qm = await getQualityMetrics(ticker);

  // Dividendenrendite und die bisherigen Scores stehen in der DB, nicht in der
  // EODHD-Antwort. Fehlt die Datenbank, tragen die übrigen Faktoren.
  let dividendenrendite: number | null = null;
  let bisher: number | null = null;
  let sektor: string | null = null;
  try {
    const { getDb } = await import("../db");
    const db = await getDb();
    if (db) {
      const { stocks } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const [row] = await db
        .select({
          dividendYield: stocks.dividendYield,
          score: stocks.score,
          sector: stocks.sector,
        })
        .from(stocks)
        .where(eq(stocks.ticker, ticker))
        .limit(1);
      if (row) {
        dividendenrendite = zahl(row.dividendYield);
        bisher = zahl(row.score);
        sektor = row.sector ?? null;
      }
    }
  } catch (e) {
    console.warn(`[DreiScores] DB-Zugriff für ${ticker} fehlgeschlagen:`, (e as Error).message);
  }

  const qualitaet = berechneQualitaet(
    {
      roic: qm.roic,
      betriebsmarge: qm.operatingMargin,
      bruttomarge: qm.grossMargin,
      ertragsdeckung: qm.ertragsdeckung,
      epsStabilitaet: qm.epsStabilityScore,
      netDebtToEbitda: qm.netDebtToEbitda,
    },
    qm.piotroski,
  );

  const bewertung = berechneBewertung({
    adjustedPeg: qm.adjustedPeg,
    kgv: qm.forwardPE ?? qm.trailingPE,
    fcfRendite: qm.fcfYield,
    dividendenrendite,
    kursBuchwert: qm.priceToBook,
    epsWachstumTTM: qm.epsGrowthTTM,
    epsWachstum5j: qm.epsGrowth5y,
    sektor,
  });

  // Timing braucht die Kursreihe; die liegt hier nicht vor. Der Cron traegt
  // sie stuendlich nach — bis dahin rechnet das Signal aus Qualitaet und
  // Bewertung (65 % Gewicht, ueber der Mindestabdeckung) statt gar nicht.
  const { rechneSignal } = await import("./dreiScoreSignal");
  const sig = rechneSignal({
    qualitaet: qualitaet.gesamt, bewertung: bewertung.score, timing: null, regime: null,
  });

  return {
    ticker,
    qualitaet: { ...qualitaet, band: qualitaetsBand(qualitaet.gesamt) },
    bewertung: { ...bewertung, band: bewertungsBand(bewertung.score) },
    timing: {
      score: null,
      abdeckung: null,
      faktoren: [],
      hinweis: "Noch nicht berechnet — der stündliche Lauf trägt das Timing nach",
    },
    signal: { score: sig.score, label: sig.label, klartext: sig.klartext },
    bisher,
  };
}

/**
 * Vorberechnete Scores aus `stock_scores`, ergaenzt um Signal und Altscore.
 *
 * Gibt `null` zurueck, wenn nichts abgelegt ist — dann rechnet der Aufrufer
 * live weiter.
 */
async function leseVorberechnet(ticker: string): Promise<DreiScores | null> {
  try {
    const { leseScores } = await import("./dreiScoresStore");
    const treffer = (await leseScores([ticker])).get(ticker);
    if (!treffer) return null;

    let bisher: number | null = null;
    try {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (db) {
        const { stocks } = await import("../../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const [row] = await db
          .select({ score: stocks.score })
          .from(stocks).where(eq(stocks.ticker, ticker)).limit(1);
        if (row) bisher = zahl(row.score);
      }
    } catch { /* Ohne DB tragen die vorberechneten Werte allein. */ }

    return {
      ticker,
      qualitaet: {
        gesamt: treffer.qualitaet,
        band: treffer.qualitaetBand,
        // Die abgelegten Faktorwerte — der Erklaerdialog zeigt damit die
        // Zahlen DIESES Titels, nicht nur die generische Zusammensetzung.
        niveau: {
          score: treffer.niveau,
          abdeckung: treffer.abdeckungNiveau,
          faktoren: (treffer.qualitaetFaktoren as any) ?? [],
        },
        richtung: {
          score: treffer.richtung,
          fScore: treffer.fScore,
          berechenbar: treffer.fScoreBerechenbar,
          details: { score: treffer.fScore, berechenbar: treffer.fScoreBerechenbar,
                     hochgerechnet: null, kriterien: [] },
        },
      },
      bewertung: {
        score: treffer.bewertung,
        band: treffer.bewertungBand,
        abdeckung: treffer.abdeckungBewertung,
        faktoren: (treffer.bewertungFaktoren as any) ?? [],
      },
      timing: {
        score: treffer.timing,
        abdeckung: treffer.timingAbdeckung,
        faktoren: (treffer.timingFaktoren as any) ?? [],
        hinweis: treffer.timing === null
          ? "Zu wenig Kurshistorie für einen Timing-Score"
          : "Momentum, RSI, 52-Wochen-Lage und Blasensignal — misst den Zeitpunkt, nicht das Unternehmen",
      },
      signal: {
        score: treffer.signalScore,
        label: treffer.signalLabel,
        klartext: treffer.signalLabel === null
          ? "Zu wenige Scores für ein Signal"
          : `Aus den drei Scores, gewichtet nach Marktlage (${treffer.regime ?? "neutral"})`,
      },
      bisher,
    };
  } catch {
    return null;
  }
}
