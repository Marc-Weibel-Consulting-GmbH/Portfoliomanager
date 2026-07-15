/**
 * KI-Boom Warnsystem Router
 * Liefert Echtzeit-Metriken zur Beurteilung des KI-Booms:
 * - Nvidia-Aktienkurs + KGV
 * - Magnificent Seven Performance
 * - VC-Finanzierungstrends
 * - Hyperscaler CapEx-Wachstum
 * - Bewertungsmetriken
 * - Historische Zeitreihen für jeden Signalwert
 */
import { z } from "zod";
import { desc, gte, sql, eq } from "drizzle-orm";
import { publicProcedure, router } from "../_core/trpc";
import { fetchHistoricalPrices } from "../_core/stockDataApi";
import { getDb } from "../db";
import { kiBoomMetricsHistory } from "../../drizzle/schema";
import { getLatestDynamicMetrics, type DynamicMetricResult } from "../cron/kiBoomDynamicMetricsFetcher";
import { ENV } from "../_core/env";

// ── EODHD Backfill Helper ──────────────────────────────────────────────────────
async function fetchEodhdHistorical(
  ticker: string,
  yearsBack = 5
): Promise<Array<{ date: string; close: number }>> {
  const apiKey = ENV.eodhdApiKey || process.env.EODHD_API_KEY;
  if (!apiKey) throw new Error("EODHD_API_KEY not set");
  const to = new Date().toISOString().split("T")[0];
  const from = new Date(Date.now() - yearsBack * 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const url = `https://eodhd.com/api/eod/${ticker}?api_token=${apiKey}&from=${from}&to=${to}&fmt=json&period=d`;
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`EODHD ${ticker} → HTTP ${res.status}`);
  const data = await res.json() as Array<{ date: string; close: number; adjusted_close?: number }>;
  if (!Array.isArray(data)) return [];
  return data.map(d => ({ date: d.date, close: d.adjusted_close ?? d.close }));
}

// ── Typen ──────────────────────────────────────────────────────────────────
export type BoomZone = "gruen" | "gelb" | "rot";

interface SignalResult {
  label: string;
  value: string;
  numericValue: number | null;
  zone: BoomZone;
  description: string;
  warnThreshold: string;
  criticalThreshold: string;
  trend: "up" | "down" | "stable";
}

interface KiBoomData {
  overallZone: BoomZone;
  activeWarnings: number;
  activeCritical: number;
  lastUpdated: string;
  signals: SignalResult[];
  scenarioProbabilities: {
    sanfteVerlangsamung: number;
    schnellerCrash: number;
    weiterhinBoom: number;
  };
  ausstiegsEmpfehlung: boolean;
  ausstiegsGrund: string | null;
  /** Szenario-Kontext: erklärt warum trotz Warnsignalen kein Sofortausstieg */
  szenarioKontext: string | null;
  /** Aktuelle Marktwarnung aus Research/News */
  goldmanSachsWarning: {
    headline: string;
    date: string;
    source: string;
    summary: string;
    bullets: string[];
    severity: BoomZone;
  } | null;
  staticMetrics: {
    openAiUmsatz2025: string;
    openAiVerlust2025: string;
    openAiVerlustquote: number;
    anthropicBewertung: string;
    openAiBewertung: string;
    hyperscalerCapex2026: string;
    hyperscalerCapexWachstum: number;
    vcAnteilKI: number;
    vcGesamtvolumen: string;
    pilotProjektROIQuote: number;
  };
}

// ── Hilfsfunktionen ────────────────────────────────────────────────────────

function determineZone(value: number, warnLevel: number, critLevel: number, higherIsBetter: boolean): BoomZone {
  if (higherIsBetter) {
    if (value >= warnLevel) return "gruen";
    if (value >= critLevel) return "gelb";
    return "rot";
  } else {
    if (value <= warnLevel) return "gruen";
    if (value <= critLevel) return "gelb";
    return "rot";
  }
}

function calcTrend(current: number, previous: number): "up" | "down" | "stable" {
  const diff = (current - previous) / Math.abs(previous || 1);
  if (diff > 0.01) return "up";
  if (diff < -0.01) return "down";
  return "stable";
}

