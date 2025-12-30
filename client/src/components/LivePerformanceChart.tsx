import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

import { trpc } from "@/lib/trpc";

interface LivePerformanceChartProps {
  portfolioId: number;
  liveStartDate: Date | string;
}

export function LivePerformanceChart({ portfolioId, liveStartDate }: LivePerformanceChartProps) {
  // Determine start and end dates for hypothetical performance
  const creationDate = useMemo(() => {
    if (typeof liveStartDate === 'string') {
      return liveStartDate.split('T')[0];
    }
    return new Date(liveStartDate).toISOString().split('T')[0];
  }, [liveStartDate]);
  
  const yearStart = useMemo(() => {
    const year = new Date(creationDate).getFullYear();
    return `${year}-01-01`;
  }, [creationDate]);
  
  // Calculate the day before creation date for hypothetical performance end date
  const dayBeforeCreation = useMemo(() => {
    const date = new Date(creationDate);
    date.setDate(date.getDate() - 1);
    return date.toISOString().split('T')[0];
  }, [creationDate]);
  
  // Debug: Log the dates and enabled condition
  console.log('[LivePerformanceChart] Hypothetical query params:', {
    portfolioId,
    yearStart,
    creationDate,
    dayBeforeCreation,
    enabled: !!portfolioId && yearStart < creationDate,
    comparison: `${yearStart} < ${creationDate}`
  });
  
  // Fetch hypothetical performance BEFORE creation date (up to day before)
  const { data: hypotheticalData, isLoading: hypotheticalLoading, error: hypotheticalError } = trpc.portfolios.getHypotheticalPerformance.useQuery(
    { 
      portfolioId, 
      startDate: yearStart, 
      endDate: dayBeforeCreation,
      debug: true
    },
    { enabled: !!portfolioId && yearStart < dayBeforeCreation }
  );
  
  // Fetch historical performance data from backend using getHistoricalPerformance
  const { data: historyData, isLoading } = trpc.portfolios.getHistoricalPerformance.useQuery(
    { portfolioId, period: 'YTD', benchmark: 'SPY' },
    { enabled: !!portfolioId }
  );

  const chartData = useMemo(() => {
    if (!historyData || !historyData.chartData || historyData.chartData.length === 0) {
      return { labels: [], datasets: [], latestPerformance: 0, latestValue: 0, latestInvested: 0, creationDateIndex: -1 };
    }

    const realDataPoints = historyData.chartData;
    const hypotheticalPoints = hypotheticalData?.chartData || [];
    
    // Combine hypothetical and real data
    const allDataPoints = [...hypotheticalPoints, ...realDataPoints];
    
    // Format labels
    const labels = allDataPoints.map((dp: any) => {
      const date = new Date(dp.date);
      return date.toLocaleDateString('de-CH', { day: '2-digit', month: 'short' });
    });
    
    // Find the index where real data starts (creation date)
    const creationDateIndex = hypotheticalPoints.length;
    
    // Prepare performance data with separation
    const hypotheticalPerformanceData = hypotheticalPoints.map((dp: any) => dp.performance);
    const realPerformanceData = realDataPoints.map((dp: any) => dp.portfolio);
    
    // For hypothetical line: show data before creation date, null after
    const hypotheticalLineData = [
      ...hypotheticalPerformanceData,
      ...Array(realPerformanceData.length).fill(null)
    ];
    
    // For real line: null before creation date, data after
    const realLineData = [
      ...Array(hypotheticalPerformanceData.length).fill(null),
      ...realPerformanceData
    ];

    const valueData = historyData.totalValueHistory?.map((v: any) => v.value) || realDataPoints.map(() => 0);
    const investedData = realDataPoints.map(() => 100); // Base value

    // Get latest values for legend
    const latestPerformance = realPerformanceData[realPerformanceData.length - 1] || 0;
    const latestValue = valueData[valueData.length - 1] || 0;
    const latestInvested = investedData[investedData.length - 1] || 0;

    return {
      labels,
      latestPerformance,
      latestValue,
      latestInvested,
      creationDateIndex,
      datasets: [
        // Hypothetical performance (before creation date) - dashed line
        {
          label: "Hypothetische Performance (%)",
          data: hypotheticalLineData,
          borderColor: "rgba(59, 130, 246, 0.5)",
          backgroundColor: "rgba(59, 130, 246, 0.05)",
          borderWidth: 2,
          borderDash: [5, 5],
          fill: false,
          tension: 0.4,
          yAxisID: "y",
          pointRadius: 0,
        },
        // Real performance (after creation date) - solid line
        {
          label: "Performance (%)",
          data: realLineData,
          borderColor: "rgb(59, 130, 246)",
          backgroundColor: "rgba(59, 130, 246, 0.1)",
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          yAxisID: "y",
          pointRadius: 0,
        },
        {
          label: "Portfolio-Wert (CHF)",
          data: [...Array(hypotheticalPerformanceData.length).fill(null), ...valueData],
          borderColor: "rgb(34, 197, 94)",
          backgroundColor: "rgba(34, 197, 94, 0.1)",
          borderWidth: 2,
          fill: false,
          tension: 0.4,
          yAxisID: "y1",
          pointRadius: 0,
        },
        {
          label: "Investiert (CHF)",
          data: [...Array(hypotheticalPerformanceData.length).fill(null), ...investedData],
          borderColor: "rgb(148, 163, 184)",
          backgroundColor: "rgba(148, 163, 184, 0.1)",
          borderWidth: 1,
          borderDash: [5, 5],
          fill: false,
          tension: 0.4,
          yAxisID: "y1",
          pointRadius: 0,
        }
      ]
    };
  }, [historyData, hypotheticalData]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index" as const,
      intersect: false
    },
    plugins: {
      legend: {
        display: false  // Hide default legend, we'll use custom legend
      },
      tooltip: {
        backgroundColor: "rgba(15, 23, 42, 0.9)",
        titleColor: "rgb(226, 232, 240)",
        bodyColor: "rgb(203, 213, 225)",
        borderColor: "rgb(71, 85, 105)",
        borderWidth: 1,
        padding: 12,
        displayColors: true
      }
    },
    scales: {
      x: {
        grid: {
          color: "rgba(71, 85, 105, 0.3)"
        },
        ticks: {
          color: "rgb(148, 163, 184)",
          font: {
            size: 11
          }
        }
      },
      y: {
        type: "linear" as const,
        display: true,
        position: "left" as const,
        title: {
          display: true,
          text: "Performance (%)",
          color: "rgb(203, 213, 225)"
        },
        grid: {
          color: "rgba(71, 85, 105, 0.3)"
        },
        ticks: {
          color: "rgb(148, 163, 184)",
          callback: function(value: any) {
            return value.toFixed(1) + "%";
          }
        }
      },
      y1: {
        type: "linear" as const,
        display: true,
        position: "right" as const,
        title: {
          display: true,
          text: "Wert (CHF)",
          color: "rgb(203, 213, 225)"
        },
        grid: {
          drawOnChartArea: false
        },
        ticks: {
          color: "rgb(148, 163, 184)",
          callback: function(value: any) {
            return "CHF " + value.toLocaleString('de-CH');
          }
        }
      }
    }
  };

  if (isLoading || hypotheticalLoading) {
    return (
      <Card className="bg-slate-800 border-slate-700">
        <CardContent className="p-8 text-center text-slate-400">
          <div className="flex flex-col items-center gap-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
            <p>Lade Performance-Daten...</p>
            {hypotheticalLoading && (
              <p className="text-xs text-slate-500">Historische Daten werden geladen...</p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (chartData.labels.length === 0) {
    return (
      <Card className="bg-slate-800 border-slate-700">
        <CardContent className="p-8 text-center text-slate-400">
          Keine Daten für Performance-Chart verfügbar
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white">Live Performance</CardTitle>
        <p className="text-slate-400 text-sm">
          Seit {new Date(liveStartDate).toLocaleDateString('de-CH', { day: '2-digit', month: 'long', year: 'numeric' })}
        </p>
      </CardHeader>
      <CardContent>
        <div className="bg-slate-900/50 rounded-lg p-4">
          <div className="h-80">
            <Line data={chartData} options={options} />
          </div>
          
          {/* Hypothetical Data Warning */}
          {hypotheticalError && (
            <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-600/30 rounded-lg">
              <p className="text-yellow-400 text-xs text-center">
                ⚠️ Historische Daten nicht verfügbar. Die hypothetische Performance kann nicht berechnet werden.
              </p>
            </div>
          )}
          
          {hypotheticalData && hypotheticalData.chartData.length === 0 && yearStart < creationDate && (
            <div className="mt-4 p-3 bg-blue-900/20 border border-blue-600/30 rounded-lg">
              <p className="text-blue-400 text-xs text-center">
                ℹ️ Historische Preisdaten werden noch importiert. Die hypothetische Performance wird nach dem Import angezeigt.
              </p>
            </div>
          )}
          
          {/* Custom Legend */}
          <div className="mt-4 flex items-center justify-center gap-6 text-sm flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 bg-blue-400"></div>
              <span className="text-slate-300">Performance</span>
              <span className={`font-semibold ml-1 ${chartData.latestPerformance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {chartData.latestPerformance >= 0 ? '+' : ''}{chartData.latestPerformance.toFixed(2)}%
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 bg-green-500"></div>
              <span className="text-slate-300">Portfolio-Wert</span>
              <span className="font-semibold ml-1 text-slate-200">
                CHF {chartData.latestValue.toLocaleString('de-CH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 bg-slate-400 opacity-50" style={{ borderTop: '1px dashed rgb(148, 163, 184)' }}></div>
              <span className="text-slate-300">Investiert</span>
              <span className="font-semibold ml-1 text-slate-200">
                CHF {chartData.latestInvested.toLocaleString('de-CH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
