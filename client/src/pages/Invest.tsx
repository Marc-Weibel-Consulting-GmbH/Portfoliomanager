import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect, useRef, useMemo } from "react";
import { Search, TrendingUp, TrendingDown, Minus, Filter, X, ArrowRight, BarChart3, Loader2 } from "lucide-react";
import { useLocation, useSearch } from "wouter";

// Filter dimension types persisted via the ?filter= URL param
type FilterDimension = "sektor" | "kategorie" | "region";
const FILTER_DIMENSIONS: FilterDimension[] = ["sektor", "kategorie", "region"];
const FILTER_LABELS: Record<FilterDimension, string> = {
  sektor: "Sektor",
  kategorie: "Kategorie",
  region: "Region",
};

// Small local chip component matching the app's design tokens
function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
        active
          ? "bg-[#00CFC1] text-black font-medium"
          : "bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10"
      }`}
    >
      {label}
    </button>
  );
}

export default function Invest() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sectorFilter, setSectorFilter] = useState<string>("all");
  const [signalFilter, setSignalFilter] = useState<string>("all");
  const [minDividend, setMinDividend] = useState<string>("");
  const [maxPe, setMaxPe] = useState<string>("");
  const [hasSearched, setHasSearched] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Active filter dimension (chip group), persisted in the URL via ?filter=
  const [activeDimension, setActiveDimension] = useState<FilterDimension>("sektor");
  // Selected chip value within the active dimension ("all" = no value filter)
  const [activeValue, setActiveValue] = useState<string>("all");

  // Read ?filter= from the URL on load / when it changes (e.g. via /categories,
  // /sectors redirects). When a filter param is present, open the filter UI and
  // activate the corresponding grouping.
  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const filterParam = params.get("filter");
    if (filterParam && (FILTER_DIMENSIONS as string[]).includes(filterParam)) {
      setActiveDimension(filterParam as FilterDimension);
      setShowFilters(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchString]);

  // Write the active dimension to the URL (?filter=) so it is shareable and
  // survives reload. Reset the selected chip value when switching dimensions.
  const selectDimension = (dim: FilterDimension) => {
    setActiveDimension(dim);
    setActiveValue("all");
    const params = new URLSearchParams(searchString);
    params.set("filter", dim);
    setLocation(`/aktien?${params.toString()}`, { replace: true });
  };

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length >= 2) {
        setDebouncedQuery(searchQuery);
        setHasSearched(true);
      } else {
        setDebouncedQuery("");
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Yahoo Finance search
  const { data: searchResults, isLoading: searchLoading } = trpc.invest.search.useQuery(
    { query: debouncedQuery },
    { enabled: debouncedQuery.length >= 2 }
  );

  // Filter from watchlist universe
  const { data: filterResults, isLoading: filterLoading } = trpc.invest.filter.useQuery(
    {
      category: categoryFilter === 'all' ? undefined : categoryFilter,
      sector: sectorFilter === 'all' ? undefined : sectorFilter,
      signalType: (signalFilter === 'all' ? undefined : signalFilter) as any,
      minDividendYield: minDividend ? parseFloat(minDividend) : undefined,
      maxPeRatio: maxPe ? parseFloat(maxPe) : undefined,
      limit: 50,
    },
    { enabled: showFilters }
  );

  // Filter options
  const { data: filterOptions } = trpc.invest.filterOptions.useQuery(undefined, {
    enabled: showFilters,
  });

  // Derive available chip values for each dimension from the already-loaded
  // universe rows (unique values) so no extra backend endpoint is needed.
  // Region is derived from the existing `country` field on each stock.
  const universe = filterResults?.results ?? [];
  const dimensionOptions = useMemo<Record<FilterDimension, string[]>>(() => {
    const collect = (fn: (s: typeof universe[number]) => string | null | undefined) =>
      Array.from(
        new Set(
          universe
            .map(fn)
            .filter((v): v is string => Boolean(v && v.trim()))
        )
      ).sort((a, b) => a.localeCompare(b));
    return {
      sektor: collect((s) => s.sector),
      kategorie: collect((s) => s.category),
      region: collect((s) => s.country),
    };
  }, [universe]);

  // Apply the active chip value to the loaded universe (client-side). The
  // backend already filters by Sektor/Kategorie via the Select dropdowns; the
  // chips provide quick, URL-persisted filtering on top of the loaded list.
  const visibleUniverse = useMemo(() => {
    if (activeValue === "all") return universe;
    return universe.filter((s) => {
      const field =
        activeDimension === "sektor"
          ? s.sector
          : activeDimension === "kategorie"
          ? s.category
          : s.country;
      return field === activeValue;
    });
  }, [universe, activeDimension, activeValue]);

  const getSignalBadge = (type: string | null) => {
    if (type === "buy") return <Badge className="bg-green-500/10 text-green-600 border-green-500/20"><TrendingUp className="w-3 h-3 mr-1" />Kaufen</Badge>;
    if (type === "sell") return <Badge className="bg-red-500/10 text-red-600 border-red-500/20"><TrendingDown className="w-3 h-3 mr-1" />Verkaufen</Badge>;
    return <Badge variant="outline"><Minus className="w-3 h-3 mr-1" />Halten</Badge>;
  };

  const clearFilters = () => {
    setCategoryFilter("all");
    setSectorFilter("all");
    setSignalFilter("all");
    setMinDividend("");
    setMaxPe("");
    setActiveValue("all");
  };

  const hasActiveFilters = (categoryFilter && categoryFilter !== 'all') || (sectorFilter && sectorFilter !== 'all') || (signalFilter && signalFilter !== 'all') || minDividend || maxPe;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Hero Section with Search */}
        <div className={`flex flex-col items-center justify-center transition-all duration-500 ${hasSearched || showFilters ? "pt-4 pb-4" : "pt-16 pb-12"}`}>
          {!hasSearched && !showFilters && (
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold tracking-tight mb-3">Investieren</h1>
              <p className="text-lg text-muted-foreground max-w-md">
                Finden Sie die besten Aktien für Ihr Portfolio
              </p>
            </div>
          )}
          {(hasSearched || showFilters) && (
            <h1 className="text-2xl font-bold tracking-tight mb-4 self-start">Investieren</h1>
          )}

          {/* Google-style Search Bar */}
          <div className="w-full max-w-2xl relative">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                placeholder="Aktie suchen (z.B. Apple, MSFT, Nestlé)..."
                className="pl-12 pr-12 h-14 text-lg rounded-full border-2 shadow-sm focus:shadow-md transition-shadow"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-8 w-8"
                  onClick={() => { setSearchQuery(""); setDebouncedQuery(""); setHasSearched(false); }}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>

            {/* Quick actions below search */}
            <div className="flex items-center justify-center gap-3 mt-4">
              <Button
                variant={showFilters ? "default" : "outline"}
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="rounded-full"
              >
                <Filter className="w-4 h-4 mr-2" />
                Filter & Kategorien
              </Button>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="rounded-full text-muted-foreground">
                  <X className="w-3 h-3 mr-1" />
                  Filter zurücksetzen
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Filter Chips (Sektor / Kategorie / Region) — URL-persisted via ?filter= */}
        {showFilters && (
          <div className="space-y-3 rounded-xl border border-white/10 bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] p-4">
            {/* Dimension switch */}
            <div className="flex flex-wrap items-center gap-2">
              {FILTER_DIMENSIONS.map((dim) => (
                <FilterChip
                  key={dim}
                  label={FILTER_LABELS[dim]}
                  active={activeDimension === dim}
                  onClick={() => selectDimension(dim)}
                />
              ))}
            </div>
            {/* Values for the active dimension */}
            <div className="flex flex-wrap items-center gap-2">
              <FilterChip
                label="Alle"
                active={activeValue === "all"}
                onClick={() => setActiveValue("all")}
              />
              {dimensionOptions[activeDimension].length === 0 ? (
                <span className="text-xs text-gray-500">
                  Keine {FILTER_LABELS[activeDimension]}-Werte im Universum
                </span>
              ) : (
                dimensionOptions[activeDimension].map((value) => (
                  <FilterChip
                    key={value}
                    label={value}
                    active={activeValue === value}
                    onClick={() => setActiveValue(value)}
                  />
                ))
              )}
            </div>
          </div>
        )}

        {/* Filter Panel */}
        {showFilters && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Filter (aus Aktien-Universum, max. 50 Ergebnisse)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Kategorie</label>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Alle" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle</SelectItem>
                      {filterOptions?.categories.map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Sektor</label>
                  <Select value={sectorFilter} onValueChange={setSectorFilter}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Alle" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle</SelectItem>
                      {filterOptions?.sectors.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Signal</label>
                  <Select value={signalFilter} onValueChange={setSignalFilter}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Alle" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle</SelectItem>
                      <SelectItem value="buy">Kaufen</SelectItem>
                      <SelectItem value="hold">Halten</SelectItem>
                      <SelectItem value="sell">Verkaufen</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Min. Dividende %</label>
                  <Input
                    type="number"
                    placeholder="z.B. 2"
                    className="h-9"
                    value={minDividend}
                    onChange={(e) => setMinDividend(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Max. P/E</label>
                  <Input
                    type="number"
                    placeholder="z.B. 25"
                    className="h-9"
                    value={maxPe}
                    onChange={(e) => setMaxPe(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search Results */}
        {debouncedQuery && (
          <div>
            <h2 className="text-lg font-semibold mb-3">
              Suchergebnisse für "{debouncedQuery}"
              {searchLoading && <Loader2 className="inline w-4 h-4 ml-2 animate-spin" />}
            </h2>
            {searchResults?.results && searchResults.results.length > 0 ? (
              <div className="grid gap-2">
                {searchResults.results.map((stock) => (
                  <Card
                    key={stock.ticker}
                    className="hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => setLocation(`/invest/${stock.ticker}`)}
                  >
                    <CardContent className="py-3 px-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                          <span className="font-mono font-bold text-sm text-primary">{stock.ticker.slice(0, 4)}</span>
                        </div>
                        <div>
                          <div className="font-semibold">{stock.companyName}</div>
                          <div className="text-sm text-muted-foreground flex items-center gap-2">
                            <span className="font-mono">{stock.ticker}</span>
                            <span>•</span>
                            <span>{stock.exchange}</span>
                            {stock.quoteType === "ETF" && <Badge variant="outline" className="text-xs">ETF</Badge>}
                          </div>
                        </div>
                      </div>
                      <ArrowRight className="w-5 h-5 text-muted-foreground" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : !searchLoading ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Keine Ergebnisse für "{debouncedQuery}" gefunden
                </CardContent>
              </Card>
            ) : null}
          </div>
        )}

        {/* Filter Results from Universe */}
        {showFilters && (
          <div>
            <h2 className="text-lg font-semibold mb-3">
              Aktien-Universum
              {filterLoading && <Loader2 className="inline w-4 h-4 ml-2 animate-spin" />}
              {filterResults && <span className="text-sm font-normal text-muted-foreground ml-2">({visibleUniverse.length} Ergebnisse)</span>}
            </h2>
            {visibleUniverse.length > 0 ? (
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
                      <th className="text-right p-3 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleUniverse.map((stock) => (
                      <tr
                        key={stock.ticker}
                        className="border-b hover:bg-muted/30 cursor-pointer transition-colors"
                        onClick={() => setLocation(`/invest/${stock.ticker}`)}
                      >
                        <td className="p-3 font-mono font-semibold">{stock.ticker}</td>
                        <td className="p-3">{stock.companyName}</td>
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
                        <td className="p-3 text-right">
                          <ArrowRight className="w-4 h-4 text-muted-foreground" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : !filterLoading ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Keine Aktien im Universum gefunden.</p>
                  <p className="text-xs mt-1">Füge Titel über die Admin-Watchlist hinzu.</p>
                </CardContent>
              </Card>
            ) : null}
          </div>
        )}

        {/* Empty state when nothing searched */}
        {!hasSearched && !showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto mt-4">
            <Card className="hover:bg-muted/50 cursor-pointer transition-colors" onClick={() => { setShowFilters(true); setCategoryFilter("Dividendenaktien"); }}>
              <CardContent className="py-6 text-center">
                <TrendingUp className="w-8 h-8 mx-auto mb-2 text-green-600" />
                <div className="font-semibold">Dividendenaktien</div>
                <div className="text-xs text-muted-foreground mt-1">Stabile Erträge</div>
              </CardContent>
            </Card>
            <Card className="hover:bg-muted/50 cursor-pointer transition-colors" onClick={() => { setShowFilters(true); setCategoryFilter("Wachstumsaktien"); }}>
              <CardContent className="py-6 text-center">
                <BarChart3 className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                <div className="font-semibold">Wachstumsaktien</div>
                <div className="text-xs text-muted-foreground mt-1">Hohe Rendite</div>
              </CardContent>
            </Card>
            <Card className="hover:bg-muted/50 cursor-pointer transition-colors" onClick={() => { setShowFilters(true); setSignalFilter("buy"); }}>
              <CardContent className="py-6 text-center">
                <TrendingUp className="w-8 h-8 mx-auto mb-2 text-emerald-600" />
                <div className="font-semibold">Kaufsignale</div>
                <div className="text-xs text-muted-foreground mt-1">Aktuelle Empfehlungen</div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
