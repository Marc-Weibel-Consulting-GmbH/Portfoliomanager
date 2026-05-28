import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Globe, Activity, BarChart3, Newspaper, Calendar, TrendingUp } from "lucide-react";
import { useLocation } from "wouter";
import { TradingViewWidget, MARKET_OVERVIEW_CONFIG, MARKET_QUOTES_CONFIG, TICKER_TAPE_CONFIG, HEATMAP_CONFIG } from "@/components/TradingViewWidget";

// Lazy load heavy sub-pages (these components have their own DashboardLayout, so we use a wrapper)
// For now, we'll embed content directly since these pages wrap in DashboardLayout
import MarketRegimeContent from "./MarketRegimeContent";
import NewsroomContent from "./Newsroom";
import MarktScanner from "@/components/market/MarktScanner";

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-6 h-6 border-2 border-[#00CFC1] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// Index KPI cards per spec
function IndexKpiRow() {
  const { data: regimeData } = trpc.marketRegime.getRegime.useQuery(undefined, {
    staleTime: 60000,
    retry: 1,
  });

  const indices = [
    { label: "SMI", value: "11'842", change: "+6.4%", positive: true },
    { label: "S&P 500", value: "5'820", change: "-0.2%", positive: false },
    { label: "MSCI WORLD", value: "3'412", change: "+8.9%", positive: true },
    { label: "GOLD (USD)", value: "2'418", change: "+6.4%", positive: true },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {indices.map((idx) => (
        <Card key={idx.label} className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/20 border-t-2 border-t-[#00CFC1]">
          <CardContent className="p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider">{idx.label}</p>
            <p className="text-xl font-bold font-mono text-white mt-1">{idx.value}</p>
            <p className={`text-sm font-mono mt-1 ${idx.positive ? 'text-[#00CFC1]' : 'text-red-400'}`}>
              {idx.change}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Heatmap content
function HeatmapContent() {
  const [dataSource, setDataSource] = useState<"SPX500" | "ETFHEATMAP" | "AllUSEtf">("SPX500");
  const sources = [
    { value: "SPX500" as const, label: "S&P 500" },
    { value: "ETFHEATMAP" as const, label: "ETF Heatmap" },
    { value: "AllUSEtf" as const, label: "Alle US ETFs" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {sources.map((s) => (
          <button
            key={s.value}
            onClick={() => setDataSource(s.value)}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${
              dataSource === s.value
                ? 'bg-[#00CFC1]/20 text-[#00CFC1] font-medium'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/20">
        <CardContent className="p-0">
          <TradingViewWidget
            widgetType="stock-heatmap"
            config={{ ...HEATMAP_CONFIG, dataSource }}
            height={600}
          />
        </CardContent>
      </Card>
    </div>
  );
}

// Overview tab content
function OverviewContent() {
  return (
    <div className="space-y-6">
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
        <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/20">
          <CardContent className="p-0">
            <TradingViewWidget
              widgetType="market-overview"
              config={MARKET_OVERVIEW_CONFIG}
              height={500}
            />
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/20">
          <CardContent className="p-0">
            <TradingViewWidget
              widgetType="market-quotes"
              config={MARKET_QUOTES_CONFIG}
              height={500}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function MarktHub() {
  const searchString = typeof window !== 'undefined' ? window.location.search : '';
  const searchParams = new URLSearchParams(searchString);
  const urlTab = searchParams.get('tab') || 'overview';
  const [activeMarktTab, setActiveMarktTab] = useState(urlTab);
  const [, navigate] = useLocation();
  
  const handleMarktTabChange = (tab: string) => {
    setActiveMarktTab(tab);
    const newSearch = tab === 'overview' ? '' : `?tab=${tab}`;
    navigate(`/markt${newSearch}`, { replace: true });
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header per IA-Spec */}
        <div>
          <p className="text-xs font-medium text-[#00CFC1] uppercase tracking-widest mb-1">MARKT</p>
          <h1 className="text-2xl font-bold text-white">Markt-Hub</h1>
          <p className="text-sm text-gray-400 mt-1">
            Marktregime · Heatmap · News · Dividenden-Kalender — alles in einer Page.
          </p>
        </div>

        {/* Index KPIs */}
        <IndexKpiRow />

        {/* Tabs per IA-Spec: Übersicht | Regime | Heatmap | News | Dividenden-Kalender */}
        <Tabs value={activeMarktTab} onValueChange={handleMarktTabChange} className="w-full">
          <TabsList className="flex flex-wrap gap-0 bg-transparent border-b border-white/10 p-0 h-auto rounded-none">
            {[
              { value: 'overview', label: 'Übersicht', icon: Globe },
              { value: 'regime', label: 'Regime', icon: Activity },
              { value: 'bull', label: 'Bull', icon: TrendingUp },
              { value: 'heatmap', label: 'Heatmap', icon: BarChart3 },
              { value: 'news', label: 'News', icon: Newspaper },
              { value: 'dividends', label: 'Dividenden-Kalender', icon: Calendar },
              { value: 'scanner', label: 'Scanner', icon: Activity },
            ].map(tab => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#00CFC1] data-[state=active]:text-[#00CFC1] data-[state=active]:bg-transparent text-gray-400 text-sm px-4 pb-3 pt-2 gap-1.5"
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <OverviewContent />
          </TabsContent>

          <TabsContent value="regime" className="mt-6">
            <MarketRegimeContent />
          </TabsContent>

          <TabsContent value="bull" className="mt-6">
            <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/20">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-white mb-2">Bull/Bear-Indikator</h3>
                <p className="text-gray-400 text-sm">
                  Marktbreite-Analyse und Bull/Bear-Signale basierend auf dem aktuellen Regime.
                </p>
                <MarketRegimeContent />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="heatmap" className="mt-6">
            <HeatmapContent />
          </TabsContent>

          <TabsContent value="news" className="mt-6">
            <NewsroomContent />
          </TabsContent>

          <TabsContent value="dividends" className="mt-6">
            <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/20">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-white mb-3">Dividenden-Kalender</h3>
                <p className="text-gray-400 text-sm">Kommende Ex-Dividenden-Termine und Ausschüttungen deiner Positionen.</p>
                <div className="mt-4 text-center">
                  <a href="/dividends" className="text-[#00CFC1] hover:underline text-sm">Vollständigen Kalender öffnen →</a>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="scanner" className="mt-6">
            <MarktScanner />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
