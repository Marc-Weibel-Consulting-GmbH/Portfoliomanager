import { useViewDensity, type ViewDensity } from "@/contexts/ViewDensityContext";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";

// Umschalter «Einfach ⇄ Detailliert» — unabhängig vom Abo. Bewusst gross und
// beschriftet für das 50+-Zielpublikum. Wird im Dashboard- und Portfolio-Header
// platziert und wirkt global (localStorage-Präferenz via ViewDensityContext).
const OPTIONS: { value: ViewDensity; label: string }[] = [
  { value: "einfach", label: "Einfach" },
  { value: "detailliert", label: "Detailliert" },
];

export function ViewDensityToggle({ className = "" }: { className?: string }) {
  const { density, setDensity } = useViewDensity();

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <span className="text-xs text-gray-400 hidden sm:inline">Ansicht</span>
      <div
        className="flex bg-[#1a2332] rounded-md p-0.5"
        role="group"
        aria-label="Ansicht wählen: Einfach oder Detailliert"
      >
        {OPTIONS.map(opt => (
          <button
            key={opt.value}
            type="button"
            aria-pressed={density === opt.value}
            onClick={() => setDensity(opt.value)}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              density === opt.value
                ? "bg-[#00CFC1] text-black font-semibold"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Was bedeutet Einfach/Detailliert?"
            className="text-gray-500 hover:text-gray-300 cursor-help"
          >
            <Info className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="bg-[#1a1f2e] border-white/20 text-white max-w-[260px] p-3">
          <p className="text-xs text-gray-300">
            <strong className="text-white">Einfach</strong> zeigt die wichtigsten Zahlen im Überblick.{" "}
            <strong className="text-white">Detailliert</strong> blendet zusätzlich fortgeschrittene
            Kennzahlen und Analysen ein (z.&nbsp;B. Sharpe, Risiko, KI-Empfehlungen).
          </p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

export default ViewDensityToggle;
