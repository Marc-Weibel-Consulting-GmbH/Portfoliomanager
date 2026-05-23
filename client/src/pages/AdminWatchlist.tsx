import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, RefreshCw, Sparkles, Search, TrendingUp, TrendingDown, Minus, Eye, Users, Bot } from "lucide-react";

export default function AdminWatchlist() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [signalFilter, setSignalFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [newTicker, setNewTicker] = useState("");
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newSector, setNewSector] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [aiCriteria, setAiCriteria] = useState<string>("balanced");
  const [aiCount, setAiCount] = useState(10);

  const utils = trpc.useUtils();

  const { data: watchlistData, isLoading } = trpc.watchlist.list.useQuery({
    source: sourceFilter as any,
    signalType: signalFilter as any,
    category: categoryFilter === "all" ? undefined : categoryFilter,
    search: search || undefined,
  });

  const { data: stats } = trpc.watchlist.stats.useQuery();
  const { data: filterOptions } = trpc.watchlist.getFilters.useQuery();

  const addMutation = trpc.watchlist.add.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      utils.watchlist.list.invalidate();
      utils.watchlist.stats.invalidate();
      setAddDialogOpen(false);
      setNewTicker("");
      setNewCompanyName("");
      setNewSector("");
      setNewCategory("");
      setNewNotes("");
    },
    onError: (err) => toast.error(err.message),
  });

  const removeMutation = trpc.watchlist.remove.useMutation({
    onSuccess: () => {
      toast.success("Titel entfernt");
      utils.watchlist.list.invalidate();
      utils.watchlist.stats.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const refreshMutation = trpc.watchlist.refreshMetrics.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.updated} Titel aktualisiert, ${data.failed} fehlgeschlagen`);
      utils.watchlist.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const aiMutation = trpc.watchlist.generateRecommendations.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      utils.watchlist.list.invalidate();
      utils.watchlist.stats.invalidate();
      setAiDialogOpen(false);
    },
    onError: (err) => toast.error(err.message),
  });

  if (user?.role !== "admin") {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-muted-foreground">Kein Zugriff</p>
        </div>
      </DashboardLayout>
    );
  }

  const getSignalBadge = (type: string | null) => {
    if (type === "buy") return <Badge className="bg-green-500/10 text-green-600 border-green-500/20"><TrendingUp className="w-3 h-3 mr-1" />Kaufen</Badge>;
    if (type === "sell") return <Badge className="bg-red-500/10 text-red-600 border-red-500/20"><TrendingDown className="w-3 h-3 mr-1" />Verkaufen</Badge>;
    return <Badge variant="outline"><Minus className="w-3 h-3 mr-1" />Halten</Badge>;
  };

  const getSourceBadge = (source: string) => {
    if (source === "manual") return <Badge variant="outline" className="text-xs"><Users className="w-3 h-3 mr-1" />Manuell</Badge>;
    return <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-600 border-purple-500/20"><Bot className="w-3 h-3 mr-1" />KI</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Watchlist</h1>
            <p className="text-muted-foreground mt-1">
              Aktien-Universum verwalten (max. 200 Titel)
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refreshMutation.mutate({})}
              disabled={refreshMutation.isPending}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
              Aktualisieren
            </Button>
            <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Sparkles className="w-4 h-4 mr-2" />
                  KI-Empfehlungen
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>KI-Empfehlungen generieren</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <Label>Strategie</Label>
                    <Select value={aiCriteria} onValueChange={setAiCriteria}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="balanced">Ausgewogen</SelectItem>
                        <SelectItem value="value">Value</SelectItem>
                        <SelectItem value="growth">Wachstum</SelectItem>
                        <SelectItem value="dividend">Dividende</SelectItem>
                        <SelectItem value="momentum">Momentum</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Anzahl neue Titel (max. {200 - (stats?.total || 0)})</Label>
                    <Input
                      type="number"
                      min={1}
                      max={Math.min(50, 200 - (stats?.total || 0))}
                      value={aiCount}
                      onChange={(e) => setAiCount(parseInt(e.target.value) || 5)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => aiMutation.mutate({ criteria: aiCriteria as any, maxNew: aiCount })}
                    disabled={aiMutation.isPending}
                  >
                    {aiMutation.isPending ? "Generiere..." : "Empfehlungen generieren"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Titel hinzufügen
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Titel zur Watchlist hinzufügen</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <Label>Ticker *</Label>
                    <Input placeholder="z.B. AAPL, MSFT, NESN.SW" value={newTicker} onChange={(e) => setNewTicker(e.target.value.toUpperCase())} />
                  </div>
                  <div>
                    <Label>Firmenname *</Label>
                    <Input placeholder="z.B. Apple Inc." value={newCompanyName} onChange={(e) => setNewCompanyName(e.target.value)} />
                  </div>
                  <div>
                    <Label>Sektor</Label>
                    <Input placeholder="z.B. Technology" value={newSector} onChange={(e) => setNewSector(e.target.value)} />
                  </div>
                  <div>
                    <Label>Kategorie</Label>
                    <Select value={newCategory} onValueChange={setNewCategory}>
                      <SelectTrigger><SelectValue placeholder="Wählen..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Wachstumsaktien">Wachstumsaktien</SelectItem>
                        <SelectItem value="Dividendenaktien">Dividendenaktien</SelectItem>
                        <SelectItem value="Value">Value</SelectItem>
                        <SelectItem value="ETF">ETF</SelectItem>
                        <SelectItem value="Balanced">Balanced</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Notizen</Label>
                    <Textarea placeholder="Optionale Notizen..." value={newNotes} onChange={(e) => setNewNotes(e.target.value)} />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => addMutation.mutate({
                      ticker: newTicker,
                      companyName: newCompanyName,
                      sector: newSector || undefined,
                      category: newCategory || undefined,
                      notes: newNotes || undefined,
                    })}
                    disabled={addMutation.isPending || !newTicker || !newCompanyName}
                  >
                    {addMutation.isPending ? "Hinzufügen..." : "Hinzufügen"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="text-2xl font-bold">{stats.total}</div>
                <div className="text-xs text-muted-foreground">/ {stats.maxAllowed} Titel</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="text-2xl font-bold text-blue-600">{stats.manual}</div>
                <div className="text-xs text-muted-foreground">Manuell</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="text-2xl font-bold text-purple-600">{stats.aiRecommended}</div>
                <div className="text-xs text-muted-foreground">KI-Empfohlen</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="text-2xl font-bold text-green-600">{stats.buySignals}</div>
                <div className="text-xs text-muted-foreground">Kaufsignale</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="text-2xl font-bold text-red-600">{stats.sellSignals}</div>
                <div className="text-xs text-muted-foreground">Verkaufssignale</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Suche nach Ticker oder Name..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Quelle" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Quellen</SelectItem>
              <SelectItem value="manual">Manuell</SelectItem>
              <SelectItem value="ai_recommended">KI-Empfohlen</SelectItem>
            </SelectContent>
          </Select>
          <Select value={signalFilter} onValueChange={setSignalFilter}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Signal" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Signale</SelectItem>
              <SelectItem value="buy">Kaufen</SelectItem>
              <SelectItem value="hold">Halten</SelectItem>
              <SelectItem value="sell">Verkaufen</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Kategorie" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Kategorien</SelectItem>
              {filterOptions?.categories.map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Stocks Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-medium">Ticker</th>
                      <th className="text-left p-3 font-medium">Unternehmen</th>
                      <th className="text-left p-3 font-medium">Sektor</th>
                      <th className="text-left p-3 font-medium">Kategorie</th>
                      <th className="text-right p-3 font-medium">Kurs</th>
                      <th className="text-right p-3 font-medium">P/E</th>
                      <th className="text-right p-3 font-medium">Div.%</th>
                      <th className="text-center p-3 font-medium">Signal</th>
                      <th className="text-center p-3 font-medium">Score</th>
                      <th className="text-center p-3 font-medium">Quelle</th>
                      <th className="text-right p-3 font-medium">Aktionen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {watchlistData?.stocks.map((stock) => (
                      <tr key={stock.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="p-3 font-mono font-semibold">{stock.ticker}</td>
                        <td className="p-3">
                          <div className="max-w-[200px] truncate">{stock.companyName}</div>
                          {stock.aiReason && (
                            <div className="text-xs text-muted-foreground mt-0.5 max-w-[200px] truncate" title={stock.aiReason}>
                              {stock.aiReason}
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-muted-foreground">{stock.sector || "—"}</td>
                        <td className="p-3">{stock.category || "—"}</td>
                        <td className="p-3 text-right font-mono">
                          {stock.currentPrice ? `${parseFloat(stock.currentPrice).toFixed(2)}` : "—"}
                          {stock.currency && <span className="text-xs text-muted-foreground ml-1">{stock.currency}</span>}
                        </td>
                        <td className="p-3 text-right font-mono">{stock.peRatio ? parseFloat(stock.peRatio).toFixed(1) : "—"}</td>
                        <td className="p-3 text-right font-mono">{stock.dividendYield ? `${parseFloat(stock.dividendYield).toFixed(1)}%` : "—"}</td>
                        <td className="p-3 text-center">{getSignalBadge(stock.signalType)}</td>
                        <td className="p-3 text-center">
                          <span className={`font-mono font-semibold ${(stock.signalScore || 0) >= 65 ? "text-green-600" : (stock.signalScore || 0) <= 35 ? "text-red-600" : ""}`}>
                            {stock.signalScore || 0}
                          </span>
                        </td>
                        <td className="p-3 text-center">{getSourceBadge(stock.source)}</td>
                        <td className="p-3 text-right">
                          <div className="flex gap-1 justify-end">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => window.open(`/invest/${stock.ticker}`, "_blank")}
                              title="Details anzeigen"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => {
                                if (confirm(`${stock.ticker} wirklich entfernen?`)) {
                                  removeMutation.mutate({ id: stock.id });
                                }
                              }}
                              title="Entfernen"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {watchlistData?.stocks.length === 0 && (
                      <tr>
                        <td colSpan={11} className="p-8 text-center text-muted-foreground">
                          Keine Titel in der Watchlist. Füge manuell Titel hinzu oder generiere KI-Empfehlungen.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
