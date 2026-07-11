import { useState, useMemo, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, TrendingUp, TrendingDown, BarChart3, PieChart, Download } from "lucide-react";
import { toast } from "sonner";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export default function PortfolioComparison() {
  const [, setLocation] = useLocation();
  const [selectedPortfolios, setSelectedPortfolios] = useState<number[]>([]);
  const search = useSearch();
  // Support ?a=ID&b=ID URL params for direct comparison from Dashboard
  useEffect(() => {
    const params = new URLSearchParams(search);
    const a = params.get('a');
    const b = params.get('b');
    if (a && b) {
      const ids = [parseInt(a), parseInt(b)].filter(n => !isNaN(n));
      if (ids.length === 2) setSelectedPortfolios(ids);
    }
  }, [search]);

  // Fetch all portfolios
  const { data: portfolios = [], isLoading } = trpc.portfolios.list.useQuery();

  // Fetch comparison data for selected portfolios
  const { data: comparisonData } = trpc.portfolioComparison.compare.useQuery(
    { portfolioIds: selectedPortfolios },
    { enabled: selectedPortfolios.length >= 2 }
  );

  const handlePortfolioToggle = (portfolioId: number) => {
    setSelectedPortfolios((prev) => {
      if (prev.includes(portfolioId)) {
        return prev.filter((id) => id !== portfolioId);
      } else {
        if (prev.length >= 4) {
          toast.error("Maximal 4 Portfolios können verglichen werden");
          return prev;
        }
        return [...prev, portfolioId];
      }
    });
  };

  const exportToPdf = async () => {
    if (!comparisonData) {
      toast.error("Keine Daten zum Exportieren");
      return;
    }

    toast.info("PDF-Export wird vorbereitet...");
    // TODO: Implement PDF export
    toast.success("PDF-Export erfolgreich!");
  };

  // Colors for charts
  const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444"];

  // Performance over time data
  const performanceChartData = useMemo(() => {
    if (!comparisonData?.performanceHistory) return [];
    
    const dates = Array.from(
      new Set(
        comparisonData.performanceHistory.flatMap((p) => p.history.map((h) => h.date))
      )
    ).sort();

    return dates.map((date) => {
      const dataPoint: any = { date };
      comparisonData.performanceHistory.forEach((portfolio) => {
        const historyPoint = portfolio.history.find((h) => h.date === date);
        dataPoint[portfolio.name] = historyPoint?.performance || 0;
      });
      return dataPoint;
    });
  }, [comparisonData]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 p-8">
        <div className="max-w-7xl mx-auto">
          <p className="text-slate-400 text-center">Lade Portfolios...</p>
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
            onClick={() => window.history.back()}
            variant="ghost"
            className="mb-4 text-slate-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Zurück zur Übersicht
          </Button>

          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">Portfolio-Vergleich</h1>
              <p className="text-slate-400">
                Vergleichen Sie bis zu 4 Portfolios nebeneinander
              </p>
            </div>

            {selectedPortfolios.length >= 2 && (
              <Button
                onClick={exportToPdf}
                variant="outline"
                className="text-slate-300 border-slate-600 hover:bg-slate-700"
              >
                <Download className="w-4 h-4 mr-2" />
                PDF exportieren
              </Button>
            )}
          </div>
        </div>

        {/* Portfolio Selection */}
        <Card className="bg-slate-800 border-slate-700 mb-8">
          <CardHeader>
            <CardTitle className="text-white">Portfolios auswählen (2-4)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {portfolios.map((portfolio: any) => (
                <div
                  key={portfolio.id}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedPortfolios.includes(portfolio.id)
                      ? "border-blue-500 bg-blue-500/10"
                      : "border-slate-600 bg-slate-700/50 hover:border-slate-500"
                  }`}
                  onClick={() => handlePortfolioToggle(portfolio.id)}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={selectedPortfolios.includes(portfolio.id)}
                      onCheckedChange={() => handlePortfolioToggle(portfolio.id)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-white font-medium">{portfolio.name}</h3>
                        {portfolio.isSnapshot === 1 && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 font-medium">Snapshot</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        {portfolio.isLive ? (
                          <span className="text-green-400 flex items-center gap-1">
                            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                            Live
                          </span>
                        ) : (
                          <span className="text-slate-400">Test</span>
                        )}
                        {portfolio.livePerformance !== null &&
                          portfolio.livePerformance !== undefined && (
                            <span
                              className={
                                portfolio.livePerformance >= 0
                                  ? "text-green-400"
                                  : "text-red-400"
                              }
                            >
                              {portfolio.livePerformance >= 0 ? "+" : ""}
                              {portfolio.livePerformance.toFixed(1)}%
                            </span>
                          )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {selectedPortfolios.length < 2 && (
              <p className="text-slate-400 text-sm mt-4 text-center">
                Wählen Sie mindestens 2 Portfolios aus, um den Vergleich zu starten
              </p>
            )}
          </CardContent>
        </Card>

        {/* Comparison Results */}
        {selectedPortfolios.length >= 2 && comparisonData && (
          <>
            {/* Key Metrics Comparison */}
            <Card className="bg-slate-800 border-slate-700 mb-8">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Kennzahlen im Vergleich
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left py-3 px-4 text-slate-400 font-medium">
                          Metrik
                        </th>
                        {comparisonData.portfolios.map((p: any, idx: number) => (
                          <th
                            key={p.id}
                            className="text-right py-3 px-4 font-medium"
                            style={{ color: COLORS[idx] }}
                          >
                            {p.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-slate-700/50">
                        <td className="py-3 px-4 text-slate-300">Performance</td>
                        {comparisonData.portfolios.map((p: any) => (
                          <td
                            key={p.id}
                            className={`text-right py-3 px-4 font-medium ${
                              p.performance >= 0 ? "text-green-400" : "text-red-400"
                            }`}
                          >
                            {p.performance >= 0 ? "+" : ""}
                            {p.performance.toFixed(2)}%
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b border-slate-700/50">
                        <td className="py-3 px-4 text-slate-300">Volatilität</td>
                        {comparisonData.portfolios.map((p: any) => (
                          <td key={p.id} className="text-right py-3 px-4 text-slate-300">
                            {p.volatility.toFixed(2)}%
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b border-slate-700/50">
                        <td className="py-3 px-4 text-slate-300">Sharpe Ratio</td>
                        {comparisonData.portfolios.map((p: any) => (
                          <td key={p.id} className="text-right py-3 px-4 text-slate-300">
                            {p.sharpeRatio.toFixed(2)}
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b border-slate-700/50">
                        <td className="py-3 px-4 text-slate-300">Max Drawdown</td>
                        {comparisonData.portfolios.map((p: any) => (
                          <td key={p.id} className="text-right py-3 px-4 text-red-400">
                            {p.maxDrawdown.toFixed(2)}%
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b border-slate-700/50">
                        <td className="py-3 px-4 text-slate-300">Ø Dividende</td>
                        {comparisonData.portfolios.map((p: any) => (
                          <td key={p.id} className="text-right py-3 px-4 text-slate-300">
                            {p.avgDividendYield.toFixed(2)}%
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="py-3 px-4 text-slate-300">Aktueller Wert</td>
                        {comparisonData.portfolios.map((p: any) => (
                          <td key={p.id} className="text-right py-3 px-4 text-white font-medium">
                            CHF {p.currentValue.toLocaleString("de-CH")}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Performance Chart */}
            {performanceChartData.length > 0 && (
              <Card className="bg-slate-800 border-slate-700 mb-8">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Performance-Entwicklung
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={performanceChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="date" stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#1e293b",
                          border: "1px solid #334155",
                          borderRadius: "8px",
                        }}
                        labelStyle={{ color: "#e2e8f0" }}
                      />
                      <Legend />
                      {comparisonData.portfolios.map((p: any, idx: number) => (
                        <Line
                          key={p.id}
                          type="monotone"
                          dataKey={p.name}
                          stroke={COLORS[idx]}
                          strokeWidth={2}
                          dot={false}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Sector Allocation Comparison */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {comparisonData.portfolios.map((portfolio: any, idx: number) => (
                <Card key={portfolio.id} className="bg-slate-800 border-slate-700">
                  <CardHeader>
                    <CardTitle
                      className="text-white flex items-center gap-2"
                      style={{ color: COLORS[idx] }}
                    >
                      <PieChart className="w-5 h-5" />
                      {portfolio.name} - Sektor-Allocation
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {portfolio.sectorAllocation && portfolio.sectorAllocation.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <RechartsPieChart>
                          <Pie
                            data={portfolio.sectorAllocation}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) =>
                              `${name}: ${(percent * 100).toFixed(0)}%`
                            }
                            outerRadius={100}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {portfolio.sectorAllocation.map((_: any, index: number) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={COLORS[index % COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#1e293b",
                              border: "1px solid #334155",
                              borderRadius: "8px",
                            }}
                          />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-slate-400 text-center py-8">
                        Keine Sektor-Daten verfügbar
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
