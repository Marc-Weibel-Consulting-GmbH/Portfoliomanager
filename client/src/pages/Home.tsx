import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useState, useMemo, useEffect } from "react";
import { Trash2, Edit2, Plus } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import Newsroom from "./Newsroom";

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const { data: stocks = [], refetch: refetchStocks } = trpc.stocks.list.useQuery();
  const { data: stats } = trpc.stocks.stats.useQuery();
  
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingStock, setEditingStock] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});
  const [hasAppliedEqualWeighting, setHasAppliedEqualWeighting] = useState(false);
  const [activeTab, setActiveTab] = useState("portfolio");
  const [selectedStockForChart, setSelectedStockForChart] = useState<any>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const addStockMutation = trpc.stocks.add.useMutation({
    onSuccess: () => {
      refetchStocks();
      setIsAddDialogOpen(false);
      setFormData({});
    },
  });

  const updateStockMutation = trpc.stocks.update.useMutation({
    onSuccess: () => {
      refetchStocks();
      setEditingStock(null);
      setFormData({});
      setIsEditDialogOpen(false);
      // Reload page to refresh all calculated values
      setTimeout(() => window.location.reload(), 500);
    },
  });

  const deleteStockMutation = trpc.stocks.delete.useMutation({
    onSuccess: async () => {
      await refetchStocks();
      setHasAppliedEqualWeighting(false);
    },
  });

  useEffect(() => {
    if (stocks.length > 0 && !hasAppliedEqualWeighting) {
      const equalWeight = (100 / stocks.length).toFixed(4);
      const needsWeighting = stocks.some(s => !s.portfolioWeight || parseFloat(s.portfolioWeight || "0") === 0);
      
      if (needsWeighting) {
        stocks.forEach(stock => {
          if (!stock.portfolioWeight || parseFloat(stock.portfolioWeight || "0") === 0) {
            updateStockMutation.mutate({ 
              ticker: stock.ticker, 
              portfolioWeight: parseFloat(equalWeight) 
            } as any);
          }
        });
      }
      setHasAppliedEqualWeighting(true);
    }
  }, [stocks.length, stocks]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredStocks = useMemo(() => {
    let filtered = stocks.filter(stock => {
      const matchesCategory = !selectedCategory || stock.category === selectedCategory;
      const matchesSearch = !searchTerm || 
        stock.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        stock.ticker?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesCategory && matchesSearch;
    });

    // Apply sorting
    if (sortField) {
      filtered = [...filtered].sort((a, b) => {
        let aVal: any = a[sortField as keyof typeof a];
        let bVal: any = b[sortField as keyof typeof b];

        // Handle numeric fields
        if (['currentPrice', 'peRatio', 'pegRatio', 'dividendYield', 'portfolioWeight'].includes(sortField)) {
          aVal = parseFloat(aVal || '0');
          bVal = parseFloat(bVal || '0');
        }

        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [stocks, selectedCategory, searchTerm, sortField, sortDirection]);

  const portfolioTotalWeight = useMemo(() => {
    return stocks.reduce((sum, stock) => sum + parseFloat(stock.portfolioWeight || '0'), 0);
  }, [stocks]);

  // Check portfolio weight and show notification
  useEffect(() => {
    if (stocks.length > 0 && portfolioTotalWeight !== 0) {
      const roundedWeight = Math.round(portfolioTotalWeight * 100) / 100;
      if (roundedWeight > 100) {
        // Request notification permission if not granted
        if (Notification.permission === 'default') {
          Notification.requestPermission();
        }
        if (Notification.permission === 'granted') {
          new Notification('Portfolio Gewichtung zu hoch!', {
            body: `Gesamtgewichtung: ${roundedWeight.toFixed(2)}% (${(roundedWeight - 100).toFixed(2)}% über 100%)`,
            icon: '/favicon.png'
          });
        }
      } else if (roundedWeight < 100 && roundedWeight > 50) {
        if (Notification.permission === 'default') {
          Notification.requestPermission();
        }
        if (Notification.permission === 'granted') {
          new Notification('Portfolio Gewichtung zu niedrig!', {
            body: `Gesamtgewichtung: ${roundedWeight.toFixed(2)}% (${(100 - roundedWeight).toFixed(2)}% unter 100%)`,
            icon: '/favicon.png'
          });
        }
      }
    }
  }, [portfolioTotalWeight, stocks.length]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    stocks.forEach(s => {
      if (s.category) cats.add(s.category);
    });
    return Array.from(cats).sort();
  }, [stocks]);

  const handleAddStock = () => {
    addStockMutation.mutate(formData);
  };

  const handleUpdateStock = () => {
    if (editingStock) {
      updateStockMutation.mutate({ ...formData, ticker: editingStock.ticker });
    }
  };

  const handleDeleteStock = (ticker: string) => {
    if (confirm(`Möchtest du ${ticker} wirklich löschen?`)) {
      deleteStockMutation.mutate(ticker);
    }
  };

  const openEditDialog = (stock: any) => {
    setEditingStock(stock);
    setFormData(stock);
    setIsEditDialogOpen(true);
  };

  const openChartDialog = (stock: any) => {
    // Open Yahoo Finance in new tab
    const cleanTicker = stock.ticker.split(':')[0];
    window.open(`https://finance.yahoo.com/quote/${cleanTicker}`, '_blank');
  };

  if (activeTab === "newsroom") {
    return <Newsroom onBackClick={() => setActiveTab("portfolio")} />;
  }

  const totalWeight = parseFloat(stats?.totalPortfolioWeight || "0");
  const avgDividend = parseFloat(stats?.avgDividendYield || "0");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-8 px-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">Portfolio BIG (Balanced Income Growth)</h1>
            <p className="text-blue-100">Verwalte und analysiere dein Aktienportfolio</p>
          </div>
          <img 
            src="/portrait.jpg" 
            alt="Portfolio Manager" 
            className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-lg"
          />
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-400">Fokus</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-slate-300">
                <li className="flex items-start">
                  <span className="text-blue-400 mr-2">•</span>
                  <span>Diversifikation über {categories.length} Sektoren</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-400 mr-2">•</span>
                  <span>Fokus auf Wachstum & Dividenden ({avgDividend.toFixed(2)}% Ø)</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-400 mr-2">•</span>
                  <span>Global diversifiziert ({stocks.length} Positionen)</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-400 mr-2">•</span>
                  <span>Ausgewogen: Tech, Industrie & Defensive</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-400 mr-2">•</span>
                  <span>Langfristiger Vermögensaufbau</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-400">Kategorien</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(() => {
                  const categoryWeights = stocks.reduce((acc: Record<string, number>, stock) => {
                    const category = stock.category || 'Andere';
                    const weight = parseFloat(stock.portfolioWeight || '0');
                    acc[category] = (acc[category] || 0) + weight;
                    return acc;
                  }, {});
                  
                  const sortedCategories = Object.entries(categoryWeights)
                    .sort(([,a], [,b]) => b - a);
                  
                  const top7 = sortedCategories.slice(0, 7);
                  const others = sortedCategories.slice(7);
                  const othersTotal = others.reduce((sum, [, weight]) => sum + weight, 0);
                  
                  const colors = ['bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-yellow-500', 'bg-red-500', 'bg-orange-500', 'bg-pink-500', 'bg-slate-500'];
                  
                  const displayCategories = [...top7];
                  if (othersTotal > 0) {
                    displayCategories.push(['Andere', othersTotal]);
                  }
                  
                  return displayCategories.map(([cat, weight], idx) => (
                    <div key={cat} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${colors[idx]}`}></div>
                        <span className="text-slate-300">{cat}</span>
                      </div>
                      <span className="text-white font-medium">{weight.toFixed(1)}%</span>
                    </div>
                  ));
                })()}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700 border-green-700/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-green-400">Performance & Dividende</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-slate-400 mb-1">YTD Performance (gewichtet)</div>
                  <div className={`text-2xl font-bold ${(() => {
                    const ytdPerf = stocks.reduce((sum, stock) => {
                      const ytd = parseFloat(stock.ytdPerformance || "0");
                      const weight = parseFloat(stock.portfolioWeight || "0");
                      return sum + (ytd * weight / 100);
                    }, 0);
                    return ytdPerf >= 0 ? 'text-green-400' : 'text-red-400';
                  })()}`}>
                    {(() => {
                      const ytdPerf = stocks.reduce((sum, stock) => {
                        const ytd = parseFloat(stock.ytdPerformance || "0");
                        const weight = parseFloat(stock.portfolioWeight || "0");
                        return sum + (ytd * weight / 100);
                      }, 0);
                      return ytdPerf >= 0 ? `+${ytdPerf.toFixed(2)}%` : `${ytdPerf.toFixed(2)}%`;
                    })()}
                  </div>
                </div>
                <div className="border-t border-slate-700 pt-3">
                  <div className="text-xs text-slate-400 mb-1">Ø Div. Rendite (gewichtet)</div>
                  <div className="text-2xl font-bold text-green-400">{avgDividend.toFixed(2)}%</div>
                </div>
                <p className="text-xs text-slate-400">Portfolio: {totalWeight.toFixed(2)}%</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab("portfolio")}
            className={`px-4 py-2 rounded font-medium transition-colors ${
              activeTab === "portfolio"
                ? "bg-blue-600 text-white"
                : "bg-slate-700 text-slate-300 hover:bg-slate-600"
            }`}
          >
            Portfolio
          </button>
          <button
            onClick={() => setActiveTab("newsroom")}
            className={`px-4 py-2 rounded font-medium transition-colors ${
              activeTab === "newsroom"
                ? "bg-purple-600 text-white"
                : "bg-slate-700 text-slate-300 hover:bg-slate-600"
            }`}
          >
            Newsroom
          </button>
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-center">
          <Input
            placeholder="Nach Titel oder Ticker suchen..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 bg-slate-800 border-slate-700 text-white"
          />
          <Select value={selectedCategory || "all"} onValueChange={(v) => setSelectedCategory(v === "all" ? null : v)}>
            <SelectTrigger className="w-full md:w-48 bg-slate-800 border-slate-700 text-white">
              <SelectValue placeholder="Alle Kategorien" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700 text-white">
              <SelectItem value="all" className="text-white hover:bg-slate-700 focus:bg-slate-700 focus:text-white">Alle Kategorien</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat} value={cat} className="text-white hover:bg-slate-700 focus:bg-slate-700 focus:text-white">{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isAuthenticated && (
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                  <Plus className="w-4 h-4 mr-2" />
                  Neue Aktie
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-slate-800 border-slate-700">
                <DialogHeader>
                  <DialogTitle className="text-white">Neue Aktie hinzufügen</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <Input
                    placeholder="Aktientitel"
                    value={formData.companyName || ""}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                  <Input
                    placeholder="Ticker"
                    value={formData.ticker || ""}
                    onChange={(e) => setFormData({ ...formData, ticker: e.target.value })}
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                  <Input
                    placeholder="Kurs"
                    type="number"
                    value={formData.currentPrice || ""}
                    onChange={(e) => setFormData({ ...formData, currentPrice: e.target.value })}
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                  <Select value={formData.category || ""} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                      <SelectValue placeholder="Kategorie wählen" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700 text-white">
                      {categories.map(cat => (
                        <SelectItem key={cat} value={cat} className="text-white hover:bg-slate-700 focus:bg-slate-700 focus:text-white">{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={handleAddStock} className="w-full bg-green-600 hover:bg-green-700">
                    Hinzufügen
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {activeTab === "portfolio" ? (
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Aktien ({filteredStocks.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th onClick={() => handleSort('companyName')} className="text-left py-2 px-2 text-slate-400 cursor-pointer hover:text-white">
                        Titel {sortField === 'companyName' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th onClick={() => handleSort('ticker')} className="text-left py-2 px-2 text-slate-400 cursor-pointer hover:text-white">
                        Ticker {sortField === 'ticker' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th onClick={() => handleSort('currentPrice')} className="text-left py-2 px-2 text-slate-400 cursor-pointer hover:text-white">
                        Kurs {sortField === 'currentPrice' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th onClick={() => handleSort('peRatio')} className="text-left py-2 px-2 text-slate-400 cursor-pointer hover:text-white">
                        P/E {sortField === 'peRatio' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th onClick={() => handleSort('pegRatio')} className="text-left py-2 px-2 text-slate-400 cursor-pointer hover:text-white">
                        PEG {sortField === 'pegRatio' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th onClick={() => handleSort('dividendYield')} className="text-left py-2 px-2 text-slate-400 cursor-pointer hover:text-white">
                        Div. Rendite {sortField === 'dividendYield' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th onClick={() => handleSort('portfolioWeight')} className="text-left py-2 px-2 text-slate-400 cursor-pointer hover:text-white">
                        Portfolio % {sortField === 'portfolioWeight' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th onClick={() => handleSort('category')} className="text-left py-2 px-2 text-slate-400 cursor-pointer hover:text-white">
                        Kategorie {sortField === 'category' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="text-center py-2 px-2 text-slate-400">Info</th>
                      <th className="text-left py-2 px-2 text-slate-400">Aktionen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStocks.map(stock => (
                      <tr key={stock.ticker} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                        <td className="py-2 px-2 text-white">{stock.companyName}</td>
                        <td className="py-2 px-2">
                          <button
                            onClick={() => openChartDialog(stock)}
                            className="text-blue-400 hover:text-blue-300 font-semibold"
                          >
                            {stock.ticker}
                          </button>
                        </td>
                        <td className="py-2 px-2 text-slate-300">{stock.currentPrice} {stock.currency || "USD"}</td>
                        <td className="py-2 px-2 text-slate-300">{stock.peRatio ? parseFloat(stock.peRatio).toFixed(1) : "-"}</td>
                        <td className="py-2 px-2 text-slate-300">{stock.pegRatio ? parseFloat(stock.pegRatio).toFixed(1) : "-"}</td>
                        <td className="py-2 px-2 text-green-400">{stock.dividendYield ? parseFloat(stock.dividendYield).toFixed(1) : "-"}</td>
                        <td className="py-2 px-2 text-slate-300">{parseFloat(stock.portfolioWeight || "0").toFixed(1)}%</td>
                        <td className="py-2 px-2 text-slate-400">{stock.category}</td>
                        <td className="py-2 px-2 text-center">
                          {(stock.moat1 || stock.moat2 || stock.moat3) && (
                            <Dialog>
                              <DialogTrigger asChild>
                                <button className="p-1 hover:bg-slate-600 rounded text-blue-400 hover:text-blue-300">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10"/>
                                    <line x1="12" y1="16" x2="12" y2="12"/>
                                    <line x1="12" y1="8" x2="12.01" y2="8"/>
                                  </svg>
                                </button>
                              </DialogTrigger>
                              <DialogContent className="bg-slate-800 border-slate-700 max-w-2xl">
                                <DialogHeader>
                                  <DialogTitle className="text-white text-xl">{stock.companyName}</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div className="flex items-center gap-4 pb-4 border-b border-slate-700">
                                    <div className="w-16 h-16 rounded-lg bg-white p-2 flex items-center justify-center">
                                      <img 
                                        src={`https://financialmodelingprep.com/image-stock/${stock.ticker.replace(/\.(SW|PA|MI|CO|DE|AS)$/, '')}.png`}
                                        alt={stock.companyName}
                                        className="w-full h-full object-contain"
                                        onError={(e) => {
                                          // Fallback to logo.dev
                                          const domain = stock.companyName.toLowerCase()
                                            .replace(/\s+(inc|corp|ltd|ag|sa|spa|group|holding|technologies|enterprise|healthcare|energy|networks|semiconductor|therapeutics|platforms|solutions).*$/i, '')
                                            .replace(/[^a-z0-9]/g, '');
                                          e.currentTarget.src = `https://img.logo.dev/${domain}.com?token=pk_X-WvJHQ4RfGZNwIeHI-52Q&size=120`;
                                          e.currentTarget.onerror = () => {
                                            // Final fallback to letter avatar
                                            if (e.currentTarget.parentElement) {
                                              e.currentTarget.parentElement.innerHTML = `<div class="w-full h-full flex items-center justify-center text-2xl font-bold text-blue-600">${stock.companyName.charAt(0)}</div>`;
                                            }
                                          };
                                        }}
                                      />
                                    </div>
                                    <div>
                                      <h3 className="text-lg font-semibold text-white">{stock.companyName}</h3>
                                      <p className="text-sm text-slate-400">{stock.ticker}</p>
                                    </div>
                                  </div>
                                  <div>
                                    <h4 className="text-md font-semibold text-blue-400 mb-3">Wettbewerbsvorteile (Moats)</h4>
                                    <ul className="space-y-2">
                                      {stock.moat1 && (
                                        <li className="flex items-start gap-2 text-slate-300">
                                          <span className="text-green-400 mt-1">✓</span>
                                          <span>{stock.moat1}</span>
                                        </li>
                                      )}
                                      {stock.moat2 && (
                                        <li className="flex items-start gap-2 text-slate-300">
                                          <span className="text-green-400 mt-1">✓</span>
                                          <span>{stock.moat2}</span>
                                        </li>
                                      )}
                                      {stock.moat3 && (
                                        <li className="flex items-start gap-2 text-slate-300">
                                          <span className="text-green-400 mt-1">✓</span>
                                          <span>{stock.moat3}</span>
                                        </li>
                                      )}
                                    </ul>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                          )}
                        </td>
                        <td className="py-2 px-2 flex gap-2">
                          {isAuthenticated && (
                            <>
                              <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                                <DialogTrigger asChild>
                                  <button
                                    onClick={() => openEditDialog(stock)}
                                    className="p-1 hover:bg-slate-600 rounded"
                                  >
                                    <Edit2 className="w-4 h-4 text-blue-400" />
                                  </button>
                                </DialogTrigger>
                                <DialogContent className="bg-slate-800 border-slate-700">
                                  <DialogHeader>
                                    <DialogTitle className="text-white">Aktie bearbeiten</DialogTitle>
                                  </DialogHeader>
                                  <div className="space-y-4">
                                    <Input
                                      placeholder="Aktientitel"
                                      value={formData.companyName || ""}
                                      onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                                      className="bg-slate-700 border-slate-600 text-white"
                                    />
                                    <Input
                                      placeholder="Kurs"
                                      type="number"
                                      value={formData.currentPrice || ""}
                                      onChange={(e) => setFormData({ ...formData, currentPrice: e.target.value })}
                                      className="bg-slate-700 border-slate-600 text-white"
                                    />
                                    <Input
                                      placeholder="P/E"
                                      type="number"
                                      value={formData.peRatio || ""}
                                      onChange={(e) => setFormData({ ...formData, peRatio: e.target.value })}
                                      className="bg-slate-700 border-slate-600 text-white"
                                    />
                                    <Input
                                      placeholder="PEG Ratio"
                                      type="number"
                                      value={formData.pegRatio || ""}
                                      onChange={(e) => setFormData({ ...formData, pegRatio: e.target.value })}
                                      className="bg-slate-700 border-slate-600 text-white"
                                    />
                                    <Input
                                      placeholder="Dividendenrendite (%)"
                                      type="number"
                                      value={formData.dividendYield || ""}
                                      onChange={(e) => setFormData({ ...formData, dividendYield: e.target.value })}
                                      className="bg-slate-700 border-slate-600 text-white"
                                    />
                                    <Input
                                      placeholder="Portfolio Gewichtung (%)"
                                      type="number"
                                      value={formData.portfolioWeight || ""}
                                      onChange={(e) => setFormData({ ...formData, portfolioWeight: parseFloat(e.target.value) })}
                                      className="bg-slate-700 border-slate-600 text-white"
                                    />
                                    <Button 
                                      onClick={handleUpdateStock} 
                                      disabled={updateStockMutation.isPending}
                                      className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50"
                                    >
                                      {updateStockMutation.isPending ? "Speichern..." : "Speichern"}
                                    </Button>
                                  </div>
                                </DialogContent>
                              </Dialog>
                              <button
                                onClick={() => handleDeleteStock(stock.ticker)}
                                className="p-1 hover:bg-slate-600 rounded"
                              >
                                <Trash2 className="w-4 h-4 text-red-400" />
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-slate-600 bg-slate-700/50 font-bold">
                      <td colSpan={6} className="py-2 px-2 text-white text-right">Total Portfolio Gewichtung:</td>
                      <td className="py-2 px-2 text-white">
                        <span className={portfolioTotalWeight > 100 ? "text-red-400" : portfolioTotalWeight < 100 ? "text-yellow-400" : "text-green-400"}>
                          {portfolioTotalWeight.toFixed(2)}%
                        </span>
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Newsroom onBackClick={() => setActiveTab("portfolio")} />
        )}


      </div>
    </div>
  );
}