// ── Hauptfunktion: Marktdaten abrufen ─────────────────────────────────────

async function fetchNvidiaMetrics(): Promise<{ price: number; prevPrice: number; pe: number | null }> {
  try {
    const prices = await fetchHistoricalPrices("NVDA", 1); // 1 Jahr
    if (!prices || prices.length < 2) return { price: 0, prevPrice: 0, pe: null };
    const sorted = [...prices].sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const latest = sorted[sorted.length - 1];
    const prev = sorted[sorted.length - 2];
    return {
      price: latest.close ?? 0,
      prevPrice: prev.close ?? 0,
      pe: null,
    };
  } catch {
    return { price: 0, prevPrice: 0, pe: null };
  }
}

async function fetchMagnificentSevenPerf(): Promise<{ avgYtd: number; prevAvgYtd: number }> {
  const tickers = ["NVDA", "MSFT", "GOOGL", "AMZN", "META", "AAPL", "TSLA"];
  try {
    const results = await Promise.allSettled(
      tickers.map((t) => fetchHistoricalPrices(t, 1))
    );
    let totalYtd = 0;
    let count = 0;
    for (const r of results) {
      if (r.status === "fulfilled" && r.value && r.value.length >= 2) {
        const sorted = [...r.value].sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const currentYear = new Date().getFullYear();
        const yearStart = sorted.find((p: any) => new Date(p.date).getFullYear() === currentYear);
        const latest = sorted[sorted.length - 1];
        if (yearStart && latest && yearStart.close > 0) {
          const ytd = ((latest.close - yearStart.close) / yearStart.close) * 100;
          totalYtd += ytd;
          count++;
        }
      }
    }
    const avg = count > 0 ? totalYtd / count : 0;
    return { avgYtd: avg, prevAvgYtd: avg * 0.95 };
  } catch {
    return { avgYtd: 0, prevAvgYtd: 0 };
  }
}

// ── Statische Metriken (Research-basiert, quartalsweise aktualisiert) ──────
const STATIC_METRICS = {
  openAiUmsatz2025: "4,3 Mrd. USD",
  openAiVerlust2025: "-2,5 Mrd. USD",
  openAiVerlustquote: 58, // %
  anthropicBewertung: "965 Mrd. USD",
  openAiBewertung: "852 Mrd. USD",
  hyperscalerCapex2026: "725 Mrd. USD",
  hyperscalerCapexWachstum: 81, // % YoY
  vcAnteilKI: 61, // % aller VC-Investitionen
  vcGesamtvolumen: "258,7 Mrd. USD",
  pilotProjektROIQuote: 5, // % der Projekte erreichen ROI-Ziele
};

// ── Szenarien (können manuell aktualisiert werden) ─────────────────────────
const SCENARIOS = {
  sanfteVerlangsamung: 30,
  schnellerCrash: 40,
  weiterhinBoom: 30,
  // Szenario-Zeitplan: wann wird die "heisse Phase" erwartet?
  neutralSzenarioHotPhase: "2027/28",
  // Mindestanzahl kritischer Signale für Sofortausstieg (szenario-konsistent)
  // Im neutralen Szenario (heisse Phase 2027/28) erst bei >=2 kritischen Signalen
  minCriticalForImmediateExit: 2,
  minWarningsForCaution: 3,
};

// ── Kernberechnung (wiederverwendbar für Router + Snapshot) ───────────────

