import type { ReactNode } from "react";
import { useLocation } from "wouter";
import { Lock } from "lucide-react";
import { usePlan } from "@/hooks/usePlan";
import { FEATURE_LABELS, FEATURE_MIN_PLAN, type Feature } from "@/lib/features";
import { planLabel } from "@/lib/planLabel";
import { Button } from "@/components/ui/button";

// Zeigt `children`, wenn der Plan das Feature enthält (oder die Paywall im
// Soft-Launch noch nicht scharf ist). Andernfalls einen Schloss-Teaser mit
// der benötigten Stufe («Basic»/«Pro») und einem Upgrade-Button.
//
// Bewusst «sichtbar mit Schloss» statt Ausblenden: Nutzer sehen, was es gibt,
// und erhalten einen klaren Upgrade-Pfad (bessere Conversion, kein leerer Raum).
export function FeatureGate({
  feature,
  children,
  title,
  description,
}: {
  feature: Feature;
  children: ReactNode;
  title?: string;
  description?: string;
}) {
  const { hasFeature, isLoading } = usePlan();
  const [, setLocation] = useLocation();

  // Während des Ladens nichts Halbfertiges zeigen — kurz leer lassen.
  if (isLoading) return null;
  if (hasFeature(feature)) return <>{children}</>;

  const minPlan = FEATURE_MIN_PLAN[feature];
  const label = title ?? FEATURE_LABELS[feature];

  return (
    <div className="rounded-xl border border-[#00CFC1]/25 bg-[#00CFC1]/[0.06] p-6 text-center">
      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[#00CFC1]/15">
        <Lock className="h-5 w-5 text-[#00CFC1]" aria-hidden="true" />
      </div>
      <div className="mb-1 flex items-center justify-center gap-2">
        <h3 className="text-base font-semibold text-white">{label}</h3>
        <span className="rounded-sm bg-[#00CFC1]/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#00CFC1]">
          {planLabel(minPlan)}
        </span>
      </div>
      <p className="mx-auto mb-4 max-w-md text-sm text-gray-400">
        {description ??
          `Diese Funktion ist Teil von ${planLabel(minPlan)}. Upgraden Sie, um ${FEATURE_LABELS[feature]} freizuschalten.`}
      </p>
      <Button
        size="sm"
        className="bg-[#00CFC1] font-semibold text-black hover:bg-[#00b3a6]"
        onClick={() => setLocation("/pricing")}
      >
        Jetzt upgraden
      </Button>
    </div>
  );
}

export default FeatureGate;
