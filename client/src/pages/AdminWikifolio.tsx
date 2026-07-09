import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useMemo, useRef, useEffect } from "react";
import { toast } from "sonner";
import {
  RefreshCw, Download, ExternalLink, TrendingUp, TrendingDown,
  Minus, BarChart3, AlertCircle, CheckCircle2, Info, Search,
  PieChart, ArrowUpDown, Trophy, Eye
} from "lucide-react";

type SortKey = "name" | "percentage" | "close" | "quantity" | "avgPrice";
type TraderSortBy = "perf12m" | "sharperatio" | "aum";

const TRADER_CRITERIA_LABELS: Record<TraderSortBy, string> = {
  perf12m: "12-Monats-Performance",
  sharperatio: "Sharpe Ratio",
  aum: "Verwaltetes Vermögen",
};

// Aktions-Label + Farbe für die Transaktionshistorie
const WIKI_ACTION: Record<string, { label: string; cls: string }> = {
  buy: { label: "Kauf", cls: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  increase: { label: "Erhöht", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200" },
  reduce: { label: "Reduziert", cls: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" },
  sell: { label: "Verkauf", cls: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
  other: { label: "Sonstige", cls: "bg-muted text-muted-foreground" },
};

export default function AdminWikifolio() {
  const { user } = useAuth();
  const [symbol, setSymbol] = useState("wfglobalnt");
  const [inputSymbol, setInputSymbol] = useState("wfglobalnt");
  const [search, setSearch] = useState("");
  const portfolioSectionRef = useRef<HTMLDivElement>(null);
  const [pendingScroll, setPendingScroll] = useState(false);

  // Scroll to portfolio section when a trader's portfolio is selected
  useEffect(() => {
    if (pendingScroll && portfolioSectionRef.current) {
      setTimeout(() => {
        portfolioSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 200);
      setPendingScroll(false);
    }
  }, [symbol, pendingScroll]);
  const [sortKey, setSortKey] = useState<SortKey>("percentage");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [importOverwrite, setImportOverwrite] = useState(false);
  // F-15: Trader-Suche
  const [traderSortBy, setTraderSortBy] = useState<TraderSortBy>("perf12m");
  const [traderQueryInput, setTraderQueryInput] = useState("");
  const [traderSearch, setTraderSearch] = useState<{ sortBy: TraderSortBy; query?: string } | null>(null);

  const utils = trpc.useUtils();

  const {
    data: traderSearchData,
    isFetching: traderSearchLoading,
    error: traderSearchError,
  } = trpc.watchlist.searchWikifolios.useQuery(
    traderSearch ?? { sortBy: "perf12m" },
    { enabled: traderSearch !== null, retry: false }
  );

  const { data: portfolioData, isLoading, error, refetch } = trpc.watchlist.getWikifolioPortfolio.useQuery(
    { symbol },
    { retry: false }
  );

  // Transaktionshistorie (welcher Titel wann gekauft/verkauft/erhöht/reduziert)
  const { data: tradesData, isLoading: tradesLoading, error: tradesError } = trpc.watchlist.getWikifolioTrades.useQuery(
    { symbol },
    { retry: false }
  );

  const clearSessionMutation = trpc.watchlist.clearWikifolioSession.useMutation({
    onSuccess: () => {
      toast.success("Session zurückgesetzt — nächster Abruf erzwingt Re-Login");
      utils.watchlist.getWikifolioPortfolio.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const importMutation = trpc.watchlist.importWikifolioToWatchlist.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      utils.watchlist.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const enrichMutation = trpc.watchlist.enrichWikifolioStocks.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      utils.watchlist.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const portfolio = portfolioData?.portfolio;

  const filteredItems = useMemo(() => {
    if (!portfolio?.items) return [];
    let items = portfolio.items;
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(i =>
        i.name.toLowerCase().includes(q) ||
        i.isin?.toLowerCase().includes(q)
      );
    }
    return [...items].sort((a, b) => {
      let valA: any, valB: any;
      switch (sortKey) {
        case "name": valA = a.name; valB = b.name; break;
        case "percentage": valA = a.percentage; valB = b.percentage; break;
        case "close": valA = a.close; valB = b.close; break;
        case "quantity": valA = a.quantity; valB = b.quantity; break;
        case "avgPrice": valA = a.averagePurchasePrice; valB = b.averagePurchasePrice; break;
        default: valA = a.percentage; valB = b.percentage;
      }
      if (typeof valA === "string") {
        return sortDir === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortDir === "asc" ? (valA ?? 0) - (valB ?? 0) : (valB ?? 0) - (valA ?? 0);
    });
  }, [portfolio, search, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const groupColors: Record<string, string> = {
    equities: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    etfs: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    bonds: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    cash: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    "structured-products": "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    "wikifolio-certificates": "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
  };

  const groupLabels: Record<string, string> = {
    equities: "Aktien",
    etfs: "ETFs",
    bonds: "Anleihen",
    cash: "Cash",
    "structured-products": "Strukturierte Produkte",
    "wikifolio-certificates": "Wikifolio-Zertifikate",
  };

  const getPnL = (item: any) => {
    if (!item.averagePurchasePrice || !item.close) return null;
    return ((item.close - item.averagePurchasePrice) / item.averagePurchasePrice) * 100;
  };

  if (!user || user.role !== "admin") {
    return (
      <DashboardLayout>
        <div className="p-6 text-center text-muted-foreground">Kein Admin-Zugriff.</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <PieChart className="w-6 h-6 text-primary" />
              Wikifolio Portfolio
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Portfoliopositionen aus einem Wikifolio-Konto abrufen und analysieren
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => clearSessionMutation.mutate()}
              disabled={clearSessionMutation.isPending}
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${clearSessionMutation.isPending ? "animate-spin" : ""}`} />
              Session zurücksetzen
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`https://www.wikifolio.com/de/ch/w/${symbol}`, "_blank")}
            >
              <ExternalLink className="w-4 h-4 mr-1" />
              Auf Wikifolio öffnen
            </Button>
          </div>
        </div>

        {/* F-15: Trader-Suche */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="w-4 h-4 text-primary" />
              Erfolgreiche Trader suchen
            </CardTitle>
            <CardDescription>
              Investierbare Real-Money-Wikifolios nach Kennzahl sortiert suchen und deren Portfolio laden
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Kriterium</Label>
                <Select value={traderSortBy} onValueChange={v => setTraderSortBy(v as TraderSortBy)}>
                  <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="perf12m">12-Monats-Performance</SelectItem>
                    <SelectItem value="sharperatio">Sharpe Ratio</SelectItem>
                    <SelectItem value="aum">Verwaltetes Vermögen</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Suchtext (optional)</Label>
                <Input
                  value={traderQueryInput}
                  onChange={e => setTraderQueryInput(e.target.value)}
                  placeholder="z.B. Dividende, Tech…"
                  className="w-64"
                  onKeyDown={e => e.key === "Enter" && setTraderSearch({ sortBy: traderSortBy, query: traderQueryInput.trim() || undefined })}
                />
              </div>
              <Button
                onClick={() => setTraderSearch({ sortBy: traderSortBy, query: traderQueryInput.trim() || undefined })}
                disabled={traderSearchLoading}
              >
                {traderSearchLoading ? <RefreshCw className="w-4 h-4 animate-spin mr-1" /> : <Search className="w-4 h-4 mr-1" />}
                Suchen
              </Button>
            </div>

            {traderSearchError && (
              <div className="flex items-start gap-2 text-sm text-destructive">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                {traderSearchError.message}
              </div>
            )}

            {traderSearchData && !traderSearchLoading && (
              <div className="overflow-x-auto border rounded-md">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="text-left p-3 font-medium">Titel</th>
                      <th className="text-left p-3 font-medium">Symbol</th>
                      <th className="text-left p-3 font-medium">Trader</th>
                      <th className="text-left p-3 font-medium">Strategie-Tags</th>
                      <th className="text-left p-3 font-medium">ISIN</th>
                      <th className="text-right p-3 font-medium">Aktionen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {traderSearchData.traders.map((t) => (
                      <tr key={t.symbol} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="p-3">
                          <div className="font-medium max-w-[220px] truncate" title={t.title}>{t.title}</div>
                        </td>
                        <td className="p-3 font-mono text-xs">{t.symbol}</td>
                        <td className="p-3 text-muted-foreground">{t.traderName || "—"}</td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1">
                            {(t.tags || []).slice(0, 4).map((tag: string) => (
                              <span key={tag} className="inline-block px-1.5 py-0.5 text-xs rounded bg-muted text-muted-foreground">{tag}</span>
                            ))}
                          </div>
                        </td>
                        <td className="p-3 font-mono text-xs text-muted-foreground">{t.isin || "—"}</td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7"
                              onClick={() => { const sym = t.symbol.toLowerCase(); setInputSymbol(sym); setSymbol(sym); setPendingScroll(true); }}
                              title="Portfolio dieses Wikifolios laden"
                            >
                              <Eye className="w-3.5 h-3.5 mr-1" />
                              Portfolio anzeigen
                            </Button>
                            {t.wikifolioUrl && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => window.open(t.wikifolioUrl!, "_blank")}
                                title="Auf Wikifolio öffnen"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {traderSearchData.traders.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-muted-foreground">
                          Keine Wikifolios gefunden.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Symbol Input */}
        <div ref={portfolioSectionRef} />
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Wikifolio-Symbol</CardTitle>
            <CardDescription>
              Gib das Symbol des Wikifolios ein (z.B. <code className="text-xs bg-muted px-1 rounded">wfglobalnt</code>)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                value={inputSymbol}
                onChange={e => setInputSymbol(e.target.value.toLowerCase().trim())}
                placeholder="wfglobalnt"
                className="max-w-xs font-mono"
                onKeyDown={e => e.key === "Enter" && setSymbol(inputSymbol)}
              />
              <Button onClick={() => setSymbol(inputSymbol)} disabled={isLoading}>
                {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Abrufen"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Error State */}
        {error && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-destructive">Fehler beim Abrufen</p>
                  <p className="text-sm text-muted-foreground mt-1">{error.message}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Mögliche Ursachen: Falsche Credentials, Wikifolio-API-Änderung, oder das Portfolio ist nicht öffentlich.
                    Versuche die Session zurückzusetzen.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Loading */}
        {isLoading && (
          <Card>
            <CardContent className="pt-6 text-center">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-primary mb-3" />
              <p className="text-muted-foreground">Authentifizierung und Datenabruf läuft…</p>
              <p className="text-xs text-muted-foreground mt-1">Erster Aufruf erfordert Login (~2–5 Sek.)</p>
            </CardContent>
          </Card>
        )}

        {/* Portfolio Summary */}
        {portfolio && !isLoading && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Gesamtwert</p>
                  <p className="text-2xl font-bold mt-1">
                    {portfolio.totalValue.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    <span className="text-sm font-normal text-muted-foreground ml-1">{portfolio.currency}</span>
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Positionen</p>
                  <p className="text-2xl font-bold mt-1">{portfolio.items.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Gruppen</p>
                  <p className="text-2xl font-bold mt-1">{portfolio.groups.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Abgerufen</p>
                  <p className="text-sm font-medium mt-1">
                    {new Date(portfolio.fetchedAt).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(portfolio.fetchedAt).toLocaleDateString("de-CH")}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Group Breakdown */}
            {portfolio.groups.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" />
                    Gruppenaufteilung
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-3">
                    {portfolio.groups.map(group => (
                      <div key={group.type} className="flex items-center gap-2 bg-muted/40 rounded-lg px-3 py-2">
                        <Badge className={groupColors[group.name] || "bg-gray-100 text-gray-800"}>
                          {groupLabels[group.name] || group.name}
                        </Badge>
                        <span className="text-sm font-medium">{group.percentage?.toFixed(1)}%</span>
                        <span className="text-xs text-muted-foreground">
                          {group.value?.toLocaleString("de-CH", { maximumFractionDigits: 0 })} {portfolio.currency}
                        </span>
                        <span className="text-xs text-muted-foreground">({group.items.length} Pos.)</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Import Action */}
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium">In Watchlist importieren</p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        Aktien- und ETF-Positionen ({portfolio.items.filter(i => i.groupName === "equities" || i.groupName === "etfs").length} Titel) in die lokale Watchlist übernehmen.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={importOverwrite}
                        onChange={e => setImportOverwrite(e.target.checked)}
                        className="rounded"
                      />
                      Bestehende überschreiben
                    </label>
                    <Button
                      onClick={() => importMutation.mutate({ symbol, overwriteExisting: importOverwrite })}
                      disabled={importMutation.isPending}
                    >
                      {importMutation.isPending ? (
                        <RefreshCw className="w-4 h-4 animate-spin mr-1" />
                      ) : (
                        <Download className="w-4 h-4 mr-1" />
                      )}
                      Importieren
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => enrichMutation.mutate()}
                      disabled={enrichMutation.isPending}
                      title="Fehlende Sektor/P/E/Div.%-Daten für alle Wikifolio-Titel via EODHD nachladen"
                    >
                      {enrichMutation.isPending ? (
                        <RefreshCw className="w-4 h-4 animate-spin mr-1" />
                      ) : (
                        <BarChart3 className="w-4 h-4 mr-1" />
                      )}
                      Daten anreichern
                    </Button>
                  </div>
                </div>
                {importMutation.isSuccess && (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
                      <CheckCircle2 className="w-4 h-4" />
                      {importMutation.data.imported} Positionen importiert, {importMutation.data.skipped.length} übersprungen
                    </div>
                    {importMutation.data.skipped.length > 0 && (
                      <div className="text-xs border rounded-md divide-y bg-background/60">
                        {importMutation.data.skipped.map((s, i) => (
                          <div key={`${s.isin}-${i}`} className="flex flex-wrap items-center gap-2 px-3 py-1.5">
                            <span className="font-medium max-w-[220px] truncate" title={s.name}>{s.name}</span>
                            <span className="font-mono text-muted-foreground">{s.isin}</span>
                            <span className="text-muted-foreground ml-auto">{s.reason}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Positions Table */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <CardTitle className="text-base">
                    Positionen ({filteredItems.length} von {portfolio.items.length})
                  </CardTitle>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Suche nach Name oder ISIN…"
                      className="pl-8 w-64"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 border-b">
                      <tr>
                        <th className="text-left p-3 font-medium cursor-pointer hover:text-primary select-none" onClick={() => handleSort("name")}>
                          <span className="flex items-center gap-1">Name <ArrowUpDown className="w-3 h-3" /></span>
                        </th>
                        <th className="text-left p-3 font-medium">ISIN</th>
                        <th className="text-left p-3 font-medium">Gruppe</th>
                        <th className="text-right p-3 font-medium cursor-pointer hover:text-primary select-none" onClick={() => handleSort("quantity")}>
                          <span className="flex items-center gap-1 justify-end">Menge <ArrowUpDown className="w-3 h-3" /></span>
                        </th>
                        <th className="text-right p-3 font-medium cursor-pointer hover:text-primary select-none" onClick={() => handleSort("avgPrice")}>
                          <span className="flex items-center gap-1 justify-end">Ø Kaufkurs <ArrowUpDown className="w-3 h-3" /></span>
                        </th>
                        <th className="text-right p-3 font-medium cursor-pointer hover:text-primary select-none" onClick={() => handleSort("close")}>
                          <span className="flex items-center gap-1 justify-end">Kurs <ArrowUpDown className="w-3 h-3" /></span>
                        </th>
                        <th className="text-right p-3 font-medium">G/V</th>
                        <th className="text-right p-3 font-medium cursor-pointer hover:text-primary select-none" onClick={() => handleSort("percentage")}>
                          <span className="flex items-center gap-1 justify-end">Anteil % <ArrowUpDown className="w-3 h-3" /></span>
                        </th>
                        <th className="text-right p-3 font-medium">Link</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredItems.map((item, idx) => {
                        const pnl = getPnL(item);
                        return (
                          <tr key={`${item.isin}-${idx}`} className="border-b hover:bg-muted/30 transition-colors">
                            <td className="p-3">
                              <div className="font-medium max-w-[200px] truncate" title={item.name}>
                                {item.name}
                              </div>
                              {item.partnerName && (
                                <div className="text-xs text-muted-foreground">{item.partnerName}</div>
                              )}
                            </td>
                            <td className="p-3 font-mono text-xs text-muted-foreground">{item.isin || "—"}</td>
                            <td className="p-3">
                              <Badge className={`text-xs ${groupColors[item.groupName] || "bg-gray-100 text-gray-800"}`}>
                                {groupLabels[item.groupName] || item.groupName}
                              </Badge>
                            </td>
                            <td className="p-3 text-right font-mono">{item.quantity?.toLocaleString("de-CH") || "—"}</td>
                            <td className="p-3 text-right font-mono">
                              {item.averagePurchasePrice
                                ? item.averagePurchasePrice.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                : "—"}
                            </td>
                            <td className="p-3 text-right font-mono">
                              {item.close
                                ? item.close.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                : "—"}
                            </td>
                            <td className="p-3 text-right">
                              {pnl !== null ? (
                                <span className={`font-mono font-medium flex items-center justify-end gap-1 ${pnl >= 0 ? "text-green-600" : "text-red-600"}`}>
                                  {pnl >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                  {pnl >= 0 ? "+" : ""}{pnl.toFixed(1)}%
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="p-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-20 bg-muted rounded-full h-1.5">
                                  <div
                                    className="bg-primary h-1.5 rounded-full"
                                    style={{ width: `${Math.min(100, (item.percentage || 0) * 5)}%` }}
                                  />
                                </div>
                                <span className="font-mono text-xs w-12 text-right">
                                  {item.percentage?.toFixed(2) || "0.00"}%
                                </span>
                              </div>
                            </td>
                            <td className="p-3 text-right">
                              {item.link ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => window.open(item.link, "_blank")}
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </Button>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {filteredItems.length === 0 && (
                        <tr>
                          <td colSpan={9} className="p-8 text-center text-muted-foreground">
                            {search ? "Keine Positionen gefunden." : "Keine Positionen vorhanden."}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Transaktionshistorie — welcher Titel wann gekauft/verkauft/erhöht/reduziert */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Transaktionshistorie</CardTitle>
                <CardDescription>
                  Käufe, Verkäufe, Auf- und Abstockungen dieses Wikifolios über die Zeit.
                  Wikifolio führt gewichtsbasiert — es werden keine Stückzahlen ausgewiesen.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {tradesLoading ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">Transaktionen werden geladen…</p>
                ) : tradesError ? (
                  <p className="text-sm text-red-500 py-6 text-center">{tradesError.message}</p>
                ) : !tradesData?.trades?.length ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">Keine Transaktionen gefunden.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                          <th className="py-2 pr-3">Datum</th>
                          <th className="py-2 pr-3">Titel</th>
                          <th className="py-2 pr-3">Aktion</th>
                          <th className="py-2 pr-3 text-right">Gewicht</th>
                          <th className="py-2 text-right">Kurs</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tradesData.trades.map((t: any, idx: number) => {
                          const action = WIKI_ACTION[t.action] ?? { label: t.side, cls: "bg-muted text-muted-foreground" };
                          const dateStr = t.executedAt
                            ? new Date(t.executedAt).toLocaleDateString("de-CH", { year: "numeric", month: "2-digit", day: "2-digit" })
                            : "—";
                          return (
                            <tr key={`${t.externalTradeId ?? t.isin}-${idx}`} className="border-b last:border-0">
                              <td className="py-2 pr-3 whitespace-nowrap tabular-nums">{dateStr}</td>
                              <td className="py-2 pr-3">
                                {t.ticker ? (
                                  <a href={`/aktien/${t.ticker}`} className="text-primary hover:underline">{t.name || t.ticker}</a>
                                ) : (
                                  <span>{t.name || t.isin || "—"}</span>
                                )}
                                {t.isin && <span className="ml-2 text-xs text-muted-foreground">{t.isin}</span>}
                              </td>
                              <td className="py-2 pr-3">
                                <span className={`text-xs px-2 py-0.5 rounded ${action.cls}`}>{action.label}</span>
                              </td>
                              <td className="py-2 pr-3 text-right tabular-nums">
                                {t.weightage != null ? `${t.weightage.toFixed(1)}%` : "—"}
                              </td>
                              <td className="py-2 text-right tabular-nums">
                                {t.executionPrice != null ? t.executionPrice.toFixed(2) : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