export async function computeKiBoomData(): Promise<KiBoomData> {
  const [nvidiaData, mag7Data, dynMetricsData] = await Promise.allSettled([
    fetchNvidiaMetrics(),
    fetchMagnificentSevenPerf(),
    getLatestDynamicMetrics(),
  ]);

  const nvidia = nvidiaData.status === "fulfilled" ? nvidiaData.value : { price: 0, prevPrice: 0, pe: null };
  const mag7 = mag7Data.status === "fulfilled" ? mag7Data.value : { avgYtd: 0, prevAvgYtd: 0 };
  const dyn = dynMetricsData.status === "fulfilled" ? dynMetricsData.value : {};

  // Dynamische Werte mit Fallback auf STATIC_METRICS
  const openAiLossRate = dyn["openai_loss_rate"]?.numericValue ?? STATIC_METRICS.openAiVerlustquote;
  const openAiLossRateSource = dyn["openai_loss_rate"]?.source ?? "Research 2025";
  const openAiRevenue = dyn["openai_revenue"]?.displayValue ?? STATIC_METRICS.openAiUmsatz2025;
  const openAiValuation = dyn["openai_valuation"]?.displayValue ?? STATIC_METRICS.openAiBewertung;

  const capexYoy = dyn["hyperscaler_capex_yoy"]?.numericValue ?? STATIC_METRICS.hyperscalerCapexWachstum;
  const capexAbs = dyn["hyperscaler_capex_abs"]?.displayValue ?? STATIC_METRICS.hyperscalerCapex2026;
  const capexSource = dyn["hyperscaler_capex_yoy"]?.source ?? "Research 2025";

  const vcShare = dyn["vc_ai_share"]?.numericValue ?? STATIC_METRICS.vcAnteilKI;
  const vcTotal = dyn["vc_total_volume"]?.displayValue ?? STATIC_METRICS.vcGesamtvolumen;
  const vcSource = dyn["vc_ai_share"]?.source ?? "PitchBook 2025";

  const roiRate = dyn["ai_roi_success_rate"]?.numericValue ?? STATIC_METRICS.pilotProjektROIQuote;
  const roiSource = dyn["ai_roi_success_rate"]?.source ?? "McKinsey/Gartner 2025";

  // Credit-Spread-Daten (dynamisch via Perplexity, Fallback auf Goldman Sachs Juli 2026)
  const techBondIssuance = dyn["tech_bond_issuance_bn_usd"]?.numericValue ?? 244;
  const techBondDisplay = dyn["tech_bond_issuance_bn_usd"]?.displayValue ?? "$244 Mrd.";
  const techSpreadBps = dyn["tech_ig_spread_bps"]?.numericValue ?? null;
  const techSpreadChange = dyn["tech_spread_change_bps"]?.numericValue ?? null;
  const techRatingChange = dyn["tech_rating_change"]?.displayValue ?? "Oracle auf BBB- abgestuft (S&P Global, 9. Juli 2026)";
  const techCreditSource = dyn["tech_bond_issuance_bn_usd"]?.source ?? "Goldman Sachs / WSJ, Juli 2026";

  // Dynamische Zone: rot wenn Spreads > 200 bps oder Ausweitung > 50 bps, gelb wenn > 150 bps oder Ausweitung > 20 bps
  const techCreditZone: BoomZone = (() => {
    if (techSpreadBps !== null) {
      if (techSpreadBps > 200 || (techSpreadChange !== null && techSpreadChange > 50)) return "rot";
      if (techSpreadBps > 150 || (techSpreadChange !== null && techSpreadChange > 20)) return "gelb";
      return "gruen";
    }
    // Fallback: Goldman Sachs Warnung = gelb
    return "gelb";
  })();

  const techCreditDesc = techSpreadBps !== null
    ? `Tech-IG-Spread: ${techSpreadBps} bps${techSpreadChange !== null ? ` (${techSpreadChange >= 0 ? "+" : ""}${techSpreadChange} bps Veränderung)` : ""}. ${techBondDisplay} Tech-Anleihen 2025/26. ${techRatingChange}. (${techCreditSource})`
    : `Goldman Sachs warnt vor 'brutalen' Bewegungen: ${techBondDisplay} Tech-Anleihen 2026 (2× Vorjahr). Steigende Kreditspreads. ${techRatingChange}. (${techCreditSource})`;

  const signals: SignalResult[] = [
    // 1. Nvidia-Kurs
    {
      label: "Nvidia Aktienkurs",
      value: nvidia.price > 0 ? `$${nvidia.price.toFixed(2)}` : "Keine Daten",
      numericValue: nvidia.price,
      zone: nvidia.price > 0
        ? determineZone(nvidia.price, 80, 50, true)
        : "gelb",
      description: nvidia.price > 0
        ? `Nvidia-Kurs: $${nvidia.price.toFixed(2)} – Proxy für KI-Hardware-Nachfrage. ${
            nvidia.price > 120 ? "Kurs auf historisch hohem Niveau." :
            nvidia.price > 80 ? "Kurs im normalen Bereich." :
            "Kurs unter Warnschwelle – mögliche Nachfrageschwäche."
          }`
        : "Kursdaten momentan nicht verfügbar.",
      warnThreshold: "< $80",
      criticalThreshold: "< $50",
      trend: nvidia.prevPrice > 0 ? calcTrend(nvidia.price, nvidia.prevPrice) : "stable",
    },

    // 2. Magnificent Seven YTD
    {
      label: "Magnificent Seven YTD",
      value: mag7.avgYtd !== 0 ? `${mag7.avgYtd >= 0 ? "+" : ""}${mag7.avgYtd.toFixed(1)}%` : "Keine Daten",
      numericValue: mag7.avgYtd,
      zone: mag7.avgYtd !== 0
        ? determineZone(mag7.avgYtd, 5, -10, true)
        : "gelb",
      description: mag7.avgYtd !== 0
        ? `Durchschnittliche YTD-Rendite der 7 grössten KI-Aktien: ${mag7.avgYtd >= 0 ? "+" : ""}${mag7.avgYtd.toFixed(1)}%. ${
            mag7.avgYtd > 20 ? "Starke Outperformance – Boom intakt." :
            mag7.avgYtd > 5 ? "Moderate Performance – Boom verlangsamt sich." :
            mag7.avgYtd > -10 ? "Schwache Performance – Warnsignal." :
            "Starker Rückgang – Ausstieg prüfen."
          }`
        : "Performance-Daten momentan nicht verfügbar.",
      warnThreshold: "< +5% YTD",
      criticalThreshold: "< -10% YTD",
      trend: calcTrend(mag7.avgYtd, mag7.prevAvgYtd),
    },

    // 3. OpenAI Verlustquote (dynamisch via Perplexity)
    {
      label: "OpenAI Verlustquote",
      value: `${openAiLossRate.toFixed(0)}%`,
      numericValue: openAiLossRate,
      zone: determineZone(openAiLossRate, 50, 70, false),
      description: `OpenAI-Umsatz: ${openAiRevenue} | Bewertung: ${openAiValuation} | Verlustquote: ${openAiLossRate.toFixed(0)}% des Umsatzes. Profitabilität frühestens 2029 erwartet. (${openAiLossRateSource})`,
      warnThreshold: "> 50%",
      criticalThreshold: "> 70%",
      trend: "up",
    },

    // 4. Hyperscaler CapEx-Wachstum (dynamisch via Perplexity)
    // Logik: Hohes Wachstum (>30%) = Überhitzung = Warnung (gelb)
    //        Normales Wachstum (5-30%) = OK (grün)
    //        Rückgang (<5%) = Warnung, Einbruch (<0%) = Kritisch
    {
      label: "Hyperscaler CapEx-Wachstum",
      value: `+${capexYoy.toFixed(0)}% YoY`,
      numericValue: capexYoy,
      zone: capexYoy > 30
        ? "gelb"  // Überhitzung: zu hohes Wachstum ist ein Warnsignal
        : capexYoy >= 5
          ? "gruen" // Normales Wachstum
          : capexYoy >= 0
            ? "gelb"  // Verlangsamung: Warnung
            : "rot",  // Rückgang: Kritisch (Boom bricht zusammen)
      description: `Amazon, Google, Microsoft und Meta: ${capexAbs} CapEx – Wachstum +${capexYoy.toFixed(0)}% YoY. ${
        capexYoy > 30
          ? "Überhitzungssignal: Exponentielles Wachstum ist strukturell nicht nachhaltig."
          : capexYoy >= 5
            ? "Normales Wachstum – Boom intakt."
            : capexYoy >= 0
              ? "Verlangsamung erkennbar – Warnsignal."
              : "CapEx-Rückgang – Boom bricht zusammen."
      } (${capexSource})`,
      warnThreshold: "> 30% (Überhitzung) oder < 5% (Verlangsamung)",
      criticalThreshold: "< 0% (Rückgang = Boom-Ende)",
      trend: "up",
    },

    // 5. VC-Anteil KI (dynamisch via Perplexity)
    {
      label: "VC-Anteil KI-Startups",
      value: `${vcShare.toFixed(0)}%`,
      numericValue: vcShare,
      zone: determineZone(vcShare, 50, 40, true),
      description: `${vcShare.toFixed(0)}% aller globalen VC-Investitionen (${vcTotal}) flossen in KI-Unternehmen. Ein Rückgang unter 50% signalisiert nachlassendes Investorenvertrauen. (${vcSource})`,
      warnThreshold: "< 50%",
      criticalThreshold: "< 40%",
      trend: "stable",
    },

    // 6. KI-Pilotprojekte ROI (dynamisch via Perplexity)
    {
      label: "KI-Projekt ROI-Erfolgsquote",
      value: `${roiRate.toFixed(0)}%`,
      numericValue: roiRate,
      zone: determineZone(roiRate, 30, 15, true),
      description: `Nur ${roiRate.toFixed(0)}% der KI-Pilotprojekte erreichen ihre ROI-Ziele. Solange die Monetarisierung nicht funktioniert, ist der Boom auf Hoffnungen gebaut. (${roiSource})`,
      warnThreshold: "< 30%",
      criticalThreshold: "< 15%",
      trend: "stable",
    },

    // 7. Tech-Anleihenmarkt / Credit Spreads (dynamisch via Perplexity, Fallback Goldman Sachs Juli 2026)
    {
      label: "Tech-Anleihenmarkt Stress",
      value: techBondDisplay,
      numericValue: techBondIssuance,
      zone: techCreditZone,
      description: techCreditDesc,
      warnThreshold: "Kreditspreads steigen / Anleiheflut > $200 Mrd.",
      criticalThreshold: "Ratingabstufungen auf Ramsch / Spreads > 300 bps",
      trend: techSpreadChange !== null && techSpreadChange > 0 ? "up" : techSpreadChange !== null && techSpreadChange < 0 ? "down" : "up",
    },
  ];

  // ── Gesamtstatus berechnen ──────────────────────────────────────────────
  const activeWarnings = signals.filter((s) => s.zone === "gelb").length;
  const activeCritical = signals.filter((s) => s.zone === "rot").length;

  let overallZone: BoomZone = "gruen";
  if (activeCritical >= SCENARIOS.minCriticalForImmediateExit) overallZone = "rot";
  else if (activeCritical >= 1) overallZone = "gelb"; // 1 kritisch → Warnung, kein Sofortausstieg
  else if (activeWarnings >= SCENARIOS.minWarningsForCaution) overallZone = "gelb";

  // Szenario-konsistente Ausstiegsempfehlung:
  // Sofortiger Ausstieg nur wenn >= minCriticalForImmediateExit kritische Signale ODER >= 5 Warnungen
  const sofortigerAusstieg = activeCritical >= SCENARIOS.minCriticalForImmediateExit || activeWarnings >= 5;
  const ausstiegPruefen = !sofortigerAusstieg && (activeCritical >= 1 || activeWarnings >= SCENARIOS.minWarningsForCaution);

  const ausstiegsEmpfehlung = sofortigerAusstieg || ausstiegPruefen;

  let ausstiegsGrund: string | null = null;
  let szenarioKontext: string | null = null;

  if (sofortigerAusstieg) {
    ausstiegsGrund = activeCritical >= SCENARIOS.minCriticalForImmediateExit
      ? `${activeCritical} kritische Signale gleichzeitig aktiv – Ausstieg empfohlen`
      : `${activeWarnings} von 7 Warnsignalen aktiv – erhöhte Vorsicht geboten`;
  } else if (ausstiegPruefen) {
    ausstiegsGrund = activeCritical >= 1
      ? `${activeCritical} kritisches Signal aktiv – Position beobachten`
      : `${activeWarnings} Warnsignale aktiv – Beobachtungsmodus`;
    // Szenario-Kontext: erklärt warum kein Sofortausstieg
    szenarioKontext = `Neutrales Szenario: Heisse Phase erwartet ${SCENARIOS.neutralSzenarioHotPhase}. Sofortiger Ausstieg erst bei ≥${SCENARIOS.minCriticalForImmediateExit} kritischen Signalen oder ≥5 Warnungen.`;
    // Hinweis: Tech-Anleihenmarkt-Stress (Goldman Sachs, Juli 2026) als aktives Warnsignal berücksichtigt
  }

  // Goldman Sachs Warnung als strukturiertes Objekt für Frontend-Karte
  const goldmanSachsWarning = {
    headline: "Goldman Sachs warnt vor 'brutalen' Bewegungen am KI-Anleihenmarkt",
    date: "13. Juli 2026",
    source: "Goldman Sachs / Wall Street Journal",
    summary: "Tech-Hyperscaler haben 2026 Anleihen im Wert von $244 Mrd. begeben – mehr als doppelt so viel wie im Vorjahr. Steigende Kreditspreads signalisieren, dass der Markt Schwierigkeiten hat, die Flut zu absorbieren. Oracle wurde am 9. Juli auf BBB- abgestuft (eine Stufe über Ramsch).",
    bullets: [
      "Amazon, Alphabet, Meta, Microsoft und Oracle: $244 Mrd. Anleihen in 2026 (2× Vorjahr)",
      "Goldman Sachs: Kreditspreads des Tech-Schulden-Korbs haben sich innerhalb einer Woche deutlich ausgeweitet",
      "S&P Global stufte Oracle am 9. Juli auf BBB- herab – unterschätzte KI-Infrastrukturkosten als Begründung",
    ],
    severity: "gelb" as BoomZone,
  };

  return {
    overallZone,
    activeWarnings,
    activeCritical,
    lastUpdated: new Date().toISOString(),
    signals,
    goldmanSachsWarning,
    scenarioProbabilities: {
      sanfteVerlangsamung: SCENARIOS.sanfteVerlangsamung,
      schnellerCrash: SCENARIOS.schnellerCrash,
      weiterhinBoom: SCENARIOS.weiterhinBoom,
    },
    ausstiegsEmpfehlung,
    ausstiegsGrund,
    szenarioKontext,
    staticMetrics: STATIC_METRICS,
  };
}

