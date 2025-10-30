import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { trpc } from "@/lib/trpc";
import { ArrowRight, ArrowLeft, TrendingUp, HelpCircle } from "lucide-react";
import InvestorTypeTest from "@/components/InvestorTypeTest";

interface OptimizerInputs {
  investmentAmount: number;
  expectedDividendYield: number;
  numberOfPositions: number;
  investorType: "conservative" | "balanced" | "dynamic";
}

interface OptimizerProps {
  onShowResults: (inputs: OptimizerInputs) => void;
}

export default function Optimizer({ onShowResults }: OptimizerProps) {
  const [step, setStep] = useState(1);
  const [inputs, setInputs] = useState<OptimizerInputs>({
    investmentAmount: 10000,
    expectedDividendYield: 2.0,
    numberOfPositions: 20,
    investorType: "balanced",
  });
  const [showInvestorTest, setShowInvestorTest] = useState(false);
  const [testResult, setTestResult] = useState<"conservative" | "balanced" | "dynamic" | null>(null);
  const [showTestConfirmation, setShowTestConfirmation] = useState(false);
  const [investmentAmountDisplay, setInvestmentAmountDisplay] = useState("10'000");

  const formatNumber = (num: number): string => {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  };

  const parseFormattedNumber = (str: string): number => {
    return Number(str.replace(/'/g, ""));
  };

  const { data: stocks = [] } = trpc.stocks.list.useQuery();
  const maxPositions = stocks.length || 63;

  const handleNext = () => {
    if (step < 4) {
      setStep(step + 1);
    } else {
      onShowResults(inputs);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-white mb-2">
                Wie viel möchten Sie anlegen?
              </h2>
              <p className="text-slate-400">
                Geben Sie den Betrag ein, den Sie investieren möchten
              </p>
            </div>
            <div className="max-w-md mx-auto">
              <Label htmlFor="amount" className="text-white text-lg mb-4 block">
                Anlagebetrag in CHF
              </Label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-5xl md:text-6xl text-slate-400 font-bold">
                  CHF
                </span>
                <Input
                  id="amount"
                  type="text"
                  value={investmentAmountDisplay}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^0-9']/g, "");
                    setInvestmentAmountDisplay(value);
                    const numValue = parseFormattedNumber(value);
                    if (!isNaN(numValue)) {
                      setInputs({ ...inputs, investmentAmount: numValue });
                    }
                  }}
                  onBlur={() => {
                    setInvestmentAmountDisplay(formatNumber(inputs.investmentAmount));
                  }}
                  onFocus={(e) => e.target.select()}
                  className="pl-28 pr-4 text-8xl md:text-9xl h-40 md:h-48 bg-slate-800 border-slate-700 text-white text-center font-bold"
                />
              </div>
              <p className="text-slate-500 text-sm mt-4 text-center">
                Mindestbetrag: CHF 1'000
              </p>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-white mb-2">
                Welche Dividendenrendite erwarten Sie?
              </h2>
              <p className="text-slate-400">
                Minimale Dividendenrendite pro Aktie
              </p>
            </div>
            <div className="max-w-md mx-auto">
              <Label htmlFor="dividend" className="text-white text-lg mb-4 block">
                Erwartete Dividendenrendite
              </Label>
              <div className="relative">
                <Input
                  id="dividend"
                  type="number"
                  min="0"
                  max="10"
                  step="0.5"
                  value={inputs.expectedDividendYield}
                  onChange={(e) =>
                    setInputs({ ...inputs, expectedDividendYield: Number(e.target.value) })
                  }
                  onFocus={(e) => e.target.select()}
                  className="pr-16 text-3xl h-20 bg-slate-800 border-slate-700 text-white text-center"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-2xl text-slate-400">
                  %
                </span>
              </div>
              <p className="text-slate-500 text-sm mt-4 text-center">
                Durchschnittliche Dividendenrendite im Portfolio BIG: ~2.5%<br />
                <span className="text-slate-600 text-xs">Hinweis: Bitte Punkt verwenden (z.B. 2.5)</span>
              </p>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-white mb-2">
                Wie viele Aktienpositionen möchten Sie?
              </h2>
              <p className="text-slate-400">
                Anzahl verschiedener Aktien in Ihrem Portfolio
              </p>
            </div>
            <div className="max-w-md mx-auto">
              <Label htmlFor="positions" className="text-white text-lg mb-4 block">
                Anzahl Positionen
              </Label>
              <div className="text-center mb-6">
                <span className="text-6xl font-bold text-cyan-400">
                  {inputs.numberOfPositions}
                </span>
              </div>
              <Slider
                id="positions"
                min={1}
                max={maxPositions}
                step={1}
                value={[inputs.numberOfPositions]}
                onValueChange={(value) =>
                  setInputs({ ...inputs, numberOfPositions: value[0] })
                }
                className="w-full"
              />
              <div className="flex justify-between text-slate-500 text-sm mt-2">
                <span>1</span>
                <span>{maxPositions} (max.)</span>
              </div>
              <p className="text-slate-500 text-sm mt-6 text-center">
                Empfehlung: 15-30 Positionen für gute Diversifikation
              </p>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-white mb-2">
                Welcher Anlegertyp sind Sie?
              </h2>
              <p className="text-slate-400">
                Wählen Sie Ihre Risikobereitschaft
              </p>
              <Button
                onClick={() => setShowInvestorTest(true)}
                variant="outline"
                className="mt-4 bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
              >
                <HelpCircle className="w-4 h-4 mr-2" />
                Anlegertyp-Test machen
              </Button>
            </div>
            <div className="max-w-2xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => setInputs({ ...inputs, investorType: "conservative" })}
                className={`p-6 rounded-lg border-2 transition-all ${
                  inputs.investorType === "conservative"
                    ? "border-green-500 bg-green-500/10"
                    : "border-slate-700 bg-slate-800 hover:border-slate-600"
                }`}
              >
                <div className="text-center">
                  <div className="text-4xl mb-4">🛡️</div>
                  <h3 className="text-xl font-bold text-white mb-2">Konservativ</h3>
                  <p className="text-slate-400 text-sm">
                    Fokus auf Stabilität und Dividenden. Niedrige Volatilität.
                  </p>
                  <ul className="mt-4 text-left text-sm text-slate-500 space-y-1">
                    <li>• Etablierte Unternehmen</li>
                    <li>• Hohe Dividenden</li>
                    <li>• Defensive Sektoren</li>
                  </ul>
                </div>
              </button>

              <button
                onClick={() => setInputs({ ...inputs, investorType: "balanced" })}
                className={`p-6 rounded-lg border-2 transition-all ${
                  inputs.investorType === "balanced"
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-slate-700 bg-slate-800 hover:border-slate-600"
                }`}
              >
                <div className="text-center">
                  <div className="text-4xl mb-4">⚖️</div>
                  <h3 className="text-xl font-bold text-white mb-2">Ausgewogen</h3>
                  <p className="text-slate-400 text-sm">
                    Balance zwischen Wachstum und Stabilität.
                  </p>
                  <ul className="mt-4 text-left text-sm text-slate-500 space-y-1">
                    <li>• Mix aus allen Sektoren</li>
                    <li>• Moderate Volatilität</li>
                    <li>• Solide Dividenden</li>
                  </ul>
                </div>
              </button>

              <button
                onClick={() => setInputs({ ...inputs, investorType: "dynamic" })}
                className={`p-6 rounded-lg border-2 transition-all ${
                  inputs.investorType === "dynamic"
                    ? "border-purple-500 bg-purple-500/10"
                    : "border-slate-700 bg-slate-800 hover:border-slate-600"
                }`}
              >
                <div className="text-center">
                  <div className="text-4xl mb-4">🚀</div>
                  <h3 className="text-xl font-bold text-white mb-2">Dynamisch</h3>
                  <p className="text-slate-400 text-sm">
                    Fokus auf Wachstum. Höhere Volatilität akzeptabel.
                  </p>
                  <ul className="mt-4 text-left text-sm text-slate-500 space-y-1">
                    <li>• Tech & Growth-Aktien</li>
                    <li>• Hohe Performance</li>
                    <li>• Innovation</li>
                  </ul>
                </div>
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
    <Card className="bg-slate-800 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <TrendingUp className="w-6 h-6" />
          Portfolio Optimizer
        </CardTitle>
      </CardHeader>
      <CardContent className="min-h-[500px] flex flex-col">
        {/* Progress indicator */}
        <div className="flex justify-center mb-8">
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`w-12 h-2 rounded-full transition-colors ${
                  s === step
                    ? "bg-cyan-500"
                    : s < step
                    ? "bg-cyan-700"
                    : "bg-slate-700"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Step content */}
        <div className="flex-1">{renderStep()}</div>

        {/* Navigation buttons */}
        <div className="flex justify-between mt-8">
          <Button
            onClick={handleBack}
            disabled={step === 1}
            variant="outline"
            className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Zurück
          </Button>
          <Button
            onClick={handleNext}
            className="bg-cyan-600 hover:bg-cyan-700 text-white"
          >
            {step === 4 ? "Portfolio erstellen" : "Weiter"}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>

    {/* Investor Type Test Dialog */}
    <InvestorTypeTest
      isOpen={showInvestorTest}
      onClose={() => setShowInvestorTest(false)}
      onResult={(type) => {
        setTestResult(type);
        setShowInvestorTest(false);
        setShowTestConfirmation(true);
      }}
    />

    {/* Test Result Confirmation Dialog */}
    {showTestConfirmation && testResult && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <Card className="bg-slate-900 border-slate-800 max-w-md mx-4">
          <CardHeader>
            <CardTitle className="text-white text-center">Test-Ergebnis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center">
              <p className="text-slate-300 mb-4">
                Basierend auf Ihren Antworten empfehlen wir:
              </p>
              <div className="bg-slate-800 p-4 rounded-lg">
                <p className="text-2xl font-bold text-white">
                  {testResult === "conservative" && "Konservativ"}
                  {testResult === "balanced" && "Ausgewogen"}
                  {testResult === "dynamic" && "Dynamisch"}
                </p>
              </div>
            </div>
            <p className="text-slate-400 text-sm text-center">
              M\u00f6chten Sie diese Empfehlung \u00fcbernehmen oder manuell w\u00e4hlen?
            </p>
            <div className="flex gap-3">
              <Button
                onClick={() => {
                  setShowTestConfirmation(false);
                  setTestResult(null);
                }}
                variant="outline"
                className="flex-1 bg-slate-800 border-slate-700 text-white hover:bg-slate-700"
              >
                Manuell w\u00e4hlen
              </Button>
              <Button
                onClick={() => {
                  if (testResult) {
                    setInputs({ ...inputs, investorType: testResult });
                  }
                  setShowTestConfirmation(false);
                  setTestResult(null);
                }}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                Empfehlung \u00fcbernehmen
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )}
    </>
  );
}

