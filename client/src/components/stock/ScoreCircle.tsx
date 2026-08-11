/**
 * Der Score-Kreis — eine Komponente für alle Flächen.
 *
 * Stand als lokale Funktion in `StockDetail`; die Positionenliste hätte für
 * dieselbe Darstellung eine Kopie gebraucht, und Kopien laufen auseinander —
 * derselbe Weg, auf dem schon zwei Signal-Formeln nebeneinander entstanden.
 */
export default function ScoreCircle({
  score,
  onClick,
  size = "md",
}: {
  score: number | null;
  onClick?: () => void;
  /** `sm` für Detailzeilen in Listen, `md` für Seitenköpfe. */
  size?: "sm" | "md";
}) {
  const circumference = 2 * Math.PI * 40;
  // `null` heisst «nicht beurteilbar» und ist etwas anderes als eine schlechte
  // Note. Der Ring bleibt dann leer und die Mitte zeigt einen Strich.
  const strokeDashoffset = score === null ? circumference : circumference - (score / 100) * circumference;

  // UX2-7: Farbskala deckungsgleich mit der erklärten Notenskala im
  // Score-Dialog (>80 Ausgezeichnet · 61–80 Gut · 41–60 Mittel · ≤40 Schwach).
  const getColor = (s: number | null) => {
    if (s === null) return "#334155";
    if (s > 80) return "#00CFC1";
    if (s > 60) return "#eab308";
    if (s > 40) return "#fb923c";
    return "#ef4444";
  };

  const dim = size === "sm" ? "w-14 h-14" : "w-20 h-20";
  const zahl = size === "sm" ? "text-sm" : "text-xl";

  return (
    <div
      className={`relative ${dim} ${onClick ? "cursor-pointer hover:opacity-80 transition-opacity" : ""}`}
      onClick={onClick}
      title={onClick ? "Klicken für Score-Erklärung" : ""}
    >
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="40" fill="none" stroke="#1a1f2e" strokeWidth="8" />
        <circle
          cx="50" cy="50" r="40" fill="none"
          stroke={getColor(score)} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {score === null ? (
          <span className={`${zahl} font-bold text-gray-500`} title="Zu wenige Kennzahlen für eine Beurteilung">—</span>
        ) : (
          <>
            {/* Ganze Zahlen: Die Nachkommastelle suggeriert eine Genauigkeit,
                die keine der Eingangsgrössen hergibt. */}
            <span className={`${zahl} font-bold text-white`}>{Math.round(score)}</span>
            {size === "md" && <span className="text-xs text-gray-400">/100</span>}
          </>
        )}
      </div>
    </div>
  );
}
