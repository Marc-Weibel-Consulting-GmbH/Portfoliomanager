import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Download, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";

interface TransactionHistoryProps {
  portfolioId: number;
  portfolioName: string;
}

type SortField = "date" | "amount" | "type";
type SortDirection = "asc" | "desc";

export function TransactionHistory({ portfolioId, portfolioName }: TransactionHistoryProps) {
  const [filterType, setFilterType] = useState<string>("all");
  const [filterTicker, setFilterTicker] = useState<string>("");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [editingTransaction, setEditingTransaction] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    transactionType: "" as "buy" | "sell" | "dividend" | "deposit" | "withdrawal" | "",
    date: "",
    shares: "",
    pricePerShare: "",
    totalAmount: "",
    currency: "CHF",
    fees: "",
    notes: ""
  });

  const { data: transactions = [], isLoading } = trpc.portfolioTransactions.list.useQuery({ portfolioId });
  const utils = trpc.useUtils();
  const deleteTransaction = trpc.portfolioTransactions.delete.useMutation({
    onSuccess: () => {
      toast.success("Transaktion storniert");
      utils.portfolioTransactions.list.invalidate({ portfolioId });
      utils.savedPortfolios.get.invalidate({ id: portfolioId });
    },
    onError: (error) => {
      toast.error(`Fehler beim Stornieren: ${error.message}`);
    },
  });

  const updateTransaction = trpc.portfolioTransactions.update.useMutation({
    onSuccess: () => {
      toast.success("Transaktion aktualisiert");
      utils.portfolioTransactions.list.invalidate({ portfolioId });
      utils.savedPortfolios.get.invalidate({ id: portfolioId });
      setEditingTransaction(null);
    },
    onError: (error) => {
      toast.error(`Fehler beim Aktualisieren: ${error.message}`);
    },
  });

  const handleEditTransaction = (tx: any) => {
    setEditingTransaction(tx);
    
    // Convert transactionDate to YYYY-MM-DD format
    let dateStr = "";
    if (tx.transactionDate) {
      if (typeof tx.transactionDate === 'string') {
        dateStr = tx.transactionDate.split('T')[0];
      } else if (tx.transactionDate instanceof Date) {
        dateStr = tx.transactionDate.toISOString().split('T')[0];
      }
    }
    
    setEditForm({
      transactionType: tx.transactionType || "",
      date: dateStr,
      shares: tx.shares?.toString() || "",
      pricePerShare: tx.pricePerShare?.toString() || "",
      totalAmount: tx.totalAmount?.toString() || "",
      currency: tx.currency || "CHF",
      fees: tx.fees?.toString() || "0",
      notes: tx.notes || ""
    });
  };
  
  // Debug logging
  useEffect(() => {
    console.log('[TransactionHistory] Portfolio ID:', portfolioId);
    console.log('[TransactionHistory] Transactions loaded:', transactions);
    console.log('[TransactionHistory] Transaction count:', transactions.length);
  }, [portfolioId, transactions]);

  // Get unique tickers for filter
  const uniqueTickers = useMemo(() => {
    const tickers = new Set<string>();
    transactions.forEach(tx => {
      if (tx.ticker) tickers.add(tx.ticker);
    });
    return Array.from(tickers).sort();
  }, [transactions]);

  // Filter and sort transactions
  const filteredTransactions = useMemo(() => {
    let filtered = [...transactions];

    // Filter by type
    if (filterType !== "all") {
      filtered = filtered.filter(tx => tx.transactionType === filterType);
    }

    // Filter by ticker
    if (filterTicker) {
      filtered = filtered.filter(tx => tx.ticker?.toLowerCase().includes(filterTicker.toLowerCase()));
    }

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case "date":
          comparison = new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime();
          break;
        case "amount":
          comparison = parseFloat(a.totalAmount) - parseFloat(b.totalAmount);
          break;
        case "type":
          comparison = a.transactionType.localeCompare(b.transactionType);
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [transactions, filterType, filterTicker, sortField, sortDirection]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const exportToCSV = () => {
    if (filteredTransactions.length === 0) {
      toast.error("Keine Transaktionen zum Exportieren");
      return;
    }

    // CSV Header
    const headers = ["Datum", "Typ", "Ticker", "Anzahl", "Preis", "Betrag", "Gebühren", "Notizen"];
    const rows = filteredTransactions.map(tx => [
      new Date(tx.transactionDate).toLocaleDateString('de-CH'),
      tx.transactionType,
      tx.ticker || "-",
      tx.shares || "-",
      tx.pricePerShare || "-",
      tx.totalAmount,
      tx.fees || "0",
      tx.notes || "-"
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    // Download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${portfolioName}_transactions_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();

    toast.success("CSV erfolgreich exportiert!");
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "buy": return "Kauf";
      case "sell": return "Verkauf";
      case "dividend": return "Dividende";
      case "deposit": return "Einzahlung";
      case "withdrawal": return "Auszahlung";
      default: return type;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "buy": return "text-blue-400";
      case "sell": return "text-orange-400";
      case "dividend": return "text-green-400";
      case "deposit": return "text-green-400";
      case "withdrawal": return "text-red-400";
      default: return "text-slate-400";
    }
  };

  const handleDeleteTransaction = (transactionId: number) => {
    if (confirm("Möchten Sie diese Transaktion wirklich stornieren? Diese Aktion kann nicht rückgängig gemacht werden.")) {
      deleteTransaction.mutate({ transactionId });
    }
  };

  const handleSaveEdit = () => {
    if (!editingTransaction) return;
    
    // Validate date (required for all types)
    if (!editForm.date) {
      toast.error("Bitte geben Sie ein Datum ein");
      return;
    }
    
    // Validate based on transaction type
    if (editForm.transactionType === 'buy' || editForm.transactionType === 'sell') {
      // Buy/Sell: validate shares and price
      if (!editForm.shares || !editForm.pricePerShare) {
        toast.error("Bitte füllen Sie Anzahl und Preis aus");
        return;
      }
      
      const shares = parseFloat(editForm.shares);
      const price = parseFloat(editForm.pricePerShare);
      
      if (isNaN(shares) || shares <= 0) {
        toast.error("Ungültige Anzahl Aktien");
        return;
      }
      
      if (isNaN(price) || price <= 0) {
        toast.error("Ungültiger Preis");
        return;
      }
      
      updateTransaction.mutate({
        transactionId: editingTransaction.id,
        transactionDate: editForm.date,
        shares: editForm.shares,
        pricePerShare: editForm.pricePerShare,
        currency: editForm.currency,
        fees: editForm.fees,
        notes: editForm.notes
      });
    } else if (editForm.transactionType === 'deposit' || editForm.transactionType === 'withdrawal' || editForm.transactionType === 'dividend') {
      // Deposit/Withdrawal/Dividend: validate amount
      if (!editForm.totalAmount) {
        toast.error("Bitte geben Sie einen Betrag ein");
        return;
      }
      
      const amount = parseFloat(editForm.totalAmount);
      
      if (isNaN(amount) || amount <= 0) {
        toast.error("Ungültiger Betrag");
        return;
      }
      
      updateTransaction.mutate({
        transactionId: editingTransaction.id,
        transactionDate: editForm.date,
        totalAmount: editForm.totalAmount,
        currency: editForm.currency,
        notes: editForm.notes
      });
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-slate-800 border-slate-700">
        <CardContent className="p-8 text-center text-slate-400">
          Lade Transaktionen...
        </CardContent>
      </Card>
    );
  }

  return (
    <>
    <Card className="bg-slate-800 border-slate-700">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="text-white">Transaktionshistorie</CardTitle>
          <Button
            onClick={exportToCSV}
            variant="outline"
            size="sm"
            className="bg-slate-700 hover:bg-slate-600"
            disabled={filteredTransactions.length === 0}
          >
            <Download className="w-4 h-4 mr-2" />
            CSV Export
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex gap-4 mb-6">
          <div className="flex-1">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="bg-slate-700 border-slate-600">
                <SelectValue placeholder="Alle Typen" />
              </SelectTrigger>
              <SelectContent className="bg-slate-700 border-slate-600">
                <SelectItem value="all">Alle Typen</SelectItem>
                <SelectItem value="buy">Kauf</SelectItem>
                <SelectItem value="sell">Verkauf</SelectItem>
                <SelectItem value="dividend">Dividende</SelectItem>
                <SelectItem value="deposit">Einzahlung</SelectItem>
                <SelectItem value="withdrawal">Auszahlung</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <Input
              placeholder="Ticker suchen..."
              value={filterTicker}
              onChange={(e) => setFilterTicker(e.target.value)}
              className="bg-slate-700 border-slate-600"
            />
          </div>
        </div>

        {/* Transaction Table */}
        {filteredTransactions.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            Keine Transaktionen gefunden
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-3 px-2 text-slate-400 font-medium">
                    <button
                      onClick={() => toggleSort("date")}
                      className="flex items-center gap-1 hover:text-white transition-colors"
                    >
                      Datum
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="text-left py-3 px-2 text-slate-400 font-medium">
                    <button
                      onClick={() => toggleSort("type")}
                      className="flex items-center gap-1 hover:text-white transition-colors"
                    >
                      Typ
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="text-left py-3 px-2 text-slate-400 font-medium">Ticker</th>
                  <th className="text-right py-3 px-2 text-slate-400 font-medium">Anzahl</th>
                  <th className="text-right py-3 px-2 text-slate-400 font-medium">Preis</th>
                  <th className="text-right py-3 px-2 text-slate-400 font-medium">Betrag (FW)</th>
                  <th className="text-center py-3 px-2 text-slate-400 font-medium">FX Rate</th>
                  <th className="text-right py-3 px-2 text-slate-400 font-medium">Betrag (CHF)</th>
                  <th className="text-right py-3 px-2 text-slate-400 font-medium">Real. Gewinn</th>
                  <th className="text-right py-3 px-2 text-slate-400 font-medium">Gebühren</th>
                  <th className="text-right py-3 px-2 text-slate-400 font-medium">
                    <button
                      onClick={() => toggleSort("amount")}
                      className="flex items-center gap-1 hover:text-white transition-colors ml-auto">
                      Netto (CHF)
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="text-left py-3 px-2 text-slate-400 font-medium">Notizen</th>
                  <th className="text-center py-3 px-2 text-slate-400 font-medium">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                    <td className="py-3 px-2 text-slate-300 text-sm">
                      {new Date(tx.transactionDate).toLocaleDateString('de-CH', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                      })}
                    </td>
                    <td className={`py-3 px-2 text-sm font-medium ${getTypeColor(tx.transactionType)}`}>
                      {getTypeLabel(tx.transactionType)}
                    </td>
                    <td className="py-3 px-2 text-slate-300 text-sm font-mono">
                      {tx.ticker || "-"}
                    </td>
                    <td className="py-3 px-2 text-slate-300 text-sm text-right">
                      {tx.shares || "-"}
                    </td>
                    <td className="py-3 px-2 text-slate-300 text-sm text-right">
                      {tx.pricePerShare ? `${tx.currency || 'CHF'} ${parseFloat(tx.pricePerShare).toFixed(2)}` : "-"}
                    </td>
                    {/* Betrag in Fremdwährung */}
                    <td className="py-3 px-2 text-slate-300 text-sm text-right">
                      {(tx.transactionType === 'buy' || tx.transactionType === 'sell') && tx.totalAmount && tx.currency
                        ? `${tx.currency} ${parseFloat(tx.totalAmount).toFixed(2)}`
                        : "-"}
                    </td>
                    {/* FX Rate */}
                    <td className="py-3 px-2 text-slate-400 text-sm text-center">
                      {tx.fxRate && tx.currency !== 'CHF' ? parseFloat(tx.fxRate).toFixed(4) : '-'}
                    </td>
                    {/* Betrag in CHF (vor Gebühren) */}
                    <td className="py-3 px-2 text-slate-300 text-sm text-right">
                      {(() => {
                        // If totalAmountCHF exists, use it
                        if (tx.totalAmountCHF) {
                          return `CHF ${(parseFloat(tx.totalAmountCHF) + parseFloat(tx.fees || '0')).toFixed(2)}`;
                        }
                        // Otherwise, calculate from totalAmount and fxRate
                        if (tx.totalAmount && tx.fxRate) {
                          const amountCHF = parseFloat(tx.totalAmount) * parseFloat(tx.fxRate) + parseFloat(tx.fees || '0');
                          return `CHF ${amountCHF.toFixed(2)}`;
                        }
                        // If currency is CHF, use totalAmount directly
                        if (tx.totalAmount && tx.currency === 'CHF') {
                          return `CHF ${(parseFloat(tx.totalAmount) + parseFloat(tx.fees || '0')).toFixed(2)}`;
                        }
                        return "-";
                      })()}
                    </td>
                    {/* Realisierter Gewinn (nur bei Verkauf) */}
                    <td className="py-3 px-2 text-sm text-right">
                      {tx.transactionType === 'sell' && tx.realizedGain
                        ? <span className={parseFloat(tx.realizedGain) >= 0 ? 'text-green-400 font-semibold' : 'text-red-400 font-semibold'}>
                            {parseFloat(tx.realizedGain) >= 0 ? '+' : ''}CHF {parseFloat(tx.realizedGain).toFixed(2)}
                          </span>
                        : <span className="text-slate-500">-</span>}
                    </td>
                    {/* Gebühren */}
                    <td className="py-3 px-2 text-red-400 text-sm text-right">
                      {tx.fees && parseFloat(tx.fees) > 0 ? `-CHF ${parseFloat(tx.fees).toFixed(2)}` : '-'}
                    </td>
                    {/* Nettobetrag in CHF */}
                    <td className={`py-3 px-2 text-sm text-right font-semibold ${
                      parseFloat(tx.totalAmountCHF || tx.totalAmount) >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      CHF {parseFloat(tx.totalAmountCHF || tx.totalAmount).toFixed(2)}
                    </td>
                    {/* Notizen */}
                    <td className="py-3 px-2 text-slate-400 text-sm truncate max-w-xs">
                      {tx.notes || "-"}
                    </td>
                    <td className="py-3 px-2 text-center">
                      <div className="flex gap-2 justify-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/20"
                          onClick={() => handleEditTransaction(tx)}
                        >
                          Bearbeiten
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                          onClick={() => handleDeleteTransaction(tx.id)}
                        >
                          Storno
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Summary */}
        <div className="mt-6 pt-4 border-t border-slate-700 flex justify-between items-center">
          <p className="text-slate-400 text-sm">
            {filteredTransactions.length} Transaktion{filteredTransactions.length !== 1 ? 'en' : ''}
            {filterType !== "all" || filterTicker ? " (gefiltert)" : ""}
          </p>
          <p className="text-slate-300 text-sm">
            Gesamt: <span className="font-semibold text-white">
              CHF {filteredTransactions.reduce((sum, tx) => sum + parseFloat(tx.totalAmountCHF || tx.totalAmount || '0'), 0).toFixed(2)}
            </span>
          </p>
        </div>
      </CardContent>
    </Card>

    {/* Edit Transaction Dialog */}
    <Dialog open={!!editingTransaction} onOpenChange={() => setEditingTransaction(null)}>
      <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md">
        <DialogHeader>
          <DialogTitle>Transaktion bearbeiten</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          {/* Transaction Type (read-only) */}
          <div>
            <Label>Typ</Label>
            <Input
              type="text"
              value={getTypeLabel(editForm.transactionType)}
              disabled
              className="bg-slate-700 border-slate-600 text-slate-400"
            />
          </div>

          {/* Date (all types) */}
          <div>
            <Label>Datum</Label>
            <Input
              type="date"
              value={editForm.date}
              onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
              className="bg-slate-700 border-slate-600 text-white"
            />
          </div>

          {/* Buy/Sell specific fields */}
          {(editForm.transactionType === 'buy' || editForm.transactionType === 'sell') && (
            <>
              <div>
                <Label>Anzahl Aktien</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editForm.shares}
                  onChange={(e) => setEditForm({ ...editForm, shares: e.target.value })}
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
              <div>
                <Label>Preis pro Aktie</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editForm.pricePerShare}
                  onChange={(e) => setEditForm({ ...editForm, pricePerShare: e.target.value })}
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
            </>
          )}

          {/* Deposit/Withdrawal/Dividend specific fields */}
          {(editForm.transactionType === 'deposit' || editForm.transactionType === 'withdrawal' || editForm.transactionType === 'dividend') && (
            <div>
              <Label>Betrag</Label>
              <Input
                type="number"
                step="0.01"
                value={editForm.totalAmount}
                onChange={(e) => setEditForm({ ...editForm, totalAmount: e.target.value })}
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>
          )}

          {/* Currency (all types) */}
          <div>
            <Label>Währung</Label>
            <Select value={editForm.currency} onValueChange={(value) => setEditForm({ ...editForm, currency: value })}>
              <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="CHF">CHF</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
                <SelectItem value="GBP">GBP</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Fees (only for buy/sell) */}
          {(editForm.transactionType === 'buy' || editForm.transactionType === 'sell') && (
            <div>
              <Label>Gebühren (CHF)</Label>
              <Input
                type="number"
                step="0.01"
                value={editForm.fees}
                onChange={(e) => setEditForm({ ...editForm, fees: e.target.value })}
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>
          )}

          {/* Notes (all types) */}
          <div>
            <Label>Notizen</Label>
            <Input
              type="text"
              value={editForm.notes}
              onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
              className="bg-slate-700 border-slate-600 text-white"
              placeholder="Optional"
            />
          </div>
          <div className="flex gap-2 justify-end mt-6">
            <Button
              variant="outline"
              onClick={() => setEditingTransaction(null)}
              className="border-slate-600 text-white hover:bg-slate-700"
            >
              Abbrechen
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={updateTransaction.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {updateTransaction.isPending ? "Speichern..." : "Speichern"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
