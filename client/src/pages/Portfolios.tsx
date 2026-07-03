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
import { ConfirmDialog } from "@/components/ConfirmDialog";
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
  Scale,
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
import { Bell, AlertTriangle, BarChart3 as BarChart3Icon, Target, MinusCircle, Activity, Shield, Info, X, Loader2, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { CopilotInsights } from "@/components/dashboard/CopilotInsights";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { formatCHF, formatDate, formatPercent } from "@/lib/format";
import { getUserErrorMessage } from "@/lib/errorMessages";

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
  // U-08: Einzel-Löschung über AlertDialog statt Browser-confirm()
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);

  const utils = trpc.useUtils();
  // Fetch portfolios from database
  const { data: portfolios = [], refetch, isLoading } = trpc.portfolios.list.useQuery();
  const deleteMutation = trpc.portfolios.delete.useMutation({
    onSuccess: () => {
      // Refresh will happen after all deletions
    },
    onError: (error) => {
      toast.error('Fehler beim Löschen', { description: getUserErrorMessage(error) });
    }
  });

  // U-08: Nach dem Löschen abhängige Queries invalidieren statt window.location.reload()
  const invalidateAfterDelete = () => {
    utils.portfolios.list.invalidate();
    utils.portfolios.getMultiPeriodPerformanceV2.invalidate();
    utils.dashboard.getAggregatedMetrics.invalidate();
    utils.dashboard.getPortfolioCompact.invalidate();
  };
  
  // Fetch aggregated metrics for live portfolios only
  const { data: metrics, isLoading: metricsLoading, isError: metricsError, refetch: refetchMetrics } = trpc.dashboard.getAggregatedMetrics.useQuery();
  
  // Fetch risk metrics (Sharpe, Bubble) for KPI tooltips
  const { data: riskMetrics } = trpc.dashboard.getRiskMetrics.useQuery(undefined, { staleTime: 5 * 60 * 1000, retry: false });
  const { data: bubbleData } = trpc.dashboard.getBubbleIndicator.useQuery(undefined, { staleTime: 5 * 60 * 1000, retry: false });
  
  // State for action popup dialogs
  const [actionDialog, setActionDialog] = useState<{ open: boolean; title: string; body: string; insightId: string; insightType: string }>({ open: false, title: '', body: '', insightId: '', insightType: 'general' });
  const [actionLoading, setActionLoading] = useState(false);
  const [actionResult, setActionResult] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Array<{ ticker: string; companyName: string; action: string; currentWeightPercent: number; targetWeightPercent: number; reason: string; selected: boolean }>>([]);
  const [suggestionSummary, setSuggestionSummary] = useState('');
  const [applyingState, setApplyingState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [selectedPortfolioForAction, setSelectedPortfolioForAction] = useState<number | null>(null);

  const applySuggestionsMutation = trpc.dashboard.applySuggestions.useMutation({
    onSuccess: (result) => {
      setApplyingState('success');
      toast.success('Vorschläge umgesetzt', { description: result.mode === 'live' ? `${result.transactions?.length || 0} Transaktionen erstellt` : `${result.updatedPositions} Positionen aktualisiert` });
      refetch();
    },
    onError: (error) => {
      setApplyingState('error');
      toast.error('Fehler', { description: error.message });
    }
  });
  
  // Fetch multi-period performance data for all portfolios (V2 uses same logic as detail page)
  const { data: multiPeriodData } = trpc.portfolios.getMultiPeriodPerformanceV2.useQuery();

  // Calculate best performer based on YTD outperformance
  const bestPerformer = useMemo(() => {
    if (!portfolios || portfolios.length === 0 || !multiPeriodData) return null;
    const sorted = [...portfolios].sort((a: any, b: any) => {
      const portfolioPerfA = multiPeriodData.find((p: any) => p.portfolioId === a.id);
      const portfolioPerfB = multiPeriodData.find((p: any) => p.portfolioId === b.id);
      const outperfA = portfolioPerfA?.outperformance?.['YTD'] ?? -Infinity;
      const outperfB = portfolioPerfB?.outperformance?.['YTD'] ?? -Infinity;
      return outperfB - outperfA;
    });
    return sorted[0];
  }, [portfolios, multiPeriodData]);

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
      invalidateAfterDelete();
    }
  };

  // Handle single delete (confirmed via ConfirmDialog)
  const handleDelete = (e: React.MouseEvent, id: number, name: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleteTarget({ id, name });
  };

  const handleDeleteConfirmed = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync({ id: deleteTarget.id });
      toast.success(`Portfolio «${deleteTarget.name}» gelöscht`);
      invalidateAfterDelete();
    } catch {
      // Fehler-Toast kommt aus deleteMutation.onError
    } finally {
      setDeleteTarget(null);
    }
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

  // Sidebar data
  const { data: alerts } = trpc.priceAlerts.list.useQuery();
  const activeAlerts = alerts?.filter((a: any) => a.status === 'active').slice(0, 3) || [];

  const { data: copilotInsights = [], isLoading: insightsLoading } = trpc.dashboard.getCopilotInsights.useQuery(
    { scope: 'aggregate' },
    { staleTime: 5 * 60 * 1000 }
  );

  const { data: scoringData, isLoading: scoringLoading } = trpc.dashboard.getScoringWatchlist.useQuery(
    undefined,
    { staleTime: 5 * 60 * 1000, retry: false }
  );

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
            onClick={() => setLocation("/portfolio-builder")}
            size="sm"
            className="gap-2 bg-[#00CFC1] hover:bg-[#00CFC1]/90 text-white"
          >
            <Plus className="h-4 w-4" />
            Neues Portfolio
          </Button>
        </div>

        {/* Compact Statistics Header */}
        <div className="bg-gradient-to-r from-[#1a1f2e] to-[#0f1420] border border-white/10 rounded-lg p-3">
          <div className="grid grid-cols-4 xl:grid-cols-8 gap-3">
            {/* Portfolios Count */}
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-[#00CFC1]/20 rounded-lg flex items-center justify-center shrink-0">
                <Briefcase className="h-3.5 w-3.5 text-[#00CFC1]" />
              </div>
              <div>
                <div className="text-[10px] text-gray-400">Portfolios</div>
                <div className="text-base font-bold text-white">{portfolios.length}</div>
                <div className="text-[9px] text-gray-500">{liveCount} Live, {testCount} Test</div>
              </div>
            </div>

            {/* U-07: Geldwert-KPIs — Skeleton beim Laden (kein 0-Flackern),
                Fehlerzustand statt falscher «CHF 0» bei fehlgeschlagener Abfrage */}
            {metricsLoading ? (
              [0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-2">
                  <Skeleton className="w-7 h-7 rounded-lg bg-white/10 shrink-0" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-2.5 w-16 bg-white/10" />
                    <Skeleton className="h-4 w-20 bg-white/10" />
                  </div>
                </div>
              ))
            ) : metricsError ? (
              <div className="col-span-4 flex items-center gap-3">
                <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" aria-hidden="true" />
                <span className="text-xs text-gray-300">Daten derzeit nicht verfügbar</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-xs bg-[#1a1f2e] border-white/10 text-white hover:bg-[#1a1f2e]/80"
                  onClick={() => refetchMetrics()}
                >
                  <RefreshCw className="h-3 w-3 mr-1" aria-hidden="true" />
                  Erneut versuchen
                </Button>
              </div>
            ) : (
            <>
            {/* Total Value */}
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-[#00CFC1]/20 rounded-lg flex items-center justify-center shrink-0">
                <DollarSign className="h-3.5 w-3.5 text-[#00CFC1]" />
              </div>
              <div>
                <div className="text-[10px] text-gray-400">Gesamtwert</div>
                <div className="text-base font-bold text-white">{formatCHF(metrics?.totalValue || 0, { decimals: 0 })}</div>
                <div className="text-[9px] text-gray-500">Alle Portfolios</div>
              </div>
            </div>

            {/* Tagesveränderung */}
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                ((metrics as any)?.dayChange || 0) >= 0 ? 'bg-[#00CFC1]/20' : 'bg-red-500/20'
              }`}>
                <Activity className={`h-3.5 w-3.5 ${
                  ((metrics as any)?.dayChange || 0) >= 0 ? 'text-[#00CFC1]' : 'text-red-500'
                }`} />
              </div>
              <div>
                <div className="text-[10px] text-gray-400">Tagesveränderung</div>
                <div className={`text-base font-bold ${
                  ((metrics as any)?.dayChange || 0) >= 0 ? 'text-[#00CFC1]' : 'text-red-500'
                }`}>
                  {formatCHF((metrics as any)?.dayChange || 0, { decimals: 0, signDisplay: 'always' })}
                </div>
                <div className={`text-[9px] ${
                  ((metrics as any)?.dayChangePercent || 0) >= 0 ? 'text-[#00CFC1]' : 'text-red-500'
                }`}>
                  {((metrics as any)?.dayChangePercent || 0) >= 0 ? '+' : ''}{((metrics as any)?.dayChangePercent || 0).toFixed(2)}%
                </div>
              </div>
            </div>

            {/* YTD Performance */}
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-[#00CFC1]/20 rounded-lg flex items-center justify-center shrink-0">
                <BarChart3 className="h-3.5 w-3.5 text-[#00CFC1]" />
              </div>
              <div>
                <div className="text-[10px] text-gray-400">Performance YTD</div>
                <div className={`text-base font-bold ${(metrics?.totalPerformancePercent || 0) >= 0 ? 'text-[#00CFC1]' : 'text-red-500'}`}>
                  {formatPercent(metrics?.totalPerformancePercent || 0)}
                </div>
                <div className="text-[9px] text-gray-500">Ø Portfolios</div>
              </div>
            </div>

            {/* vs Benchmark */}
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-blue-500/20 rounded-lg flex items-center justify-center shrink-0">
                {((metrics?.totalPerformancePercent || 0) - ((metrics as any)?.benchmarkPerformance || 0)) >= 0 ? (
                  <ArrowUpRight className="h-3.5 w-3.5 text-[#00CFC1]" />
                ) : (
                  <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />
                )}
              </div>
              <div>
                <div className="text-[10px] text-gray-400">vs. Benchmark</div>
                <div className={`text-base font-bold ${((metrics?.totalPerformancePercent || 0) - ((metrics as any)?.benchmarkPerformance || 0)) >= 0 ? 'text-[#00CFC1]' : 'text-red-500'}`}>
                  {formatPercent((metrics?.totalPerformancePercent || 0) - ((metrics as any)?.benchmarkPerformance || 0))}
                </div>
                <div className="text-[9px] text-gray-500">S&P 500</div>
              </div>
            </div>
            </>
            )}

            {/* Sharpe Ratio with Tooltip */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2 cursor-help">
                  <div className="w-7 h-7 bg-purple-500/20 rounded-lg flex items-center justify-center shrink-0">
                    <Scale className="h-3.5 w-3.5 text-purple-400" />
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-400">Sharpe Ratio</div>
                    <div className="text-base font-bold text-purple-400">
                      {((riskMetrics as any)?.sharpeRatio ?? 0).toFixed(2)}
                    </div>
                    <div className="text-[9px] text-gray-500">Risikoadj. Rendite</div>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-[#1a1f2e] border-white/20 text-white max-w-[250px] p-3">
                <p className="text-xs font-semibold mb-1">Sharpe Ratio</p>
                <p className="text-[11px] text-gray-300">Misst die risikoadjustierte Rendite. Werte {'>'} 1.0 gelten als gut, {'>'} 2.0 als sehr gut. Berechnet als (Rendite − risikofreier Zins) / Volatilität.</p>
                <p className="text-[10px] text-gray-500 mt-1">Benchmark (SMI): {((riskMetrics as any)?.sharpeBenchmark ?? 0).toFixed(2)}</p>
              </TooltipContent>
            </Tooltip>

            {/* Bubble Indicator with Tooltip */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2 cursor-help">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    ((bubbleData as any)?.level ?? 0) >= 70 ? 'bg-red-500/20' :
                    ((bubbleData as any)?.level ?? 0) >= 40 ? 'bg-amber-500/20' : 'bg-emerald-500/20'
                  }`}>
                    <Shield className={`h-3.5 w-3.5 ${
                      ((bubbleData as any)?.level ?? 0) >= 70 ? 'text-red-400' :
                      ((bubbleData as any)?.level ?? 0) >= 40 ? 'text-amber-400' : 'text-emerald-400'
                    }`} />
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-400">Bubble-Indikator</div>
                    <div className={`text-base font-bold ${
                      ((bubbleData as any)?.level ?? 0) >= 70 ? 'text-red-400' :
                      ((bubbleData as any)?.level ?? 0) >= 40 ? 'text-amber-400' : 'text-emerald-400'
                    }`}>
                      {(bubbleData as any)?.level ?? 0}/100
                    </div>
                    <div className="text-[9px] text-gray-500">{(bubbleData as any)?.label || 'Normal'}</div>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-[#1a1f2e] border-white/20 text-white max-w-[280px] p-3">
                <p className="text-xs font-semibold mb-1">Bubble-Indikator (Sornette)</p>
                <p className="text-[11px] text-gray-300">Basiert auf dem Log-Periodic Power Law (LPPL) Modell. Misst die Wahrscheinlichkeit einer Marktblase. 0-30: Normal, 30-60: Erhöht, 60-80: Hoch, 80-100: Kritisch.</p>
                {(bubbleData as any)?.components && (
                  <div className="mt-1.5 space-y-0.5">
                    {Object.entries((bubbleData as any).components || {}).slice(0, 4).map(([key, val]: [string, any]) => (
                      <div key={key} className="flex justify-between text-[10px]">
                        <span className="text-gray-400">{key}</span>
                        <span className="text-white font-mono">{typeof val === 'number' ? val.toFixed(1) : val}</span>
                      </div>
                    ))}
                  </div>
                )}
              </TooltipContent>
            </Tooltip>

            {/* Best Performer */}
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-yellow-500/20 rounded-lg flex items-center justify-center shrink-0">
                <Trophy className="h-3.5 w-3.5 text-yellow-400" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] text-gray-400">Bestes (YTD)</div>
                <div className="text-sm font-bold text-yellow-400 truncate" title={bestPerformer?.name || ''}>
                  {bestPerformer?.name || '-'}
                </div>
                <div className={`text-[9px] ${(() => {
                  const perf = multiPeriodData?.find((p: any) => p.portfolioId === bestPerformer?.id);
                  return (perf?.outperformance?.['YTD'] || 0) >= 0 ? 'text-[#00CFC1]' : 'text-red-500';
                })()}`}>
                  {(() => {
                    const perf = multiPeriodData?.find((p: any) => p.portfolioId === bestPerformer?.id);
                    return bestPerformer && perf?.outperformance?.['YTD'] !== undefined 
                      ? `Outperf: ${formatPercent(perf.outperformance['YTD'])}` 
                      : (bestPerformer ? '...' : '-');
                  })()}
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

        {/* Two-column layout: Portfolio Grid + Sidebar */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* Left: Portfolio Grid (2/3 width) */}
          <div className="xl:col-span-2">
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
                onClick={() => setLocation("/portfolio-builder")}
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
                            {/* U-13: Positionen mit fehlenden Kurs-/FX-Daten ausweisen */}
                            {Array.isArray(portfolio.dataQuality) && portfolio.dataQuality.length > 0 && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span
                                    className="flex items-center gap-0.5 text-xs font-medium text-amber-400 shrink-0 cursor-help"
                                    aria-label={`${portfolio.dataQuality.length} Position${portfolio.dataQuality.length > 1 ? 'en' : ''} mit fehlenden Kursdaten`}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                                    {portfolio.dataQuality.length}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="bg-[#1a1f2e] border-white/20 text-white max-w-[260px] p-3">
                                  <p className="text-xs">
                                    Für {portfolio.dataQuality.length} Position{portfolio.dataQuality.length > 1 ? 'en' : ''} fehlen
                                    aktuelle Kurs- oder Wechselkursdaten. Diese Positionen sind im angezeigten Wert nicht enthalten.
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            )}
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
                          {formatCHF(portfolio.currentValue ?? 0, { decimals: 0 })}
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

          {/* Right Sidebar (1/3 width) */}
          <div className="space-y-4">
            {/* Copilot Insights */}
            <CopilotInsights 
              insights={copilotInsights as any[]} 
              loading={insightsLoading}
              onAction={(insight) => {
                const insightType = insight.id.includes('sector') ? 'sector_check'
                  : insight.id.includes('concentration') || insight.id.includes('position') ? 'top_positions'
                  : insight.id.includes('diversif') ? 'diversification'
                  : insight.id.includes('cash') ? 'cash_management'
                  : 'general';
                setActionDialog({ open: true, title: insight.title, body: insight.body, insightId: insight.id, insightType });
                setActionResult(null);
                setSuggestions([]);
                setSuggestionSummary('');
                setApplyingState('idle');
              }}
            />

            {/* Aktive Preisalarme */}
            <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30">
              <div className="px-4 pt-4 pb-2">
                <div className="text-sm font-semibold text-white flex items-center gap-2">
                  <Bell className="h-4 w-4 text-[#00CFC1]" />
                  Aktive Alarme
                  {activeAlerts.length > 0 && (
                    <span className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded-full">
                      {activeAlerts.length}
                    </span>
                  )}
                </div>
              </div>
              <div className="px-4 pb-4 space-y-2">
                {activeAlerts.length === 0 ? (
                  <div className="text-center py-3 text-gray-500 text-xs">Keine aktiven Alarme</div>
                ) : (
                  activeAlerts.map((alert: any) => (
                    <div key={alert.id} className="flex items-center gap-2 bg-[#0f1420]/50 border border-white/5 rounded-lg p-2">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        alert.alertType === 'below_price' ? 'bg-amber-500/20' : 'bg-emerald-500/20'
                      }`}>
                        <AlertTriangle className={`h-3.5 w-3.5 ${
                          alert.alertType === 'below_price' ? 'text-amber-400' : 'text-emerald-400'
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-white text-xs font-semibold">{alert.ticker}</div>
                        <div className="text-gray-500 text-[10px]">
                          {alert.alertType === 'below_price' ? 'Unter' : 'Über'} CHF {parseFloat(alert.targetPrice || '0').toFixed(2)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <Link href="/price-alerts">
                  <div className="text-center pt-1">
                    <span className="text-[#00CFC1] text-xs hover:underline cursor-pointer">Alle Alarme verwalten →</span>
                  </div>
                </Link>
              </div>
            </Card>

            {/* Strategie-Scoring */}
            <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30">
              <div className="px-4 pt-4 pb-2">
                <div className="text-sm font-semibold text-white flex items-center gap-2">
                  <BarChart3Icon className="h-4 w-4 text-[#00CFC1]" />
                  Strategie-Scoring
                  <span className="text-[10px] text-gray-500 font-normal ml-auto">Top 5</span>
                </div>
              </div>
              <div className="px-4 pb-4 space-y-1.5">
                {scoringLoading ? (
                  <div className="text-gray-400 text-xs text-center py-3">Wird berechnet...</div>
                ) : !scoringData || (scoringData as any[]).length === 0 ? (
                  <div className="text-gray-500 text-xs text-center py-3">Keine Daten verfügbar</div>
                ) : (
                  (scoringData as any[]).slice(0, 5).map((item: any) => (
                    <div key={item.symbol} className="flex items-center justify-between bg-white/5 rounded-lg px-2.5 py-1.5">
                      <div className="flex items-center gap-2">
                        <Link href={`/aktien/${item.symbol}`}>
                          <span className="text-[#00CFC1] font-mono text-xs font-semibold hover:underline cursor-pointer">{item.symbol}</span>
                        </Link>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-white text-xs font-mono font-bold">{item.score?.toFixed(0) ?? '–'}</span>
                        <span className={`text-xs font-semibold ${
                          item.signal === 'BUY' ? 'text-emerald-400' :
                          item.signal === 'SELL' ? 'text-red-400' : 'text-gray-400'
                        }`}>{item.signal}</span>
                      </div>
                    </div>
                  ))
                )}
                <Link href="/backtesting">
                  <div className="text-center pt-1">
                    <span className="text-[#00CFC1] text-xs hover:underline cursor-pointer flex items-center justify-center gap-1">
                      <Target className="w-3 h-3" />
                      Strategie-Backtest öffnen
                    </span>
                  </div>
                </Link>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Single Delete Confirmation Dialog (U-08) */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title={`Portfolio «${deleteTarget?.name ?? ''}» löschen?`}
        description="Diese Aktion kann nicht rückgängig gemacht werden. Alle Positionen und Transaktionen dieses Portfolios werden unwiderruflich gelöscht."
        confirmLabel="Portfolio löschen"
        onConfirm={handleDeleteConfirmed}
        isPending={deleteMutation.isPending}
      />

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

      {/* Copilot Insight Action Dialog */}
      <Dialog open={actionDialog.open} onOpenChange={(open) => setActionDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="bg-[#1a1f2e] border-white/10 text-white max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Info className="h-5 w-5 text-[#00CFC1]" />
              {actionDialog.title}
            </DialogTitle>
            <DialogDescription className="text-gray-300 text-sm leading-relaxed mt-2">
              {actionDialog.body}
            </DialogDescription>
          </DialogHeader>

          {/* Portfolio-Selektor für Aktion */}
          {suggestions.length === 0 && applyingState === 'idle' && (
            <div className="mt-4">
              <div className="text-xs text-gray-400 mb-2">Portfolio für Analyse wählen:</div>
              <Select
                value={selectedPortfolioForAction?.toString() || ''}
                onValueChange={(v) => setSelectedPortfolioForAction(Number(v))}
              >
                <SelectTrigger className="bg-[#0a0f1a] border-white/10 text-white">
                  <SelectValue placeholder="Portfolio wählen..." />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1f2e] border-white/10">
                  {portfolios.map((p: any) => (
                    <SelectItem key={p.id} value={p.id.toString()} className="text-white hover:bg-white/10">
                      {p.name} {p.isLive === 1 ? '(Live)' : '(Demo)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Vorschläge laden */}
          {suggestions.length === 0 && applyingState === 'idle' && (
            <div className="mt-4">
              <Button
                size="sm"
                className="bg-[#00CFC1] hover:bg-[#00CFC1]/80 text-black font-semibold w-full"
                disabled={actionLoading || !selectedPortfolioForAction}
                onClick={async () => {
                  setActionLoading(true);
                  try {
                    const result = await fetch(`/api/trpc/dashboard.analyzeInsight?input=${encodeURIComponent(JSON.stringify({ json: { insightType: actionDialog.insightType as any, portfolioId: selectedPortfolioForAction } }))}`, { credentials: 'include' });
                    const json = await result.json();
                    const data = json?.result?.data?.json || json?.result?.data;
                    if (data?.suggestions?.length > 0) {
                      setSuggestions(data.suggestions.map((s: any) => ({ ...s, selected: true })));
                      setSuggestionSummary(data.summary || '');
                    } else {
                      setSuggestionSummary(data?.summary || 'Keine konkreten Vorschläge verfügbar.');
                    }
                  } catch (e) {
                    toast.error('Fehler bei der Analyse');
                  } finally {
                    setActionLoading(false);
                  }
                }}
              >
                {actionLoading ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> KI analysiert...</>
                ) : (
                  'KI-Vorschläge generieren'
                )}
              </Button>
            </div>
          )}

          {/* Zusammenfassung */}
          {suggestionSummary && (
            <div className="mt-4 p-3 bg-[#0a0f1a] rounded-lg border border-white/5">
              <div className="text-xs text-gray-400 mb-1">KI-Analyse:</div>
              <div className="text-sm text-gray-200">{suggestionSummary}</div>
            </div>
          )}

          {/* Vorschläge-Liste */}
          {suggestions.length > 0 && applyingState !== 'success' && (
            <div className="mt-4 space-y-2">
              <div className="text-xs text-gray-400 mb-2">Vorschläge ({suggestions.filter(s => s.selected).length}/{suggestions.length} ausgewählt):</div>
              {suggestions.map((s, idx) => (
                <div key={idx} className={`p-3 rounded-lg border ${s.selected ? 'border-[#00CFC1]/40 bg-[#00CFC1]/5' : 'border-white/5 bg-[#0a0f1a] opacity-60'} cursor-pointer`}
                  onClick={() => {
                    const updated = [...suggestions];
                    updated[idx] = { ...updated[idx], selected: !updated[idx].selected };
                    setSuggestions(updated);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Checkbox checked={s.selected} className="border-white/30" />
                      <span className="text-sm font-medium text-white">{s.ticker}</span>
                      <span className="text-xs text-gray-400">{s.companyName}</span>
                    </div>
                    <Badge className={`text-xs ${
                      s.action === 'add_new' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                      s.action === 'increase' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                      s.action === 'reduce' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                      'bg-red-500/20 text-red-400 border-red-500/30'
                    }`}>
                      {s.action === 'add_new' ? 'NEU' : s.action === 'increase' ? 'ERHÖHEN' : s.action === 'reduce' ? 'REDUZIEREN' : 'VERKAUFEN'}
                    </Badge>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs">
                    <span className="text-gray-400">{s.currentWeightPercent.toFixed(1)}% → {s.targetWeightPercent.toFixed(1)}%</span>
                    <span className="text-gray-500">{s.reason}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Erfolgs-Meldung */}
          {applyingState === 'success' && (
            <div className="mt-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg text-center">
              <div className="text-green-400 font-semibold">✓ Vorschläge erfolgreich umgesetzt</div>
              <div className="text-xs text-gray-400 mt-1">Die Positionen wurden angepasst.</div>
            </div>
          )}

          <DialogFooter className="mt-4 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-white/20 text-gray-300 hover:bg-white/10"
              onClick={() => {
                setActionDialog(prev => ({ ...prev, open: false }));
                setSuggestions([]);
                setSuggestionSummary('');
                setApplyingState('idle');
              }}
            >
              Schliessen
            </Button>
            {suggestions.length > 0 && !applySuggestionsMutation.isPending && applyingState !== 'success' && (
              <Button
                size="sm"
                className="bg-[#00CFC1] hover:bg-[#00CFC1]/80 text-black font-semibold"
                disabled={suggestions.filter(s => s.selected).length === 0 || applySuggestionsMutation.isPending}
                onClick={() => {
                  if (!selectedPortfolioForAction) return;
                  setApplyingState('loading');
                  applySuggestionsMutation.mutate({
                    portfolioId: selectedPortfolioForAction,
                    suggestions: suggestions.filter(s => s.selected).map(s => ({
                      ticker: s.ticker,
                      action: s.action as any,
                      targetWeightPercent: s.targetWeightPercent,
                    })),
                    autoCalculateFees: true,
                  });
                }}
              >
                {`${suggestions.filter(s => s.selected).length} Vorschläge umsetzen`}
              </Button>
            )}
            {applySuggestionsMutation.isPending && (
              <Button size="sm" disabled className="bg-[#00CFC1]/50 text-black font-semibold">
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Umsetzen...
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
