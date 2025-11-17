import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, ArrowRight, ArrowLeft } from "lucide-react";

interface TourStep {
  target: string;
  title: string;
  content: string;
  position: "top" | "bottom" | "left" | "right";
}

interface InteractiveTourProps {
  steps: TourStep[];
  onComplete: () => void;
  onSkip: () => void;
}

export default function InteractiveTour({ steps, onComplete, onSkip }: InteractiveTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    const updatePosition = () => {
      const target = document.querySelector(steps[currentStep].target);
      if (target) {
        const rect = target.getBoundingClientRect();
        const tooltipPosition = calculatePosition(rect, steps[currentStep].position);
        setPosition(tooltipPosition);

        // Highlight the target element
        target.classList.add("tour-highlight");
        return () => target.classList.remove("tour-highlight");
      }
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    return () => window.removeEventListener("resize", updatePosition);
  }, [currentStep, steps]);

  const calculatePosition = (rect: DOMRect, position: string) => {
    const offset = 20;
    switch (position) {
      case "top":
        return { top: rect.top - 150 - offset, left: rect.left + rect.width / 2 - 150 };
      case "bottom":
        return { top: rect.bottom + offset, left: rect.left + rect.width / 2 - 150 };
      case "left":
        return { top: rect.top + rect.height / 2 - 75, left: rect.left - 320 - offset };
      case "right":
        return { top: rect.top + rect.height / 2 - 75, left: rect.right + offset };
      default:
        return { top: rect.bottom + offset, left: rect.left };
    }
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onSkip} />

      {/* Tour Tooltip */}
      <Card
        className="fixed z-50 w-[300px] shadow-lg"
        style={{
          top: `${position.top}px`,
          left: `${position.left}px`,
        }}
      >
        <CardContent className="p-4">
          <div className="flex justify-between items-start mb-3">
            <div className="flex-1">
              <h3 className="font-semibold text-sm mb-1">{steps[currentStep].title}</h3>
              <p className="text-xs text-muted-foreground">{steps[currentStep].content}</p>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6 -mt-1 -mr-1" onClick={onSkip}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex justify-between items-center pt-3 border-t">
            <div className="text-xs text-muted-foreground">
              {currentStep + 1} / {steps.length}
            </div>
            <div className="flex gap-2">
              {currentStep > 0 && (
                <Button variant="outline" size="sm" onClick={handlePrev}>
                  <ArrowLeft className="h-3 w-3 mr-1" />
                  Zurück
                </Button>
              )}
              <Button size="sm" onClick={handleNext}>
                {currentStep < steps.length - 1 ? (
                  <>
                    Weiter
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </>
                ) : (
                  "Fertig"
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CSS for highlighting */}
      <style>{`
        .tour-highlight {
          position: relative;
          z-index: 45;
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.5);
          border-radius: 4px;
        }
      `}</style>
    </>
  );
}
