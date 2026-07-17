import TrustpilotWidget from "./TrustpilotWidget";

export default function TrustpilotMini() {
  const businessUnitId = import.meta.env.VITE_TRUSTPILOT_BUSINESS_UNIT_ID;

  // Ehrlichkeit (Audit H-A1): ohne echtes Trustpilot-Profil KEINE erfundenen
  // Bewertungen («4.8 ★ · 127 Bewertungen») anzeigen — das war fabrizierte
  // Social Proof (UWG-Risiko). Ohne Business-Unit-ID nichts rendern.
  if (!businessUnitId) {
    return null;
  }

  return (
    <TrustpilotWidget
      templateId="5419b6a8b0d04a076446a9ad" // Mini template
      height="24px"
      width="100%"
      theme="dark"
    />
  );
}

