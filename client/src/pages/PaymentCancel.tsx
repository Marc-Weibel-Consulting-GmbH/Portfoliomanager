import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { XCircle, ArrowLeft, HelpCircle } from "lucide-react";

export default function PaymentCancel() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full border-orange-500/20 bg-slate-900/50 backdrop-blur">
        <CardHeader className="text-center space-y-4 pb-8">
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-orange-500/20 blur-2xl rounded-full"></div>
              <XCircle className="h-20 w-20 text-orange-500 relative" />
            </div>
          </div>
          <div>
            <CardTitle className="text-3xl font-bold mb-2">
              Zahlung abgebrochen
            </CardTitle>
            <CardDescription className="text-lg">
              Der Zahlungsvorgang wurde nicht abgeschlossen
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Information Message */}
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4">
            <p className="text-sm text-orange-400 text-center">
              Keine Sorge - es wurde keine Zahlung durchgeführt.
            </p>
          </div>

          {/* Reasons */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Mögliche Gründe</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span>Sie haben den Zahlungsvorgang manuell abgebrochen</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span>Es gab ein technisches Problem mit der Zahlungsmethode</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span>Die Sitzung ist abgelaufen</span>
              </li>
            </ul>
          </div>

          {/* What's Next */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Was möchten Sie tun?</h3>
            <div className="grid gap-3">
              <Button
                onClick={() => setLocation("/pricing")}
                className="w-full h-12 text-base justify-start"
                size="lg"
              >
                <ArrowLeft className="h-5 w-5 mr-2" />
                Zurück zur Pricing-Seite
              </Button>

              <Button
                onClick={() => setLocation("/dashboard")}
                variant="outline"
                className="w-full h-12 text-base justify-start"
                size="lg"
              >
                Zum Dashboard (Free-Version)
              </Button>

              <Button
                onClick={() => setLocation("/kontakt")}
                variant="outline"
                className="w-full h-12 text-base justify-start"
                size="lg"
              >
                <HelpCircle className="h-5 w-5 mr-2" />
                Support kontaktieren
              </Button>
            </div>
          </div>

          {/* Free Features Reminder */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
            <h4 className="font-semibold mb-2">Sie können trotzdem loslegen!</h4>
            <p className="text-sm text-muted-foreground">
              Mit der kostenlosen Version können Sie bereits ein Demo-Portfolio erstellen und die Grundfunktionen testen.
            </p>
          </div>

          {/* Support Info */}
          <div className="text-center text-sm text-muted-foreground pt-4 border-t border-slate-700/50">
            <p>
              Bei Fragen zur Zahlung kontaktieren Sie uns unter{" "}
              <a href="mailto:support@example.com" className="text-primary hover:underline">
                support@example.ch
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
