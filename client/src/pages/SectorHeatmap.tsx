import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Activity, TrendingUp, TrendingDown, Minus, BarChart3 } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useState } from "react";

type TimeFrame = '1d' | '1w' | '1m' | 'ytd';

function getHeatColor(value: number): string {
  // Green for positive, red for negative, intensity based on magnitude
  if (value > 3) return 'bg-emerald-600 text-white';
  if (value > 2) return 'bg-emerald-500 text-white';
  if (value > 1) return 'bg-emerald-400 text-white';
  if (value > 0.5) return 'bg-emerald-300 text-emerald-900';
  if (value > 0) return 'bg-emerald-100 text-emerald-800';
  if (value === 0) return 'bg-zinc-100 text-zinc-600';
  if (value > -0.5) return 'bg-red-100 text-red-800';
  if (value > -1) return 'bg-red-300 text-red-900';
  if (value > -2) return 'bg-red-400 text-white';
  if (value > -3) return 'bg-red-500 text-white';
  return 'bg-red-600 text-white';
}

function getPerformanceIcon(value: number) {
  if (value > 0.2) return <TrendingUp className="w-4 h-4" />;
  if (value < -0.2) return <TrendingDown className="w-4 h-4" />;
  return <Minus className="w-4 h-4" />;
}

export default function SectorHeatmap() {
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('1m');
  const { data: sectors, isLoading, error } = trpc.marketRegime.sectorPerformance.useQuery();

  const getPerformanceValue = (sector: any): number => {
    switch (timeFrame) {
      case '1d': return sector.performance1d;
      case '1w': return sector.performance1w;
      case '1m': return sector.performance1m;
      case 'ytd': return sector.performanceYtd;
      default: return sector.performance1m;
    }
  };

  const sortedSectors = sectors
    ? [...sectors].sort((a, b) => getPerformanceValue(b) - getPerformanceValue(a))
    : [];

  const timeFrameLabels: Record<TimeFrame, string> = {
    '1d': '1 Tag',
    '1w': '1 Woche',
    '1m': '1 Monat',
    'ytd': 'YTD',
  };

  return (
    <DashboardLayout>
      <div className="container py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-primary" />
              Sektor-Heatmap
            </h1>
            <p className="text-muted-foreground mt-1">
              Performance der 11 GICS-Sektoren (S&P 500 Sektor-ETFs via EODHD)
            </p>
          </div>
        </div>

        {/* Timeframe Selector */}
        <div className="flex gap-2">
          {(Object.keys(timeFrameLabels) as TimeFrame[]).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeFrame(tf)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                timeFrame === tf
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {timeFrameLabels[tf]}
            </button>
          ))}
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 11 }).map((_, i) => (
              <div key={i} className="h-32 bg-muted animate-pulse rounded-xl" />
            ))}
          </div>
        )}

        {/* Error State */}
        {error && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <p className="text-destructive">Fehler beim Laden der Sektordaten: {error.message}</p>
            </CardContent>
          </Card>
        )}

        {/* Heatmap Grid */}
        {sortedSectors.length > 0 && (
          <>
            {/* Visual Heatmap */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {sortedSectors.map((sector) => {
                const perf = getPerformanceValue(sector);
                const colorClass = getHeatColor(perf);
                return (
                  <Tooltip key={sector.sector}>
                    <TooltipTrigger asChild>
                      <div
                        className={`rounded-xl p-4 cursor-pointer transition-transform hover:scale-105 ${colorClass}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium opacity-80">{sector.etf.replace('.US', '')}</span>
                          {getPerformanceIcon(perf)}
                        </div>
                        <div className="font-bold text-lg">{sector.sector}</div>
                        <div className="text-2xl font-black mt-1">
                          {perf >= 0 ? '+' : ''}{perf.toFixed(2)}%
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs">
                      <div className="space-y-1 text-sm">
                        <p className="font-bold">{sector.sector} ({sector.etf})</p>
                        <p>Kurs: ${sector.currentPrice.toFixed(2)}</p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mt-1">
                          <span>1 Tag:</span><span className={sector.performance1d >= 0 ? 'text-emerald-500' : 'text-red-500'}>{sector.performance1d >= 0 ? '+' : ''}{sector.performance1d.toFixed(2)}%</span>
                          <span>1 Woche:</span><span className={sector.performance1w >= 0 ? 'text-emerald-500' : 'text-red-500'}>{sector.performance1w >= 0 ? '+' : ''}{sector.performance1w.toFixed(2)}%</span>
                          <span>1 Monat:</span><span className={sector.performance1m >= 0 ? 'text-emerald-500' : 'text-red-500'}>{sector.performance1m >= 0 ? '+' : ''}{sector.performance1m.toFixed(2)}%</span>
                          <span>YTD:</span><span className={sector.performanceYtd >= 0 ? 'text-emerald-500' : 'text-red-500'}>{sector.performanceYtd >= 0 ? '+' : ''}{sector.performanceYtd.toFixed(2)}%</span>
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>

            {/* Performance Table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Sektor-Performance Übersicht
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3 font-medium">Sektor</th>
                        <th className="text-left py-2 px-3 font-medium">ETF</th>
                        <th className="text-right py-2 px-3 font-medium">Kurs</th>
                        <th className="text-right py-2 px-3 font-medium">1 Tag</th>
                        <th className="text-right py-2 px-3 font-medium">1 Woche</th>
                        <th className="text-right py-2 px-3 font-medium">1 Monat</th>
                        <th className="text-right py-2 px-3 font-medium">YTD</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedSectors.map((sector) => (
                        <tr key={sector.sector} className="border-b last:border-0 hover:bg-muted/50">
                          <td className="py-2.5 px-3 font-medium">{sector.sector}</td>
                          <td className="py-2.5 px-3">
                            <Badge variant="outline" className="text-xs">{sector.etf.replace('.US', '')}</Badge>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono">${sector.currentPrice.toFixed(2)}</td>
                          <td className={`py-2.5 px-3 text-right font-mono ${sector.performance1d >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {sector.performance1d >= 0 ? '+' : ''}{sector.performance1d.toFixed(2)}%
                          </td>
                          <td className={`py-2.5 px-3 text-right font-mono ${sector.performance1w >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {sector.performance1w >= 0 ? '+' : ''}{sector.performance1w.toFixed(2)}%
                          </td>
                          <td className={`py-2.5 px-3 text-right font-mono ${sector.performance1m >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {sector.performance1m >= 0 ? '+' : ''}{sector.performance1m.toFixed(2)}%
                          </td>
                          <td className={`py-2.5 px-3 text-right font-mono ${sector.performanceYtd >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {sector.performanceYtd >= 0 ? '+' : ''}{sector.performanceYtd.toFixed(2)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Legend */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Farbskala:</span>
              <div className="flex gap-0.5">
                <div className="w-6 h-4 rounded bg-red-600" />
                <div className="w-6 h-4 rounded bg-red-400" />
                <div className="w-6 h-4 rounded bg-red-200" />
                <div className="w-6 h-4 rounded bg-zinc-100" />
                <div className="w-6 h-4 rounded bg-emerald-200" />
                <div className="w-6 h-4 rounded bg-emerald-400" />
                <div className="w-6 h-4 rounded bg-emerald-600" />
              </div>
              <span>-3% bis +3%</span>
              <span className="ml-4">Datenquelle: EODHD (Sektor-ETFs)</span>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
