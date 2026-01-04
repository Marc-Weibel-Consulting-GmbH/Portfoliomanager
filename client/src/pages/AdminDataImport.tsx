import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2, Database, AlertCircle, CheckCircle2 } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function AdminDataImport() {
  const [fromDate, setFromDate] = useState(() => {
    const threeYearsAgo = new Date();
    threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
    return threeYearsAgo.toISOString().split('T')[0];
  });
  
  const [toDate, setToDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  
  const [forceRefresh, setForceRefresh] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  const importMutation = trpc.system.importHistoricalData.useMutation({
    onSuccess: (data) => {
      setImportResult(data);
      if (data.success) {
        toast.success(`Import erfolgreich: ${data.tickersProcessed} Tickers verarbeitet, ${data.pricesImported} Preise importiert`);
      } else {
        toast.error(`Import fehlgeschlagen: ${data.errors.length} Fehler`);
      }
    },
    onError: (error) => {
      toast.error(`Import-Fehler: ${error.message}`);
    },
  });

  const handleImport = () => {
    setImportResult(null);
    importMutation.mutate({
      fromDate,
      toDate,
      forceRefresh,
    });
  };

  return (
    <DashboardLayout>
      <div className="container max-w-4xl py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Historische Daten Import</h1>
          <p className="text-muted-foreground">
            Importiere historische Kursdaten für alle Portfolio-Aktien aus der EODHD API.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Daten-Import Konfiguration
            </CardTitle>
            <CardDescription>
              Wähle den Zeitraum für den historischen Daten-Import. Der Import kann mehrere Minuten dauern.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fromDate">Von Datum</Label>
                <Input
                  id="fromDate"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  disabled={importMutation.isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="toDate">Bis Datum</Label>
                <Input
                  id="toDate"
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  disabled={importMutation.isPending}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="forceRefresh"
                checked={forceRefresh}
                onCheckedChange={(checked) => setForceRefresh(checked as boolean)}
                disabled={importMutation.isPending}
              />
              <Label
                htmlFor="forceRefresh"
                className="text-sm font-normal cursor-pointer"
              >
                Bestehende Daten überschreiben (Force Refresh)
              </Label>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Wichtig</AlertTitle>
              <AlertDescription>
                Der Import lädt Kursdaten für alle Aktien in deinen Portfolios. Bei vielen Aktien kann dies mehrere Minuten dauern.
                Die API hat ein Rate Limit von 5 Anfragen pro Sekunde.
              </AlertDescription>
            </Alert>

            <Button
              onClick={handleImport}
              disabled={importMutation.isPending}
              className="w-full"
              size="lg"
            >
              {importMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Import läuft...
                </>
              ) : (
                <>
                  <Database className="mr-2 h-4 w-4" />
                  Daten importieren
                </>
              )}
            </Button>

            {importResult && (
              <Card className={importResult.success ? "border-green-500" : "border-red-500"}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {importResult.success ? (
                      <>
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                        Import erfolgreich
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-5 w-5 text-red-500" />
                        Import fehlgeschlagen
                      </>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Tickers verarbeitet:</span>
                      <span className="ml-2">{importResult.tickersProcessed}</span>
                    </div>
                    <div>
                      <span className="font-medium">Preise importiert:</span>
                      <span className="ml-2">{importResult.pricesImported}</span>
                    </div>
                  </div>

                  {importResult.errors && importResult.errors.length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-medium text-sm mb-2">Fehler ({importResult.errors.length}):</h4>
                      <div className="bg-muted rounded-md p-3 max-h-48 overflow-y-auto">
                        <ul className="text-xs space-y-1">
                          {importResult.errors.slice(0, 20).map((error: string, idx: number) => (
                            <li key={idx} className="text-red-600">• {error}</li>
                          ))}
                          {importResult.errors.length > 20 && (
                            <li className="text-muted-foreground">... und {importResult.errors.length - 20} weitere</li>
                          )}
                        </ul>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
