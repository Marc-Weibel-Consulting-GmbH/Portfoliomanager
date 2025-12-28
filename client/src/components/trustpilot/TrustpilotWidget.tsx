import { useEffect, useRef } from "react";

interface TrustpilotWidgetProps {
  templateId: string;
  businessUnitId?: string;
  height?: string;
  width?: string;
  theme?: "light" | "dark";
  stars?: string;
  locale?: string;
}

export default function TrustpilotWidget({
  templateId,
  businessUnitId = import.meta.env.VITE_TRUSTPILOT_BUSINESS_UNIT_ID || "",
  height = "150px",
  width = "100%",
  theme = "dark",
  stars = "1,2,3,4,5",
  locale = "de-CH",
}: TrustpilotWidgetProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load Trustpilot script if not already loaded
    if (typeof window !== "undefined" && !(window as any).Trustpilot) {
      const script = document.createElement("script");
      script.src = "https://widget.trustpilot.com/bootstrap/v5/tp.widget.bootstrap.min.js";
      script.async = true;
      document.body.appendChild(script);

      script.onload = () => {
        if ((window as any).Trustpilot) {
          (window as any).Trustpilot.loadFromElement(ref.current, true);
        }
      };
    } else if ((window as any).Trustpilot && ref.current) {
      // If script already loaded, just load the widget
      (window as any).Trustpilot.loadFromElement(ref.current, true);
    }
  }, [businessUnitId, templateId]);

  // If no business unit ID, show placeholder
  if (!businessUnitId) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 text-center">
        <div className="text-slate-400 mb-2">
          <svg className="w-12 h-12 mx-auto mb-3" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
          </svg>
        </div>
        <p className="text-white font-semibold mb-1">Trustpilot Bewertungen</p>
        <p className="text-slate-400 text-sm mb-4">
          Konfigurieren Sie Ihre Trustpilot Business Unit ID
        </p>
        <a
          href="https://businessapp.b2b.trustpilot.com/signup"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded text-sm"
        >
          Trustpilot-Konto erstellen
        </a>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className="trustpilot-widget"
      data-locale={locale}
      data-template-id={templateId}
      data-businessunit-id={businessUnitId}
      data-style-height={height}
      data-style-width={width}
      data-theme={theme}
      data-stars={stars}
      data-schema-type="Organization"
    >
      <a
        href={`https://www.trustpilot.com/review/${businessUnitId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-cyan-400 hover:text-cyan-300"
      >
        Trustpilot
      </a>
    </div>
  );
}

