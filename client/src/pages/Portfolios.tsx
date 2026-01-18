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
import { useState } from "react";

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
      // Refresh the page to show updated list
      await refetch();
      // Force a full page refresh to ensure all data is updated
      window.location.reload();
    }
  };

  // Handle single delete (legacy, still used for individual delete button)
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
        return data.positions?.length || 0;
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Portfolios</h1>
            <p className="text-gray-400 mt-1">
              Verwalten Sie Ihre Anlageportfolios
            </p>
          </div>
          <Button
            onClick={() => setLocation("/portfolio-builder/new")}
            className="gap-2 bg-[#00CFC1] hover:bg-[#00CFC1]/90 text-white"
          >
            <Plus className="h-4 w-4" />
            Neues Portfolio
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-gray-400">Gesamt-Portfolios</div>
                <div className="w-10 h-10 bg-[#00CFC1]/20 rounded-lg flex items-center justify-center">
                  <Briefcase className="h-5 w-5 text-[#00CFC1]" />
                </div>
              </div>
              <div className="text-3xl font-bold text-white mb-1">{portfolios.length}</div>
              <p className="text-sm text-gray-400">
                {metrics?.livePortfolioCount || 0} Live, {portfolios.length - (metrics?.livePortfolioCount || 0)} Test
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-gray-400">Gesamtwert</div>
                <div className="w-10 h-10 bg-[#00CFC1]/20 rounded-lg flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-[#00CFC1]" />
                </div>
              </div>
              <div className="text-3xl font-bold text-white mb-1">
                {formatCurrency(metrics?.totalValue || 0)}
              </div>
              <p className="text-sm text-gray-400">Nur Live Portfolios</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-gray-400">Performance</div>
                <div className="w-10 h-10 bg-[#00CFC1]/20 rounded-lg flex items-center justify-center">
                  <BarChart3 className="h-5 w-5 text-[#00CFC1]" />
                </div>
              </div>
              <div className="text-3xl font-bold text-white mb-1">
                {formatPercent(metrics?.totalPerformancePercent || 0)}
              </div>
              <p className="text-sm text-gray-400">Ø Live Portfolios</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Selection Controls */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">Status:</span>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px] bg-[#1a1f2e] border-white/10 text-white">
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
              <span className="text-sm text-gray-400">Sortieren:</span>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[160px] bg-[#1a1f2e] border-white/10 text-white">
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
              className="bg-[#1a1f2e] border-white/10 text-white hover:bg-[#1a1f2e]/80"
            >
              <CheckSquare className="h-4 w-4 mr-2" />
              Alle auswählen
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={deselectAll}
              className="bg-[#1a1f2e] border-white/10 text-white hover:bg-[#1a1f2e]/80"
              disabled={selectedPortfolios.size === 0}
            >
              <Square className="h-4 w-4 mr-2" />
              Auswahl aufheben
            </Button>
            {selectedPortfolios.size > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setIsDeleteDialogOpen(true)}
                className="bg-red-500 hover:bg-red-600 text-white"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {selectedPortfolios.size} löschen
              </Button>
            )}
          </div>
        </div>

        {/* Portfolio Grid */}
        {isLoading ? (
          <div className="text-center py-12 text-gray-400">
            Portfolios werden geladen...
          </div>
        ) : sortedPortfolios.length === 0 ? (
          <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30">
            <CardContent className="p-12 text-center">
              <Briefcase className="h-12 w-12 text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">
                Keine Portfolios gefunden
              </h3>
              <p className="text-gray-400 mb-6">
                Erstellen Sie Ihr erstes Portfolio, um mit der Analyse zu beginnen.
              </p>
              <Button
                onClick={() => setLocation("/portfolio-builder/new")}
                className="bg-[#00CFC1] hover:bg-[#00CFC1]/90 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Neues Portfolio erstellen
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {sortedPortfolios.map((portfolio: any) => {
              const positionCount = getPositionCount(portfolio);
              const isLive = portfolio.isLive === 1;
              const isSelected = selectedPortfolios.has(portfolio.id);
              
              return (
                <Card 
                  key={portfolio.id}
                  className={`bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-white/10 hover:border-[#00CFC1]/50 transition-all cursor-pointer group ${
                    isSelected ? 'ring-2 ring-[#00CFC1] border-[#00CFC1]' : ''
                  }`}
                  onClick={() => handleViewPortfolio(portfolio)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start gap-3 flex-1">
                        {/* Checkbox for selection */}
                        <div 
                          className="pt-1"
                          onClick={(e) => toggleSelection(portfolio.id, e)}
                        >
                          <Checkbox
                            checked={isSelected}
                            className="border-white/30 data-[state=checked]:bg-[#00CFC1] data-[state=checked]:border-[#00CFC1]"
                          />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="text-xl font-semibold text-[#00CFC1]">
                              {portfolio.name}
                            </h3>
                            <Badge 
                              variant={isLive ? "default" : "secondary"}
                              className={isLive ? "bg-green-500 text-white" : "bg-blue-500 text-white"}
                            >
                              {isLive ? "Live" : "Test"}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-400 line-clamp-2">
                            {portfolio.description || "Testportfolio zur Strategieentwicklung."}
                          </p>
                          <p className="text-xs text-gray-500 mt-2">
                            Erstellt: {formatDate(portfolio.createdAt)}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleDelete(e, portfolio.id, portfolio.name)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500"
                        title="Portfolio löschen"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Positionen</div>
                        <div className="text-lg font-semibold text-white">
                          {portfolio.positionCount ?? positionCount} Aktien
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Wert</div>
                        <div className="text-lg font-semibold text-white">
                          {formatCurrency(portfolio.currentValue ?? 0)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Performance</div>
                        <div className={`text-lg font-semibold flex items-center gap-1 ${
                          (typeof portfolio.livePerformance === 'number' ? portfolio.livePerformance : 0) >= 0 ? "text-[#00CFC1]" : "text-red-500"
                        }`}>
                          {(typeof portfolio.livePerformance === 'number' ? portfolio.livePerformance : 0) >= 0 ? (
                            <TrendingUp className="h-4 w-4" />
                          ) : (
                            <TrendingDown className="h-4 w-4" />
                          )}
                          {formatPercent(typeof portfolio.livePerformance === 'number' ? portfolio.livePerformance : 0)}
                        </div>
                      </div>
                    </div>

                    {/* Sparkline Chart */}
                    <div className="h-16 bg-gradient-to-t from-[#00CFC1]/20 to-transparent rounded relative">
                      <svg className="w-full h-full" viewBox="0 0 200 40" preserveAspectRatio="none">
                        <path
                          d={(typeof portfolio.livePerformance === 'number' ? portfolio.livePerformance : 0) >= 0
                            ? "M 0,35 L 40,30 L 80,25 L 120,20 L 160,15 L 200,10"
                            : "M 0,10 L 40,15 L 80,20 L 120,25 L 160,30 L 200,35"
                          }
                          fill="none"
                          stroke="#00CFC1"
                          strokeWidth="2"
                        />
                      </svg>
                    </div>

                    <div className="mt-4">
                      <Button 
                        variant="outline"
                        className="w-full bg-[#00CFC1] hover:bg-[#00CFC1]/90 text-white border-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewPortfolio(portfolio);
                        }}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Ansehen
                      </Button>
                    </div>
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
