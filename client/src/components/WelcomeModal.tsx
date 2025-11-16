import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, TrendingUp, PieChart, Calendar, Sparkles } from "lucide-react";

interface WelcomeModalProps {
  open: boolean;
  onClose: () => void;
  onCreateDemo: () => void;
  onStartTour: () => void;
}

export default function WelcomeModal({ open, onClose, onCreateDemo, onStartTour }: WelcomeModalProps) {
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: "Willkommen bei Portfolio Analyzer! 🎉",
      description: "Ihre intelligente Lösung für professionelles Portfolio-Management",
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            Portfolio Analyzer hilft Ihnen, Ihre Investments zu verwalten, zu analysieren und zu optimieren. 
            Mit Echtzeit-Daten, KI-gestützten Insights und professionellen Analysetools behalten Sie immer den Überblick.
          </p>
          <div className="grid gap-3 mt-6">
            <FeatureItem icon={<TrendingUp className="h-5 w-5" />} text="Echtzeit-Kursdaten und Performance-Tracking" />
            <FeatureItem icon={<PieChart className="h-5 w-5" />} text="Portfolio-Optimierung mit modernen Algorithmen" />
            <FeatureItem icon={<Calendar className="h-5 w-5" />} text="Automatische Dividenden-Erfassung" />
            <FeatureItem icon={<Sparkles className="h-5 w-5" />} text="KI-gestützte Analysen und Empfehlungen" />
          </div>
        </div>
      ),
    },
    {
      title: "Wie möchten Sie starten?",
      description: "Wählen Sie die beste Option für Ihren Einstieg",
      content: (
        <div className="grid gap-4 mt-4">
          <Card className="cursor-pointer hover:border-primary transition-colors" onClick={onCreateDemo}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Demo-Portfolio erstellen
              </CardTitle>
              <CardDescription>
                Perfekt zum Kennenlernen! Wir erstellen ein Beispiel-Portfolio mit realistischen Daten.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full">
                Demo starten
              </Button>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:border-primary transition-colors" onClick={onStartTour}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Eigenes Portfolio erstellen
              </CardTitle>
              <CardDescription>
                Bereit loszulegen? Wir führen Sie Schritt für Schritt durch die Erstellung.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full">
                Tour starten
              </Button>
            </CardContent>
          </Card>

          <Button variant="ghost" onClick={onClose} className="mt-2">
            Überspringen
          </Button>
        </div>
      ),
    },
  ];

  const currentStep = steps[step];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{currentStep.title}</DialogTitle>
          <DialogDescription>{currentStep.description}</DialogDescription>
        </DialogHeader>

        <div className="py-4">{currentStep.content}</div>

        {step === 0 && (
          <div className="flex justify-between items-center pt-4 border-t">
            <div className="flex gap-1">
              {steps.map((_, idx) => (
                <div
                  key={idx}
                  className={`h-2 w-2 rounded-full transition-colors ${
                    idx === step ? "bg-primary" : "bg-muted"
                  }`}
                />
              ))}
            </div>
            <Button onClick={() => setStep(1)}>Weiter</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function FeatureItem({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="text-primary">{icon}</div>
      <span className="text-sm">{text}</span>
    </div>
  );
}
