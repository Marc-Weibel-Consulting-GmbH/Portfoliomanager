import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { StockLogo } from "@/components/StockLogo";
import { Calendar, DollarSign, Hash, FileText } from "lucide-react";

interface EditPositionModalProps {
  open: boolean;
  onClose: () => void;
  portfolioId: number;
  position: {
    ticker: string;
    name: string;
    shares: number;
    avgBuyPrice?: number;
    currency?: string;
    totalInvestedCHF?: number;
  } | null;
  transactions: Array<{
    id?: number;
    ticker?: string;
    transactionType?: string;
    shares?: string;
    pricePerShare?: string;
    currency?: string;
    transactionDate?: string | Date;
    notes?: string;
  }>;
  onSuccess?: () => void;
}

export function EditPositionModal({ 
  open, 
  onClose, 
  portfolioId, 
  position, 
  transactions,
  onSuccess 
}: EditPositionModalProps) {
  const [editingTxId, setEditingTxId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({
    transactionDate: "",
    shares: "",
    pricePerShare: "",
    notes: ""
  });

  const utils = trpc.useUtils();

  const updateTransaction = trpc.portfolioTransactions.update.useMutation({
    onSuccess: () => {
      toast.success("Transaktion aktualisiert");
      utils.portfolioTransactions.list.invalidate({ portfolioId });
      utils.portfolios.list.invalidate();
      utils.portfolios.getHoldingsWithChfPerformance.invalidate({ id: portfolioId });
      setEditingTxId(null);
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(`Fehler beim Aktualisieren: ${error.message}`);
    },
  });

  const deleteTransaction = trpc.portfolioTransactions.delete.useMutation({
    onSuccess: () => {
      toast.success("Transaktion gelöscht");
      utils.portfolioTransactions.list.invalidate({ portfolioId });
      utils.portfolios.list.invalidate();
      utils.portfolios.getHoldingsWithChfPerformance.invalidate({ id: portfolioId });
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(`Fehler beim Löschen: ${error.message}`);
    },
  });

  // Filter transactions for this position
  const positionTransactions = transactions.filter(
    tx => tx.ticker === position?.ticker && (tx.transactionType === 'buy' || tx.transactionType === 'sell')
  );

  const handleEditTx = (tx: any) => {
    setEditingTxId(tx.id);
    const dateStr = typeof tx.transactionDate === 'string' 
      ? tx.transactionDate.split('T')[0] 
      : new Date(tx.transactionDate).toISOString().split('T')[0];
    
    setEditForm({
      transactionDate: dateStr,
      shares: tx.shares?.toString() || "",
      pricePerShare: tx.pricePerShare?.toString() || "",
      notes: tx.notes || ""
    });
  };

  const handleSaveEdit = () => {
    if (!editingTxId) return;

    if (!editForm.transactionDate || !editForm.shares || !editForm.pricePerShare) {
      toast.error("Bitte füllen Sie alle Pflichtfelder aus");
      return;
    }

    const shares = parseFloat(editForm.shares);
    const price = parseFloat(editForm.pricePerShare);

    if (isNaN(shares) || shares <= 0) {
      toast.error("Ungültige Anzahl");
      return;
    }

    if (isNaN(price) || price <= 0) {
      toast.error("Ungültiger Preis");
      return;
    }

    updateTransaction.mutate({
      transactionId: editingTxId,
      transactionDate: editForm.transactionDate,
      shares: editForm.shares,
      pricePerShare: editForm.pricePerShare,
      notes: editForm.notes
    });
  };

  const handleDeleteTx = (txId: number) => {
    if (confirm("Möchten Sie diese Transaktion wirklich löschen?")) {
      deleteTransaction.mutate({ transactionId: txId });
    }
  };

  const formatDate = (date: string | Date) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('de-CH');
  };

  if (!position) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <StockLogo ticker={position.ticker} companyName={position.name} size="sm" />
            <div>
              <span className="text-white">{position.ticker}</span>
              <span className="text-muted-foreground ml-2 text-sm font-normal">{position.name}</span>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Position Summary */}
        <div className="grid grid-cols-3 gap-4 p-4 bg-slate-700/50 rounded-lg mb-4">
          <div>
            <p className="text-xs text-muted-foreground">Stückzahl</p>
            <p className="text-lg font-semibold text-white">{position.shares.toLocaleString('de-CH')}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Ø Einstandskurs</p>
            <p className="text-lg font-semibold text-blue-400">
              {position.avgBuyPrice 
                ? `${position.currency || 'CHF'} ${position.avgBuyPrice.toFixed(2)}`
                : '-'
              }
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Investiert (CHF)</p>
            <p className="text-lg font-semibold text-green-400">
              {position.totalInvestedCHF 
                ? `CHF ${Math.round(position.totalInvestedCHF).toLocaleString('de-CH')}`
                : '-'
              }
            </p>
          </div>
        </div>

        {/* Transactions List */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">Transaktionen bearbeiten</h3>
          
          {positionTransactions.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4 text-center bg-slate-700/30 rounded-lg">
              Keine Transaktionen für diese Position gefunden
            </p>
          ) : (
            positionTransactions.map((tx) => (
              <div 
                key={tx.id} 
                className={`p-4 rounded-lg border ${
                  editingTxId === tx.id 
                    ? 'border-cyan-500 bg-slate-700' 
                    : 'border-slate-600 bg-slate-700/50'
                }`}
              >
                {editingTxId === tx.id ? (
                  /* Edit Form */
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Kaufdatum *
                        </Label>
                        <Input
                          type="date"
                          value={editForm.transactionDate}
                          onChange={(e) => setEditForm({ ...editForm, transactionDate: e.target.value })}
                          className="bg-slate-600 border-slate-500 text-white mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs flex items-center gap-1">
                          <Hash className="w-3 h-3" />
                          Anzahl *
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={editForm.shares}
                          onChange={(e) => setEditForm({ ...editForm, shares: e.target.value })}
                          className="bg-slate-600 border-slate-500 text-white mt-1"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          Einstandspreis ({tx.currency || 'CHF'}) *
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={editForm.pricePerShare}
                          onChange={(e) => setEditForm({ ...editForm, pricePerShare: e.target.value })}
                          className="bg-slate-600 border-slate-500 text-white mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          Notizen
                        </Label>
                        <Input
                          value={editForm.notes}
                          onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                          placeholder="Optional"
                          className="bg-slate-600 border-slate-500 text-white mt-1"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingTxId(null)}
                        className="text-muted-foreground hover:text-white"
                      >
                        Abbrechen
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSaveEdit}
                        disabled={updateTransaction.isPending}
                        className="bg-cyan-600 hover:bg-cyan-700"
                      >
                        {updateTransaction.isPending ? 'Speichern...' : 'Speichern'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* Display Mode */
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <span className={`text-xs font-medium px-2 py-1 rounded ${
                        tx.transactionType === 'buy' 
                          ? 'bg-blue-500/20 text-blue-400' 
                          : 'bg-orange-500/20 text-orange-400'
                      }`}>
                        {tx.transactionType === 'buy' ? 'Kauf' : 'Verkauf'}
                      </span>
                      <div>
                        <p className="text-sm text-white">{formatDate(tx.transactionDate)}</p>
                        <p className="text-xs text-muted-foreground">
                          {parseFloat(tx.shares).toLocaleString('de-CH')} Stück @ {tx.currency || 'CHF'} {parseFloat(tx.pricePerShare).toFixed(2)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditTx(tx)}
                        className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-400/10"
                      >
                        Bearbeiten
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteTx(tx.id)}
                        disabled={deleteTransaction.isPending}
                        className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
                      >
                        Löschen
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose} className="border-slate-600 text-white hover:bg-slate-700">
            Schliessen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
