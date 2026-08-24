/**
 * K13 — Variations-Loop der Lernwerkstatt (design/KONSOLIDIERUNG_RECHENWERKE.md).
 *
 * Das AVO-Muster (Kontext → Plan → Umsetzen → Evaluieren → Diagnose), auf
 * dieses Projekt übersetzt: Kandidaten sind PARAMETERSÄTZE der bestehenden
 * Signal-Rechnung (Regime-Gewichte aus `dreiScoreSignal`), nie neue Formeln
 * (L1). Gemessen wird mit derselben Rechnung wie «Signal-Gewichte messen»
 * (Zeit-Holdout, nach Kosten, gegen «alles kaufen») — und übernommen wird
 * hier NICHTS: Der beste taugliche Kandidat wird im Ledger als Vorschlag
 * markiert, der Commit ist der Freigabe-Klick des Projektleiters (L3).
 *
 * Warum kleine Variationen statt des vollen Rasters aus `gewichtsRaster`:
 * Das Raster beantwortet «wo liegt global das Optimum?» — mit 171 Versuchen,
 * von denen die meisten weit weg vom Betrieb liegen. Der Loop fragt etwas
 * anderes: «Ist ein benachbarter, klein benannter Schritt nachweislich
 * besser als das, was läuft?» Nur solche Schritte sind als Übernahme je
 * begründbar; ein Sprung quer durchs Dreieck wäre ein neues Modell.
 */
import { createHash } from "crypto";
import type { SignalGewichte } from "./dreiScoreSignal";
import {
  bewerteGewichte,
  pruefeTauglichkeit,
  zeitSchnitt,
  type Auswertung,
  type Beobachtung,
} from "./signalGewichteBacktest";

/** Schrittweite der Qualitäts-Verschiebung je Regime, in Prozentpunkten. */
export const VARIATION_SCHRITT_PP = 5;

/**
 * Höchstens so viele Kandidaten je Lauf.
 *
 * 7 Regime × 4 Schritte (±1, ±2) sind 28 — das Budget kappt darüber. Die
 * Grenze ist eine Stop-Bedingung aus der Vorlage: Ohne sie erzeugte jeder
 * Lauf so lange Kandidaten, bis allein die Zahl der Versuche einen
 * Scheingewinner liefert.
 */
export const LAUF_BUDGET = 30;

/** Ab so vielen Läufen ohne Verbesserung rät der Loop zum Stopp. */
export const MAX_RUNDEN_OHNE_VERBESSERUNG = 3;

/** Qualitätsanteil bleibt in diesem Band — 0 oder 1 wäre ein anderes Modell. */
const Q_MIN = 0.05;
const Q_MAX = 0.95;

export interface VariationsKandidat {
  /** SHA-256 über den kanonischen Parametersatz — Identität im Ledger. */
  schluessel: string;
  /** Von welchem Satz dieser Kandidat abstammt (Herkunftslinie). */
  elternSchluessel: string;
  /** Menschlich lesbar, z. B. «bull: Qualität 35 % → 40 %». */
  beschreibung: string;
  gewichte: Record<string, SignalGewichte>;
}

/**
 * Kanonischer Schlüssel eines Parametersatzes.
 *
 * Regime und Gewichtsfelder werden sortiert und gerundet serialisiert, damit
 * derselbe Satz unabhängig von Objekt-Reihenfolge und Fliesskomma-Rauschen
 * denselben Schlüssel bekommt — sonst zählte der Dedupe-Schutz nichts.
 */
export function kandidatenSchluessel(gewichte: Record<string, SignalGewichte>): string {
  const kanonisch = Object.keys(gewichte).sort().map((regime) => {
    const w = gewichte[regime];
    return `${regime}:${w.qualitaet.toFixed(4)}/${w.bewertung.toFixed(4)}/${w.timing.toFixed(4)}`;
  }).join("|");
  return createHash("sha256").update(kanonisch).digest("hex");
}

/**
 * Plan-Schritt: kleine Variationen um die Basis, je Regime ±1 und ±2 Schritte
 * auf der Qualität↔Timing-Achse. Die Bewertung bleibt unangetastet — ihr
 * Gewicht ist eine E1-Entscheidung (Wächter statt Summand), keine
 * Stellschraube für den Loop.
 *
 * `schonGemessen` (Schlüssel aus dem Ledger) hält Kandidaten fern, die eine
 * frühere Runde bereits gemessen hat — sonst konvergiert der Loop nie,
 * weil verworfene Kandidaten in jeder Runde neu aufträten.
 */
