import { useState, useMemo, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ArrowLeft, Plus, TrendingUp, Calendar, Trash2, Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { StockLogo } from "@/components/StockLogo";

export default function PortfolioDetail() {
  const [, params] = useRoute("/portfolio/:id");
  const [, setLocation] = useLocation();
  const portfolioId = params?.id ? parseInt(params.id) : null;

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
      utils.savedPortfolios.list.invalidate();
      utils.savedPortfolios.calculateLivePerformance.invalidate();
      setShowDeleteConfirm(false);
    },
    onError: (error) => {
      toast.error(`Fehler beim Löschen: ${error.message}`);
    },
  });

  // Fetch portfolio details
  const { data: portfolios = [] } = trpc.savedPortfolios.list.useQuery();
  const portfolio = portfolios.find((p: any) => p.id === portfolioId);

  // Fetch transactions
  const { data: transactions = [] } = trpc.portfolioTransactions.list.useQuery(
    { portfolioId: portfolioId! },
    { enabled: !!portfolioId }
  );

  // Fetch all stocks to get company names
  const { data: allStocks = [] } = trpc.stocks.getAll.useQuery();

  // Fetch live performance if portfolio is live
  const { data: livePerformance } = trpc.savedPortfolios.calculateLivePerformance.useQuery(
    { id: portfolioId! },
    { enabled: !!portfolioId && !!portfolio && Boolean(portfolio.isLive) }
  );

  // Fetch CHF-converted holdings with performance
  const { data: chfHoldings = [] } = trpc.savedPortfolios.getHoldingsWithChfPerformance.useQuery(
    { id: portfolioId! },
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
  const toggleLiveMutation = trpc.savedPortfolios.toggleLive.useMutation({
    onSuccess: () => {
      utils.savedPortfolios.list.invalidate();
      toast.success("Status aktualisiert");
    },
    onError: () => {
      toast.error("Fehler beim Aktualisieren des Status");
    }
  });

  // Update live start date mutation
  const updateLiveStartDateMutation = trpc.savedPortfolios.updateLiveStartDate.useMutation({
    onSuccess: () => {
      utils.savedPortfolios.list.invalidate();
      utils.savedPortfolios.calculateLivePerformance.invalidate();
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
        {/* Header */}
        <div className="mb-8">
          <Button
            onClick={() => setLocation("/")}
            variant="ghost"
            className="mb-4 text-muted-foreground hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Zurück zur Übersicht
          </Button>

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

        {/* Portfolio Holdings */}
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
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-3 px-2 text-muted-foreground font-medium">Ticker</th>
                    <th className="text-left py-3 px-2 text-muted-foreground font-medium">Name</th>
                    <th className="text-right py-3 px-2 text-muted-foreground font-medium">Stückzahl</th>
                    <th className="text-right py-3 px-2 text-muted-foreground font-medium">Gewicht</th>
                    <th className="text-right py-3 px-2 text-muted-foreground font-medium">Einstandskurs (FW)</th>
                    <th className="text-right py-3 px-2 text-muted-foreground font-medium">Einstandswert (CHF)</th>
                    <th className="text-right py-3 px-2 text-muted-foreground font-medium">Aktueller Kurs (FW)</th>
                    <th className="text-right py-3 px-2 text-muted-foreground font-medium">Aktueller Wert (CHF)</th>
                    <th className="text-right py-3 px-2 text-muted-foreground font-medium">Dividende</th>
                    <th className="text-right py-3 px-2 text-muted-foreground font-medium">YTD</th>
                    <th className="text-right py-3 px-2 text-muted-foreground font-medium">{Boolean(portfolio.isLive) ? 'Live Perf. (CHF)' : 'Live Perf.'}</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Cash Position Row - First */}
                  <tr className="border-b-2 border-border bg-muted/20">
                    <td className="py-3 px-2 text-yellow-400 font-semibold" colSpan={2}>💰 Cash</td>
                    <td className="py-3 px-2 text-right" colSpan={3}></td>
                    {/* Einstandswert (CHF) - Cash */}
                    <td className="py-3 px-2 text-yellow-400 text-right font-semibold">
                      CHF {Math.round(livePerformance?.cashPosition ?? portfolioSummary.cashPosition ?? 0).toLocaleString('de-CH')}
                    </td>
                    <td className="py-3 px-2 text-right" colSpan={1}></td>
                    {/* Aktueller Wert (CHF) - Cash */}
                    <td className="py-3 px-2 text-yellow-400 text-right font-semibold">
                      CHF {Math.round(livePerformance?.cashPosition ?? portfolioSummary.cashPosition ?? 0).toLocaleString('de-CH')}
                    </td>
                    <td colSpan={3}></td>
                  </tr>
                  {portfolioData.filter((stock: any) => stock.shares > 0).map((stock: any, index: number) => (
                    <tr key={index} className="border-b border-slate-700/50 hover:bg-muted/30">
                      <td className="py-3 px-2">
                        <StockLogo ticker={stock.ticker} companyName={stock.name} size="sm" />
                      </td>
                      <td className="py-3 px-2 text-foreground">{stock.name}</td>
                      <td className="py-3 px-2 text-white text-right font-semibold">
                        {stock.shares ? Math.round(stock.shares).toLocaleString('de-CH') : '0'}
                      </td>
                      <td className="py-3 px-2 text-foreground text-right">{(parseFloat(stock.weight) || 0).toFixed(1)}%</td>
                      {/* Einstandskurs (FW) - Line 1: Price, Line 2: FX Rate */}
                      <td className="py-3 px-2 text-blue-300 text-right">
                        <div>
                          {(() => {
                            if (Boolean(portfolio.isLive)) {
                              const chfHolding = chfHoldings.find((h: any) => h.ticker === stock.ticker);
                              if (chfHolding && chfHolding.avgBuyPrice) {
                                return `${stock.currency || 'CHF'} ${chfHolding.avgBuyPrice.toFixed(1)}`;
                              }
                            }
                            const holding = holdingsByTicker[stock.ticker];
                            if (holding && holding.avgBuyPrice > 0) {
                              return `${stock.currency || 'CHF'} ${holding.avgBuyPrice.toFixed(1)}`;
                            }
                            return `${stock.currency || 'CHF'} -`;
                          })()}
                        </div>
                        <div className="text-xs text-muted-foreground/70 mt-0.5">
                          {(() => {
                            if (Boolean(portfolio.isLive)) {
                              const chfHolding = chfHoldings.find((h: any) => h.ticker === stock.ticker);
                              if (chfHolding && chfHolding.avgFxRate) {
                                return `FX: ${chfHolding.avgFxRate.toFixed(3)}`;
                              }
                            }
                            return stock.currency === 'CHF' ? '' : 'FX: 1.00';
                          })()}
                        </div>
                      </td>
                      {/* Einstandswert (CHF) */}
                      <td className="py-3 px-2 text-blue-400 text-right font-semibold">
                        {(() => {
                          if (Boolean(portfolio.isLive)) {
                            const chfHolding = chfHoldings.find((h: any) => h.ticker === stock.ticker);
                            if (chfHolding) {
                              return `CHF ${Math.round(chfHolding.totalInvestedCHF).toLocaleString('de-CH')}`;
                            }
                          }
                          return `CHF ${stock.totalInvested ? Math.round(stock.totalInvested).toLocaleString('de-CH') : '0'}`;
                        })()}
                      </td>
                      {/* Aktueller Kurs (FW) - Line 1: Price, Line 2: FX Rate */}
                      <td className="py-3 px-2 text-foreground text-right">
                        <div>
                          {stock.currency || 'CHF'} {(stock.currentPrice || 0).toFixed(1)}
                        </div>
                        <div className="text-xs text-muted-foreground/70 mt-0.5">
                          {(() => {
                            if (Boolean(portfolio.isLive)) {
                              const chfHolding = chfHoldings.find((h: any) => h.ticker === stock.ticker);
                              if (chfHolding && chfHolding.currentFxRate) {
                                return `FX: ${chfHolding.currentFxRate.toFixed(3)}`;
                              }
                            }
                            return stock.currency === 'CHF' ? '' : 'FX: 1.00';
                          })()}
                        </div>
                      </td>
                      {/* Aktueller Wert (CHF) */}
                      <td className="py-3 px-2 text-green-400 text-right font-semibold">
                        {(() => {
                          if (Boolean(portfolio.isLive)) {
                            const chfHolding = chfHoldings.find((h: any) => h.ticker === stock.ticker);
                            if (chfHolding) {
                              return `CHF ${Math.round(chfHolding.currentValueCHF).toLocaleString('de-CH')}`;
                            }
                          }
                          return `CHF ${stock.currentValue ? Math.round(stock.currentValue).toLocaleString('de-CH') : '0'}`;
                        })()}
                      </td>
                      <td className="py-3 px-2 text-green-400 text-right">
                        {(parseFloat(stock.dividendYield) || 0).toFixed(1)}%
                      </td>
                      <td className={`py-3 px-2 text-right font-semibold ${
                        (parseFloat(stock.ytdPerformance) || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {(parseFloat(stock.ytdPerformance) || 0) >= 0 ? '+' : ''}
                        {(parseFloat(stock.ytdPerformance) || 0).toFixed(1)}%
                      </td>
                      <td className={`py-3 px-2 text-right font-semibold ${
                        (() => {
                          if (Boolean(portfolio.isLive)) {
                            const chfHolding = chfHoldings.find((h: any) => h.ticker === stock.ticker);
                            if (chfHolding) {
                              return chfHolding.performanceCHF >= 0 ? 'text-green-400' : 'text-red-400';
                            }
                          }
                          return stock.currentValue >= stock.totalInvested ? 'text-green-400' : 'text-red-400';
                        })()
                      }`}>
                        {(() => {
                          if (Boolean(portfolio.isLive)) {
                            const chfHolding = chfHoldings.find((h: any) => h.ticker === stock.ticker);
                            if (chfHolding) {
                              return `${chfHolding.performanceCHF >= 0 ? '+' : ''}${chfHolding.performanceCHF.toFixed(1)}%`;
                            }
                          }
                          if (stock.totalInvested > 0) {
                            const perf = ((stock.currentValue - stock.totalInvested) / stock.totalInvested * 100);
                            return `${perf >= 0 ? '+' : ''}${perf.toFixed(1)}%`;
                          }
                          return '-';
                        })()}
                      </td>
                    </tr>
                  ))}

                  {/* Total Row */}
                  <tr className="border-t border-border bg-muted/30">
                    <td className="py-3 px-2 text-white font-bold" colSpan={2}>TOTAL</td>
                    <td className="py-3 px-2 text-right" colSpan={2}></td>
                    <td className="py-3 px-2 text-blue-400 text-right font-bold" colSpan={2}>
                      {(() => {
                        const cashPosition = livePerformance?.cashPosition ?? portfolioSummary.cashPosition ?? 0;
                        if (Boolean(portfolio.isLive)) {
                          const total = chfHoldings.reduce((sum: number, h: any) => sum + h.totalInvestedCHF, 0) + cashPosition;
                          return `CHF ${Math.round(total).toLocaleString('de-CH')}`;
                        }
                        return `CHF ${Math.round(portfolioData.filter((s: any) => s.shares > 0).reduce((sum, s) => sum + (s.totalInvested || 0), 0) + cashPosition).toLocaleString('de-CH')}`;
                      })()}
                    </td>
                    <td colSpan={1}></td>
                    <td className="py-3 px-2 text-green-400 text-right font-bold">
                      {(() => {
                        if (Boolean(portfolio.isLive)) {
                          // Total stocks value + cash
                          const stocksTotal = chfHoldings.reduce((sum: number, h: any) => sum + h.currentValueCHF, 0);
                          const cashPosition = livePerformance?.cashPosition ?? portfolioSummary.cashPosition ?? 0;
                          return `CHF ${Math.round(stocksTotal + cashPosition).toLocaleString('de-CH')}`;
                        }
                        const stocksValue = portfolioData
                          .filter((s: any) => s.shares > 0)
                          .reduce((sum, s) => sum + (s.currentValue || 0), 0);
                        const deposits = transactions
                          .filter((tx: any) => tx.transactionType === 'deposit')
                          .reduce((sum: number, tx: any) => sum + parseFloat(tx.totalAmount || '0'), 0);
                        const withdrawals = transactions
                          .filter((tx: any) => tx.transactionType === 'withdrawal')
                          .reduce((sum: number, tx: any) => sum + Math.abs(parseFloat(tx.totalAmount || '0')), 0);
                        const buyAmounts = transactions
                          .filter((tx: any) => tx.transactionType === 'buy')
                          .reduce((sum: number, tx: any) => {
                            const shares = parseFloat(tx.shares || '0');
                            const price = parseFloat(tx.pricePerShare || '0');
                            return sum + (shares * price);
                          }, 0);
                        const sellAmounts = transactions
                          .filter((tx: any) => tx.transactionType === 'sell')
                          .reduce((sum: number, tx: any) => {
                            const shares = parseFloat(tx.shares || '0');
                            const price = parseFloat(tx.pricePerShare || '0');
                            return sum + (shares * price);
                          }, 0);
                        // Treat all buys as implicit deposits
                        const totalCapital = deposits - withdrawals + buyAmounts;
                        const cash = totalCapital - buyAmounts + sellAmounts;
                        const total = stocksValue + cash;
                        return `CHF ${Math.round(total).toLocaleString('de-CH')}`;
                      })()}
                    </td>
                    <td colSpan={2}></td>
                    <td className={`py-3 px-2 text-right font-bold ${
                      (() => {
                        // For LIVE portfolios, use livePerformance data (CHF-converted)
                        if (Boolean(portfolio.isLive) && livePerformance) {
                          return livePerformance.performance >= 0 ? 'text-green-400' : 'text-red-400';
                        }
                        // For TEST portfolios, calculate from transactions
                        const stocksValue = portfolioData
                          .filter((s: any) => s.shares > 0)
                          .reduce((sum, s) => sum + (s.currentValue || 0), 0);
                        const deposits = transactions
                          .filter((tx: any) => tx.transactionType === 'deposit')
                          .reduce((sum: number, tx: any) => sum + parseFloat(tx.totalAmount || '0'), 0);
                        const withdrawals = transactions
                          .filter((tx: any) => tx.transactionType === 'withdrawal')
                          .reduce((sum: number, tx: any) => sum + Math.abs(parseFloat(tx.totalAmount || '0')), 0);
                        const buyAmounts = transactions
                          .filter((tx: any) => tx.transactionType === 'buy')
                          .reduce((sum: number, tx: any) => {
                            const shares = parseFloat(tx.shares || '0');
                            const price = parseFloat(tx.pricePerShare || '0');
                            return sum + (shares * price);
                          }, 0);
                        const sellAmounts = transactions
                          .filter((tx: any) => tx.transactionType === 'sell')
                          .reduce((sum: number, tx: any) => {
                            const shares = parseFloat(tx.shares || '0');
                            const price = parseFloat(tx.pricePerShare || '0');
                            return sum + (shares * price);
                          }, 0);
                        const totalCapital = deposits - withdrawals + buyAmounts;
                        const cash = totalCapital - buyAmounts + sellAmounts;
                        const totalValue = stocksValue + cash;
                        return totalValue >= totalCapital ? 'text-green-400' : 'text-red-400';
                      })()
                    }`}>
                      {(() => {
                        // For LIVE portfolios, use livePerformance data (single source of truth)
                        if (Boolean(portfolio.isLive) && livePerformance) {
                          const perf = livePerformance.performance;
                          return `${perf >= 0 ? '+' : ''}${perf.toFixed(1)}%`;
                        }
                        // For TEST portfolios, calculate from transactions
                        const stocksValue = portfolioData
                          .filter((s: any) => s.shares > 0)
                          .reduce((sum, s) => sum + (s.currentValue || 0), 0);
                        const deposits = transactions
                          .filter((tx: any) => tx.transactionType === 'deposit')
                          .reduce((sum: number, tx: any) => sum + parseFloat(tx.totalAmount || '0'), 0);
                        const withdrawals = transactions
                          .filter((tx: any) => tx.transactionType === 'withdrawal')
                          .reduce((sum: number, tx: any) => sum + Math.abs(parseFloat(tx.totalAmount || '0')), 0);
                        const buyAmounts = transactions
                          .filter((tx: any) => tx.transactionType === 'buy')
                          .reduce((sum: number, tx: any) => {
                            const shares = parseFloat(tx.shares || '0');
                            const price = parseFloat(tx.pricePerShare || '0');
                            return sum + (shares * price);
                          }, 0);
                        const sellAmounts = transactions
                          .filter((tx: any) => tx.transactionType === 'sell')
                          .reduce((sum: number, tx: any) => {
                            const shares = parseFloat(tx.shares || '0');
                            const price = parseFloat(tx.pricePerShare || '0');
                            return sum + (shares * price);
                          }, 0);
                        const totalCapital = deposits - withdrawals + buyAmounts;
                        const cash = totalCapital - buyAmounts + sellAmounts;
                        const totalValue = stocksValue + cash;
                        const perf = totalCapital > 0 ? ((totalValue - totalCapital) / totalCapital * 100) : 0;
                        return `${perf >= 0 ? '+' : ''}${perf.toFixed(1)}%`;
                      })()}
                    </td>
                  </tr>
                </tbody>
              </table>
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
            utils.savedPortfolios.list.invalidate();
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
