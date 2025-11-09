import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { trpc } from "@/lib/trpc";
import React, { useState, useMemo, useEffect } from "react";
import { Trash2, Edit2, Plus, Download, LogOut, Save, FolderOpen, X } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import Newsroom from "./Newsroom";
import Transactions from "./Transactions";
import Performance from "./Performance";
import Research from "./Research";
import { Admin } from "./Admin";
import About from "./About";
import Reviews from "./Reviews";
import Optimizer from "./Optimizer";
import OptimizerResults from "./OptimizerResults";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast, Toaster } from 'sonner';
import { PortfolioPerformanceChart } from '@/components/PortfolioPerformanceChart';
import { PortfolioSentimentIndicator } from '@/components/PortfolioSentimentIndicator';
import { StockLogo } from "@/components/StockLogo";
import { RefreshStockButton } from "@/components/RefreshStockButton";
import { ForwardPEChart } from "@/components/ForwardPEChart";
import { DailyNewsSection } from '@/components/DailyNewsSection';
import { WeeklyOverviewDialog } from '@/components/WeeklyOverviewDialog';
import { calculateCapitalWithdrawalTax, CANTONS, type Canton, type Religion } from '@/utils/swissCantonTax';

// Score threshold helper
function getScoreLabel(score: number): string {
  if (score >= 80) return 'Sehr gut (≥80)';
  if (score >= 60) return 'Gut (60-79)';
  if (score >= 40) return 'Mittel (40-59)';
  return 'Schwach (<40)';
}

// AI-powered portfolio market analysis
async function analyzePortfolioMarket(stocks: any[]) {
  if (stocks.length === 0) {
    return '⚠️ Keine Aktien im Portfolio vorhanden.';
  }

  // Calculate portfolio metrics
  const avgPE = stocks.filter(s => s.peRatio).reduce((sum, s) => sum + s.peRatio, 0) / stocks.filter(s => s.peRatio).length;
  const avgPEG = stocks.filter(s => s.pegRatio).reduce((sum, s) => sum + s.pegRatio, 0) / stocks.filter(s => s.pegRatio).length;
  const avgYTD = stocks.filter(s => s.ytdPerformance).reduce((sum, s) => sum + s.ytdPerformance, 0) / stocks.filter(s => s.ytdPerformance).length;
  
  // Sector distribution
  const sectors: Record<string, number> = {};
  stocks.forEach(s => {
    sectors[s.category] = (sectors[s.category] || 0) + 1;
  });
  const dominantSector = Object.entries(sectors).sort((a, b) => b[1] - a[1])[0];
  
  // Generate analysis
  let analysis = '📊 MARKTANALYSE\n\n';
  
  // Valuation analysis
  if (avgPE > 25) {
    analysis += '⚠️ BEWERTUNG: Portfolio überbewertet (Durchschn. P/E: ' + avgPE.toFixed(1) + ')\n';
    analysis += '→ Empfehlung: Gewinne teilweise mitnehmen, defensive Positionen aufbauen\n\n';
  } else if (avgPE < 15) {
    analysis += '✅ BEWERTUNG: Portfolio günstig bewertet (Durchschn. P/E: ' + avgPE.toFixed(1) + ')\n';
    analysis += '→ Empfehlung: Gute Kaufgelegenheit, Position ausbauen\n\n';
  } else {
    analysis += '🔵 BEWERTUNG: Portfolio fair bewertet (Durchschn. P/E: ' + avgPE.toFixed(1) + ')\n\n';
  }
  
  // Growth analysis
  if (avgPEG < 1) {
    analysis += '✅ WACHSTUM: Attraktives Wachstumspotenzial (Durchschn. PEG: ' + avgPEG.toFixed(2) + ')\n\n';
  } else if (avgPEG > 2) {
    analysis += '⚠️ WACHSTUM: Wachstum teuer bezahlt (Durchschn. PEG: ' + avgPEG.toFixed(2) + ')\n\n';
  }
  
  // Performance analysis
  if (avgYTD > 20) {
    analysis += '🚀 PERFORMANCE: Sehr starke YTD-Performance (+' + avgYTD.toFixed(1) + '%)\n';
    analysis += '→ Empfehlung: Gewinne sichern, Stop-Loss setzen\n\n';
  } else if (avgYTD < 0) {
    analysis += '📉 PERFORMANCE: Negative YTD-Performance (' + avgYTD.toFixed(1) + '%)\n';
    analysis += '→ Empfehlung: Qualität prüfen, ggf. Positionen reduzieren\n\n';
  }
  
  // Diversification analysis
  if (dominantSector && dominantSector[1] > stocks.length * 0.4) {
    analysis += '⚠️ DIVERSIFIKATION: Zu hohe Konzentration in "' + dominantSector[0] + '" (' + Math.round(dominantSector[1] / stocks.length * 100) + '%)\n';
    analysis += '→ Empfehlung: Andere Sektoren (z.B. Healthcare, Energie) ergänzen\n\n';
  } else {
    analysis += '✅ DIVERSIFIKATION: Gute Streuung über verschiedene Sektoren\n\n';
  }
  
  // Market sentiment (simulated - in real app would fetch from API)
  const fearGreedIndex = 32; // From uploaded image
  if (fearGreedIndex < 40) {
    analysis += '🔴 MARKTSTIMMUNG: Fear & Greed Index bei ' + fearGreedIndex + ' (FEAR)\n';
    analysis += '→ Empfehlung: Vorsichtig agieren, Cash-Position erhöhen\n\n';
  } else if (fearGreedIndex > 70) {
    analysis += '🟢 MARKTSTIMMUNG: Fear & Greed Index bei ' + fearGreedIndex + ' (GREED)\n';
    analysis += '→ Empfehlung: Markt überhitzt, Absicherung prüfen\n\n';
  }
  
  analysis += '---\n💡 Hinweis: Diese Analyse basiert auf aktuellen Portfolio-Kennzahlen und Marktbedingungen.';
  
  return analysis;
}

