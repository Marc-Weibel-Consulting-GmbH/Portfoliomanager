import { useState } from "react";
import { trpc } from "../lib/trpc";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Download, Upload, AlertTriangle, CheckCircle2, ArrowLeft, LogOut } from "lucide-react";
import { NewsletterExport } from "../components/NewsletterExport";

interface AdminProps {
  onBackClick?: () => void;
}

export function Admin({ onBackClick }: AdminProps) {
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const importMutation = trpc.admin.importData.useMutation();

  const utils = trpc.useUtils();

  const handleExport = async () => {
    try {
      setMessage(null);
      const result = await utils.admin.exportData.fetch();
      
      // Create download link
      const dataStr = JSON.stringify(result, null, 2);
      const dataBlob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `portfolio-export-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setMessage({
        type: "success",
        text: `Export erfolgreich! ${result.data.stocks.length} Aktien, ${result.data.research.length} Research-Einträge, ${result.data.transactions.length} Transaktionen exportiert.`,
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: `Export fehlgeschlagen: ${error instanceof Error ? error.message : "Unbekannter Fehler"}`,
      });
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setImporting(true);
      setMessage(null);

      const fileContent = await file.text();
      const importData = JSON.parse(fileContent);

      // Confirm import
      const confirmed = window.confirm(
        `WARNUNG: Dies wird ALLE bestehenden Daten löschen!\n\n` +
        `Import-Zusammenfassung:\n` +
        `- Aktien: ${importData.data.stocks.length}\n` +
        `- Research: ${importData.data.research.length}\n` +
        `- Transaktionen: ${importData.data.transactions.length}\n\n` +
        `Möchten Sie fortfahren?`
      );

      if (!confirmed) {
        setImporting(false);
        event.target.value = "";
        return;
      }

      const result = await importMutation.mutateAsync(importData);

      setMessage({
        type: "success",
        text: `Import erfolgreich! ${result.imported.stocks} Aktien, ${result.imported.research} Research-Einträge, ${result.imported.transactions} Transaktionen importiert.`,
      });

      // Reload page after 2 seconds
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      setMessage({
        type: "error",
        text: `Import fehlgeschlagen: ${error instanceof Error ? error.message : "Unbekannter Fehler"}`,
      });
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 px-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Admin Panel</h2>
          <p className="text-slate-400">Daten exportieren und importieren</p>
        </div>
        <div className="flex gap-2">
          {onBackClick && (
            <Button
              onClick={onBackClick}
              variant="outline"
              className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Zurück
            </Button>
          )}
          <Button
            onClick={() => {
              fetch('/api/trpc/auth.logout', { method: 'POST' })
                .then(() => window.location.href = '/login')
                .catch(console.error);
            }}
            variant="outline"
            className="bg-red-700 border-red-600 text-white hover:bg-red-600"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>

      {message && (
        <Alert className={message.type === "success" ? "bg-green-900/20 border-green-700" : "bg-red-900/20 border-red-700"}>
          {message.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-red-500" />
          )}
          <AlertDescription className={message.type === "success" ? "text-green-200" : "text-red-200"}>
            {message.text}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Newsletter Export Card */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              📬 Newsletter-Liste exportieren
            </CardTitle>
            <CardDescription className="text-slate-400">
              Exportiert alle Newsletter-Abonnenten als CSV-Datei für Email-Versand
            </CardDescription>
          </CardHeader>
          <CardContent>
            <NewsletterExport />
          </CardContent>
        </Card>

        {/* Export Card */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Download className="h-5 w-5" />
              Daten exportieren
            </CardTitle>
            <CardDescription className="text-slate-400">
              Exportiert alle Aktien, Research-Einträge und Transaktionen als JSON-Datei
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleExport}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              Daten exportieren
            </Button>
          </CardContent>
        </Card>

        {/* Import Card */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Daten importieren
            </CardTitle>
            <CardDescription className="text-slate-400">
              Importiert Daten aus einer JSON-Datei (löscht alle bestehenden Daten!)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert className="mb-4 bg-yellow-900/20 border-yellow-700">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <AlertDescription className="text-yellow-200">
                <strong>Warnung:</strong> Import löscht alle bestehenden Daten!
              </AlertDescription>
            </Alert>
            <div className="relative">
              <input
                type="file"
                accept=".json"
                onChange={handleImport}
                disabled={importing}
                className="hidden"
                id="import-file"
              />
              <label htmlFor="import-file">
                <Button
                  asChild
                  disabled={importing}
                  className="w-full bg-orange-600 hover:bg-orange-700 cursor-pointer"
                >
                  <span>{importing ? "Importiere..." : "Datei auswählen & importieren"}</span>
                </Button>
              </label>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Usage Instructions */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Anleitung</CardTitle>
        </CardHeader>
        <CardContent className="text-slate-300 space-y-4">
          <div>
            <h3 className="font-semibold text-white mb-2">Daten von Entwicklung zu Produktion übertragen:</h3>
            <ol className="list-decimal list-inside space-y-2 ml-2">
              <li>In der <strong>Entwicklungsumgebung</strong>: Klicken Sie auf "Daten exportieren"</li>
              <li>Laden Sie die JSON-Datei herunter</li>
              <li>Öffnen Sie die <strong>Produktionsumgebung</strong> (https://portfoliodash-aqvizp6n.manus.space)</li>
              <li>Gehen Sie zum Admin-Tab</li>
              <li>Klicken Sie auf "Datei auswählen & importieren" und wählen Sie die heruntergeladene Datei</li>
              <li>Bestätigen Sie die Warnung</li>
              <li>Die Seite wird automatisch neu geladen</li>
            </ol>
          </div>
          <div className="pt-4 border-t border-slate-700">
            <p className="text-sm text-slate-400">
              <strong>Hinweis:</strong> Der Import-Prozess kann einige Sekunden dauern. Bitte schließen Sie das Fenster nicht während des Imports.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