export function planeVariationen(
  basis: Record<string, SignalGewichte>,
  schonGemessen: ReadonlySet<string>,
  schrittPp: number = VARIATION_SCHRITT_PP,
  budget: number = LAUF_BUDGET,
): VariationsKandidat[] {
  const elternSchluessel = kandidatenSchluessel(basis);
  const schritt = schrittPp / 100;
  const aus: VariationsKandidat[] = [];

  for (const regime of Object.keys(basis)) {
    for (const faktor of [-2, -1, 1, 2]) {
      const q = Number((basis[regime].qualitaet + faktor * schritt).toFixed(4));
      if (q < Q_MIN || q > Q_MAX) continue;
      const gewichte: Record<string, SignalGewichte> = {
        ...basis,
        [regime]: {
          qualitaet: q,
          bewertung: basis[regime].bewertung,
          timing: Number((1 - q - basis[regime].bewertung).toFixed(4)),
        },
      };
      const schluessel = kandidatenSchluessel(gewichte);
      if (schonGemessen.has(schluessel)) continue;
      if (aus.some((k) => k.schluessel === schluessel)) continue;
      aus.push({
        schluessel,
        elternSchluessel,
        beschreibung: `${regime}: Qualität ${Math.round(basis[regime].qualitaet * 100)} % → ${Math.round(q * 100)} %`,
        gewichte,
      });
      if (aus.length >= budget) return aus;
    }
  }
  return aus;
}

export interface KandidatenBewertung {
  training: Auswertung;
  pruefung: Auswertung;
  /** Training ÷ Prüfung (Sharpe) — wie `sucheGewichte`. */
  ueberanpassung: number;
  trennDatum: string | null;
  taugt: boolean;
  hinweis: string | null;
}

/**
 * Evaluator-Schritt: EIN Kandidat, dieselbe Rechnung wie `sucheGewichte` —
 * nur ohne Suche. Zeit-Holdout, nach Kosten, gegen «alles kaufen», mit dem
 * unveränderten Tauglichkeits-Urteil aus `pruefeTauglichkeit` (L1: eine
 * Mess-Wahrheit, kein zweiter Massstab für den Loop).
 */
export function bewerteKandidatenSatz(
  beobachtungen: Beobachtung[],
  gewichte: Record<string, SignalGewichte>,
  horizontMonate = 1,
): KandidatenBewertung {
  const { trennDatum, training, pruefung } = zeitSchnitt(beobachtungen);
  const t = bewerteGewichte(training, gewichte, horizontMonate);
  const p = bewerteGewichte(pruefung.length ? pruefung : [], gewichte, horizontMonate);
  const ueberanpassung = p.signal.sharpe !== 0 ? t.signal.sharpe / p.signal.sharpe : 0;

  if (!training.length || !pruefung.length) {
    return {
      training: t, pruefung: p, ueberanpassung: 0, trennDatum,
      taugt: false, hinweis: "Zu wenige Stichtage für einen Zeitschnitt.",
    };
  }

  const urteil = pruefeTauglichkeit(p, ueberanpassung, t.signal.sharpe);
  return { training: t, pruefung: p, ueberanpassung, trennDatum, ...urteil };
}

/**
 * Stop-Bedingung der Vorlage: Nach `MAX_RUNDEN_OHNE_VERBESSERUNG` Läufen, in
 * denen kein Kandidat den bisher besten Prüf-Sharpe übertraf, rät der Loop
 * zum Stopp — weiterprobieren fände nur noch das Rauschen des Fensters.
 */
export function stopHinweis(rundenOhneVerbesserung: number): string | null {
  if (rundenOhneVerbesserung < MAX_RUNDEN_OHNE_VERBESSERUNG) return null;
  return `${rundenOhneVerbesserung} Läufe in Folge ohne Verbesserung — weitere Variationen `
    + `um dieselbe Basis versprechen nichts; erst neue Daten (längere Reihe) ändern das.`;
}
