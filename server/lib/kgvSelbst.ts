/**
 * Selbst gerechnetes Trailing-KGV aus kontrollierten Rohdaten —
 * KIMI-PEG-Audit R2, Schattenphase (noch NICHT Score-Eingang).
 *
 * Warum nicht das Vendor-Feld: `Highlights.PERatio`/`Valuation.ForwardPE`
 * zeigten im Lauf #150001 83 Gruppen verschiedener Firmen mit bit-identischem
 * Wert, und bei Schweizer Titeln sind die Blöcke leer, obwohl Quartalsdaten
 * vorliegen (Novartis: 79 Quartale, PE null).
 *
 * TTM nach DATUM gefenstert, nicht nach Anzahl: EODHD legt für europäische
 * Halbjahres-Berichterstatter die Semester in die «Quartals»-Slots. Eine
 * Summe der letzten 4 Einträge addiert dort ZWEI Jahre Gewinn und halbiert
 * das KGV — der Beleg-Lauf zeigte Median-Abweichung ~1.9 an PA/SIX/LSE,
 * aber 1.01 an US/XETRA (echte Quartale).
 */

export interface KgvSelbstErgebnis {
  kgv: number | null;
  /** Rechenbasis oder Ausblendgrund — erscheint im Export. */
  hinweis: string;
}

/** Fensterlänge der TTM-Summe ab dem jüngsten Berichtsdatum. */
const TTM_FENSTER_TAGE = 360;
/** Die gefensterten Perioden müssen zusammen ungefähr ein Jahr abdecken. */
const MIN_ABDECKUNG_TAGE = 300;

export function kgvSelbst(e: {
  marktkapitalisierung: number | null;
  /** Berichtsperioden-Nettogewinne, chronologisch (ältester zuerst). */
  quartalsGewinne: Array<{ datum: string; gewinn: number }>;
  /** Nettogewinn des letzten Geschäftsjahres — Rückfall ohne volles TTM-Fenster. */
  jahresGewinn: number | null;
}): KgvSelbstErgebnis {
  const mk = e.marktkapitalisierung;
  if (mk === null || !Number.isFinite(mk) || mk <= 0) {
    return { kgv: null, hinweis: "keine Marktkapitalisierung" };
  }

  const gueltige = e.quartalsGewinne.filter(
    (q) => Number.isFinite(q.gewinn) && Number.isFinite(Date.parse(q.datum)));

  let gewinn: number | null = null;
  let basis: string | null = null;
  if (gueltige.length >= 2) {
    const letztes = Date.parse(gueltige[gueltige.length - 1].datum);
    const fenster = gueltige.filter((q) => letztes - Date.parse(q.datum) < TTM_FENSTER_TAGE * 86_400_000);
    const n = fenster.length;
    if (n >= 2) {
      // Abdeckung = Spanne der Startdaten hochgerechnet um eine Periodenlänge:
      // 4 Quartale spannen ~270 Tage, decken aber 360 ab; 2 Semester spannen
      // ~180 und decken 360. Erst ab einem vollen Jahr trägt die Summe.
      const spanne = (letztes - Date.parse(fenster[0].datum)) / 86_400_000;
      const abdeckung = spanne * (n / (n - 1));
      if (abdeckung >= MIN_ABDECKUNG_TAGE) {
        gewinn = fenster.reduce((s, q) => s + q.gewinn, 0);
        basis = `TTM aus ${n} Berichtsperioden`;
      }
    }
  }
  if (gewinn === null) {
    if (e.jahresGewinn !== null && Number.isFinite(e.jahresGewinn)) {
      gewinn = e.jahresGewinn;
      basis = "letztes Geschäftsjahr (kein volles TTM-Fenster)";
    } else {
      return { kgv: null, hinweis: "keine Gewinnbasis (weder volles TTM-Fenster noch Geschäftsjahr)" };
    }
  }

  if (gewinn <= 0) {
    return { kgv: null, hinweis: `Verlust auf Basis ${basis} — kein KGV` };
  }
  return { kgv: mk / gewinn, hinweis: `Marktkapitalisierung ÷ Gewinn, ${basis}` };
}
