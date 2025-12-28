import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { TrendingUp, Target, Percent, BarChart } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type OptimizationCriterion = "sharpe" | "dividend" | "minVolatility" | "maxReturn" | "balanced";

export default function PortfolioOptimizer() {
  const { user } = useAuth();
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<number | null>(null);
  const [criterion, setCriterion] = useState<OptimizationCriterion>("balanced");
  const [targetReturn, setTargetReturn] = useState<string>("10");
  const [maxRisk, setMaxRisk] = useState<string>("15");
  
  const { data: portfolios = [] } = trpc.portfolios.list.useQuery();
  const optimizeMutation = trpc.portfolioOptimizer.optimize.useMutation({
    onSuccess: (data) => {
      toast.success("Optimierung abgeschlossen", {
        description: `Neues Portfolio mit ${data.stocks.length} Aktien erstellt`
      });
    },
    onError: (error) => {
      toast.error("Optimierung fehlgeschlagen", {
        description: error.message
      });
    }
  });

  if (!user) {
    return null;
  }

  const handleOptimize = () => {
    if (!selectedPortfolioId) {
      toast.error("Bitte wählen Sie ein Portfolio aus");
      return;
    }

    optimizeMutation.mutate({
      portfolioId: selectedPortfolioId,
      criterion,
      targetReturn: parseFloat(targetReturn),
      maxRisk: parseFloat(maxRisk)
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Portfolio Optimizer</h1>
            <p className="text-muted-foreground mt-1">
              Optimieren Sie Ihr Portfolio nach verschiedenen Kriterien
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Configuration Panel */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Optimierungseinstellungen
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Portfolio auswählen</label>
                <Select value={selectedPortfolioId?.toString()} onValueChange={(v) => setSelectedPortfolioId(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Portfolio wählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {portfolios.map((p: any) => (
                      <SelectItem key={p.id} value={p.id.toString()}>
                        {p.name} ({JSON.parse(p.portfolioData).stocks?.length || 0} Aktien)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Optimierungskriterium</label>
                <Select value={criterion} onValueChange={(v) => setCriterion(v as OptimizationCriterion)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="balanced">Ausgewogen (Balanced)</SelectItem>
                    <SelectItem value="sharpe">Maximale Sharpe Ratio</SelectItem>
                    <SelectItem value="dividend">Maximale Dividendenrendite</SelectItem>
                    <SelectItem value="minVolatility">Minimale Volatilität</SelectItem>
                    <SelectItem value="maxReturn">Maximale Rendite</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {criterion === "balanced" && (
                <>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Zielrendite (%)</label>
                    <Input
                      type="number"
                      step="0.1"
                      value={targetReturn}
                      onChange={(e) => setTargetReturn(e.target.value)}
                      placeholder="10.0"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Maximales Risiko (%)</label>
                    <Input
                      type="number"
                      step="0.1"
                      value={maxRisk}
                      onChange={(e) => setMaxRisk(e.target.value)}
                      placeholder="15.0"
                    />
                  </div>
                </>
              )}

              <Button 
                onClick={handleOptimize} 
                className="w-full"
                disabled={!selectedPortfolioId || optimizeMutation.isPending}
              >
                {optimizeMutation.isPending ? "Optimiere..." : "Portfolio optimieren"}
              </Button>
            </CardContent>
          </Card>

          {/* Info Panel */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart className="h-5 w-5" />
                Optimierungskriterien
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="p-3 bg-muted rounded-lg">
                  <h4 className="font-semibold mb-1 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-blue-500" />
                    Ausgewogen (Balanced)
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Optimiert das Verhältnis zwischen Rendite und Risiko. Ideal für langfristige Anleger.
                  </p>
                </div>

                <div className="p-3 bg-muted rounded-lg">
                  <h4 className="font-semibold mb-1 flex items-center gap-2">
                    <Target className="h-4 w-4 text-green-500" />
                    Maximale Sharpe Ratio
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Maximiert die risikoadjustierte Rendite. Beste Performance pro Risikoeinheit.
                  </p>
                </div>

                <div className="p-3 bg-muted rounded-lg">
                  <h4 className="font-semibold mb-1 flex items-center gap-2">
                    <Percent className="h-4 w-4 text-purple-500" />
                    Maximale Dividendenrendite
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Fokus auf regelmäßige Einkünfte durch hohe Dividendenzahlungen.
                  </p>
                </div>

                <div className="p-3 bg-muted rounded-lg">
                  <h4 className="font-semibold mb-1 flex items-center gap-2">
                    <BarChart className="h-4 w-4 text-orange-500" />
                    Minimale Volatilität
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Reduziert Kursschwankungen. Ideal für risikoaverse Anleger.
                  </p>
                </div>

                <div className="p-3 bg-muted rounded-lg">
                  <h4 className="font-semibold mb-1 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-red-500" />
                    Maximale Rendite
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Maximiert die erwartete Rendite. Höheres Risiko, höhere Chancen.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {optimizeMutation.data && (
          <Card>
            <CardHeader>
              <CardTitle>Optimierungsergebnis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Erwartete Rendite</p>
                  <p className="text-2xl font-bold text-green-500">
                    {optimizeMutation.data.expectedReturn?.toFixed(2)}%
                  </p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Risiko (Volatilität)</p>
                  <p className="text-2xl font-bold text-orange-500">
                    {optimizeMutation.data.risk?.toFixed(2)}%
                  </p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Sharpe Ratio</p>
                  <p className="text-2xl font-bold text-blue-500">
                    {optimizeMutation.data.sharpeRatio?.toFixed(2)}
                  </p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Div. Rendite</p>
                  <p className="text-2xl font-bold text-purple-500">
                    {optimizeMutation.data.dividendYield?.toFixed(2)}%
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-2 text-muted-foreground">Ticker</th>
                      <th className="text-left py-2 px-2 text-muted-foreground">Unternehmen</th>
                      <th className="text-right py-2 px-2 text-muted-foreground">Gewichtung</th>
                      <th className="text-right py-2 px-2 text-muted-foreground">Aktien</th>
                    </tr>
                  </thead>
                  <tbody>
                    {optimizeMutation.data.stocks.map((stock: any, idx: number) => (
                      <tr key={idx} className="border-b border-border/50">
                        <td className="py-2 px-2 font-mono">{stock.ticker}</td>
                        <td className="py-2 px-2">{stock.companyName}</td>
                        <td className="py-2 px-2 text-right font-semibold">
                          {stock.portfolioWeight.toFixed(2)}%
                        </td>
                        <td className="py-2 px-2 text-right">{stock.shares}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
