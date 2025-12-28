import { useState, useMemo, useEffect } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { TransactionModal } from "@/components/TransactionModal";
import { TransactionHistory } from "@/components/TransactionHistory";
import { LivePerformanceChart } from "@/components/LivePerformanceChart";
import DividendCalendarModal from "@/components/DividendCalendarModal";
import AnnualPerformanceSummary from "@/components/AnnualPerformanceSummary";
import { CsvImportModal } from "@/components/CsvImportModal";
import { ArrowLeft, Plus, TrendingUp, Calendar, Trash2, Download, Upload, ChevronRight, ChevronDown, List } from "lucide-react";
import { toast } from "sonner";
import { StockLogo } from "@/components/StockLogo";

export default function PortfolioDetail() {
  const [, params] = useRoute("/portfolio/:id");
  const [, setLocation] = useLocation();
  const portfolioId = params?.id ? parseInt(params.id as string) : null;

  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [showDividendCalendar, setShowDividendCalendar] = useState(false);
  const [showAnnualPerformance, setShowAnnualPerformance] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCsvImport, setShowCsvImport] = useState(false);

  const utils = trpc.useUtils();

  // Bulk delete mutation
  const deleteInitialTransactions = trpc.portfolioTransactions.deleteInitialTransactions.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.deletedCount} Initial-Transaktionen erfolgreich gelöscht`);
      utils.portfolioTransactions.list.invalidate();
      utils.portfolios.list.invalidate();
      utils.portfolios.calculateLivePerformance.invalidate();
      setShowDeleteConfirm(false);
    },
    onError: (error) => {
      toast.error(`Fehler beim Löschen: ${error.message}`);
    },
  });

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

  // Fetch live performance if portfolio is live
  const { data: livePerformance } = trpc.portfolios.calculateLivePerformance.useQuery(
    portfolioId!,
    { enabled: !!portfolioId && !!portfolio && Boolean(portfolio.isLive) }
  );

  // Fetch CHF-converted holdings with performance
  const { data: chfHoldings = [] } = trpc.portfolios.getHoldingsWithChfPerformance.useQuery(
    portfolioId!,
    { enabled: !!portfolioId && !!portfolio && Boolean(portfolio.isLive) }
  );
  


  // Fetch dividend calendar
  const { data: dividendCalendar, isLoading: isDividendLoading } = trpc.dividendCalendar.getUpcoming.useQuery(
    { portfolioId: portfolioId!, daysAhead: 365 },
    { enabled: !!portfolioId && showDividendCalendar }
  );

  // Fetch annual performance summary
  const { data: annualPerformance, isLoading: isPerformanceLoading, error: performanceError } = trpc.annualPerformance.getSummary.useQuery(
    { portfolioId: portfolioId! },
    { enabled: !!portfolioId && showAnnualPerformance }
  );

  // Calculate holdings from transactions
  const holdingsByTicker = useMemo(() => {
    const holdings: Record<string, { shares: number; totalInvested: number; totalBought: number; totalSold: number; avgBuyPrice: number }> = {};
    
    transactions.forEach((tx: any) => {
      if (!holdings[tx.ticker]) {
        holdings[tx.ticker] = { shares: 0, totalInvested: 0, totalBought: 0, totalSold: 0, avgBuyPrice: 0 };
      }
      
      const shares = parseFloat(tx.shares || '0');
      const price = parseFloat(tx.pricePerShare || '0');
      // Use totalAmount from transaction (includes fees) if available, otherwise calculate
      const amount = parseFloat(tx.totalAmount || '0') || (shares * price);
      
      if (tx.transactionType === 'buy') {
        holdings[tx.ticker].shares += shares;
        holdings[tx.ticker].totalBought += shares;
        holdings[tx.ticker].totalInvested += amount;
        // Calculate average buy price (cost per share including fees)
        holdings[tx.ticker].avgBuyPrice = holdings[tx.ticker].totalInvested / holdings[tx.ticker].totalBought;
      } else if (tx.transactionType === 'sell') {
        holdings[tx.ticker].shares -= shares;
        holdings[tx.ticker].totalSold += amount;
        // Reduce totalInvested proportionally based on average buy price
        const costBasis = shares * holdings[tx.ticker].avgBuyPrice;
        holdings[tx.ticker].totalInvested -= costBasis;
      }
    });
    
    return holdings;
  }, [transactions]);

  // Calculate portfolio summary (deposits, cash, invested in stocks)
  const portfolioSummary = useMemo(() => {
    let totalDeposits = 0;
    let totalBuyAmounts = 0;
    let totalSellProceeds = 0;
    let totalDividends = 0;

    transactions.forEach((tx: any) => {
      const amount = parseFloat(tx.totalAmountCHF || tx.totalAmount || '0');
      const isInitialTransaction = tx.notes && tx.notes.includes('Initial position');
      
      if (tx.transactionType === 'deposit') {
        totalDeposits += amount;
      } else if (tx.transactionType === 'withdrawal') {
        totalDeposits -= Math.abs(amount);
      } else if (tx.transactionType === 'buy') {
        // Treat initial transactions as implicit deposits
        if (isInitialTransaction) {
          totalDeposits += amount;
        }
        totalBuyAmounts += amount;
      } else if (tx.transactionType === 'sell') {
        totalSellProceeds += amount;
      } else if (tx.transactionType === 'dividend') {
        totalDividends += amount;
      }
    });

    // Calculate total invested in stocks from holdings (current cost basis in CHF)
    let totalInvestedInStocks = 0;
    if (portfolio?.isLive && chfHoldings.length > 0) {
      // For live portfolios, sum totalInvestedCHF from chfHoldings
      chfHoldings.forEach((holding: any) => {
        totalInvestedInStocks += parseFloat(holding.totalInvestedCHF || '0');
      });
    } else {
      // Fallback: sum from holdingsByTicker (in local currency, not accurate for multi-currency)
      Object.values(holdingsByTicker).forEach((holding: any) => {
        if (holding.shares > 0) {
          totalInvestedInStocks += holding.totalInvested;
        }
      });
    }

    const cashPosition = totalDeposits - totalBuyAmounts + totalSellProceeds + totalDividends;

    return {
      totalDeposits,
      totalInvestedInStocks,
      cashPosition
    };
  }, [transactions, holdingsByTicker, chfHoldings, portfolio?.isLive]);

  // Toggle live mutation
  const toggleLiveMutation = trpc.portfolios.toggleLive.useMutation({
    onSuccess: () => {
      utils.portfolios.list.invalidate();
      toast.success("Status aktualisiert");
    },
    onError: () => {
      toast.error("Fehler beim Aktualisieren des Status");
    }
  });

  // Update live start date mutation
  const updateLiveStartDateMutation = trpc.portfolios.updateLiveStartDate.useMutation({
    onSuccess: () => {
      utils.portfolios.list.invalidate();
      utils.portfolios.calculateLivePerformance.invalidate();
      toast.success("Live-Start-Datum aktualisiert");
    },
    onError: () => {
      toast.error("Fehler beim Aktualisieren des Datums");
    }
  });

  // Export to Excel function
  const exportToExcel = async () => {
    if (!portfolio || !portfolioData) {
      toast.error("Keine Daten zum Exportieren");
      return;
    }

    try {
      // Import ExcelJS dynamically
      const ExcelJS = (await import('exceljs')).default;
      
      // Create workbook and worksheet
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Portfolio Positionen');

      // Define columns
      worksheet.columns = [
        { header: 'Ticker', key: 'ticker', width: 12 },
        { header: 'Name', key: 'name', width: 25 },
        { header: 'Stückzahl', key: 'shares', width: 12 },
        { header: 'Gewicht', key: 'weight', width: 10 },
        { header: 'Einstandskurs (FW)', key: 'avgPrice', width: 18 },
        { header: 'Einstandswert (CHF)', key: 'totalInvested', width: 18 },
        { header: 'Aktueller Kurs (FW)', key: 'currentPrice', width: 18 },
        { header: 'Aktueller Wert (CHF)', key: 'currentValue', width: 18 },
        { header: 'Dividende', key: 'dividend', width: 12 },
        { header: 'YTD', key: 'ytd', width: 10 },
        { header: portfolio.isLive ? 'Live Perf. (CHF)' : 'Live Perf.', key: 'livePerf', width: 15 }
      ];

      // Style header row
      worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4B5563' }
      };
      worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

      // Cash row
      const cashPosition = livePerformance?.cashPosition ?? portfolioSummary.cashPosition ?? 0;
      worksheet.addRow({
        ticker: 'CASH',
        name: '💰 Cash',
        shares: '',
        weight: '',
        avgPrice: '',
        totalInvested: Math.round(cashPosition),
        currentPrice: '',
        currentValue: Math.round(cashPosition),
        dividend: '',
        ytd: '',
        livePerf: ''
      });

      // Stock rows
      portfolioData.filter((stock: any) => stock.shares > 0).forEach((stock: any) => {
        const chfHolding = chfHoldings.find((h: any) => h.ticker === stock.ticker);
        
        // Einstandskurs
        let avgBuyPrice = '';
        if (portfolio.isLive && chfHolding?.avgBuyPrice) {
          avgBuyPrice = `${stock.currency || 'CHF'} ${chfHolding.avgBuyPrice.toFixed(1)}`;
        } else {
          const holding = holdingsByTicker[stock.ticker];
          if (holding?.avgBuyPrice > 0) {
            avgBuyPrice = `${stock.currency || 'CHF'} ${Math.round(holding.avgBuyPrice)}`;
          }
        }

        // Einstandswert
        let totalInvestedCHF = 0;
        if (portfolio.isLive && chfHolding) {
          totalInvestedCHF = Math.round(chfHolding.totalInvestedCHF);
        } else {
          totalInvestedCHF = Math.round(stock.totalInvested || 0);
        }

        // Aktueller Wert
        let currentValueCHF = 0;
        if (portfolio.isLive && chfHolding) {
          currentValueCHF = Math.round(chfHolding.currentValueCHF);
        } else {
          currentValueCHF = Math.round(stock.currentValue || 0);
        }

        // Live Performance
        let livePerf = '';
        if (portfolio.isLive && chfHolding) {
          livePerf = `${chfHolding.performanceCHF >= 0 ? '+' : ''}${chfHolding.performanceCHF.toFixed(1)}%`;
        } else if (stock.totalInvested > 0) {
          const perf = ((stock.currentValue - stock.totalInvested) / stock.totalInvested * 100);
          livePerf = `${perf >= 0 ? '+' : ''}${perf.toFixed(1)}%`;
        }

        worksheet.addRow({
          ticker: stock.ticker,
          name: stock.name,
          shares: Math.round(stock.shares),
          weight: `${(parseFloat(stock.weight) || 0).toFixed(1)}%`,
          avgPrice: avgBuyPrice,
          totalInvested: totalInvestedCHF,
          currentPrice: `${stock.currency || 'CHF'} ${(stock.currentPrice || 0).toFixed(1)}`,
          currentValue: currentValueCHF,
          dividend: `${(parseFloat(stock.dividendYield) || 0).toFixed(1)}%`,
          ytd: `${(parseFloat(stock.ytdPerformance) || 0) >= 0 ? '+' : ''}${(parseFloat(stock.ytdPerformance) || 0).toFixed(1)}%`,
          livePerf: livePerf
        });
      });

      // Total row
      const totalInvested = portfolio.isLive
        ? chfHoldings.reduce((sum: number, h: any) => sum + h.totalInvestedCHF, 0) + cashPosition
        : portfolioData.filter((s: any) => s.shares > 0).reduce((sum, s) => sum + (s.totalInvested || 0), 0) + cashPosition;
      
      const totalValue = portfolio.isLive
        ? chfHoldings.reduce((sum: number, h: any) => sum + h.currentValueCHF, 0) + cashPosition
        : portfolioData.filter((s: any) => s.shares > 0).reduce((sum, s) => sum + (s.currentValue || 0), 0) + cashPosition;

      const totalRow = worksheet.addRow({
        ticker: 'TOTAL',
        name: '',
        shares: '',
        weight: '',
        avgPrice: '',
        totalInvested: Math.round(totalInvested),
        currentPrice: '',
        currentValue: Math.round(totalValue),
        dividend: '',
        ytd: '',
        livePerf: ''
      });
      totalRow.font = { bold: true };

      // Add borders to all cells
      worksheet.eachRow((row) => {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        });
      });

      // Generate Excel file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${portfolio.name}_Positionen_${new Date().toISOString().split('T')[0]}.xlsx`;
      link.click();

      toast.success("Excel-Datei erfolgreich exportiert!");
    } catch (error) {
      console.error('Excel export error:', error);
      toast.error("Fehler beim Exportieren der Excel-Datei");
    }
  };

  // Parse portfolio data safely and enrich with stock names from database
  // MUST be before early return to maintain hooks order
  const portfolioData = useMemo(() => {
    if (!portfolio?.portfolioData) return [];
    
    try {
      const parsed = JSON.parse(portfolio.portfolioData);
      // Handle both formats: array of stocks or object with stocks property
      const rawData = Array.isArray(parsed) ? parsed : (parsed.stocks || []);
      
      // Ensure each stock has ticker, name, and other fields
      return rawData.map((stock: any) => {
      const ticker = stock.ticker || stock.symbol || '';
      // Find stock in database to get company name
      const dbStock = allStocks.find((s: any) => s.ticker === ticker);
      
      // Determine currency based on ticker suffix
      let currency = dbStock?.currency || 'CHF';
      if (ticker.endsWith('.SW')) {
        currency = 'CHF';
      } else if (ticker.endsWith('.US') || (!ticker.includes('.') && ticker.length <= 5)) {
        currency = 'USD';
      }
      
      // Get holdings from transactions
      const holdings = holdingsByTicker[ticker] || { shares: 0, totalInvested: 0 };
      const currentPrice = parseFloat(stock.currentPrice || stock.price || dbStock?.currentPrice || '0');
      
      // For live portfolios: ALWAYS use transaction-based shares (even if 0)
      // For test portfolios: use optimizer shares
      const shares = portfolio.isLive 
        ? holdings.shares 
        : (parseFloat(stock.shares || '0') || holdings.shares);
      const totalInvested = portfolio.isLive
        ? holdings.totalInvested
        : (parseFloat(stock.investmentAmount || '0') || holdings.totalInvested);
      const currentValue = shares * currentPrice;
      
      return {
        ticker,
        name: dbStock?.companyName || stock.name || stock.companyName || ticker,
        shares,
        weight: stock.weight || stock.portfolioWeight || 0,
        currentPrice,
        totalInvested,
        currentValue,
        dividendYield: stock.dividendYield || dbStock?.dividendYield || 0,
        ytdPerformance: stock.ytdPerformance || stock.performance || dbStock?.ytdPerformance || 0,
        currency
      };
      });
    } catch (error) {
      console.error('Failed to parse portfolio data:', error);
      return [];
    }
  }, [portfolio?.portfolioData, allStocks, holdingsByTicker, portfolio?.isLive]);

  if (!portfolioId || !portfolio) {
    return (
      <div className="min-h-screen bg-slate-900 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <p className="text-muted-foreground text-lg">Portfolio nicht gefunden</p>
            <Button
              onClick={() => setLocation("/")}
              variant="outline"
              className="mt-4"
            >
              Zurück zur Übersicht
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header with Breadcrumb */}
        <div className="mb-8">
          {/* Breadcrumb Navigation */}
          <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
            <button
              onClick={() => setLocation("/portfolio-builder")}
              className="hover:text-white transition-colors"
            >
              Portfolio Builder
            </button>
            <ChevronRight className="w-4 h-4" />
            <span className="text-white font-medium">{portfolio.name}</span>
          </div>

          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-4xl font-bold text-white">{portfolio.name}</h1>
                {portfolio.portfolioType && (
                  <span className={`px-3 py-1 text-sm rounded-full font-medium ${
                    portfolio.portfolioType === 'Dividenden' ? 'bg-green-600/20 text-green-400 border border-green-600/30' :
                    portfolio.portfolioType === 'Wachstum' ? 'bg-blue-600/20 text-blue-400 border border-blue-600/30' :
                    portfolio.portfolioType === 'ETF' ? 'bg-yellow-600/20 text-yellow-400 border border-yellow-600/30' :
                    'bg-purple-600/20 text-purple-400 border border-purple-600/30'
                  }`}>
                    {portfolio.portfolioType}
                  </span>
                )}
              </div>
              {portfolio.description && (
                <p className="text-muted-foreground">{portfolio.description}</p>
              )}
              <p className="text-muted-foreground/70 text-sm mt-1">
                Erstellt am {new Date(portfolio.createdAt).toLocaleDateString('de-CH', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Live Toggle */}
              <Button
                onClick={() => {
                  const isCurrentlyLive = Boolean(portfolio.isLive);
                  console.log('[PortfolioDetail] Toggling live status:', {
                    portfolioId: portfolio.id,
                    currentStatus: isCurrentlyLive,
                    newStatus: !isCurrentlyLive
                  });
                  toggleLiveMutation.mutate({
                    id: portfolio.id,
                    isLive: !isCurrentlyLive
                  });
                }}
                variant={Boolean(portfolio.isLive) ? "default" : "outline"}
                className={Boolean(portfolio.isLive) ? "bg-green-600 hover:bg-green-700 text-white" : "text-foreground"}
              >
                {Boolean(portfolio.isLive) && <span className="w-2 h-2 bg-white rounded-full animate-pulse mr-2" />}
                {Boolean(portfolio.isLive) ? "Live" : "Test"}
              </Button>

              {/* Live Start Date Picker - only show when portfolio is live */}
              {Boolean(portfolio.isLive) && portfolio.liveStartDate && (
                <input
                  type="date"
                  value={new Date(portfolio.liveStartDate).toISOString().split('T')[0]}
                  onChange={(e) => {
                    const newDate = e.target.value;
                    if (!newDate) return;
                    updateLiveStartDateMutation.mutate({
                      id: portfolio.id,
                      liveStartDate: newDate
                    });
                  }}
                  className="px-3 py-2 text-sm bg-muted border border-border rounded text-foreground hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              )}

              {/* Transactions Page Link */}
              {Boolean(portfolio.isLive) && (
                <Link href={`/portfolio/${portfolioId}/transactions`}>
                  <Button
                    variant="outline"
                    className="text-foreground border-border hover:bg-muted"
                  >
                    <List className="w-4 h-4 mr-2" />
                    Alle Transaktionen
                  </Button>
                </Link>
              )}

              {/* Annual Performance Button */}
              {Boolean(portfolio.isLive) && (
                <Button
                  onClick={() => setShowAnnualPerformance(true)}
                  variant="outline"
                  className="text-blue-400 border-blue-400 hover:bg-blue-400/10"
                >
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Jahresübersicht
                </Button>
              )}

              {/* CSV Import Button */}
              {Boolean(portfolio.isLive) && (
                <Button
                  onClick={() => setShowCsvImport(true)}
                  variant="outline"
                  className="text-foreground border-border hover:bg-muted"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  CSV Import
                </Button>
              )}

              {/* Add Transaction Button */}
              {Boolean(portfolio.isLive) && (
                <Button
                  onClick={() => setIsTransactionModalOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Transaktion erfassen
                </Button>
              )}

              {/* Bulk Delete Initial Transactions Button */}
              {Boolean(portfolio.isLive) && transactions.some((tx: any) => tx.notes?.includes('Initial position')) && (
                <Button
                  onClick={() => setShowDeleteConfirm(true)}
                  variant="outline"
                  className="text-red-400 border-red-400 hover:bg-red-400/10"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Initial-Transaktionen löschen
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Portfolio Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="gradient-card border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-muted-foreground text-sm font-normal">Positionen</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-white">
                {portfolio.isLive 
                  ? portfolioData.filter((s: any) => s.shares > 0).length 
                  : portfolio.numberOfPositions}
              </p>
            </CardContent>
          </Card>

          <Card className="gradient-card border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-muted-foreground text-sm font-normal">Portfolio</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Aktien (Wert)</span>
                  <span className="text-sm font-semibold text-white">
                    CHF {Math.round(livePerformance?.totalInvestedInStocks ?? portfolioSummary.totalInvestedInStocks ?? 0).toLocaleString('de-CH')}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Cash</span>
                  <span className="text-sm font-semibold text-white">
                    CHF {Math.round(livePerformance?.cashPosition ?? portfolioSummary.cashPosition ?? 0).toLocaleString('de-CH')}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-700">
                  <span className="text-xs text-muted-foreground">Total investiert</span>
                  <span className="text-lg font-bold text-white">
                    CHF {Math.round(livePerformance?.totalInvested ?? portfolioSummary.totalDeposits ?? 0).toLocaleString('de-CH')}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="gradient-card border-border/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-muted-foreground text-sm font-normal">Ø Dividende</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDividendCalendar(true)}
                  className="text-green-400 hover:text-green-300 hover:bg-green-400/10 h-8 px-2"
                >
                  <Calendar className="w-4 h-4 mr-1" />
                  Kalender
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-400">
                {portfolio.avgDividendYield?.toFixed(2) || '0.00'}%
              </p>
            </CardContent>
          </Card>

          <Card className="gradient-card border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-muted-foreground text-sm font-normal">
                {portfolio.isLive ? "Live Performance" : "Ø YTD Performance"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {Boolean(portfolio.isLive) && livePerformance?.performance !== null ? (
                <div>
                  <p className={`text-3xl font-bold ${
                    (livePerformance?.performance || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {(livePerformance?.performance || 0) >= 0 ? '+' : ''}
                    {livePerformance?.performance?.toFixed(1) || '0.0'}%
                  </p>
                  <p className="text-muted-foreground/70 text-xs mt-1">
                    seit {new Date(portfolio.liveStartDate).toLocaleDateString('de-CH')}
                  </p>
                </div>
              ) : (
                <p className={`text-3xl font-bold ${
                  (portfolio.avgYtdPerformance || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {(portfolio.avgYtdPerformance || 0) >= 0 ? '+' : ''}
                  {portfolio.avgYtdPerformance?.toFixed(1) || '0.0'}%
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Live Performance Chart */}
        {Boolean(portfolio.isLive) && transactions.length > 0 && livePerformance && (
          <div className="mb-8">
            <LivePerformanceChart
              portfolioId={portfolio.id}
              liveStartDate={portfolio.liveStartDate}
            />
          </div>
        )}

        {/* Transaction History */}
        {Boolean(portfolio.isLive) && (
          <div className="mb-8">
            <TransactionHistory
              portfolioId={portfolio.id}
              portfolioName={portfolio.name}
            />
          </div>
        )}

        {/* Portfolio Holdings - Collapsible */}
        <Card className="gradient-card border-border/50">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-white">Portfolio Positionen</CardTitle>
              <Button
                onClick={exportToExcel}
                variant="outline"
                size="sm"
                className="bg-muted hover:bg-slate-600 text-white"
              >
                <Download className="w-4 h-4 mr-2" />
                Excel Export
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Cash Position - Always Visible */}
            <div className="mb-4 p-4 bg-muted/20 rounded-lg border border-border/50">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">💰</span>
                  <div>
                    <h3 className="text-lg font-semibold text-yellow-400">Cash</h3>
                    <p className="text-sm text-muted-foreground">Verfügbares Kapital</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-yellow-400">
                    CHF {Math.round(livePerformance?.cashPosition ?? portfolioSummary.cashPosition ?? 0).toLocaleString('de-CH')}
                  </p>
                </div>
              </div>
            </div>

            {/* Stock Positions - Accordion */}
            <Accordion type="multiple" className="space-y-2">
              {portfolioData.filter((stock: any) => stock.shares > 0).map((stock: any, index: number) => {
                const chfHolding = chfHoldings.find((h: any) => h.ticker === stock.ticker);
                const holding = holdingsByTicker[stock.ticker];
                
                // Calculate values for display
                const totalInvestedCHF = Boolean(portfolio.isLive) && chfHolding 
                  ? chfHolding.totalInvestedCHF 
                  : (stock.totalInvested || 0);
                const currentValueCHF = Boolean(portfolio.isLive) && chfHolding 
                  ? chfHolding.currentValueCHF 
                  : (stock.currentValue || 0);
                const performanceCHF = Boolean(portfolio.isLive) && chfHolding 
                  ? chfHolding.performanceCHF 
                  : (stock.totalInvested > 0 ? ((stock.currentValue - stock.totalInvested) / stock.totalInvested * 100) : 0);
                
                // Get stock transactions
                const stockTransactions = transactions.filter((tx: any) => tx.ticker === stock.ticker);

                return (
                  <AccordionItem key={index} value={`stock-${index}`} className="border border-border/50 rounded-lg bg-muted/10">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30">
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="flex items-center gap-3">
                          <StockLogo ticker={stock.ticker} companyName={stock.name} size="sm" />
                          <div className="text-left">
                            <h3 className="font-semibold text-white">{stock.ticker}</h3>
                            <p className="text-sm text-muted-foreground">{stock.name}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">Stückzahl</p>
                            <p className="font-semibold text-white">{Math.round(stock.shares).toLocaleString('de-CH')}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">Aktueller Wert</p>
                            <p className="font-semibold text-green-400">CHF {Math.round(currentValueCHF).toLocaleString('de-CH')}</p>
                          </div>
                          <div className="text-right min-w-[80px]">
                            <p className="text-xs text-muted-foreground">Performance</p>
                            <p className={`font-bold ${performanceCHF >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {performanceCHF >= 0 ? '+' : ''}{performanceCHF.toFixed(1)}%
                            </p>
                          </div>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 pt-2">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Gewicht</p>
                          <p className="font-medium text-foreground">{(parseFloat(stock.weight) || 0).toFixed(1)}%</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Einstandskurs</p>
                          <p className="font-medium text-blue-300">
                            {(() => {
                              if (Boolean(portfolio.isLive) && chfHolding?.avgBuyPrice) {
                                return `${stock.currency || 'CHF'} ${chfHolding.avgBuyPrice.toFixed(2)}`;
                              }
                              if (holding?.avgBuyPrice > 0) {
                                return `${stock.currency || 'CHF'} ${holding.avgBuyPrice.toFixed(2)}`;
                              }
                              return '-';
                            })()}
                          </p>
                          {Boolean(portfolio.isLive) && chfHolding?.avgFxRate && stock.currency !== 'CHF' && (
                            <p className="text-xs text-muted-foreground/70">FX: {chfHolding.avgFxRate.toFixed(3)}</p>
                          )}
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Aktueller Kurs</p>
                          <p className="font-medium text-foreground">
                            {stock.currency || 'CHF'} {(stock.currentPrice || 0).toFixed(2)}
                          </p>
                          {Boolean(portfolio.isLive) && chfHolding?.currentFxRate && stock.currency !== 'CHF' && (
                            <p className="text-xs text-muted-foreground/70">FX: {chfHolding.currentFxRate.toFixed(3)}</p>
                          )}
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Dividende</p>
                          <p className="font-medium text-green-400">{(parseFloat(stock.dividendYield) || 0).toFixed(1)}%</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Einstandswert (CHF)</p>
                          <p className="font-medium text-blue-400">CHF {Math.round(totalInvestedCHF).toLocaleString('de-CH')}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Aktueller Wert (CHF)</p>
                          <p className="font-medium text-green-400">CHF {Math.round(currentValueCHF).toLocaleString('de-CH')}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">YTD Performance</p>
                          <p className={`font-medium ${(parseFloat(stock.ytdPerformance) || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {(parseFloat(stock.ytdPerformance) || 0) >= 0 ? '+' : ''}{(parseFloat(stock.ytdPerformance) || 0).toFixed(1)}%
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Gewinn/Verlust</p>
                          <p className={`font-medium ${(currentValueCHF - totalInvestedCHF) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {(currentValueCHF - totalInvestedCHF) >= 0 ? '+' : ''}CHF {Math.round(currentValueCHF - totalInvestedCHF).toLocaleString('de-CH')}
                          </p>
                        </div>
                      </div>

                      {/* Transactions for this stock */}
                      {Boolean(portfolio.isLive) && stockTransactions.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-border/50">
                          <h4 className="text-sm font-semibold text-muted-foreground mb-3">Transaktionen</h4>
                          <div className="space-y-2">
                            {stockTransactions.map((tx: any) => (
                              <div key={tx.id} className="flex justify-between items-center p-2 bg-muted/30 rounded">
                                <div className="flex items-center gap-3">
                                  <span className={`text-xs font-medium px-2 py-1 rounded ${
                                    tx.type === 'buy' ? 'bg-blue-500/20 text-blue-400' :
                                    tx.type === 'sell' ? 'bg-orange-500/20 text-orange-400' :
                                    tx.type === 'dividend' ? 'bg-purple-500/20 text-purple-400' : 'bg-gray-500/20 text-gray-400'
                                  }`}>
                                    {tx.type === 'buy' ? 'Kauf' : tx.type === 'sell' ? 'Verkauf' : tx.type === 'dividend' ? 'Dividende' : tx.type}
                                  </span>
                                  <span className="text-sm text-foreground">{new Date(tx.transactionDate).toLocaleDateString('de-CH')}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                  {tx.shares && (
                                    <span className="text-sm text-muted-foreground">{Math.round(tx.shares)} Stück</span>
                                  )}
                                  {tx.price && (
                                    <span className="text-sm text-muted-foreground">@ {tx.currency || 'CHF'} {tx.price.toFixed(2)}</span>
                                  )}
                                  <span className={`text-sm font-medium ${
                                    tx.type === 'buy' ? 'text-red-400' : 'text-green-400'
                                  }`}>
                                    {tx.amount ? `CHF ${Math.round(Math.abs(tx.amount)).toLocaleString('de-CH')}` : '-'}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>

            {/* Total Summary */}
            <div className="mt-6 p-4 bg-muted/30 rounded-lg border border-border">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Investiert</p>
                  <p className="text-xl font-bold text-blue-400">
                    {(() => {
                      const cashPosition = livePerformance?.cashPosition ?? portfolioSummary.cashPosition ?? 0;
                      if (Boolean(portfolio.isLive)) {
                        const total = chfHoldings.reduce((sum: number, h: any) => sum + h.totalInvestedCHF, 0) + cashPosition;
                        return `CHF ${Math.round(total).toLocaleString('de-CH')}`;
                      }
                      return `CHF ${Math.round(portfolioData.filter((s: any) => s.shares > 0).reduce((sum, s) => sum + (s.totalInvested || 0), 0) + cashPosition).toLocaleString('de-CH')}`;
                    })()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Aktueller Wert</p>
                  <p className="text-xl font-bold text-green-400">
                    {(() => {
                      if (Boolean(portfolio.isLive)) {
                        const stocksTotal = chfHoldings.reduce((sum: number, h: any) => sum + h.currentValueCHF, 0);
                        const cashPosition = livePerformance?.cashPosition ?? portfolioSummary.cashPosition ?? 0;
                        return `CHF ${Math.round(stocksTotal + cashPosition).toLocaleString('de-CH')}`;
                      }
                      const stocksValue = portfolioData.filter((s: any) => s.shares > 0).reduce((sum, s) => sum + (s.currentValue || 0), 0);
                      const cashPosition = portfolioSummary.cashPosition ?? 0;
                      return `CHF ${Math.round(stocksValue + cashPosition).toLocaleString('de-CH')}`;
                    })()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Performance</p>
                  <p className={`text-xl font-bold ${
                    (() => {
                      if (Boolean(portfolio.isLive) && livePerformance) {
                        return livePerformance.performance >= 0 ? 'text-green-400' : 'text-red-400';
                      }
                      return 'text-gray-400';
                    })()
                  }`}>
                    {(() => {
                      if (Boolean(portfolio.isLive) && livePerformance) {
                        const perf = livePerformance.performance;
                        return `${perf >= 0 ? '+' : ''}${perf.toFixed(1)}%`;
                      }
                      return '-';
                    })()}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transaction Modal */}
      {Boolean(portfolio.isLive) && (
        <TransactionModal
          open={isTransactionModalOpen}
          onClose={() => setIsTransactionModalOpen(false)}
          portfolioId={portfolio.id}
          portfolioStocks={portfolioData.map((s: any) => ({
            ticker: s.ticker || '',
            companyName: s.name || s.ticker || '',
            shares: s.shares || 0
          }))}
          onSuccess={() => {
            utils.portfolioTransactions.list.invalidate();
            utils.portfolios.list.invalidate();
          }}
        />
      )}

      {/* Dividend Calendar Modal */}
      <DividendCalendarModal
        isOpen={showDividendCalendar}
        onClose={() => setShowDividendCalendar(false)}
        dividends={dividendCalendar || []}
        isLoading={isDividendLoading}
      />

      {/* CSV Import Modal */}
      {Boolean(portfolio.isLive) && (
        <CsvImportModal
          isOpen={showCsvImport}
          onClose={() => setShowCsvImport(false)}
          portfolioId={portfolio.id}
        />
      )}

      {/* Annual Performance Summary Modal */}
      <AnnualPerformanceSummary
        isOpen={showAnnualPerformance}
        onClose={() => setShowAnnualPerformance(false)}
        summary={annualPerformance || null}
        isLoading={isPerformanceLoading}
        error={performanceError}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="gradient-card border-border/50">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Initial-Transaktionen löschen?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Möchten Sie alle Initial-Transaktionen für dieses Portfolio löschen?
              Diese Aktion kann nicht rückgängig gemacht werden.
              <br /><br />
              <strong className="text-yellow-400">
                Anzahl zu löschender Transaktionen: {transactions.filter((tx: any) => tx.notes?.includes('Initial position')).length}
              </strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-muted text-white hover:bg-slate-600">
              Abbrechen
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteInitialTransactions.mutate({ portfolioId: portfolioId! })}
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={deleteInitialTransactions.isPending}
            >
              {deleteInitialTransactions.isPending ? 'Lösche...' : 'Löschen'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
