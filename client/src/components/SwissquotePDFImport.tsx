/**
 * SwissquotePDFImport Component
 * Allows users to upload Swissquote PDF statements and import transactions
 */

import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Upload,
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  ArrowRight,
  Info,
} from "lucide-react";

interface ParsedTransaction {
  type: string;
  date: string | null;
  ticker: string | null;
  isin: string | null;
  securityName: string | null;
  shares: number | null;
  pricePerShare: number | null;
  priceCurrency: string | null;
  totalAmount: number;
  totalCurrency: string;
  fxRate: number | null;
  fxCurrencyFrom: string | null;
  fxCurrencyTo: string | null;
  fees: number;
  taxes: number;
  rawText: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  warnings: string[];
}

interface Props {
  portfolioId: number;
  portfolioName: string;
  onImportComplete?: (count: number) => void;
}

const TYPE_LABELS: Record<string, string> = {
  BUY: "Kauf",
  SELL: "Verkauf",
  DIVIDEND: "Dividende",
  DEPOSIT: "Einzahlung",
  WITHDRAWAL: "Auszahlung",
  FEE: "Gebühr",
  INTEREST: "Zinsen",
  UNKNOWN: "Unbekannt",
};

const TYPE_COLORS: Record<string, string> = {
  BUY: "bg-green-500/20 text-green-400 border-green-500/30",
  SELL: "bg-red-500/20 text-red-400 border-red-500/30",
  DIVIDEND: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  DEPOSIT: "bg-teal-500/20 text-teal-400 border-teal-500/30",
  WITHDRAWAL: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  FEE: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  INTEREST: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  UNKNOWN: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

const CONFIDENCE_COLORS: Record<string, string> = {
  HIGH: "text-green-400",
  MEDIUM: "text-yellow-400",
  LOW: "text-red-400",
};

export function SwissquotePDFImport({ portfolioId, portfolioName, onImportComplete }: Props) {
  const [step, setStep] = useState<"upload" | "review" | "done">("upload");
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedTransactions, setParsedTransactions] = useState<ParsedTransaction[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [pageCount, setPageCount] = useState(0);

  const parseMutation = trpc.pdfImport.parseSwissquote.useMutation({
    onSuccess: (data) => {
      // Cast to our local type since tRPC infers optional fields from the parser
      const txs = data.transactions as unknown as ParsedTransaction[];
      setParsedTransactions(txs);
      setParseErrors(data.parseErrors);
      setPageCount(data.pageCount);
      // Pre-select all HIGH confidence transactions
      const preSelected = new Set<number>();
      txs.forEach((tx: ParsedTransaction, i: number) => {
        if (tx.confidence === "HIGH" && tx.type !== "UNKNOWN") {
          preSelected.add(i);
        }
      });
      setSelectedIndices(preSelected);
      setStep("review");
    },
    onError: (err) => {
      toast.error("PDF-Parsing fehlgeschlagen", { description: err.message });
    },
  });

  const importMutation = trpc.pdfImport.importTransactions.useMutation({
    onSuccess: (data) => {
      if (data.errorCount > 0) {
        toast.warning(`${data.importedCount} Transaktionen importiert`, {
          description: `${data.errorCount} Fehler: ${data.errors[0]}`,
        });
      } else {
        toast.success(`${data.importedCount} Transaktionen erfolgreich importiert`);
      }
      setStep("done");
      onImportComplete?.(data.importedCount);
    },
    onError: (err) => {
      toast.error("Import fehlgeschlagen", { description: err.message });
    },
  });

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        toast.error("Nur PDF-Dateien werden unterstützt");
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        toast.error("Datei zu gross (max. 20 MB)");
        return;
      }
      setFileName(file.name);
      // Read as base64
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = (e.target?.result as string).split(",")[1];
        parseMutation.mutate({ pdfBase64: base64, fileName: file.name });
      };
      reader.readAsDataURL(file);
    },
    [parseMutation]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleImport = () => {
    const toImport = parsedTransactions
      .filter((_, i) => selectedIndices.has(i))
      .map((tx) => ({
        type: tx.type.toLowerCase() as any,
        date: tx.date!,
        ticker: tx.ticker,
        isin: tx.isin,
        securityName: tx.securityName,
        shares: tx.shares,
        pricePerShare: tx.pricePerShare,
        priceCurrency: tx.priceCurrency,
        totalAmount: tx.totalAmount,
        totalCurrency: tx.totalCurrency,
        fxRate: tx.fxRate,
        fees: tx.fees,
        taxes: tx.taxes,
      }));

    if (toImport.length === 0) {
      toast.error("Keine Transaktionen ausgewählt");
      return;
    }

    importMutation.mutate({ portfolioId, transactions: toImport });
  };

  const toggleSelect = (i: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIndices(new Set(parsedTransactions.map((_, i) => i)));
  };

  const deselectAll = () => setSelectedIndices(new Set());

  // Zentrale Formatierung (lib/format, D-06)
  const formatAmount = (amount: number, currency: string) => formatCurrency(amount, currency);

  // ── Upload Step ──────────────────────────────────────────────────────────
  if (step === "upload") {
    return (
      <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <FileText className="h-5 w-5 text-[#00CFC1]" />
            Swissquote PDF importieren
          </CardTitle>
          <CardDescription className="text-gray-400">
            Laden Sie Ihre Swissquote Transaktionsbestätigung als PDF hoch. Kauf, Verkauf,
            Dividenden und Einzahlungen werden automatisch erkannt.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer ${
              isDragging
                ? "border-[#00CFC1] bg-[#00CFC1]/10"
                : "border-white/20 hover:border-[#00CFC1]/50 hover:bg-white/5"
            }`}
            onClick={() => document.getElementById("pdf-upload-input")?.click()}
          >
            <input
              id="pdf-upload-input"
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
            {parseMutation.isPending ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-10 w-10 text-[#00CFC1] animate-spin" />
                <p className="text-white font-medium">PDF wird analysiert…</p>
                <p className="text-gray-400 text-sm">{fileName}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <Upload className="h-10 w-10 text-gray-400" />
                <p className="text-white font-medium">PDF hier ablegen oder klicken</p>
                <p className="text-gray-400 text-sm">Swissquote Transaktionsbestätigungen (max. 20 MB)</p>
              </div>
            )}
          </div>

          <div className="mt-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 flex gap-2">
            <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
            <p className="text-blue-300 text-sm">
              Unterstützt: Kauf/Verkauf (DE + EN), Dividenden, Einzahlungen, Auszahlungen.
              Transaktionen werden vor dem Import zur Überprüfung angezeigt.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Done Step ────────────────────────────────────────────────────────────
  if (step === "done") {
    return (
      <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30">
        <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4">
          <CheckCircle className="h-12 w-12 text-green-400" />
          <h3 className="text-white text-xl font-semibold">Import abgeschlossen</h3>
          <p className="text-gray-400 text-sm">
            Die Transaktionen wurden in <span className="text-white">{portfolioName}</span> importiert.
          </p>
          <Button
            variant="outline"
            className="border-white/20 text-white hover:bg-white/10"
            onClick={() => {
              setStep("upload");
              setFileName(null);
              setParsedTransactions([]);
              setParseErrors([]);
              setSelectedIndices(new Set());
            }}
          >
            Weiteres PDF importieren
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ── Review Step ──────────────────────────────────────────────────────────
  const validTransactions = parsedTransactions.filter((tx) => tx.type !== "UNKNOWN" && tx.date);
  const invalidTransactions = parsedTransactions.filter((tx) => tx.type === "UNKNOWN" || !tx.date);

  return (
    <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-white flex items-center gap-2">
              <FileText className="h-5 w-5 text-[#00CFC1]" />
              Transaktionen überprüfen
            </CardTitle>
            <CardDescription className="text-gray-400 mt-1">
              {fileName} · {pageCount} Seite{pageCount !== 1 ? "n" : ""} ·{" "}
              {parsedTransactions.length} Transaktionen erkannt
            </CardDescription>
          </div>
          <button
            onClick={() => setStep("upload")}
            className="text-gray-400 hover:text-white text-sm underline"
          >
            Andere Datei
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Parse errors */}
        {parseErrors.length > 0 && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <p className="text-red-400 text-sm font-medium mb-1">Parse-Warnungen:</p>
            {parseErrors.map((e, i) => (
              <p key={i} className="text-red-300 text-xs">{e}</p>
            ))}
          </div>
        )}

        {/* Select all / none */}
        <div className="flex items-center justify-between">
          <div className="flex gap-3">
            <button onClick={selectAll} className="text-[#00CFC1] text-sm hover:underline">
              Alle auswählen
            </button>
            <button onClick={deselectAll} className="text-gray-400 text-sm hover:underline">
              Keine
            </button>
          </div>
          <span className="text-gray-400 text-sm">
            {selectedIndices.size} von {validTransactions.length} ausgewählt
          </span>
        </div>

        {/* Transaction list */}
        <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
          {parsedTransactions.map((tx, i) => {
            const isSelected = selectedIndices.has(i);
            const isExpanded = expandedIndex === i;
            const isInvalid = tx.type === "UNKNOWN" || !tx.date;

            return (
              <div
                key={i}
                className={`rounded-lg border transition-all ${
                  isInvalid
                    ? "border-red-500/20 bg-red-500/5 opacity-60"
                    : isSelected
                    ? "border-[#00CFC1]/40 bg-[#00CFC1]/5"
                    : "border-white/10 bg-white/5"
                }`}
              >
                <div className="flex items-center gap-3 p-3">
                  {!isInvalid && (
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelect(i)}
                      className="border-white/30 data-[state=checked]:bg-[#00CFC1] data-[state=checked]:border-[#00CFC1]"
                    />
                  )}
                  {isInvalid && <XCircle className="h-4 w-4 text-red-400 shrink-0" />}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant="outline"
                        className={`text-xs ${TYPE_COLORS[tx.type] || TYPE_COLORS.UNKNOWN}`}
                      >
                        {TYPE_LABELS[tx.type] || tx.type}
                      </Badge>
                      {tx.date && (
                        <span className="text-gray-400 text-xs">{tx.date}</span>
                      )}
                      {tx.securityName && (
                        <span className="text-white text-sm font-medium truncate max-w-[200px]">
                          {tx.securityName}
                        </span>
                      )}
                      {tx.isin && (
                        <span className="text-gray-500 text-xs font-mono">{tx.isin}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      {tx.shares && (
                        <span className="text-gray-400 text-xs">
                          {tx.shares.toLocaleString("de-CH")} Stk.
                        </span>
                      )}
                      {tx.pricePerShare && tx.priceCurrency && (
                        <span className="text-gray-400 text-xs">
                          @ {formatAmount(tx.pricePerShare, tx.priceCurrency)}
                        </span>
                      )}
                      {tx.warnings.length > 0 && (
                        <span className={`text-xs ${CONFIDENCE_COLORS[tx.confidence]}`}>
                          ⚠ {tx.warnings[0]}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-white font-semibold text-sm">
                      {formatAmount(tx.totalAmount, tx.totalCurrency)}
                    </p>
                    {tx.fees > 0 && (
                      <p className="text-gray-400 text-xs">
                        Gebühren: {formatAmount(tx.fees, tx.totalCurrency)}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => setExpandedIndex(isExpanded ? null : i)}
                    className="text-gray-400 hover:text-white p-1"
                  >
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                </div>

                {/* Expanded raw text */}
                {isExpanded && (
                  <div className="px-3 pb-3 border-t border-white/10 pt-2">
                    <p className="text-gray-500 text-xs font-mono whitespace-pre-wrap leading-relaxed">
                      {tx.rawText.slice(0, 600)}
                      {tx.rawText.length > 600 ? "…" : ""}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Invalid transactions summary */}
        {invalidTransactions.length > 0 && (
          <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex gap-2">
            <AlertCircle className="h-4 w-4 text-yellow-400 shrink-0 mt-0.5" />
            <p className="text-yellow-300 text-sm">
              {invalidTransactions.length} Transaktion
              {invalidTransactions.length !== 1 ? "en" : ""} konnten nicht vollständig erkannt
              werden und werden nicht importiert.
            </p>
          </div>
        )}

        {/* Import button */}
        <div className="flex justify-end gap-3 pt-2">
          <Button
            variant="outline"
            className="border-white/20 text-white hover:bg-white/10"
            onClick={() => setStep("upload")}
          >
            Abbrechen
          </Button>
          <Button
            onClick={handleImport}
            disabled={selectedIndices.size === 0 || importMutation.isPending}
            className="bg-[#00CFC1] hover:bg-[#00b8ad] text-black font-semibold"
          >
            {importMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importiere…
              </>
            ) : (
              <>
                <ArrowRight className="h-4 w-4 mr-2" />
                {selectedIndices.size} Transaktion
                {selectedIndices.size !== 1 ? "en" : ""} importieren
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}