import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, TrendingUp, AlertCircle, Lightbulb, Target, RefreshCw } from "lucide-react";

export default function AIInsights() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">KI-Insights</h1>
            <p className="text-muted-foreground mt-1">
              KI-gestützte Portfolio-Analyse und Empfehlungen
            </p>
          </div>
          <Button className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Analyse aktualisieren
          </Button>
        </div>

        {/* AI Analysis Cards */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <CardTitle>Portfolio-Gesundheit</CardTitle>
              </div>
              <CardDescription>
                KI-basierte Bewertung Ihres Portfolios
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <div className="text-6xl font-bold text-primary mb-2">--</div>
                    <p className="text-sm text-muted-foreground">
                      Gesundheits-Score
                    </p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Wählen Sie ein Portfolio aus, um eine detaillierte KI-Analyse zu erhalten.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-orange-500" />
                <CardTitle>Risiko-Bewertung</CardTitle>
              </div>
              <CardDescription>
                Automatische Risikoanalyse mit KI
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <AlertCircle className="h-16 w-16 text-muted-foreground mb-4" />
                    <p className="text-sm text-muted-foreground">
                      Keine Risiken erkannt
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Investment Recommendations */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-yellow-500" />
              <CardTitle>Investitions-Empfehlungen</CardTitle>
            </div>
            <CardDescription>
              Personalisierte Empfehlungen basierend auf Ihrem Portfolio
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <Lightbulb className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Keine Empfehlungen verfügbar</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Erstellen Sie ein Portfolio, um personalisierte Investitions-Empfehlungen zu erhalten.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Market Sentiment */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              <CardTitle>Markt-Sentiment</CardTitle>
            </div>
            <CardDescription>
              KI-Analyse der Marktstimmung für Ihre Positionen
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <TrendingUp className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Sentiment-Analyse</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Analysieren Sie die Marktstimmung für Ihre Portfolio-Positionen basierend auf News und Social Media.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* AI Stock Screening */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-500" />
              <CardTitle>KI-Aktien-Screening</CardTitle>
            </div>
            <CardDescription>
              Finden Sie passende Aktien mit KI-Unterstützung
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <Target className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Intelligentes Screening</h3>
              <p className="text-sm text-muted-foreground max-w-md mb-6">
                Nutzen Sie KI, um Aktien zu finden, die zu Ihrer Anlagestrategie passen.
              </p>
              <Button>Screening starten</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
