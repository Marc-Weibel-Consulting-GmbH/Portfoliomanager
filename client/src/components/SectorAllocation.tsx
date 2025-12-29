import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface SectorAllocationProps {
  holdings: Array<{
    ticker: string;
    name?: string;
    sector?: string;
    currentValueCHF?: number;
    shares?: number;
    currentPrice?: number;
  }>;
  totalValue: number;
}

// Predefined colors for sectors
const SECTOR_COLORS: Record<string, string> = {
  "Technology": "#3b82f6",
  "Healthcare": "#22c55e",
  "Financial Services": "#f59e0b",
  "Consumer Cyclical": "#ec4899",
  "Consumer Defensive": "#8b5cf6",
  "Industrials": "#6366f1",
  "Energy": "#ef4444",
  "Utilities": "#14b8a6",
  "Real Estate": "#f97316",
  "Basic Materials": "#84cc16",
  "Communication Services": "#06b6d4",
  "Other": "#64748b",
};

const DEFAULT_COLORS = [
  "#3b82f6", "#22c55e", "#f59e0b", "#ec4899", "#8b5cf6",
  "#6366f1", "#ef4444", "#14b8a6", "#f97316", "#84cc16"
];

export function SectorAllocation({ holdings, totalValue }: SectorAllocationProps) {
  const sectorData = useMemo(() => {
    const sectorMap: Record<string, { value: number; stocks: string[] }> = {};
    
    holdings.forEach((holding) => {
      const sector = holding.sector || "Other";
      const value = holding.currentValueCHF || (holding.shares || 0) * (holding.currentPrice || 0);
      
      if (!sectorMap[sector]) {
        sectorMap[sector] = { value: 0, stocks: [] };
      }
      sectorMap[sector].value += value;
      sectorMap[sector].stocks.push(holding.ticker);
    });

    // Convert to array and calculate percentages
    const data = Object.entries(sectorMap)
      .map(([name, { value, stocks }]) => ({
        name,
        value,
        percentage: totalValue > 0 ? (value / totalValue) * 100 : 0,
        stocks,
        color: SECTOR_COLORS[name] || DEFAULT_COLORS[Object.keys(sectorMap).indexOf(name) % DEFAULT_COLORS.length]
      }))
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value);

    return data;
  }, [holdings, totalValue]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 shadow-lg">
          <p className="font-semibold text-white">{data.name}</p>
          <p className="text-sm text-muted-foreground">
            CHF {Math.round(data.value).toLocaleString('de-CH')}
          </p>
          <p className="text-sm text-cyan-400">{data.percentage.toFixed(1)}%</p>
          <p className="text-xs text-muted-foreground mt-1">
            {data.stocks.join(", ")}
          </p>
        </div>
      );
    }
    return null;
  };

  const renderLegend = () => {
    return (
      <div className="grid grid-cols-2 gap-2 mt-4">
        {sectorData.map((entry, index) => (
          <div key={index} className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full flex-shrink-0" 
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-xs text-muted-foreground truncate">
              {entry.name}
            </span>
            <span className="text-xs text-white font-medium ml-auto">
              {entry.percentage.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    );
  };

  if (sectorData.length === 0) {
    return (
      <Card className="gradient-card border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-white text-sm">Sektor-Allokation</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            Keine Sektor-Daten verfügbar
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="gradient-card border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-white text-sm">Sektor-Allokation</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={sectorData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {sectorData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        {renderLegend()}
      </CardContent>
    </Card>
  );
}
