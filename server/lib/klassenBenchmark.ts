/**
 * Vergleichsmassstab für Multi-Asset-Vorschläge.
 *
 * Bisher wurde jeder Vorschlag gegen einen Schweizer AKTIENindex gemessen —
 * auch dann, wenn er nach Anlegerprofil zu 25 % aus Obligationen und zu 7 % aus
 * Gold besteht. Eine Obligationen-Quote bleibt hinter einem Aktienindex
 * strukturell zurück, ohne dass das irgendetwas über die Qualität des
 * Vorschlags aussagt. Gemessen wurde damit vor allem die Aktienquote.
 *
 * Für die Lernschleife ist das nicht bloss ungenau, sondern gerichtet: Ein
 * Verfahren, das nach «Alpha gegen Aktien» optimiert, wandert mit der Zeit
 * Richtung Aktien — unabhängig davon, was dem Anlegerprofil entspricht.
 *
 * Der richtige Massstab ist dasselbe Anlegerprofil, passiv umgesetzt: Soll-
 * Quote je Anlageklasse mal Rendite eines Referenzinstruments dieser Klasse.
 * Die Frage lautet dann nicht mehr «hat der Vorschlag Aktien geschlagen»,
 * sondern «hat er eine schlichte Indexumsetzung desselben Profils geschlagen».
 * Das ist die Frage, auf die es ankommt.
 *
 * Bewusst die SOLL-Quoten des Profils, nicht die tatsächlichen Gewichte des
 * Vorschlags: Sonst übernähme der Massstab die Allokationsentscheidung und
 * könnte sie nicht mehr bewerten.
 */

import type { SleeveAssetKey } from "./multiAssetSleeve";

export interface KlassenReferenz {
  ticker: string;
  name: string;
  currency: string;
}

/**
 * Referenzinstrument je Anlageklasse.
 *
 * Für Aktien der bestehende Schweizer Index (Schlüssel «SMI» in `benchmarkData`,
 * tatsächlich der SPI — siehe benchmarkIdentity.ts). Für die übrigen Klassen
 * jeweils der Baustein, den der Sleeve selbst bevorzugt. Dass ein Sleeve-ETF
 * damit gegen sich selbst gemessen wird, ist kein Mangel: Es macht sichtbar,
 * dass in diesen Klassen keine aktive Entscheidung getroffen wird — das Alpha
 * entsteht in der Titelauswahl, und genau dort soll es auch gemessen werden.
 */
export const KLASSEN_REFERENZ: Record<SleeveAssetKey, KlassenReferenz> = {
  equity:     { ticker: "CHSPI.SW", name: "SPI (Schweizer Aktien)",        currency: "CHF" },
  bond:       { ticker: "AGGH.SW",  name: "Global Aggregate Bond (EUR-h)", currency: "EUR" },
  commodity:  { ticker: "CMDY",     name: "Bloomberg Rohstoffe",            currency: "USD" },
  gold:       { ticker: "ZGLD.SW",  name: "Swisscanto Gold",                currency: "CHF" },
  realestate: { ticker: "REET",     name: "Global REIT",                    currency: "USD" },
  crypto:     { ticker: "ABTC.SW",  name: "21Shares Bitcoin",               currency: "CHF" },
};

export interface KlassenRendite {
  klasse: SleeveAssetKey;
  /** Soll-Quote der Klasse laut Anlegerprofil, in Prozent. */
  sollQuotePct: number;
  /** Rendite des Referenzinstruments in CHF über das Fenster, oder null. */
  chfReturn: number | null;
}

export interface CompositeErgebnis {
  /** Gewichtete Rendite des passiv umgesetzten Profils, als Dezimalbruch. */
  compositeReturn: number;
  /** Anteil der Soll-Quoten, für den eine Rendite vorlag (0–100). */
  abdeckungPct: number;
  /** Beitrag je Klasse — macht nachvollziehbar, woher der Wert kommt. */
  beitraege: { klasse: SleeveAssetKey; gewichtPct: number; chfReturn: number }[];
}

/**
 * Gewichtete Rendite des passiv umgesetzten Profils (rein, getestet).
 *
 * Renormiert auf die abgedeckten Klassen. Bleibt die Abdeckung unter
 * `minAbdeckungPct`, gibt es KEIN Ergebnis — ein Massstab aus zwei von sechs
 * Klassen wäre kein Massstab, sondern eine Hochrechnung.
 */
export function berechneComposite(
  klassen: KlassenRendite[],
  minAbdeckungPct = 70,
): CompositeErgebnis | null {
  const gesamt = klassen.reduce((s, k) => s + Math.max(0, k.sollQuotePct), 0);
  if (gesamt <= 0) return null;

  let abgedeckt = 0;
  let gewichtet = 0;
  const beitraege: CompositeErgebnis["beitraege"] = [];

  for (const k of klassen) {
    const w = Math.max(0, k.sollQuotePct);
    if (w <= 0) continue;
    if (k.chfReturn === null || !Number.isFinite(k.chfReturn)) continue;
    abgedeckt += w;
    gewichtet += w * k.chfReturn;
    beitraege.push({ klasse: k.klasse, gewichtPct: w, chfReturn: k.chfReturn });
  }

  const abdeckungPct = (abgedeckt / gesamt) * 100;
  if (abgedeckt <= 0 || abdeckungPct < minAbdeckungPct) return null;

  return {
    compositeReturn: gewichtet / abgedeckt,
    abdeckungPct: parseFloat(abdeckungPct.toFixed(2)),
    beitraege,
  };
}

/**
 * Soll-Quoten eines Profils in die Eingabeform bringen.
 *
 * Klassen mit Quote 0 fallen weg — sie tragen weder zum Massstab bei noch
 * sollen sie dessen Abdeckung drücken.
 */
export function quotenAusProfil(
  allokation: Record<string, number> | undefined | null,
): { klasse: SleeveAssetKey; sollQuotePct: number }[] {
  const keys: SleeveAssetKey[] = ["equity", "bond", "commodity", "gold", "realestate", "crypto"];
  if (!allokation) return [];
  return keys
    .map((k) => ({ klasse: k, sollQuotePct: Number(allokation[k]) || 0 }))
    .filter((k) => k.sollQuotePct > 0);
}
