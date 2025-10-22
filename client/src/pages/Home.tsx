import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { Trash2, Edit2, Plus } from "lucide-react";

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const { data: stocks = [], refetch: refetchStocks } = trpc.stocks.list.useQuery();
  const { data: stats } = trpc.stocks.stats.useQuery();
  
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingStock, setEditingStock] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});

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
    onSuccess: () => {
      refetchStocks();
    },
  });

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl font-bold mb-2">Portfolio Analyse</h1>
          <p className="text-blue-100">Verwalte und analysiere dein Aktienportfolio</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 space-y-6">
        {/* Statistics Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-400">Gesamte Aktien</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-white">{stats.totalStocks}</div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800 border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-400">Kategorien</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-white">{stats.categoryCounts.length}</div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800 border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-400">Ø Dividendenrendite</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-400">{stats.avgDividendYield}%</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Controls */}
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <Input
            placeholder="Nach Titel oder Ticker suchen..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
          />

          <div className="w-full md:w-48">
            <select
              value={selectedCategory || ""}
              onChange={(e) => setSelectedCategory(e.target.value || null)}
              className="w-full bg-slate-800 border border-slate-700 text-white px-3 py-2 rounded"
            >
              <option value="">Alle Kategorien</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {isAuthenticated && (
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700 w-full md:w-auto">
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
                    placeholder="Unternehmensname"
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
                    placeholder="Aktueller Kurs"
                    value={formData.currentPrice || ""}
                    onChange={(e) => setFormData({ ...formData, currentPrice: e.target.value })}
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                  <Input
                    placeholder="Währung"
                    value={formData.currency || ""}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                  <Input
                    placeholder="P/E Ratio"
                    value={formData.peRatio || ""}
                    onChange={(e) => setFormData({ ...formData, peRatio: e.target.value })}
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                  <Input
                    placeholder="PEG Ratio"
                    value={formData.pegRatio || ""}
                    onChange={(e) => setFormData({ ...formData, pegRatio: e.target.value })}
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                  <Input
                    placeholder="Dividendenrendite (%)"
                    value={formData.dividendYield || ""}
                    onChange={(e) => setFormData({ ...formData, dividendYield: e.target.value })}
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                  <Input
                    placeholder="Kategorie"
                    value={formData.category || ""}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                  <Input
                    placeholder="Moat 1"
                    value={formData.moat1 || ""}
                    onChange={(e) => setFormData({ ...formData, moat1: e.target.value })}
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                  <Input
                    placeholder="Moat 2"
                    value={formData.moat2 || ""}
                    onChange={(e) => setFormData({ ...formData, moat2: e.target.value })}
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                  <Input
                    placeholder="Moat 3"
                    value={formData.moat3 || ""}
                    onChange={(e) => setFormData({ ...formData, moat3: e.target.value })}
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                  <Button
                    onClick={handleAddStock}
                    disabled={addStockMutation.isPending}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    {addStockMutation.isPending ? "Wird hinzugefügt..." : "Hinzufügen"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Stocks Table */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Aktien ({filteredStocks.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-3 px-4 font-semibold text-slate-300">Titel</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-300">Ticker</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-300">Kurs</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-300">P/E</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-300">PEG</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-300">Div. Rendite</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-300">Kategorie</th>
                    {isAuthenticated && <th className="text-left py-3 px-4 font-semibold text-slate-300">Aktionen</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredStocks.length === 0 ? (
                    <tr>
                      <td colSpan={isAuthenticated ? 7 : 6} className="text-center py-8 text-slate-400">
                        Keine Aktien gefunden
                      </td>
                    </tr>
                  ) : (
                    filteredStocks.map(stock => (
                      <tr key={stock.ticker} className="border-b border-slate-700 hover:bg-slate-700/50">
                        <td className="py-3 px-4 text-white font-medium">{stock.companyName}</td>
                        <td className="py-3 px-4">
                          <a href={`/stock/${stock.ticker}`} className="text-blue-400 hover:text-blue-300 hover:underline cursor-pointer">
                            {stock.ticker}
                          </a>
                        </td>
                        <td className="py-3 px-4 text-white">{stock.currentPrice} {stock.currency}</td>
                        <td className="py-3 px-4 text-white">{stock.peRatio || "-"}</td>
                        <td className="py-3 px-4 text-white">{stock.pegRatio || "-"}</td>
                        <td className="py-3 px-4 text-green-400">{stock.dividendYield ? `${stock.dividendYield}%` : "-"}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-1 bg-slate-700 text-slate-200 rounded text-xs">
                            {stock.category}
                          </span>
                        </td>
                        {isAuthenticated && (
                          <td className="py-3 px-4 flex gap-2">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openEditDialog(stock)}
                                  className="bg-slate-700 border-slate-600 hover:bg-slate-600"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="bg-slate-800 border-slate-700">
                                <DialogHeader>
                                  <DialogTitle className="text-white">Aktie bearbeiten</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <Input
                                    placeholder="Unternehmensname"
                                    value={formData.companyName || ""}
                                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                                    className="bg-slate-700 border-slate-600 text-white"
                                  />
                                  <Input
                                    placeholder="Aktueller Kurs"
                                    value={formData.currentPrice || ""}
                                    onChange={(e) => setFormData({ ...formData, currentPrice: e.target.value })}
                                    className="bg-slate-700 border-slate-600 text-white"
                                  />
                                  <Input
                                    placeholder="P/E Ratio"
                                    value={formData.peRatio || ""}
                                    onChange={(e) => setFormData({ ...formData, peRatio: e.target.value })}
                                    className="bg-slate-700 border-slate-600 text-white"
                                  />
                                  <Input
                                    placeholder="PEG Ratio"
                                    value={formData.pegRatio || ""}
                                    onChange={(e) => setFormData({ ...formData, pegRatio: e.target.value })}
                                    className="bg-slate-700 border-slate-600 text-white"
                                  />
                                  <Input
                                    placeholder="Dividendenrendite (%)"
                                    value={formData.dividendYield || ""}
                                    onChange={(e) => setFormData({ ...formData, dividendYield: e.target.value })}
                                    className="bg-slate-700 border-slate-600 text-white"
                                  />
                                  <Input
                                    placeholder="Kategorie"
                                    value={formData.category || ""}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    className="bg-slate-700 border-slate-600 text-white"
                                  />
                                  <Input
                                    placeholder="Moat 1"
                                    value={formData.moat1 || ""}
                                    onChange={(e) => setFormData({ ...formData, moat1: e.target.value })}
                                    className="bg-slate-700 border-slate-600 text-white"
                                  />
                                  <Input
                                    placeholder="Moat 2"
                                    value={formData.moat2 || ""}
                                    onChange={(e) => setFormData({ ...formData, moat2: e.target.value })}
                                    className="bg-slate-700 border-slate-600 text-white"
                                  />
                                  <Input
                                    placeholder="Moat 3"
                                    value={formData.moat3 || ""}
                                    onChange={(e) => setFormData({ ...formData, moat3: e.target.value })}
                                    className="bg-slate-700 border-slate-600 text-white"
                                  />
                                  <Button
                                    onClick={handleUpdateStock}
                                    disabled={updateStockMutation.isPending}
                                    className="w-full bg-blue-600 hover:bg-blue-700"
                                  >
                                    {updateStockMutation.isPending ? "Wird aktualisiert..." : "Speichern"}
                                  </Button>
                                </div>
                              </DialogContent>
                            </Dialog>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteStock(stock.ticker)}
                              disabled={deleteStockMutation.isPending}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

