/**
 * Namensabgleich als LETZTE Dedup-Stufe des Screeners.
 *
 * Befund (KIMI Punkt 4, Manus «14 identische Namensgruppen»): Bei
 * Kreuznotierungen liefert die Hauptnotiz ISIN und Primärticker, der deutsche
 * bzw. internationale Zweitplatz oft keinen Anbieteridentifikator — die
 * ISIN-/Primärticker-Deduplizierung greift dann ins Leere und Capgemini,
 * Safran & Co. stehen doppelt in der Kandidatenliste.
 *
 * Eine reine Namensbereinigung wäre fachlich unzulässig (Manus): BP-Klassen
 * oder Sixt Stamm/Vorzug tragen denselben Namen und sind verschiedene
 * Gattungen. Deshalb sortiert die Stufe nur aus, wenn ALLES zusammenkommt:
 * die Zeile hat weder ISIN noch Primärticker, eine identifizierte
 * Partnerzeile trägt denselben normalisierten Namen an einer ANDEREN Börse,
 * kein Gattungs-Marker im Namen, und die Sektoren widersprechen sich nicht.
 * Alles andere bleibt stehen — dafür gibt es die Review-Queue im Export.
 */

export interface NamensDedupZeile {
  ticker: string;
  name: string | null;
  boerse: string | null;
  sektor: string | null;
  isin: string | null;
  primaerTicker: string | null;
}

/**
 * Aktiengattungs-Marker: Solche Zeilen sind KEINE Kreuznotierungs-Kandidaten —
 * Stamm und Vorzug desselben Emittenten sind verschiedene Papiere.
 */
const GATTUNGS_MUSTER =
  /\b(vorzugs?\w*|vz[o]?|pref\w*|prf|non[- ]?voting|stimmrechtslos\w*|genussschein\w*|partizipations?\w*|participation)\b/i;

/** Rechtsform-Wörter, die am Namensende keine Identität tragen. */
const RECHTSFORM_SUFFIXE = new Set([
  "sa", "se", "plc", "nv", "n", "v", "s", "a", "ag", "spa", "oyj", "ab", "asa",
  "as", "kgaa", "inc", "corp", "ltd", "limited", "co", "adr",
]);

export function normalisierterName(name: string | null): string {
  if (!name) return "";
  const woerter = name
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[.,'’&()/-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  while (woerter.length > 1 && RECHTSFORM_SUFFIXE.has(woerter[woerter.length - 1])) {
    woerter.pop();
  }
  return woerter.join(" ");
}

export function namensDuplikate(
  berechnete: NamensDedupZeile[],
): Array<{ ticker: string; grund: string }> {
  const gruppen = new Map<string, NamensDedupZeile[]>();
  for (const z of berechnete) {
    if (GATTUNGS_MUSTER.test(z.name ?? "")) continue;
    const schluessel = normalisierterName(z.name);
    if (!schluessel) continue;
    const gruppe = gruppen.get(schluessel);
    if (gruppe) gruppe.push(z);
    else gruppen.set(schluessel, [z]);
  }

  const treffer: Array<{ ticker: string; grund: string }> = [];
  for (const zeilen of gruppen.values()) {
    if (zeilen.length < 2) continue;
    const anker = zeilen.filter((z) => z.isin || z.primaerTicker);
    if (anker.length === 0) continue;
    for (const z of zeilen) {
      if (z.isin || z.primaerTicker) continue;
      const partner = anker.find((a) =>
        a.boerse !== z.boerse &&
        (!a.sektor || !z.sektor || a.sektor === z.sektor));
      if (partner) {
        treffer.push({
          ticker: z.ticker,
          grund: `Namensgleich mit ${partner.ticker}${partner.boerse ? ` (${partner.boerse})` : ""} — Zweitnotiz ohne Anbieteridentität`,
        });
      }
    }
  }
  return treffer;
}
