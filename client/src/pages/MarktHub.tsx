import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { formatNumber } from "@/lib/format";
import { Globe, Activity, BarChart3, Newspaper, AlertTriangle } from "lucide-react";
import { useLocation } from "wouter";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { TradingViewWidget, MARKET_OVERVIEW_CONFIG, MARKET_QUOTES_CONFIG, TICKER_TAPE_CONFIG, HEATMAP_CONFIG } from "@/components/TradingViewWidget";

import MarketRegimeContent from "./MarketRegimeContent";
import { KiBoomDashboard } from "@/components/markt/KiBoomDashboard";
import NewsroomContent from "./Newsroom";
import { TickerBar, KIAnalyse } from "@/components/dashboard/MarketSections";
import { useState as useStateAlias } from "react";
import ReactMarkdown from "react-markdown";

// Tägliches Manus Momentum-Update Bericht-Widget
function MarketReportSection() {
  const { data: report, isLoading, isError, refetch } = trpc.marketReport.getLatest.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  const { data: reportList } = trpc.marketReport.list.useQuery({ limit: 7 }, {
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  const [selectedId, setSelectedId] = useStateAlias<number | null>(null);
  const [expanded, setExpanded] = useStateAlias(false);

  const selectedReport = selectedId
    ? reportList?.find((r: any) => r.id === selectedId)
    : report;

  if (isLoading) {
    return (
      <div className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border border-[#00CFC1]/20 rounded-lg p-5">
        <div className="h-4 w-48 bg-white/10 rounded animate-pulse mb-3" />
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-3 bg-white/10 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border border-red-500/20 rounded-lg p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-semibold text-[#00CFC1] uppercase tracking-widest">TÄGLICHES MARKT-UPDATE</span>
          <button onClick={() => refetch()} className="text-xs text-red-400 hover:text-red-300 transition-colors underline">Erneut versuchen</button>
        </div>
        <p className="text-sm text-red-400">Bericht konnte nicht geladen werden. Bitte später erneut versuchen.</p>
      </div>
    );
  }

  if (!selectedReport && !report) {
    return (
      <div className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border border-[#00CFC1]/20 rounded-lg p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] font-semibold text-[#00CFC1] uppercase tracking-widest">TÄGLICHES MARKT-UPDATE</span>
        </div>
        <p className="text-sm text-gray-500">Noch kein Bericht verfügbar. Der tägliche Manus-Task liefert den Bericht um 08:00 Uhr.</p>
      </div>
    );
  }

  const displayReport = selectedReport ?? report;
  const reportDateStr = displayReport?.reportDate
    ? new Date(displayReport.reportDate + "T00:00:00").toLocaleDateString("de-CH", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : "";

  return (
    <div className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border border-[#00CFC1]/20 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/10">
        <div>
          <span className="text-[10px] font-semibold text-[#00CFC1] uppercase tracking-widest">TÄGLICHES MARKT-UPDATE</span>
          <h3 className="text-sm font-semibold text-white mt-0.5">{displayReport?.title}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{reportDateStr} · Quelle: Manus KI-Analyse</p>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-[#00CFC1] hover:text-[#00CFC1]/80 transition-colors"
        >
          {expanded ? "Weniger" : "Vollständig lesen"}
        </button>
      </div>

      {/* Content */}
      <div className="px-5 py-4">
        <div className={`prose prose-invert prose-sm max-w-none text-gray-300 ${
          expanded ? "" : "line-clamp-6"
        }`}>
          <ReactMarkdown>{displayReport?.content ?? ""}</ReactMarkdown>
        </div>
      </div>

      {/* Archiv */}
      {reportList && reportList.length > 1 && (
        <div className="px-5 pb-4 border-t border-white/10 pt-3">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-2">Archiv</p>
          <div className="flex flex-wrap gap-2">
            {reportList.map((r: any) => (
              <button
                key={r.id}
                onClick={() => setSelectedId(r.id === selectedId ? null : r.id)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  (selectedId === r.id || (!selectedId && r.id === report?.id))
                    ? "border-[#00CFC1] text-[#00CFC1] bg-[#00CFC1]/10"
                    : "border-white/20 text-gray-400 hover:border-white/40"
                }`}
              >
                {new Date(r.reportDate + "T00:00:00").toLocaleDateString("de-CH", { day: "numeric", month: "short" })}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Index-KPIs (Mockup S.13): echte Werte aus marketRegime.getIndices (SPI/S&P/MSCI/Gold)
function IndexKpiRow() {
  const { data, isLoading } = trpc.marketRegime.getIndices.useQuery(undefined, { staleTime: 60000, retry: 1 });
  const indices = data?.indices ?? [];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border border-white/10 rounded-lg overflow-hidden">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-[#0f1420] p-5 border-r border-white/10 last:border-r-0">
            <div className="h-3 w-12 bg-white/10 rounded mb-3 animate-pulse" />
            <div className="h-6 w-20 bg-white/10 rounded animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border border-white/10 rounded-lg overflow-hidden">
      {indices.map((idx: any, i: number) => {
        const positive = (idx.dayChange ?? 0) >= 0;
        return (
          <div key={idx.key} className={`bg-[#0f1420] p-5 ${i < indices.length - 1 ? "border-r border-white/10" : ""}`}>
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-2">{idx.label}</p>
            <p className="text-2xl font-bold font-mono text-white">
              {idx.value !== null ? formatNumber(idx.value) : "—"}
            </p>
            <p className={`text-xs font-mono mt-1 ${idx.dayChange === null ? "text-gray-500" : positive ? "text-[#00CFC1]" : "text-red-400"}`}>
              {idx.dayChange === null ? "—" : `${positive ? "+" : ""}${idx.dayChange.toFixed(1)}%`}
              {idx.ytd !== null && <span className="text-gray-400" title="YTD = seit Jahresbeginn"> · YTD {idx.ytd >= 0 ? "+" : ""}{idx.ytd.toFixed(1)}%</span>}
            </p>
          </div>
        );
      })}
    </div>
  );
}

// Indizes Performance YTD Chart (Mockup S.13)
function IndicesYtdChart() {
  const { data, isLoading } = trpc.marketRegime.getIndices.useQuery(undefined, { staleTime: 60000, retry: 1 });
  const chart = data?.chart ?? [];

  return (
    <div className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border border-[#00CFC1]/20 rounded-lg p-5">
      <h3 className="text-sm font-semibold text-white mb-4" title="YTD = seit Jahresbeginn">Indizes – Performance seit Jahresbeginn (YTD)</h3>
      <div className="h-72">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-5 h-5 border-2 border-[#00CFC1] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : chart.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500 text-sm">Keine Index-Daten verfügbar</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chart} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="smiGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00CFC1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#00CFC1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" vertical={false} />
              <XAxis dataKey="date" stroke="#444" fontSize={10} tickLine={false} axisLine={false}
                tickFormatter={(d) => new Date(d).toLocaleDateString("de-CH", { month: "short" })} minTickGap={40} />
              <YAxis stroke="#444" fontSize={10} tickFormatter={(v) => `${v.toFixed(0)}%`} tickLine={false} axisLine={false} width={40} />
              <Tooltip
                contentStyle={{ backgroundColor: "#1a1f2e", border: "1px solid #00CFC1", borderRadius: "6px", fontSize: "12px" }}
                labelStyle={{ color: "#fff" }}
                formatter={(value: number, name: string) => [`${value.toFixed(2)}%`, name === "smi" ? "SPI" : name === "sp500" ? "S&P 500" : "MSCI World"]}
              />
              <Area type="monotone" dataKey="smi" stroke="#00CFC1" strokeWidth={2} fill="url(#smiGrad)" />
              <Area type="monotone" dataKey="sp500" stroke="rgba(255,255,255,0.4)" strokeWidth={1.5} strokeDasharray="4 4" fill="none" />
              <Area type="monotone" dataKey="msci" stroke="#6366f1" strokeWidth={1.5} fill="none" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="flex gap-4 justify-center mt-2 text-xs text-gray-400">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#00CFC1] inline-block" /> SPI</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-white/40 inline-block" /> S&amp;P 500</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" /> MSCI World</span>
      </div>
    </div>
  );
}

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
              dataSource === s.value ? "bg-[#00CFC1]/20 text-[#00CFC1] font-medium" : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/20">
        <CardContent className="p-0">
          <TradingViewWidget widgetType="stock-heatmap" config={{ ...HEATMAP_CONFIG, dataSource }} height={600} />
        </CardContent>
      </Card>
    </div>
  );
}

function OverviewContent() {
  return (
    <div className="space-y-6">
      {/* Aus dem früheren Dashboard/Portfolios-Bereich hierher verschoben */}
      <TickerBar />
      {/* Tägliches Manus Momentum-Update Bericht */}
      <MarketReportSection />
      <IndicesYtdChart />
      <KIAnalyse />
      <Card className="bg-[#1a1f2e] border-gray-800 overflow-hidden">
        <CardContent className="p-0">
          <TradingViewWidget widgetType="ticker-tape" config={TICKER_TAPE_CONFIG} height={46} />
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/20">
          <CardContent className="p-0">
            <TradingViewWidget widgetType="market-overview" config={MARKET_OVERVIEW_CONFIG} height={500} />
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/20">
          <CardContent className="p-0">
            <TradingViewWidget widgetType="market-quotes" config={MARKET_QUOTES_CONFIG} height={500} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

const LEGACY_TAB_MAP: Record<string, string> = {
  overview: "ueberblick", bull: "regime", scanner: "ueberblick",
};

export default function MarktHub() {
  const searchString = typeof window !== "undefined" ? window.location.search : "";
  const rawTab = new URLSearchParams(searchString).get("tab") || "ueberblick";
  const [activeMarktTab, setActiveMarktTab] = useState(LEGACY_TAB_MAP[rawTab] || rawTab);
  const [, navigate] = useLocation();

  const handleMarktTabChange = (tab: string) => {
    setActiveMarktTab(tab);
    navigate(`/markt${tab === "ueberblick" ? "" : `?tab=${tab}`}`, { replace: true });
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <p className="text-xs font-medium text-[#00CFC1] uppercase tracking-widest mb-1">MARKT</p>
          <h1 className="text-2xl font-bold text-white">Markt-Hub</h1>
          <p className="text-sm text-gray-400 mt-1">
            Marktregime · Heatmap · News — alles in einer Page. Der Dividenden-Kalender liegt bei den Portfolio-Details.
          </p>
        </div>

        {/* 5 Tabs per Mockup S.13: Überblick | Regime (Bull) | Heatmap | News | Dividenden-Kalender */}
        <Tabs value={activeMarktTab} onValueChange={handleMarktTabChange} className="w-full">
          <TabsList className="flex flex-wrap gap-0 bg-transparent border-b border-white/10 p-0 h-auto rounded-none">
            {[
              { value: "ueberblick", label: "Überblick", icon: Globe },
              { value: "regime", label: "Regime", icon: Activity, badge: "Bull" },
              { value: "heatmap", label: "Heatmap", icon: BarChart3 },
              { value: "news", label: "News", icon: Newspaper },
              { value: "ki-blase", label: "KI-Blase Monitor", icon: AlertTriangle },
            ].map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#00CFC1] data-[state=active]:text-[#00CFC1] data-[state=active]:bg-transparent text-gray-400 text-sm px-4 pb-3 pt-2 gap-1.5"
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
                {tab.badge && (
                  <span className="bg-[#00CFC1]/20 text-[#00CFC1] text-[9px] px-1.5 py-0.5 rounded-full uppercase tracking-wider">{tab.badge}</span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="ueberblick" className="mt-6">
            <OverviewContent />
          </TabsContent>
          <TabsContent value="regime" className="mt-6">
            <MarketRegimeContent />
          </TabsContent>
          <TabsContent value="heatmap" className="mt-6">
            <HeatmapContent />
          </TabsContent>
          <TabsContent value="news" className="mt-6">
            <NewsroomContent />
          </TabsContent>
          <TabsContent value="ki-blase" className="mt-6">
            <KiBoomDashboard />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
