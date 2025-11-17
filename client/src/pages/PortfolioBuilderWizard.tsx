import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { TrendingUp, ArrowLeft, ArrowRight } from "lucide-react";
import { useLocation } from "wouter";
import BreadcrumbNav from "@/components/BreadcrumbNav";

export default function PortfolioBuilderWizard() {
  const [, setLocation] = useLocation();
  const [currentStep, setCurrentStep] = useState(1);
  const [investmentAmount, setInvestmentAmount] = useState(10000);
  const [optimizationStrategy, setOptimizationStrategy] = useState<'max_sharpe' | 'min_volatility' | 'esg_focused'>('max_sharpe');

  const steps = [
    { id: 1, title: "Anlagebetrag", active: currentStep === 1, completed: currentStep > 1 },
    { id: 2, title: "Optimierungsstrategie", active: currentStep === 2, completed: currentStep > 2 },
    { id: 3, title: "Aktienauswahl", active: currentStep === 3, completed: currentStep > 3 },
    { id: 4, title: "Bestätigung", active: currentStep === 4, completed: false },
  ];

  const handleSliderChange = (value: number[]) => {
    setInvestmentAmount(value[0]);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0;
    if (value >= 10000 && value <= 500000) {
      setInvestmentAmount(value);
    }
  };

  const formatCurrency = (amount: number) => {
    return `CHF ${amount.toLocaleString('de-CH')}`;
  };

  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      setLocation("/portfolio-builder");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[oklch(0.15_0.02_250)] via-[oklch(0.18_0.03_260)] to-[oklch(0.12_0.02_240)] flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-gray-700/50">
        <div className="container max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-cyan-400" />
            <h1 className="text-2xl font-bold text-white">Portfolio Optimizer</h1>
          </div>
        </div>
      </div>

      {/* Breadcrumb Navigation */}
      <div className="container max-w-4xl mx-auto mt-8">
        <BreadcrumbNav steps={steps} currentStep={currentStep} />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl bg-[oklch(0.20_0.03_250)] border-[oklch(0.30_0.04_260)] p-8 md:p-12">
          {currentStep === 1 && (
            <div className="space-y-8">
              <div className="text-center space-y-4">
                <h2 className="text-3xl md:text-4xl font-bold text-white">
                  Wie viel möchten Sie anlegen?
                </h2>
                <p className="text-gray-400 text-lg">
                  Geben Sie den Betrag ein, den Sie investieren möchten
                </p>
              </div>

              {/* Amount Display */}
              <div className="text-center py-6">
                <div className="text-sm text-gray-400 mb-2">Anlagebetrag in CHF</div>
                <div className="text-5xl md:text-6xl font-bold text-cyan-400">
                  {formatCurrency(investmentAmount)}
                </div>
              </div>

              {/* Slider */}
              <div className="space-y-4">
                <Slider
                  value={[investmentAmount]}
                  onValueChange={handleSliderChange}
                  min={10000}
                  max={500000}
                  step={1000}
                  className="w-full"
                />
                <div className="flex justify-between text-sm text-gray-500">
                  <span>CHF 10'000</span>
                  <span>CHF 500'000</span>
                </div>
              </div>

              {/* Manual Input */}
              <div className="space-y-2">
                <label className="text-sm text-gray-400">Oder geben Sie einen Betrag ein:</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg">CHF</span>
                  <Input
                    type="text"
                    value={investmentAmount.toLocaleString('de-CH')}
                    onChange={handleInputChange}
                    className="pl-16 pr-4 py-6 text-xl bg-[oklch(0.15_0.02_250)] border-gray-700 text-white focus:border-cyan-400"
                  />
                </div>
                <p className="text-xs text-gray-500">
                  Mindestbetrag: CHF 10'000 • Für Beträge über CHF 500'000 bitte manuell eingeben
                </p>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-8">
              <div className="text-center space-y-4">
                <h2 className="text-3xl md:text-4xl font-bold text-white">
                  Wählen Sie Ihre Optimierungsstrategie
                </h2>
                <p className="text-gray-400 text-lg">
                  Verschiedene Strategien führen zu unterschiedlichen Portfolio-Zusammensetzungen
                </p>
              </div>

              {/* Strategy Options */}
              <div className="space-y-4">
                {/* Max Sharpe Ratio */}
                <button
                  onClick={() => setOptimizationStrategy('max_sharpe')}
                  className={`w-full p-6 rounded-lg border-2 transition-all text-left ${
                    optimizationStrategy === 'max_sharpe'
                      ? 'border-cyan-400 bg-cyan-400/10'
                      : 'border-gray-700 bg-[oklch(0.15_0.02_250)] hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mt-1 ${
                      optimizationStrategy === 'max_sharpe'
                        ? 'border-cyan-400 bg-cyan-400'
                        : 'border-gray-600'
                    }`}>
                      {optimizationStrategy === 'max_sharpe' && (
                        <div className="w-3 h-3 rounded-full bg-white" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-white mb-2">
                        Maximale Sharpe Ratio
                      </h3>
                      <p className="text-gray-400 text-sm">
                        Beste risikoadjustierte Rendite. Optimiert das Verhältnis von Rendite zu Risiko.
                        Ideal für ausgewogene Anleger, die eine gute Balance zwischen Ertrag und Sicherheit suchen.
                      </p>
                      <div className="mt-3 flex gap-2">
                        <span className="text-xs px-2 py-1 rounded bg-cyan-400/20 text-cyan-400">Empfohlen</span>
                        <span className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-300">Ausgewogen</span>
                      </div>
                    </div>
                  </div>
                </button>

                {/* Min Volatility */}
                <button
                  onClick={() => setOptimizationStrategy('min_volatility')}
                  className={`w-full p-6 rounded-lg border-2 transition-all text-left ${
                    optimizationStrategy === 'min_volatility'
                      ? 'border-cyan-400 bg-cyan-400/10'
                      : 'border-gray-700 bg-[oklch(0.15_0.02_250)] hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mt-1 ${
                      optimizationStrategy === 'min_volatility'
                        ? 'border-cyan-400 bg-cyan-400'
                        : 'border-gray-600'
                    }`}>
                      {optimizationStrategy === 'min_volatility' && (
                        <div className="w-3 h-3 rounded-full bg-white" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-white mb-2">
                        Minimale Volatilität
                      </h3>
                      <p className="text-gray-400 text-sm">
                        Geringste Schwankungen. Minimiert das Risiko durch Fokus auf stabile Aktien.
                        Ideal für konservative Anleger, die Wertschwankungen vermeiden möchten.
                      </p>
                      <div className="mt-3 flex gap-2">
                        <span className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-300">Konservativ</span>
                        <span className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-300">Geringes Risiko</span>
                      </div>
                    </div>
                  </div>
                </button>

                {/* ESG Focused */}
                <button
                  onClick={() => setOptimizationStrategy('esg_focused')}
                  className={`w-full p-6 rounded-lg border-2 transition-all text-left ${
                    optimizationStrategy === 'esg_focused'
                      ? 'border-cyan-400 bg-cyan-400/10'
                      : 'border-gray-700 bg-[oklch(0.15_0.02_250)] hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mt-1 ${
                      optimizationStrategy === 'esg_focused'
                        ? 'border-cyan-400 bg-cyan-400'
                        : 'border-gray-600'
                    }`}>
                      {optimizationStrategy === 'esg_focused' && (
                        <div className="w-3 h-3 rounded-full bg-white" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-white mb-2">
                        ESG-fokussiert
                      </h3>
                      <p className="text-gray-400 text-sm">
                        Nachhaltigkeitsorientiert. Bevorzugt Unternehmen mit hohen ESG-Scores (Environment, Social, Governance).
                        Ideal für Anleger, die Wert auf ethische und nachhaltige Investments legen.
                      </p>
                      <div className="mt-3 flex gap-2">
                        <span className="text-xs px-2 py-1 rounded bg-green-400/20 text-green-400">Nachhaltig</span>
                        <span className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-300">ESG</span>
                      </div>
                    </div>
                  </div>
                </button>
              </div>

              {/* Info Box */}
              <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
                <p className="text-sm text-blue-300">
                  <strong>Hinweis:</strong> Die gewählte Strategie beeinflusst die Gewichtung der Aktien in Ihrem Portfolio.
                  Sie können die Strategie später jederzeit ändern und neu optimieren.
                </p>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="text-center space-y-4">
              <h2 className="text-3xl font-bold text-white">Aktienauswahl</h2>
              <p className="text-gray-400">Schritt 3 - In Entwicklung</p>
            </div>
          )}

          {currentStep === 4 && (
            <div className="text-center space-y-4">
              <h2 className="text-3xl font-bold text-white">Bestätigung</h2>
              <p className="text-gray-400">Schritt 4 - In Entwicklung</p>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex gap-4 mt-12">
            <Button
              variant="outline"
              className="flex-1 py-6 text-lg border-gray-600 hover:bg-gray-700 text-white"
              onClick={handleBack}
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Zurück
            </Button>
            <Button
              className="flex-1 py-6 text-lg bg-cyan-500 hover:bg-cyan-600 text-white font-semibold"
              onClick={handleNext}
            >
              Weiter
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
