/**
 * MarktScanner — Live Market Scanner
 * Shows Top Gainers, Volume Breakouts, and Bollinger Band signals
 * across SIX, NASDAQ, and XETRA.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Volume2, BarChart2, RefreshCw, AlertCircle, ExternalLink } from "lucide-react";
import { useLocation } from "wouter";

// ── Exchange config ────────────────────────────────────────────────────────────
const EXCHANGES = [
  { label: "NASDAQ",  exchange: "NASDAQ",  screener: "america"  },
  { label: "NYSE",    exchange: "NYSE",    screener: "america"  },
  { label: "SIX",     exchange: "SIX",     screener: "europe"   },
  { label: "XETRA",   exchange: "XETRA",   screener: "europe"   },
];

// ── Helper ─────────────────────────────────────────────────────────────────────
function pct(v: number | null | undefined) {
  if (v == null) return "–";
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}

function StockRow({ item, onClick }: { item: any; onClick?: () => void }) {
  const change = item.change_percent ?? item.percent_change ?? item.changePercent ?? 0;
  const positive = change >= 0;
  return (
    <div
      className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[#00CFC1]/10 flex items-center justify-center shrink-0">
          <span className="text-[#00CFC1] text-xs font-bold">{(item.symbol ?? item.ticker ?? "?").slice(0, 2)}</span>
        </div>
        <div>
          <p className="text-white text-sm font-medium">{item.symbol ?? item.ticker}</p>
          <p className="text-gray-500 text-xs truncate max-w-[140px]">{item.name ?? item.company_name ?? ""}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-white text-sm font-mono">{item.price != null ? `$${item.price.toFixed(2)}` : "–"}</p>
        <p className={`text-xs font-mono ${positive ? "text-emerald-400" : "text-red-400"}`}>
          {pct(change)}
        </p>
      </div>
    </div>
  );
}

function ScannerPanel({
  title,
  icon: Icon,
  exchange,
  screener,
  type,
}: {
  title: string;
  icon: React.ElementType;
  exchange: string;
  screener: string;
  type: "gainers" | "losers" | "volume" | "bollinger";
}) {
  const [, navigate] = useLocation();

  const gainers = trpc.tradingview.topGainers.useQuery(
    { exchange, screener, limit: 10 },
    { enabled: type === "gainers", staleTime: 2 * 60 * 1000 }
  );
  const losers = trpc.tradingview.topLosers.useQuery(
    { exchange, screener, limit: 10 },
    { enabled: type === "losers", staleTime: 2 * 60 * 1000 }
  );
  const volume = trpc.tradingview.volumeBreakout.useQuery(
    { exchange, screener, min_volume_ratio: 2.0, limit: 10 },
    { enabled: type === "volume", staleTime: 2 * 60 * 1000 }
  );
  const bollinger = trpc.tradingview.bollingerScan.useQuery(
    { exchange, screener, limit: 10 },
    { enabled: type === "bollinger", staleTime: 2 * 60 * 1000 }
  );

  const q = type === "gainers" ? gainers : type === "losers" ? losers : type === "volume" ? volume : bollinger;
  const raw = (q.data as any)?.json ?? q.data;
  const items: any[] = Array.isArray(raw) ? raw : (raw?.results ?? raw?.stocks ?? raw?.data ?? []);

  return (
    <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/20">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white text-sm flex items-center gap-2">
            <Icon className="w-4 h-4 text-[#00CFC1]" />
            {title}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => q.refetch()}
            disabled={q.isFetching}
            className="text-gray-400 hover:text-[#00CFC1] h-7 w-7 p-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${q.isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        {q.isLoading && (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full bg-white/5" />)}
            <p className="text-gray-500 text-xs text-center">Scanne {exchange}...</p>
          </div>
        )}
        {q.error && (
          <div className="flex items-start gap-2 text-red-400 text-sm py-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span className="text-xs">{q.error.message}</span>
          </div>
        )}
        {!q.isLoading && !q.error && items.length === 0 && (
          <p className="text-gray-500 text-sm text-center py-4">Keine Daten verfügbar</p>
        )}
        {items.length > 0 && (
          <div className="space-y-1.5">
            {items.slice(0, 10).map((item: any, i: number) => (
              <StockRow
                key={i}
                item={item}
                onClick={() => {
                  const sym = item.symbol ?? item.ticker;
                  if (sym) navigate(`/stocks/${sym}`);
                }}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function MarktScanner() {
  const [selectedExchange, setSelectedExchange] = useState(EXCHANGES[0]);

  return (
    <div className="space-y-6">
      {/* Exchange Selector */}
      <div className="flex flex-wrap gap-2">
        {EXCHANGES.map(ex => (
          <button
            key={ex.label}
            onClick={() => setSelectedExchange(ex)}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${
              selectedExchange.label === ex.label
                ? "bg-[#00CFC1]/20 text-[#00CFC1] font-medium border border-[#00CFC1]/30"
                : "text-gray-400 hover:text-white hover:bg-white/5 border border-transparent"
            }`}
          >
            {ex.label}
          </button>
        ))}
      </div>

      {/* Scanner Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ScannerPanel
          title={`Top Gainers — ${selectedExchange.label}`}
          icon={TrendingUp}
          exchange={selectedExchange.exchange}
          screener={selectedExchange.screener}
          type="gainers"
        />
        <ScannerPanel
          title={`Top Losers — ${selectedExchange.label}`}
          icon={TrendingDown}
          exchange={selectedExchange.exchange}
          screener={selectedExchange.screener}
          type="losers"
        />
        <ScannerPanel
          title={`Volume Breakout — ${selectedExchange.label}`}
          icon={Volume2}
          exchange={selectedExchange.exchange}
          screener={selectedExchange.screener}
          type="volume"
        />
        <ScannerPanel
          title={`Bollinger Squeeze — ${selectedExchange.label}`}
          icon={BarChart2}
          exchange={selectedExchange.exchange}
          screener={selectedExchange.screener}
          type="bollinger"
        />
      </div>

      <p className="text-gray-600 text-xs text-right">
        Daten via TradingView MCP · Aktualisierung alle 2 Minuten
      </p>
    </div>
  );
}
