import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function Registration() {
  const [, setLocation] = useLocation();
  const [formData, setFormData] = useState<{
    firstName: string;
    lastName: string;
    investmentGoal: "dividends" | "growth" | "balanced" | "";
    riskTolerance: "low" | "medium" | "high" | "";
  }>({
    firstName: "",
    lastName: "",
    investmentGoal: "",
    riskTolerance: "",
  });

  const completeRegistration = trpc.user.completeRegistration.useMutation({
    onSuccess: () => {
      toast.success("Registrierung erfolgreich abgeschlossen!");
      setLocation("/dashboard");
    },
    onError: (error) => {
      toast.error("Fehler bei der Registrierung: " + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.firstName || !formData.lastName || !formData.investmentGoal || !formData.riskTolerance) {
      toast.error("Bitte füllen Sie alle Felder aus");
      return;
    }

    completeRegistration.mutate({
      firstName: formData.firstName,
      lastName: formData.lastName,
      investmentGoal: formData.investmentGoal as "dividends" | "growth" | "balanced",
      riskTolerance: formData.riskTolerance as "low" | "medium" | "high",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl bg-slate-900/50 border-slate-800">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-white">Willkommen bei Portfolio Analyse</CardTitle>
          <CardDescription className="text-slate-400 text-lg">
            Vervollständigen Sie Ihr Profil, um zu starten
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Personal Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Persönliche Informationen</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="text-slate-300">Vorname *</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    placeholder="Max"
                    className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName" className="text-slate-300">Nachname *</Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    placeholder="Mustermann"
                    className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Investment Goal */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Anlageziel *</h3>
              <RadioGroup
                value={formData.investmentGoal}
                onValueChange={(value) => setFormData({ ...formData, investmentGoal: value as "dividends" | "growth" | "balanced" })}
                className="space-y-3"
              >
                <div className="flex items-start space-x-3 p-4 rounded-lg border border-slate-700 bg-slate-800/30 hover:bg-slate-800/50 transition-colors">
                  <RadioGroupItem value="dividends" id="dividends" className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="dividends" className="text-white font-medium cursor-pointer">
                      Dividenden
                    </Label>
                    <p className="text-sm text-slate-400 mt-1">
                      Fokus auf regelmäßige Ausschüttungen und passives Einkommen
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3 p-4 rounded-lg border border-slate-700 bg-slate-800/30 hover:bg-slate-800/50 transition-colors">
                  <RadioGroupItem value="growth" id="growth" className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="growth" className="text-white font-medium cursor-pointer">
                      Wachstum
                    </Label>
                    <p className="text-sm text-slate-400 mt-1">
                      Maximierung der Kapitalgewinne durch Wertsteigerung
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3 p-4 rounded-lg border border-slate-700 bg-slate-800/30 hover:bg-slate-800/50 transition-colors">
                  <RadioGroupItem value="balanced" id="balanced" className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="balanced" className="text-white font-medium cursor-pointer">
                      Ausgewogen
                    </Label>
                    <p className="text-sm text-slate-400 mt-1">
                      Kombination aus Dividenden und Wachstum für ausgewogene Rendite
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </div>

            {/* Risk Tolerance */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Risikobereitschaft *</h3>
              <RadioGroup
                value={formData.riskTolerance}
                onValueChange={(value) => setFormData({ ...formData, riskTolerance: value as "low" | "medium" | "high" })}
                className="space-y-3"
              >
                <div className="flex items-start space-x-3 p-4 rounded-lg border border-slate-700 bg-slate-800/30 hover:bg-slate-800/50 transition-colors">
                  <RadioGroupItem value="low" id="low" className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="low" className="text-white font-medium cursor-pointer">
                      Niedrig
                    </Label>
                    <p className="text-sm text-slate-400 mt-1">
                      Konservative Anlagestrategie mit Fokus auf Kapitalerhalt
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3 p-4 rounded-lg border border-slate-700 bg-slate-800/30 hover:bg-slate-800/50 transition-colors">
                  <RadioGroupItem value="medium" id="medium" className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="medium" className="text-white font-medium cursor-pointer">
                      Mittel
                    </Label>
                    <p className="text-sm text-slate-400 mt-1">
                      Ausgewogenes Verhältnis zwischen Risiko und Rendite
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3 p-4 rounded-lg border border-slate-700 bg-slate-800/30 hover:bg-slate-800/50 transition-colors">
                  <RadioGroupItem value="high" id="high" className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="high" className="text-white font-medium cursor-pointer">
                      Hoch
                    </Label>
                    <p className="text-sm text-slate-400 mt-1">
                      Aggressive Strategie für maximales Wachstumspotenzial
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </div>

            <Button
              type="submit"
              className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-semibold py-6 text-lg"
              disabled={completeRegistration.isPending}
            >
              {completeRegistration.isPending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Wird gespeichert...
                </>
              ) : (
                "Registrierung abschließen"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