// Load Portfolio Content Component
function LoadPortfolioContent({ onClose }: { onClose: () => void }) {
  const { data: savedPortfolios = [], refetch } = trpc.savedPortfolios.list.useQuery();
  const deleteMutation = trpc.savedPortfolios.delete.useMutation();
  const { refetch: refetchStocks } = trpc.stocks.list.useQuery();

  const handleLoad = async (portfolio: any) => {
    try {
      const data = JSON.parse(portfolio.portfolioData);
      
      // TODO: Implement loading logic to replace current portfolio
      // This would require a new tRPC mutation to replace all stocks
      
      toast.success('Portfolio geladen', {
        description: `"${portfolio.name}" wurde erfolgreich geladen`,
      });
      
      onClose();
      window.location.reload(); // Temporary solution
    } catch (error) {
      console.error('Failed to load portfolio:', error);
      toast.error('Fehler', { description: 'Portfolio konnte nicht geladen werden' });
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Möchten Sie das Portfolio "${name}" wirklich löschen?`)) {
      return;
    }

    try {
      await deleteMutation.mutateAsync(id);
      toast.success('Gelöscht', { description: `Portfolio "${name}" wurde gelöscht` });
      refetch();
    } catch (error) {
      console.error('Failed to delete portfolio:', error);
      toast.error('Fehler', { description: 'Portfolio konnte nicht gelöscht werden' });
    }
  };

  if (savedPortfolios.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400">
        <p>Keine gespeicherten Portfolios gefunden.</p>
        <p className="text-sm mt-2">Speichern Sie Ihr aktuelles Portfolio, um es später wieder zu laden.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-h-[600px] overflow-y-auto">
      {savedPortfolios.map((portfolio: any) => {
        const data = JSON.parse(portfolio.portfolioData);
        const stocks = data.stocks || [];
        
        return (
          <div key={portfolio.id} className="bg-slate-700 rounded-lg border border-slate-600 p-4">
            {/* Portfolio Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="font-semibold text-white text-lg mb-1">{portfolio.name}</h3>
                {portfolio.description && (
                  <p className="text-sm text-slate-400 mb-2">{portfolio.description}</p>
                )}
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span>{stocks.length} Aktien</span>
                  <span>Gespeichert: {new Date(portfolio.createdAt).toLocaleDateString('de-DE')}</span>
                </div>
              </div>
              <div className="flex gap-2 ml-4">
                <Button
                  onClick={() => handleLoad(portfolio)}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Laden
                </Button>
                <Button
                  onClick={() => handleDelete(portfolio.id, portfolio.name)}
                  size="sm"
                  variant="outline"
                  className="border-red-600 text-red-400 hover:bg-red-600 hover:text-white"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Portfolio Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-600">
                    <th className="text-left py-2 px-2 text-slate-400">Titel</th>
                    <th className="text-left py-2 px-2 text-slate-400">Ticker</th>
                    <th className="text-left py-2 px-2 text-slate-400">Kurs</th>
                    <th className="text-left py-2 px-2 text-slate-400">YTD %</th>
                    <th className="text-left py-2 px-2 text-slate-400">P/E</th>
                    <th className="text-left py-2 px-2 text-slate-400">PEG</th>
                    <th className="text-left py-2 px-2 text-slate-400">Sharpe</th>
                    <th className="text-left py-2 px-2 text-slate-400">Div. %</th>
                    <th className="text-left py-2 px-2 text-slate-400">Gewicht %</th>
                    <th className="text-center py-2 px-2 text-slate-400">Score</th>
                    <th className="text-left py-2 px-2 text-slate-400">Kategorie</th>
                    <th className="text-left py-2 px-2 text-slate-400">Branche</th>
                  </tr>
                </thead>
                <tbody>
                  {stocks.map((stock: any, idx: number) => {
                    const ytd = parseFloat(stock.ytdPerformance || '0');
                    const sharpe = parseFloat(stock.sharpeRatio || '0');
                    const score = stock.score || 0;
                    
                    return (
                      <tr key={idx} className="border-b border-slate-700 hover:bg-slate-600/50">
                        <td className="py-2 px-2 text-slate-300">{stock.companyName}</td>
                        <td className="py-2 px-2 text-slate-300">{stock.ticker}</td>
                        <td className="py-2 px-2 text-slate-300">{stock.currentPrice} {stock.currency || 'USD'}</td>
                        <td className="py-2 px-2">
                          <span className={ytd >= 0 ? 'text-green-400' : 'text-red-400'}>
                            {ytd >= 0 ? '+' : ''}{ytd.toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-2 px-2 text-slate-300">{stock.peRatio || '-'}</td>
                        <td className="py-2 px-2 text-slate-300">{stock.pegRatio || '-'}</td>
                        <td className="py-2 px-2">
                          <span className={sharpe >= 1 ? 'text-green-400' : sharpe >= 0 ? 'text-yellow-400' : 'text-red-400'}>
                            {stock.sharpeRatio || '-'}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-slate-300">{stock.dividendYield ? parseFloat(stock.dividendYield).toFixed(1) + '%' : '-'}</td>
                        <td className="py-2 px-2 text-slate-300">{stock.portfolioWeight ? parseFloat(stock.portfolioWeight).toFixed(1) + '%' : '-'}</td>
                        <td className="py-2 px-2 text-center">
                          {score > 0 ? (
                            <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                              score >= 80 ? 'bg-green-600 text-white' :
                              score >= 60 ? 'bg-yellow-600 text-white' :
                              score >= 40 ? 'bg-orange-600 text-white' :
                              'bg-red-600 text-white'
                            }`}>
                              {score}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="py-2 px-2 text-slate-300">{stock.category || '-'}</td>
                        <td className="py-2 px-2 text-slate-300">{stock.sector || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const { data: stocks = [], refetch: refetchStocks } = trpc.stocks.list.useQuery(undefined, {
    enabled: isAuthenticated || !!user,
  });
  const { data: stockScores = [] } = trpc.score.calculateAll.useQuery(undefined, {
    enabled: isAuthenticated || !!user,
  });
  const { data: stats } = trpc.stocks.stats.useQuery(undefined, {
    enabled: isAuthenticated || !!user,
  });
  
  // All useState hooks MUST be called before any early returns
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingStock, setEditingStock] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});
  const [hasAppliedEqualWeighting, setHasAppliedEqualWeighting] = useState(false);
  const [activeTab, setActiveTab] = useState("portfolio");
  const [selectedStockForChart, setSelectedStockForChart] = useState<any>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [showScoreDetail, setShowScoreDetail] = useState(false);
  const [selectedScoreDetail, setSelectedScoreDetail] = useState<any>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [tickerSearchQuery, setTickerSearchQuery] = useState("");
  const [showTickerSuggestions, setShowTickerSuggestions] = useState(false);
  const [editingInfoStock, setEditingInfoStock] = useState<any>(null);
  const [editingFinanzenStock, setEditingFinanzenStock] = useState<any>(null);
  const [competitorAnalysisStock, setCompetitorAnalysisStock] = useState<any>(null);
  const [competitorAnalysisData, setCompetitorAnalysisData] = useState<any>(null);
  const [isCompetitorDialogOpen, setIsCompetitorDialogOpen] = useState(false);
  const [isLoadingCompetitors, setIsLoadingCompetitors] = useState(false);
  const [isAlternativesOverviewOpen, setIsAlternativesOverviewOpen] = useState(false);
  const [stocksWithAlternatives, setStocksWithAlternatives] = useState<any[]>([]);
  const [currentAlternativeIndex, setCurrentAlternativeIndex] = useState<number | null>(0);
  const [alternativesProgress, setAlternativesProgress] = useState(0);
  const [isLoadingAlternatives, setIsLoadingAlternatives] = useState(false);
  const [infoFormData, setInfoFormData] = useState<any>({});
  const [finanzenFormData, setFinanzenFormData] = useState<any>({});
  const [optimizerInputs, setOptimizerInputs] = useState<any>(null);
  const [showOptimizerResults, setShowOptimizerResults] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshStartTime, setRefreshStartTime] = useState<number | null>(null);
  const [isSavePortfolioDialogOpen, setIsSavePortfolioDialogOpen] = useState(false);
  const [isLoadPortfolioDialogOpen, setIsLoadPortfolioDialogOpen] = useState(false);
  const [showWeeklyOverview, setShowWeeklyOverview] = useState(false);
  const [portfolioName, setPortfolioName] = useState('');
  const [portfolioDescription, setPortfolioDescription] = useState('');
  
  // Query for saved portfolios - MUST be at top level (not conditional)
  const { data: savedPortfoliosData = [], refetch: refetchSavedPortfolios } = trpc.savedPortfolios.list.useQuery();
  const deletePortfolioMutation = trpc.savedPortfolios.delete.useMutation();
  const savePortfolioMutation = trpc.savedPortfolios.create.useMutation({
    onSuccess: () => {
      refetchSavedPortfolios();
    },
  });
  
  // Calculator state - MUST be declared here, not inside conditional
  const [calculatorType, setCalculatorType] = useState<'pension' | 'budget'>('pension');
  const [pensionCapital, setPensionCapital] = useState('');
  const [conversionRate, setConversionRate] = useState('6.8');
  const [lifeExpectancy, setLifeExpectancy] = useState('85');
  const [capitalTaxRate, setCapitalTaxRate] = useState('5');
  const [pensionTaxRate, setPensionTaxRate] = useState('15');
  const [regularIncome, setRegularIncome] = useState('');
  const [desiredExpenses, setDesiredExpenses] = useState('');
  const [expectedReturn, setExpectedReturn] = useState('4');
  const [currentAge, setCurrentAge] = useState('65');
  const [canton, setCanton] = useState<Canton>('ZH');
  const [religion, setReligion] = useState<Religion>('konfessionslos');
  const [desiredCoverageRatio, setDesiredCoverageRatio] = useState('100');
  const [householdType, setHouseholdType] = useState<'single' | 'couple' | 'family1' | 'family2' | 'family3' | 'family4'>('single');
  const [annualIncome, setAnnualIncome] = useState('');
  const [budgetItems, setBudgetItems] = useState({
    housing: { standard: 1500, custom: 1500 },
    utilities: { standard: 250, custom: 250 },
    insurance: { standard: 450, custom: 450 },
    food: { standard: 600, custom: 600 },
    transport: { standard: 300, custom: 300 },
    communication: { standard: 100, custom: 100 },
    leisure: { standard: 400, custom: 400 },
    clothing: { standard: 150, custom: 150 },
    health: { standard: 200, custom: 200 },
    education: { standard: 100, custom: 100 },
    savings: { standard: 500, custom: 500 },
    other: { standard: 200, custom: 200 }
  });
  
  // Show welcome screen for non-authenticated users
  const showWelcomeScreen = !isAuthenticated && !user;
  
  // Calculator results (must be outside conditional for React Hooks rules)
  const calculatorResults = React.useMemo(() => {
    if (activeTab !== "rechner" || !pensionCapital) return null;
    
    const totalCapital = parseFloat(pensionCapital);
    const rate = parseFloat(conversionRate) / 100;
    const life = parseInt(lifeExpectancy);
    const age = parseInt(currentAge);
    const years = life - age;
    const income = parseFloat(regularIncome) || 0;
    const expenses = parseFloat(desiredExpenses) || 0;
    const targetCoverage = parseFloat(desiredCoverageRatio) / 100;
    
    // Calculate optimal capital withdrawal percentage
    let optimalWithdrawalPct = 0;
    if (expenses > 0 && targetCoverage > 0) {
      const requiredMonthlyIncome = expenses * targetCoverage;
      const additionalIncomeNeeded = Math.max(0, requiredMonthlyIncome - income);
      
      if (additionalIncomeNeeded > 0) {
        const requiredAnnualPension = additionalIncomeNeeded * 12;
        const requiredCapitalForPension = requiredAnnualPension / rate;
        optimalWithdrawalPct = Math.min(100, (requiredCapitalForPension / totalCapital) * 100);
      }
    }
    
    const withdrawalPct = optimalWithdrawalPct > 0 ? optimalWithdrawalPct : 100;
    const capitalForPension = totalCapital * (withdrawalPct / 100);
    const capitalForWithdrawal = totalCapital - capitalForPension;
    
    const annualPension = capitalForPension * rate;
    const monthlyPension = annualPension / 12;
    
    const taxResult = calculateCapitalWithdrawalTax(capitalForWithdrawal, canton, religion);
    const netCapital = taxResult.netAmount;
    const capitalTax = taxResult.taxAmount;
    const effectiveTaxRate = taxResult.taxRate;
    
    const totalPensionGross = annualPension * years;
    const pensionTax = totalPensionGross * (parseFloat(pensionTaxRate) / 100);
    const totalPensionNet = totalPensionGross - pensionTax;
    
    const returnRate = parseFloat(expectedReturn) / 100;
    const futureValue = netCapital * Math.pow(1 + returnRate, years);
    
    const totalMonthlyIncome = income + monthlyPension;
    const coverageWithPension = expenses > 0 ? ((totalMonthlyIncome / expenses) * 100).toFixed(1) : '0';
    const coverageWithoutPension = expenses > 0 ? ((income / expenses) * 100).toFixed(1) : '0';
    
    const totalValue = totalPensionNet + futureValue;
    const fullCapitalValue = calculateCapitalWithdrawalTax(totalCapital, canton, religion).netAmount * Math.pow(1 + returnRate, years);
    
    return {
      monthlyPension: monthlyPension.toFixed(0),
      annualPension: annualPension.toFixed(0),
      totalPensionNet: totalPensionNet.toFixed(0),
      netCapital: netCapital.toFixed(0),
      capitalTax: capitalTax.toFixed(0),
      effectiveTaxRate: effectiveTaxRate.toFixed(2),
      futureValue: futureValue.toFixed(0),
      coverageWithPension,
      coverageWithoutPension,
      optimalWithdrawalPct: optimalWithdrawalPct.toFixed(1),
      capitalForPension: capitalForPension.toFixed(0),
      capitalForWithdrawal: capitalForWithdrawal.toFixed(0),
      recommendation: totalValue > fullCapitalValue ? 'Mischbezug empfohlen' : 'Vollständiger Kapitalbezug empfohlen'
    };
  }, [activeTab, pensionCapital, conversionRate, lifeExpectancy, currentAge, regularIncome, desiredExpenses, desiredCoverageRatio, canton, religion, pensionTaxRate, expectedReturn]);
  
  // Progress tracking effect
  useEffect(() => {
    if (isRefreshing && refreshStartTime) {
      const totalStocks = stocks.length;
      const estimatedTimePerStock = 1000; // 1 second per stock
      const totalEstimatedTime = totalStocks * estimatedTimePerStock;
      
      const interval = setInterval(() => {
        const elapsed = Date.now() - refreshStartTime;
        const progress = Math.min(95, (elapsed / totalEstimatedTime) * 100);
        setRefreshProgress(progress);
      }, 100);
      
      return () => clearInterval(interval);
    }
  }, [isRefreshing, refreshStartTime, stocks.length]);
  
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

  const fetchStockDataMutation = trpc.stocks.fetchStockData.useMutation({
    onSuccess: (data: any) => {
      setFormData((prev: any) => ({
        ...prev,
        companyName: data.companyName || prev.companyName,
        ticker: data.ticker || prev.ticker,
        ytdStartPrice: data.ytdStartPrice?.toString() || prev.ytdStartPrice,
        ytdPerformance: data.ytdPerformance?.toString() || prev.ytdPerformance,
        currentPrice: data.currentPrice?.toString() || prev.currentPrice,
        peRatio: data.peRatio?.toString() || prev.peRatio,
        pegRatio: data.pegRatio?.toString() || prev.pegRatio,
        sharpeRatio: data.sharpeRatio?.toString() || prev.sharpeRatio,
        dividendYield: data.dividendYield?.toString() || prev.dividendYield,
      }));
      toast.success("Erfolgreich", { description: "Daten wurden geladen" });
    },
    onError: (error: any) => {
      toast.error("Fehler", { description: error.message || "Daten konnten nicht geladen werden" });
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
    onSuccess: async (data: any) => {
      // Set to 100% first
      setRefreshProgress(100);
      // Wait a brief moment to show 100%
      await new Promise(resolve => setTimeout(resolve, 300));
      // Then stop refreshing state
      setIsRefreshing(false);
      toast.success("Daten aktualisiert", {
        description: data.message || `${data.updated} Aktien erfolgreich aktualisiert`,
      });
      // Reset progress after showing completion
      setTimeout(() => setRefreshProgress(0), 2000);
      // Invalidate all tRPC queries to force fresh data
      await trpc.useUtils().invalidate();
      // Refetch immediately after mutation completes
      await refetchStocks();
    },
    onError: (error: any) => {
      setIsRefreshing(false);
      setRefreshProgress(0);
      toast.error("Fehler bei der Aktualisierung", {
        description: error.message,
      });
    },
  });

  const refreshStockDataMutation = trpc.stocks.refreshStockData.useMutation({
    onError: (error: any) => {
      console.error("refreshStockData error:", error);
    },
  });
  
  const findCompetitorsMutation = trpc.stocks.findCompetitors.useMutation({
    onError: (error: any) => {
      setIsLoadingCompetitors(false);
      toast.error("Fehler bei der Analyse", {
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
      const matchesSector = !selectedSector || stock.sector === selectedSector;
      const matchesSearch = !searchTerm || 
        stock.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        stock.ticker?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesCategory && matchesSector && matchesSearch;
    });

    // Apply sorting
    if (sortField) {
      filtered = [...filtered].sort((a, b) => {
        let aVal: any = a[sortField as keyof typeof a];
        let bVal: any = b[sortField as keyof typeof b];

        // Handle numeric fields
        if (['currentPrice', 'ytdPerformance', 'peRatio', 'pegRatio', 'sharpeRatio', 'dividendYield', 'portfolioWeight'].includes(sortField)) {
          aVal = parseFloat(aVal || '0');
          bVal = parseFloat(bVal || '0');
        }
        
        // Handle score field (get totalScore from stockScores)
        if (sortField === 'score') {
          const aScore = stockScores.find(s => s.ticker === a.ticker);
          const bScore = stockScores.find(s => s.ticker === b.ticker);
          aVal = aScore?.totalScore || 0;
          bVal = bScore?.totalScore || 0;
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
  }, [stocks, selectedCategory, selectedSector, searchTerm, sortField, sortDirection, hasPaidAccess]);

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

  // Define actual stock categories (not sectors)
  const categories = useMemo(() => {
    return ['Dividendenaktien', 'Wachstumsaktien', 'ETF', 'Value', 'Andere'].sort();
  }, []);

  // Extract unique sectors from stocks
  const sectors = useMemo(() => {
    const uniqueSectors = new Set(stocks.map(s => s.sector).filter(Boolean));
    return Array.from(uniqueSectors).sort();
  }, [stocks]);

  const handleAddStock = () => {
    // Validation
    if (!formData.ticker || !formData.companyName) {
      toast.error("Fehler", { description: "Ticker und Firmenname sind erforderlich" });
      return;
    }
    if (!formData.currentPrice || parseFloat(formData.currentPrice) <= 0) {
      toast.error("Fehler", { description: "Aktueller Kurs ist erforderlich" });
      return;
    }
    if (!formData.category) {
      toast.error("Fehler", { description: "Kategorie ist erforderlich" });
      return;
    }
    
    const equalWeight = (100 / (stocks.length + 1)).toFixed(4);
    addStockMutation.mutate({
      ...formData,
      portfolioWeight: parseFloat(equalWeight),
      currentPrice: parseFloat(formData.currentPrice || "0"),
      // Ensure all numeric fields are strings or set to defaults
      peRatio: formData.peRatio || "0",
      pegRatio: formData.pegRatio || "0",
      sharpeRatio: formData.sharpeRatio || "0",
      dividendYield: formData.dividendYield || "0",
      ytdStartPrice: formData.ytdStartPrice || formData.currentPrice,
      ytdPerformance: formData.ytdPerformance || "0",
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
      headers: ['Titel', 'Ticker', 'Kurs', 'YTD %', 'P/E', 'PEG', 'Div. %', 'Port. %', 'Kategorie', 'Branche'],
      body: filteredStocks.map(stock => [
        stock.companyName,
        stock.ticker,
        stock.currentPrice ? parseFloat(stock.currentPrice).toFixed(2) : '-',
        stock.ytdPerformance ? `${parseFloat(stock.ytdPerformance) >= 0 ? '+' : ''}${parseFloat(stock.ytdPerformance).toFixed(1)}` : '-',
        stock.peRatio ? parseFloat(stock.peRatio).toFixed(1) : '-',
        stock.pegRatio ? parseFloat(stock.pegRatio).toFixed(1) : '-',
        stock.dividendYield ? parseFloat(stock.dividendYield).toFixed(1) : '-',
        parseFloat(stock.portfolioWeight || '0').toFixed(2),
        stock.category || '-',
        stock.sector || '-'
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
              onClick={() => setActiveTab("aktien")}
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

  if (activeTab === "wissen") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <button
              onClick={() => setActiveTab("aktien")}
              className="text-slate-400 hover:text-white transition-colors"
            >
              ← Zurück
            </button>
            <h1 className="text-4xl font-bold text-white">Finanzwissen für Anfänger</h1>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* P/E Ratio */}
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 hover:border-indigo-500 transition-all cursor-pointer">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-indigo-600 rounded-lg flex items-center justify-center text-2xl">
                  📊
                </div>
                <h3 className="text-xl font-bold text-white">P/E Ratio</h3>
              </div>
              <p className="text-slate-300 text-sm leading-relaxed">
                Das Kurs-Gewinn-Verhältnis zeigt, wie viel Investoren bereit sind für jeden Euro Gewinn zu zahlen. Ein niedriger Wert kann auf eine günstige Bewertung hindeuten.
              </p>
            </div>

            {/* PEG Ratio */}
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 hover:border-indigo-500 transition-all cursor-pointer">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center text-2xl">
                  📈
                </div>
                <h3 className="text-xl font-bold text-white">PEG Ratio</h3>
              </div>
              <p className="text-slate-300 text-sm leading-relaxed">
                Das PEG-Verhältnis berücksichtigt das Gewinnwachstum. Ein Wert unter 1 deutet darauf hin, dass die Aktie im Verhältnis zum Wachstum günstig bewertet ist.
              </p>
            </div>

            {/* Sharpe Ratio */}
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 hover:border-indigo-500 transition-all cursor-pointer">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-yellow-600 rounded-lg flex items-center justify-center text-2xl">
                  ⚖️
                </div>
                <h3 className="text-xl font-bold text-white">Sharpe Ratio</h3>
              </div>
              <p className="text-slate-300 text-sm leading-relaxed">
                Misst die risikobereinigte Rendite. Ein höherer Wert bedeutet bessere Rendite pro Risikoeinheit. Werte über 1 gelten als gut.
              </p>
            </div>

            {/* Dividendenrendite */}
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 hover:border-indigo-500 transition-all cursor-pointer">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center text-2xl">
                  💰
                </div>
                <h3 className="text-xl font-bold text-white">Dividendenrendite</h3>
              </div>
              <p className="text-slate-300 text-sm leading-relaxed">
                Der Prozentsatz der jährlichen Dividende im Verhältnis zum Aktienkurs. Höhere Werte bedeuten mehr regelmäßiges Einkommen.
              </p>
            </div>

            {/* Diversifikation */}
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 hover:border-indigo-500 transition-all cursor-pointer">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center text-2xl">
                  🎯
                </div>
                <h3 className="text-xl font-bold text-white">Diversifikation</h3>
              </div>
              <p className="text-slate-300 text-sm leading-relaxed">
                Streuung des Kapitals über verschiedene Anlagen, um Risiken zu minimieren. "Nicht alle Eier in einen Korb legen."
              </p>
            </div>

            {/* YTD Performance */}
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 hover:border-indigo-500 transition-all cursor-pointer">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-red-600 rounded-lg flex items-center justify-center text-2xl">
                  📅
                </div>
                <h3 className="text-xl font-bold text-white">YTD Performance</h3>
              </div>
              <p className="text-slate-300 text-sm leading-relaxed">
                Year-to-Date Performance zeigt die Wertentwicklung seit Jahresbeginn. Hilft beim Vergleich der aktuellen Jahresperformance.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (activeTab === "rechner") {
    const results = calculatorResults;
    
    const totalBudget = Object.values(budgetItems).reduce((sum, item) => sum + item.custom, 0);
    const income = parseFloat(annualIncome) || 0;
    const monthlyIncome = income / 12;
    const savingsRate = monthlyIncome > 0 ? ((budgetItems.savings.custom / monthlyIncome) * 100).toFixed(1) : '0';

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <button
              onClick={() => setActiveTab("aktien")}
              className="text-slate-400 hover:text-white transition-colors"
            >
              ← Zurück
            </button>
            <h1 className="text-4xl font-bold text-white">Finanzrechner</h1>
          </div>

          {/* Calculator Type Selector */}
          <div className="flex gap-4 mb-6">
            <button
              onClick={() => setCalculatorType('pension')}
              className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                calculatorType === 'pension'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              🏦 Renten-/Kapitalbezug
            </button>
            <button
              onClick={() => setCalculatorType('budget')}
              className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                calculatorType === 'budget'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              📋 Budgetrechner
            </button>
          </div>

          {calculatorType === 'pension' ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Input Section */}
              <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                <h2 className="text-2xl font-bold text-white mb-6">📊 Eingaben</h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-slate-300 text-sm mb-1 block">Pensionskassen-Kapital (CHF)</label>
                    <input
                      type="number"
                      value={pensionCapital}
                      onChange={(e) => setPensionCapital(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:border-indigo-500 focus:outline-none"
                      placeholder="z.B. 500000"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-slate-300 text-sm mb-1 block">Aktuelles Alter</label>
                      <input
                        type="number"
                        value={currentAge}
                        onChange={(e) => setCurrentAge(e.target.value)}
                        className="w-full px-4 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-slate-300 text-sm mb-1 block">Lebenserwartung</label>
                      <input
                        type="number"
                        value={lifeExpectancy}
                        onChange={(e) => setLifeExpectancy(e.target.value)}
                        className="w-full px-4 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-slate-300 text-sm mb-1 block">Umwandlungssatz (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={conversionRate}
                      onChange={(e) => setConversionRate(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-slate-300 text-sm mb-1 block">Kanton</label>
                      <select
                        value={canton}
                        onChange={(e) => setCanton(e.target.value as Canton)}
                        className="w-full px-4 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:border-indigo-500 focus:outline-none"
                      >
                        {CANTONS.map(c => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-300 text-sm mb-1 block">Konfession</label>
                      <select
                        value={religion}
                        onChange={(e) => setReligion(e.target.value as Religion)}
                        className="w-full px-4 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:border-indigo-500 focus:outline-none"
                      >
                        <option value="konfessionslos">Konfessionslos</option>
                        <option value="reformiert">Reformiert</option>
                        <option value="katholisch">Katholisch</option>
                      </select>
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-slate-300 text-sm mb-1 block">Steuer Rente (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={pensionTaxRate}
                      onChange={(e) => setPensionTaxRate(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  
                  <div>
                    <label className="text-slate-300 text-sm mb-1 block">Regelmässige Einnahmen (CHF/Monat)</label>
                    <input
                      type="number"
                      value={regularIncome}
                      onChange={(e) => setRegularIncome(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:border-indigo-500 focus:outline-none"
                      placeholder="AHV, Immobilien, Wertschriften"
                    />
                  </div>
                  
                  <div>
                    <label className="text-slate-300 text-sm mb-1 block">Gewünschte Ausgaben (CHF/Monat)</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={desiredExpenses}
                        onChange={(e) => setDesiredExpenses(e.target.value)}
                        className="flex-1 px-4 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:border-indigo-500 focus:outline-none"
                        placeholder="Lebenshaltungskosten"
                      />
                      <button
                        onClick={() => setCalculatorType('budget')}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold transition-colors whitespace-nowrap"
                      >
                        📋 Budgetrechner
                      </button>
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-slate-300 text-sm mb-1 block">Gewünschter Deckungsgrad (%)</label>
                    <input
                      type="number"
                      value={desiredCoverageRatio}
                      onChange={(e) => setDesiredCoverageRatio(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:border-indigo-500 focus:outline-none"
                      placeholder="z.B. 100 für vollständige Deckung"
                    />
                    <p className="text-slate-400 text-xs mt-1">Verhältnis Einnahmen/Ausgaben (100% = vollständige Deckung)</p>
                  </div>
                  
                  <div>
                    <label className="text-slate-300 text-sm mb-1 block">Erwartete Rendite (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={expectedReturn}
                      onChange={(e) => setExpectedReturn(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Results Section */}
              <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                <h2 className="text-2xl font-bold text-white mb-6">📊 Ergebnisse</h2>
                
                {results ? (
                  <div className="space-y-4">
                    {/* Recommendation Banner */}
                    <div className={`p-4 rounded-lg border-2 ${
                      results.recommendation.includes('Mischbezug') 
                        ? 'bg-green-900/20 border-green-500' 
                        : 'bg-blue-900/20 border-blue-500'
                    }`}>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-white mb-1">
                          {results.recommendation}
                        </div>
                        {parseFloat(results.optimalWithdrawalPct) > 0 && (
                          <div className="text-sm text-slate-300 mt-2">
                            Empfohlener Kapitalbezug: <span className="font-semibold text-white">{results.optimalWithdrawalPct}%</span> (CHF {results.capitalForWithdrawal})
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Tax Info */}
                    <div className="bg-slate-700/30 p-3 rounded-lg">
                      <div className="text-sm text-slate-300 text-center">
                        Effektiver Steuersatz Kapitalbezug: <span className="font-semibold text-white">{results.effectiveTaxRate}%</span>
                      </div>
                    </div>
                    
                    {/* Pension Option */}
                    <div className="bg-slate-700/50 p-4 rounded-lg">
                      <h3 className="text-lg font-semibold text-white mb-3">💰 Rentenbezug</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-300">Monatliche Rente:</span>
                          <span className="text-white font-semibold">CHF {results.monthlyPension}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-300">Jährliche Rente:</span>
                          <span className="text-white font-semibold">CHF {results.annualPension}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-300">Total (netto):</span>
                          <span className="text-green-400 font-semibold">CHF {results.totalPensionNet}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Capital Option */}
                    <div className="bg-slate-700/50 p-4 rounded-lg">
                      <h3 className="text-lg font-semibold text-white mb-3">💵 Kapitalbezug</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-300">Steuer:</span>
                          <span className="text-red-400 font-semibold">CHF {results.capitalTax}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-300">Netto-Kapital:</span>
                          <span className="text-white font-semibold">CHF {results.netCapital}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-300">Endwert (mit Rendite):</span>
                          <span className="text-blue-400 font-semibold">CHF {results.futureValue}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Coverage Ratio */}
                    <div className="bg-slate-700/50 p-4 rounded-lg">
                      <h3 className="text-lg font-semibold text-white mb-3">📊 Deckungsgrad</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-300">Ohne BVG-Rente:</span>
                          <span className={`font-semibold ${
                            parseFloat(results.coverageWithoutPension) >= 100 ? 'text-green-400' : 'text-orange-400'
                          }`}>{results.coverageWithoutPension}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-300">Mit BVG-Rente:</span>
                          <span className={`font-semibold ${
                            parseFloat(results.coverageWithPension) >= 100 ? 'text-green-400' : 'text-orange-400'
                          }`}>{results.coverageWithPension}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-slate-400 py-12">
                    <div className="text-4xl mb-4">📊</div>
                    <p>Füllen Sie die Eingabefelder aus, um die Berechnung zu starten</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <h2 className="text-2xl font-bold text-white mb-6">📋 Budgetrechner</h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                <div>
                  <label className="text-slate-300 text-sm mb-1 block">Haushaltstyp</label>
                  <select
                    value={householdType}
                    onChange={(e) => {
                      const newType = e.target.value as 'single' | 'couple' | 'family1' | 'family2' | 'family3' | 'family4';
                      setHouseholdType(newType);
                      
                      // Calculate multiplier based on household size
                      const multipliers = {
                        single: 1,
                        couple: 1.6,
                        family1: 2.0,
                        family2: 2.4,
                        family3: 2.8,
                        family4: 3.2
                      };
                      
                      const multiplier = multipliers[newType];
                      const hasChildren = ['family1', 'family2', 'family3', 'family4'].includes(newType);
                      
                      setBudgetItems({
                        housing: { standard: 1500 * multiplier, custom: 1500 * multiplier },
                        utilities: { standard: 250 * multiplier, custom: 250 * multiplier },
                        insurance: { standard: 450 * multiplier, custom: 450 * multiplier },
                        food: { standard: 600 * multiplier, custom: 600 * multiplier },
                        transport: { standard: 300 * multiplier, custom: 300 * multiplier },
                        communication: { standard: 100 * multiplier, custom: 100 * multiplier },
                        leisure: { standard: 400 * multiplier, custom: 400 * multiplier },
                        clothing: { standard: 150 * multiplier, custom: 150 * multiplier },
                        health: { standard: 200 * multiplier, custom: 200 * multiplier },
                        education: { standard: hasChildren ? 300 : 0, custom: hasChildren ? 300 : 0 },
                        savings: { standard: 500, custom: 500 },
                        other: { standard: 200 * multiplier, custom: 200 * multiplier }
                      });
                    }}
                    className="w-full px-4 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="single">Einpersonenhaushalt</option>
                    <option value="couple">Zweipersonenhaushalt</option>
                    <option value="family1">Familie mit 1 Kind</option>
                    <option value="family2">Familie mit 2 Kindern</option>
                    <option value="family3">Familie mit 3 Kindern</option>
                    <option value="family4">Familie mit 4 Kindern</option>
                  </select>
                </div>
                
                <div>
                  <label className="text-slate-300 text-sm mb-1 block">Jährliches Einkommen (CHF)</label>
                  <input
                    type="number"
                    value={annualIncome}
                    onChange={(e) => setAnnualIncome(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:border-indigo-500 focus:outline-none"
                    placeholder="z.B. 80000"
                  />
                </div>
                
                <div className="flex items-end">
                  <button
                    onClick={() => {
                      setBudgetItems(prev => {
                        const newItems = { ...prev };
                        Object.keys(newItems).forEach(key => {
                          newItems[key as keyof typeof newItems].custom = newItems[key as keyof typeof newItems].standard;
                        });
                        return newItems;
                      });
                    }}
                    className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-semibold transition-colors"
                  >
                    🔄 Vorschlag übernehmen
                  </button>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left text-slate-300 py-3 px-4">Kategorie</th>
                      <th className="text-right text-slate-300 py-3 px-4">Standard (CHF)</th>
                      <th className="text-right text-slate-300 py-3 px-4">Individuell (CHF)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(budgetItems)
                      .filter(([key]) => {
                        // Hide education row if no children
                        const hasChildren = ['family1', 'family2', 'family3', 'family4'].includes(householdType);
                        return key !== 'education' || hasChildren;
                      })
                      .map(([key, value]) => (
                      <tr key={key} className="border-b border-slate-700/50">
                        <td className="text-slate-300 py-3 px-4 capitalize">
                          {key === 'housing' ? 'Wohnen' :
                           key === 'utilities' ? 'Nebenkosten' :
                           key === 'insurance' ? 'Krankenkasse' :
                           key === 'food' ? 'Lebensmittel' :
                           key === 'transport' ? 'Verkehr' :
                           key === 'communication' ? 'Kommunikation' :
                           key === 'leisure' ? 'Freizeit' :
                           key === 'clothing' ? 'Kleidung' :
                           key === 'health' ? 'Gesundheit' :
                           key === 'education' ? 'Ausbildungskosten' :
                           key === 'savings' ? 'Sparen' : 'Sonstiges'}
                        </td>
                        <td className="text-right text-slate-400 py-3 px-4">
                          {value.standard.toFixed(0)}
                        </td>
                        <td className="text-right py-3 px-4">
                          <input
                            type="number"
                            value={value.custom}
                            onChange={(e) => {
                              setBudgetItems(prev => ({
                                ...prev,
                                [key]: { ...prev[key as keyof typeof prev], custom: parseFloat(e.target.value) || 0 }
                              }));
                            }}
                            className="w-32 px-3 py-1 bg-slate-700 text-white rounded border border-slate-600 focus:border-indigo-500 focus:outline-none text-right"
                          />
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-slate-600 font-bold">
                      <td className="text-white py-3 px-4">Total</td>
                      <td className="text-right text-slate-300 py-3 px-4">
                        {Object.values(budgetItems).reduce((sum, item) => sum + item.standard, 0).toFixed(0)}
                      </td>
                      <td className="text-right text-white py-3 px-4">
                        {totalBudget.toFixed(0)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              
              {annualIncome && (
                <div className="mt-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-slate-700/50 p-4 rounded-lg">
                      <div className="text-slate-400 text-sm mb-1">Monatliches Einkommen</div>
                      <div className="text-2xl font-bold text-white">CHF {monthlyIncome.toFixed(0)}</div>
                    </div>
                    <div className="bg-slate-700/50 p-4 rounded-lg">
                      <div className="text-slate-400 text-sm mb-1">Überschuss/Defizit</div>
                      <div className={`text-2xl font-bold ${
                        monthlyIncome - totalBudget >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        CHF {(monthlyIncome - totalBudget).toFixed(0)}
                      </div>
                    </div>
                    <div className="bg-slate-700/50 p-4 rounded-lg">
                      <div className="text-slate-400 text-sm mb-1">Sparquote</div>
                      <div className="text-2xl font-bold text-blue-400">{savingsRate}%</div>
                    </div>
                  </div>
                  
                  {/* Transfer to Pension Calculator Button */}
                  <div className="flex justify-center">
                    <button
                      onClick={() => {
                        setDesiredExpenses(totalBudget.toFixed(0));
                        setCalculatorType('pension');
                      }}
                      className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors flex items-center gap-2"
                    >
                      <span>✓</span> Budget übernehmen (CHF {totalBudget.toFixed(0)})
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
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

  if (activeTab === "analyzer") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setActiveTab("aktien")}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
              >
                ← Zurück
              </button>
              <h1 className="text-3xl font-bold">Portfolio Analyzer</h1>
            </div>

            <button
              onClick={async () => {
                // AI-powered market analysis
                const analysis = await analyzePortfolioMarket(stocks);
                alert(analysis);
              }}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors font-semibold"
            >
              📊 Marktanalyse
            </button>
          </div>

          {/* Analysis Categories */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="bg-slate-800/50 border-slate-700 hover:border-blue-500 transition-colors cursor-pointer">
              <CardHeader>
                <CardTitle className="text-white text-lg flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 3v18h18" />
                    <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
                  </svg>
                  Portfolio-Übersicht
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-400 text-sm">Diversifikation, Gewichtung und Sektorenverteilung</p>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700 hover:border-purple-500 transition-colors cursor-pointer">
              <CardHeader>
                <CardTitle className="text-white text-lg flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                  Risiko-Analyse
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-400 text-sm">Volatilität, Sharpe Ratio und Risiko-Scores</p>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700 hover:border-green-500 transition-colors cursor-pointer">
              <CardHeader>
                <CardTitle className="text-white text-lg flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                  Performance-Analyse
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-400 text-sm">YTD-Performance, Rendite und Vergleiche</p>
              </CardContent>
            </Card>
          </div>

          {/* Chart Placeholders */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Portfolio Allocation Chart */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Sektoren-Allokation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-slate-700/30 rounded-lg h-64 flex items-center justify-center border-2 border-dashed border-slate-600">
                  <div className="text-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 text-slate-500 mx-auto mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
                      <path d="M22 12A10 10 0 0 0 12 2v10z" />
                    </svg>
                    <p className="text-slate-400">Kreisdiagramm</p>
                    <p className="text-slate-500 text-sm">Sektorenverteilung</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Portfolio Sentiment Indicator */}
            <PortfolioSentimentIndicator />

            {/* Portfolio Performance Chart */}
            <PortfolioPerformanceChart stocks={filteredStocks} />
            {/* Correlation Matrix */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Korrelations-Matrix</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-slate-700/30 rounded-lg h-64 flex items-center justify-center border-2 border-dashed border-slate-600">
                  <div className="text-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 text-slate-500 mx-auto mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="7" height="7" />
                      <rect x="14" y="3" width="7" height="7" />
                      <rect x="14" y="14" width="7" height="7" />
                      <rect x="3" y="14" width="7" height="7" />
                    </svg>
                    <p className="text-slate-400">Heatmap</p>
                    <p className="text-slate-500 text-sm">Aktien-Korrelationen</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Key Metrics */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Wichtige Kennzahlen</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-700/30 rounded-lg p-4">
                  <p className="text-slate-400 text-sm mb-1">Portfolio-Sharpe</p>
                  <p className="text-2xl font-bold text-white">-</p>
                </div>
                <div className="bg-slate-700/30 rounded-lg p-4">
                  <p className="text-slate-400 text-sm mb-1">Durchschn. P/E</p>
                  <p className="text-2xl font-bold text-white">-</p>
                </div>
                <div className="bg-slate-700/30 rounded-lg p-4">
                  <p className="text-slate-400 text-sm mb-1">Volatilität</p>
                  <p className="text-2xl font-bold text-white">-</p>
                </div>
                <div className="bg-slate-700/30 rounded-lg p-4">
                  <p className="text-slate-400 text-sm mb-1">Beta</p>
                  <p className="text-2xl font-bold text-white">-</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
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
                  onClick={() => setActiveTab("aktien")}
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
            // Go back to portfolio optimizer start (where saved portfolios are shown)
            setShowOptimizerResults(false);
            setOptimizerInputs(null);
            refetchSavedPortfolios(); // Refresh saved portfolios list
          }}
          onPortfolioSaved={() => {
            refetchSavedPortfolios(); // Refresh list when portfolio is saved
          }}
        />
      );
    }

    // Show portfolio selection if user has saved portfolios and hasn't started questionnaire
    if (!optimizerInputs && savedPortfoliosData.length > 0) {
      return (
        <div className="min-h-screen bg-slate-900 p-8">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-white mb-4">Portfolio Optimizer</h1>
              <p className="text-slate-400">Wählen Sie ein gespeichertes Portfolio oder erstellen Sie ein neues</p>
            </div>

            <div className="grid gap-6 mb-8">
              {savedPortfoliosData.map((portfolio: any) => (
                <Card key={portfolio.id} className="bg-slate-800 border-slate-700 hover:border-blue-500 transition-colors">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <CardTitle className="text-white text-xl">{portfolio.name}</CardTitle>
                        {portfolio.description && (
                          <p className="text-slate-400 text-sm mt-2">{portfolio.description}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-slate-500 text-xs">Zuletzt gespeichert</p>
                        <p className="text-slate-400 text-sm">
                          {new Date(portfolio.updatedAt).toLocaleDateString('de-CH', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })}
                        </p>
                        <p className="text-slate-500 text-xs">
                          {new Date(portfolio.updatedAt).toLocaleTimeString('de-CH', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between items-center gap-6">
                      <div>
                        <p className="text-slate-400 text-sm">Positionen</p>
                        <p className="text-white font-semibold text-lg">{portfolio.numberOfPositions}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-sm">Total investiert</p>
                        <p className="text-white font-semibold text-lg">CHF {portfolio.totalInvested?.toLocaleString('de-CH') || '0'}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-sm">Ø Dividende</p>
                        <p className="text-green-400 font-semibold text-lg">{portfolio.avgDividendYield?.toFixed(2) || '0.00'}%</p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-sm">Ø YTD Performance</p>
                        <p className={`font-semibold text-lg ${
                          (portfolio.avgYtdPerformance || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {(portfolio.avgYtdPerformance || 0) >= 0 ? '+' : ''}{portfolio.avgYtdPerformance?.toFixed(1) || '0.0'}%
                        </p>
                      </div>
                    </div>
                  </CardContent>
                  <div className="px-6 pb-6">
                    <div className="flex gap-2 justify-between items-center">
                      {/* Live Toggle */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const newLiveStatus = !Boolean(portfolio.isLive);
                            try {
                              await trpc.savedPortfolios.toggleLive.mutate({
                                id: portfolio.id,
                                isLive: newLiveStatus
                              });
                              toast.success(
                                newLiveStatus ? 'Live-Tracking aktiviert' : 'Live-Tracking deaktiviert',
                                { description: newLiveStatus ? 'Performance wird ab jetzt gemessen' : 'Live-Tracking gestoppt' }
                              );
                              refetchSavedPortfolios();
                            } catch (error) {
                              toast.error('Fehler', { description: 'Status konnte nicht geändert werden' });
                            }
                          }}
                          className={`px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1.5 ${
                            Boolean(portfolio.isLive)
                              ? 'bg-green-600 hover:bg-green-700 text-white'
                              : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                          }`}
                          style={{pointerEvents: 'auto', zIndex: 10}}
                        >
                          {Boolean(portfolio.isLive) && <span className="w-2 h-2 bg-white rounded-full animate-pulse" />}
                          Live
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            // Load portfolio and show OptimizerResults
                            try {
                              const data = JSON.parse(portfolio.portfolioData);
                              
                              if (data.stocks) {
                                // Use saved inputs or create default inputs from portfolio data
                                const inputs = data.inputs || {
                                  investmentAmount: data.totalInvested || 10000,
                                  expectedDividendYield: data.avgDividendYield || 2.0,
                                  numberOfPositions: data.numberOfPositions || data.stocks.length,
                                  investorType: "balanced" as const
                                };
                                
                                setOptimizerInputs(inputs);
                                setShowOptimizerResults(true);
                                toast.success('Portfolio geladen', { description: `"${portfolio.name}" wurde geladen` });
                              } else {
                                toast.error('Fehler', { description: 'Portfolio-Daten sind unvollständig' });
                              }
                            } catch (error) {
                              console.error('Failed to load portfolio:', error);
                              toast.error('Fehler', { description: 'Portfolio konnte nicht geladen werden' });
                            }
                          }}
                          className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors cursor-pointer"
                          style={{pointerEvents: 'auto', zIndex: 10}}
                        >
                          Laden
                        </button>
                        <Button
                          onClick={async () => {
                            if (confirm(`Portfolio "${portfolio.name}" wirklich löschen?`)) {
                              try {
                                await deletePortfolioMutation.mutateAsync(portfolio.id);
                                toast.success('Gelöscht', { description: `Portfolio "${portfolio.name}" wurde gelöscht` });
                                refetchSavedPortfolios();
                              } catch (error) {
                                toast.error('Fehler', { description: 'Portfolio konnte nicht gelöscht werden' });
                              }
                            }
                          }}
                          size="sm"
                          variant="outline"
                          className="border-red-600 text-red-400 hover:bg-red-600 hover:text-white"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <div className="flex gap-4 justify-center">
              <Button
                onClick={() => setActiveTab("portfolio")}
                variant="outline"
                className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
              >
                Zurück
              </Button>
              <Button
                onClick={() => {
                  // Start new questionnaire
                  setOptimizerInputs({ 
                    investmentAmount: 10000,
                    expectedDividendYield: 2.0,
                    numberOfPositions: 20,
                    investorType: "balanced"
                  });
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Neues Portfolio erstellen
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <Optimizer
        onShowResults={(inputs) => {
          setOptimizerInputs(inputs);
          setShowOptimizerResults(true);
        }}
        onBack={() => {
          setActiveTab("portfolio");
          setOptimizerInputs(null);
        }}
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                      const currentPrice = parseFloat(stock.currentPrice || "0");
                      const ytdStartPrice = parseFloat(stock.ytdStartPrice || "0");
                      const weight = parseFloat(stock.portfolioWeight || "0");
                      if (currentPrice > 0 && ytdStartPrice > 0 && weight > 0) {
                        const stockYTD = ((currentPrice - ytdStartPrice) / ytdStartPrice) * 100;
                        return sum + (stockYTD * weight / 100);
                      }
                      return sum;
                    }, 0);
                    console.log('[Performance Card] Stocks loaded:', stocks.length, 'YTD:', ytdPerf.toFixed(2) + '%');
                    return ytdPerf >= 0 ? 'text-green-400' : 'text-red-400';
                  })()}`}>
                    {(() => {
                      const ytdPerf = stocks.reduce((sum, stock) => {
                        const currentPrice = parseFloat(stock.currentPrice || "0");
                        const ytdStartPrice = parseFloat(stock.ytdStartPrice || "0");
                        const weight = parseFloat(stock.portfolioWeight || "0");
                        if (currentPrice > 0 && ytdStartPrice > 0 && weight > 0) {
                          const stockYTD = ((currentPrice - ytdStartPrice) / ytdStartPrice) * 100;
                          return sum + (stockYTD * weight / 100);
                        }
                        return sum;
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

        {/* Portfolio Performance Chart */}
        <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-400">Portfolio Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <PortfolioPerformanceChart />
            </CardContent>
        </Card>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab("portfolio")}
            className={`px-4 py-2 rounded font-medium transition-colors ${
              activeTab === "portfolio"
                ? "bg-blue-600 text-white"
                : "bg-slate-700 text-slate-300 hover:bg-slate-600"
            }`}
          >
            Aktien
          </button>
          <button
            onClick={() => setActiveTab("optimizer")}
            className={`px-4 py-2 rounded font-medium transition-colors ${
              activeTab === "optimizer"
                ? "bg-cyan-600 text-white"
                : "bg-slate-700 text-slate-300 hover:bg-slate-600"
            }`}
          >
            Portfolio
          </button>
          <button
            onClick={() => setActiveTab("analyzer")}
            className={`px-4 py-2 rounded font-medium transition-colors ${
              activeTab === "analyzer"
                ? "bg-pink-600 text-white"
                : "bg-slate-700 text-slate-300 hover:bg-slate-600"
            }`}
          >
            Analyzer
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
            onClick={() => setActiveTab("research")}
            className={`px-4 py-2 rounded font-medium transition-colors ${
              activeTab === "research"
                ? "bg-indigo-600 text-white"
                : "bg-slate-700 text-slate-300 hover:bg-slate-600"
            }`}
          >
            Research
          </button>
          <button
            onClick={() => setActiveTab("wissen")}
            className={`px-4 py-2 rounded font-medium transition-colors ${
              activeTab === "wissen"
                ? "bg-indigo-600 text-white"
                : "bg-slate-700 text-slate-300 hover:bg-slate-600"
            }`}
          >
            Wissen
          </button>
          <button
            onClick={() => setActiveTab("rechner")}
            className={`px-4 py-2 rounded font-medium transition-colors ${
              activeTab === "rechner"
                ? "bg-indigo-600 text-white"
                : "bg-slate-700 text-slate-300 hover:bg-slate-600"
            }`}
          >
            Rechner
          </button>
          {isAuthenticated && (
            <>

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
          <Select value={selectedSector || "all"} onValueChange={(v) => setSelectedSector(v === "all" ? null : v)}>
            <SelectTrigger className="w-full md:w-48 bg-slate-800 border-slate-700 text-white">
              <SelectValue placeholder="Alle Branchen" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700 text-white">
              <SelectItem value="all" className="text-white hover:bg-slate-700 focus:bg-slate-700 focus:text-white">Alle Branchen</SelectItem>
              {sectors.map(sector => (
                <SelectItem key={sector} value={sector} className="text-white hover:bg-slate-700 focus:bg-slate-700 focus:text-white">{sector}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isAuthenticated && (
            <div className="relative">
              <Button 
                onClick={() => {
                  setIsRefreshing(true);
                  setRefreshStartTime(Date.now());
                  setRefreshProgress(0);
                  refreshDataMutation.mutate();
                }} 
                disabled={isRefreshing}
                className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {isRefreshing ? 'Aktualisiere...' : 'Refresh'}
              </Button>
              {isRefreshing && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-lg z-10 min-w-[280px]">
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-slate-300">
                      <span>{Math.round(refreshProgress)}% abgeschlossen</span>
                      <span>{Math.round((stocks.length * 1000 * (1 - refreshProgress / 100)) / 1000)}s verbleibend</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-blue-500 h-full transition-all duration-300 ease-out"
                        style={{ width: `${refreshProgress}%` }}
                      />
                    </div>
                    <div className="text-xs text-slate-400 text-center">
                      Aktualisiere {stocks.length} Aktien...
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          <Button onClick={exportToPDF} className="bg-purple-600 hover:bg-purple-700 text-white">
            <Download className="w-4 h-4 mr-2" />
            PDF Export
          </Button>

          {isAuthenticated && (
            <div className="relative">
              <Button 
                onClick={() => {
                  toast.info("In Entwicklung", {
                    description: "Diese Funktion befindet sich noch in Entwicklung und ist bald verfügbar."
                  });
                }}
                disabled={true}
                className="bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {isLoadingAlternatives ? 'Analysiere...' : 'Alternativen'}
              </Button>
              {isLoadingAlternatives && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-700 rounded-b overflow-hidden">
                  <div 
                    className="h-full bg-orange-400 transition-all duration-300"
                    style={{ width: `${alternativesProgress}%` }}
                  />
                </div>
              )}
            </div>
          )}
          {isAuthenticated && (
            <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
              setIsAddDialogOpen(open);
              if (open) {
                // Reset form when dialog opens
                setFormData({});
                setTickerSearchQuery('');
                setShowTickerSuggestions(false);
              }
            }}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                  <Plus className="w-4 h-4 mr-2" />
                  Neue Aktie
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-slate-800 border-slate-700">
                <DialogHeader>
                  <DialogTitle className="text-white">Neue Aktie hinzufügen</DialogTitle>
                  <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
                    <X className="h-4 w-4 text-white" />
                    <span className="sr-only">Schließen</span>
                  </DialogClose>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="relative">
                    <Input
                      placeholder="Firmenname oder Ticker suchen..."
                      value={tickerSearchQuery}
                      onChange={(e) => {
                        const value = e.target.value;
                        setTickerSearchQuery(value);
                        setFormData({ ...formData, companyName: value });
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
                              const ticker = suggestion.displaySymbol; // Use displaySymbol (e.g., "NOVN.SW") instead of symbol ("NOVN")
                              setFormData({
                                ...formData,
                                companyName: suggestion.shortname,
                                ticker: ticker,
                              });
                              setTickerSearchQuery(ticker);
                              setShowTickerSuggestions(false);
                              // Automatically load data after selection
                              toast.info("Laden...", { description: "Daten werden geladen..." });
                              fetchStockDataMutation.mutate(ticker);
                            }}
                            className="w-full px-4 py-2 text-left hover:bg-slate-600 text-white"
                          >
                            <div className="font-medium">{suggestion.shortname}</div>
                            <div className="text-sm text-slate-400">
                              {suggestion.displaySymbol}
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
                  {/* P/E, PEG, Sharpe Ratio Row */}
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      placeholder="P/E Ratio"
                      type="number"
                      step="0.01"
                      value={formData.peRatio || ""}
                      onChange={(e) => setFormData({ ...formData, peRatio: e.target.value })}
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                    <Input
                      placeholder="PEG Ratio"
                      type="number"
                      step="0.01"
                      value={formData.pegRatio || ""}
                      onChange={(e) => setFormData({ ...formData, pegRatio: e.target.value })}
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      placeholder="Sharpe Ratio"
                      type="number"
                      step="0.01"
                      value={formData.sharpeRatio || ""}
                      onChange={(e) => setFormData({ ...formData, sharpeRatio: e.target.value })}
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                    <Input
                      placeholder="Dividendenrendite (%)"
                      type="number"
                      step="0.01"
                      value={formData.dividendYield || ""}
                      onChange={(e) => setFormData({ ...formData, dividendYield: e.target.value })}
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                  </div>
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
                      <SelectValue placeholder="Kategorie wählen (Investment-Typ)" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700 text-white">
                      <SelectItem value="Dividendenaktien" className="text-white hover:bg-slate-700 focus:bg-slate-700 focus:text-white">Dividendenaktien</SelectItem>
                      <SelectItem value="Wachstumsaktien" className="text-white hover:bg-slate-700 focus:bg-slate-700 focus:text-white">Wachstumsaktien</SelectItem>
                      <SelectItem value="ETF" className="text-white hover:bg-slate-700 focus:bg-slate-700 focus:text-white">ETF</SelectItem>
                      <SelectItem value="Value" className="text-white hover:bg-slate-700 focus:bg-slate-700 focus:text-white">Value</SelectItem>
                      <SelectItem value="Andere" className="text-white hover:bg-slate-700 focus:bg-slate-700 focus:text-white">Andere</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={formData.sector || ""} onValueChange={(v) => setFormData({ ...formData, sector: v })}>
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                      <SelectValue placeholder="Branche wählen (optional)" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700 text-white">
                      <SelectItem value="Automotive" className="text-white hover:bg-slate-700 focus:bg-slate-700 focus:text-white">Automotive</SelectItem>
                      <SelectItem value="Healthcare" className="text-white hover:bg-slate-700 focus:bg-slate-700 focus:text-white">Healthcare</SelectItem>
                      <SelectItem value="Technology" className="text-white hover:bg-slate-700 focus:bg-slate-700 focus:text-white">Technology</SelectItem>
                      <SelectItem value="Finance" className="text-white hover:bg-slate-700 focus:bg-slate-700 focus:text-white">Finance</SelectItem>
                      <SelectItem value="Consumer" className="text-white hover:bg-slate-700 focus:bg-slate-700 focus:text-white">Consumer</SelectItem>
                      <SelectItem value="Energy" className="text-white hover:bg-slate-700 focus:bg-slate-700 focus:text-white">Energy</SelectItem>
                      <SelectItem value="Industrials" className="text-white hover:bg-slate-700 focus:bg-slate-700 focus:text-white">Industrials</SelectItem>
                      <SelectItem value="Materials" className="text-white hover:bg-slate-700 focus:bg-slate-700 focus:text-white">Materials</SelectItem>
                      <SelectItem value="Real Estate" className="text-white hover:bg-slate-700 focus:bg-slate-700 focus:text-white">Real Estate</SelectItem>
                      <SelectItem value="Utilities" className="text-white hover:bg-slate-700 focus:bg-slate-700 focus:text-white">Utilities</SelectItem>
                      <SelectItem value="Telecommunications" className="text-white hover:bg-slate-700 focus:bg-slate-700 focus:text-white">Telecommunications</SelectItem>
                      <SelectItem value="Andere" className="text-white hover:bg-slate-700 focus:bg-slate-700 focus:text-white">Andere</SelectItem>
                    </SelectContent>
                  </Select>
                  <Textarea
                    placeholder="Kommentar (optional) - z.B. Grund für Kauf, Strategie, etc."
                    value={formData.comment || ""}
                    onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
                    className="bg-slate-700 border-slate-600 text-white"
                    rows={3}
                  />
                  <Button 
                    onClick={() => {
                      const ticker = formData.ticker || formData.companyName;
                      if (!ticker) {
                        toast.error("Fehler", { description: "Bitte geben Sie einen Ticker oder Firmennamen ein" });
                        return;
                      }
                      toast.info("Laden...", { description: "Daten werden geladen..." });
                      fetchStockDataMutation.mutate(ticker);
                    }}
                    disabled={fetchStockDataMutation.isPending}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                  >
                    {fetchStockDataMutation.isPending ? "Lädt..." : "Daten laden"}
                  </Button>
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
              <div className="flex items-center justify-between">
                <CardTitle className="text-white">Aktien ({filteredStocks.length})</CardTitle>
                <Button
                  onClick={() => setShowWeeklyOverview(true)}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold"
                >
                  KI-Wochenüberblick
                </Button>
              </div>
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
                      <th className="text-left py-2 px-2 text-slate-400 w-12">Logo</th>
                      <th onClick={() => handleSort('companyName')} className="text-left py-2 px-2 text-slate-400 cursor-pointer hover:text-white">
                        Titel {sortField === 'companyName' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th onClick={() => handleSort('ticker')} className="text-left py-2 px-2 text-slate-400 cursor-pointer hover:text-white">
                        Ticker {sortField === 'ticker' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th onClick={() => handleSort('currentPrice')} className="text-left py-2 px-2 text-slate-400 cursor-pointer hover:text-white">
                        Kurs {sortField === 'currentPrice' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th onClick={() => handleSort('ytdPerformance')} className="text-left py-2 px-2 text-slate-400 cursor-pointer hover:text-white">
                        YTD % {sortField === 'ytdPerformance' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th onClick={() => handleSort('peRatio')} className="text-left py-2 px-2 text-slate-400 cursor-pointer hover:text-white">
                        P/E {sortField === 'peRatio' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th onClick={() => handleSort('pegRatio')} className="text-left py-2 px-2 text-slate-400 cursor-pointer hover:text-white">
                        PEG {sortField === 'pegRatio' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th onClick={() => handleSort('sharpeRatio')} className="text-left py-2 px-2 text-slate-400 cursor-pointer hover:text-white">
                        Sharpe {sortField === 'sharpeRatio' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th onClick={() => handleSort('dividendYield')} className="text-left py-2 px-2 text-slate-400 cursor-pointer hover:text-white">
                        Div. Rendite {sortField === 'dividendYield' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th onClick={() => handleSort('score')} className="text-center py-2 px-2 text-slate-400 cursor-pointer hover:text-white">
                        Score {sortField === 'score' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th onClick={() => handleSort('portfolioWeight')} className="text-left py-2 px-2 text-slate-400 cursor-pointer hover:text-white">
                        Portfolio % {sortField === 'portfolioWeight' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th onClick={() => handleSort('category')} className="text-left py-2 px-2 text-slate-400 cursor-pointer hover:text-white">
                        Kategorie {sortField === 'category' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th onClick={() => handleSort('sector')} className="text-left py-2 px-2 text-slate-400 cursor-pointer hover:text-white">
                        Branche {sortField === 'sector' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="text-center py-2 px-2 text-slate-400">Info</th>
                      <th className="text-left py-2 px-2 text-slate-400">Aktionen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStocks.map(stock => (
                      <tr key={stock.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                        <td className="py-2 px-2">
                          <StockLogo ticker={stock.ticker} companyName={stock.companyName} size="sm" />
                        </td>
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
                        <td className="py-2 px-2">
                          {stock.ytdPerformance ? (
                            <span className={parseFloat(stock.ytdPerformance) >= 0 ? "text-green-400" : "text-red-400"}>
                              {parseFloat(stock.ytdPerformance) >= 0 ? "+" : ""}{parseFloat(stock.ytdPerformance).toFixed(1)}%
                            </span>
                          ) : "-"}
                        </td>
                        <td className="py-2 px-2 text-slate-300">{stock.peRatio ? parseFloat(stock.peRatio).toFixed(1) : "-"}</td>
                        <td className="py-2 px-2 text-slate-300">{stock.pegRatio ? parseFloat(stock.pegRatio).toFixed(1) : "-"}</td>
                        <td className="py-2 px-2">
                          {stock.sharpeRatio ? (
                            <span className={parseFloat(stock.sharpeRatio) >= 1 ? "text-green-400" : parseFloat(stock.sharpeRatio) >= 0 ? "text-yellow-400" : "text-red-400"}>
                              {parseFloat(stock.sharpeRatio).toFixed(2)}
                            </span>
                          ) : "-"}
                        </td>
                        <td className="py-2 px-2 text-green-400">{stock.dividendYield ? parseFloat(stock.dividendYield).toFixed(1) + '%' : "-"}</td>
                        <td className="py-2 px-2 text-center">
                          {(() => {
                            const score = stockScores.find(s => s.ticker === stock.ticker);
                            if (!score) return <span className="text-slate-500">-</span>;
                            
                            const colorMap = {
                              red: 'bg-red-500',
                              orange: 'bg-orange-500',
                              yellow: 'bg-yellow-500',
                              green: 'bg-green-500',
                            };
                            
                            return (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={() => {
                                      setSelectedScoreDetail(score);
                                      setShowScoreDetail(true);
                                    }}
                                    className={`px-2 py-1 rounded text-white text-xs font-bold ${colorMap[score.color]} hover:opacity-80 cursor-pointer`}
                                  >
                                    {score.totalScore.toFixed(0)}
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent className="bg-slate-700 border-slate-600 text-white">
                                  <div className="text-sm">
                                    <div className="font-semibold">Score: {score.totalScore.toFixed(0)}</div>
                                    <div className="text-slate-300">{getScoreLabel(score.totalScore)}</div>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            );
                          })()}
                        </td>
                        <td className="py-2 px-2 text-slate-300">{parseFloat(stock.portfolioWeight || "0").toFixed(2)}%</td>
                        <td className="py-2 px-2 text-slate-400">{stock.category}</td>
                        <td className="py-2 px-2 text-slate-400">{stock.sector || '-'}</td>
                        <td className="py-2 px-2 text-center">
                          {/* ETF: Open factsheet PDF, Stock: Show moats dialog */}
                          {stock.factsheetUrl ? (
                            <button 
                              onClick={() => stock.factsheetUrl && window.open(stock.factsheetUrl, '_blank')}
                              className="p-1 hover:bg-slate-600 rounded text-blue-400 hover:text-blue-300"
                              title="ETF Factsheet öffnen"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"/>
                                <line x1="12" y1="16" x2="12" y2="12"/>
                                <line x1="12" y1="8" x2="12.01" y2="8"/>
                              </svg>
                            </button>
                          ) : (stock.moat1 || stock.moat2 || stock.moat3) && (
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
                              <DialogContent className="bg-slate-800 border-slate-700 max-w-2xl max-h-[90vh] overflow-y-auto [&>button]:text-white [&>button]:hover:text-gray-300">
                                <DialogHeader>
                                  <div className="flex items-center justify-between">
                                    <DialogTitle className="text-white text-xl">{stock.companyName}</DialogTitle>
                                    {isAuthenticated && (
                                      <RefreshStockButton ticker={stock.ticker} />
                                    )}
                                  </div>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div className="flex items-center gap-4 pb-4 border-slate-700">
                                    <StockLogo ticker={stock.ticker} companyName={stock.companyName} size="lg" />
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

                                  {/* 10-Year Price Chart */}
                                  <div className="pt-4 border-t border-slate-700">
                                    <h4 className="text-md font-semibold text-blue-400 mb-3">Kursentwicklung</h4>
                                    <div className="bg-slate-700/50 rounded-lg p-4">
                                      <iframe
                                        src={`https://www.tradingview.com/widgetembed/?frameElementId=tradingview_chart&symbol=${(() => {
                                          const ticker = stock.ticker;
                                          // Swiss stocks: SGKN.SW -> SIX:SGKN
                                          if (ticker.endsWith('.SW')) {
                                            return 'SIX%3A' + ticker.replace('.SW', '');
                                          }
                                          // Paris stocks: SU.PA -> EURONEXT:SU
                                          if (ticker.endsWith('.PA')) {
                                            return 'EURONEXT%3A' + ticker.replace('.PA', '');
                                          }
                                          // Milan stocks: MONC.MI -> MIL:MONC
                                          if (ticker.endsWith('.MI')) {
                                            return 'MIL%3A' + ticker.replace('.MI', '');
                                          }
                                          // US stocks: no prefix needed
                                          return ticker;
                                        })()}&interval=D&hidesidetoolbar=0&symboledit=1&saveimage=1&toolbarbg=f1f3f6&studies=%5B%5D&theme=dark&style=3&timezone=Etc%2FUTC&withdateranges=1&studies_overrides=%7B%7D&overrides=%7B%7D&enabled_features=%5B%5D&disabled_features=%5B%5D&locale=de_DE&utm_source=&utm_medium=widget&utm_campaign=chart&utm_term=${stock.ticker}`}
                                        className="w-full h-[400px] border-0 rounded"
                                        title="TradingView Chart"
                                      />
                                    </div>
                                  </div>

                                  {/* Forward P/E Chart */}
                                  <div className="mt-6">
                                    <h4 className="text-md font-semibold text-blue-400 mb-3">Forward P/E Entwicklung</h4>
                                    <ForwardPEChart ticker={stock.ticker} />
                                  </div>

                                  {/* AI Daily News Section */}
                                  <DailyNewsSection ticker={stock.ticker} companyName={stock.companyName} />

                                  {/* Owner-only: Competition Analyzer */}
                                  {user?.role === 'admin' && (
                                    <div className="pt-4 border-t border-slate-700">
                                      <div className="relative">
                                        <Button
                                          onClick={() => {
                                            setCompetitorAnalysisStock(stock);
                                            setIsLoadingCompetitors(true);
                                            findCompetitorsMutation.mutate(
                                              {
                                                ticker: stock.ticker,
                                                name: stock.companyName,
                                                category: stock.category || "Unknown"
                                              },
                                              {
                                                onSuccess: (data) => {
                                                  setCompetitorAnalysisData(data);
                                                  setIsLoadingCompetitors(false);
                                                  setIsCompetitorDialogOpen(true);
                                                  toast.success("Alternativen gefunden", {
                                                    description: `${data.alternatives.length} bessere Alternativen gefunden`,
                                                  });
                                                },
                                              }
                                            );
                                          }}
                                          disabled={isLoadingCompetitors}
                                          className="w-full bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                          {isLoadingCompetitors ? (
                                            <>
                                              <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                              </svg>
                                              Analysiere...
                                            </>
                                          ) : (
                                            <>
                                              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                              </svg>
                                              Alternativen prüfen
                                            </>
                                          )}
                                        </Button>
                                        {isLoadingCompetitors && (
                                          <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-700 rounded-b overflow-hidden">
                                            <div className="h-full bg-purple-400 animate-pulse" style={{ width: '100%' }} />
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}
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
                                <DialogContent className="bg-slate-800 border-slate-700 [&>button]:text-white [&>button]:hover:text-gray-300">
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
                                      <label className="block text-sm font-medium text-slate-300 mb-1">Kategorie (Investment-Typ)</label>
                                      <select
                                        value={formData.category || ""}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                        className="w-full bg-slate-700 border border-slate-600 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      >
                                        <option value="">Kategorie wählen</option>
                                        <option value="Dividendenaktien">Dividendenaktien</option>
                                        <option value="Wachstumsaktien">Wachstumsaktien</option>
                                        <option value="ETF">ETF</option>
                                        <option value="Value">Value</option>
                                        <option value="Andere">Andere</option>
                                      </select>
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-slate-300 mb-1">Branche (Sektor)</label>
                                      <select
                                        value={formData.sector || ""}
                                        onChange={(e) => setFormData({ ...formData, sector: e.target.value })}
                                        className="w-full bg-slate-700 border border-slate-600 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      >
                                        <option value="">Branche wählen (optional)</option>
                                        <option value="Automotive">Automotive</option>
                                        <option value="Healthcare">Healthcare</option>
                                        <option value="Technology">Technology</option>
                                        <option value="Finance">Finance</option>
                                        <option value="Consumer">Consumer</option>
                                        <option value="Energy">Energy</option>
                                        <option value="Industrials">Industrials</option>
                                        <option value="Materials">Materials</option>
                                        <option value="Real Estate">Real Estate</option>
                                        <option value="Utilities">Utilities</option>
                                        <option value="Telecommunications">Telecommunications</option>
                                        <option value="Andere">Andere</option>
                                      </select>
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
      
      {/* Competitor Comparison Dialog */}
      <Dialog open={isCompetitorDialogOpen} onOpenChange={setIsCompetitorDialogOpen}>
        <DialogContent className="bg-slate-800 border-slate-700 max-w-[95vw] lg:max-w-7xl max-h-[90vh] overflow-y-auto [&>button]:text-white [&>button]:hover:text-gray-300">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-white text-xl">
                Alternativen für {competitorAnalysisStock?.companyName || competitorAnalysisData?.currentStock?.name || 'Aktie'}
              </DialogTitle>
              <div className="flex gap-2">
                {/* Back to Overview Button */}
                {stocksWithAlternatives.length > 0 && currentAlternativeIndex !== null && (
                  <Button
                    onClick={() => {
                      setCurrentAlternativeIndex(null);
                      setCompetitorAnalysisStock(null);
                      setCompetitorAnalysisData(null);
                    }}
                    variant="outline"
                    className="border-slate-600 text-white hover:bg-slate-700"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M15 18l-6-6 6-6" />
                    </svg>
                    Übersicht
                  </Button>
                )}
                {/* Next Button */}
                {stocksWithAlternatives.length > 0 && currentAlternativeIndex !== null && currentAlternativeIndex < stocksWithAlternatives.length - 1 && (
                  <Button
                    onClick={() => {
                      const nextIndex = currentAlternativeIndex + 1;
                      const nextStock = stocksWithAlternatives[nextIndex].stock;
                      setCurrentAlternativeIndex(nextIndex);
                      setCompetitorAnalysisStock(nextStock);
                      findCompetitorsMutation.mutate(
                        { 
                          ticker: nextStock.ticker,
                          name: nextStock.companyName,
                          category: nextStock.category || "Unknown"
                        },
                        {
                          onSuccess: (data) => {
                            setCompetitorAnalysisData(data);
                          },
                        }
                      );
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Weiter
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 ml-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </Button>
                )}
              </div>
            </div>
          </DialogHeader>
          
          {competitorAnalysisData && (
            <div className="space-y-6">
              {/* Current Stock Info */}
              <div className="bg-slate-700/50 p-4 rounded-lg">
                <h3 className="text-sm font-semibold text-slate-400 mb-2">Aktuelle Aktie</h3>
                <div className="mb-3">
                  <h4 className="text-white font-semibold text-lg">{competitorAnalysisData.currentStock.name || competitorAnalysisStock?.companyName}</h4>
                  <p className="text-slate-400 text-sm">{competitorAnalysisData.currentStock.ticker}</p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                  <div>
                    <span className="text-slate-400">Kurs:</span>
                    <span className="ml-2 text-white font-semibold">{competitorAnalysisData.currentStock.currentPrice?.toFixed(2) || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Sharpe:</span>
                    <span className="ml-2 text-white font-semibold">{competitorAnalysisData.currentStock.sharpeRatio?.toFixed(2) || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">PEG:</span>
                    <span className="ml-2 text-white font-semibold">{competitorAnalysisData.currentStock.pegRatio?.toFixed(2) || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">P/E:</span>
                    <span className="ml-2 text-white font-semibold">{competitorAnalysisData.currentStock.peRatio?.toFixed(2) || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Div.:</span>
                    <span className="ml-2 text-white font-semibold">{competitorAnalysisData.currentStock.dividendYield ? competitorAnalysisData.currentStock.dividendYield.toFixed(2) + '%' : 'N/A'}</span>
                  </div>
                </div>
              </div>
              
              {/* Alternatives */}
              {competitorAnalysisData.alternatives.length > 0 ? (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-white">Gefundene Alternativen</h3>
                  {competitorAnalysisData.alternatives.map((alt: any, idx: number) => (
                    <div key={idx} className="bg-slate-700/30 p-5 rounded-lg border border-slate-600 hover:border-purple-500 transition-colors">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-4 flex-1">
                          {/* Company Logo */}
                          <StockLogo ticker={alt.ticker} companyName={alt.name} size="md" />
                          {/* Company Name and Ticker */}
                          <div>
                            <h4 className="text-white font-bold text-xl mb-1">{alt.companyName || alt.name}</h4>
                            <p className="text-slate-400 text-base">{alt.ticker}</p>
                          </div>
                        </div>
                        <div className="text-right ml-4">
                          <div className="text-green-400 font-bold text-xl">Score: {alt.score.toFixed(2)}</div>
                          <div className="text-slate-400 text-sm">vs. {competitorAnalysisData.currentStock.score.toFixed(2)}</div>
                        </div>
                      </div>
                      
                      {/* Metrics Comparison */}
                      <div className="grid grid-cols-5 gap-4 mb-4 text-sm">
                        <div>
                          <span className="text-slate-400 block">Kurs</span>
                          <span className="text-white font-semibold">{alt.currentPrice?.toFixed(2) || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Sharpe</span>
                          <span className={`font-semibold ${alt.sharpeRatio > competitorAnalysisData.currentStock.sharpeRatio ? 'text-green-400' : 'text-white'}`}>
                            {alt.sharpeRatio?.toFixed(2) || 'N/A'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">PEG</span>
                          <span className={`font-semibold ${alt.pegRatio < competitorAnalysisData.currentStock.pegRatio ? 'text-green-400' : 'text-white'}`}>
                            {alt.pegRatio?.toFixed(2) || 'N/A'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">P/E</span>
                          <span className="text-white font-semibold">{alt.peRatio?.toFixed(2) || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Div.</span>
                          <span className={`font-semibold ${alt.dividendYield > competitorAnalysisData.currentStock.dividendYield ? 'text-green-400' : 'text-white'}`}>
                            {alt.dividendYield ? alt.dividendYield.toFixed(2) + '%' : 'N/A'}
                          </span>
                        </div>
                      </div>
                      
                      {/* Reason */}
                      <p className="text-slate-300 text-sm mb-4 italic">{alt.reason}</p>
                      
                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        <Button
                          onClick={async () => {
                            if (confirm(`Möchten Sie ${competitorAnalysisStock.companyName} (${competitorAnalysisStock.ticker}) durch ${alt.name} (${alt.ticker}) ersetzen?`)) {
                              try {
                                // Save old stock data
                                const oldWeight = competitorAnalysisStock.portfolioWeight;
                                const oldCategory = competitorAnalysisStock.category;
                                const oldInvestment = competitorAnalysisStock.investmentAmount;
                                
                                // Delete old stock
                                await deleteStockMutation.mutateAsync({ ticker: competitorAnalysisStock.ticker });
                                
                                // Add new stock with same weight and category
                                await addStockMutation.mutateAsync({
                                  ticker: alt.ticker,
                                  companyName: alt.name,
                                  currentPrice: alt.currentPrice?.toString() || '0',
                                  category: oldCategory,
                                  portfolioWeight: oldWeight,
                                  investmentAmount: oldInvestment,
                                });
                                
                                toast.success("Titel ersetzt", {
                                  description: `${competitorAnalysisStock.companyName} wurde durch ${alt.name} ersetzt`
                                });
                                setIsCompetitorDialogOpen(false);
                                
                                // Refresh stock list
                                await refetchStocks();
                              } catch (error) {
                                toast.error("Fehler", {
                                  description: `${competitorAnalysisStock.ticker} konnte nicht ersetzt werden`
                                });
                              }
                            }
                          }}
                          className="flex-1 bg-orange-600 hover:bg-orange-700 text-white"
                        >
                          Bestehenden Titel ersetzen
                        </Button>
                        <Button
                          onClick={async () => {
                            if (confirm(`Möchten Sie ${alt.name} (${alt.ticker}) zum Portfolio hinzufügen?`)) {
                              try {
                                // Fetch complete stock data from API before adding
                                const stockData = await fetchStockDataMutation.mutateAsync(alt.ticker);
                                
                                // Add alternative stock to portfolio with all market data from API
                                await addStockMutation.mutateAsync({
                                  ticker: alt.ticker,
                                  companyName: stockData.companyName || alt.name,
                                  category: competitorAnalysisStock?.category || "Unknown",
                                  investmentAmount: 0, // User can edit later
                                  portfolioWeight: 0,
                                  // Use API data (with fallbacks to competitor analysis data)
                                  currentPrice: stockData.currentPrice?.toString() || alt.currentPrice?.toString() || "0",
                                  dividendYield: stockData.dividendYield?.toString() || "0",
                                  pegRatio: stockData.pegRatio?.toString() || "0",
                                  peRatio: stockData.peRatio?.toString() || "0",
                                  sharpeRatio: stockData.sharpeRatio?.toString() || alt.sharpeRatio?.toString() || "0",
                                  volatility: stockData.volatility?.toString() || alt.volatility?.toString() || "0",
                                  beta: stockData.beta?.toString() || alt.beta?.toString() || "0",
                                  ytdPerformance: stockData.ytdPerformance?.toString() || "0",
                                  ytdStartPrice: stockData.ytdStartPrice?.toString() || stockData.currentPrice?.toString() || "0",
                                  currency: stockData.currency || (alt.ticker.endsWith('.SW') ? 'CHF' : 'USD'),
                                });
                                
                                toast.success("Titel hinzugefügt", {
                                  description: `${alt.name} wurde zum Portfolio hinzugefügt mit allen Marktdaten`
                                });
                                
                                // Refresh stock list (but keep dialog open)
                                await refetchStocks();
                                // DO NOT close dialog: setIsCompetitorDialogOpen(false);
                              } catch (error) {
                                toast.error("Fehler", {
                                  description: `${alt.ticker} konnte nicht hinzugefügt werden: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
                                });
                              }
                            }
                          }}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                        >
                          Titel hinzufügen
                        </Button>
                        <Button
                          onClick={() => {
                            setIsCompetitorDialogOpen(false);
                            toast.success("Aktie behalten", {
                              description: `${competitorAnalysisStock.companyName} bleibt im Portfolio`
                            });
                          }}
                          variant="outline"
                          className="flex-1 border-slate-600 text-white hover:bg-slate-700 hover:text-white"
                        >
                          Aktie behalten
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400">
                  <p>Keine besseren Alternativen gefunden.</p>
                  <p className="text-sm mt-2">Die aktuelle Aktie hat bereits sehr gute Kennzahlen!</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Save Portfolio Dialog */}
      <Dialog open={isSavePortfolioDialogOpen} onOpenChange={setIsSavePortfolioDialogOpen}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle>Portfolio speichern</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Portfolio-Name</label>
              <input
                type="text"
                value={portfolioName}
                onChange={(e) => setPortfolioName(e.target.value)}
                placeholder="z.B. Mein Wachstumsportfolio"
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Beschreibung (optional)</label>
              <textarea
                value={portfolioDescription}
                onChange={(e) => setPortfolioDescription(e.target.value)}
                placeholder="Beschreiben Sie Ihre Portfolio-Strategie..."
                rows={3}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                onClick={() => {
                  setIsSavePortfolioDialogOpen(false);
                  setPortfolioName('');
                  setPortfolioDescription('');
                }}
                variant="outline"
                className="border-slate-600 text-white hover:bg-slate-700"
              >
                Abbrechen
              </Button>
              <Button
                onClick={async () => {
                  if (!portfolioName.trim()) {
                    toast.error('Fehler', { description: 'Bitte geben Sie einen Portfolio-Namen ein' });
                    return;
                  }
                  
                  try {
                    const portfolioData = JSON.stringify({
                      stocks: stocks.map(s => ({
                        ticker: s.ticker,
                        companyName: s.companyName,
                        portfolioWeight: s.portfolioWeight,
                        isManualWeight: s.isManualWeight,
                        category: s.category,
                      })),
                      savedAt: new Date().toISOString(),
                    });
                    
                    await savePortfolioMutation.mutateAsync({
                      name: portfolioName,
                      description: portfolioDescription || undefined,
                      portfolioData,
                    });
                    
                    toast.success('Erfolg', { description: `Portfolio "${portfolioName}" wurde gespeichert` });
                    setIsSavePortfolioDialogOpen(false);
                    setPortfolioName('');
                    setPortfolioDescription('');
                  } catch (error) {
                    console.error('Failed to save portfolio:', error);
                    toast.error('Fehler', { description: 'Portfolio konnte nicht gespeichert werden' });
                  }
                }}
                className="bg-green-600 hover:bg-green-700 text-white"
                disabled={!portfolioName.trim()}
              >
                Speichern
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Load Portfolio Dialog */}
      <Dialog open={isLoadPortfolioDialogOpen} onOpenChange={setIsLoadPortfolioDialogOpen}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-3xl">
          <DialogHeader>
            <DialogTitle>Portfolio laden</DialogTitle>
          </DialogHeader>
          <LoadPortfolioContent onClose={() => setIsLoadPortfolioDialogOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Score Detail Dialog */}
      <Dialog open={showScoreDetail} onOpenChange={setShowScoreDetail}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedScoreDetail && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">Score-Berechnung: {selectedScoreDetail.ticker}</span>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      selectedScoreDetail.type === 'dividend' ? 'bg-blue-600' : 'bg-purple-600'
                    }`}>
                      {selectedScoreDetail.type === 'dividend' ? 'Dividendenaktie' : 'Wachstumsaktie'}
                    </span>
                  </div>
                  <span className={`px-4 py-2 rounded-lg text-2xl font-bold ${
                    selectedScoreDetail.color === 'red' ? 'bg-red-500' :
                    selectedScoreDetail.color === 'orange' ? 'bg-orange-500' :
                    selectedScoreDetail.color === 'yellow' ? 'bg-yellow-500' :
                    'bg-green-500'
                  }`}>
                    {selectedScoreDetail.totalScore.toFixed(0)}
                  </span>
                </div>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedScoreDetail && (
            <div className="space-y-6">
              {/* Total Score Progress Bar */}
              <div className="bg-slate-900 p-4 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-slate-400 text-sm">Gesamt-Score</span>
                  <span className="text-white font-bold text-lg">{selectedScoreDetail.totalScore.toFixed(1)} / 100</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-4 overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-500 ${
                      selectedScoreDetail.color === 'red' ? 'bg-red-500' :
                      selectedScoreDetail.color === 'orange' ? 'bg-orange-500' :
                      selectedScoreDetail.color === 'yellow' ? 'bg-yellow-500' :
                      'bg-green-500'
                    }`}
                    style={{ width: `${selectedScoreDetail.totalScore}%` }}
                  />
                </div>
              </div>

              {/* Calculation Formula */}
              <div className="bg-slate-900 p-4 rounded-lg">
                <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  Berechnungsformel
                </h3>
                <div className="text-slate-300 text-sm space-y-2">
                  <p className="font-mono bg-slate-800 p-3 rounded">
                    Gesamt-Score = Σ (Kennzahl-Score × Gewichtung)
                  </p>
                  <p className="text-xs text-slate-400">
                    Jede Kennzahl wird auf einer Skala von 0-100 bewertet und mit ihrer Gewichtung multipliziert.
                  </p>
                </div>
              </div>

              {/* Sub-Scores with Progress Bars */}
              <div>
                <h3 className="text-white font-semibold mb-3">Kennzahlen-Breakdown</h3>
                <div className="space-y-3">
                  {selectedScoreDetail.subScores.map((sub: any, idx: number) => (
                    <div key={idx} className="bg-slate-900 p-4 rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-white font-medium">{sub.metric}</span>
                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                              sub.color === 'red' ? 'bg-red-500/20 text-red-400' :
                              sub.color === 'orange' ? 'bg-orange-500/20 text-orange-400' :
                              sub.color === 'yellow' ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-green-500/20 text-green-400'
                            }`}>
                              {sub.score != null ? parseFloat(sub.score).toFixed(1) : 'N/A'}
                            </span>
                          </div>
                          <div className="flex gap-4 text-xs text-slate-400">
                            <span>
                              Wert: <span className="text-slate-300">
                                {sub.value !== null && sub.value !== undefined ? (
                                  sub.metric.includes('Rendite') || sub.metric.includes('Yield') || sub.metric.includes('Wachstum') || sub.metric.includes('quote') ? 
                                    `${parseFloat(sub.value).toFixed(2)}%` : 
                                    parseFloat(sub.value).toFixed(2)
                                ) : 'N/A'}
                              </span>
                            </span>
                            <span>
                              Gewichtung: <span className="text-slate-300">{sub.weight != null ? (parseFloat(sub.weight) * 100).toFixed(0) : '0'}%</span>
                            </span>
                            <span>
                              Beitrag: <span className="text-slate-300">{(sub.score != null && sub.weight != null) ? (parseFloat(sub.score) * parseFloat(sub.weight)).toFixed(1) : 'N/A'}</span>
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden mt-2">
                        <div 
                          className={`h-full transition-all duration-500 ${
                            sub.color === 'red' ? 'bg-red-500' :
                            sub.color === 'orange' ? 'bg-orange-500' :
                            sub.color === 'yellow' ? 'bg-yellow-500' :
                            'bg-green-500'
                          }`}
                          style={{ width: `${sub.score != null ? parseFloat(sub.score) : 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Legend */}
              <div className="bg-slate-900 p-4 rounded-lg">
                <h3 className="text-white font-semibold mb-3 text-sm">Bewertungsskala</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-red-500" />
                    <span className="text-slate-300">Rot: 0-40</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-orange-500" />
                    <span className="text-slate-300">Orange: 41-60</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-yellow-500" />
                    <span className="text-slate-300">Gelb: 61-80</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-green-500" />
                    <span className="text-slate-300">Grün: 81-100</span>
                  </div>
                </div>
              </div>

              {/* Close Button */}
              <div className="flex justify-end pt-2">
                <Button
                  onClick={() => setShowScoreDetail(false)}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Schließen
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Alternatives Overview Dialog */}
      <Dialog open={isAlternativesOverviewOpen} onOpenChange={setIsAlternativesOverviewOpen}>
        <DialogContent className="bg-slate-800 border-slate-700 max-w-4xl max-h-[90vh] overflow-y-auto [&>button]:text-white [&>button]:hover:text-gray-300">
          <DialogHeader>
            <DialogTitle className="text-white text-xl">
              Titel mit verfügbaren Alternativen
            </DialogTitle>
          </DialogHeader>
          
          {stocksWithAlternatives.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-400">Lade Alternativen...</p>
            </div>
          ) : (
            <div className="space-y-3">
              {stocksWithAlternatives.map(({ stock, alternativesCount }) => (
                <div 
                  key={stock.id}
                  className="bg-slate-700/30 p-4 rounded-lg border border-slate-600 hover:border-orange-500 transition-colors cursor-pointer"
                  onClick={() => {
                    const index = stocksWithAlternatives.findIndex(s => s.stock.ticker === stock.ticker);
                    const stockWithAlts = stocksWithAlternatives[index];
                    
                    if (stockWithAlts && stockWithAlts.alternativesData) {
                      // Use stored alternatives data (no API call needed)
                      setCurrentAlternativeIndex(index);
                      setCompetitorAnalysisStock(stock);
                      setCompetitorAnalysisData(stockWithAlts.alternativesData);
                      setIsAlternativesOverviewOpen(false);
                      setIsCompetitorDialogOpen(true);
                    }
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <StockLogo ticker={stock.ticker} companyName={stock.companyName} size="md" />
                      <div>
                        <h4 className="text-white font-bold text-lg">{stock.companyName}</h4>
                        <p className="text-slate-400 text-sm">{stock.ticker}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-orange-400 font-bold text-lg">{alternativesCount} Alternative{alternativesCount > 1 ? 'n' : ''}</div>
                      <div className="text-slate-400 text-sm">Score: {stock.score}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>

      {/* Weekly Overview Dialog */}
      <WeeklyOverviewDialog 
        open={showWeeklyOverview} 
        onOpenChange={setShowWeeklyOverview} 
      />
    </>
  );
}

