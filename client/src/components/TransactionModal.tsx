import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { RealizedGainModal } from "@/components/RealizedGainModal";

interface TransactionModalProps {
  open: boolean;
  onClose: () => void;
  portfolioId: number;
  portfolioStocks: Array<{ ticker: string; companyName: string; shares: number }>;
  onSuccess?: () => void;
}

type TransactionType = "buy" | "sell" | "dividend" | "deposit" | "withdrawal";

export function TransactionModal({ open, onClose, portfolioId, portfolioStocks, onSuccess }: TransactionModalProps) {
  const [transactionType, setTransactionType] = useState<TransactionType>("buy");
  const [ticker, setTicker] = useState("");
  const [shares, setShares] = useState("");
  const [pricePerShare, setPricePerShare] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [fees, setFees] = useState("0");
  const [notes, setNotes] = useState("");
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split('T')[0]);
  
  // State for realized gain modal
  const [showRealizedGainModal, setShowRealizedGainModal] = useState(false);
  const [realizedGainData, setRealizedGainData] = useState<any>(null);

  // Fetch all transactions for this portfolio to calculate current holdings
  const { data: allTransactions = [] } = trpc.portfolioTransactions.list.useQuery(
    { portfolioId },
    { enabled: !!portfolioId }
  );

  // Calculate current holdings for selected ticker
  // Priority: 1) Portfolio data (from optimizer), 2) Transactions
  const currentHoldings = useMemo(() => {
    if (!ticker) {
      return 0;
    }
    
    // First check portfolio data (from optimizer)
    const portfolioStock = portfolioStocks.find(s => s.ticker === ticker);
    if (portfolioStock && portfolioStock.shares > 0) {
      return portfolioStock.shares;
    }
    
    // Fallback to transaction-based calculation
    let totalShares = 0;
    allTransactions.forEach((tx: any) => {
      if (tx.ticker === ticker) {
        const txShares = parseFloat(tx.shares || "0");
        if (tx.transactionType === "buy") {
          totalShares += txShares;
        } else if (tx.transactionType === "sell") {
          totalShares -= txShares;
        }
      }
    });
    
    return totalShares;
  }, [ticker, portfolioStocks, allTransactions]);

  // Fetch current stock price and currency when ticker is selected
  const { data: stockData } = trpc.stocks.getByTicker.useQuery(
    { ticker: ticker || "" },
    { enabled: !!ticker && (transactionType === "buy" || transactionType === "sell") }
  );

  // Auto-fill price when selling
  useEffect(() => {
    if (transactionType === "sell" && stockData?.currentPrice) {
      setPricePerShare(stockData.currentPrice.toString());
    }
  }, [transactionType, stockData]);

  const createTransactionMutation = trpc.portfolioTransactions.create.useMutation({
    onSuccess: (data: any) => {
      // If this was a sell transaction and we have realized gain data, show the modal
      if (transactionType === 'sell' && data.realizedGain) {
        const selectedStock = portfolioStocks.find(s => s.ticker === ticker);
        setRealizedGainData({
          ticker,
          companyName: selectedStock?.companyName,
          ...data.realizedGain
        });
        setShowRealizedGainModal(true);
        onSuccess?.();
        onClose(); // Close transaction modal
      } else {
        toast.success("Transaktion erfolgreich erfasst");
        onSuccess?.();
        onClose();
      }
    },
    onError: (error) => {
      toast.error("Fehler beim Speichern: " + error.message);
    },
  });

  const handleClose = () => {
    // Reset form
    setTransactionType("buy");
    setTicker("");
    setShares("");
    setPricePerShare("");
    setTotalAmount("");
    setFees("0");
    setNotes("");
    setTransactionDate(new Date().toISOString().split('T')[0]);
    onClose();
  };

  const handleSubmit = () => {
    // Validation
    if (transactionType !== "deposit" && transactionType !== "withdrawal" && !ticker) {
      toast.error("Bitte wählen Sie eine Aktie aus");
      return;
    }

    if ((transactionType === "buy" || transactionType === "sell") && (!shares || !pricePerShare)) {
      toast.error("Bitte füllen Sie alle Pflichtfelder aus");
      return;
    }

    if ((transactionType === "deposit" || transactionType === "withdrawal" || transactionType === "dividend") && !totalAmount) {
      toast.error("Bitte geben Sie einen Betrag ein");
      return;
    }

    // Calculate total amount for buy/sell
    let finalTotalAmount = totalAmount;
    if (transactionType === "buy" || transactionType === "sell") {
      const sharesNum = parseFloat(shares);
      const priceNum = parseFloat(pricePerShare);
      const feesNum = parseFloat(fees || "0");
      
      if (isNaN(sharesNum) || isNaN(priceNum)) {
        toast.error("Ungültige Zahlen eingegeben");
        return;
      }
      
      finalTotalAmount = (sharesNum * priceNum + (transactionType === "buy" ? feesNum : -feesNum)).toFixed(2);
    }

    // For withdrawals, make amount negative
    if (transactionType === "withdrawal") {
      finalTotalAmount = (-Math.abs(parseFloat(finalTotalAmount))).toString();
    }

    const transactionData = {
      portfolioId,
      transactionType,
      ticker: ticker || null,
      shares: shares || null,
      pricePerShare: pricePerShare || null,
      totalAmount: finalTotalAmount,
      fees: fees || "0",
      notes: notes || null,
      transactionDate: new Date(transactionDate),
    };

    console.log("[Frontend] Submitting transaction:", transactionData);
    createTransactionMutation.mutate(transactionData);
  };

  const requiresTicker = transactionType === "buy" || transactionType === "sell" || transactionType === "dividend";
  const requiresShares = transactionType === "buy" || transactionType === "sell";
  return (
    <>
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle>Transaktion erfassen</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Transaction Type */}
          <div>
            <Label htmlFor="transactionType">Transaktionstyp</Label>
            <Select value={transactionType} onValueChange={(value) => setTransactionType(value as TransactionType)}>
              <SelectTrigger className="bg-slate-700 border-slate-600">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-700 border-slate-600">
                <SelectItem value="buy">Kauf</SelectItem>
                <SelectItem value="sell">Verkauf</SelectItem>
                <SelectItem value="dividend">Dividende</SelectItem>
                <SelectItem value="deposit">Einzahlung</SelectItem>
                <SelectItem value="withdrawal">Auszahlung</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Ticker Selection */}
          {requiresTicker && (
            <div>
              <Label htmlFor="ticker">Aktie *</Label>
              <Select value={ticker} onValueChange={setTicker}>
                <SelectTrigger className="bg-slate-700 border-slate-600">
                  <SelectValue placeholder="Aktie auswählen..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-700 border-slate-600 max-h-60">
                  {portfolioStocks.map((stock) => (
                    <SelectItem key={stock.ticker} value={stock.ticker}>
                      {stock.ticker} - {stock.companyName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {transactionType === "sell" && ticker && (
                <p className="text-sm text-slate-400 mt-2">
                  Aktueller Bestand: <span className="font-semibold text-white">{currentHoldings.toFixed(2)}</span> Aktien
                  {stockData?.currentPrice && (
                    <span className="ml-3">
                      Aktueller Kurs: <span className="font-semibold text-white">{parseFloat(stockData.currentPrice).toFixed(2)} {stockData.currency || 'CHF'}</span>
                    </span>
                  )}
                </p>
              )}
            </div>
          )}

          {/* Shares */}
          {requiresShares && (
            <div>
              <Label htmlFor="shares">Anzahl Aktien *</Label>
              <Input
                id="shares"
                type="number"
                step="0.01"
                value={shares}
                onChange={(e) => setShares(e.target.value)}
                className="bg-slate-700 border-slate-600"
                placeholder="z.B. 10"
              />
            </div>
          )}

          {/* Price Per Share */}
          {requiresShares && (
            <div>
              <Label htmlFor="pricePerShare">
                Preis pro Aktie ({stockData?.currency || 'CHF'}) *
              </Label>
              <Input
                id="pricePerShare"
                type="number"
                step="0.01"
                value={pricePerShare}
                onChange={(e) => setPricePerShare(e.target.value)}
                className="bg-slate-700 border-slate-600"
                placeholder="z.B. 150.50"
              />
              {stockData?.currency && stockData.currency !== 'CHF' && (
                <p className="text-xs text-amber-400 mt-1">
                  ⚠️ Preis in {stockData.currency} eingeben (wird automatisch in CHF konvertiert)
                </p>
              )}
            </div>
          )}

          {/* Total Amount (for dividend/deposit/withdrawal) */}
          {!requiresShares && (
            <div>
              <Label htmlFor="totalAmount">Betrag (CHF) *</Label>
              <Input
                id="totalAmount"
                type="number"
                step="0.01"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                className="bg-slate-700 border-slate-600"
                placeholder="z.B. 500.00"
              />
            </div>
          )}

          {/* Fees */}
          <div>
            <Label htmlFor="fees">Gebühren (CHF)</Label>
            <Input
              id="fees"
              type="number"
              step="0.01"
              value={fees}
              onChange={(e) => setFees(e.target.value)}
              className="bg-slate-700 border-slate-600"
              placeholder="z.B. 5.00"
            />
          </div>

          {/* Transaction Date */}
          <div>
            <Label htmlFor="transactionDate">Datum</Label>
            <Input
              id="transactionDate"
              type="date"
              value={transactionDate}
              onChange={(e) => setTransactionDate(e.target.value)}
              className="bg-slate-700 border-slate-600"
            />
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Notizen (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="bg-slate-700 border-slate-600"
              placeholder="z.B. Nachkauf wegen günstiger Bewertung"
              rows={2}
            />
          </div>

          {/* Calculated Total (for buy/sell) */}
          {requiresShares && shares && pricePerShare && (
            <div className="bg-slate-700/50 p-3 rounded-md">
              <p className="text-sm text-slate-400">Gesamtbetrag (inkl. Gebühren):</p>
              <p className="text-xl font-bold text-white">
                {stockData?.currency || 'CHF'} {(parseFloat(shares) * parseFloat(pricePerShare) + parseFloat(fees || "0")).toFixed(2)}
              </p>
              {stockData?.currency && stockData.currency !== 'CHF' && (
                <p className="text-xs text-slate-400 mt-1">
                  Wird in CHF konvertiert beim Speichern
                </p>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 justify-end pt-4">
            <Button variant="outline" onClick={handleClose} className="bg-slate-700 hover:bg-slate-600">
              Abbrechen
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={createTransactionMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {createTransactionMutation.isPending ? "Speichern..." : "Speichern"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    
    {/* Realized Gain/Loss Modal */}
    {realizedGainData && (
      <RealizedGainModal
        isOpen={showRealizedGainModal}
        onClose={() => {
          setShowRealizedGainModal(false);
          setRealizedGainData(null);
        }}
        ticker={realizedGainData.ticker}
        companyName={realizedGainData.companyName}
        realizedGain={realizedGainData}
      />
    )}
    </>
  );
}
