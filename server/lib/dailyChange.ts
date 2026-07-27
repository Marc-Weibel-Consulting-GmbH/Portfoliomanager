/**
 * Tagesveränderung je Titel aus vorhandenen Daten.
 *
 * Die Spalte «HEUTE» war strukturell 0.00 %: `dailyChangePercent` wurde nirgends
 * erzeugt, weder auf dem Server noch im Schema, und der Client fiel auf `'0'`
 * zurück. Es fehlte keine Berechnung, es fehlte das Feld.
 *
 * Bezugsgrösse ist der letzte Schlusskurs VOR dem heutigen Tag aus
 * `historicalPrices` — die Daten liegen ohnehin für Chart und YTD vor, es
 * braucht keine zusätzliche Datenquelle.
 *
 * Grenze dieser Lösung: `currentPrice` wird per Cron nachgeführt. Ist das ein
 * Tagesschluss, misst die Kennzahl «letzter Schluss → aktueller Stand» und
 * nicht die Bewegung seit Handelsbeginn. Für echte Intraday-Werte bräuchte es
 * einen Live-Endpunkt; das ist bewusst nicht Teil dieser Variante.
 */

/** Ein Schlusskurs aus `historicalPrices`. */
export interface Schlusskurs {
  /** ISO-Datum, YYYY-MM-DD. */
  date: string;
  close: number;
}

export interface Tagesveraenderung {
  /** Veränderung in Prozent, oder null wenn keine Basis vorliegt. */
  percent: number | null;
  /** Datum des herangezogenen Schlusskurses — für die Anzeige «Stand von …». */
  basisDate: string | null;
}

/**
 * Letzter Schlusskurs strikt VOR `heute`.
 *
 * Der heutige Eintrag wird ausgeschlossen: liegt er bereits vor, ist er in
 * aller Regel identisch mit `currentPrice` und die Veränderung wäre 0 % —
 * also genau das Symptom, das behoben werden soll.
 */
export function letzterSchlussVor(kurse: Schlusskurs[], heute: string): Schlusskurs | null {
  let treffer: Schlusskurs | null = null;
  for (const k of kurse) {
    if (!k || typeof k.date !== "string") continue;
    if (!Number.isFinite(k.close) || k.close <= 0) continue;
    if (k.date >= heute) continue;
    if (treffer === null || k.date > treffer.date) treffer = k;
  }
  return treffer;
}

/**
 * Tagesveränderung aus aktuellem Kurs und Kurshistorie.
 *
 * Beide Kurse müssen in derselben Währung vorliegen — die Veränderung ist ein
 * Verhältnis, ein FX-Satz kürzt sich also heraus, solange er für beide gilt.
 */
export function berechneTagesveraenderung(
  aktuellerKurs: number | null | undefined,
  kurse: Schlusskurs[],
  heute: string,
): Tagesveraenderung {
  const kurs = typeof aktuellerKurs === "number" ? aktuellerKurs : NaN;
  if (!Number.isFinite(kurs) || kurs <= 0) return { percent: null, basisDate: null };

  const basis = letzterSchlussVor(kurse ?? [], heute);
  if (!basis) return { percent: null, basisDate: null };

  return {
    percent: ((kurs - basis.close) / basis.close) * 100,
    basisDate: basis.date,
  };
}
