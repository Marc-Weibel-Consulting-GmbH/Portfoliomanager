import TrustpilotWidget from "./TrustpilotWidget";
import { TrustpilotDemoMini } from "./TrustpilotDemo";

export default function TrustpilotMini() {
  const businessUnitId = import.meta.env.VITE_TRUSTPILOT_BUSINESS_UNIT_ID;

  // Use demo mode if no Business Unit ID configured
  if (!businessUnitId) {
    return <TrustpilotDemoMini />;
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

