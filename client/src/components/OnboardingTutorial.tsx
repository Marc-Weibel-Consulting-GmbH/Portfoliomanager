import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronLeft, TrendingUp, BarChart3, DollarSign, PieChart, Check } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface OnboardingTutorialProps {
  open: boolean;
  onClose: () => void;
}

const steps = [
  {
    title: "Willkommen bei Portfolio Analyse! 👋",
    description: "Ihre intelligente Plattform für professionelles Portfolio-Management",
    icon: TrendingUp,
    content: (
      <div className="space-y-4">
        <p className="text-muted-foreground">
          Optimieren Sie Ihre Investments mit Echtzeit-Daten, KI-gestützten Analysen und professionellen Tools.
        </p>
        <div className="bg-primary/10 p-4 rounded-lg">
          <p className="text-sm font-medium">🎯 Was Sie erwartet:</p>
          <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
            <li>• Portfolio-Optimierung nach Markowitz-Theorie</li>
            <li>• Live-Tracking mit Echtzeit-Kursen</li>
            <li>• Automatische Dividenden-Erfassung</li>
            <li>• KI-gestützte Analysen und Empfehlungen</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    title: "Portfolio-Optimizer 📊",
    description: "Wissenschaftlich fundierte Optimierung nach Markowitz-Theorie",
    icon: PieChart,
    content: (
      <div className="space-y-4">
        <p className="text-muted-foreground">
          Fügen Sie Ihre gewünschten Aktien hinzu und lassen Sie den Algorithmus die optimale Gewichtung berechnen.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card border rounded-lg p-3">
            <div className="text-2xl mb-1">🎯</div>
            <p className="text-sm font-medium">Max. Sharpe Ratio</p>
            <p className="text-xs text-muted-foreground">Bestes Rendite-Risiko-Verhältnis</p>
          </div>
          <div className="bg-card border rounded-lg p-3">
            <div className="text-2xl mb-1">🛡️</div>
            <p className="text-sm font-medium">Min. Volatilität</p>
            <p className="text-xs text-muted-foreground">Minimales Risiko</p>
          </div>
          <div className="bg-card border rounded-lg p-3">
            <div className="text-2xl mb-1">💰</div>
            <p className="text-sm font-medium">Max. Dividende</p>
            <p className="text-xs text-muted-foreground">Höchste Ausschüttungen</p>
          </div>
          <div className="bg-card border rounded-lg p-3">
            <div className="text-2xl mb-1">⚖️</div>
            <p className="text-sm font-medium">Gleichgewichtet</p>
            <p className="text-xs text-muted-foreground">Alle Positionen gleich</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    title: "Live-Tracking aktivieren 🚀",
    description: "Verfolgen Sie Ihre realen Investments in Echtzeit",
    icon: BarChart3,
    content: (
      <div className="space-y-4">
        <p className="text-muted-foreground">
          Sobald Sie ein optimiertes Portfolio haben, können Sie es "live" schalten und Ihre echten Transaktionen erfassen.
        </p>
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
          <p className="text-sm font-medium text-green-700 dark:text-green-400 mb-2">✨ Live-Modus Features:</p>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span>Automatische Performance-Berechnung</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span>Dividenden-Tracking mit Kalender</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span>Realisierte Gewinne/Verluste</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span>Steuer-Reporting (Jahresübersicht)</span>
            </li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    title: "Transaktionen erfassen 💸",
    description: "Dokumentieren Sie Käufe, Verkäufe und Kapitalflüsse",
    icon: DollarSign,
    content: (
      <div className="space-y-4">
        <p className="text-muted-foreground">
          Erfassen Sie alle Ihre Transaktionen, um eine präzise Performance-Analyse zu erhalten.
        </p>
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 bg-card border rounded-lg">
            <div className="bg-green-500/10 p-2 rounded">
              <span className="text-green-600 font-bold">+</span>
            </div>
            <div>
              <p className="text-sm font-medium">Käufe</p>
              <p className="text-xs text-muted-foreground">Aktien kaufen mit Preis und Gebühren</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-card border rounded-lg">
            <div className="bg-red-500/10 p-2 rounded">
              <span className="text-red-600 font-bold">−</span>
            </div>
            <div>
              <p className="text-sm font-medium">Verkäufe</p>
              <p className="text-xs text-muted-foreground">Realisierte Gewinne werden automatisch berechnet</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-card border rounded-lg">
            <div className="bg-blue-500/10 p-2 rounded">
              <span className="text-blue-600 font-bold">💰</span>
            </div>
            <div>
              <p className="text-sm font-medium">Einzahlungen / Auszahlungen</p>
              <p className="text-xs text-muted-foreground">Kapitalflüsse dokumentieren</p>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    title: "Bereit loszulegen! 🎉",
    description: "Starten Sie mit unserem Demo-Portfolio",
    icon: Check,
    content: (
      <div className="space-y-4">
        <p className="text-muted-foreground">
          Wir haben ein Demo-Portfolio mit Schweizer Blue Chips für Sie vorbereitet. Erkunden Sie alle Features risikofrei!
        </p>
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
          <p className="text-sm font-medium mb-2">📦 Demo-Portfolio enthält:</p>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>• Nestlé (20%)</li>
            <li>• Novartis (20%)</li>
            <li>• Roche (15%)</li>
            <li>• UBS Group (15%)</li>
            <li>• Zurich Insurance (15%)</li>
            <li>• ABB (15%)</li>
          </ul>
        </div>
        <p className="text-sm text-muted-foreground">
          💡 <strong>Tipp:</strong> Sie können das Demo-Portfolio jederzeit löschen und Ihr eigenes erstellen!
        </p>
      </div>
    ),
  },
];

export default function OnboardingTutorial({ open, onClose }: OnboardingTutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const markOnboardingSeen = trpc.onboarding.markOnboardingSeen.useMutation();
  const createDemoPortfolio = trpc.onboarding.createDemoPortfolio.useMutation();
  const utils = trpc.useUtils();

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleFinish = async () => {
    try {
      // Mark onboarding as seen
      await markOnboardingSeen.mutateAsync();
      
      // Create demo portfolio
      await createDemoPortfolio.mutateAsync();
      
      // Invalidate queries to refresh data
      await utils.portfolios.list.invalidate();
      
      onClose();
    } catch (error) {
      console.error("Error finishing onboarding:", error);
      // Still close the modal even if demo creation fails
      onClose();
    }
  };

  const handleSkip = async () => {
    try {
      await markOnboardingSeen.mutateAsync();
      onClose();
    } catch (error) {
      console.error("Error skipping onboarding:", error);
      onClose();
    }
  };

  const step = steps[currentStep];
  const Icon = step.icon;
  const isLastStep = currentStep === steps.length - 1;

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleSkip()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-primary/10 p-2 rounded-lg">
              <Icon className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-xl">{step.title}</DialogTitle>
              <DialogDescription>{step.description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-4">
          {step.content}
        </div>

        {/* Progress indicator */}
        <div className="flex gap-1.5 justify-center mb-4">
          {steps.map((_, index) => (
            <div
              key={index}
              className={`h-1.5 rounded-full transition-all ${
                index === currentStep
                  ? "w-8 bg-primary"
                  : index < currentStep
                  ? "w-1.5 bg-primary/50"
                  : "w-1.5 bg-muted"
              }`}
            />
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            onClick={handleSkip}
            disabled={markOnboardingSeen.isPending || createDemoPortfolio.isPending}
          >
            Überspringen
          </Button>

          <div className="flex gap-2">
            {currentStep > 0 && (
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={markOnboardingSeen.isPending || createDemoPortfolio.isPending}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Zurück
              </Button>
            )}

            {isLastStep ? (
              <Button
                onClick={handleFinish}
                disabled={markOnboardingSeen.isPending || createDemoPortfolio.isPending}
              >
                {createDemoPortfolio.isPending ? "Erstelle Demo..." : "Demo-Portfolio erstellen"}
                <Check className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button onClick={handleNext}>
                Weiter
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
