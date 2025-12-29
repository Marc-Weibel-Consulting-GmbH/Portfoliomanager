import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, RefreshCw, AlertCircle, CheckCircle } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function Sectors() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [refreshResult, setRefreshResult] = useState<{ updated: number; failed: number; total: number } | null>(null);

  const { data: sectors = [], isLoading, refetch: refetchSectors } = trpc.sectors.list.useQuery();
  const { data: allStocks = [], refetch: refetchStocks } = trpc.stocks.getAll.useQuery();
  
  const utils = trpc.useUtils();
  
  const refreshMissingSectors = trpc.sectors.refreshMissingSectors.useMutation({
    onSuccess: (data) => {
      setRefreshResult(data);
      toast.success(`Sektor-Daten aktualisiert: ${data.updated} von ${data.total} Aktien`);
      refetchSectors();
      refetchStocks();
      utils.stocks.getAll.invalidate();
    },
    onError: (error) => {
      toast.error(`Fehler: ${error.message}`);
    },
  });

  // Count stocks without sector
  const stocksWithoutSector = allStocks.filter(s => !s.sector || s.sector === '');

  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-6">
            <p className="text-white">Nur für Administratoren zugänglich</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => window.history.back()}
            className="text-white hover:bg-slate-800"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-3xl font-bold text-white">Branchen-Verwaltung</h1>
        </div>

        {/* Refresh Missing Sectors Card */}
        <Card className="bg-slate-800/50 border-slate-700 mb-6">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <RefreshCw className="w-5 h-5" />
              Sektor-Daten aktualisieren
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-300">
                  {stocksWithoutSector.length} Aktien ohne Sektor-Daten
                </p>
                {stocksWithoutSector.length > 0 && (
                  <p className="text-sm text-slate-400 mt-1">
                    {stocksWithoutSector.slice(0, 5).map(s => s.ticker).join(', ')}
                    {stocksWithoutSector.length > 5 && ` und ${stocksWithoutSector.length - 5} weitere...`}
                  </p>
                )}
              </div>
              <Button
                onClick={() => refreshMissingSectors.mutate()}
                disabled={refreshMissingSectors.isPending || stocksWithoutSector.length === 0}
                className="bg-cyan-600 hover:bg-cyan-700"
              >
                {refreshMissingSectors.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Aktualisiere...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Sektoren laden
                  </>
                )}
              </Button>
            </div>
            
            {refreshResult && (
              <div className="mt-4 p-3 bg-slate-700/50 rounded-lg">
                <div className="flex items-center gap-2 text-green-400">
                  <CheckCircle className="w-4 h-4" />
                  <span>{refreshResult.updated} Aktien aktualisiert</span>
                </div>
                {refreshResult.failed > 0 && (
                  <div className="flex items-center gap-2 text-yellow-400 mt-1">
                    <AlertCircle className="w-4 h-4" />
                    <span>{refreshResult.failed} Aktien ohne Sektor-Daten gefunden</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Aktuelle Branchen ({sectors.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-slate-400">Laden...</p>
            ) : sectors.length === 0 ? (
              <p className="text-slate-400">Keine Branchen gefunden</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {sectors.map((sector, index) => {
                  const stockCount = allStocks.filter(s => s.sector === sector).length;
                  return (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg"
                    >
                      <div>
                        <h3 className="text-white font-medium">{sector}</h3>
                        <p className="text-sm text-slate-400">
                          {stockCount} {stockCount === 1 ? 'Aktie' : 'Aktien'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-6 p-4 bg-blue-900/20 border border-blue-700/50 rounded-lg">
          <p className="text-blue-200 text-sm">
            <strong>Hinweis:</strong> Sektor-Daten werden automatisch von EODHD geladen. 
            Klicken Sie auf "Sektoren laden" um fehlende Daten zu ergänzen.
          </p>
        </div>
      </div>
    </div>
  );
}
