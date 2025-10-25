import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Upload, FileSpreadsheet, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

interface ImportProps {
  onBackClick: () => void;
}

interface ImportResult {
  ticker: string;
  companyName: string;
  status: "success" | "error" | "not_found";
  message: string;
  oldPrice?: string;
  newPrice?: string;
}

export default function Import({ onBackClick }: ImportProps) {
  const { isAuthenticated } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [importType, setImportType] = useState<"ytd" | "current">("ytd");

  const importPricesMutation = trpc.stocks.importPrices.useMutation({
    onSuccess: (data: any) => {
      setImportResults(data.results || []);
      setIsProcessing(false);
      toast.success("Import abgeschlossen", {
        description: `${data.successCount} von ${data.totalCount} Preisen erfolgreich importiert`,
      });
    },
    onError: (error: any) => {
      setIsProcessing(false);
      toast.error("Import fehlgeschlagen", {
        description: error.message,
      });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv')) {
        setSelectedFile(file);
        setImportResults([]);
      } else {
        toast.error("Ungültiges Dateiformat", {
          description: "Bitte wählen Sie eine Excel- oder CSV-Datei",
        });
      }
    }
  };

  const handleImport = async () => {
    if (!selectedFile) {
      toast.error("Keine Datei ausgewählt");
      return;
    }

    setIsProcessing(true);
    setImportResults([]);

    try {
      // Read file as base64
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        importPricesMutation.mutate({
          fileData: base64,
          fileName: selectedFile.name,
          importType,
        } as any);
      };
      reader.readAsDataURL(selectedFile);
    } catch (error: any) {
      setIsProcessing(false);
      toast.error("Fehler beim Lesen der Datei", {
        description: error.message,
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">Excel Import</h1>
            <p className="text-slate-300">Aktienkurse aus Excel-Dateien importieren</p>
          </div>
          <Button onClick={onBackClick} variant="outline" className="bg-slate-800 border-slate-700 text-white hover:bg-slate-700">
            Zurück
          </Button>
        </div>

        {!isAuthenticated && (
          <Card className="bg-slate-800 border-slate-700 mb-6">
            <CardContent className="p-8 text-center">
              <AlertCircle className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
              <p className="text-slate-300">Sie müssen angemeldet sein, um Daten zu importieren.</p>
            </CardContent>
          </Card>
        )}

        {isAuthenticated && (
          <>
            <Card className="bg-slate-800 border-slate-700 mb-6">
              <CardHeader>
                <CardTitle className="text-white">Datei hochladen</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="bg-slate-700 border border-slate-600 rounded p-4">
                    <h3 className="text-white font-semibold mb-2">Format-Anforderungen:</h3>
                    <ul className="text-slate-300 text-sm space-y-1 list-disc list-inside">
                      <li>Excel-Datei (.xlsx, .xls) oder CSV-Datei</li>
                      <li>Spalte "Ticker" oder "Symbol" mit Ticker-Symbolen</li>
                      <li>Spalte "Price" oder "Kurs" mit Kurswerten</li>
                      <li>Optional: Spalte "Company" oder "Firma" mit Firmennamen</li>
                    </ul>
                  </div>

                  <div className="flex gap-4 items-center">
                    <label className="flex gap-2 items-center">
                      <input
                        type="radio"
                        name="importType"
                        value="ytd"
                        checked={importType === "ytd"}
                        onChange={(e) => setImportType(e.target.value as "ytd" | "current")}
                        className="w-4 h-4"
                      />
                      <span className="text-white">YTD Start-Preise (31.12.2024)</span>
                    </label>
                    <label className="flex gap-2 items-center">
                      <input
                        type="radio"
                        name="importType"
                        value="current"
                        checked={importType === "current"}
                        onChange={(e) => setImportType(e.target.value as "ytd" | "current")}
                        className="w-4 h-4"
                      />
                      <span className="text-white">Aktuelle Kurse</span>
                    </label>
                  </div>

                  <div className="flex gap-4 items-center">
                    <label className="flex-1 cursor-pointer">
                      <div className="flex items-center gap-2 px-4 py-3 bg-slate-700 border border-slate-600 rounded hover:bg-slate-600 transition-colors">
                        <FileSpreadsheet className="w-5 h-5" />
                        <span className="text-sm">
                          {selectedFile ? selectedFile.name : "Excel- oder CSV-Datei auswählen"}
                        </span>
                      </div>
                      <input
                        type="file"
                        onChange={handleFileChange}
                        className="hidden"
                        accept=".xlsx,.xls,.csv"
                      />
                    </label>
                    <Button 
                      onClick={handleImport} 
                      disabled={!selectedFile || isProcessing}
                      className="bg-teal-600 hover:bg-teal-700 disabled:opacity-50"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {isProcessing ? "Importiere..." : "Importieren"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {importResults.length > 0 && (
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">Import-Ergebnisse</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {importResults.map((result, index) => (
                      <div
                        key={index}
                        className={`flex items-center justify-between p-3 rounded ${
                          result.status === "success"
                            ? "bg-green-900/20 border border-green-700"
                            : result.status === "not_found"
                            ? "bg-yellow-900/20 border border-yellow-700"
                            : "bg-red-900/20 border border-red-700"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {result.status === "success" && <CheckCircle className="w-5 h-5 text-green-400" />}
                          {result.status === "not_found" && <AlertCircle className="w-5 h-5 text-yellow-400" />}
                          {result.status === "error" && <XCircle className="w-5 h-5 text-red-400" />}
                          <div>
                            <div className="text-white font-semibold">
                              {result.ticker} {result.companyName && `- ${result.companyName}`}
                            </div>
                            <div className="text-sm text-slate-300">{result.message}</div>
                          </div>
                        </div>
                        {result.oldPrice && result.newPrice && (
                          <div className="text-sm text-slate-400">
                            {result.oldPrice} → {result.newPrice}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}

