import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, PieChart, Calendar, Sparkles, DollarSign, BarChart3 } from "lucide-react";

interface HelpModalProps {
  open: boolean;
  onClose: () => void;
}

export default function HelpModal({ open, onClose }: HelpModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Hilfe & Dokumentation</DialogTitle>
          <DialogDescription>
            Alles, was Sie über Portfolio Analyzer wissen müssen
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="faq" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="faq">FAQ</TabsTrigger>
            <TabsTrigger value="features">Features</TabsTrigger>
            <TabsTrigger value="glossary">Glossar</TabsTrigger>
          </TabsList>

          <TabsContent value="faq" className="space-y-4">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1">
                <AccordionTrigger>Wie erstelle ich mein erstes Portfolio?</AccordionTrigger>
                <AccordionContent>
                  <ol className="list-decimal list-inside space-y-2 text-sm">
                    <li>Klicken Sie auf den Tab "Portfolio Optimizer"</li>
                    <li>Fügen Sie Aktien über das Suchfeld hinzu (z.B. "AAPL" für Apple)</li>
                    <li>Wählen Sie Ihre Optimierungsstrategie (z.B. "Max. Sharpe Ratio")</li>
                    <li>Klicken Sie auf "Portfolio optimieren"</li>
                    <li>Speichern Sie das Ergebnis mit dem "Speichern" Button</li>
                  </ol>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-2">
                <AccordionTrigger>Was bedeutet "Live-Tracking"?</AccordionTrigger>
                <AccordionContent>
                  <p className="text-sm mb-2">
                    Live-Tracking verwandelt ein Test-Portfolio in ein echtes Portfolio mit Transaktionshistorie:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>Automatische Erfassung von Käufen und Verkäufen</li>
                    <li>Echtzeit-Performance-Berechnung</li>
                    <li>Dividenden-Tracking</li>
                    <li>Realisierte Gewinne/Verluste</li>
                  </ul>
                  <p className="text-sm mt-2">
                    Aktivieren Sie Live-Tracking über den "LIVE" Toggle-Button in der Portfolio-Übersicht.
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-3">
                <AccordionTrigger>Wie werden Dividenden erfasst?</AccordionTrigger>
                <AccordionContent>
                  <p className="text-sm mb-2">
                    Dividenden werden automatisch erfasst für alle Live-Portfolios:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>Tägliche Prüfung auf Ex-Dividenden-Daten</li>
                    <li>Automatische Transaktion am Ex-Datum</li>
                    <li>Betrag = Dividende pro Aktie × Ihre Anzahl Aktien</li>
                    <li>Sichtbar im Dividenden-Kalender und in der Transaktionshistorie</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-4">
                <AccordionTrigger>Was ist der Unterschied zwischen realisierten und unrealisierten Gewinnen?</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 text-sm">
                    <p>
                      <strong>Unrealisierte Gewinne:</strong> Papiergewinne auf Positionen, die Sie noch halten.
                      Berechnung: (Aktueller Wert - Kaufwert)
                    </p>
                    <p>
                      <strong>Realisierte Gewinne:</strong> Tatsächliche Gewinne aus verkauften Positionen.
                      Diese sind steuerrelevant und werden in der Jahresübersicht separat ausgewiesen.
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-5">
                <AccordionTrigger>Wie funktioniert die Portfolio-Optimierung?</AccordionTrigger>
                <AccordionContent>
                  <p className="text-sm mb-2">
                    Der Optimizer verwendet moderne Portfolio-Theorie (Markowitz):
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li><strong>Max. Sharpe Ratio:</strong> Bestes Rendite-Risiko-Verhältnis</li>
                    <li><strong>Min. Volatilität:</strong> Niedrigstes Risiko</li>
                    <li><strong>Max. Rendite:</strong> Höchste erwartete Rendite</li>
                    <li><strong>Equal Weight:</strong> Gleichmäßige Verteilung</li>
                  </ul>
                  <p className="text-sm mt-2">
                    Basierend auf historischen Daten (wählbar: 1Y, 3Y, 5Y, YTD)
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-6">
                <AccordionTrigger>Wie interpretiere ich die Kennzahlen?</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 text-sm">
                    <p><strong>P/E Ratio:</strong> Kurs-Gewinn-Verhältnis. Niedriger = günstiger bewertet</p>
                    <p><strong>PEG Ratio:</strong> P/E im Verhältnis zum Wachstum. &lt;1 = attraktiv</p>
                    <p><strong>Sharpe Ratio:</strong> Rendite pro Risiko-Einheit. Höher = besser</p>
                    <p><strong>YTD Performance:</strong> Performance seit Jahresbeginn in %</p>
                    <p><strong>Div. Rendite:</strong> Jährliche Dividende im Verhältnis zum Kurs</p>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </TabsContent>

          <TabsContent value="features" className="space-y-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Echtzeit-Daten
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                Aktuelle Kursdaten, News und Fundamentaldaten von führenden Finanzmarkt-APIs (EODHD, Finnhub)
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <PieChart className="h-5 w-5 text-primary" />
                  Portfolio-Optimierung
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                Wissenschaftlich fundierte Optimierung nach Markowitz-Theorie mit verschiedenen Strategien
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Calendar className="h-5 w-5 text-primary" />
                  Automatische Dividenden
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                Tägliche Prüfung und automatische Erfassung von Dividendenzahlungen für alle Live-Portfolios
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-5 w-5 text-primary" />
                  KI-Analysen
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                Intelligente Portfolio-Analysen, Markt-Sentiment und personalisierte Empfehlungen durch KI
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <DollarSign className="h-5 w-5 text-primary" />
                  Steuer-Reporting
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                Jahresübersicht mit realisierten Gewinnen, Dividenden und Kosten für Ihre Steuererklärung
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Visualisierungen
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                Interaktive Charts für Performance, Asset Allocation, historische Entwicklung und Vergleiche
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="glossary" className="space-y-2">
            <div className="space-y-3 text-sm">
              <div>
                <h4 className="font-semibold mb-1">Asset Allocation</h4>
                <p className="text-muted-foreground">Verteilung des Kapitals auf verschiedene Anlageklassen oder Wertpapiere</p>
              </div>
              <div>
                <h4 className="font-semibold mb-1">Benchmark</h4>
                <p className="text-muted-foreground">Vergleichsindex (z.B. S&P 500) zur Bewertung der Portfolio-Performance</p>
              </div>
              <div>
                <h4 className="font-semibold mb-1">Diversifikation</h4>
                <p className="text-muted-foreground">Risikostreuung durch Investition in verschiedene Wertpapiere und Sektoren</p>
              </div>
              <div>
                <h4 className="font-semibold mb-1">Ex-Dividenden-Datum</h4>
                <p className="text-muted-foreground">Stichtag, ab dem eine Aktie ohne Dividendenanspruch gehandelt wird</p>
              </div>
              <div>
                <h4 className="font-semibold mb-1">Markowitz-Theorie</h4>
                <p className="text-muted-foreground">Moderne Portfolio-Theorie zur Optimierung von Rendite und Risiko</p>
              </div>
              <div>
                <h4 className="font-semibold mb-1">Rebalancing</h4>
                <p className="text-muted-foreground">Anpassung der Portfolio-Gewichtungen zur Wiederherstellung der Zielallokation</p>
              </div>
              <div>
                <h4 className="font-semibold mb-1">Sharpe Ratio</h4>
                <p className="text-muted-foreground">Kennzahl für risikoadjustierte Rendite (Rendite pro Risiko-Einheit)</p>
              </div>
              <div>
                <h4 className="font-semibold mb-1">Volatilität</h4>
                <p className="text-muted-foreground">Maß für Kursschwankungen; höhere Volatilität = höheres Risiko</p>
              </div>
              <div>
                <h4 className="font-semibold mb-1">YTD (Year-to-Date)</h4>
                <p className="text-muted-foreground">Performance seit Beginn des aktuellen Kalenderjahres</p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
