/**
 * dateMath — zentrale Day-Count-, Annualisierungs- und Stichtags-Konvention
 * (OPTIMIZATION_PLAN.md R-16/R-17).
 *
 * Day-Count-Konvention (R-16):
 * - Tagesdifferenz = floor(exakte UTC-Millisekunden-Differenz / 86'400'000).
 *   KEIN Math.abs (das unsortierte Inputs maskiert — negative Differenz heisst
 *   b liegt vor a) und KEIN Math.ceil (Off-by-one bei Teil-Tagen).
 * - Jahresbasis: 365.25 Tage (statt der bisher gemischten 365/365.25).
 * - Annualisierung: geometrisch, (1+r)^(1/Jahre) − 1, NUR für Perioden
 *   > 1 Jahr. Unterjährige Perioden weisen die Periodenrendite unverändert
 *   aus — keine lineare oder geometrische Hochrechnung (eine +2-%-Woche ist
 *   keine «+104 % p.a.»).
 *
 * Stichtags-Konvention (R-17):
 * - Transaktions-Timestamps werden auf UTC-Kalendertage gebucketed
 *   (`toUTCDateString`), konsistent zu den Preisdaten (historicalPrices.date
 *   ist ein UTC-Datumsstring). Eine 00:30-CET-Transaktion gehört damit zum
 *   VORTAG in UTC — das ist beabsichtigt und systemweit einheitlich; lokale
 *   Server-Zeitzonen (`new Date(year, 0, 1)` etc.) dürfen für Stichtage nicht
 *   verwendet werden.
 */

export const MS_PER_DAY = 86_400_000;
export const DAYS_PER_YEAR = 365.25;

export type DateInput = Date | string | number;

function toMs(d: DateInput): number {
  const t = d instanceof Date ? d.getTime() : new Date(d).getTime();
  if (Number.isNaN(t)) {
    throw new Error(`dateMath: ungültiges Datum: ${String(d)}`);
  }
  return t;
}

/**
 * Ganze Tage zwischen `a` und `b` (b − a), floor der exakten ms-Differenz.
 * Vorzeichenbehaftet: negativ, wenn `b` vor `a` liegt.
 */
export function daysBetweenUTC(a: DateInput, b: DateInput): number {
  return Math.floor((toMs(b) - toMs(a)) / MS_PER_DAY);
}

/** Jahre zwischen `a` und `b` auf 365.25-Basis (vorzeichenbehaftet). */
export function yearsBetween(a: DateInput, b: DateInput): number {
  return daysBetweenUTC(a, b) / DAYS_PER_YEAR;
}

/**
 * Geometrische Annualisierung einer Periodenrendite (Dezimalform, 0.05 = 5 %).
 * Nur für Perioden > 1 Jahr angewandt; unterjährig wird die Periodenrendite
 * unverändert zurückgegeben (R-16). Totalverlust (r ≤ −100 %) wird nicht
 * transformiert.
 */
export function annualizeReturn(totalReturn: number, years: number): number {
  if (!(years > 1)) return totalReturn;
  if (totalReturn <= -1) return totalReturn;
  return Math.pow(1 + totalReturn, 1 / years) - 1;
}

/**
 * Bucketet einen Zeitpunkt auf seinen UTC-Kalendertag (YYYY-MM-DD).
 * Konvention R-17: Transaktions-Timestamps zählen zum UTC-Tag, nicht zum
 * lokalen Server-Tag (siehe Modul-Header).
 */
export function toUTCDateString(d: DateInput): string {
  return new Date(toMs(d)).toISOString().split("T")[0];
}
