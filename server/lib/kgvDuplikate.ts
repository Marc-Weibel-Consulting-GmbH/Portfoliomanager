/**
 * KGV-Duplikate über Titel hinweg — KIMI-PEG-Audit R3/R6 (Ausweis-Stufe).
 *
 * Identische KGVs verschiedener Emittenten auf 4 Dezimalstellen sind kein
 * Marktbefund, sondern ein Datenartefakt (Lauf #150001: 83 Gruppen, 31 % der
 * Zeilen; Zufallserwartung ~1 Gruppe). Diese Funktion WEIST AUS — sie
 * verändert keine Scores: Erst wenn die Selbstrechnung (`kgvSelbst`) zur
 * Primärquelle wird, verschwinden die Artefakte aus der Rechnung selbst.
 */

export interface KgvDuplikatGruppe {
  /** Der geteilte Wert (auf 4 Dezimalstellen). */
  wert: number;
  /** Alle Ticker mit exakt diesem Wert, in Eingangsreihenfolge. */
  ticker: string[];
}

export function kgvDuplikate(
  zeilen: Array<{ ticker: string; kgv: number | null | undefined }>,
): KgvDuplikatGruppe[] {
  const gruppen = new Map<string, { wert: number; ticker: string[] }>();
  for (const z of zeilen) {
    if (z.kgv === null || z.kgv === undefined || !Number.isFinite(z.kgv)) continue;
    const schluessel = z.kgv.toFixed(4);
    const g = gruppen.get(schluessel);
    if (g) g.ticker.push(z.ticker);
    else gruppen.set(schluessel, { wert: parseFloat(schluessel), ticker: [z.ticker] });
  }
  return [...gruppen.values()].filter((g) => g.ticker.length >= 2);
}
