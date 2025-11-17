import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

interface TourStep {
  title: string;
  description: string;
  image: string;
  highlights: {
    x: number; // percentage from left
    y: number; // percentage from top
    width: number; // percentage
    height: number; // percentage
    label: string;
    description: string;
  }[];
}

const tourSteps: TourStep[] = [
  {
    title: "Portfolio Optimizer",
    description: "Wählen Sie Ihre gewünschten Aktien aus und lassen Sie den Optimizer die optimale Gewichtung berechnen. Die Efficient Frontier zeigt Ihnen das beste Risiko-Rendite-Verhältnis.",
    image: "/tour-step-1-optimizer.png",
    highlights: [
      {
        x: 5,
        y: 15,
        width: 90,
        height: 12,
        label: "Portfolio Metriken",
        description: "Erwartete Rendite, Volatilität, Sharpe Ratio und Dividendenrendite auf einen Blick"
      },
      {
        x: 5,
        y: 35,
        width: 25,
        height: 45,
        label: "Aktienauswahl",
        description: "Wählen Sie aus einer Vielzahl von Schweizer und US-Aktien"
      },
      {
        x: 32,
        y: 35,
        width: 35,
        height: 45,
        label: "Efficient Frontier",
        description: "Visualisierung des optimalen Risiko-Rendite-Verhältnisses"
      },
      {
        x: 70,
        y: 50,
        width: 25,
        height: 30,
        label: "Portfolio Allokation",
        description: "Optimale Gewichtung der ausgewählten Aktien"
      }
    ]
  },
  {
    title: "Live Performance Tracking",
    description: "Verfolgen Sie die Performance Ihres Portfolios in Echtzeit. Sehen Sie die Entwicklung einzelner Positionen und des Gesamtportfolios.",
    image: "/tour-step-2-live-tracking.png",
    highlights: [
      {
        x: 5,
        y: 8,
        width: 40,
        height: 8,
        label: "Live Performance",
        description: "Aktuelle Gesamtperformance Ihres Portfolios in Prozent"
      },
      {
        x: 10,
        y: 22,
        width: 80,
        height: 32,
        label: "Performance Chart",
        description: "Visualisierung der Portfoliowertentwicklung über Zeit"
      },
      {
        x: 5,
        y: 58,
        width: 90,
        height: 35,
        label: "Positionen",
        description: "Detaillierte Übersicht aller Positionen mit individueller Performance"
      }
    ]
  },
  {
    title: "Transaktionsverwaltung",
    description: "Erfassen Sie alle Käufe, Verkäufe und Dividenden. Das System berechnet automatisch Ihre Cash-Position und den Gesamtwert.",
    image: "/tour-step-3-transactions.png",
    highlights: [
      {
        x: 5,
        y: 12,
        width: 90,
        height: 10,
        label: "Portfolio Übersicht",
        description: "Total investiert, Cash-Position und Gesamtwert"
      },
      {
        x: 5,
        y: 28,
        width: 90,
        height: 60,
        label: "Transaktionshistorie",
        description: "Vollständige Historie aller Käufe, Verkäufe, Dividenden und Ein-/Auszahlungen"
      }
    ]
  },
  {
    title: "Dividenden-Kalender",
    description: "Behalten Sie den Überblick über bevorstehende Dividendenzahlungen. Das System zeigt Ihnen Ex-Datum, Zahltag und erwarteten Ertrag.",
    image: "/tour-step-4-dividends.png",
    highlights: [
      {
        x: 5,
        y: 12,
        width: 35,
        height: 12,
        label: "Erwarteter Gesamtertrag",
        description: "Summe aller erwarteten Dividenden der nächsten 12 Monate"
      },
      {
        x: 5,
        y: 28,
        width: 90,
        height: 60,
        label: "Dividenden-Übersicht",
        description: "Alle bevorstehenden Dividendenzahlungen mit Datum und Betrag pro Aktie"
      }
    ]
  },
  {
    title: "Jahresübersicht",
    description: "Umfassende Performance-Analyse mit Aufschlüsselung nach unrealisierten Gewinnen, realisierten Gewinnen, Dividenden und Gebühren.",
    image: "/tour-step-5-annual-summary.png",
    highlights: [
      {
        x: 15,
        y: 22,
        width: 70,
        height: 45,
        label: "Performance Breakdown",
        description: "Detaillierte Aufschlüsselung aller Gewinne, Verluste und Erträge"
      },
      {
        x: 15,
        y: 70,
        width: 70,
        height: 12,
        label: "Netto-Performance & ROI",
        description: "Gesamtergebnis und Return on Investment in Prozent"
      }
    ]
  }
];

interface GuidedTourModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function GuidedTourModal({ open, onOpenChange }: GuidedTourModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedHighlight, setSelectedHighlight] = useState<number | null>(null);

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1);
      setSelectedHighlight(null);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      setSelectedHighlight(null);
    }
  };

  const handleClose = () => {
    setCurrentStep(0);
    setSelectedHighlight(null);
    onOpenChange(false);
  };

  const step = tourSteps[currentStep];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl">{step.title}</DialogTitle>
            <Button variant="ghost" size="icon" onClick={handleClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-muted-foreground mt-2">{step.description}</p>
        </DialogHeader>

        <div className="relative mt-4">
          {/* Screenshot */}
          <div className="relative rounded-lg overflow-hidden border border-border">
            <img 
              src={step.image} 
              alt={step.title}
              className="w-full h-auto"
            />
            
            {/* Highlight overlays */}
            {step.highlights.map((highlight, index) => (
              <div
                key={index}
                className={`absolute cursor-pointer transition-all ${
                  selectedHighlight === index 
                    ? 'ring-4 ring-primary bg-primary/10' 
                    : 'ring-2 ring-primary/50 hover:ring-primary hover:bg-primary/5'
                }`}
                style={{
                  left: `${highlight.x}%`,
                  top: `${highlight.y}%`,
                  width: `${highlight.width}%`,
                  height: `${highlight.height}%`,
                }}
                onClick={() => setSelectedHighlight(selectedHighlight === index ? null : index)}
              >
                {/* Label badge */}
                <div className="absolute -top-2 left-2 bg-primary text-primary-foreground px-2 py-1 rounded text-xs font-medium shadow-lg">
                  {index + 1}
                </div>
              </div>
            ))}
          </div>

          {/* Highlight descriptions */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {step.highlights.map((highlight, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border transition-all cursor-pointer ${
                  selectedHighlight === index
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
                onClick={() => setSelectedHighlight(selectedHighlight === index ? null : index)}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">{highlight.label}</h4>
                    <p className="text-sm text-muted-foreground">{highlight.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Zurück
          </Button>

          <div className="flex items-center gap-2">
            {tourSteps.map((_, index) => (
              <button
                key={index}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentStep
                    ? 'bg-primary w-8'
                    : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
                }`}
                onClick={() => {
                  setCurrentStep(index);
                  setSelectedHighlight(null);
                }}
                aria-label={`Gehe zu Schritt ${index + 1}`}
              />
            ))}
          </div>

          {currentStep < tourSteps.length - 1 ? (
            <Button onClick={handleNext}>
              Weiter
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleClose}>
              Tour beenden
            </Button>
          )}
        </div>

        {/* Progress indicator */}
        <div className="text-center text-sm text-muted-foreground mt-2">
          Schritt {currentStep + 1} von {tourSteps.length}
        </div>
      </DialogContent>
    </Dialog>
  );
}
