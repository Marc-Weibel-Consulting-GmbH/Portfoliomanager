import { useMemo } from "react";
import { useRoute, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, TrendingUp, TrendingDown } from "lucide-react";
import { StockLogo } from "@/components/StockLogo";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import DashboardLayout from "@/components/DashboardLayout";

const COLORS = ['#00CFC1', '#00b8ad', '#00a199', '#008a85', '#007371', '#005c5d', '#004549'];

export default function PortfolioPositions() {
  const [, params] = useRoute<{ id: string }>("/portfolio/:id/positions");
  const portfolioId = params?.id ? parseInt(params.id) : null;

  // Fetch portfolio details
  const { data: portfolios = [] } = trpc.portfolios.list.useQuery();
  const portfolio = portfolios.find((p: any) => p.id === portfolioId);

  // Fetch transactions
  const { data: transactions = [] } = trpc.portfolioTransactions.list.useQuery(
    { portfolioId: portfolioId! },
    { enabled: !!portfolioId }
  );

  // Fetch all stocks
  const { data: allStocks = [] } = trpc.stocks.getAll.useQuery();

  // Fetch CHF-converted holdings with performance
  const { data: chfHoldings = [] } = trpc.portfolios.getHoldingsWithChfPerformance.useQuery(
    { id: portfolioId! },
    { enabled: !!portfolioId && !!portfolio && Boolean(portfolio.isLive) }
  );

  // Calculate holdings from transactions
  const holdingsByTicker = useMemo(() => {
    const holdings: Record<string, { shares: number; totalInvested: number }> = {};
    
    transactions.forEach((tx: any) => {
      if (!holdings[tx.ticker]) {
        holdings[tx.ticker] = { shares: 0, totalInvested: 0 };
      }
      
      const shares = parseFloat(tx.shares || '0');
      const amount = parseFloat(tx.totalAmountCHF || tx.totalAmount || '0');
      
      if (tx.transactionType === 'buy') {
        holdings[tx.ticker].shares += shares;
        holdings[tx.ticker].totalInvested += amount;
      } else if (tx.transactionType === 'sell') {
        holdings[tx.ticker].shares -= shares;
        holdings[tx.ticker].totalInvested -= amount;
      }
    });
    
    return holdings;
  }, [transactions]);

  // Calculate currency allocation
  const currencyAllocation = useMemo(() => {
    const currencies: Record<string, number> = {};
    
    chfHoldings.forEach((holding: any) => {
      const currency = holding.currency || 'CHF';
      const value = parseFloat(holding.currentValueCHF || '0');
      currencies[currency] = (currencies[currency] || 0) + value;
    });
    
    return Object.entries(currencies).map(([currency, value]) => ({
      name: currency,
      value: value,
    }));
  }, [chfHoldings]);

  // Calculate sector allocation
  const sectorAllocation = useMemo(() => {
    const sectors: Record<string, number> = {};
    
    chfHoldings.forEach((holding: any) => {
      const stock = allStocks.find((s: any) => s.ticker === holding.ticker);
      const sector = stock?.sector || 'Unknown';
      const value = parseFloat(holding.currentValueCHF || '0');
      sectors[sector] = (sectors[sector] || 0) + value;
    });
    
    return Object.entries(sectors).map(([sector, value]) => ({
      name: sector,
      value: value,
    }));
  }, [chfHoldings, allStocks]);

  // Calculate total portfolio value
  const totalValue = useMemo(() => {
    return chfHoldings.reduce((sum: number, holding: any) => {
      return sum + parseFloat(holding.currentValueCHF || '0');
    }, 0);
  }, [chfHoldings]);

  if (!portfolio) {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto">
          <div className="text-white">Portfolio nicht gefunden</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <button className="p-2 rounded-lg bg-[#1a1f2e] border border-white/10 hover:border-[#00CFC1]/50 transition-colors">
                <ArrowLeft className="h-5 w-5 text-white" />
              </button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-white">{portfolio.name}</h1>
              <p className="text-gray-400">{portfolio.description || "Portfolio Details"}</p>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-4 border-b border-white/10">
          <Link href={`/portfolio/${portfolioId}/positions`}>
            <button className="px-4 py-2 text-[#00CFC1] border-b-2 border-[#00CFC1] font-semibold">
              Positionen
            </button>
          </Link>
          {portfolio.isLive && (
            <Link href={`/portfolio/${portfolioId}/transactions`}>
              <button className="px-4 py-2 text-gray-400 hover:text-white transition-colors">
                Transaktionen
              </button>
            </Link>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30">
            <CardContent className="p-6">
              <div className="text-sm text-gray-400 mb-2">Gesamtwert</div>
              <div className="text-2xl font-bold text-white">
                CHF {totalValue.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30">
            <CardContent className="p-6">
              <div className="text-sm text-gray-400 mb-2">Performance</div>
              <div className="text-2xl font-bold text-[#00CFC1] flex items-center gap-2">
                {portfolio.livePerformance ? (
                  <>
                    {Number(portfolio.livePerformance) > 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                    {Number(portfolio.livePerformance).toFixed(2)}%
                  </>
                ) : '--'}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30">
            <CardContent className="p-6">
              <div className="text-sm text-gray-400 mb-2">Positionen</div>
              <div className="text-2xl font-bold text-white">{chfHoldings.length}</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30">
            <CardContent className="p-6">
              <div className="text-sm text-gray-400 mb-2">Währungen</div>
              <div className="text-2xl font-bold text-white">{currencyAllocation.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Currency Allocation */}
          <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30">
            <CardHeader>
              <CardTitle className="text-white">Währungsallokation</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={currencyAllocation}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    label={(entry) => `${entry.name}: ${((entry.value / totalValue) * 100).toFixed(1)}%`}
                  >
                    {currencyAllocation.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => `CHF ${value.toLocaleString('de-CH', { minimumFractionDigits: 2 })}`}
                    contentStyle={{ backgroundColor: '#1a1f2e', border: '1px solid #00CFC1', borderRadius: '8px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Sector Allocation */}
          <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30">
            <CardHeader>
              <CardTitle className="text-white">Branchenallokation</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={sectorAllocation}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    label={(entry) => `${entry.name}: ${((entry.value / totalValue) * 100).toFixed(1)}%`}
                  >
                    {sectorAllocation.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => `CHF ${value.toLocaleString('de-CH', { minimumFractionDigits: 2 })}`}
                    contentStyle={{ backgroundColor: '#1a1f2e', border: '1px solid #00CFC1', borderRadius: '8px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Holdings Table */}
        <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30">
          <CardHeader>
            <CardTitle className="text-white">Positionen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Aktie</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">Anzahl</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">Aktueller Preis</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">Wert (CHF)</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">Performance</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">Gewicht</th>
                  </tr>
                </thead>
                <tbody>
                  {chfHoldings.map((holding: any) => {
                    const stock = allStocks.find((s: any) => s.ticker === holding.ticker);
                    const currentValue = parseFloat(holding.currentValueCHF || '0');
                    const weight = totalValue > 0 ? (currentValue / totalValue) * 100 : 0;
                    const performance = parseFloat(holding.performancePercent || '0');
                    
                    return (
                      <tr key={holding.ticker} className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer">
                        <td className="py-4 px-4">
                          <Link href={`/stock/${holding.ticker}`}>
                            <div className="flex items-center gap-3">
                              <StockLogo ticker={holding.ticker} companyName={stock?.companyName || holding.ticker} size="sm" />
                              <div>
                                <div className="text-[#00CFC1] font-semibold hover:underline">{holding.ticker}</div>
                                <div className="text-sm text-gray-400">{stock?.companyName || holding.ticker}</div>
                              </div>
                            </div>
                          </Link>
                        </td>
                        <td className="text-right py-4 px-4 text-white">
                          {parseFloat(holding.shares || '0').toLocaleString('de-CH', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="text-right py-4 px-4 text-white">
                          {holding.currency} {parseFloat(holding.currentPrice || '0').toLocaleString('de-CH', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="text-right py-4 px-4 text-white font-semibold">
                          CHF {currentValue.toLocaleString('de-CH', { minimumFractionDigits: 2 })}
                        </td>
                        <td className={`text-right py-4 px-4 font-semibold ${performance >= 0 ? 'text-[#00CFC1]' : 'text-red-500'}`}>
                          {performance >= 0 ? '+' : ''}{Number(performance).toFixed(2)}%
                        </td>
                        <td className="text-right py-4 px-4 text-gray-400">
                          {Number(weight).toFixed(2)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