// ── Snapshot-Funktion (für Cron) ───────────────────────────────────────────

/** Fetch latest close price for a ticker (1-day lookback) */
async function fetchLatestClose(ticker: string): Promise<number | null> {
  try {
    const prices = await fetchHistoricalPrices(ticker, 1);
    if (!prices || prices.length === 0) return null;
    const sorted = [...prices].sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return sorted[sorted.length - 1]?.close ?? null;
  } catch {
    return null;
  }
}

export async function recordKiBoomSnapshot(): Promise<{
  overallZone: string;
  activeWarnings: number;
  activeCritical: number;
}> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const [data, soxResult, arkkResult, vixResult, hygResult, lqdResult] = await Promise.allSettled([
    computeKiBoomData(),
    fetchLatestClose("SOXX.US"),
    fetchLatestClose("ARKK.US"),
    fetchLatestClose("VIX.INDX"),
    fetchLatestClose("HYG.US"),  // High Yield Bond ETF – Credit Spread Proxy
    fetchLatestClose("LQD.US"),  // Investment Grade Bond ETF – Credit Spread Proxy
  ]);

  if (data.status !== "fulfilled") throw new Error("computeKiBoomData failed");
  const d = data.value;
  const nvidia = d.signals.find((s) => s.label === "Nvidia Aktienkurs");
  const mag7 = d.signals.find((s) => s.label === "Magnificent Seven YTD");
  const soxPrice = soxResult.status === "fulfilled" ? soxResult.value : null;
  const arkkPrice = arkkResult.status === "fulfilled" ? arkkResult.value : null;
  const vixLevel = vixResult.status === "fulfilled" ? vixResult.value : null;
  const creditSpreadHY = hygResult.status === "fulfilled" ? hygResult.value : null;
  const creditSpreadIG = lqdResult.status === "fulfilled" ? lqdResult.value : null;

  // NVDA P/E: approximate from price / EPS TTM (EPS ~2.94 as of 2026)
  const nvdaEpsTtm = 2.94;
  const nvdaPE = nvidia?.numericValue != null && nvidia.numericValue > 0
    ? nvidia.numericValue / nvdaEpsTtm
    : null;

  await db.insert(kiBoomMetricsHistory).values({
    recordedAt: new Date(),
    nvidiaPrice: nvidia?.numericValue != null ? String(nvidia.numericValue) : null,
    mag7AvgYtd: mag7?.numericValue != null ? String(mag7.numericValue) : null,
    openAiVerlustquote: String(STATIC_METRICS.openAiVerlustquote),
    hyperscalerCapexWachstum: String(STATIC_METRICS.hyperscalerCapexWachstum),
    vcAnteilKI: String(STATIC_METRICS.vcAnteilKI),
    pilotProjektROIQuote: String(STATIC_METRICS.pilotProjektROIQuote),
    soxPrice: soxPrice != null ? String(soxPrice) : null,
    arkkPrice: arkkPrice != null ? String(arkkPrice) : null,
    nvdaPE: nvdaPE != null ? String(nvdaPE) : null,
    vixLevel: vixLevel != null ? String(vixLevel) : null,
    creditSpreadHY: creditSpreadHY != null ? String(creditSpreadHY) : null,
    creditSpreadIG: creditSpreadIG != null ? String(creditSpreadIG) : null,
    overallZone: d.overallZone,
    activeWarnings: d.activeWarnings,
    activeCritical: d.activeCritical,
    scenarioSanfte: d.scenarioProbabilities.sanfteVerlangsamung,
    scenarioCrash: d.scenarioProbabilities.schnellerCrash,
    scenarioBoom: d.scenarioProbabilities.weiterhinBoom,
  });

  return {
    overallZone: d.overallZone,
    activeWarnings: d.activeWarnings,
    activeCritical: d.activeCritical,
  };
}

