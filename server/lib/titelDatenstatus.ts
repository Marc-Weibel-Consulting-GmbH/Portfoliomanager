/**
 * Titel-Datenqualitäts-Status (K9, design/KONSOLIDIERUNG_RECHENWERKE.md,
 * Soll-Ablauf Station S2).
 *
 * Jeder Titel des Universums trägt eine Ampel: «vollständig» (Historie,
 * Aktualität und Score-Basis reichen für eine belastbare Rechnung),
 * «lückenhaft» (etwas fehlt grundsätzlich) oder «veraltet» (Daten da, aber
 * nicht mehr frisch). Die Gründe stehen dabei — die Ampel ersetzt kein
 * Urteil, sie erklärt es.
 *
 * Die Schwellen folgen der Kernrechnung: Das Timing braucht mindestens 60
 * Kurse, das 52-Wochen-Band ein volles Handelsjahr (~250 Tage); ein Titel
 * ohne Schlusskurs seit zwei Wochen oder ohne Kennzahlen-Refresh seit einem
 * Monat rechnet auf altem Stand.
 */

export const KURS_MINDESTTAGE = 250;
export const KURS_VERALTET_TAGE = 14;
export const KENNZAHLEN_VERALTET_TAGE = 30;

export type DatenstatusStufe = "vollstaendig" | "lueckenhaft" | "veraltet";

export interface TitelDatenlage {
  /** Anzahl Handelstage in der Kursreihe (historical_prices). */
  kursTage: number;
  /** Jüngster Kurstag (YYYY-MM-DD) oder null ohne Kursreihe. */
  letzterKursTag: string | null;
  /** Letzter Kennzahlen-Refresh (stocks.lastMetricsUpdate) oder null. */
  letzteKennzahlen: Date | string | null;
  /** Qualitäts-Score vorhanden (stock_scores.qualitaet). */
  hatQualitaet: boolean;
  /** Timing-Score vorhanden (stock_scores.timing). */
  hatTiming: boolean;
  /** Bezugszeitpunkt (injizierbar für Tests). */
  heute: Date;
}

export interface TitelDatenstatus {
  status: DatenstatusStufe;
  gruende: string[];
}

const TAG_MS = 24 * 60 * 60 * 1000;

function tageSeit(wert: Date | string | null, heute: Date): number | null {
  if (wert == null) return null;
  const d = typeof wert === "string" ? new Date(`${wert}T00:00:00Z`) : wert;
  const t = d.getTime();
  if (!Number.isFinite(t)) return null;
  return (heute.getTime() - t) / TAG_MS;
}

/** Ampel je Titel: erst Lücken prüfen, dann Frische — Lücke schlägt veraltet. */
export function titelDatenstatus(lage: TitelDatenlage): TitelDatenstatus {
  const luecken: string[] = [];
  const frische: string[] = [];

  if (lage.kursTage === 0) {
    luecken.push("keine Kursreihe");
  } else if (lage.kursTage < KURS_MINDESTTAGE) {
    luecken.push(`Kursreihe nur ${lage.kursTage} Tage (nötig ~${KURS_MINDESTTAGE} für 52-Wochen-Band und Timing)`);
  }
  if (!lage.hatQualitaet) luecken.push("kein Qualitäts-Score berechnet");
  if (!lage.hatTiming) luecken.push("kein Timing-Score berechnet");

  const kursAlter = tageSeit(lage.letzterKursTag, lage.heute);
  if (lage.kursTage > 0 && kursAlter != null && kursAlter > KURS_VERALTET_TAGE) {
    frische.push(`letzter Kurs vor ${Math.floor(kursAlter)} Tagen`);
  }
  const kennzahlenAlter = tageSeit(lage.letzteKennzahlen, lage.heute);
  if (kennzahlenAlter == null) {
    luecken.push("Kennzahlen nie aktualisiert");
  } else if (kennzahlenAlter > KENNZAHLEN_VERALTET_TAGE) {
    frische.push(`Kennzahlen vor ${Math.floor(kennzahlenAlter)} Tagen aktualisiert`);
  }

  if (luecken.length > 0) return { status: "lueckenhaft", gruende: [...luecken, ...frische] };
  if (frische.length > 0) return { status: "veraltet", gruende: frische };
  return { status: "vollstaendig", gruende: [] };
}
