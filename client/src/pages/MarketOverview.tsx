import DashboardLayout from "@/components/DashboardLayout";
import { TradingViewWidget, MARKET_OVERVIEW_CONFIG, MARKET_QUOTES_CONFIG, TICKER_TAPE_CONFIG } from "@/components/TradingViewWidget";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Globe, BarChart3, TrendingUp } from "lucide-react";

export default function MarketOverview() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Globe className="w-6 h-6 text-[#00CFC1]" />
            Marktüberblick
          </h1>
          <p className="text-gray-400 mt-1">
            Echtzeit-Marktdaten, Indizes und Top-Aktien auf einen Blick
          </p>
        </div>

        {/* Ticker Tape */}
        <Card className="bg-[#1a1f2e] border-gray-800 overflow-hidden">
          <CardContent className="p-0">
            <TradingViewWidget
              widgetType="ticker-tape"
              config={TICKER_TAPE_CONFIG}
              height={46}
            />
          </CardContent>
        </Card>

        {/* Market Overview + Quotes Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Market Overview */}
          <Card className="bg-[#1a1f2e] border-gray-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-[#00CFC1]" />
                Sektoren & Indizes
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <TradingViewWidget
                widgetType="market-overview"
                config={MARKET_OVERVIEW_CONFIG}
                height={500}
              />
            </CardContent>
          </Card>

          {/* Market Quotes */}
          <Card className="bg-[#1a1f2e] border-gray-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-[#00CFC1]" />
                Kursliste
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <TradingViewWidget
                widgetType="market-quotes"
                config={MARKET_QUOTES_CONFIG}
                height={500}
              />
            </CardContent>
          </Card>
        </div>

        {/* Info */}
        <div className="text-xs text-gray-500 text-center">
          Echtzeit-Daten bereitgestellt von TradingView. Kurse können um bis zu 15 Minuten verzögert sein.
        </div>
      </div>
    </DashboardLayout>
  );
}
