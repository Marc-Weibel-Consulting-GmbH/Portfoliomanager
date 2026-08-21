/**
 * ISIN-basierte Deduplizierung von Screener-Kandidaten.
 *
 * Die ISIN identifiziert ein konkretes Wertpapier über Börsen hinweg. Sie wird
 * nur verwendet, wenn sie auf mindestens zwei berechnete Zeilen exakt gleich
 * vorliegt und genau eine dieser Zeilen ihren Anbieter-Primärticker bestätigt.
 * Mehrdeutige Gruppen bleiben bewusst in der Review-Queue; eine fehlende ISIN
 * ist niemals ein Grund für eine automatische Zusammenführung.
 */

export interface EmittentenDedupZeile {
  ticker: string;
  isin: string | null;
  primaerTicker: string | null;
  boerse: string | null;
}

function vergleichsTicker(ticker: string | null): string | null {
  if (!ticker?.trim()) return null;
  const up = ticker.trim().toUpperCase();
  const punkt = up.lastIndexOf(".");
  if (punkt < 1) return `${up}.US`;
  const code = up.slice(0, punkt);
  const suffix = up.slice(punkt + 1);
  const normalisiert = suffix === "XETRA" ? "DE" : suffix === "LSE" ? "L" : suffix === "SWX" ? "SW" : suffix;
  return `${code}.${normalisiert}`;
}

/**
 * Liefert ausschliesslich eindeutig belegte Zweitnotierungen. Unterschiedliche
 * Aktiengattungen haben unterschiedliche ISINs; konfliktäre oder unvollständige
 * Anbieterangaben bleiben absichtlich unberührt.
 */
export function isinDuplikate(zeilen: EmittentenDedupZeile[]): Array<{ ticker: string; grund: string }> {
  const gruppen = new Map<string, EmittentenDedupZeile[]>();
  for (const z of zeilen) {
    const isin = z.isin?.trim().toUpperCase();
    if (!isin) continue;
    const gruppe = gruppen.get(isin);
    if (gruppe) gruppe.push(z);
    else gruppen.set(isin, [z]);
  }

  const treffer: Array<{ ticker: string; grund: string }> = [];
  for (const [isin, gruppe] of gruppen) {
    if (gruppe.length < 2) continue;
    const primaere = gruppe.filter((z) => {
      const ticker = vergleichsTicker(z.ticker);
      const primaer = vergleichsTicker(z.primaerTicker);
      return ticker !== null && ticker === primaer;
    });
    // Genau eine als Hauptnotierung belegte Zeile ist die einzige sichere
    // Grundlage für einen automatischen Ausschluss. Bei mehreren oder keiner
    // Primärangabe kann die Review-Queue eine bewusste Entscheidung ermöglichen.
    if (primaere.length !== 1) continue;
    const haupt = primaere[0]!;
    for (const z of gruppe) {
      if (z.ticker === haupt.ticker) continue;
      treffer.push({
        ticker: z.ticker,
        grund: `ISIN ${isin} identisch mit Hauptnotiz ${haupt.ticker}${haupt.boerse ? ` (${haupt.boerse})` : ""}`,
      });
    }
  }
  return treffer;
}
