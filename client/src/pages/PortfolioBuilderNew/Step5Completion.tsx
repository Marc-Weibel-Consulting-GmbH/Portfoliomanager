import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Check, Loader2, Sparkles } from "lucide-react";
import { PortfolioBuilderState } from "../PortfolioBuilderNew";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { toast } from "sonner";

interface Step5CompletionProps {
  state: PortfolioBuilderState;
}

export default function Step5Completion({ state }: Step5CompletionProps) {
  const [, setLocation] = useLocation();
  const [enableRebalancing, setEnableRebalancing] = useState(false);
  const [enableDividendTracking, setEnableDividendTracking] = useState(state.strategy === 'dividends');
  const [isSaving, setIsSaving] = useState(false);
  const utils = trpc.useUtils();

  const createMutation = trpc.portfolios.create.useMutation({
    onSuccess: async (data) => {
      if (!data?.ok || !data?.portfolio?.id) {
        toast.error("Portfolio wurde gespeichert, aber die ID konnte nicht abgerufen werden. Bitte laden Sie die Portfolios-Seite neu.");
        setLocation('/portfolios');
        return;
      }
      // Invalidate portfolios list cache to show the new portfolio
      await utils.portfolios.list.invalidate();
      toast.success('Portfolio erfolgreich erstellt!');
      setLocation(`/portfolios/${data.portfolio.id}`);
    },
    onError: (error) => {
      toast.error('Fehler beim Speichern: ' + (error.message || 'Unbekannter Fehler'));
      setIsSaving(false);
    },
  });

  const handleSave = async () => {
    setIsSaving(true);

    const portfolioData = {
      stocks: state.positions.map(pos => ({
        ticker: pos.ticker,
        companyName: pos.companyName,
        portfolioWeight: pos.weight,
        weight: pos.weight,
        currentPrice: String(pos.currentPrice || 0),
        currency: pos.currency || 'CHF',
        exchangeRateToChf: String(pos.exchangeRateToChf || 1.0),
        ytdPerformance: pos.ytdPerformance,
        dividendYield: pos.dividendYield,
        sector: pos.sector,
      })),
      cashPercentage: state.cashPercentage, // Include cash percentage in portfolio data
    };

    try {
      await createMutation.mutateAsync({
        name: state.portfolioName,
        description: state.description || undefined,
        portfolioData: JSON.stringify(portfolioData),
        investmentAmount: state.initialCapital.toString(),
        portfolioType: state.portfolioType as "demo" | "live",
      });
    } catch (error) {
      console.error("[handleSave] Error:", error);
    }
  };


  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Success Header */}
      <Card className="bg-gradient-to-br from-[#00CFC1]/20 to-[#0f1420]/50 border-[#00CFC1]/30">
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-[#00CFC1]/20 flex items-center justify-center mx-auto mb-4">
            <Check className="h-8 w-8 text-[#00CFC1]" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Portfolio bereit zum Speichern!</h2>
          <p className="text-gray-300">
            Du hast dein Portfolio erfolgreich konfiguriert. Wähle die gewünschten Optionen und speichere es.
          </p>
        </CardContent>
      </Card>

      {/* Portfolio Summary */}
      <Card className="bg-[#0f1420]/50 border-white/10">
        <CardHeader>
          <CardTitle className="text-white">Portfolio-Zusammenfassung</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-400">Name</p>
              <p className="text-white font-medium">{state.portfolioName}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Strategie</p>
              <p className="text-white font-medium">
                {state.strategy === 'growth' ? 'Wachstum' : state.strategy === 'dividends' ? 'Dividenden' : 'Ausgewogen'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Anlagehorizont</p>
              <p className="text-white font-medium">
                {state.investmentHorizon === 'short' ? 'Kurzfristig' : state.investmentHorizon === 'medium' ? 'Mittelfristig' : 'Langfristig'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Anzahl Positionen</p>
              <p className="text-white font-medium">{state.positions.length}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Investitionssumme</p>
              <p className="text-white font-medium">CHF {state.initialCapital.toLocaleString('de-CH')}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Portfolio-Typ</p>
              <p className="text-white font-medium">{state.portfolioType === 'live' ? 'Live' : 'Demo'}</p>
            </div>
          </div>

          {state.description && (
            <div>
              <p className="text-sm text-gray-400">Beschreibung</p>
              <p className="text-white">{state.description}</p>
            </div>
          )}

          <div className="pt-4 border-t border-white/10">
            <p className="text-sm text-gray-400 mb-2">Top 5 Positionen</p>
            <div className="space-y-2">
              {state.positions
                .sort((a, b) => b.weight - a.weight)
                .slice(0, 5)
                .map((pos) => (
                  <div key={pos.ticker} className="flex items-center justify-between text-sm">
                    <span className="text-white">{pos.ticker} - {pos.companyName}</span>
                    <span className="text-[#00CFC1] font-medium">{pos.weight.toFixed(1)}%</span>
                  </div>
                ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Options */}
      <Card className="bg-[#0f1420]/50 border-white/10">
        <CardHeader>
          <CardTitle className="text-white">Portfolio-Optionen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3 opacity-50">
            <Checkbox
              id="rebalancing"
              checked={enableRebalancing}
              onCheckedChange={(checked) => setEnableRebalancing(checked as boolean)}
              disabled
            />
            <div className="flex-1">
              <Label htmlFor="rebalancing" className="text-white font-medium cursor-pointer">
                Automatische Rebalancing-Alerts
              </Label>
              <p className="text-sm text-gray-400 mt-1">
                Erhalte Benachrichtigungen, wenn dein Portfolio rebalanciert werden sollte (Coming Soon)
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 opacity-50">
            <Checkbox
              id="dividendTracking"
              checked={enableDividendTracking}
              onCheckedChange={(checked) => setEnableDividendTracking(checked as boolean)}
              disabled
            />
            <div className="flex-1">
              <Label htmlFor="dividendTracking" className="text-white font-medium cursor-pointer">
                Dividenden-Tracking aktivieren
              </Label>
              <p className="text-sm text-gray-400 mt-1">
                Verfolge alle Dividendenzahlungen und -termine (Coming Soon)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Buttons */}
      <Card className="bg-[#0f1420]/50 border-white/10">
        <CardContent className="p-6">
          <div className="flex items-center justify-center gap-4">
            <Button
              variant="outline"
              onClick={() => setLocation("/portfolios")}
              disabled={isSaving}
            >
              Abbrechen
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-[#00CFC1] hover:bg-[#00CFC1]/90 text-white px-8"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Wird gespeichert...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Portfolio speichern
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Info */}
      <Card className="bg-[#00CFC1]/10 border-[#00CFC1]/30">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-[#00CFC1] mt-2"></div>
            <div>
              <p className="text-white font-medium mb-1">Was passiert als Nächstes?</p>
              <ul className="text-sm text-gray-300 space-y-1">
                <li>• Dein Portfolio wird gespeichert und ist sofort verfügbar</li>
                <li>• Du kannst jederzeit Positionen hinzufügen oder entfernen</li>
                <li>• Gewichtungen können später angepasst werden</li>
                {state.portfolioType === 'live' && <li>• Live-Tracking startet automatisch mit aktuellen Kursen</li>}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
