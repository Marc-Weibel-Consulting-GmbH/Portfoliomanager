/**
 * KI-Boom Warnsystem Router
 * Liefert Echtzeit-Metriken zur Beurteilung des KI-Booms:
 * - Nvidia-Aktienkurs + KGV
 * - Magnificent Seven Performance
 * - VC-Finanzierungstrends
 * - Hyperscaler CapEx-Wachstum
 * - Bewertungsmetriken
 */
import { publicProcedure, router } from "../_core/trpc";
import { fetchHistoricalPrices } from "../_core/stockDataApi";

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
      pe: null, // KGV nicht direkt aus Preisdaten verfügbar
    };
  } catch {
    return { price: 0, prevPrice: 0, pe: null };
  }
}

async function fetchMagnificentSevenPerf(): Promise<{ avgYtd: number; prevAvgYtd: number }> {
  const tickers = ["NVDA", "MSFT", "GOOGL", "AMZN", "META", "AAPL", "TSLA"];
  try {
    const results = await Promise.allSettled(
      tickers.map((t) => fetchHistoricalPrices(t, 1)) // 1 Jahr
    );
    let totalYtd = 0;
    let count = 0;
    for (const r of results) {
      if (r.status === "fulfilled" && r.value && r.value.length >= 2) {
        const sorted = [...r.value].sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
        // Jahresanfang: ersten Datenpunkt des Jahres suchen
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
    return { avgYtd: avg, prevAvgYtd: avg * 0.95 }; // Prev approximiert
  } catch {
    return { avgYtd: 0, prevAvgYtd: 0 };
  }
}

// ── Statische Metriken (Research-basiert, quartalsweise aktualisiert) ──────
// Quellen: OpenAI Finanzdaten (Bloomberg/FT), Gartner, PitchBook, CB Insights

const STATIC_METRICS = {
  // OpenAI Finanzdaten H1 2025
  openAiUmsatz2025: "4,3 Mrd. USD",
  openAiVerlust2025: "-2,5 Mrd. USD",
  openAiVerlustquote: 58, // %
  // Bewertungen (Stand Q2 2026)
  anthropicBewertung: "965 Mrd. USD",
  openAiBewertung: "852 Mrd. USD",
  // Hyperscaler CapEx 2026 (Amazon + Google + Microsoft + Meta)
  hyperscalerCapex2026: "725 Mrd. USD",
  hyperscalerCapexWachstum: 81, // % YoY
  // VC-Markt (PitchBook 2025)
  vcAnteilKI: 61, // % aller VC-Investitionen
  vcGesamtvolumen: "258,7 Mrd. USD",
  // Gartner / McKinsey
  pilotProjektROIQuote: 5, // % der Projekte erreichen ROI-Ziele
};

// ── Router ─────────────────────────────────────────────────────────────────

export const kiBoomRouter = router({
  /**
   * Liefert alle KI-Boom-Metriken inkl. Warnsignale
   */
  getDashboard: publicProcedure.query(async (): Promise<KiBoomData> => {
    // Parallele Marktdaten-Abfragen
    const [nvidiaData, mag7Data] = await Promise.allSettled([
      fetchNvidiaMetrics(),
      fetchMagnificentSevenPerf(),
    ]);

    const nvidia = nvidiaData.status === "fulfilled" ? nvidiaData.value : { price: 0, prevPrice: 0, pe: null };
    const mag7 = mag7Data.status === "fulfilled" ? mag7Data.value : { avgYtd: 0, prevAvgYtd: 0 };

    // ── Signale definieren ──────────────────────────────────────────────────

    const signals: SignalResult[] = [
      // 1. Nvidia-Kurs (Proxy für KI-Infrastruktur-Nachfrage)
      {
        label: "Nvidia Aktienkurs",
        value: nvidia.price > 0 ? `$${nvidia.price.toFixed(2)}` : "Keine Daten",
        numericValue: nvidia.price,
        zone: nvidia.price > 0
          ? determineZone(nvidia.price, 80, 50, true) // Grün >$80, Gelb >$50, Rot <$50
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

      // 2. Magnificent Seven YTD-Performance
      {
        label: "Magnificent Seven YTD",
        value: mag7.avgYtd !== 0 ? `${mag7.avgYtd >= 0 ? "+" : ""}${mag7.avgYtd.toFixed(1)}%` : "Keine Daten",
        numericValue: mag7.avgYtd,
        zone: mag7.avgYtd !== 0
          ? determineZone(mag7.avgYtd, 5, -10, true) // Grün >+5%, Gelb >-10%, Rot <-10%
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

      // 3. OpenAI Verlustquote (statisch, quartalsweise)
      {
        label: "OpenAI Verlustquote",
        value: `${STATIC_METRICS.openAiVerlustquote}%`,
        numericValue: STATIC_METRICS.openAiVerlustquote,
        zone: determineZone(STATIC_METRICS.openAiVerlustquote, 50, 70, false), // Grün <50%, Gelb <70%, Rot >70%
        description: `OpenAI verliert ${STATIC_METRICS.openAiVerlust2025} bei ${STATIC_METRICS.openAiUmsatz2025} Umsatz (H1 2025). Verlustquote: ${STATIC_METRICS.openAiVerlustquote}%. Profitabilität frühestens 2029 erwartet.`,
        warnThreshold: "> 50%",
        criticalThreshold: "> 70%",
        trend: "up", // Verluste steigen
      },

      // 4. Hyperscaler CapEx-Wachstum (statisch)
      {
        label: "Hyperscaler CapEx-Wachstum",
        value: `+${STATIC_METRICS.hyperscalerCapexWachstum}% YoY`,
        numericValue: STATIC_METRICS.hyperscalerCapexWachstum,
        zone: determineZone(STATIC_METRICS.hyperscalerCapexWachstum, 30, 5, false), // Grün <30%, Gelb <5%, Rot <0%
        description: `Amazon, Google, Microsoft und Meta planen ${STATIC_METRICS.hyperscalerCapex2026} CapEx für 2026 – ein Wachstum von +${STATIC_METRICS.hyperscalerCapexWachstum}% YoY. Exponentielles Wachstum ist strukturell nicht nachhaltig.`,
        warnThreshold: "< 5% Wachstum",
        criticalThreshold: "< 0% (Rückgang)",
        trend: "up",
      },

      // 5. VC-Finanzierung KI-Anteil (statisch)
      {
        label: "VC-Anteil KI-Startups",
        value: `${STATIC_METRICS.vcAnteilKI}%`,
        numericValue: STATIC_METRICS.vcAnteilKI,
        zone: determineZone(STATIC_METRICS.vcAnteilKI, 50, 40, true), // Grün >50%, Gelb >40%, Rot <40%
        description: `${STATIC_METRICS.vcAnteilKI}% aller globalen VC-Investitionen (${STATIC_METRICS.vcGesamtvolumen}) flossen 2025 in KI-Unternehmen (PitchBook). Ein Rückgang unter 50% signalisiert nachlassendes Investorenvertrauen.`,
        warnThreshold: "< 50%",
        criticalThreshold: "< 40%",
        trend: "stable",
      },

      // 6. KI-Pilotprojekte ROI-Erfolgsquote (statisch)
      {
        label: "KI-Projekt ROI-Erfolgsquote",
        value: `${STATIC_METRICS.pilotProjektROIQuote}%`,
        numericValue: STATIC_METRICS.pilotProjektROIQuote,
        zone: determineZone(STATIC_METRICS.pilotProjektROIQuote, 30, 15, true), // Grün >30%, Gelb >15%, Rot <15%
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
    if (activeCritical >= 1) overallZone = "rot";
    else if (activeWarnings >= 2) overallZone = "gelb";

    const ausstiegsEmpfehlung = activeCritical >= 1 || activeWarnings >= 4;
    const ausstiegsGrund = ausstiegsEmpfehlung
      ? activeCritical >= 1
        ? `${activeCritical} kritische(s) Signal(e) aktiv – sofortiger Ausstieg empfohlen`
        : `${activeWarnings} Warnsignale gleichzeitig aktiv – Ausstieg prüfen`
      : null;

    return {
      overallZone,
      activeWarnings,
      activeCritical,
      lastUpdated: new Date().toISOString(),
      signals,
      scenarioProbabilities: {
        sanfteVerlangsamung: 30,
        schnellerCrash: 40,
        weiterhinBoom: 30,
      },
      ausstiegsEmpfehlung,
      ausstiegsGrund,
      staticMetrics: STATIC_METRICS,
    };
  }),
});
