import { useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Sparkles, TrendingUp, Bell, FileText } from "lucide-react";
import { APP_TITLE } from "@/const";

export default function PaymentSuccess() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Optional: Track conversion event
    console.log("Payment successful - Premium activated");
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full border-primary/20 bg-slate-900/50 backdrop-blur">
        <CardHeader className="text-center space-y-4 pb-8">
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-green-500/20 blur-2xl rounded-full"></div>
              <CheckCircle2 className="h-20 w-20 text-green-500 relative" />
            </div>
          </div>
          <div>
            <CardTitle className="text-3xl font-bold mb-2">
              Zahlung erfolgreich!
            </CardTitle>
            <CardDescription className="text-lg">
              Ihr Premium-Account wurde freigeschaltet
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Confirmation Message */}
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 text-center">
            <p className="text-sm text-green-400">
              Eine Bestätigungs-Email wurde an Ihre E-Mail-Adresse gesendet.
            </p>
          </div>

          {/* Premium Features Unlocked */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Premium-Features freigeschaltet
            </h3>
            <div className="grid gap-3">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                <TrendingUp className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-medium">Unbegrenzte Portfolios & Live-Tracking</div>
                  <div className="text-sm text-muted-foreground">
                    Erstellen Sie unbegrenzt viele Portfolios mit Echtzeit-Performance-Tracking (IRR/MWR)
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                <Bell className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-medium">Preisalarme (Email & WhatsApp)</div>
                  <div className="text-sm text-muted-foreground">
                    Erhalten Sie sofortige Benachrichtigungen bei Preisänderungen
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                <Sparkles className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-medium">KI-gestützte Insights & Signale</div>
                  <div className="text-sm text-muted-foreground">
                    Nutzen Sie künstliche Intelligenz für Portfolio-Analysen und Trading-Signale
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                <FileText className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-medium">Vollständige Fundamentalanalyse & Reports</div>
                  <div className="text-sm text-muted-foreground">
                    Zugriff auf alle Fundamentaldaten und PDF-Report-Generierung
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button
              onClick={() => setLocation("/dashboard")}
              className="flex-1 h-12 text-base"
              size="lg"
            >
              Zum Dashboard
            </Button>
            <Button
              onClick={() => setLocation("/portfolio-builder/wizard")}
              variant="outline"
              className="flex-1 h-12 text-base"
              size="lg"
            >
              Erstes Portfolio erstellen
            </Button>
          </div>

          {/* Support Info */}
          <div className="text-center text-sm text-muted-foreground pt-4 border-t border-slate-700/50">
            <p>
              Fragen? Kontaktieren Sie uns unter{" "}
              <a href="mailto:support@example.com" className="text-primary hover:underline">
                support@{APP_TITLE.toLowerCase()}.ch
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
