import { useState, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TransactionModal } from "@/components/TransactionModal";
import { TransactionHistory } from "@/components/TransactionHistory";
import { LivePerformanceChart } from "@/components/LivePerformanceChart";
import { ArrowLeft, Plus, TrendingUp } from "lucide-react";
import { toast } from "sonner";

export default function PortfolioDetail() {
  const [, params] = useRoute("/portfolio/:id");
  const [, setLocation] = useLocation();
  const portfolioId = params?.id ? parseInt(params.id) : null;

  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);

  const utils = trpc.useUtils();

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
    { enabled: !!portfolioId && Boolean(portfolio?.isLive) }
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
      const amount = shares * price;
      
      if (tx.transactionType === 'buy') {
        holdings[tx.ticker].shares += shares;
        holdings[tx.ticker].totalBought += shares;
        holdings[tx.ticker].totalInvested += amount;
        // Calculate average buy price
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

  if (!portfolioId || !portfolio) {
    return (
      <div className="min-h-screen bg-slate-900 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <p className="text-slate-400 text-lg">Portfolio nicht gefunden</p>
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

  // Parse portfolio data safely and enrich with stock names from database
  let portfolioData: any[] = [];
  try {
    const parsed = JSON.parse(portfolio.portfolioData);
    // Handle both formats: array of stocks or object with stocks property
    const rawData = Array.isArray(parsed) ? parsed : (parsed.stocks || []);
    
    // Ensure each stock has ticker, name, and other fields
    portfolioData = rawData.map((stock: any) => {
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
      
      // For live portfolios: prioritize transaction-based shares
      // For test portfolios: use optimizer shares
      const hasTransactions = holdings.shares > 0 || holdings.totalInvested > 0;
      const shares = (portfolio.isLive && hasTransactions) 
        ? holdings.shares 
        : (parseFloat(stock.shares || '0') || holdings.shares);
      const totalInvested = (portfolio.isLive && hasTransactions)
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
    portfolioData = [];
  }

  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button
            onClick={() => setLocation("/")}
            variant="ghost"
            className="mb-4 text-slate-400 hover:text-white"
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
                <p className="text-slate-400">{portfolio.description}</p>
              )}
              <p className="text-slate-500 text-sm mt-1">
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
                className={Boolean(portfolio.isLive) ? "bg-green-600 hover:bg-green-700 text-white" : "text-slate-300"}
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
                  className="px-3 py-2 text-sm bg-slate-700 border border-slate-600 rounded text-slate-300 hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              )}

              {/* Add Transaction Button (only if live) */}
              {Boolean(portfolio.isLive) && (
                <Button
                  onClick={() => setIsTransactionModalOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Transaktion erfassen
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Portfolio Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-slate-400 text-sm font-normal">Positionen</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-white">{portfolio.numberOfPositions}</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-slate-400 text-sm font-normal">Total investiert</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-white">
                CHF {portfolio.totalInvested?.toLocaleString('de-CH') || '0'}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-slate-400 text-sm font-normal">Ø Dividende</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-400">
                {portfolio.avgDividendYield?.toFixed(2) || '0.00'}%
              </p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-slate-400 text-sm font-normal">
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
                  <p className="text-slate-500 text-xs mt-1">
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
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Portfolio Positionen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-3 px-2 text-slate-400 font-medium">Ticker</th>
                    <th className="text-left py-3 px-2 text-slate-400 font-medium">Name</th>
                    <th className="text-right py-3 px-2 text-slate-400 font-medium">Stückzahl</th>
                    <th className="text-right py-3 px-2 text-slate-400 font-medium">Gewicht</th>
                    <th className="text-right py-3 px-2 text-slate-400 font-medium">Preis</th>
                    <th className="text-right py-3 px-2 text-slate-400 font-medium">Total investiert</th>
                    <th className="text-right py-3 px-2 text-slate-400 font-medium">Aktueller Wert</th>
                    <th className="text-right py-3 px-2 text-slate-400 font-medium">Dividende</th>
                    <th className="text-right py-3 px-2 text-slate-400 font-medium">YTD</th>
                    <th className="text-right py-3 px-2 text-slate-400 font-medium">Live Perf.</th>
                  </tr>
                </thead>
                <tbody>
                  {portfolioData.filter((stock: any) => stock.shares > 0).map((stock: any, index: number) => (
                    <tr key={index} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                      <td className="py-3 px-2 text-white font-mono font-semibold">{stock.ticker}</td>
                      <td className="py-3 px-2 text-slate-300">{stock.name}</td>
                      <td className="py-3 px-2 text-white text-right font-semibold">
                        {stock.shares ? stock.shares.toFixed(2) : '0.00'}
                      </td>
                      <td className="py-3 px-2 text-slate-300 text-right">{(parseFloat(stock.weight) || 0).toFixed(1)}%</td>
                      <td className="py-3 px-2 text-slate-300 text-right">
                        {stock.currency || 'CHF'} {(stock.currentPrice || 0).toFixed(2)}
                      </td>
                      <td className="py-3 px-2 text-blue-400 text-right font-semibold">
                        {stock.currency || 'CHF'} {stock.totalInvested ? Math.round(stock.totalInvested).toLocaleString('de-CH') : '0'}
                      </td>
                      <td className="py-3 px-2 text-green-400 text-right font-semibold">
                        {stock.currency || 'CHF'} {stock.currentValue ? Math.round(stock.currentValue).toLocaleString('de-CH') : '0'}
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
                        stock.currentValue >= stock.totalInvested ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {stock.totalInvested > 0 ? (
                          <>
                            {((stock.currentValue - stock.totalInvested) / stock.totalInvested * 100) >= 0 ? '+' : ''}
                            {(((stock.currentValue - stock.totalInvested) / stock.totalInvested * 100) || 0).toFixed(1)}%
                          </>
                        ) : '-'}
                      </td>
                    </tr>
                  ))}
                  {/* Cash Position Row */}
                  <tr className="border-t-2 border-slate-600">
                    <td className="py-3 px-2 text-white font-semibold" colSpan={2}>Cash Position</td>
                    <td className="py-3 px-2 text-right" colSpan={3}></td>
                    <td className="py-3 px-2 text-right" colSpan={1}></td>
                    <td className="py-3 px-2 text-yellow-400 text-right font-semibold" colSpan={1}>
                      CHF {(() => {
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
                        // Treat all buys as implicit deposits (portfolio may have existed before going live)
                        const totalCapital = deposits - withdrawals + buyAmounts;
                        const cash = totalCapital - buyAmounts + sellAmounts;
                        console.log('[Cash Debug]', { deposits, withdrawals, buyAmounts, sellAmounts, totalCapital, cash });
                        return Math.round(cash).toLocaleString('de-CH');
                      })()}
                    </td>
                    <td colSpan={3}></td>
                  </tr>
                  {/* Total Row */}
                  <tr className="border-t border-slate-600 bg-slate-700/30">
                    <td className="py-3 px-2 text-white font-bold" colSpan={2}>TOTAL</td>
                    <td className="py-3 px-2 text-right" colSpan={3}></td>
                    <td className="py-3 px-2 text-blue-400 text-right font-bold">
                      CHF {Math.round(portfolioData.filter((s: any) => s.shares > 0).reduce((sum, s) => sum + (s.totalInvested || 0), 0)).toLocaleString('de-CH')}
                    </td>
                    <td className="py-3 px-2 text-green-400 text-right font-bold">
                      CHF {(() => {
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
                        return Math.round(total).toLocaleString('de-CH');
                      })()}
                    </td>
                    <td colSpan={1}></td>
                    <td colSpan={1}></td>
                    <td className={`py-3 px-2 text-right font-bold ${
                      (() => {
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
                        const totalValue = stocksValue + cash;
                        return totalValue >= totalCapital ? 'text-green-400' : 'text-red-400';
                      })()
                    }`}>
                      {(() => {
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
    </div>
  );
}
