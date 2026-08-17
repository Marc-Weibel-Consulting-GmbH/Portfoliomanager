/**
 * Selbst gerechnetes Trailing-KGV aus kontrollierten Rohdaten —
 * KIMI-PEG-Audit R2, Schattenphase (noch NICHT Score-Eingang).
 *
 * Warum nicht das Vendor-Feld: `Highlights.PERatio`/`Valuation.ForwardPE`
 * zeigten im Lauf #150001 83 Gruppen verschiedener Firmen mit bit-identischem
 * Wert (31 % der Zeilen, «glatte Brüche» als Raster-Fingerabdruck), und bei
 * Schweizer Titeln sind die Blöcke leer, obwohl Quartalsdaten vorliegen
 * (Novartis: 79 Quartale, PE null).
 *
 * Warum Marktkapitalisierung ÷ TTM-Nettogewinn statt Kurs ÷ EPS: keine
 * Aktienzahl- und keine EPS-Definitionsfalle (bereinigt vs. berichtet).
 * Währungsrisiko (Notiz- vs. Berichtswährung) bleibt — deshalb Schattenphase
 * mit Abweichungs-Ausweis im Export, Umstellung erst nach dem Beleg-Lauf.
 */

export interface KgvSelbstErgebnis {
  kgv: number | null;
  /** Rechenbasis oder Ausblendgrund — erscheint im Export. */
  hinweis: string;
}

export function kgvSelbst(e: {
  marktkapitalisierung: number | null;
  /** Quartals-Nettogewinne, chronologisch (ältester zuerst). */
  quartalsGewinne: number[];
  /** Nettogewinn des letzten Geschäftsjahres — Rückfall ohne 4 Quartale. */
  jahresGewinn: number | null;
}): KgvSelbstErgebnis {
  const mk = e.marktkapitalisierung;
  if (mk === null || !Number.isFinite(mk) || mk <= 0) {
    return { kgv: null, hinweis: "keine Marktkapitalisierung" };
  }

  const quartale = e.quartalsGewinne.filter((v) => Number.isFinite(v));
  let gewinn: number | null = null;
  let basis: string;
  if (quartale.length >= 4) {
    gewinn = quartale.slice(-4).reduce((s, v) => s + v, 0);
    basis = "TTM aus 4 Quartalen";
  } else if (e.jahresGewinn !== null && Number.isFinite(e.jahresGewinn)) {
    gewinn = e.jahresGewinn;
    basis = "letztes Geschäftsjahr (keine 4 Quartale)";
  } else {
    return { kgv: null, hinweis: "keine Gewinnbasis (weder 4 Quartale noch Geschäftsjahr)" };
  }

  if (gewinn <= 0) {
    return { kgv: null, hinweis: `Verlust auf Basis ${basis} — kein KGV` };
  }
  return { kgv: mk / gewinn, hinweis: `Marktkapitalisierung ÷ Gewinn, ${basis}` };
}
