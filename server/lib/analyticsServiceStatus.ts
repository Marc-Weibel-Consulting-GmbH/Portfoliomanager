/**
 * Diagnose: läuft der Python-Analytics-Service (Gradient-Boosting-ML-Pipeline)?
 * Antwortet die offene Frage, ob `ANALYTICS_SERVICE_URL` gesetzt/erreichbar ist —
 * davon hängt ab, ob die seriöse ML-Pipeline aktiv werden kann (statt des geleakten
 * RandomForest-Fallbacks). Siehe AI_ALPHA_ROADMAP.md.
 */

export interface AnalyticsConfig {
  configured: boolean;
  /** Host ohne Pfad/Query (keine Secrets im Klartext). */
  host: string | null;
  hint: string;
}

export interface AnalyticsStatus extends AnalyticsConfig {
  /** true = Ping ok, false = Ping fehlgeschlagen, null = nicht geprüft (weil nicht konfiguriert). */
  reachable: boolean | null;
}

/** Reine Auswertung der Konfiguration (testbar, ohne Netzwerk). */
export function describeAnalyticsConfig(url: string | undefined | null): AnalyticsConfig {
  if (!url || !url.trim()) {
    return {
      configured: false,
      host: null,
      hint: "ANALYTICS_SERVICE_URL ist nicht gesetzt — die trainierte ML-Pipeline ist inaktiv, es greift der Heuristik-/RandomForest-Fallback.",
    };
  }
  let host: string | null = null;
  try {
    host = new URL(url).host;
  } catch {
    return {
      configured: false,
      host: null,
      hint: "ANALYTICS_SERVICE_URL ist gesetzt, aber keine gültige URL.",
    };
  }
  return {
    configured: true,
    host,
    hint: "ANALYTICS_SERVICE_URL ist konfiguriert. Erreichbarkeit wird per Ping geprüft.",
  };
}

/** Vollständiger Status inkl. optionalem Health-Ping (mit Timeout). */
export async function getAnalyticsServiceStatus(): Promise<AnalyticsStatus> {
  const url = process.env.ANALYTICS_SERVICE_URL;
  const cfg = describeAnalyticsConfig(url);
  if (!cfg.configured || !url) {
    return { ...cfg, reachable: null };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const healthUrl = url.replace(/\/+$/, "") + "/health";
    const res = await fetch(healthUrl, { signal: controller.signal });
    clearTimeout(timer);
    return {
      ...cfg,
      reachable: res.ok,
      hint: res.ok
        ? "ANALYTICS_SERVICE_URL ist konfiguriert und erreichbar."
        : `ANALYTICS_SERVICE_URL ist konfiguriert, /health antwortete mit ${res.status}.`,
    };
  } catch {
    return {
      ...cfg,
      reachable: false,
      hint: "ANALYTICS_SERVICE_URL ist konfiguriert, aber /health war nicht erreichbar.",
    };
  }
}
