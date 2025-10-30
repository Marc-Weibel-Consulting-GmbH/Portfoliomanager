import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useState, useMemo, useEffect } from "react";
import { Trash2, Edit2, Plus, Download, LogOut } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import Newsroom from "./Newsroom";
import Transactions from "./Transactions";
import Performance from "./Performance";
import Research from "./Research";
import Import from "./Import";
import { Admin } from "./Admin";
import About from "./About";
import Reviews from "./Reviews";
import Optimizer from "./Optimizer";
import OptimizerResults from "./OptimizerResults";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast, Toaster } from 'sonner';

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const { data: stocks = [], refetch: refetchStocks } = trpc.stocks.list.useQuery(undefined, {
    enabled: isAuthenticated || !!user,
  });
  const { data: stats } = trpc.stocks.stats.useQuery(undefined, {
    enabled: isAuthenticated || !!user,
  });
  
  // All useState hooks MUST be called before any early returns
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
  const [tickerSearchQuery, setTickerSearchQuery] = useState("");
  const [showTickerSuggestions, setShowTickerSuggestions] = useState(false);
  const [editingInfoStock, setEditingInfoStock] = useState<any>(null);
  const [editingFinanzenStock, setEditingFinanzenStock] = useState<any>(null);
  const [infoFormData, setInfoFormData] = useState<any>({});
  const [finanzenFormData, setFinanzenFormData] = useState<any>({});
  const [optimizerInputs, setOptimizerInputs] = useState<any>(null);
  const [showOptimizerResults, setShowOptimizerResults] = useState(false);
  
  // Show welcome screen for non-authenticated users
  const showWelcomeScreen = !isAuthenticated && !user;
  
  const { data: tickerSuggestions = [] } = trpc.stocks.searchTicker.useQuery(
    tickerSearchQuery,
    { enabled: tickerSearchQuery.length >= 2 }
  );

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
      // Reload page to refresh all calculated values (weights, stats, etc.)
      setTimeout(() => window.location.reload(), 500);
    },
  });

  const refreshDataMutation = trpc.stocks.refreshData.useMutation({
    onSuccess: (data: any) => {
      toast.success("Daten aktualisiert", {
        description: data.message || `YTD Performance und News aktualisiert`,
      });
      setTimeout(() => refetchStocks(), 2000);
    },
    onError: (error: any) => {
      toast.error("Fehler bei der Aktualisierung", {
        description: error.message,
      });
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

  // Check if user has paid access (or is owner)
  const hasPaidAccess = user?.hasPaid === 1 || user?.role === 'admin';
  
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

    // Access control: Free users see only 1 stock per category
    if (!hasPaidAccess) {
      const categorySeen = new Set<string>();
      filtered = filtered.filter(stock => {
        if (!stock.category) return true;
        if (categorySeen.has(stock.category)) return false;
        categorySeen.add(stock.category);
        return true;
      });
    }

    return filtered;
  }, [stocks, selectedCategory, searchTerm, sortField, sortDirection, hasPaidAccess]);

  const portfolioTotalWeight = useMemo(() => {
    return stocks.reduce((sum, stock) => sum + parseFloat(stock.portfolioWeight || '0'), 0);
  }, [stocks]);

  // Check portfolio weight and show notification
  useEffect(() => {
    // Check if Notification API is supported
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return;
    }
    
    if (stocks.length > 0 && portfolioTotalWeight !== 0) {
      const roundedWeight = Math.round(portfolioTotalWeight * 100) / 100;
      if (roundedWeight > 100) {
        // Request notification permission if not granted
        if (Notification.permission === 'default') {
          Notification.requestPermission().catch(() => {});
        }
        if (Notification.permission === 'granted') {
          try {
            new Notification('Portfolio Gewichtung zu hoch!', {
              body: `Gesamtgewichtung: ${roundedWeight.toFixed(2)}% (${(roundedWeight - 100).toFixed(2)}% über 100%)`,
              icon: '/favicon.png'
            });
          } catch (e) {
            console.warn('Notification failed:', e);
          }
        }
      } else if (roundedWeight < 100 && roundedWeight > 50) {
        if (Notification.permission === 'default') {
          Notification.requestPermission().catch(() => {});
        }
        if (Notification.permission === 'granted') {
          try {
            new Notification('Portfolio Gewichtung zu niedrig!', {
              body: `Gesamtgewichtung: ${roundedWeight.toFixed(2)}% (${(100 - roundedWeight).toFixed(2)}% unter 100%)`,
              icon: '/favicon.png'
            });
          } catch (e) {
            console.warn('Notification failed:', e);
          }
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
    const equalWeight = (100 / (stocks.length + 1)).toFixed(4);
    addStockMutation.mutate({
      ...formData,
      portfolioWeight: parseFloat(equalWeight),
      currentPrice: parseFloat(formData.currentPrice || "0")
    });
  };

  const handleUpdateStock = () => {
    if (editingStock) {
      updateStockMutation.mutate({ ...formData, ticker: editingStock.ticker });
    }
  };

  const handleDeleteStock = (ticker: string) => {
    const comment = prompt(`Möchtest du ${ticker} wirklich löschen?\n\nOptional: Grund für die Löschung angeben:`);
    if (comment !== null) { // null means cancelled
      deleteStockMutation.mutate({ ticker, comment: comment || undefined } as any);
    }
  };

  const openEditDialog = (stock: any) => {
    setEditingStock(stock);
    setFormData(stock);
    setIsEditDialogOpen(true);
  };

  const startEditingInfo = (stock: any) => {
    setEditingInfoStock(stock);
    setInfoFormData({
      moat1: stock.moat1 || '',
      moat2: stock.moat2 || '',
      moat3: stock.moat3 || '',
    });
  };

  const startEditingFinanzen = (stock: any) => {
    setEditingFinanzenStock(stock);
    setFinanzenFormData({
      financialHighlight1: stock.financialHighlight1 || '',
      financialHighlight2: stock.financialHighlight2 || '',
      financialHighlight3: stock.financialHighlight3 || '',
    });
  };

  const saveInfoMutation = trpc.stocks.update.useMutation({
    onSuccess: () => {
      refetchStocks();
      setEditingInfoStock(null);
      toast.success('Wettbewerbsvorteile aktualisiert');
    },
    onError: (error) => {
      toast.error('Fehler beim Aktualisieren: ' + error.message);
    },
  });

  const saveFinanzenMutation = trpc.stocks.update.useMutation({
    onSuccess: () => {
      refetchStocks();
      setEditingFinanzenStock(null);
      toast.success('Finanzielle Highlights aktualisiert');
    },
    onError: (error) => {
      toast.error('Fehler beim Aktualisieren: ' + error.message);
    },
  });

  const saveInfo = () => {
    if (editingInfoStock) {
      saveInfoMutation.mutate({
        ticker: editingInfoStock.ticker,
        ...infoFormData,
      });
    }
  };

  const saveFinanzen = () => {
    if (editingFinanzenStock) {
      saveFinanzenMutation.mutate({
        ticker: editingFinanzenStock.ticker,
        ...finanzenFormData,
      });
    }
  };

  const openChartDialog = (stock: any) => {
    // Open Yahoo Finance in new tab
    const cleanTicker = stock.ticker.split(':')[0];
    window.open(`https://finance.yahoo.com/quote/${cleanTicker}`, '_blank');
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(20);
    doc.text('Portfolio BIG (Balanced Income Growth)', 14, 20);
    
    // Date
    doc.setFontSize(10);
    doc.text(`Exportiert am: ${new Date().toLocaleDateString('de-DE')} ${new Date().toLocaleTimeString('de-DE')}`, 14, 28);
    
    // Portfolio Stats
    doc.setFontSize(12);
    doc.text('Portfolio-Übersicht', 14, 38);
    doc.setFontSize(10);
    const ytdPerf = filteredStocks.reduce((sum, stock) => {
      const ytd = parseFloat(stock.ytdPerformance || "0");
      const weight = parseFloat(stock.portfolioWeight || "0");
      return sum + (ytd * weight / 100);
    }, 0);
    doc.text(`YTD Performance: ${ytdPerf >= 0 ? '+' : ''}${ytdPerf.toFixed(1)}%`, 14, 44);
    doc.text(`Ø Dividendenrendite: ${avgDividend.toFixed(2)}%`, 14, 50);
    doc.text(`Portfolio Gewichtung: ${totalWeight.toFixed(2)}%`, 14, 56);
    doc.text(`Anzahl Aktien: ${filteredStocks.length}`, 14, 62);
    
    // Table
    autoTable(doc, {
      startY: 70,
      head: [['Titel', 'Ticker', 'Kurs', 'P/E', 'PEG', 'Div.%', 'Port.%', 'Kategorie']],
      body: filteredStocks.map(stock => [
        stock.companyName,
        stock.ticker,
        `${parseFloat(stock.currentPrice || '0').toFixed(2)} ${stock.currency}`,
        stock.peRatio ? parseFloat(stock.peRatio).toFixed(1) : '-',
        stock.pegRatio ? parseFloat(stock.pegRatio).toFixed(1) : '-',
        stock.dividendYield ? parseFloat(stock.dividendYield).toFixed(1) : '-',
        parseFloat(stock.portfolioWeight || '0').toFixed(2),
        stock.category || '-'
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [37, 99, 235] },
    });
    
    // Save
    doc.save(`Portfolio_BIG_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  if (activeTab === "newsroom") {
    return <Newsroom onBackClick={() => setActiveTab("portfolio")} />;
  }

  if (activeTab === "transactions") {
    // Premium feature: Only paid users can access Transactions
    if (!hasPaidAccess) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white p-8">
          <div className="max-w-4xl mx-auto">
            <button
              onClick={() => setActiveTab("portfolio")}
              className="mb-6 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
            >
              ← Zurück
            </button>
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-2xl text-white flex items-center gap-2">
                  🔒 Premium-Funktion
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-slate-300 text-lg">
                  Der Transactions-Bereich ist nur für Premium-Mitglieder verfügbar.
                </p>
                <p className="text-slate-400">
                  Upgrade jetzt für CHF 10.- und erhalte Zugriff auf:
                </p>
                <ul className="list-disc list-inside text-slate-300 space-y-2 ml-4">
                  <li>Vollständige Transaction-Historie</li>
                  <li>Alle 63 Aktien (statt nur 13)</li>
                  <li>Unbegrenzter Zugriff auf alle Features</li>
                </ul>
                <button
                  onClick={() => setActiveTab("about")}
                  className="mt-6 px-6 py-3 bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-semibold rounded-lg transition-all transform hover:scale-105"
                >
                  Jetzt upgraden
                </button>
              </CardContent>
            </Card>
          </div>
        </div>
      );
    }
    return <Transactions onBackClick={() => setActiveTab("portfolio")} />;
  }

  if (activeTab === "performance") {
    return <Performance onBackClick={() => setActiveTab("portfolio")} />;
  }

  if (activeTab === "research") {
    return <Research onBackClick={() => setActiveTab("portfolio")} />;
  }

  if (activeTab === "import") {
    return <Import onBackClick={() => setActiveTab("portfolio")} />;
  }

  if (activeTab === "admin") {
    return <Admin onBackClick={() => setActiveTab("portfolio")} />;
  }

  if (activeTab === "about") {
    return <About onBackClick={() => setActiveTab("portfolio")} />;
  }

  if (activeTab === "reviews") {
    return <Reviews onBackClick={() => setActiveTab("portfolio")} />;
  }

  if (activeTab === "optimizer") {
    // Premium feature check
    if (!user?.hasPaid) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-slate-900">
          <Card className="bg-slate-800 border-slate-700 max-w-md">
            <CardHeader>
              <CardTitle className="text-white text-center">🔒 Premium-Funktion</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-slate-300">
                Der Portfolio Optimizer ist eine Premium-Funktion.
              </p>
              <p className="text-slate-400 text-sm">
                Erhalten Sie Zugriff auf:
              </p>
              <ul className="text-left text-slate-400 text-sm space-y-2 max-w-xs mx-auto">
                <li>✓ Intelligente Portfolio-Optimierung</li>
                <li>✓ Dividendenrendite-Anpassung</li>
                <li>✓ Sharpe-Ratio-Optimierung</li>
                <li>✓ Anlegertyp-basierte Empfehlungen</li>
                <li>✓ PDF-Export</li>
              </ul>
              <div className="flex gap-2 justify-center pt-4">
                <Button
                  onClick={() => setActiveTab("about")}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  Jetzt upgraden (CHF 10.-)
                </Button>
                <Button
                  onClick={() => setActiveTab("portfolio")}
                  variant="outline"
                  className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
                >
                  Zurück
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    if (showOptimizerResults && optimizerInputs) {
      return (
        <OptimizerResults
          inputs={optimizerInputs}
          onBack={() => {
            // Keep inputs when going back for adjustment
            setShowOptimizerResults(false);
            // Don't set to null - keep the inputs for adjustment
          }}
        />
      );
    }
    return (
      <Optimizer
        onShowResults={(inputs) => {
          setOptimizerInputs(inputs);
          setShowOptimizerResults(true);
        }}
        onBack={() => setActiveTab("portfolio")}
        initialInputs={optimizerInputs || undefined}
      />
    );
  }

  const totalWeight = parseFloat(stats?.totalPortfolioWeight || "0");
  const avgDividend = parseFloat(stats?.avgDividendYield || "0");

  // Show welcome screen for non-authenticated users
  if (showWelcomeScreen) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
        <div className="text-center text-white max-w-2xl">
          <h1 className="text-5xl font-bold mb-4">Willkommen bei Portfolio BIG!</h1>
          <p className="text-xl mb-8 text-blue-200">Balanced Income Growth - Verwalte und analysiere dein Aktienportfolio</p>
          <div className="space-x-4">
            <a href="/login" className="inline-block px-8 py-4 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold text-lg transition-colors">
              Anmelden
            </a>
            <a href="/register" className="inline-block px-8 py-4 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold text-lg transition-colors">
              Kostenlos registrieren
            </a>
          </div>
          <p className="mt-6 text-sm text-slate-400">
            Nach der Registrierung erhältst du Zugriff auf 1 Aktie pro Kategorie (13 von 63).<br />
            Für vollen Zugriff: CHF 10.- einmalig
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Toaster richColors position="top-right" />
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-8 px-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">Portfolio BIG (Balanced Income Growth)</h1>
            <p className="text-blue-100">Verwalte und analysiere dein Aktienportfolio</p>
          </div>
          <div className="flex items-center gap-3">
            <img 
              src="/portrait.jpg" 
              alt="Portfolio Manager" 
              className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-lg"
            />
            {(isAuthenticated || user) && (
              <Button
                onClick={() => {
                  fetch('/api/trpc/auth.logout', { method: 'POST' })
                    .then(() => window.location.href = '/login')
                    .catch(console.error);
                }}
                variant="outline"
                size="sm"
                className="bg-red-600 border-red-500 text-white hover:bg-red-700 hover:border-red-600"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            )}
          </div>
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
                      <span className="text-white font-medium">{weight.toFixed(2)}%</span>
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
                      return ytdPerf >= 0 ? `+${ytdPerf.toFixed(1)}%` : `${ytdPerf.toFixed(1)}%`;
                    })()}
                  </div>
                </div>
                <div className="border-t border-slate-700 pt-3">
                  <div className="text-xs text-slate-400 mb-1">Ø Div. Rendite (gewichtet)</div>
                  <div className="text-2xl font-bold text-green-400">{avgDividend.toFixed(2)}%</div>
                </div>
                <div className="border-t border-slate-700 pt-3">
                  <div className="text-xs text-slate-400 mb-1">Total Portfolio</div>
                  <div className={`text-2xl font-bold ${
                    Math.abs(totalWeight - 100) < 0.1 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {totalWeight.toFixed(2)}%
                  </div>
                </div>
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
            onClick={() => setActiveTab("optimizer")}
            className={`px-4 py-2 rounded font-medium transition-colors ${
              activeTab === "optimizer"
                ? "bg-cyan-600 text-white"
                : "bg-slate-700 text-slate-300 hover:bg-slate-600"
            }`}
          >
            Optimizer
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
          <button
            onClick={() => setActiveTab("transactions")}
            className={`px-4 py-2 rounded font-medium transition-colors ${
              activeTab === "transactions"
                ? "bg-orange-600 text-white"
                : "bg-slate-700 text-slate-300 hover:bg-slate-600"
            }`}
          >
            Transactions
          </button>
          <button
            onClick={() => setActiveTab("performance")}
            className={`px-4 py-2 rounded font-medium transition-colors ${
              activeTab === "performance"
                ? "bg-green-600 text-white"
                : "bg-slate-700 text-slate-300 hover:bg-slate-600"
            }`}
          >
            Performance
          </button>
          <button
            onClick={() => setActiveTab("research")}
            className={`px-4 py-2 rounded font-medium transition-colors ${
              activeTab === "research"
                ? "bg-indigo-600 text-white"
                : "bg-slate-700 text-slate-300 hover:bg-slate-600"
            }`}
          >
            Research
          </button>
          {isAuthenticated && (
            <>
              <button
                onClick={() => setActiveTab("import")}
                className={`px-4 py-2 rounded font-medium transition-colors ${
                  activeTab === "import"
                    ? "bg-teal-600 text-white"
                    : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                }`}
              >
                Import
              </button>
              <button
                onClick={() => setActiveTab("admin")}
                className={`px-4 py-2 rounded font-medium transition-colors ${
                  activeTab === "admin"
                    ? "bg-purple-600 text-white"
                    : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                }`}
              >
                Admin
              </button>
            </>
          )}
          <button
            onClick={() => setActiveTab("about")}
            className={`px-4 py-2 rounded font-medium transition-colors ${
              activeTab === "about"
                ? "bg-indigo-600 text-white"
                : "bg-slate-700 text-slate-300 hover:bg-slate-600"
            }`}
          >
            Über mich
          </button>
          <button
            onClick={() => setActiveTab("reviews")}
            className={`px-4 py-2 rounded font-medium transition-colors ${
              activeTab === "reviews"
                ? "bg-green-600 text-white"
                : "bg-slate-700 text-slate-300 hover:bg-slate-600"
            }`}
          >
            Bewertungen
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
            <Button onClick={() => refreshDataMutation.mutate()} className="bg-blue-600 hover:bg-blue-700 text-white">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </Button>
          )}
          <Button onClick={exportToPDF} className="bg-green-600 hover:bg-green-700 text-white">
            <Download className="w-4 h-4 mr-2" />
            PDF Export
          </Button>
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
                  <div className="relative">
                    <Input
                      placeholder="Firmenname oder Ticker suchen..."
                      value={tickerSearchQuery}
                      onChange={(e) => {
                        setTickerSearchQuery(e.target.value);
                        setShowTickerSuggestions(true);
                      }}
                      onFocus={() => setShowTickerSuggestions(true)}
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                    {showTickerSuggestions && tickerSuggestions.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-slate-700 border border-slate-600 rounded-md shadow-lg max-h-60 overflow-y-auto">
                        {tickerSuggestions.map((suggestion: any) => (
                          <button
                            key={suggestion.symbol}
                            type="button"
                            onClick={() => {
                              setFormData({
                                ...formData,
                                companyName: suggestion.shortname || suggestion.longname,
                                ticker: suggestion.symbol,
                              });
                              setTickerSearchQuery(suggestion.symbol);
                              setShowTickerSuggestions(false);
                            }}
                            className="w-full px-4 py-2 text-left hover:bg-slate-600 text-white"
                          >
                            <div className="font-medium">{suggestion.shortname || suggestion.longname}</div>
                            <div className="text-sm text-slate-400">
                              {suggestion.symbol} • {suggestion.exchDisp || suggestion.exchange}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
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
                    placeholder="Kurs per 31.12. Vorjahr"
                    type="number"
                    step="0.01"
                    value={formData.ytdStartPrice || ""}
                    onChange={(e) => setFormData({ ...formData, ytdStartPrice: e.target.value })}
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                  <Input
                    placeholder="Aktueller Kurs"
                    type="number"
                    step="0.01"
                    value={formData.currentPrice || ""}
                    onChange={(e) => setFormData({ ...formData, currentPrice: e.target.value })}
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                  <Input
                    placeholder="Portfolio-Gewicht (%)"
                    type="number"
                    step="0.01"
                    value={formData.portfolioWeight || ""}
                    onChange={(e) => setFormData({ ...formData, portfolioWeight: e.target.value })}
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
                  <Textarea
                    placeholder="Kommentar (optional) - z.B. Grund für Kauf, Strategie, etc."
                    value={formData.comment || ""}
                    onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
                    className="bg-slate-700 border-slate-600 text-white"
                    rows={3}
                  />
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
              {!hasPaidAccess && (
                <div className="mb-4 p-4 bg-gradient-to-r from-blue-900/40 to-purple-900/40 border border-blue-700 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-white font-semibold mb-1">🔒 Eingeschränkter Zugriff</h3>
                      <p className="text-slate-300 text-sm">
                        Du siehst nur 1 Aktie pro Kategorie. Upgrade für CHF 10.- für Vollzugriff auf alle {stocks.length} Aktien.
                      </p>
                    </div>
                    <Button
                      onClick={() => setActiveTab("about")}
                      className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold"
                    >
                      Jetzt upgraden
                    </Button>
                  </div>
                </div>
              )}
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
                      <th className="text-center py-2 px-2 text-slate-400">Finanzen</th>
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
                        <td className="py-2 px-2 text-slate-300">{parseFloat(stock.portfolioWeight || "0").toFixed(2)}%</td>
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
                                    <div className="flex items-center justify-between mb-3">
                                      <h4 className="text-md font-semibold text-blue-400">Wettbewerbsvorteile (Moats)</h4>
                                      {isAuthenticated && editingInfoStock?.ticker !== stock.ticker && (
                                        <button
                                          onClick={() => startEditingInfo(stock)}
                                          className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
                                        >
                                          <Edit2 className="w-4 h-4" />
                                          Bearbeiten
                                        </button>
                                      )}
                                    </div>
                                    {editingInfoStock?.ticker === stock.ticker ? (
                                      <div className="space-y-3">
                                        <div>
                                          <label className="text-sm text-slate-400">Moat 1</label>
                                          <Textarea
                                            value={infoFormData.moat1}
                                            onChange={(e) => setInfoFormData({...infoFormData, moat1: e.target.value})}
                                            className="bg-slate-700 border-slate-600 text-white mt-1 min-h-[60px]"
                                            placeholder="Erster Wettbewerbsvorteil"
                                          />
                                        </div>
                                        <div>
                                          <label className="text-sm text-slate-400">Moat 2</label>
                                          <Textarea
                                            value={infoFormData.moat2}
                                            onChange={(e) => setInfoFormData({...infoFormData, moat2: e.target.value})}
                                            className="bg-slate-700 border-slate-600 text-white mt-1 min-h-[60px]"
                                            placeholder="Zweiter Wettbewerbsvorteil"
                                          />
                                        </div>
                                        <div>
                                          <label className="text-sm text-slate-400">Moat 3</label>
                                          <Textarea
                                            value={infoFormData.moat3}
                                            onChange={(e) => setInfoFormData({...infoFormData, moat3: e.target.value})}
                                            className="bg-slate-700 border-slate-600 text-white mt-1 min-h-[60px]"
                                            placeholder="Dritter Wettbewerbsvorteil"
                                          />
                                        </div>
                                        <div className="flex gap-2 pt-2">
                                          <Button onClick={saveInfo} className="bg-blue-600 hover:bg-blue-700">
                                            Speichern
                                          </Button>
                                          <Button onClick={() => setEditingInfoStock(null)} variant="outline" className="border-slate-600 text-white hover:text-white">
                                            Abbrechen
                                          </Button>
                                        </div>
                                      </div>
                                    ) : (
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
                                        {!stock.moat1 && !stock.moat2 && !stock.moat3 && (
                                          <p className="text-slate-400 italic">Keine Wettbewerbsvorteile definiert</p>
                                        )}
                                      </ul>
                                    )}
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                          )}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <Dialog>
                              <DialogTrigger asChild>
                                <button className="p-1 hover:bg-slate-600 rounded text-green-400 hover:text-green-300">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="12" y1="1" x2="12" y2="23"/>
                                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
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
                                          const domain = stock.companyName.toLowerCase()
                                            .replace(/\s+(inc|corp|ltd|ag|sa|spa|group|holding|technologies|enterprise|healthcare|energy|networks|semiconductor|therapeutics|platforms|solutions).*$/i, '')
                                            .replace(/[^a-z0-9]/g, '');
                                          e.currentTarget.src = `https://img.logo.dev/${domain}.com?token=pk_X-WvJHQ4RfGZNwIeHI-52Q&size=120`;
                                          e.currentTarget.onerror = () => {
                                            if (e.currentTarget.parentElement) {
                                              e.currentTarget.parentElement.innerHTML = `<div class="w-full h-full flex items-center justify-center text-2xl font-bold text-green-600">${stock.companyName.charAt(0)}</div>`;
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
                                    <div className="flex items-center justify-between mb-3">
                                      <h4 className="text-md font-semibold text-green-400">Finanzielle Highlights</h4>
                                      {isAuthenticated && editingFinanzenStock?.ticker !== stock.ticker && (
                                        <button
                                          onClick={() => startEditingFinanzen(stock)}
                                          className="text-sm text-green-400 hover:text-green-300 flex items-center gap-1"
                                        >
                                          <Edit2 className="w-4 h-4" />
                                          Bearbeiten
                                        </button>
                                      )}
                                    </div>
                                    {editingFinanzenStock?.ticker === stock.ticker ? (
                                      <div className="space-y-3">
                                        <div>
                                          <label className="text-sm text-slate-400">Highlight 1</label>
                                          <Textarea
                                            value={finanzenFormData.financialHighlight1}
                                            onChange={(e) => setFinanzenFormData({...finanzenFormData, financialHighlight1: e.target.value})}
                                            className="bg-slate-700 border-slate-600 text-white mt-1 min-h-[60px]"
                                            placeholder="Erstes finanzielles Highlight"
                                          />
                                        </div>
                                        <div>
                                          <label className="text-sm text-slate-400">Highlight 2</label>
                                          <Textarea
                                            value={finanzenFormData.financialHighlight2}
                                            onChange={(e) => setFinanzenFormData({...finanzenFormData, financialHighlight2: e.target.value})}
                                            className="bg-slate-700 border-slate-600 text-white mt-1 min-h-[60px]"
                                            placeholder="Zweites finanzielles Highlight"
                                          />
                                        </div>
                                        <div>
                                          <label className="text-sm text-slate-400">Highlight 3</label>
                                          <Textarea
                                            value={finanzenFormData.financialHighlight3}
                                            onChange={(e) => setFinanzenFormData({...finanzenFormData, financialHighlight3: e.target.value})}
                                            className="bg-slate-700 border-slate-600 text-white mt-1 min-h-[60px]"
                                            placeholder="Drittes finanzielles Highlight"
                                          />
                                        </div>
                                        <div className="flex gap-2 pt-2">
                                          <Button onClick={saveFinanzen} className="bg-green-600 hover:bg-green-700">
                                            Speichern
                                          </Button>
                                          <Button onClick={() => setEditingFinanzenStock(null)} variant="outline" className="border-slate-600 text-white hover:text-white">
                                            Abbrechen
                                          </Button>
                                        </div>
                                      </div>
                                    ) : (
                                      <ul className="space-y-2">
                                        {stock.financialHighlight1 && (
                                          <li className="flex items-start gap-2 text-slate-300">
                                            <span className="text-green-400 mt-1">$</span>
                                            <span>{stock.financialHighlight1}</span>
                                          </li>
                                        )}
                                        {stock.financialHighlight2 && (
                                          <li className="flex items-start gap-2 text-slate-300">
                                            <span className="text-green-400 mt-1">$</span>
                                            <span>{stock.financialHighlight2}</span>
                                          </li>
                                        )}
                                        {stock.financialHighlight3 && (
                                          <li className="flex items-start gap-2 text-slate-300">
                                            <span className="text-green-400 mt-1">$</span>
                                            <span>{stock.financialHighlight3}</span>
                                          </li>
                                        )}
                                        {!stock.financialHighlight1 && !stock.financialHighlight2 && !stock.financialHighlight3 && (
                                          <p className="text-slate-400 italic">Keine finanziellen Highlights definiert</p>
                                        )}
                                      </ul>
                                    )}
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
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
                                    <div>
                                      <label className="block text-sm font-medium text-slate-300 mb-1">Aktientitel</label>
                                      <Input
                                        placeholder="Aktientitel"
                                        value={formData.companyName || ""}
                                        onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                                        className="bg-slate-700 border-slate-600 text-white"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-slate-300 mb-1">Kurs per 31.12. Vorjahr</label>
                                      <Input
                                        placeholder="0.00"
                                        type="number"
                                        step="0.01"
                                        value={formData.ytdStartPrice || ""}
                                        onChange={(e) => setFormData({ ...formData, ytdStartPrice: e.target.value })}
                                        className="bg-slate-700 border-slate-600 text-white"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-slate-300 mb-1">Aktueller Kurs</label>
                                      <Input
                                        placeholder="0.00"
                                        type="number"
                                        step="0.01"
                                        value={formData.currentPrice || ""}
                                        onChange={(e) => setFormData({ ...formData, currentPrice: e.target.value })}
                                        className="bg-slate-700 border-slate-600 text-white"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-slate-300 mb-1">P/E Ratio</label>
                                      <Input
                                        placeholder="0.0"
                                        type="number"
                                        value={formData.peRatio || ""}
                                        onChange={(e) => setFormData({ ...formData, peRatio: e.target.value })}
                                        className="bg-slate-700 border-slate-600 text-white"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-slate-300 mb-1">PEG Ratio</label>
                                      <Input
                                        placeholder="0.0"
                                        type="number"
                                        value={formData.pegRatio || ""}
                                        onChange={(e) => setFormData({ ...formData, pegRatio: e.target.value })}
                                        className="bg-slate-700 border-slate-600 text-white"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-slate-300 mb-1">Dividendenrendite (%)</label>
                                      <Input
                                        placeholder="0.0"
                                        type="number"
                                        value={formData.dividendYield || ""}
                                        onChange={(e) => setFormData({ ...formData, dividendYield: e.target.value })}
                                        className="bg-slate-700 border-slate-600 text-white"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-slate-300 mb-1">Portfolio Gewichtung (%)</label>
                                      <Input
                                        placeholder="0.0"
                                        type="number"
                                        value={formData.portfolioWeight || ""}
                                        onChange={(e) => setFormData({ ...formData, portfolioWeight: parseFloat(e.target.value) })}
                                        className="bg-slate-700 border-slate-600 text-white"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-slate-300 mb-1">Kommentar (optional)</label>
                                      <Textarea
                                        placeholder="z.B. Grund für Änderung, Strategie, etc."
                                        value={formData.comment || ""}
                                        onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
                                        className="bg-slate-700 border-slate-600 text-white"
                                        rows={3}
                                      />
                                    </div>
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
    </>
  );
}
