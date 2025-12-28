import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Coins, TrendingUp, Scale, Clock, Rocket, BarChart3 } from "lucide-react";
import { toast } from "sonner";

type InvestmentGoal = "dividends" | "growth" | "balanced";
type RiskTolerance = "low" | "medium" | "high";
type InvestmentHorizon = "short" | "medium" | "long";

export default function OnboardingWizard() {
  const [, setLocation] = useLocation();
  const [currentStep, setCurrentStep] = useState(1);
  const [investmentGoal, setInvestmentGoal] = useState<InvestmentGoal | null>(null);
  const [riskTolerance, setRiskTolerance] = useState<RiskTolerance | null>(null);
  const [investmentHorizon, setInvestmentHorizon] = useState<InvestmentHorizon | null>(null);

  const completeOnboardingMutation = trpc.onboarding.completeOnboarding.useMutation();
  const savePreferencesMutation = trpc.onboarding.savePreferences.useMutation();

  const totalSteps = 4;

  const handleNext = async () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = async () => {
    try {
      // Set default values for skipped onboarding
      await savePreferencesMutation.mutateAsync({
        investmentGoal: "balanced",
        riskTolerance: "medium",
        investmentHorizon: "medium",
      });
      // Mark onboarding as completed
      await completeOnboardingMutation.mutateAsync();
      setLocation("/dashboard");
    } catch (error) {
      console.error("Error skipping onboarding:", error);
      toast.error("Fehler beim Überspringen");
    }
  };

  const handleComplete = async () => {
    try {
      if (!investmentGoal || !riskTolerance || !investmentHorizon) {
        toast.error("Bitte wähle alle Optionen aus");
        return;
      }

      // Save preferences first
      await savePreferencesMutation.mutateAsync({
        investmentGoal,
        riskTolerance,
        investmentHorizon,
      });

      // Then mark onboarding as completed
      await completeOnboardingMutation.mutateAsync();

      toast.success("Willkommen! Dein Profil wurde erstellt.");
      setLocation("/dashboard");
    } catch (error: any) {
      toast.error(error.message || "Fehler beim Abschließen des Onboardings");
    }
  };



  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl">
        {/* Progress Indicator */}
        <div className="flex items-center justify-center mb-8">
          {[1, 2, 3, 4].map((step) => (
            <div key={step} className="flex items-center">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center font-semibold transition-colors ${
                  step === currentStep
                    ? "bg-teal-500 text-white"
                    : step < currentStep
                    ? "bg-teal-600 text-white"
                    : "bg-slate-700 text-slate-400"
                }`}
              >
                {step}
              </div>
              {step < 4 && (
                <div
                  className={`w-16 h-1 mx-2 ${
                    step < currentStep ? "bg-teal-600" : "bg-slate-700"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-2xl text-white">
              {currentStep === 1 && "Willkommen bei Portfolio Analyzer!"}
              {currentStep === 2 && "Was ist dein Anlageziel?"}
              {currentStep === 3 && "Wie hoch ist deine Risikotoleranz?"}
              {currentStep === 4 && "Wie lange möchtest du investieren?"}
            </CardTitle>
            <CardDescription className="text-slate-400">
              {currentStep === 1 && "Lass uns dein erstes Portfolio erstellen"}
              {currentStep === 2 && "Wähle dein primäres Investmentziel"}
              {currentStep === 3 && "Bestimme dein Risikoniveau"}
              {currentStep === 4 && "Definiere deinen Anlagehorizont"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Step 1: Welcome */}
            {currentStep === 1 && (
              <div className="space-y-6 py-4">
                <p className="text-slate-300 text-lg">
                  Portfolio Analyzer hilft dir, deine Investitionen zu verwalten und zu optimieren.
                </p>
                <div className="grid gap-4">
                  <div className="flex items-start gap-3">
                    <BarChart3 className="w-6 h-6 text-teal-500 mt-1" />
                    <div>
                      <h3 className="font-semibold text-white">Portfolio-Optimierung</h3>
                      <p className="text-sm text-slate-400">
                        Erstelle optimierte Portfolios basierend auf historischen Daten
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <TrendingUp className="w-6 h-6 text-teal-500 mt-1" />
                    <div>
                      <h3 className="font-semibold text-white">Live-Tracking</h3>
                      <p className="text-sm text-slate-400">
                        Verfolge die Performance deiner Investments in Echtzeit
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Coins className="w-6 h-6 text-teal-500 mt-1" />
                    <div>
                      <h3 className="font-semibold text-white">Dividenden-Tracking</h3>
                      <p className="text-sm text-slate-400">
                        Automatische Erfassung von Dividendenzahlungen
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Investment Goal */}
            {currentStep === 2 && (
              <div className="grid gap-4">
                <button
                  onClick={() => setInvestmentGoal("dividends")}
                  className={`p-6 rounded-lg border-2 transition-all text-left ${
                    investmentGoal === "dividends"
                      ? "border-teal-500 bg-teal-500/10"
                      : "border-slate-700 bg-slate-700/30 hover:border-slate-600"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <Coins className="w-8 h-8 text-teal-500" />
                    <div>
                      <h3 className="font-semibold text-white text-lg mb-2">
                        Passives Einkommen durch Dividenden
                      </h3>
                      <p className="text-sm text-slate-400">
                        Fokus auf Unternehmen mit stabilen Dividendenzahlungen
                      </p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setInvestmentGoal("growth")}
                  className={`p-6 rounded-lg border-2 transition-all text-left ${
                    investmentGoal === "growth"
                      ? "border-teal-500 bg-teal-500/10"
                      : "border-slate-700 bg-slate-700/30 hover:border-slate-600"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <TrendingUp className="w-8 h-8 text-teal-500" />
                    <div>
                      <h3 className="font-semibold text-white text-lg mb-2">
                        Langfristiges Wachstum
                      </h3>
                      <p className="text-sm text-slate-400">
                        Investition in wachstumsstarke Unternehmen
                      </p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setInvestmentGoal("balanced")}
                  className={`p-6 rounded-lg border-2 transition-all text-left ${
                    investmentGoal === "balanced"
                      ? "border-teal-500 bg-teal-500/10"
                      : "border-slate-700 bg-slate-700/30 hover:border-slate-600"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <Scale className="w-8 h-8 text-teal-500" />
                    <div>
                      <h3 className="font-semibold text-white text-lg mb-2">
                        Ausgewogene Strategie
                      </h3>
                      <p className="text-sm text-slate-400">
                        Balance zwischen Wachstum und Dividenden
                      </p>
                    </div>
                  </div>
                </button>
              </div>
            )}

            {/* Step 3: Risk Tolerance */}
            {currentStep === 3 && (
              <div className="grid gap-4">
                <button
                  onClick={() => setRiskTolerance("low")}
                  className={`p-6 rounded-lg border-2 transition-all text-left ${
                    riskTolerance === "low"
                      ? "border-teal-500 bg-teal-500/10"
                      : "border-slate-700 bg-slate-700/30 hover:border-slate-600"
                  }`}
                >
                  <h3 className="font-semibold text-white text-lg mb-2">Konservativ</h3>
                  <p className="text-sm text-slate-400">
                    Geringe Schwankungen, stabile Renditen
                  </p>
                </button>

                <button
                  onClick={() => setRiskTolerance("medium")}
                  className={`p-6 rounded-lg border-2 transition-all text-left ${
                    riskTolerance === "medium"
                      ? "border-teal-500 bg-teal-500/10"
                      : "border-slate-700 bg-slate-700/30 hover:border-slate-600"
                  }`}
                >
                  <h3 className="font-semibold text-white text-lg mb-2">Moderat</h3>
                  <p className="text-sm text-slate-400">
                    Ausgewogenes Verhältnis zwischen Risiko und Rendite
                  </p>
                </button>

                <button
                  onClick={() => setRiskTolerance("high")}
                  className={`p-6 rounded-lg border-2 transition-all text-left ${
                    riskTolerance === "high"
                      ? "border-teal-500 bg-teal-500/10"
                      : "border-slate-700 bg-slate-700/30 hover:border-slate-600"
                  }`}
                >
                  <h3 className="font-semibold text-white text-lg mb-2">Aggressiv</h3>
                  <p className="text-sm text-slate-400">
                    Höhere Schwankungen für potenziell höhere Renditen
                  </p>
                </button>
              </div>
            )}

            {/* Step 4: Investment Horizon */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <div className="grid gap-4">
                  <button
                    onClick={() => setInvestmentHorizon("short")}
                    className={`p-6 rounded-lg border-2 transition-all text-left ${
                      investmentHorizon === "short"
                        ? "border-teal-500 bg-teal-500/10"
                        : "border-slate-700 bg-slate-700/30 hover:border-slate-600"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <Clock className="w-8 h-8 text-teal-500" />
                      <div>
                        <h3 className="font-semibold text-white text-lg mb-2">
                          Kurzfristig (&lt; 3 Jahre)
                        </h3>
                        <p className="text-sm text-slate-400">
                          Für kurzfristige Sparziele
                        </p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setInvestmentHorizon("medium")}
                    className={`p-6 rounded-lg border-2 transition-all text-left ${
                      investmentHorizon === "medium"
                        ? "border-teal-500 bg-teal-500/10"
                        : "border-slate-700 bg-slate-700/30 hover:border-slate-600"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <Clock className="w-8 h-8 text-teal-500" />
                      <div>
                        <h3 className="font-semibold text-white text-lg mb-2">
                          Mittelfristig (3-10 Jahre)
                        </h3>
                        <p className="text-sm text-slate-400">
                          Für mittelfristige Vermögensbildung
                        </p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setInvestmentHorizon("long")}
                    className={`p-6 rounded-lg border-2 transition-all text-left ${
                      investmentHorizon === "long"
                        ? "border-teal-500 bg-teal-500/10"
                        : "border-slate-700 bg-slate-700/30 hover:border-slate-600"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <Clock className="w-8 h-8 text-teal-500" />
                      <div>
                        <h3 className="font-semibold text-white text-lg mb-2">
                          Langfristig (&gt; 10 Jahre)
                        </h3>
                        <p className="text-sm text-slate-400">
                          Für Altersvorsorge und langfristigen Vermögensaufbau
                        </p>
                      </div>
                    </div>
                  </button>
                </div>

                {/* Premium Teaser */}
                <div className="pt-6 border-t border-slate-700">
                  <div className="bg-gradient-to-br from-teal-600/20 to-blue-600/20 border-2 border-teal-500/50 rounded-lg p-6 mb-6">
                    <div className="flex items-start gap-4">
                      <Rocket className="w-10 h-10 text-teal-400" />
                      <div>
                        <h3 className="font-bold text-white text-lg mb-2">
                          Upgrade zu Premium
                        </h3>
                        <p className="text-sm text-slate-300 mb-3">
                          Unbegrenzte Portfolios, Live-Tracking mit IRR/MWR, Preisalarme (Email & WhatsApp), Dividendenkalender und mehr.
                        </p>
                        <p className="text-teal-400 font-semibold">
                          Nur CHF 10.00 monatlich
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <Button
                    onClick={handleComplete}
                    className="w-full h-auto p-4 bg-teal-600 hover:bg-teal-700"
                    disabled={completeOnboardingMutation.isPending || savePreferencesMutation.isPending || !investmentGoal || !riskTolerance || !investmentHorizon}
                  >
                    <div className="text-center">
                      <div className="font-semibold mb-1 flex items-center justify-center gap-2">
                        <Rocket className="w-5 h-5" />
                        Jetzt starten (Free)
                      </div>
                      <div className="text-sm opacity-90">
                        Du kannst jederzeit upgraden
                      </div>
                    </div>
                  </Button>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between pt-6 border-t border-slate-700">
              <div>
                {currentStep > 1 && (
                  <Button onClick={handleBack} variant="outline" className="border-slate-600">
                    Zurück
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSkip} variant="ghost" className="text-slate-400">
                  Überspringen
                </Button>
                {currentStep < totalSteps && (
                  <Button onClick={handleNext} className="bg-teal-600 hover:bg-teal-700">
                    Weiter
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