// ── Router ─────────────────────────────────────────────────────────────────

export const kiBoomRouter = router({
  /**
   * Liefert alle KI-Boom-Metriken inkl. Warnsignale
   */
  getDashboard: publicProcedure.query(async (): Promise<KiBoomData> => {
    return computeKiBoomData();
  }),

  /**
   * Liefert historische Zeitreihen für alle Metriken (letzte N Tage)
   */
  getHistory: publicProcedure
    .input(z.object({ days: z.number().min(7).max(365).default(90) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { history: [] };

      const since = new Date();
      since.setDate(since.getDate() - input.days);

      const rows = await db
        .select()
        .from(kiBoomMetricsHistory)
        .where(gte(kiBoomMetricsHistory.recordedAt, since))
        .orderBy(kiBoomMetricsHistory.recordedAt);

      return {
        history: rows.map((r) => ({
          date: r.recordedAt.toISOString().split("T")[0],
          nvidiaPrice: r.nvidiaPrice != null ? parseFloat(String(r.nvidiaPrice)) : null,
          mag7AvgYtd: r.mag7AvgYtd != null ? parseFloat(String(r.mag7AvgYtd)) : null,
          openAiVerlustquote: r.openAiVerlustquote != null ? parseFloat(String(r.openAiVerlustquote)) : null,
          hyperscalerCapexWachstum: r.hyperscalerCapexWachstum != null ? parseFloat(String(r.hyperscalerCapexWachstum)) : null,
          vcAnteilKI: r.vcAnteilKI != null ? parseFloat(String(r.vcAnteilKI)) : null,
          pilotProjektROIQuote: r.pilotProjektROIQuote != null ? parseFloat(String(r.pilotProjektROIQuote)) : null,
          soxPrice: r.soxPrice != null ? parseFloat(String(r.soxPrice)) : null,
          arkkPrice: r.arkkPrice != null ? parseFloat(String(r.arkkPrice)) : null,
          nvdaPE: r.nvdaPE != null ? parseFloat(String(r.nvdaPE)) : null,
          vixLevel: r.vixLevel != null ? parseFloat(String(r.vixLevel)) : null,
          creditSpreadHY: r.creditSpreadHY != null ? parseFloat(String(r.creditSpreadHY)) : null,
          creditSpreadIG: r.creditSpreadIG != null ? parseFloat(String(r.creditSpreadIG)) : null,
          overallZone: r.overallZone,
          activeWarnings: r.activeWarnings ?? 0,
          activeCritical: r.activeCritical ?? 0,
        })),
      };
    }),

  /**
   * Manuell einen Snapshot auslösen (Admin)
   */
  triggerSnapshot: publicProcedure.mutation(async () => {
    const result = await recordKiBoomSnapshot();
    return { success: true, ...result };
  }),

  /**
   * Liefert die zuletzt gecachten dynamischen Metriken aus der DB
   */
  getDynamicMetrics: publicProcedure.query(async () => {
    const metrics = await getLatestDynamicMetrics();
    return { metrics };
  }),

  /**
   * Manuell einen Perplexity-Fetch der dynamischen Metriken auslösen
   */
  triggerDynamicFetch: publicProcedure.mutation(async () => {
    const { fetchAndSaveDynamicMetrics } = await import("../cron/kiBoomDynamicMetricsFetcher");
    const result = await fetchAndSaveDynamicMetrics();
    return { success: result.saved > 0, saved: result.saved, errors: result.errors };
  }),

  /**
   * Backfill: Lädt 5 Jahre HYG und LQD Preisdaten via EODHD
   * und befüllt ki_boom_metrics_history rückwirkend.
   * Nur für Admin-Nutzung.
   */
  backfillCreditSpreads: publicProcedure
    .input(z.object({ yearsBack: z.number().min(1).max(10).default(5) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB nicht verfügbar");

      // Lade historische Preise für HYG und LQD
      const [hygData, lqdData] = await Promise.all([
        fetchEodhdHistorical("HYG.US", input.yearsBack),
        fetchEodhdHistorical("LQD.US", input.yearsBack),
      ]);

      if (hygData.length === 0 || lqdData.length === 0) {
        throw new Error(`Keine Daten: HYG=${hygData.length}, LQD=${lqdData.length}`);
      }

      // Erstelle Map für schnellen Lookup
      const lqdMap = new Map(lqdData.map(d => [d.date, d.close]));

      // Für jeden HYG-Tag einen Eintrag erstellen
      let inserted = 0;
      let skipped = 0;

      for (const hyg of hygData) {
        const lqdClose = lqdMap.get(hyg.date);
        if (!lqdClose) { skipped++; continue; }

        const recordedAt = new Date(hyg.date + "T12:00:00Z");

        // Prüfe ob bereits ein Eintrag für diesen Tag existiert
        const existing = await db
          .select({ id: kiBoomMetricsHistory.id, creditSpreadHY: kiBoomMetricsHistory.creditSpreadHY })
          .from(kiBoomMetricsHistory)
          .where(
            sql`DATE(${kiBoomMetricsHistory.recordedAt}) = ${hyg.date}`
          )
          .limit(1);

        if (existing.length > 0) {
          // Aktualisiere nur die Credit-Spread-Felder wenn noch nicht gesetzt
          if (existing[0].creditSpreadHY === null) {
            await db
              .update(kiBoomMetricsHistory)
              .set({
                creditSpreadHY: String(hyg.close) as any,
                creditSpreadIG: String(lqdClose) as any,
              })
              .where(eq(kiBoomMetricsHistory.id, existing[0].id));
            inserted++;
          } else {
            skipped++;
          }
        } else {
          // Neuen Eintrag mit nur Credit-Spread-Daten erstellen
          await db.insert(kiBoomMetricsHistory).values({
            recordedAt,
            creditSpreadHY: String(hyg.close) as any,
            creditSpreadIG: String(lqdClose) as any,
          });
          inserted++;
        }
      }

      return {
        success: true,
        hygPoints: hygData.length,
        lqdPoints: lqdData.length,
        inserted,
        skipped,
        dateRange: {
          from: hygData[0]?.date,
          to: hygData[hygData.length - 1]?.date,
        },
      };
    }),
});
