import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useLocation } from "wouter";
import Step1Basics from "./PortfolioBuilderNew/Step1Basics";
import Step2StockSelection from "./PortfolioBuilderNew/Step2StockSelection";
import Step3BondsETFs from "./PortfolioBuilderNew/Step3BondsETFs";
import Step4Allocation from "./PortfolioBuilderNew/Step4Allocation";
import Step5Completion from "./PortfolioBuilderNew/Step5Completion";

export interface Position {
  ticker: string;
  companyName: string;
  weight: number;
  type: 'stock' | 'bond' | 'etf';
  currentPrice?: number;
  ytdPerformance?: number;
  dividendYield?: number;
  sector?: string;
}

export interface PortfolioBuilderState {
  portfolioName: string;
  description: string;
  strategy: 'growth' | 'dividends' | 'balanced' | '';
  investmentHorizon: 'short' | 'medium' | 'long' | '';
  initialCapital: number;
  portfolioType: 'demo' | 'live' | '';
  positions: Position[];
}

const STEPS = [
  { id: 1, title: "Grundlagen", description: "Name & Strategie" },
  { id: 2, title: "Aktien", description: "Aktien auswählen" },
  { id: 3, title: "Anleihen & ETFs", description: "Optional" },
  { id: 4, title: "Verteilung", description: "Risiko & Allocation" },
  { id: 5, title: "Abschluss", description: "Speichern" },
];

export default function PortfolioBuilderNew() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [currentStep, setCurrentStep] = useState(1);
  const [state, setState] = useState<PortfolioBuilderState>({
    portfolioName: "",
    description: "",
    strategy: "",
    investmentHorizon: "",
    initialCapital: 0,
    portfolioType: "",
    positions: [],
  });

  if (!user) {
    return null;
  }

  const totalWeight = state.positions.reduce((sum, p) => sum + p.weight, 0);
  const isStepValid = () => {
    switch (currentStep) {
      case 1:
        return state.portfolioName.length >= 3 && state.strategy && state.investmentHorizon && state.initialCapital >= 10000 && state.portfolioType !== '';
      case 2:
        return state.positions.filter(p => p.type === 'stock').length >= 3 && Math.abs(totalWeight - 100) < 0.1;
      case 3:
        return true; // Optional step
      case 4:
        return true; // Review step
      case 5:
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (isStepValid() && currentStep < 5) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkipStep3 = () => {
    setCurrentStep(4);
  };

  const updateState = (updates: Partial<PortfolioBuilderState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const addPosition = (position: Position) => {
    setState(prev => ({
      ...prev,
      positions: [...prev.positions, position],
    }));
  };

  const removePosition = (ticker: string) => {
    setState(prev => ({
      ...prev,
      positions: prev.positions.filter(p => p.ticker !== ticker),
    }));
  };

  const updatePosition = (ticker: string, updates: Partial<Position>) => {
    setState(prev => ({
      ...prev,
      positions: prev.positions.map(p =>
        p.ticker === ticker ? { ...p, ...updates } : p
      ),
    }));
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Portfolio Builder</h1>
            <p className="text-gray-400 mt-1">Erstelle dein individuelles Portfolio in 5 Schritten</p>
          </div>
          <Button variant="outline" onClick={() => setLocation("/portfolios")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Abbrechen
          </Button>
        </div>

        {/* Progress Indicator */}
        <Card className="bg-[#0f1420]/50 border-white/10">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              {STEPS.map((step, index) => (
                <div key={step.id} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${
                        currentStep > step.id
                          ? "bg-[#00CFC1] text-white"
                          : currentStep === step.id
                          ? "bg-[#00CFC1] text-white ring-4 ring-[#00CFC1]/20"
                          : "bg-gray-700 text-gray-400"
                      }`}
                    >
                      {currentStep > step.id ? <Check className="h-5 w-5" /> : step.id}
                    </div>
                    <div className="mt-2 text-center">
                      <p className={`text-sm font-medium ${currentStep >= step.id ? "text-white" : "text-gray-500"}`}>
                        {step.title}
                      </p>
                      <p className="text-xs text-gray-500">{step.description}</p>
                    </div>
                  </div>
                  {index < STEPS.length - 1 && (
                    <div
                      className={`h-0.5 flex-1 mx-4 transition-all ${
                        currentStep > step.id ? "bg-[#00CFC1]" : "bg-gray-700"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Step Content */}
        <div className="min-h-[500px]">
          {currentStep === 1 && (
            <Step1Basics state={state} updateState={updateState} />
          )}
          {currentStep === 2 && (
            <Step2StockSelection
              state={state}
              addPosition={addPosition}
              removePosition={removePosition}
              updatePosition={updatePosition}
            />
          )}
          {currentStep === 3 && (
            <Step3BondsETFs
              state={state}
              addPosition={addPosition}
              removePosition={removePosition}
              updatePosition={updatePosition}
              onSkip={handleSkipStep3}
            />
          )}
          {currentStep === 4 && (
            <Step4Allocation state={state} />
          )}
          {currentStep === 5 && (
            <Step5Completion state={state} />
          )}
        </div>

        {/* Navigation Buttons */}
        <Card className="bg-[#0f1420]/50 border-white/10">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={currentStep === 1}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Zurück
              </Button>

              <div className="text-center">
                <p className="text-sm text-gray-400">
                  Schritt {currentStep} von {STEPS.length}
                </p>
                {currentStep === 2 && (
                  <p className={`text-xs mt-1 ${Math.abs(totalWeight - 100) < 0.1 ? "text-green-400" : "text-amber-400"}`}>
                    Gewichtung: {totalWeight.toFixed(1)}% / 100%
                  </p>
                )}
              </div>

              {currentStep < 5 ? (
                <Button
                  onClick={handleNext}
                  disabled={!isStepValid()}
                  className="bg-[#00CFC1] hover:bg-[#00CFC1]/90"
                >
                  Weiter
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    // Will be handled in Step5Completion
                  }}
                  className="bg-[#00CFC1] hover:bg-[#00CFC1]/90"
                  disabled
                >
                  <Check className="mr-2 h-4 w-4" />
                  Portfolio speichern
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
