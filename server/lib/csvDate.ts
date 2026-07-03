/**
 * csvDate — expliziter Datumsparser für den CSV-Transaktions-Import
 * (OPTIMIZATION_PLAN.md R-21).
 *
 * Unterstützte Formate (unmissverständlich definiert statt new Date()-Raten):
 * - ISO:      YYYY-MM-DD
 * - Schweiz:  DD.MM.YYYY
 * - Slash:    DD/MM/YYYY — Slash-Datumsangaben werden IMMER als Tag/Monat/Jahr
 *   (Schweizer Konvention) gelesen. 03/04/2026 ist der 3. April 2026, nie der
 *   4. März (vorher deutete `new Date("03/04/2026")` das US-Format MM/DD).
 *
 * Ungültige oder nicht unterstützte Angaben werfen einen deutschen Fehler
 * (wird im Import pro Zeile ausgewiesen). Das Resultat ist UTC-Mitternacht
 * des Kalendertags (Stichtags-Konvention R-17, siehe lib/dateMath.ts).
 */
export function parseCsvDate(dateStr: string): Date {
  const s = (dateStr ?? "").trim();

  let year: number;
  let month: number;
  let day: number;

  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) {
    // ISO YYYY-MM-DD
    year = Number(m[1]);
    month = Number(m[2]);
    day = Number(m[3]);
  } else if ((m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/))) {
    // Schweizer Format DD.MM.YYYY
    day = Number(m[1]);
    month = Number(m[2]);
    year = Number(m[3]);
  } else if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) {
    // Slash-Format: per Konvention DD/MM/YYYY (siehe Modul-Header)
    day = Number(m[1]);
    month = Number(m[2]);
    year = Number(m[3]);
  } else {
    throw new Error(
      `Ungültiges Datum "${s}" — unterstützte Formate: JJJJ-MM-TT, TT.MM.JJJJ oder TT/MM/JJJJ`
    );
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  // Round-Trip-Check fängt Kalender-unmögliche Angaben ab (31.02., Monat 13,
  // Tag 0, US-gedeutete Slash-Daten mit «Monat» > 12 usw.).
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(
      `Ungültiges Datum "${s}" — Tag ${day} / Monat ${month} existiert nicht (erwartet TT.MM.JJJJ bzw. TT/MM/JJJJ)`
    );
  }

  return date;
}
