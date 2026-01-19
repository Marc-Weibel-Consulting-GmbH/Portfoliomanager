import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { 
  Plus, 
  TrendingUp, 
  Briefcase, 
  Eye, 
  Trash2,
  TrendingDown,
  DollarSign,
  BarChart3,
  CheckSquare,
  Square,
  Trophy,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState, useMemo } from "react";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("de-CH", {
    style: "currency",
    currency: "CHF",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatPercent = (value: number) => {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
};

const formatDate = (date: Date | string) => {
  const d = new Date(date);
  return d.toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" });
};

// Compact Outperformance Table Component
const OutperformanceTable = ({ performanceData }: { performanceData: any }) => {
  const periods = ['1M', '3M', '6M', 'YTD', '1Y'];
  
  return (
    <div className="grid grid-cols-5 gap-1 text-xs">
      {periods.map(period => {
        // Use outperformance directly from backend if available, otherwise calculate
        const outperformance = performanceData?.[period]?.outperformance ?? 
          (performanceData?.[period]?.portfolio ?? 0) - (performanceData?.[period]?.benchmark ?? 0);
        const isPositive = outperformance >= 0;
        
        return (
          <div key={period} className="text-center">
            <div className="text-gray-500 text-xs mb-0.5">{period}</div>
            <div className={`text-sm font-medium ${isPositive ? 'text-[#00CFC1]' : 'text-red-500'}`}>
              {outperformance >= 0 ? '+' : ''}{outperformance.toFixed(1)}%
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default function Portfolios() {
  const [, setLocation] = useLocation();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("performance");
  const [selectedPortfolios, setSelectedPortfolios] = useState<Set<number>>(new Set());
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Fetch portfolios from database
  const { data: portfolios = [], refetch, isLoading } = trpc.portfolios.list.useQuery();
  const deleteMutation = trpc.portfolios.delete.useMutation({
    onSuccess: () => {
      // Refresh will happen after all deletions
    },
    onError: (error) => {
      toast.error('Fehler beim Löschen', { description: error.message });
    }
  });
  
  // Fetch aggregated metrics for live portfolios only
  const { data: metrics } = trpc.dashboard.getAggregatedMetrics.useQuery();
  
  // Fetch multi-period performance data for all portfolios (V2 uses same logic as detail page)
  const { data: multiPeriodData } = trpc.portfolios.getMultiPeriodPerformanceV2.useQuery();

  // Calculate best performer
  const bestPerformer = useMemo(() => {
    if (!portfolios || portfolios.length === 0) return null;
    const sorted = [...portfolios].sort((a: any, b: any) => {
      const perfA = typeof a.livePerformance === 'number' ? a.livePerformance : 0;
      const perfB = typeof b.livePerformance === 'number' ? b.livePerformance : 0;
      return perfB - perfA;
    });
    return sorted[0];
  }, [portfolios]);

  // Toggle selection for a single portfolio
  const toggleSelection = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSelected = new Set(selectedPortfolios);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedPortfolios(newSelected);
  };

  // Select all portfolios
  const selectAll = () => {
    const allIds = new Set(sortedPortfolios.map((p: any) => p.id));
    setSelectedPortfolios(allIds);
  };

  // Deselect all portfolios
  const deselectAll = () => {
    setSelectedPortfolios(new Set());
  };

  // Handle batch delete
  const handleBatchDelete = async () => {
    if (selectedPortfolios.size === 0) return;
    
    setIsDeleting(true);
    const idsToDelete = Array.from(selectedPortfolios);
    let deletedCount = 0;
    
    for (const id of idsToDelete) {
      try {
        await deleteMutation.mutateAsync({ id });
        deletedCount++;
      } catch (error) {
        console.error(`Failed to delete portfolio ${id}:`, error);
      }
    }
    
    setIsDeleting(false);
    setIsDeleteDialogOpen(false);
    setSelectedPortfolios(new Set());
    
    if (deletedCount > 0) {
      toast.success(`${deletedCount} Portfolio${deletedCount > 1 ? 's' : ''} gelöscht`);
      await refetch();
      window.location.reload();
    }
  };

  // Handle single delete
  const handleDelete = async (e: React.MouseEvent, id: number, name: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Möchten Sie das Portfolio "${name}" wirklich löschen?`)) {
      return;
    }
    await deleteMutation.mutateAsync({ id });
    await refetch();
    window.location.reload();
  };

  const handleViewPortfolio = (portfolio: any) => {
    setLocation(`/portfolios/${portfolio.id}`);
  };
  
  // Filter portfolios
  let filteredPortfolios = portfolios;
  if (statusFilter === "live") {
    filteredPortfolios = portfolios.filter((p: any) => p.isLive === 1);
  } else if (statusFilter === "test") {
    filteredPortfolios = portfolios.filter((p: any) => p.isLive === 0);
  }
  
  // Sort portfolios
  const sortedPortfolios = [...filteredPortfolios].sort((a: any, b: any) => {
    if (sortBy === "performance") {
      const perfA = typeof a.livePerformance === 'number' ? a.livePerformance : 0;
      const perfB = typeof b.livePerformance === 'number' ? b.livePerformance : 0;
      return perfB - perfA;
    } else if (sortBy === "date") {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    } else if (sortBy === "name") {
      return a.name.localeCompare(b.name);
    }
    return 0;
  });

  // Count positions for each portfolio
  const getPositionCount = (portfolio: any) => {
    if (portfolio.portfolioData) {
      try {
        const data = JSON.parse(portfolio.portfolioData);
        return data.positions?.length || data.stocks?.length || 0;
      } catch {
        return 0;
      }
    }
    return 0;
  };

  // Get names of selected portfolios for the dialog
  const getSelectedPortfolioNames = () => {
    return sortedPortfolios
      .filter((p: any) => selectedPortfolios.has(p.id))
      .map((p: any) => p.name);
  };

  const liveCount = portfolios.filter((p: any) => p.isLive === 1).length;
  const testCount = portfolios.length - liveCount;

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Portfolios</h1>
            <p className="text-gray-400 text-sm">
              Verwalten Sie Ihre Anlageportfolios
            </p>
          </div>
          <Button
            onClick={() => setLocation("/portfolio-builder/new")}
            size="sm"
            className="gap-2 bg-[#00CFC1] hover:bg-[#00CFC1]/90 text-white"
          >
            <Plus className="h-4 w-4" />
            Neues Portfolio
          </Button>
        </div>

        {/* Compact Statistics Header */}
        <div className="bg-gradient-to-r from-[#1a1f2e] to-[#0f1420] border border-white/10 rounded-lg p-3">
          <div className="grid grid-cols-6 gap-4">
            {/* Portfolios Count */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-[#00CFC1]/20 rounded-lg flex items-center justify-center shrink-0">
                <Briefcase className="h-4 w-4 text-[#00CFC1]" />
              </div>
              <div>
                <div className="text-xs text-gray-400">Portfolios</div>
                <div className="text-lg font-bold text-white">{portfolios.length}</div>
                <div className="text-[10px] text-gray-500">{liveCount} Live, {testCount} Test</div>
              </div>
            </div>

            {/* Total Value */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-[#00CFC1]/20 rounded-lg flex items-center justify-center shrink-0">
                <DollarSign className="h-4 w-4 text-[#00CFC1]" />
              </div>
              <div>
                <div className="text-xs text-gray-400">Gesamtwert</div>
                <div className="text-lg font-bold text-white">{formatCurrency(metrics?.totalValue || 0)}</div>
                <div className="text-[10px] text-gray-500">Live Portfolios</div>
              </div>
            </div>

            {/* YTD Performance */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-[#00CFC1]/20 rounded-lg flex items-center justify-center shrink-0">
                <BarChart3 className="h-4 w-4 text-[#00CFC1]" />
              </div>
              <div>
                <div className="text-xs text-gray-400">Performance YTD</div>
                <div className={`text-lg font-bold ${(metrics?.totalPerformancePercent || 0) >= 0 ? 'text-[#00CFC1]' : 'text-red-500'}`}>
                  {formatPercent(metrics?.totalPerformancePercent || 0)}
                </div>
                <div className="text-[10px] text-gray-500">Ø Live Portfolios</div>
              </div>
            </div>

            {/* vs Benchmark */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center shrink-0">
                {((metrics?.totalPerformancePercent || 0) - ((metrics as any)?.benchmarkPerformance || 0)) >= 0 ? (
                  <ArrowUpRight className="h-4 w-4 text-[#00CFC1]" />
                ) : (
                  <ArrowDownRight className="h-4 w-4 text-red-500" />
                )}
              </div>
              <div>
                <div className="text-xs text-gray-400">vs. Benchmark</div>
                <div className={`text-lg font-bold ${((metrics?.totalPerformancePercent || 0) - ((metrics as any)?.benchmarkPerformance || 0)) >= 0 ? 'text-[#00CFC1]' : 'text-red-500'}`}>
                  {formatPercent((metrics?.totalPerformancePercent || 0) - ((metrics as any)?.benchmarkPerformance || 0))}
                </div>
                <div className="text-[10px] text-gray-500">S&P 500</div>
              </div>
            </div>

            {/* Dividend Yield */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center shrink-0">
                <Percent className="h-4 w-4 text-purple-400" />
              </div>
              <div>
                <div className="text-xs text-gray-400">Div. Rendite</div>
                <div className="text-lg font-bold text-purple-400">
                  {((metrics as any)?.avgDividendYield || 0).toFixed(2)}%
                </div>
                <div className="text-[10px] text-gray-500">Durchschnitt</div>
              </div>
            </div>

            {/* Best Performer */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-yellow-500/20 rounded-lg flex items-center justify-center shrink-0">
                <Trophy className="h-4 w-4 text-yellow-400" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs text-gray-400">Bestes Portfolio (YTD)</div>
                <div className="text-sm font-bold text-yellow-400 truncate" title={bestPerformer?.name || ''}>
                  {bestPerformer?.name || '-'}
                </div>
                <div className={`text-[10px] ${(Number(bestPerformer?.livePerformance) || 0) >= 0 ? 'text-[#00CFC1]' : 'text-red-500'}`}>
                  {bestPerformer ? formatPercent(Number(bestPerformer.livePerformance) || 0) : '-'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Selection Controls */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Status:</span>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[100px] h-8 text-xs bg-[#1a1f2e] border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1f2e] border-white/10">
                  <SelectItem value="all">Alle</SelectItem>
                  <SelectItem value="live">Live</SelectItem>
                  <SelectItem value="test">Test</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Sortieren:</span>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[120px] h-8 text-xs bg-[#1a1f2e] border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1f2e] border-white/10">
                  <SelectItem value="performance">Performance</SelectItem>
                  <SelectItem value="date">Datum</SelectItem>
                  <SelectItem value="name">Name</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Selection Controls */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={selectAll}
              className="h-7 text-xs bg-[#1a1f2e] border-white/10 text-white hover:bg-[#1a1f2e]/80"
            >
              <CheckSquare className="h-3 w-3 mr-1" />
              Alle
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={deselectAll}
              className="h-7 text-xs bg-[#1a1f2e] border-white/10 text-white hover:bg-[#1a1f2e]/80"
              disabled={selectedPortfolios.size === 0}
            >
              <Square className="h-3 w-3 mr-1" />
              Keine
            </Button>
            {selectedPortfolios.size > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setIsDeleteDialogOpen(true)}
                className="h-7 text-xs bg-red-500 hover:bg-red-600 text-white"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                {selectedPortfolios.size} löschen
              </Button>
            )}
          </div>
        </div>

        {/* Portfolio Grid - Compact Cards */}
        {isLoading ? (
          <div className="text-center py-8 text-gray-400">
            Portfolios werden geladen...
          </div>
        ) : sortedPortfolios.length === 0 ? (
          <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30">
            <CardContent className="p-8 text-center">
              <Briefcase className="h-10 w-10 text-gray-600 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-white mb-2">
                Keine Portfolios gefunden
              </h3>
              <p className="text-gray-400 mb-4 text-sm">
                Erstellen Sie Ihr erstes Portfolio, um mit der Analyse zu beginnen.
              </p>
              <Button
                onClick={() => setLocation("/portfolio-builder/new")}
                size="sm"
                className="bg-[#00CFC1] hover:bg-[#00CFC1]/90 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Neues Portfolio erstellen
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {sortedPortfolios.map((portfolio: any) => {
              const positionCount = portfolio.positionCount ?? getPositionCount(portfolio);
              const isLive = portfolio.isLive === 1;
              const isSelected = selectedPortfolios.has(portfolio.id);
              // Use YTD from chart-based multi-period data
              const portfolioPerf = multiPeriodData?.find((p: any) => p.portfolioId === portfolio.id);
              const performance = portfolioPerf?.performance?.['YTD'] ?? (typeof portfolio.livePerformance === 'number' ? portfolio.livePerformance : 0);
              
              return (
                <Card 
                  key={portfolio.id}
                  className={`bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-white/10 hover:border-[#00CFC1]/50 transition-all cursor-pointer group ${
                    isSelected ? 'ring-2 ring-[#00CFC1] border-[#00CFC1]' : ''
                  }`}
                  onClick={() => handleViewPortfolio(portfolio)}
                >
                  <CardContent className="p-4">
                    {/* Header Row */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <div 
                          className="pt-0.5 shrink-0"
                          onClick={(e) => toggleSelection(portfolio.id, e)}
                        >
                          <Checkbox
                            checked={isSelected}
                            className="h-4 w-4 border-white/30 data-[state=checked]:bg-[#00CFC1] data-[state=checked]:border-[#00CFC1]"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-lg font-semibold text-[#00CFC1] truncate">
                              {portfolio.name}
                            </h3>
                            <Badge 
                              variant={isLive ? "default" : "secondary"}
                              className={`shrink-0 text-xs px-2 py-0.5 ${isLive ? "bg-green-500 text-white" : "bg-blue-500 text-white"}`}
                            >
                              {isLive ? "Live" : "Test"}
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-500">
                            Erstellt: {formatDate(portfolio.createdAt)}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleDelete(e, portfolio.id, portfolio.name)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 shrink-0"
                        title="Portfolio löschen"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Stats Row - Compact with larger fonts */}
                    <div className="grid grid-cols-3 gap-2 mb-3 py-2 border-y border-white/5">
                      <div className="text-center">
                        <div className="text-xs text-gray-500">Positionen</div>
                        <div className="text-base font-semibold text-white">{positionCount}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-gray-500">Wert</div>
                        <div className="text-base font-semibold text-white">
                          {formatCurrency(portfolio.currentValue ?? 0)}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-gray-500">YTD</div>
                        <div className={`text-base font-semibold flex items-center justify-center gap-0.5 ${
                          performance >= 0 ? "text-[#00CFC1]" : "text-red-500"
                        }`}>
                          {performance >= 0 ? (
                            <TrendingUp className="h-4 w-4" />
                          ) : (
                            <TrendingDown className="h-4 w-4" />
                          )}
                          {formatPercent(performance)}
                        </div>
                      </div>
                    </div>

                    {/* Outperformance Table - Real multi-period data with larger font */}
                    <div className="mb-3">
                      <div className="text-xs text-gray-500 mb-1.5 text-center">Outperformance vs. S&P 500</div>
                      {(() => {
                        const portfolioPerf = multiPeriodData?.find((p: any) => p.portfolioId === portfolio.id);
                        return (
                          <OutperformanceTable performanceData={{
                            '1M': { 
                              portfolio: portfolioPerf?.performance?.['1M'] ?? 0, 
                              benchmark: portfolioPerf?.benchmarkPerformance?.['1M'] ?? 0,
                              outperformance: portfolioPerf?.outperformance?.['1M'] ?? 0
                            },
                            '3M': { 
                              portfolio: portfolioPerf?.performance?.['3M'] ?? 0, 
                              benchmark: portfolioPerf?.benchmarkPerformance?.['3M'] ?? 0,
                              outperformance: portfolioPerf?.outperformance?.['3M'] ?? 0
                            },
                            '6M': { 
                              portfolio: portfolioPerf?.performance?.['6M'] ?? 0, 
                              benchmark: portfolioPerf?.benchmarkPerformance?.['6M'] ?? 0,
                              outperformance: portfolioPerf?.outperformance?.['6M'] ?? 0
                            },
                            'YTD': { 
                              portfolio: portfolioPerf?.performance?.['YTD'] ?? 0, 
                              benchmark: portfolioPerf?.benchmarkPerformance?.['YTD'] ?? 0,
                              outperformance: portfolioPerf?.outperformance?.['YTD'] ?? 0
                            },
                            '1Y': { 
                              portfolio: portfolioPerf?.performance?.['1Y'] ?? 0, 
                              benchmark: portfolioPerf?.benchmarkPerformance?.['1Y'] ?? 0,
                              outperformance: portfolioPerf?.outperformance?.['1Y'] ?? 0
                            },
                          }} />
                        );
                      })()}
                    </div>

                    {/* Sparkline - Simplified version */}
                    <div className="h-8 bg-gradient-to-t from-[#00CFC1]/10 to-transparent rounded relative mb-2">
                      <svg className="w-full h-full" viewBox="0 0 200 30" preserveAspectRatio="none">
                        <path
                          d={performance >= 0
                            ? "M 0,25 L 40,22 L 80,18 L 120,15 L 160,10 L 200,5"
                            : "M 0,5 L 40,10 L 80,15 L 120,18 L 160,22 L 200,25"
                          }
                          fill="none"
                          stroke="#00CFC1"
                          strokeWidth="1.5"
                        />
                      </svg>
                    </div>

                    {/* Action Button */}
                    <Button 
                      variant="outline"
                      size="sm"
                      className="w-full h-7 text-xs bg-[#00CFC1]/10 hover:bg-[#00CFC1]/20 text-[#00CFC1] border-[#00CFC1]/30"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewPortfolio(portfolio);
                      }}
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      Ansehen
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="bg-[#1a1f2e] border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">
              {selectedPortfolios.size} Portfolio{selectedPortfolios.size > 1 ? 's' : ''} löschen?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              <p className="mb-4">
                Möchten Sie die folgenden Portfolios wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
              </p>
              <ul className="list-disc list-inside space-y-1 max-h-40 overflow-y-auto">
                {getSelectedPortfolioNames().map((name, index) => (
                  <li key={index} className="text-white">{name}</li>
                ))}
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              className="bg-transparent border-white/10 text-white hover:bg-white/10"
              disabled={isDeleting}
            >
              Abbrechen
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBatchDelete}
              className="bg-red-500 hover:bg-red-600 text-white"
              disabled={isDeleting}
            >
              {isDeleting ? 'Wird gelöscht...' : `${selectedPortfolios.size} Portfolio${selectedPortfolios.size > 1 ? 's' : ''} löschen`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
