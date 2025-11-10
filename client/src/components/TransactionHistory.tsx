import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
                      {tx.totalAmountCHF 
                        ? `CHF ${(parseFloat(tx.totalAmountCHF) + parseFloat(tx.fees || '0')).toFixed(2)}`
                        : "-"}
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
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                        onClick={() => handleDeleteTransaction(tx.id)}
                      >
                        Storno
                      </Button>
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
              CHF {filteredTransactions.reduce((sum, tx) => sum + parseFloat(tx.totalAmount), 0).toFixed(2)}
            </span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
