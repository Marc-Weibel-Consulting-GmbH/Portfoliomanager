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
      const equalWeight = (100 / stocks.length).toFixed(2);
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
  }, [stocks.length]);

  const filteredStocks = useMemo(() => {
    return stocks.filter(stock => {
      const matchesCategory = !selectedCategory || stock.category === selectedCategory;
      const matchesSearch = !searchTerm || 
        stock.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        stock.ticker?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [stocks, selectedCategory, searchTerm]);

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
  };

  const openChartDialog = (stock: any) => {
    // Open TradingView in new tab
    window.open(`https://www.tradingview.com/symbols/${stock.ticker}/`, '_blank');
  };

  if (activeTab === "newsroom") {
    return <Newsroom />;
  }

  const totalWeight = parseFloat(stats?.totalPortfolioWeight || "0");
  const avgDividend = parseFloat(stats?.avgDividendYield || "0");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl font-bold mb-2">Portfolio Analyse</h1>
          <p className="text-blue-100">Verwalte und analysiere dein Aktienportfolio</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-400">Gesamte Aktien</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">{stocks.length}</div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-400">Kategorien</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">{categories.length}</div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700 border-green-700/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-green-400">Ø Div. Rendite (gewichtet)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-400">{avgDividend.toFixed(2)}%</div>
              <p className="text-xs text-slate-400 mt-1">Portfolio: {totalWeight.toFixed(2)}%</p>
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
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="all">Alle Kategorien</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
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
                    <SelectContent className="bg-slate-700 border-slate-600">
                      <SelectItem value="KI Narrativ">KI Narrativ</SelectItem>
                      <SelectItem value="Dividendenaktien">Dividendenaktien</SelectItem>
                      <SelectItem value="Andere">Andere</SelectItem>
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

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Aktien ({filteredStocks.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-2 px-2 text-slate-400">Titel</th>
                    <th className="text-left py-2 px-2 text-slate-400">Ticker</th>
                    <th className="text-left py-2 px-2 text-slate-400">Kurs</th>
                    <th className="text-left py-2 px-2 text-slate-400">P/E</th>
                    <th className="text-left py-2 px-2 text-slate-400">PEG</th>
                    <th className="text-left py-2 px-2 text-slate-400">Div. Rendite</th>
                    <th className="text-left py-2 px-2 text-slate-400">Portfolio %</th>
                    <th className="text-left py-2 px-2 text-slate-400">Kategorie</th>
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
                      <td className="py-2 px-2 text-slate-300">{stock.peRatio || "-"}</td>
                      <td className="py-2 px-2 text-slate-300">{stock.pegRatio || "-"}</td>
                      <td className="py-2 px-2 text-green-400">{stock.dividendYield || "-"}</td>
                      <td className="py-2 px-2 text-slate-300">{parseFloat(stock.portfolioWeight || "0").toFixed(2)}%</td>
                      <td className="py-2 px-2 text-slate-400">{stock.category}</td>
                      <td className="py-2 px-2 flex gap-2">
                        {isAuthenticated && (
                          <>
                            <Dialog>
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
                                  <Button onClick={handleUpdateStock} className="w-full bg-green-600 hover:bg-green-700">
                                    Speichern
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
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>


      </div>
    </div>
  );
}
