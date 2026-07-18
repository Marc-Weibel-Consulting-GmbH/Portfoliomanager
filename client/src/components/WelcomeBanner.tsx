/**
 * WelcomeBanner — Beta-Onboarding-Banner für neue Nutzer
 *
 * Erscheint auf dem Dashboard für Nutzer, die noch kein Portfolio erstellt haben.
 * Zeigt die 3 wichtigsten Features und einen CTA zum KI-Builder.
 * Kann mit "Schliessen" dauerhaft ausgeblendet werden (localStorage).
 */
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { X, Sparkles, BarChart2, Bell, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "portfolio_welcome_banner_dismissed";

interface WelcomeBannerProps {
  userName?: string | null;
  hasPortfolios?: boolean;
}

export default function WelcomeBanner({ userName, hasPortfolios }: WelcomeBannerProps) {
  const [, navigate] = useLocation();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "1") setDismissed(true);
  }, []);

  // Only show for users without portfolios who haven't dismissed
  if (dismissed || hasPortfolios) return null;

  const firstName = userName?.split(" ")[0] || "Investor";

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setDismissed(true);
  };

  const features = [
    {
      icon: <Sparkles className="h-4 w-4 text-[#00CFC1]" />,
      title: "KI-Portfolio-Builder",
      desc: "Portfolio in 5 Schritten erstellen",
      action: () => navigate("/builder"),
      cta: "Starten",
    },
    {
      icon: <BarChart2 className="h-4 w-4 text-[#00CFC1]" />,
      title: "Markt-Hub",
      desc: "Heatmaps, Sektoren & News",
      action: () => navigate("/markt"),
      cta: "Erkunden",
    },
    {
      icon: <Bell className="h-4 w-4 text-[#00CFC1]" />,
      title: "Kursalarme",
      desc: "Preisziele & Benachrichtigungen",
      action: () => navigate("/alerts"),
      cta: "Einrichten",
    },
  ];

  return (
    <div className="relative rounded-xl border border-[#00CFC1]/25 bg-gradient-to-br from-[#00CFC1]/8 to-[#0891b2]/5 p-5 mb-6">
      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 p-1 rounded text-gray-500 hover:text-gray-300 transition-colors"
        aria-label="Banner schliessen"
      >
        <X className="h-4 w-4" />
      </button>

      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold tracking-widest text-[#00CFC1] uppercase">Willkommen</span>
          <span className="text-xs px-1.5 py-0.5 rounded bg-[#00CFC1]/15 text-[#00CFC1] font-medium">Beta</span>
        </div>
        <h2 className="text-lg font-bold text-white">
          Schön, dass Sie dabei sind, {firstName}! 👋
        </h2>
        <p className="text-sm text-gray-400 mt-0.5">
          Starten Sie mit einem dieser drei Features — alles andere entdecken Sie von selbst.
        </p>
      </div>

      {/* Feature cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        {features.map((f) => (
          <button
            key={f.title}
            onClick={f.action}
            className="flex items-start gap-3 p-3 rounded-lg bg-[#0f1420] border border-white/8 hover:border-[#00CFC1]/30 transition-colors text-left group"
          >
            <div className="mt-0.5 shrink-0">{f.icon}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white group-hover:text-[#00CFC1] transition-colors">{f.title}</div>
              <div className="text-xs text-gray-500 mt-0.5">{f.desc}</div>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-gray-600 group-hover:text-[#00CFC1] shrink-0 mt-0.5 transition-colors" />
          </button>
        ))}
      </div>

      {/* Primary CTA */}
      <div className="flex items-center justify-between">
        <Button
          size="sm"
          className="bg-[#00CFC1] text-[#0a0f1a] hover:bg-[#00CFC1]/90 font-semibold text-sm"
          onClick={() => navigate("/builder")}
        >
          <Sparkles className="h-3.5 w-3.5 mr-1.5" />
          Jetzt KI-Portfolio erstellen
          <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
        </Button>
        <button
          onClick={handleDismiss}
          className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
        >
          Nicht mehr anzeigen
        </button>
      </div>
    </div>
  );
}
