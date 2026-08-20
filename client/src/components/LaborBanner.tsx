/**
 * Labor-Banner (K7, design/KONSOLIDIERUNG_RECHENWERKE.md, Leitsatz L4):
 * Kennzeichnet Admin-Seiten der Schicht D — Experimente, die messen und
 * berichten, aber keine kundensichtbare Rechnung beeinflussen.
 */
import { FlaskConical } from "lucide-react";

export default function LaborBanner({ zusatz }: { zusatz?: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-600 dark:text-amber-300">
      <FlaskConical className="h-4 w-4 mt-0.5 shrink-0" />
      <p>
        <span className="font-semibold">Labor — entscheidet nichts.</span>{" "}
        Diese Seite gehört zur Experimentier-Schicht: Sie misst und berichtet,
        beeinflusst aber keine kundensichtbaren Scores, Signale oder
        Empfehlungen. Übernahmen in die Kernrechnung geschehen nur durch eine
        ausdrückliche Freigabe.{zusatz ? ` ${zusatz}` : ""}
      </p>
    </div>
  );
}
