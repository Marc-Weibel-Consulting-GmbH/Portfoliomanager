import { trpc } from "@/lib/trpc";
import type { Feature } from "@/lib/features";

// Zentrale Plan-/Feature-Abfrage für die UI. Spiegelt die serverseitigen
// Entitlements (billing.getPlan liefert plan, enforced und die Feature-Liste).
//
// Soft-Launch: Solange `enforced` false ist (ENFORCE_PAYWALL nicht gesetzt),
// gilt jedes Feature als verfügbar — die UI verhält sich wie bisher, ohne
// Funktionen wegzunehmen. Erst wenn die Paywall scharf geschaltet wird,
// greifen die Schloss-/Teaser-Anzeigen.
export function usePlan() {
  const { data, isLoading } = trpc.billing.getPlan.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });

  const plan = data?.plan ?? "free";
  const enforced = data?.enforced ?? false;
  const features = (data?.limits?.features ?? []) as Feature[];

  const hasFeature = (feature: Feature): boolean =>
    !enforced || features.includes(feature);

  return { plan, enforced, features, hasFeature, isLoading };
}
