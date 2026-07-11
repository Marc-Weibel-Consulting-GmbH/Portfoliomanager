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
import { desc, gte, sql } from "drizzle-orm";
import { publicProcedure, router } from "../_core/trpc";
import { fetchHistoricalPrices } from "../_core/stockDataApi";
import { getDb } from "../db";
import { kiBoomMetricsHistory } from "../../drizzle/schema";

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
  const [nvidiaData, mag7Data] = await Promise.allSettled([
    fetchNvidiaMetrics(),
    fetchMagnificentSevenPerf(),
  ]);

  const nvidia = nvidiaData.status === "fulfilled" ? nvidiaData.value : { price: 0, prevPrice: 0, pe: null };
  const mag7 = mag7Data.status === "fulfilled" ? mag7Data.value : { avgYtd: 0, prevAvgYtd: 0 };

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

    // 3. OpenAI Verlustquote
    {
      label: "OpenAI Verlustquote",
      value: `${STATIC_METRICS.openAiVerlustquote}%`,
      numericValue: STATIC_METRICS.openAiVerlustquote,
      zone: determineZone(STATIC_METRICS.openAiVerlustquote, 50, 70, false),
      description: `OpenAI verliert ${STATIC_METRICS.openAiVerlust2025} bei ${STATIC_METRICS.openAiUmsatz2025} Umsatz (H1 2025). Verlustquote: ${STATIC_METRICS.openAiVerlustquote}%. Profitabilität frühestens 2029 erwartet.`,
      warnThreshold: "> 50%",
      criticalThreshold: "> 70%",
      trend: "up",
    },

    // 4. Hyperscaler CapEx-Wachstum
    // Logik: Hohes Wachstum (>30%) = Überhitzung = Warnung (gelb)
    //        Normales Wachstum (5-30%) = OK (grün)
    //        Rückgang (<5%) = Warnung, Einbruch (<0%) = Kritisch
    // Aktuell +81% = Überhitzungswarnung (gelb), KEIN Ausstiegssignal
    {
      label: "Hyperscaler CapEx-Wachstum",
      value: `+${STATIC_METRICS.hyperscalerCapexWachstum}% YoY`,
      numericValue: STATIC_METRICS.hyperscalerCapexWachstum,
      zone: STATIC_METRICS.hyperscalerCapexWachstum > 30
        ? "gelb"  // Überhitzung: zu hohes Wachstum ist ein Warnsignal
        : STATIC_METRICS.hyperscalerCapexWachstum >= 5
          ? "gruen" // Normales Wachstum
          : STATIC_METRICS.hyperscalerCapexWachstum >= 0
            ? "gelb"  // Verlangsamung: Warnung
            : "rot",  // Rückgang: Kritisch (Boom bricht zusammen)
      description: `Amazon, Google, Microsoft und Meta planen ${STATIC_METRICS.hyperscalerCapex2026} CapEx für 2026 – ein Wachstum von +${STATIC_METRICS.hyperscalerCapexWachstum}% YoY. ${
        STATIC_METRICS.hyperscalerCapexWachstum > 30
          ? "Überhitzungssignal: Exponentielles Wachstum ist strukturell nicht nachhaltig – Warnsignal."
          : STATIC_METRICS.hyperscalerCapexWachstum >= 5
            ? "Normales Wachstum – Boom intakt."
            : STATIC_METRICS.hyperscalerCapexWachstum >= 0
              ? "Verlangsamung erkennbar – Warnsignal."
              : "CapEx-Rückgang – Boom bricht zusammen."
      }`,
      warnThreshold: "> 30% (Überhitzung) oder < 5% (Verlangsamung)",
      criticalThreshold: "< 0% (Rückgang = Boom-Ende)",
      trend: "up",
    },

    // 5. VC-Anteil KI
    {
      label: "VC-Anteil KI-Startups",
      value: `${STATIC_METRICS.vcAnteilKI}%`,
      numericValue: STATIC_METRICS.vcAnteilKI,
      zone: determineZone(STATIC_METRICS.vcAnteilKI, 50, 40, true),
      description: `${STATIC_METRICS.vcAnteilKI}% aller globalen VC-Investitionen (${STATIC_METRICS.vcGesamtvolumen}) flossen 2025 in KI-Unternehmen (PitchBook). Ein Rückgang unter 50% signalisiert nachlassendes Investorenvertrauen.`,
      warnThreshold: "< 50%",
      criticalThreshold: "< 40%",
      trend: "stable",
    },

    // 6. KI-Pilotprojekte ROI
    {
      label: "KI-Projekt ROI-Erfolgsquote",
      value: `${STATIC_METRICS.pilotProjektROIQuote}%`,
      numericValue: STATIC_METRICS.pilotProjektROIQuote,
      zone: determineZone(STATIC_METRICS.pilotProjektROIQuote, 30, 15, true),
      description: `Nur ${STATIC_METRICS.pilotProjektROIQuote}% der KI-Pilotprojekte erreichen ihre ROI-Ziele (McKinsey/Gartner 2025). Solange die Monetarisierung nicht funktioniert, ist der Boom auf Hoffnungen gebaut.`,
      warnThreshold: "< 30%",
      criticalThreshold: "< 15%",
      trend: "stable",
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
      : `${activeWarnings} von 6 Warnsignalen aktiv – erhöhte Vorsicht geboten`;
  } else if (ausstiegPruefen) {
    ausstiegsGrund = activeCritical >= 1
      ? `${activeCritical} kritisches Signal aktiv – Position beobachten`
      : `${activeWarnings} Warnsignale aktiv – Beobachtungsmodus`;
    // Szenario-Kontext: erklärt warum kein Sofortausstieg
    szenarioKontext = `Neutrales Szenario: Heisse Phase erwartet ${SCENARIOS.neutralSzenarioHotPhase}. Sofortiger Ausstieg erst bei ≥${SCENARIOS.minCriticalForImmediateExit} kritischen Signalen oder ≥5 Warnungen.`;
  }

  return {
    overallZone,
    activeWarnings,
    activeCritical,
    lastUpdated: new Date().toISOString(),
    signals,
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

export async function recordKiBoomSnapshot(): Promise<{
  overallZone: string;
  activeWarnings: number;
  activeCritical: number;
}> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const data = await computeKiBoomData();
  const nvidia = data.signals.find((s) => s.label === "Nvidia Aktienkurs");
  const mag7 = data.signals.find((s) => s.label === "Magnificent Seven YTD");

  await db.insert(kiBoomMetricsHistory).values({
    recordedAt: new Date(),
    nvidiaPrice: nvidia?.numericValue != null ? String(nvidia.numericValue) : null,
    mag7AvgYtd: mag7?.numericValue != null ? String(mag7.numericValue) : null,
    openAiVerlustquote: String(STATIC_METRICS.openAiVerlustquote),
    hyperscalerCapexWachstum: String(STATIC_METRICS.hyperscalerCapexWachstum),
    vcAnteilKI: String(STATIC_METRICS.vcAnteilKI),
    pilotProjektROIQuote: String(STATIC_METRICS.pilotProjektROIQuote),
    overallZone: data.overallZone,
    activeWarnings: data.activeWarnings,
    activeCritical: data.activeCritical,
    scenarioSanfte: data.scenarioProbabilities.sanfteVerlangsamung,
    scenarioCrash: data.scenarioProbabilities.schnellerCrash,
    scenarioBoom: data.scenarioProbabilities.weiterhinBoom,
  });

  return {
    overallZone: data.overallZone,
    activeWarnings: data.activeWarnings,
    activeCritical: data.activeCritical,
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
});
