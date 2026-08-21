export type ScreenerDatenqualitaetStatus = "geprueft" | "pruefen" | "luecke";

export interface ScreenerDatenqualitaetEingabe {
  isin: string | null;
  primaerTicker: string | null;
  kgvTrailing: number | null;
  kgvSelbst: number | null;
  kgvSelbstHinweis: string | null;
  dividendenValidierung: string | null;
  dividendenPruefgrund: string | null;
}

export interface ScreenerDatenqualitaet {
  status: ScreenerDatenqualitaetStatus;
  gruende: string[];
}

/**
 * Ergänzt die allgemeinen Kurs-/Score-Gründe um die Screener-Evidenz. Ein
 * positiver Befund wird bewusst ebenfalls ausgegeben, damit eine gelbe
 * Kurshistorienampel die belegte Emittentenidentität nicht unsichtbar macht.
 */
export function screenerDatenqualitaetHinweis(
  status: string | null,
  notizen: string | null,
): string[] {
  if (status === "geprueft") return ["Screener: ISIN/Primärticker und Bewertungsbasis geprüft"];
  if (notizen) return notizen.split(" · ").filter(Boolean);
  if (status === "pruefen") return ["Screener: Datenbasis zur Prüfung markiert"];
  if (status === "luecke") return ["Screener: Datenlücke markiert"];
  return [];
}

/**
 * Erklärbare und konservative Qualitätsklassifikation für bereits gerechnete
 * Screenerkandidaten. Die Funktion bewertet keine Anlagequalität, sondern nur
 * Belegbarkeit von Identität und bewertungsrelevanten Anbieterwerten.
 */
export function screenerDatenqualitaet(e: ScreenerDatenqualitaetEingabe): ScreenerDatenqualitaet {
  const gruende: string[] = [];
  let status: ScreenerDatenqualitaetStatus = "geprueft";
  const markiere = (ziel: ScreenerDatenqualitaetStatus, grund: string) => {
    if (ziel === "luecke" || status === "geprueft") status = ziel;
    gruende.push(grund);
  };

  if (!e.isin && !e.primaerTicker) {
    markiere("pruefen", "Keine ISIN und kein Primärticker — Emittentenidentität nicht unabhängig belegbar");
  }
  if (e.kgvSelbst === null && e.kgvTrailing === null) {
    markiere("luecke", "Weder selbst gerechnetes noch Vendor-KGV verfügbar");
  } else if (e.kgvSelbstHinweis?.includes("widersprechen sich")) {
    markiere("pruefen", "Selbst- und Vendor-KGV widersprechen sich — vorsichtigere Zahl verwendet");
  } else if (e.kgvSelbst === null) {
    markiere("pruefen", "KGV nur aus Vendor-Feld — keine Selbst-Gegenprobe verfügbar");
  }
  if (e.dividendenValidierung === "zu_pruefen") {
    markiere("pruefen", e.dividendenPruefgrund ?? "Dividendenrendite durch Gegenprobe auffällig");
  }

  return { status, gruende };
}
