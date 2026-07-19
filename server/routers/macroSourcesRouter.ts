/**
 * macroSourcesRouter.ts
 * Admin-only router für das Abrufen und Speichern von Makro-Indikatoren
 * aus öffentlichen Quellen (FRED, SNB, World Bank).
 *
 * Quellen:
 * - FRED (St. Louis Fed): Zinsstrukturkurve, Inflation, Zinsen, Arbeitslosigkeit
 * - SNB Data Portal: CHF-Wechselkurse (via EODHD, da SNB kein öffentliches REST-API hat)
 * - World Bank: BIP-Wachstum (via öffentlichem JSON-API)
 */

import { z } from "zod";
import { adminProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { macroIndicators } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

// ─── FRED Series Definitionen ────────────────────────────────────────────────

const FRED_SERIES: Array<{
  key: string;
  fredId: string;
  label: string;
  category: string;
  interpretation: string;
}> = [
  {
    key: "FRED_T10Y2Y",
    fredId: "T10Y2Y",
    label: "10Y-2Y Zinsstruktur-Spread (USA)",
    category: "yield_curve",
    interpretation: "Negativ = invertierte Zinskurve = erhöhtes Rezessionsrisiko. Historisch zuverlässiger Frühindikator (12-18 Monate Vorlauf).",
  },
  {
    key: "FRED_T10Y3M",
    fredId: "T10Y3M",
    label: "10Y-3M Zinsstruktur-Spread (USA)",
    category: "yield_curve",
    interpretation: "Alternativmass zur Zinskurven-Inversion. Negativer Wert = Rezessionssignal (NY Fed Modell).",
  },
  {
    key: "FRED_CPIAUCSL",
    fredId: "CPIAUCSL",
    label: "US Inflation (CPI, alle Güter)",
    category: "inflation",
    interpretation: "Verbraucherpreisindex USA. Steigende Werte = höherer Inflationsdruck = Fed-Zinserhöhungsrisiko.",
  },
  {
    key: "FRED_CPILFESL",
    fredId: "CPILFESL",
    label: "US Kerninflation (Core CPI, ex Energie/Nahrung)",
    category: "inflation",
    interpretation: "Kerninflation ohne volatile Komponenten. Wichtigster Indikator für Fed-Geldpolitik.",
  },
  {
    key: "FRED_FEDFUNDS",
    fredId: "FEDFUNDS",
    label: "US Federal Funds Rate (Leitzins)",
    category: "rates",
    interpretation: "Effektiver Fed Funds Rate. Hohe Zinsen = Gegenwind für Aktien/Anleihen.",
  },
  {
    key: "FRED_DGS10",
    fredId: "DGS10",
    label: "US 10-Jahres-Staatsanleihenrendite",
    category: "rates",
    interpretation: "Risikofreier Zinssatz. Steigend = Druck auf Aktienbewertungen (DCF-Diskontierung).",
  },
  {
    key: "FRED_DGS2",
    fredId: "DGS2",
    label: "US 2-Jahres-Staatsanleihenrendite",
    category: "rates",
    interpretation: "Kurzfristiger risikofreier Zinssatz. Eng an Fed-Erwartungen geknüpft.",
  },
  {
    key: "FRED_UNRATE",
    fredId: "UNRATE",
    label: "US Arbeitslosenquote",
    category: "employment",
    interpretation: "Steigende Arbeitslosigkeit = Rezessionssignal (Sahm-Regel: +0.5pp in 12M = Rezession).",
  },
  {
    key: "FRED_ICSA",
    fredId: "ICSA",
    label: "US Erstanträge Arbeitslosenhilfe (wöchentlich)",
    category: "employment",
    interpretation: "Frühindikator für Arbeitsmarkt. Stark steigende Werte = Konjunkturabschwächung.",
  },
  {
    key: "FRED_BAMLH0A0HYM2",
    fredId: "BAMLH0A0HYM2",
    label: "US High-Yield Credit Spread (OAS)",
    category: "credit",
    interpretation: "Risikoprämie für Hochzinsanleihen. Stark steigend = Kreditstress = Rezessionsrisiko.",
  },
  {
    key: "FRED_DEXSZUS",
    fredId: "DEXSZUS",
    label: "CHF/USD Wechselkurs (SNB via FRED)",
    category: "fx",
    interpretation: "Schweizer Franken gegenüber US-Dollar. CHF-Stärke = Gegenwind für Schweizer Exporteure.",
  },
  {
    key: "FRED_DEXUSEU",
    fredId: "DEXUSEU",
    label: "USD/EUR Wechselkurs",
    category: "fx",
    interpretation: "US-Dollar gegenüber Euro. Wichtig für europäische Portfolios.",
  },
];

// ─── FRED CSV Fetch ──────────────────────────────────────────────────────────

async function fetchFredSeries(
  fredId: string,
  daysBack = 730
): Promise<Array<{ date: string; value: number }>> {
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - daysBack);
  const fromStr = fromDate.toISOString().slice(0, 10);

  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${fredId}&vintage_date=${new Date().toISOString().slice(0, 10)}&observation_start=${fromStr}`;

  const response = await fetch(url, {
    headers: { "User-Agent": "PortfolioManager/1.0 (research@portfolio.mw)" },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`FRED fetch failed for ${fredId}: ${response.status}`);
  }

  const csv = await response.text();
  const lines = csv.trim().split("\n").slice(1); // skip header

  return lines
    .map((line) => {
      const [date, value] = line.split(",");
      const num = parseFloat(value);
      if (!date || isNaN(num)) return null;
      return { date: date.trim(), value: num };
    })
    .filter((x): x is { date: string; value: number } => x !== null);
}

// ─── World Bank GDP Growth ───────────────────────────────────────────────────

async function fetchWorldBankGdp(
  countryCode: string
): Promise<Array<{ date: string; value: number }>> {
  const url = `https://api.worldbank.org/v2/country/${countryCode}/indicator/NY.GDP.MKTP.KD.ZG?format=json&mrv=10&per_page=10`;

  const response = await fetch(url, {
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) return [];

  const data = (await response.json()) as [unknown, Array<{ date: string; value: number | null }>];
  if (!Array.isArray(data) || !Array.isArray(data[1])) return [];

  return data[1]
    .filter((d) => d.value !== null)
    .map((d) => ({ date: d.date, value: d.value as number }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ─── Router ──────────────────────────────────────────────────────────────────

export const macroSourcesRouter = router({
  /** Alle gespeicherten Makro-Indikatoren abrufen */
  list: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db.select().from(macroIndicators);
    return rows.map((r) => ({
      ...r,
      latestValue: r.latestValue ? parseFloat(r.latestValue as unknown as string) : null,
      previousValue: r.previousValue ? parseFloat(r.previousValue as unknown as string) : null,
      timeseries: r.timeseries as Array<{ date: string; value: number }> | null,
    }));
  }),

  /** Alle FRED-Serien abrufen und in DB speichern */
  fetchFred: adminProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB nicht verfügbar");

    const results: Array<{ key: string; label: string; success: boolean; error?: string; pointCount?: number }> = [];

    for (const series of FRED_SERIES) {
      try {
        const timeseries = await fetchFredSeries(series.fredId);
        if (timeseries.length === 0) {
          results.push({ key: series.key, label: series.label, success: false, error: "Keine Daten" });
          continue;
        }

        const latest = timeseries[timeseries.length - 1];
        const previous = timeseries.length >= 2 ? timeseries[timeseries.length - 2] : null;

        // Nur letzten 2 Jahre speichern (Speicheroptimierung)
        const twoYearsAgo = new Date();
        twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
        const twoYearsAgoStr = twoYearsAgo.toISOString().slice(0, 10);
        const filteredTimeseries = timeseries.filter((p) => p.date >= twoYearsAgoStr);

        await db
          .insert(macroIndicators)
          .values({
            seriesKey: series.key,
            label: series.label,
            category: series.category,
            source: "FRED",
            latestValue: String(latest.value) as any,
            latestDate: latest.date,
            previousValue: previous ? String(previous.value) as any : null,
            timeseries: filteredTimeseries as any,
            interpretation: series.interpretation,
            lastFetchedAt: new Date(),
          })
          .onDuplicateKeyUpdate({
            set: {
              label: series.label,
              latestValue: String(latest.value) as any,
              latestDate: latest.date,
              previousValue: previous ? String(previous.value) as any : null,
              timeseries: filteredTimeseries as any,
              interpretation: series.interpretation,
              lastFetchedAt: new Date(),
            },
          });

        results.push({ key: series.key, label: series.label, success: true, pointCount: filteredTimeseries.length });
      } catch (err) {
        results.push({
          key: series.key,
          label: series.label,
          success: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return { results, successCount: results.filter((r) => r.success).length, totalCount: results.length };
  }),

  /** World Bank BIP-Wachstum für CH, US, EU abrufen */
  fetchWorldBank: adminProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB nicht verfügbar");

    const countries = [
      { code: "CH", key: "WB_GDP_CH", label: "Schweiz BIP-Wachstum (% p.a.)" },
      { code: "US", key: "WB_GDP_US", label: "USA BIP-Wachstum (% p.a.)" },
      { code: "EU", key: "WB_GDP_EU", label: "Eurozone BIP-Wachstum (% p.a.)" },
      { code: "DE", key: "WB_GDP_DE", label: "Deutschland BIP-Wachstum (% p.a.)" },
    ];

    const results: Array<{ key: string; success: boolean; error?: string }> = [];

    for (const country of countries) {
      try {
        const timeseries = await fetchWorldBankGdp(country.code);
        if (timeseries.length === 0) {
          results.push({ key: country.key, success: false, error: "Keine Daten" });
          continue;
        }

        const latest = timeseries[timeseries.length - 1];
        const previous = timeseries.length >= 2 ? timeseries[timeseries.length - 2] : null;

        await db
          .insert(macroIndicators)
          .values({
            seriesKey: country.key,
            label: country.label,
            category: "gdp",
            source: "WORLDBANK",
            latestValue: String(latest.value) as any,
            latestDate: latest.date,
            previousValue: previous ? String(previous.value) as any : null,
            timeseries: timeseries as any,
            interpretation: "BIP-Wachstum in % p.a. Negativ = Rezession. Quelle: World Bank.",
            lastFetchedAt: new Date(),
          })
          .onDuplicateKeyUpdate({
            set: {
              latestValue: String(latest.value) as any,
              latestDate: latest.date,
              previousValue: previous ? String(previous.value) as any : null,
              timeseries: timeseries as any,
              lastFetchedAt: new Date(),
            },
          });

        results.push({ key: country.key, success: true });
      } catch (err) {
        results.push({ key: country.key, success: false, error: err instanceof Error ? err.message : String(err) });
      }
    }

    return { results, successCount: results.filter((r) => r.success).length };
  }),

  /** Einzelne Serie nach Key abrufen (für Charts) */
  getSeries: adminProcedure
    .input(z.object({ seriesKey: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const rows = await db.select().from(macroIndicators).where(eq(macroIndicators.seriesKey, input.seriesKey)).limit(1);
      if (rows.length === 0) return null;
      const r = rows[0];
      return {
        ...r,
        latestValue: r.latestValue ? parseFloat(r.latestValue as unknown as string) : null,
        previousValue: r.previousValue ? parseFloat(r.previousValue as unknown as string) : null,
        timeseries: r.timeseries as Array<{ date: string; value: number }> | null,
      };
    }),

  /** Alle Serien einer Kategorie abrufen */
  getByCategory: adminProcedure
    .input(z.object({ category: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const { eq } = await import("drizzle-orm");
      const rows = await db.select().from(macroIndicators).where(eq(macroIndicators.category, input.category));
      return rows.map((r) => ({
        ...r,
        latestValue: r.latestValue ? parseFloat(r.latestValue as unknown as string) : null,
        previousValue: r.previousValue ? parseFloat(r.previousValue as unknown as string) : null,
        timeseries: r.timeseries as Array<{ date: string; value: number }> | null,
      }));
    }),

  /**
   * Apollo Academy Research-Feed (Torsten Slok) — liest die öffentlichen
   * RSS-Feeds (Daily Spark + Outlooks), 30-Min-Server-Cache. Liefert nur
   * Metadaten (Titel, Link, Datum, Kategorie, Kurz-Exzerpt) mit Rückverweis.
   * `refresh: true` erzwingt einen frischen Abruf (Cache-Bypass).
   */
  getApolloFeed: adminProcedure
    .input(z.object({ refresh: z.boolean().optional() }).optional())
    .query(async ({ input }) => {
      const { getApolloFeed } = await import("../lib/apolloFeed");
      return getApolloFeed(input?.refresh ?? false);
    }),
});
