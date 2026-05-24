import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { TradingViewWidget, HEATMAP_CONFIG } from "@/components/TradingViewWidget";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Grid3x3, Globe } from "lucide-react";

type DataSource = "SPX500" | "ETFHEATMAP" | "AllUSEtf";

const DATA_SOURCES: { value: DataSource; label: string; description: string }[] = [
  { value: "SPX500", label: "S&P 500", description: "US Large Caps nach Sektoren" },
  { value: "ETFHEATMAP", label: "ETF Heatmap", description: "Globale ETFs nach Kategorie" },
  { value: "AllUSEtf", label: "Alle US ETFs", description: "Vollständige US-ETF-Übersicht" },
];

export default function MarketHeatmap() {
  const [dataSource, setDataSource] = useState<DataSource>("SPX500");

  const config = {
    ...HEATMAP_CONFIG,
    dataSource,
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Grid3x3 className="w-6 h-6 text-[#00CFC1]" />
              Markt-Heatmap
            </h1>
            <p className="text-gray-400 mt-1">
              Visuelle Übersicht der Marktperformance nach Sektoren und Marktkapitalisierung
            </p>
          </div>
          <Globe className="w-8 h-8 text-gray-600" />
        </div>

        {/* Data Source Selector */}
        <Card className="bg-[#1a1f2e] border-gray-800">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm text-gray-400">Datenquelle:</span>
              {DATA_SOURCES.map((source) => (
                <Button
                  key={source.value}
                  variant={dataSource === source.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDataSource(source.value)}
                  className={dataSource === source.value 
                    ? "bg-[#00CFC1] text-black hover:bg-[#00b3a6]" 
                    : "border-gray-700 text-gray-300 hover:bg-gray-800"
                  }
                >
                  {source.label}
                </Button>
              ))}
              <span className="text-xs text-gray-500 ml-2">
                {DATA_SOURCES.find(s => s.value === dataSource)?.description}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Heatmap Widget */}
        <Card className="bg-[#1a1f2e] border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-white">
              {DATA_SOURCES.find(s => s.value === dataSource)?.label} — Sektoren-Heatmap
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <TradingViewWidget
              widgetType="stock-heatmap"
              config={config}
              height={600}
            />
          </CardContent>
        </Card>

        {/* Info */}
        <div className="text-xs text-gray-500 text-center">
          Daten bereitgestellt von TradingView. Farbe = Tagesperformance, Grösse = Marktkapitalisierung.
        </div>
      </div>
    </DashboardLayout>
  );
}
