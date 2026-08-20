/**
 * Anlage-Kategorie eines Titels aus Sektor und Dividendenrendite.
 *
 * Die Heuristik stand zweimal als Inline-Kopie im `watchlistRouter`
 * (Wikifolio-Import und «Sektoren anreichern») — mit leicht abweichenden
 * Sektorlisten. Hier die Vereinigung beider Fassungen als EINE Funktion,
 * neu auch von der Screener-Übernahme genutzt (Marc-Befund 19.08.:
 * übernommene Titel standen ohne Kategorie im Universum).
 *
 * Reihenfolge bewusst: Eine belastbare Ausschüttung (> 2.5 %) schlägt die
 * Sektor-Zuordnung — ein ausschüttungsstarker Technologie-Titel ist für die
 * Einkommens-Sicht eine Dividendenaktie.
 */
export function titelKategorie(
  sektor: string | null | undefined,
  dividendenrendite: number | null | undefined,
): string {
  if (dividendenrendite !== null && dividendenrendite !== undefined
      && Number.isFinite(dividendenrendite) && dividendenrendite > 2.5) {
    return "Dividendenaktien";
  }
  const s = (sektor ?? "").toLowerCase();
  if (s) {
    if (s.includes("technology") || s.includes("communication") || s.includes("semiconductor")) return "Wachstumsaktien";
    if (s.includes("financial") || s.includes("real estate") || s.includes("bank")) return "Value";
    if (s.includes("consumer") || s.includes("health") || s.includes("utilities") || s.includes("pharma")) return "Dividendenaktien";
    if (s.includes("industrial") || s.includes("material") || s.includes("energy")) return "Value";
  }
  return "Wachstumsaktien";
}
