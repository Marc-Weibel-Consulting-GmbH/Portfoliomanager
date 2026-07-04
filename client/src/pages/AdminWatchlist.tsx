import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, RefreshCw, Sparkles, Search, TrendingUp, TrendingDown, Minus, Eye, Users, Bot, Star, ListChecks, Wrench } from "lucide-react";

export default function AdminWatchlist() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  // F-13: merged view — Empfehlungen | Watchlist | Alle
  const [listTypeFilter, setListTypeFilter] = useState<"empfehlung" | "watchlist" | "alle">("alle");
  const [bulkMigrateOpen, setBulkMigrateOpen] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [signalFilter, setSignalFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [newTicker, setNewTicker] = useState("");
  const [tickerSearchQuery, setTickerSearchQuery] = useState("");
  const [showTickerSuggestions, setShowTickerSuggestions] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newSector, setNewSector] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [aiCriteria, setAiCriteria] = useState<string>("balanced");
  const [aiCount, setAiCount] = useState(10);
  const [aiCurrency, setAiCurrency] = useState<string>("all");
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  // U-08: Löschbestätigung über AlertDialog statt Browser-confirm()
  const [removingStock, setRemovingStock] = useState<{ id: number; ticker: string } | null>(null);

  const utils = trpc.useUtils();

  const listInput = {
    source: sourceFilter as any,
    listType: listTypeFilter,
    signalType: signalFilter as any,
    category: categoryFilter === "all" ? undefined : categoryFilter,
    search: search || undefined,
  };
  const { data: watchlistData, isLoading } = trpc.watchlist.list.useQuery(listInput);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  const sortedStocks = (() => {
    if (!watchlistData?.stocks || !sortColumn) return watchlistData?.stocks || [];
    return [...watchlistData.stocks].sort((a: any, b: any) => {
      let valA: any, valB: any;
      switch (sortColumn) {
        case "ticker": valA = a.ticker; valB = b.ticker; break;
        case "company": valA = a.companyName || ""; valB = b.companyName || ""; break;
        case "sector": valA = a.sector || ""; valB = b.sector || ""; break;
        case "price": valA = parseFloat(a.currentPrice || "0"); valB = parseFloat(b.currentPrice || "0"); break;
        case "pe": valA = parseFloat(a.peRatio || "9999"); valB = parseFloat(b.peRatio || "9999"); break;
        case "dividend": valA = parseFloat(a.dividendYield || "0"); valB = parseFloat(b.dividendYield || "0"); break;
        case "signal": valA = a.signalType === "buy" ? 2 : a.signalType === "hold" ? 1 : 0; valB = b.signalType === "buy" ? 2 : b.signalType === "hold" ? 1 : 0; break;
        case "score": valA = a.signalScore || 0; valB = b.signalScore || 0; break;
        default: return 0;
      }
      if (typeof valA === "string") {
        return sortDirection === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortDirection === "asc" ? valA - valB : valB - valA;
    });
  })();

  const { data: stats } = trpc.watchlist.stats.useQuery();
  const { data: filterOptions } = trpc.watchlist.getFilters.useQuery();

  // Ticker search autofill
  const { data: tickerSuggestions = [] } = trpc.stocks.searchTicker.useQuery(
    tickerSearchQuery,
    { enabled: tickerSearchQuery.length >= 2 }
  );

  const addMutation = trpc.watchlist.add.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      utils.watchlist.list.invalidate();
      utils.watchlist.stats.invalidate();
      setAddDialogOpen(false);
      setNewTicker("");
      setTickerSearchQuery("");
      setShowTickerSuggestions(false);
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
      setRemovingStock(null);
      utils.watchlist.list.invalidate();
      utils.watchlist.stats.invalidate();
    },
    onError: (err) => { setRemovingStock(null); toast.error(err.message); },
  });

  const refreshMutation = trpc.watchlist.refreshMetrics.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.updated} Titel aktualisiert, ${data.failed} fehlgeschlagen`);
      utils.watchlist.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  // F-13: per-row toggle Empfehlung ↔ Watchlist (optimistic)
  const setListTypeMutation = trpc.watchlist.setListType.useMutation({
    onMutate: async (vars) => {
      if (!vars) return;
      await utils.watchlist.list.cancel();
      utils.watchlist.list.setData(listInput, (old) =>
        old
          ? { ...old, stocks: old.stocks.map((s: any) => (s.id === vars.id ? { ...s, listType: vars.listType } : s)) }
          : old
      );
    },
    onSuccess: (_data, vars) => {
      toast.success(vars && vars.listType === "empfehlung" ? "Als Empfehlung markiert" : "In die Watchlist verschoben");
    },
    onError: (err) => toast.error(err.message),
    onSettled: () => {
      utils.watchlist.list.invalidate();
      utils.watchlist.stats.invalidate();
    },
  });

  // F-13: one-click migration of all active titles
  const bulkMigrateMutation = trpc.watchlist.markAllActiveAsEmpfehlung.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setBulkMigrateOpen(false);
      utils.watchlist.list.invalidate();
      utils.watchlist.stats.invalidate();
    },
    onError: (err) => {
      setBulkMigrateOpen(false);
      toast.error(err.message);
    },
  });

  // L-16: Alt-ISIN-Zeilen (Wikifolio-Importe vor dem F-15-Fix) in Ticker auflösen
  const cleanupIsinMutation = trpc.watchlist.cleanupIsinTickers.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      utils.watchlist.list.invalidate();
      utils.watchlist.stats.invalidate();
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
            <h1 className="text-3xl font-bold tracking-tight">Aktienliste & Watchlist</h1>
            <p className="text-muted-foreground mt-1">
              Aktien-Universum verwalten (max. 200 Titel) — Empfehlungen erscheinen für Nutzer unter «Aktien»
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
            {/* L-16: Alt-ISIN-Zeilen in Yahoo-Ticker auflösen (Wikifolio-Importe vor F-15) */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => cleanupIsinMutation.mutate()}
              disabled={cleanupIsinMutation.isPending}
              title="Watchlist-Einträge, die eine ISIN statt eines Tickers tragen, automatisch auflösen"
            >
              <Wrench className={`w-4 h-4 mr-2 ${cleanupIsinMutation.isPending ? "animate-spin" : ""}`} />
              ISIN bereinigen
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
                    <Label>Referenzwährung</Label>
                    <Select value={aiCurrency} onValueChange={setAiCurrency}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Alle Währungen</SelectItem>
                        <SelectItem value="CHF">CHF (Schweizer Franken)</SelectItem>
                        <SelectItem value="EUR">EUR (Euro)</SelectItem>
                        <SelectItem value="USD">USD (US-Dollar)</SelectItem>
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
                    onClick={() => aiMutation.mutate({ criteria: aiCriteria as any, maxNew: aiCount, currency: aiCurrency === 'all' ? undefined : aiCurrency as "CHF" | "EUR" | "USD" })}
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
                  <div className="relative">
                    <Label>Ticker *</Label>
                    <Input 
                      placeholder="Suche nach Ticker oder Name..." 
                      value={tickerSearchQuery || newTicker} 
                      onChange={(e) => {
                        const value = e.target.value.toUpperCase();
                        setTickerSearchQuery(value);
                        setNewTicker(value);
                        setShowTickerSuggestions(true);
                      }}
                      onFocus={() => setShowTickerSuggestions(true)}
                    />
                    {showTickerSuggestions && tickerSuggestions.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                        {tickerSuggestions.map((s: any, i: number) => (
                          <button
                            key={i}
                            className="w-full px-3 py-2 text-left hover:bg-muted text-sm flex justify-between items-center"
                            onClick={() => {
                              const ticker = s.exchange && s.exchange !== 'US' 
                                ? `${s.symbol}.${s.exchange}` 
                                : s.symbol;
                              setNewTicker(ticker);
                              setTickerSearchQuery(ticker);
                              setNewCompanyName(s.shortname || '');
                              setShowTickerSuggestions(false);
                            }}
                          >
                            <span className="font-medium">{s.symbol}</span>
                            <span className="text-muted-foreground truncate ml-2">{s.shortname} • {s.exchange}</span>
                          </button>
                        ))}
                      </div>
                    )}
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

        {/* F-13: Listen-Umschalter Empfehlungen | Watchlist | Alle */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs value={listTypeFilter} onValueChange={(v) => setListTypeFilter(v as any)}>
            <TabsList>
              <TabsTrigger value="empfehlung">
                <Star className="w-3.5 h-3.5 mr-1.5" />
                Empfehlungen{stats ? ` (${stats.empfehlung})` : ""}
              </TabsTrigger>
              <TabsTrigger value="watchlist">
                <ListChecks className="w-3.5 h-3.5 mr-1.5" />
                Watchlist{stats ? ` (${stats.watchlistOnly})` : ""}
              </TabsTrigger>
              <TabsTrigger value="alle">
                Alle{stats ? ` (${stats.total})` : ""}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setBulkMigrateOpen(true)}
            disabled={bulkMigrateMutation.isPending}
          >
            <Star className={`w-4 h-4 mr-2 ${bulkMigrateMutation.isPending ? "animate-pulse" : ""}`} />
            Alle aktiven als Empfehlung markieren
          </Button>
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
                      <th className="text-left p-3 font-medium cursor-pointer hover:text-primary select-none" onClick={() => handleSort("ticker")}>
                        Ticker {sortColumn === "ticker" && (sortDirection === "asc" ? "↑" : "↓")}
                      </th>
                      <th className="text-left p-3 font-medium cursor-pointer hover:text-primary select-none" onClick={() => handleSort("company")}>
                        Unternehmen {sortColumn === "company" && (sortDirection === "asc" ? "↑" : "↓")}
                      </th>
                      <th className="text-left p-3 font-medium cursor-pointer hover:text-primary select-none" onClick={() => handleSort("sector")}>
                        Sektor {sortColumn === "sector" && (sortDirection === "asc" ? "↑" : "↓")}
                      </th>
                      <th className="text-left p-3 font-medium">Kategorie</th>
                      <th className="text-right p-3 font-medium cursor-pointer hover:text-primary select-none" onClick={() => handleSort("price")}>
                        Kurs {sortColumn === "price" && (sortDirection === "asc" ? "↑" : "↓")}
                      </th>
                      <th className="text-right p-3 font-medium cursor-pointer hover:text-primary select-none" onClick={() => handleSort("pe")}>
                        P/E {sortColumn === "pe" && (sortDirection === "asc" ? "↑" : "↓")}
                      </th>
                      <th className="text-right p-3 font-medium cursor-pointer hover:text-primary select-none" onClick={() => handleSort("dividend")}>
                        Div.% {sortColumn === "dividend" && (sortDirection === "asc" ? "↑" : "↓")}
                      </th>
                      <th className="text-center p-3 font-medium cursor-pointer hover:text-primary select-none" onClick={() => handleSort("signal")}>
                        Signal {sortColumn === "signal" && (sortDirection === "asc" ? "↑" : "↓")}
                      </th>
                      <th className="text-center p-3 font-medium cursor-pointer hover:text-primary select-none" onClick={() => handleSort("score")}>
                        Score {sortColumn === "score" && (sortDirection === "asc" ? "↑" : "↓")}
                      </th>
                      <th className="text-center p-3 font-medium">Quelle</th>
                      <th className="text-center p-3 font-medium">Empfehlung</th>
                      <th className="text-right p-3 font-medium">Aktionen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedStocks.map((stock) => (
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
                          {/* L-15: auch der String «NaN» ist truthy → nur echte, endliche Werte zeigen */}
                          {Number.isFinite(Number(stock.currentPrice)) ? (
                            <>
                              {Number(stock.currentPrice).toFixed(2)}
                              {stock.currency && <span className="text-xs text-muted-foreground ml-1">{stock.currency}</span>}
                            </>
                          ) : "—"}
                        </td>
                        <td className="p-3 text-right font-mono">{Number.isFinite(Number(stock.peRatio)) ? Number(stock.peRatio).toFixed(1) : "—"}</td>
                        <td className="p-3 text-right font-mono">{Number.isFinite(Number(stock.dividendYield)) ? `${Number(stock.dividendYield).toFixed(1)}%` : "—"}</td>
                        <td className="p-3 text-center">{getSignalBadge(stock.signalType)}</td>
                        <td className="p-3 text-center">
                          <span className={`font-mono font-semibold ${(stock.signalScore || 0) >= 65 ? "text-green-600" : (stock.signalScore || 0) <= 35 ? "text-red-600" : ""}`}>
                            {stock.signalScore || 0}
                          </span>
                        </td>
                        <td className="p-3 text-center">{getSourceBadge(stock.source)}</td>
                        <td className="p-3 text-center">
                          <Switch
                            checked={(stock as any).listType === "empfehlung"}
                            onCheckedChange={(checked) =>
                              setListTypeMutation.mutate({ id: stock.id, listType: checked ? "empfehlung" : "watchlist" })
                            }
                            aria-label={`${stock.ticker} als Empfehlung markieren`}
                            title={(stock as any).listType === "empfehlung" ? "Empfehlung (für Nutzer sichtbar)" : "Nur Watchlist"}
                          />
                        </td>
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
                              onClick={() => setRemovingStock({ id: stock.id, ticker: stock.ticker })}
                              title="Entfernen"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {sortedStocks.length === 0 && (
                      <tr>
                        <td colSpan={12} className="p-8 text-center text-muted-foreground">
                          {listTypeFilter === "empfehlung"
                            ? "Keine Empfehlungen vorhanden. Markieren Sie Titel über den Schalter in der Spalte «Empfehlung»."
                            : "Keine Titel in der Watchlist. Fügen Sie manuell Titel hinzu oder generieren Sie KI-Empfehlungen."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Löschbestätigung (U-08) */}
        <ConfirmDialog
          open={removingStock !== null}
          onOpenChange={(open) => { if (!open) setRemovingStock(null); }}
          title={`${removingStock?.ticker ?? ''} aus der Watchlist entfernen?`}
          description="Der Titel wird inklusive seiner Kennzahlen aus der Watchlist entfernt."
          confirmLabel="Entfernen"
          onConfirm={() => { if (removingStock) removeMutation.mutate({ id: removingStock.id }); }}
          isPending={removeMutation.isPending}
        />

        {/* F-13: Bestätigung Bulk-Migration */}
        <ConfirmDialog
          open={bulkMigrateOpen}
          onOpenChange={setBulkMigrateOpen}
          title="Alle aktiven Titel als Empfehlung markieren?"
          description="Alle aktiven Titel der Watchlist werden als Empfehlung markiert und erscheinen damit für Nutzer auf der Seite «Aktien». Einzelne Titel können danach jederzeit wieder in die Watchlist verschoben werden."
          confirmLabel="Als Empfehlung markieren"
          onConfirm={() => bulkMigrateMutation.mutate()}
          isPending={bulkMigrateMutation.isPending}
        />
      </div>
    </DashboardLayout>
  );
}
