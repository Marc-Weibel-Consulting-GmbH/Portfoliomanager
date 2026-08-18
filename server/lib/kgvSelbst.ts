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

/**
 * Ab dieser Abweichung gelten Selbstrechnung und Vendor-Feld als Widerspruch.
 * Der Beleg-Lauf #180001 zeigte Median-Abweichung 1.02–1.06 auf allen sechs
 * Börsen und nur ~10 % der Titel über 1.5 — die Schwelle trennt also
 * Rundungs- und Stichtagsdifferenzen von echten Datenfehlern.
 */
const KGV_WIDERSPRUCH_FAKTOR = 1.5;

/**
 * E4b: Das KGV für den Bewertungs-Score — Selbstrechnung als Primärquelle,
 * Vendor-Feld als Gegenprobe.
 *
 * Warum die Selbstrechnung führt: Manus' R1-Rohdiagnose bewies, dass das
 * Vendor-Feld `Valuation.ForwardPE` über verschiedene Firmen bit-identisch
 * dupliziert ankommt, und der Beleg-Lauf #180001 validierte die eigene
 * Rechnung (Marktkapitalisierung ÷ TTM-Gewinn, datumsgefenstert) mit 90 %
 * Abdeckung und Median-Abweichung 1.02–1.06 zum Vendor-Trailing. Sie füllt
 * zudem 12 Vendor-Lücken (v. a. Schweizer Titel mit leeren Vendor-Blöcken).
 *
 * Bei Widerspruch über Faktor 1.5 zählt die vorsichtigere Zahl — das HÖHERE
 * KGV, denn ein zu tiefes KGV schenkt unverdiente Bewertungspunkte (dieselbe
 * Regel wie die PEG-Gegenprobe in bereinigtesPeg.ts).
 */
export function kgvMitGegenprobe(
  selbst: number | null,
  vendorTrailing: number | null,
  vendorForward: number | null,
): { kgv: number | null; hinweis: string | null } {
  const s = selbst !== null && Number.isFinite(selbst) && selbst > 0 ? selbst : null;
  const vt = vendorTrailing !== null && Number.isFinite(vendorTrailing) && vendorTrailing > 0
    ? vendorTrailing : null;
  const vf = vendorForward !== null && Number.isFinite(vendorForward) && vendorForward > 0
    ? vendorForward : null;

  // Ohne Selbstrechnung (Verlust, keine Gewinnbasis, keine Marktkapitalisierung)
  // trägt das Vendor-Feld wie bisher — Trailing vor Forward (E4a).
  if (s === null) return { kgv: vt ?? vf, hinweis: null };

  // Gegenprobe gegen das individuelle Trailing-Feld; Forward nur als Ersatz.
  const vendor = vt ?? vf;
  if (vendor === null) {
    return { kgv: s, hinweis: "KGV selbst gerechnet (kein Vendor-KGV als Gegenprobe)" };
  }

  const faktor = Math.max(s, vendor) / Math.min(s, vendor);
  if (faktor > KGV_WIDERSPRUCH_FAKTOR) {
    const vorsichtiger = Math.max(s, vendor);
    return {
      kgv: vorsichtiger,
      hinweis:
        `Eigenes KGV (${s.toFixed(1)}) und Vendor-KGV (${vendor.toFixed(1)}) ` +
        `widersprechen sich (über Faktor ${KGV_WIDERSPRUCH_FAKTOR}) — ` +
        `vorsichtigere Zahl verwendet`,
    };
  }
  return { kgv: s, hinweis: null };
}
