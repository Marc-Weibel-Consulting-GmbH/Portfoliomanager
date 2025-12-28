import { useState, useMemo } from "react";
import { useRoute, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronRight, ArrowUpDown, Search } from "lucide-react";
import { StockLogo } from "@/components/StockLogo";

type SortField = 'date' | 'ticker' | 'type' | 'amount';
type SortDirection = 'asc' | 'desc';

export default function PortfolioTransactions() {
  const [, params] = useRoute<{ id: string }>("/portfolio/:id/transactions");
  const portfolioId = params?.id ? parseInt(params.id) : null;

  const [searchTicker, setSearchTicker] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Fetch portfolio details
  const { data: portfolios = [] } = trpc.portfolios.list.useQuery();
  const portfolio = portfolios.find((p: any) => p.id === portfolioId);

  // Fetch transactions
  const { data: transactions = [] } = trpc.portfolioTransactions.list.useQuery(
    { portfolioId: portfolioId! },
    { enabled: !!portfolioId }
  );

  // Fetch all stocks to get company names
  const { data: allStocks = [] } = trpc.stocks.getAll.useQuery();

  // Filter and sort transactions
  const filteredAndSortedTransactions = useMemo(() => {
    let filtered = [...transactions];

    // Filter by ticker
    if (searchTicker) {
      filtered = filtered.filter((tx: any) => 
        tx.ticker.toLowerCase().includes(searchTicker.toLowerCase())
      );
    }

    // Filter by type
    if (filterType !== "all") {
      filtered = filtered.filter((tx: any) => tx.type === filterType);
    }

    // Sort
    filtered.sort((a: any, b: any) => {
      let aVal, bVal;
      
      switch (sortField) {
        case 'date':
          aVal = new Date(a.transactionDate).getTime();
          bVal = new Date(b.transactionDate).getTime();
          break;
        case 'ticker':
          aVal = a.ticker;
          bVal = b.ticker;
          break;
        case 'type':
          aVal = a.type;
          bVal = b.type;
          break;
        case 'amount':
          aVal = Math.abs(a.amount || 0);
          bVal = Math.abs(b.amount || 0);
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [transactions, searchTicker, filterType, sortField, sortDirection]);

  // Toggle sort
  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Get transaction type label
  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'buy': return 'Kauf';
      case 'sell': return 'Verkauf';
      case 'deposit': return 'Einzahlung';
      case 'withdrawal': return 'Auszahlung';
      case 'dividend': return 'Dividende';
      default: return type;
    }
  };

  // Get transaction type color
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'buy': return 'text-blue-400';
      case 'sell': return 'text-orange-400';
      case 'deposit': return 'text-green-400';
      case 'withdrawal': return 'text-red-400';
      case 'dividend': return 'text-purple-400';
      default: return 'text-gray-400';
    }
  };

  if (!portfolio) {
    return (
      <div className="container py-8">
        <p className="text-muted-foreground">Portfolio nicht gefunden</p>
      </div>
    );
  }

  return (
    <div className="container py-8">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href={`/portfolio/${portfolioId}`} className="hover:text-foreground transition-colors">
          Live-Tracking
        </Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-foreground font-medium">Transaktionen</span>
      </div>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">{portfolio.name}</h1>
        <p className="text-muted-foreground">Alle Transaktionen</p>
      </div>

      {/* Filters */}
      <Card className="gradient-card border-border/50 mb-6">
        <CardHeader>
          <CardTitle className="text-white">Filter & Sortierung</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search by Ticker */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Ticker suchen..."
                value={searchTicker}
                onChange={(e) => setSearchTicker(e.target.value)}
                className="pl-10 bg-muted border-border text-foreground"
              />
            </div>

            {/* Filter by Type */}
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="bg-muted border-border text-foreground">
                <SelectValue placeholder="Typ filtern" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Typen</SelectItem>
                <SelectItem value="buy">Kauf</SelectItem>
                <SelectItem value="sell">Verkauf</SelectItem>
                <SelectItem value="deposit">Einzahlung</SelectItem>
                <SelectItem value="withdrawal">Auszahlung</SelectItem>
                <SelectItem value="dividend">Dividende</SelectItem>
              </SelectContent>
            </Select>

            {/* Sort Field */}
            <Select value={sortField} onValueChange={(val) => setSortField(val as SortField)}>
              <SelectTrigger className="bg-muted border-border text-foreground">
                <SelectValue placeholder="Sortieren nach" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Datum</SelectItem>
                <SelectItem value="ticker">Ticker</SelectItem>
                <SelectItem value="type">Typ</SelectItem>
                <SelectItem value="amount">Betrag</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => toggleSort(sortField)}
              className="text-foreground border-border hover:bg-muted"
            >
              <ArrowUpDown className="w-4 h-4 mr-2" />
              {sortDirection === 'asc' ? 'Aufsteigend' : 'Absteigend'}
            </Button>
            <span className="text-sm text-muted-foreground">
              {filteredAndSortedTransactions.length} von {transactions.length} Transaktionen
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card className="gradient-card border-border/50">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left p-4 text-muted-foreground font-medium">Datum</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Ticker</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Name</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Typ</th>
                  <th className="text-right p-4 text-muted-foreground font-medium">Stückzahl</th>
                  <th className="text-right p-4 text-muted-foreground font-medium">Preis</th>
                  <th className="text-right p-4 text-muted-foreground font-medium">Betrag</th>
                  <th className="text-right p-4 text-muted-foreground font-medium">Gebühren</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Notizen</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center p-8 text-muted-foreground">
                      Keine Transaktionen gefunden
                    </td>
                  </tr>
                ) : (
                  filteredAndSortedTransactions.map((tx: any) => {
                    const stock = allStocks.find((s: any) => s.ticker === tx.ticker);
                    const stockName = stock?.companyName || tx.ticker;

                    return (
                      <tr key={tx.id} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                        <td className="p-4 text-foreground">
                          {new Date(tx.transactionDate).toLocaleDateString('de-CH')}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <StockLogo ticker={tx.ticker} companyName={stockName} size="sm" />
                            <span className="font-medium text-white">{tx.ticker}</span>
                          </div>
                        </td>
                        <td className="p-4 text-foreground max-w-xs truncate">
                          {stockName}
                        </td>
                        <td className="p-4">
                          <span className={`font-medium ${getTypeColor(tx.type)}`}>
                            {getTypeLabel(tx.type)}
                          </span>
                        </td>
                        <td className="p-4 text-right text-foreground">
                          {tx.shares ? Math.round(tx.shares).toLocaleString('de-CH') : '-'}
                        </td>
                        <td className="p-4 text-right text-foreground">
                          {tx.price ? `${tx.currency || 'CHF'} ${tx.price.toFixed(2)}` : '-'}
                        </td>
                        <td className="p-4 text-right font-medium">
                          <span className={
                            tx.type === 'buy' || tx.type === 'withdrawal' 
                              ? 'text-red-400' 
                              : 'text-green-400'
                          }>
                            {tx.amount ? `CHF ${Math.round(Math.abs(tx.amount)).toLocaleString('de-CH')}` : '-'}
                          </span>
                        </td>
                        <td className="p-4 text-right text-muted-foreground">
                          {tx.fees ? `CHF ${tx.fees.toFixed(2)}` : '-'}
                        </td>
                        <td className="p-4 text-muted-foreground text-sm max-w-xs truncate">
                          {tx.notes || '-'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
