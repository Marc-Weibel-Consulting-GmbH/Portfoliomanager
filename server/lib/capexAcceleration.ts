/**
 * Zweite Ableitung des Hyperscaler-Capex-Wachstums.
 *
 * Das Monitoring erfasst `hyperscalerCapexWachstum` — die Wachstumsrate, also
 * die erste Ableitung. Ob diese Rate selbst steigt oder fällt, wurde nirgends
 * festgehalten. Genau dort entscheidet sich aber, ob eine Finanzierungs-
 * struktur trägt: Verpflichtungen, die gegen erwartetes Wachstum eingegangen
 * wurden, brauchen nicht ein hohes Niveau, sondern anhaltend hohe Zuwächse.
 *
 * Es gibt ein Zeitfenster, in dem das Niveau auf Rekord steht, das Wachstum
 * positiv ist und die Beschleunigung bereits negativ — von aussen sieht alles
 * intakt aus. Diese Kennzahl macht dieses Fenster sichtbar.
 *
 * BEWUSST OHNE WARNSCHWELLE. Ein Grenzwert, der vor der ersten Beobachtung der
 * Reihe festgelegt wird, ist geraten. Erst messen, dann bewerten.
 */

export interface WachstumsPunkt {
  /** Zeitpunkt der Messung. */
  recordedAt: Date | string;
  /** Wachstumsrate in Prozent, oder null wenn nicht erhoben. */
  wachstumPct: number | null;
}

export interface BeschleunigungsPunkt {
  recordedAt: string;
  /** Wachstumsrate zum Zeitpunkt, in Prozent. */
  wachstumPct: number;
  /**
   * Veränderung der Wachstumsrate gegenüber der vorherigen Messung, in
   * Prozentpunkten. Null beim ersten Punkt — dort gibt es keinen Vorgänger.
   */
  beschleunigungPp: number | null;
}

/** Wie sich Niveau, Tempo und Beschleunigung zueinander verhalten. */
export type Phase =
  | "beschleunigt"      // Wachstum positiv und nimmt zu
  | "verlangsamt"       // Wachstum positiv, aber Beschleunigung negativ
  | "schrumpft"         // Wachstum negativ
  | "konstant"          // Wert unveraendert — keine gemessene Reihe
  | "unbestimmt";       // zu wenig Daten

/**
 * Reihe der Wachstumsraten → Reihe mit Beschleunigung.
 *
 * Punkte ohne Wert werden übersprungen, nicht als 0 gewertet: eine fehlende
 * Messung ist keine Nullbeschleunigung.
 */
export function berechneBeschleunigung(punkte: WachstumsPunkt[]): BeschleunigungsPunkt[] {
  const gueltig = (punkte ?? [])
    .filter((p) => p && typeof p.wachstumPct === "number" && Number.isFinite(p.wachstumPct))
    .map((p) => ({
      recordedAt: new Date(p.recordedAt).toISOString(),
      wachstumPct: p.wachstumPct as number,
    }))
    .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));

  return gueltig.map((p, i) => ({
    ...p,
    beschleunigungPp: i === 0 ? null : p.wachstumPct - gueltig[i - 1].wachstumPct,
  }));
}

/**
 * Aktuelle Phase aus der Reihe.
 *
 * «verlangsamt» ist der Zustand, der von Niveau und Wachstum allein nicht zu
 * erkennen ist — beide sehen dort unauffällig aus.
 */
export function aktuellePhase(reihe: BeschleunigungsPunkt[]): Phase {
  const letzte = reihe[reihe.length - 1];
  if (!letzte || letzte.beschleunigungPp === null) return "unbestimmt";
  // Ein ueber die gesamte Reihe unveraenderter Wert ist keine Messung mit
  // Beschleunigung 0, sondern eine hinterlegte Konstante, die bei jedem
  // Snapshot mitgeschrieben wurde. Das als «keine Veraenderung» zu melden
  // waere eine Aussage ueber die Welt, wo nur eine ueber die Daten moeglich ist.
  if (istKonstant(reihe)) return "konstant";
  if (letzte.wachstumPct < 0) return "schrumpft";
  return letzte.beschleunigungPp < 0 ? "verlangsamt" : "beschleunigt";
}

/** Reihe ohne jede Variation? Dann liegt keine gemessene Zeitreihe vor. */
export function istKonstant(reihe: BeschleunigungsPunkt[]): boolean {
  if (reihe.length < 2) return false;
  return reihe.every((p) => p.wachstumPct === reihe[0].wachstumPct);
}

export const PHASE_LABELS: Record<Phase, string> = {
  beschleunigt: "Wachstum nimmt zu",
  verlangsamt: "Wachstum verlangsamt sich",
  schrumpft: "Rückläufig",
  konstant: "Unverändert hinterlegt — keine Zeitreihe",
  unbestimmt: "Zu wenig Daten",
};
