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

interface LivePerformanceChartProps {
  transactions: Array<{
    transactionDate: Date | string;
    transactionType: string;
    totalAmount: string;
  }>;
  currentValue: number;
  liveStartDate: Date | string;
}

export function LivePerformanceChart({ transactions, currentValue, liveStartDate }: LivePerformanceChartProps) {
  const chartData = useMemo(() => {
    if (transactions.length === 0) {
      return { labels: [], datasets: [] };
    }

    // Sort transactions by date
    const sortedTransactions = [...transactions].sort(
      (a, b) => new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime()
    );

    // Calculate cumulative invested capital and portfolio value over time
    const dataPoints: Array<{ date: Date; invested: number; value: number; performance: number }> = [];
    let cumulativeInvested = 0;
    let cumulativeValue = 0;

    sortedTransactions.forEach((tx, index) => {
      const amount = parseFloat(tx.totalAmount);
      
      // Update cumulative invested (deposits and buys increase, withdrawals and sells decrease)
      if (tx.transactionType === "buy" || tx.transactionType === "deposit") {
        cumulativeInvested += Math.abs(amount);
      } else if (tx.transactionType === "sell" || tx.transactionType === "withdrawal") {
        cumulativeInvested -= Math.abs(amount);
      }
      // Dividends don't change invested capital

      // Estimate portfolio value at this point
      // For simplicity, assume linear growth between start and current value
      const progress = index / (sortedTransactions.length - 1 || 1);
      cumulativeValue = cumulativeInvested + (currentValue - cumulativeInvested) * progress;

      // Calculate performance percentage
      const performance = cumulativeInvested > 0 
        ? ((cumulativeValue / cumulativeInvested) - 1) * 100 
        : 0;

      dataPoints.push({
        date: new Date(tx.transactionDate),
        invested: cumulativeInvested,
        value: cumulativeValue,
        performance
      });
    });

    // Add current value as final data point
    dataPoints.push({
      date: new Date(),
      invested: cumulativeInvested,
      value: currentValue,
      performance: cumulativeInvested > 0 ? ((currentValue / cumulativeInvested) - 1) * 100 : 0
    });

    // Format labels and data
    const labels = dataPoints.map(dp => 
      dp.date.toLocaleDateString('de-CH', { day: '2-digit', month: 'short' })
    );

    const performanceData = dataPoints.map(dp => dp.performance);
    const valueData = dataPoints.map(dp => dp.value);
    const investedData = dataPoints.map(dp => dp.invested);

    return {
      labels,
      datasets: [
        {
          label: "Performance (%)",
          data: performanceData,
          borderColor: "rgb(59, 130, 246)",
          backgroundColor: "rgba(59, 130, 246, 0.1)",
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          yAxisID: "y"
        },
        {
          label: "Portfolio-Wert (CHF)",
          data: valueData,
          borderColor: "rgb(34, 197, 94)",
          backgroundColor: "rgba(34, 197, 94, 0.1)",
          borderWidth: 2,
          fill: false,
          tension: 0.4,
          yAxisID: "y1"
        },
        {
          label: "Investiert (CHF)",
          data: investedData,
          borderColor: "rgb(148, 163, 184)",
          backgroundColor: "rgba(148, 163, 184, 0.1)",
          borderWidth: 1,
          borderDash: [5, 5],
          fill: false,
          tension: 0.4,
          yAxisID: "y1"
        }
      ]
    };
  }, [transactions, currentValue]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index" as const,
      intersect: false
    },
    plugins: {
      legend: {
        position: "top" as const,
        labels: {
          color: "rgb(203, 213, 225)",
          font: {
            size: 12
          }
        }
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
        <div className="h-80">
          <Line data={chartData} options={options} />
        </div>
      </CardContent>
    </Card>
  );
}
