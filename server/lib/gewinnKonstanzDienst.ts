/**
 * Datenbeschaffung für die Halteperioden-Kennzahlen (`gewinnKonstanz.ts`):
 * holt die dividendenbereinigte Monatsreihe der letzten zehn Jahre von EODHD
 * (period=m, adjusted_close = Gesamtrendite) und rechnet daraus Gewinn-
 * Konstanz und Verlust-Ratio. 24 h gecacht — Monatsdaten ändern sich nicht
 * schneller, und die Detailseite soll keine EODHD-Abrufe vervielfachen.
 */

import { ENV } from "../_core/env";
import { apiCache, CACHE_TTL } from "../_core/apiCache";
import { toEodhdSymbol } from "./eodhdSymbol";
import { halteperiodenKennzahlen, MAX_MONATE, type HalteperiodenErgebnis, type MonatsPunkt } from "./gewinnKonstanz";

const EODHD_BASE_URL = "https://eodhd.com/api";

async function holeMonatsReihe(symbol: string): Promise<MonatsPunkt[]> {
  const apiKey = ENV.eodhdApiKey;
  if (!apiKey) return [];
  // Ein Monat Reserve über das Fenster hinaus — die Kappung macht das Modul.
  const von = new Date();
  von.setUTCMonth(von.getUTCMonth() - (MAX_MONATE + 1));
  const vonStr = von.toISOString().slice(0, 10);
  const bisStr = new Date().toISOString().slice(0, 10);
  try {
    const url = `${EODHD_BASE_URL}/eod/${symbol}?api_token=${apiKey}&from=${vonStr}&to=${bisStr}&fmt=json&period=m`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json() as Array<{ date: string; close: number; adjusted_close?: number }>;
    if (!Array.isArray(data)) return [];
    return data
      .map((d) => ({ date: d.date, close: Number(d.adjusted_close ?? d.close) }))
      .filter((p) => Number.isFinite(p.close) && p.close > 0);
  } catch {
    return [];
  }
}

export async function gewinnKonstanzStand(ticker: string): Promise<HalteperiodenErgebnis> {
  const cacheKey = `gewinnkonstanz:${ticker}`;
  const imCache = apiCache.get<HalteperiodenErgebnis>(cacheKey);
  if (imCache) return imCache;

  const reihe = await holeMonatsReihe(toEodhdSymbol(ticker));
  const ergebnis = halteperiodenKennzahlen(reihe);

  // Nur echte Ergebnisse einen Tag halten; einen leeren Abruf (Ausfall,
  // fehlender Key) nicht — der nächste Aufruf soll es wieder versuchen.
  if (ergebnis.szenarien > 0) {
    apiCache.set(cacheKey, ergebnis, CACHE_TTL.HISTORICAL);
  }
  return ergebnis;
}
