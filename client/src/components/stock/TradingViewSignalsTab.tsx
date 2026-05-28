/**
 * TradingViewSignalsTab
 * Shows real technical signals from the TradingView MCP Server.
 * Falls back gracefully if TRADINGVIEW_MCP_URL is not configured.
 */
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, TrendingUp, TrendingDown, Minus, RefreshCw, Activity } from "lucide-react";
import { useState } from "react";

interface Props {
  ticker: string;
  exchange?: string;
}

function SignalBadge({ signal }: { signal: string }) {
  const s = (signal || "").toUpperCase();
  if (s.includes("BUY") || s.includes("STRONG_BUY") || s.includes("BULLISH")) {
    return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">{signal}</Badge>;
  }
  if (s.includes("SELL") || s.includes("STRONG_SELL") || s.includes("BEARISH")) {
    return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">{signal}</Badge>;
  }
  return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">{signal || "NEUTRAL"}</Badge>;
}

function SignalIcon({ signal }: { signal: string }) {
  const s = (signal || "").toUpperCase();
  if (s.includes("BUY") || s.includes("BULLISH")) return <TrendingUp className="w-4 h-4 text-emerald-400" />;
  if (s.includes("SELL") || s.includes("BEARISH")) return <TrendingDown className="w-4 h-4 text-red-400" />;
  return <Minus className="w-4 h-4 text-gray-400" />;
}

