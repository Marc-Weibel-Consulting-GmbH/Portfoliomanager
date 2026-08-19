/**
 * Das Signal als Farbskala — die Darstellung aus STRATEGIE_DREI_SCORES.md,
 * Abschnitt 3: drei Kreise für die Messungen (Qualität, Bewertung, Timing),
 * darunter das ABGELEITETE Signal als Skala 0–100 mit Marker und drei Zonen.
 *
 * Bewusst kein vierter Kreis: Das Signal ist keine vierte Messung, sondern
 * eine Rechnung aus den dreien — die Form soll den Unterschied zeigen.
 *
 * Die Zonengrenzen spiegeln `SCORE_BAENDER` (server/lib/signalBlend.ts), die
 * Tabelle, die auch die Empfehlung bestimmt: Kaufen ab 60, Verkaufen unter 45.
 * Quelle der Wahrheit bleibt der Server — die angezeigte Zone leitet sich
 * zuerst aus dem mitgelieferten Label ab, die gezeichneten Grenzen sind nur
 * Kulisse. So kann die Skala nie eine andere Empfehlung zeigen als die, die
 * der Server berechnet hat.
 */

/** Grenze Verkaufen→Halten. Spiegel von SCORE_BAENDER: SELL endet bei 45. */
export const HALTEN_AB = 45;
/** Grenze Halten→Kaufen. Spiegel von SCORE_BAENDER: BUY beginnt bei 60. */
export const KAUFEN_AB = 60;

/**
 * Server-Label → deutsche Zone. Unbekanntes fällt auf die Score-Zone zurück.
 *
 * E2: Zustandsworte statt Kauforder — das Signal beschreibt den Titel, es
 * ordnet keine Kaufliste (REFORM_BEWERTUNG_SIGNAL.md; der Rangtest zeigte,
 * dass die Signal-Rangfolge keine Kaufauswahl trägt).
 */
function zone(label: string | null, score: number | null): string | null {
  if (label) {
    if (label.includes("BUY")) return "Stark";
    if (label.includes("SELL")) return "Schwach";
    if (label === "HOLD") return "Neutral";
  }
  if (score === null) return null;
  return score >= KAUFEN_AB ? "Stark" : score >= HALTEN_AB ? "Neutral" : "Schwach";
}

export default function SignalSkala({
  score,
  label,
  klartext,
  onClick,
}: {
  score: number | null;
  label: string | null;
  klartext?: string;
  onClick?: () => void;
}) {
  const z = zone(label, score);
  const zonenFarbe = z === "Stark" ? "text-[#4ade80]" : z === "Schwach" ? "text-red-400" : "text-yellow-400";

  return (
    <div
      className={`w-full ${onClick ? "cursor-pointer hover:opacity-90 transition-opacity" : ""}`}
      onClick={onClick}
      title={onClick ? "Klicken für Signal-Erklärung" : ""}
    >
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-xs text-gray-400">
          Signal <span className="text-gray-600">— beschreibt den Zustand, ordnet keine Kaufliste</span>
        </span>
        {score !== null ? (
          <span className={`text-sm font-semibold ${zonenFarbe}`}>
            {z} · {Math.round(score)}
          </span>
        ) : (
          <span className="text-sm text-gray-500">—</span>
        )}
      </div>

      {/* Die Skala: durchgehender Verlauf, Marker auf dem aktuellen Wert. */}
      <div className="relative pt-2">
        {score !== null && (
          <div
            className="absolute top-0 -translate-x-1/2"
            style={{ left: `${Math.max(1, Math.min(99, score))}%` }}
          >
            <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[7px] border-l-transparent border-r-transparent border-t-white" />
          </div>
        )}
        <div
          className="h-2.5 rounded-full"
          style={{
            background: "linear-gradient(to right, #ef4444, #f59e0b 45%, #eab308 55%, #4ade80)",
            opacity: score === null ? 0.25 : 1,
          }}
        />
      </div>

      {/* Zonen — Grenzen gespiegelt aus SCORE_BAENDER (Kaufen ab 60, Verkaufen unter 45). */}
      <div className="relative h-4 mt-1 text-[10px]">
        <span className="absolute text-red-400/80" style={{ left: 0 }}>Schwach</span>
        <span
          className="absolute -translate-x-1/2 text-yellow-400/80"
          style={{ left: `${(HALTEN_AB + KAUFEN_AB) / 2}%` }}
        >
          Neutral
        </span>
        <span className="absolute text-[#4ade80]/80" style={{ right: 0 }}>Stark</span>
      </div>

      {klartext && <p className="text-[11px] text-gray-500 mt-0.5">{klartext}</p>}
    </div>
  );
}
