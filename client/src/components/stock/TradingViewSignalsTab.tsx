/**
 * TradingViewSignalsTab
 * Shows real technical signals from the TradingView Analytics Bridge.
 * Falls back to a "Bridge not configured" state if TRADINGVIEW_BRIDGE_URL is not set.
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

  // First check bridge health
  const health = trpc.tradingview.health.useQuery(undefined, { staleTime: 60_000 });

  const signals = trpc.tradingview.signals.useQuery(
    { symbol: ticker, exchange, timeframe: "1d" },
    { enabled: enabled && health.data?.status === "ok", staleTime: 5 * 60_000 }
  );

  const analysis = trpc.tradingview.analysis.useQuery(
    { symbol: ticker, exchange },
    { enabled: enabled && health.data?.status === "ok", staleTime: 5 * 60_000 }
  );

  if (health.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full bg-white/5" />
        <Skeleton className="h-32 w-full bg-white/5" />
      </div>
    );
  }

  if (!health.data || health.data.status !== "ok") {
    return (
      <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-amber-500/20">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
            <div>
              <h3 className="text-white font-medium mb-1">TradingView Bridge nicht konfiguriert</h3>
              <p className="text-gray-400 text-sm mb-3">
                Deploye den <code className="text-[#00CFC1]">tradingview-service</code> auf Railway und setze{" "}
                <code className="text-[#00CFC1]">TRADINGVIEW_BRIDGE_URL</code> in den App-Secrets.
              </p>
              <p className="text-gray-500 text-xs">
                Anleitung: <code>portfolio_analysis_website/tradingview-service/README.md</code>
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
        <CardContent className="p-6 text-center">
          <Activity className="w-10 h-10 text-[#00CFC1] mx-auto mb-3" />
          <h3 className="text-white font-medium mb-2">TradingView Echtzeit-Signale</h3>
          <p className="text-gray-400 text-sm mb-4">
            Multi-Timeframe-Analyse (Weekly → Daily → 4H → 1H → 15m) + Bollinger, RSI, MACD, Volume
          </p>
          <Button
            className="bg-[#00CFC1] hover:bg-[#00b8ad] text-black font-medium"
            onClick={() => setEnabled(true)}
          >
            Signale laden
          </Button>
        </CardContent>
      </Card>
    );
  }

  const isLoading = signals.isLoading || analysis.isLoading;
  const hasError = signals.error || analysis.error;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-24 w-full bg-white/5" />
        ))}
        <p className="text-center text-gray-500 text-sm">Lade TradingView-Daten… (kann 10–30s dauern)</p>
      </div>
    );
  }

  if (hasError) {
    return (
      <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-red-500/20">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
            <div>
              <h3 className="text-white font-medium mb-1">Fehler beim Laden der Signale</h3>
              <p className="text-gray-400 text-sm mb-3">
                {(signals.error || analysis.error)?.message}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="border-[#00CFC1]/30 text-[#00CFC1]"
                onClick={() => { signals.refetch(); analysis.refetch(); }}
              >
                <RefreshCw className="w-3 h-3 mr-2" /> Erneut versuchen
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const sig = signals.data as any;
  const mta = analysis.data as any;

  return (
    <div className="space-y-4">
      {/* Overall Signal */}
      {sig && (
        <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#00CFC1]" />
              Gesamtsignal (Daily)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-4">
              <SignalIcon signal={sig.signal || sig.recommendation || ""} />
              <SignalBadge signal={sig.signal || sig.recommendation || "NEUTRAL"} />
              {sig.price && (
                <span className="text-white font-mono ml-auto">
                  {typeof sig.price === "number" ? sig.price.toFixed(2) : sig.price}
                </span>
              )}
            </div>

            {/* Indicator grid */}
            {sig.indicators && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(sig.indicators as Record<string, unknown>).slice(0, 12).map(([key, val]) => (
                  <div key={key} className="bg-white/5 rounded-lg p-2.5">
                    <div className="text-gray-500 text-xs uppercase tracking-wide mb-1">{key}</div>
                    <div className="text-white font-mono text-sm">
                      {typeof val === "number" ? val.toFixed(4) : String(val)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Bollinger Bands */}
            {sig.bollinger && (
              <div className="mt-4 p-3 bg-white/5 rounded-lg">
                <div className="text-gray-400 text-xs uppercase tracking-wide mb-2">Bollinger Bands</div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-xs text-gray-500">Upper</div>
                    <div className="text-white font-mono text-sm">{Number(sig.bollinger.upper).toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Middle</div>
                    <div className="text-[#00CFC1] font-mono text-sm">{Number(sig.bollinger.middle).toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Lower</div>
                    <div className="text-white font-mono text-sm">{Number(sig.bollinger.lower).toFixed(2)}</div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Multi-Timeframe Analysis */}
      {mta && (
        <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#00CFC1]" />
              Multi-Timeframe Analyse
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(mta.timeframes || mta.analysis || []).map((tf: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-2.5 bg-white/5 rounded-lg">
                  <span className="text-gray-400 text-sm font-mono w-16">{tf.timeframe || tf.period}</span>
                  <div className="flex items-center gap-2">
                    <SignalIcon signal={tf.signal || tf.recommendation || ""} />
                    <SignalBadge signal={tf.signal || tf.recommendation || "NEUTRAL"} />
                  </div>
                  {tf.rsi && (
                    <span className="text-gray-500 text-xs font-mono">RSI {Number(tf.rsi).toFixed(1)}</span>
                  )}
                </div>
              ))}
            </div>

            {/* Summary */}
            {(mta.summary || mta.overall_signal) && (
              <div className="mt-4 p-3 bg-[#00CFC1]/10 rounded-lg border border-[#00CFC1]/20">
                <div className="text-gray-400 text-xs uppercase tracking-wide mb-1">Zusammenfassung</div>
                <p className="text-white text-sm">{mta.summary || mta.overall_signal}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          className="text-gray-500 hover:text-[#00CFC1]"
          onClick={() => { signals.refetch(); analysis.refetch(); }}
        >
          <RefreshCw className="w-3 h-3 mr-2" /> Aktualisieren
        </Button>
      </div>
    </div>
  );
}
