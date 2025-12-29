import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileText, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  portfolioId: number;
}

export function CsvImportModal({ isOpen, onClose, portfolioId }: CsvImportModalProps) {
  const [csvData, setCsvData] = useState("");
  const [importResult, setImportResult] = useState<{
    success: number;
    failed: number;
    errors: string[];
  } | null>(null);

  const utils = trpc.useUtils();

  const importMutation = trpc.portfolioTransactions.importFromCsv.useMutation({
    onSuccess: (result) => {
      setImportResult(result);
      if (result.success > 0) {
        toast.success(`${result.success} Transaktionen erfolgreich importiert`);
        utils.portfolioTransactions.list.invalidate();
        utils.portfolios.list.invalidate();
        // utils.portfolios.calculateLivePerformance.invalidate(); // TODO: implement
      }
      if (result.failed > 0) {
        toast.error(`${result.failed} Transaktionen fehlgeschlagen`);
      }
    },
    onError: (error) => {
      toast.error(`Import fehlgeschlagen: ${error.message}`);
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvData(text);
    };
    reader.readAsText(file);
  };

  const handleImport = () => {
    if (!csvData.trim()) {
      toast.error("Bitte CSV-Daten eingeben oder Datei hochladen");
      return;
    }

    setImportResult(null);
    importMutation.mutate({
      portfolioId,
      csvData: csvData.trim(),
    });
  };

  const handleClose = () => {
    setCsvData("");
    setImportResult(null);
    onClose();
  };

  const exampleCsv = `Datum,Ticker,Typ,Anzahl,Preis,Gebühren
15.10.2024,AAPL,Kauf,10,150.50,9.90
20.10.2024,NESN.SW,Kauf,5,85.30,5.00
25.10.2024,AAPL,Verkauf,5,155.00,9.90`;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl bg-slate-800 text-white border-slate-700 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Upload className="w-6 h-6 text-blue-400" />
            Transaktionen aus CSV importieren
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Importieren Sie historische Transaktionen aus einer CSV-Datei
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* CSV Format Info */}
          <Alert className="bg-blue-900/20 border-blue-400/30">
            <FileText className="h-4 w-4 text-blue-400" />
            <AlertDescription className="text-slate-300">
              <strong>CSV-Format:</strong> Datum, Ticker, Typ, Anzahl, Preis, Gebühren (optional)
              <br />
              <strong>Typ:</strong> Kauf, Verkauf, Buy, Sell
              <br />
              <strong>Datum:</strong> DD.MM.YYYY oder YYYY-MM-DD
            </AlertDescription>
          </Alert>

          {/* Example */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Beispiel:</label>
            <pre className="bg-slate-900 p-3 rounded text-xs text-slate-300 overflow-x-auto">
              {exampleCsv}
            </pre>
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">CSV-Datei hochladen:</label>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="block w-full text-sm text-slate-400
                file:mr-4 file:py-2 file:px-4
                file:rounded file:border-0
                file:text-sm file:font-medium
                file:bg-blue-600 file:text-white
                hover:file:bg-blue-700
                file:cursor-pointer cursor-pointer"
            />
          </div>

          {/* Manual Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Oder CSV-Daten manuell eingeben:</label>
            <Textarea
              value={csvData}
              onChange={(e) => setCsvData(e.target.value)}
              placeholder={exampleCsv}
              className="min-h-[200px] bg-slate-900 border-slate-700 text-slate-300 font-mono text-sm"
            />
          </div>

          {/* Import Result */}
          {importResult && (
            <div className="space-y-2">
              <div className="flex items-center gap-4">
                {importResult.success > 0 && (
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="font-medium">{importResult.success} erfolgreich</span>
                  </div>
                )}
                {importResult.failed > 0 && (
                  <div className="flex items-center gap-2 text-red-400">
                    <XCircle className="w-5 h-5" />
                    <span className="font-medium">{importResult.failed} fehlgeschlagen</span>
                  </div>
                )}
              </div>

              {importResult.errors.length > 0 && (
                <Alert className="bg-red-900/20 border-red-400/30">
                  <AlertTriangle className="h-4 w-4 text-red-400" />
                  <AlertDescription className="text-slate-300">
                    <strong>Fehler:</strong>
                    <ul className="mt-2 space-y-1 text-sm">
                      {importResult.errors.map((error, idx) => (
                        <li key={idx} className="text-red-300">• {error}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={handleClose}
            variant="outline"
            className="text-slate-300 border-slate-600 hover:bg-slate-700"
          >
            Schließen
          </Button>
          <Button
            onClick={handleImport}
            disabled={!csvData.trim() || importMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Upload className="w-4 h-4 mr-2" />
            {importMutation.isPending ? "Importiere..." : "Importieren"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