export default function TradingViewSignalsTab({ ticker, exchange }: Props) {
  const [enabled, setEnabled] = useState(false);

  // Check if MCP server is configured
  const status = trpc.tradingview.status.useQuery(undefined, { staleTime: 60_000 });

  const signals = trpc.tradingview.signals.useQuery(
    { symbol: ticker, exchange, interval: "1d" },
    { enabled: enabled && status.data?.reachable === true, staleTime: 5 * 60_000 }
  );

  const analysis = trpc.tradingview.analysis.useQuery(
    { symbol: ticker, exchange },
    { enabled: enabled && status.data?.reachable === true, staleTime: 5 * 60_000 }
  );

  if (status.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full bg-white/5" />
        <Skeleton className="h-32 w-full bg-white/5" />
      </div>
    );
  }

  if (!status.data?.configured || !status.data?.reachable) {
    return (
      <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-amber-500/20">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
            <div>
              <h3 className="text-white font-medium mb-1">TradingView MCP nicht konfiguriert</h3>
              <p className="text-gray-400 text-sm mb-3">
                Deploye <code className="text-[#00CFC1]">mcp-servers/tradingview</code> auf Railway und setze{" "}
                <code className="text-[#00CFC1]">TRADINGVIEW_MCP_URL</code> in den App-Secrets.
              </p>
              <p className="text-gray-500 text-xs">
                Das Dockerfile und railway.toml sind bereits im Repo vorhanden.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!enabled) {
    return (
      <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/20">
        <CardContent className="p-8 text-center">
          <Activity className="w-10 h-10 text-[#00CFC1] mx-auto mb-3" />
          <h3 className="text-white font-medium mb-2">Technische Signale laden</h3>
          <p className="text-gray-400 text-sm mb-4">
            Echtzeit-Signale von TradingView für <span className="text-white font-mono">{ticker}</span>
          </p>
          <Button
            onClick={() => setEnabled(true)}
            className="bg-[#00CFC1] hover:bg-[#00CFC1]/80 text-black font-medium"
          >
            <Activity className="w-4 h-4 mr-2" />
            Signale analysieren
          </Button>
        </CardContent>
      </Card>
    );
  }

  const isLoading = signals.isLoading || analysis.isLoading;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-24 w-full bg-white/5" />
        ))}
      </div>
    );
  }

  if (signals.error || analysis.error) {
    return (
      <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-red-500/20">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 mt-0.5" />
            <div>
              <h3 className="text-white font-medium mb-1">Fehler beim Laden</h3>
              <p className="text-gray-400 text-sm">{signals.error?.message || analysis.error?.message}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 border-white/20 text-gray-300"
                onClick={() => { signals.refetch(); analysis.refetch(); }}
              >
                <RefreshCw className="w-3 h-3 mr-1" /> Erneut versuchen
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Parse signal data
  const sigData = signals.data as Record<string, unknown> | null;
  const anaData = analysis.data as Record<string, unknown> | null;

  const summary = (sigData as any)?.summary || (anaData as any)?.summary || {};
  const oscillators = (sigData as any)?.oscillators || (anaData as any)?.oscillators || {};
  const movingAverages = (sigData as any)?.moving_averages || (anaData as any)?.moving_averages || {};
  const timeframes = (anaData as any)?.timeframes || {};

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#00CFC1]" />
          <span className="text-white font-medium">Technische Signale — {ticker}</span>
          <Badge className="bg-[#00CFC1]/10 text-[#00CFC1] border-[#00CFC1]/20 text-xs">LIVE</Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-gray-400 hover:text-white"
          onClick={() => { signals.refetch(); analysis.refetch(); }}
        >
          <RefreshCw className="w-3 h-3 mr-1" /> Aktualisieren
        </Button>
      </div>

      {/* Summary Signal */}
      {summary.RECOMMENDATION && (
        <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-gray-400 text-xs uppercase tracking-wide mb-1">Gesamtsignal</div>
                <div className="flex items-center gap-2">
                  <SignalIcon signal={summary.RECOMMENDATION} />
                  <SignalBadge signal={summary.RECOMMENDATION} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-emerald-400 font-mono text-lg font-bold">{summary.BUY || 0}</div>
                  <div className="text-gray-500 text-xs">Kauf</div>
                </div>
                <div>
                  <div className="text-gray-400 font-mono text-lg font-bold">{summary.NEUTRAL || 0}</div>
                  <div className="text-gray-500 text-xs">Neutral</div>
                </div>
                <div>
                  <div className="text-red-400 font-mono text-lg font-bold">{summary.SELL || 0}</div>
                  <div className="text-gray-500 text-xs">Verkauf</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Multi-Timeframe */}
      {Object.keys(timeframes).length > 0 && (
        <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-sm">Multi-Timeframe Analyse</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="grid grid-cols-3 gap-3">
              {Object.entries(timeframes).map(([tf, data]: [string, any]) => (
                <div key={tf} className="bg-white/5 rounded-lg p-3 text-center">
                  <div className="text-gray-400 text-xs uppercase mb-2">{tf}</div>
                  <SignalBadge signal={data?.RECOMMENDATION || data?.recommendation || "NEUTRAL"} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Oscillators */}
      {oscillators.RECOMMENDATION && (
        <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-sm">Oszillatoren</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="flex items-center justify-between">
              <SignalBadge signal={oscillators.RECOMMENDATION} />
              <div className="flex gap-3 text-xs text-gray-400">
                <span className="text-emerald-400">{oscillators.BUY || 0} Kauf</span>
                <span>{oscillators.NEUTRAL || 0} Neutral</span>
                <span className="text-red-400">{oscillators.SELL || 0} Verkauf</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Moving Averages */}
      {movingAverages.RECOMMENDATION && (
        <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-sm">Gleitende Durchschnitte</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="flex items-center justify-between">
              <SignalBadge signal={movingAverages.RECOMMENDATION} />
              <div className="flex gap-3 text-xs text-gray-400">
                <span className="text-emerald-400">{movingAverages.BUY || 0} Kauf</span>
                <span>{movingAverages.NEUTRAL || 0} Neutral</span>
                <span className="text-red-400">{movingAverages.SELL || 0} Verkauf</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fallback if no structured data */}
      {!summary.RECOMMENDATION && !oscillators.RECOMMENDATION && (
        <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-white/10">
          <CardContent className="p-4">
            <pre className="text-gray-300 text-xs overflow-auto max-h-64 font-mono">
              {JSON.stringify(sigData || anaData, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
