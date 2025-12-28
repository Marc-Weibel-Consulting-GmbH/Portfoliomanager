import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Sparkles, TrendingUp, Shield, BarChart3 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type InvestorType = "conservative" | "balanced" | "dynamic";

interface WizardStep1Data {
  investmentAmount: number;
  investorType: InvestorType;
}

/**
 * Premium Wizard - Intelligenter Portfolio-Assistent
 * Erstellt automatisch ein diversifiziertes Portfolio basierend auf Investitionssumme und Risikoprofil
 */
export default function PremiumWizard() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  // Step 1: Investment amount and investor type
  const [investmentAmount, setInvestmentAmount] = useState<number>(10000);
  const [investorType, setInvestorType] = useState<InvestorType>("balanced");
  
  // Generate portfolio mutation
  const generatePortfolio = trpc.portfolioOptimizer.generateSmartPortfolio.useMutation({
    onSuccess: (data) => {
      toast.success("Portfolio erfolgreich erstellt!");
      // Redirect to optimizer results with the generated portfolio
      setLocation(`/optimizer-results?portfolioId=${data.portfolioId}`);
    },
    onError: (error) => {
      toast.error(`Fehler beim Erstellen des Portfolios: ${error.message}`);
      setLoading(false);
    },
  });

  const handleStep1Continue = () => {
    if (!investmentAmount || investmentAmount <= 0) {
      toast.error("Bitte geben Sie einen gültigen Investitionsbetrag ein");
      return;
    }
    setStep(2);
  };

  const handleGeneratePortfolio = async () => {
    setLoading(true);
    
    try {
      await generatePortfolio.mutateAsync({
        investmentAmount,
        investorType,
      });
    } catch (error) {
      console.error("Error generating portfolio:", error);
      setLoading(false);
    }
  };

  const investorTypeOptions = [
    {
      value: "conservative" as const,
      label: "Konservativ",
      description: "Fokus auf Stabilität und Dividenden",
      icon: Shield,
      color: "text-blue-600",
      features: [
        "Hohe Dividendenrendite (>3%)",
        "Etablierte Blue-Chip Unternehmen",
        "Geringe Volatilität",
        "Defensive Sektoren (Utilities, Consumer Staples)",
      ],
    },
    {
      value: "balanced" as const,
      label: "Ausgewogen",
      description: "Balance zwischen Wachstum und Stabilität",
      icon: BarChart3,
      color: "text-purple-600",
      features: [
        "Moderate Dividendenrendite (2-3%)",
        "Mix aus Growth und Value",
        "Diversifizierte Sektoren",
        "Ausgewogenes Risiko-Rendite-Verhältnis",
      ],
    },
    {
      value: "dynamic" as const,
      label: "Dynamisch",
      description: "Fokus auf Wachstum und Kapitalgewinne",
      icon: TrendingUp,
      color: "text-green-600",
      features: [
        "Wachstumsstarke Unternehmen",
        "Technologie und Innovation",
        "Höheres Renditepotenzial",
        "Höhere Volatilität akzeptiert",
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 mb-4">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-medium text-cyan-400">Premium Feature</span>
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">
            Intelligenter Portfolio-Assistent
          </h1>
          <p className="text-slate-400 text-lg">
            Erstellen Sie in wenigen Schritten ein optimal diversifiziertes Portfolio
          </p>
        </div>

        {/* Progress Indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold ${
            step >= 1 ? "bg-cyan-500 text-white" : "bg-slate-800 text-slate-500"
          }`}>
            1
          </div>
          <div className={`w-24 h-1 ${step >= 2 ? "bg-cyan-500" : "bg-slate-800"}`} />
          <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold ${
            step >= 2 ? "bg-cyan-500 text-white" : "bg-slate-800 text-slate-500"
          }`}>
            2
          </div>
        </div>

        {/* Step 1: Investment Amount */}
        {step === 1 && (
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white">Schritt 1: Investitionssumme</CardTitle>
              <CardDescription>
                Wie viel möchten Sie investieren?
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="amount" className="text-white">Betrag (CHF)</Label>
                <Input
                  id="amount"
                  type="number"
                  min="1000"
                  step="1000"
                  value={investmentAmount}
                  onChange={(e) => setInvestmentAmount(Number(e.target.value))}
                  className="text-2xl font-bold h-16 bg-slate-800 border-slate-700 text-white"
                  placeholder="10000"
                />
                <p className="text-sm text-slate-400">
                  Mindestbetrag: CHF 1'000
                </p>
              </div>

              {/* Quick Amount Buttons */}
              <div className="grid grid-cols-4 gap-2">
                {[5000, 10000, 25000, 50000].map((amount) => (
                  <Button
                    key={amount}
                    variant="outline"
                    onClick={() => setInvestmentAmount(amount)}
                    className={`${
                      investmentAmount === amount
                        ? "bg-cyan-500/20 border-cyan-500 text-cyan-400"
                        : "bg-slate-800 border-slate-700 text-slate-300"
                    }`}
                  >
                    {(amount / 1000).toFixed(0)}k
                  </Button>
                ))}
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setLocation("/dashboard")}
                  className="bg-slate-800 border-slate-700 text-white hover:bg-slate-700"
                >
                  Abbrechen
                </Button>
                <Button
                  onClick={handleStep1Continue}
                  className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white"
                >
                  Weiter
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Investor Type */}
        {step === 2 && (
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white">Schritt 2: Anlegerprofil</CardTitle>
              <CardDescription>
                Wählen Sie Ihre Anlagestrategie
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <RadioGroup
                value={investorType}
                onValueChange={(value) => setInvestorType(value as InvestorType)}
                className="space-y-4"
              >
                {investorTypeOptions.map((option) => {
                  const Icon = option.icon;
                  return (
                    <div
                      key={option.value}
                      className={`relative flex items-start space-x-3 rounded-lg border p-4 cursor-pointer transition-all ${
                        investorType === option.value
                          ? "bg-slate-800 border-cyan-500"
                          : "bg-slate-900/30 border-slate-700 hover:bg-slate-800/50"
                      }`}
                      onClick={() => setInvestorType(option.value)}
                    >
                      <RadioGroupItem value={option.value} id={option.value} className="mt-1" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Icon className={`w-5 h-5 ${option.color}`} />
                          <Label
                            htmlFor={option.value}
                            className="text-lg font-semibold text-white cursor-pointer"
                          >
                            {option.label}
                          </Label>
                        </div>
                        <p className="text-sm text-slate-400 mb-3">
                          {option.description}
                        </p>
                        <ul className="space-y-1">
                          {option.features.map((feature, idx) => (
                            <li key={idx} className="text-sm text-slate-300 flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                              {feature}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  );
                })}
              </RadioGroup>

              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-2">Zusammenfassung</h4>
                <div className="space-y-1 text-sm text-slate-300">
                  <p>Investitionssumme: <span className="font-bold text-cyan-400">CHF {investmentAmount.toLocaleString('de-CH')}</span></p>
                  <p>Anlegerprofil: <span className="font-bold text-cyan-400">
                    {investorTypeOptions.find(o => o.value === investorType)?.label}
                  </span></p>
                </div>
              </div>

              <div className="flex justify-between gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setStep(1)}
                  className="bg-slate-800 border-slate-700 text-white hover:bg-slate-700"
                >
                  Zurück
                </Button>
                <Button
                  onClick={handleGeneratePortfolio}
                  disabled={loading}
                  className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Portfolio wird erstellt...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Portfolio erstellen
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
