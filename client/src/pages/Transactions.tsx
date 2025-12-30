import { useState, useMemo } from "react";
import { useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pencil, Trash2, Download, Plus, ChevronLeft, ChevronRight, Activity } from "lucide-react";
import { toast } from "sonner";

type TransactionType = "buy" | "sell" | "dividend" | "deposit" | "withdrawal";

export default function Transactions() {
  const params = useParams();
  const portfolioId = parseInt(params.id || "0");

  // Filters
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [periodFilter, setPeriodFilter] = useState<string>("all");
  const [tickerFilter, setTickerFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);

  // Form state
  const [formData, setFormData] = useState({
    transactionType: "buy" as TransactionType,
    ticker: "",
    shares: "",
    pricePerShare: "",
    currency: "CHF",
    totalAmount: "",
    fees: "0",
    notes: "",
    transactionDate: new Date().toISOString().split("T")[0],
  });

  // Queries
  const { data: portfolio } = trpc.portfolios.getById.useQuery({ portfolioId });
  const { data: allTransactions = [], refetch } = trpc.portfolioTransactions.list.useQuery({ portfolioId });

  // Mutations
  const createMutation = trpc.portfolioTransactions.create.useMutation({
    onSuccess: () => {
      toast.success("Transaktion erfolgreich erstellt");
      refetch();
      setIsCreateModalOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(`Fehler: ${error.message}`);
    },
  });

  const updateMutation = trpc.portfolioTransactions.update.useMutation({
    onSuccess: () => {
      toast.success("Transaktion erfolgreich aktualisiert");
      refetch();
      setIsEditModalOpen(false);
      setSelectedTransaction(null);
    },
    onError: (error) => {
      toast.error(`Fehler: ${error.message}`);
    },
  });

  const deleteMutation = trpc.portfolioTransactions.delete.useMutation({
    onSuccess: () => {
      toast.success("Transaktion erfolgreich gelöscht");
      refetch();
      setIsDeleteDialogOpen(false);
      setSelectedTransaction(null);
    },
    onError: (error) => {
      toast.error(`Fehler: ${error.message}`);
    },
  });

  const { data: csvData, refetch: refetchCsv } = trpc.portfolioTransactions.exportToCsv.useQuery(
    { portfolioId },
    { enabled: false }
  );

  // Calculate date ranges
  const getDateRange = (period: string) => {
    const now = new Date();
    switch (period) {
      case "30days":
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(now.getDate() - 30);
        return { startDate: thirtyDaysAgo, endDate: now };
      case "3months":
        const threeMonthsAgo = new Date(now);
        threeMonthsAgo.setMonth(now.getMonth() - 3);
        return { startDate: threeMonthsAgo, endDate: now };
      case "year":
        const yearStart = new Date(now.getFullYear(), 0, 1);
        return { startDate: yearStart, endDate: now };
      default:
        return null;
    }
  };

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    let filtered = [...allTransactions];

    // Type filter
    if (typeFilter !== "all") {
      filtered = filtered.filter((tx) => tx.transactionType === typeFilter);
    }

    // Period filter
    if (periodFilter !== "all") {
      const dateRange = getDateRange(periodFilter);
      if (dateRange) {
        filtered = filtered.filter((tx) => {
          const txDate = new Date(tx.transactionDate);
          return txDate >= dateRange.startDate && txDate <= dateRange.endDate;
        });
      }
    }

    // Ticker filter
    if (tickerFilter !== "all") {
      filtered = filtered.filter((tx) => tx.ticker === tickerFilter);
    }

    return filtered;
  }, [allTransactions, typeFilter, periodFilter, tickerFilter]);

  // Get unique tickers for filter
  const uniqueTickers = useMemo(() => {
    const tickers = new Set(allTransactions.map((tx) => tx.ticker).filter(Boolean));
    return Array.from(tickers).sort();
  }, [allTransactions]);

  // Calculate summary metrics
  const summaryMetrics = useMemo(() => {
    let totalInvested = 0;
    let totalWithdrawn = 0;
    let totalDividends = 0;
    let totalFees = 0;

    filteredTransactions.forEach((tx) => {
      const amount = parseFloat(tx.totalAmountCHF || tx.totalAmount || "0");
      const fees = parseFloat(tx.fees || "0");

      if (tx.transactionType === "buy" || tx.transactionType === "deposit") {
        totalInvested += amount;
      } else if (tx.transactionType === "sell" || tx.transactionType === "withdrawal") {
        totalWithdrawn += amount;
      } else if (tx.transactionType === "dividend") {
        totalDividends += amount;
      }

      totalFees += fees;
    });

    return {
      totalInvested,
      totalWithdrawn,
      totalDividends,
      totalFees,
    };
  }, [filteredTransactions]);

  // Pagination
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const resetForm = () => {
    setFormData({
      transactionType: "buy",
      ticker: "",
      shares: "",
      pricePerShare: "",
      currency: "CHF",
      totalAmount: "",
      fees: "0",
      notes: "",
      transactionDate: new Date().toISOString().split("T")[0],
    });
  };

  const handleCreate = () => {
    // Calculate totalAmount if not provided
    let totalAmount = formData.totalAmount;
    if (!totalAmount && formData.shares && formData.pricePerShare) {
      totalAmount = (parseFloat(formData.shares) * parseFloat(formData.pricePerShare)).toFixed(2);
    }

    createMutation.mutate({
      portfolioId,
      transactionType: formData.transactionType,
      ticker: formData.ticker || null,
      shares: formData.shares || null,
      pricePerShare: formData.pricePerShare || null,
      totalAmount,
      fees: formData.fees,
      notes: formData.notes || null,
      transactionDate: formData.transactionDate,
    });
  };

  const handleEdit = (transaction: any) => {
    setSelectedTransaction(transaction);
    setFormData({
      transactionType: transaction.transactionType,
      ticker: transaction.ticker || "",
      shares: transaction.shares || "",
      pricePerShare: transaction.pricePerShare || "",
      currency: transaction.currency || "CHF",
      totalAmount: transaction.totalAmount || "",
      fees: transaction.fees || "0",
      notes: transaction.notes || "",
      transactionDate: new Date(transaction.transactionDate).toISOString().split("T")[0],
    });
    setIsEditModalOpen(true);
  };

  const handleUpdate = () => {
    if (!selectedTransaction) return;

    updateMutation.mutate({
      transactionId: selectedTransaction.id,
      transactionDate: formData.transactionDate,
      shares: formData.shares || undefined,
      pricePerShare: formData.pricePerShare || undefined,
      totalAmount: formData.totalAmount || undefined,
      currency: formData.currency || undefined,
      fees: formData.fees || undefined,
      notes: formData.notes || undefined,
    });
  };

  const handleDelete = (transaction: any) => {
    setSelectedTransaction(transaction);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (!selectedTransaction) return;
    deleteMutation.mutate({ transactionId: selectedTransaction.id });
  };

  const handleExportCsv = async () => {
    const result = await refetchCsv();
    if (result.data) {
      const blob = new Blob([result.data.csv], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.data.filename;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("CSV erfolgreich exportiert");
    }
  };

  const getTransactionBadge = (type: TransactionType) => {
    switch (type) {
      case "buy":
        return <Badge className="bg-green-500/20 text-green-400 hover:bg-green-500/30">Kauf</Badge>;
      case "sell":
        return <Badge className="bg-red-500/20 text-red-400 hover:bg-red-500/30">Verkauf</Badge>;
      case "dividend":
        return <Badge className="bg-blue-500/20 text-blue-400 hover:bg-blue-500/30">Dividende</Badge>;
      case "deposit":
        return <Badge className="bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30">Einzahlung</Badge>;
      case "withdrawal":
        return <Badge className="bg-orange-500/20 text-orange-400 hover:bg-orange-500/30">Auszahlung</Badge>;
    }
  };

  return (
    <div className="container py-8 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/portfolios" className="hover:text-foreground">
          Portfolios
        </Link>
        <span>→</span>
        <Link href={`/portfolios/${portfolioId}`} className="hover:text-foreground">
          {portfolio?.name || "Portfolio"}
        </Link>
        <span>→</span>
        <span className="text-foreground">Transaktionen</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold">{portfolio?.name || "Portfolio"}</h1>
            {portfolio?.isLive ? (
              <Badge variant="default" className="bg-[#00CFC1]/20 text-[#00CFC1] border-[#00CFC1]/30">
                <Activity className="w-3 h-3 mr-1" />
                Live
              </Badge>
            ) : (
              <Badge variant="outline" className="border-gray-600 text-gray-400">
                Test
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">Transaktionsverwaltung</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportCsv}>
            <Download className="mr-2 h-4 w-4" />
            CSV Export
          </Button>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Neue Transaktion
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label>Typ</Label>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle</SelectItem>
              <SelectItem value="buy">Kauf</SelectItem>
              <SelectItem value="sell">Verkauf</SelectItem>
              <SelectItem value="dividend">Dividende</SelectItem>
              <SelectItem value="deposit">Einzahlung</SelectItem>
              <SelectItem value="withdrawal">Auszahlung</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Zeitraum</Label>
          <Select value={periodFilter} onValueChange={setPeriodFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle</SelectItem>
              <SelectItem value="30days">Letzte 30 Tage</SelectItem>
              <SelectItem value="3months">Letzte 3 Monate</SelectItem>
              <SelectItem value="year">Dieses Jahr</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Ticker</Label>
          <Select value={tickerFilter} onValueChange={setTickerFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle</SelectItem>
              {uniqueTickers.map((ticker) => (
                <SelectItem key={ticker} value={ticker}>
                  {ticker}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Gesamt investiert</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-400">
              CHF {summaryMetrics.totalInvested.toLocaleString("de-CH", { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Gesamt entnommen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-400">
              CHF {summaryMetrics.totalWithdrawn.toLocaleString("de-CH", { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Dividenden erhalten</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-400">
              CHF {summaryMetrics.totalDividends.toLocaleString("de-CH", { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Gebühren bezahlt</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-400">
              CHF {summaryMetrics.totalFees.toLocaleString("de-CH", { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transactions Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Datum</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Ticker</TableHead>
                <TableHead className="text-right">Anzahl</TableHead>
                <TableHead className="text-right">Preis/Aktie</TableHead>
                <TableHead>Währung</TableHead>
                <TableHead className="text-right">Gesamt (CHF)</TableHead>
                <TableHead className="text-right">Gebühren</TableHead>
                <TableHead>Notizen</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedTransactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                    Keine Transaktionen gefunden
                  </TableCell>
                </TableRow>
              ) : (
                paginatedTransactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell>{new Date(tx.transactionDate).toLocaleDateString("de-CH")}</TableCell>
                    <TableCell>{getTransactionBadge(tx.transactionType)}</TableCell>
                    <TableCell className="font-medium">{tx.ticker || "-"}</TableCell>
                    <TableCell className="text-right">{tx.shares || "-"}</TableCell>
                    <TableCell className="text-right">
                      {tx.pricePerShare ? `${tx.currency} ${parseFloat(tx.pricePerShare).toFixed(2)}` : "-"}
                    </TableCell>
                    <TableCell>{tx.currency}</TableCell>
                    <TableCell className="text-right font-medium">
                      CHF {parseFloat(tx.totalAmountCHF || tx.totalAmount || "0").toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">CHF {parseFloat(tx.fees || "0").toFixed(2)}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{tx.notes || "-"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(tx)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(tx)}>
                          <Trash2 className="h-4 w-4 text-red-400" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Seite {currentPage} von {totalPages} ({filteredTransactions.length} Transaktionen)
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {Array.from({ length: Math.min(totalPages, 8) }, (_, i) => i + 1).map((page) => (
              <Button
                key={page}
                variant={currentPage === page ? "default" : "outline"}
                size="icon"
                onClick={() => setCurrentPage(page)}
              >
                {page}
              </Button>
            ))}
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Create/Edit Transaction Modal */}
      <Dialog open={isCreateModalOpen || isEditModalOpen} onOpenChange={(open) => {
        if (!open) {
          setIsCreateModalOpen(false);
          setIsEditModalOpen(false);
          setSelectedTransaction(null);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{isEditModalOpen ? "Transaktion bearbeiten" : "Neue Transaktion"}</DialogTitle>
            <DialogDescription>
              {isEditModalOpen
                ? "Bearbeiten Sie die Details der Transaktion."
                : "Fügen Sie eine neue Transaktion zu Ihrem Portfolio hinzu."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Typ *</Label>
              <Select
                value={formData.transactionType}
                onValueChange={(value) => setFormData({ ...formData, transactionType: value as TransactionType })}
                disabled={isEditModalOpen}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="buy">Kauf</SelectItem>
                  <SelectItem value="sell">Verkauf</SelectItem>
                  <SelectItem value="dividend">Dividende</SelectItem>
                  <SelectItem value="deposit">Einzahlung</SelectItem>
                  <SelectItem value="withdrawal">Auszahlung</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Datum *</Label>
              <Input
                type="date"
                value={formData.transactionDate}
                onChange={(e) => setFormData({ ...formData, transactionDate: e.target.value })}
              />
            </div>

            {(formData.transactionType === "buy" || formData.transactionType === "sell" || formData.transactionType === "dividend") && (
              <>
                <div>
                  <Label>Ticker *</Label>
                  <Input
                    value={formData.ticker}
                    onChange={(e) => setFormData({ ...formData, ticker: e.target.value.toUpperCase() })}
                    placeholder="AAPL"
                    disabled={isEditModalOpen}
                  />
                </div>

                {(formData.transactionType === "buy" || formData.transactionType === "sell") && (
                  <>
                    <div>
                      <Label>Anzahl *</Label>
                      <Input
                        type="number"
                        step="0.001"
                        value={formData.shares}
                        onChange={(e) => setFormData({ ...formData, shares: e.target.value })}
                        placeholder="10"
                      />
                    </div>

                    <div>
                      <Label>Preis/Aktie *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.pricePerShare}
                        onChange={(e) => setFormData({ ...formData, pricePerShare: e.target.value })}
                        placeholder="150.00"
                      />
                    </div>

                    <div>
                      <Label>Währung *</Label>
                      <Select
                        value={formData.currency}
                        onValueChange={(value) => setFormData({ ...formData, currency: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CHF">CHF</SelectItem>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="EUR">EUR</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                {formData.transactionType === "dividend" && (
                  <div>
                    <Label>Betrag *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.totalAmount}
                      onChange={(e) => setFormData({ ...formData, totalAmount: e.target.value })}
                      placeholder="100.00"
                    />
                  </div>
                )}
              </>
            )}

            {(formData.transactionType === "deposit" || formData.transactionType === "withdrawal") && (
              <>
                <div>
                  <Label>Betrag *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.totalAmount}
                    onChange={(e) => setFormData({ ...formData, totalAmount: e.target.value })}
                    placeholder="1000.00"
                  />
                </div>

                <div>
                  <Label>Währung *</Label>
                  <Select
                    value={formData.currency}
                    onValueChange={(value) => setFormData({ ...formData, currency: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CHF">CHF</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div>
              <Label>Gebühren</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.fees}
                onChange={(e) => setFormData({ ...formData, fees: e.target.value })}
                placeholder="0.00"
              />
            </div>

            <div className="col-span-2">
              <Label>Notizen</Label>
              <Input
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Optional"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsCreateModalOpen(false);
              setIsEditModalOpen(false);
              setSelectedTransaction(null);
              resetForm();
            }}>
              Abbrechen
            </Button>
            <Button onClick={isEditModalOpen ? handleUpdate : handleCreate}>
              {isEditModalOpen ? "Aktualisieren" : "Erstellen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transaktion löschen?</DialogTitle>
            <DialogDescription>
              Sind Sie sicher, dass Sie diese Transaktion löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
