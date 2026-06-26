/**
 * TradingViewSignalsTab
 * Shows real technical signals from the TradingView MCP Server.
 * Correctly parses the MCP server's data format:
 *   - combined_analysis → { symbol, exchange, timeframe, technical: { market_sentiment, rsi, macd, sma, ema, ... } }
 *   - multi_timeframe_analysis → { timeframes: { "1W": {...}, "1D": {...}, ... } }
 */
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, TrendingUp, TrendingDown, Minus, RefreshCw, Activity, BarChart2 } from "lucide-react";
import { useState } from "react";

interface Props {
  ticker: string;
  exchange?: string;
}

/** Derive a clean signal string from the MCP data for a single timeframe */
function deriveSignal(tfData: any): string {
  if (!tfData) return "NEUTRAL";

  // Try direct fields first
  const direct =
    tfData?.RECOMMENDATION ||
    tfData?.recommendation ||
    tfData?.market_sentiment?.buy_sell_signal ||
    tfData?.technical?.market_sentiment?.buy_sell_signal;
  if (direct && direct !== "NEUTRAL") return direct.toUpperCase();

  // Derive from timeframe_context.bias
  const bias =
    tfData?.timeframe_context?.bias ||
    tfData?.technical?.timeframe_context?.bias;
  if (bias) {
    const b = bias.toUpperCase();
    if (b.includes("STRONG") && b.includes("BULL")) return "STRONG_BUY";
    if (b.includes("BULL")) return "BUY";
    if (b.includes("STRONG") && b.includes("BEAR")) return "STRONG_SELL";
    if (b.includes("BEAR")) return "SELL";
  }

  // Derive from market_structure.trend
  const trend =
    tfData?.market_structure?.trend ||
    tfData?.technical?.market_structure?.trend;
  if (trend) {
    const t = trend.toUpperCase();
    if (t.includes("STRONG") && t.includes("UP")) return "STRONG_BUY";
    if (t.includes("UP")) return "BUY";
    if (t.includes("STRONG") && t.includes("DOWN")) return "STRONG_SELL";
    if (t.includes("DOWN")) return "SELL";
  }

  return direct || "NEUTRAL";
}

/** Derive overall signal from combined_analysis data */
function deriveOverallSignal(sigData: any): { signal: string; score: number; reasons: string[] } {
  if (!sigData) return { signal: "NEUTRAL", score: 50, reasons: [] };

  const tech = sigData?.technical || sigData;
  const sentiment = tech?.market_sentiment;
  const marketStructure = tech?.market_structure;
  const rsi = tech?.rsi;
  const macd = tech?.macd;
  const ema = tech?.ema;
  const adx = tech?.adx;

  const reasons: string[] = [];
  let bullPoints = 0;
  let bearPoints = 0;

  // Market sentiment (weight: 2)
  if (sentiment?.buy_sell_signal) {
    const s = sentiment.buy_sell_signal.toUpperCase();
    if (s.includes("BUY")) { bullPoints += 2; reasons.push(`Markt-Sentiment: ${sentiment.buy_sell_signal}`); }
    else if (s.includes("SELL")) { bearPoints += 2; reasons.push(`Markt-Sentiment: ${sentiment.buy_sell_signal}`); }
  }

  // Timeframe bias (weight: 2)
  const bias = tech?.timeframe_context?.bias;
  if (bias) {
    const b = bias.toUpperCase();
    if (b.includes("BULL")) { bullPoints += 2; reasons.push(`Trend: ${bias}`); }
    else if (b.includes("BEAR")) { bearPoints += 2; reasons.push(`Trend: ${bias}`); }
  }

  // RSI (weight: 1)
  if (rsi?.value !== undefined) {
    if (rsi.value < 30) { bullPoints += 1; reasons.push(`RSI ${rsi.value.toFixed(0)} – überverkauft`); }
    else if (rsi.value > 70) { bearPoints += 1; reasons.push(`RSI ${rsi.value.toFixed(0)} – überkauft`); }
    else if (rsi.value > 55) { bullPoints += 0.5; }
    else if (rsi.value < 45) { bearPoints += 0.5; }
  }

  // MACD (weight: 1)
  if (macd?.crossover) {
    const m = macd.crossover.toUpperCase();
    if (m.includes("BULL")) { bullPoints += 1; reasons.push("MACD: Bullisches Kreuz"); }
    else if (m.includes("BEAR")) { bearPoints += 1; reasons.push("MACD: Bärisches Kreuz"); }
  }

  // EMA signals (weight: 1)
  if (ema?.signals?.length) {
    const emaSignals = ema.signals as string[];
    const bullEma = emaSignals.filter(s => s.toLowerCase().includes("bullish") || s.toLowerCase().includes("above")).length;
    const bearEma = emaSignals.filter(s => s.toLowerCase().includes("bearish") || s.toLowerCase().includes("below") || s.toLowerCase().includes("death cross")).length;
    if (bullEma > bearEma) bullPoints += 1;
    else if (bearEma > bullEma) bearPoints += 1;
    if (emaSignals.some(s => s.toLowerCase().includes("death cross"))) {
      bearPoints += 1;
      reasons.push("Death Cross (EMA50 < EMA200)");
    }
    if (emaSignals.some(s => s.toLowerCase().includes("golden cross"))) {
      bullPoints += 1;
      reasons.push("Golden Cross (EMA50 > EMA200)");
    }
  }

  // ADX trend strength (weight: 0.5)
  if (adx?.di_signal) {
    const d = adx.di_signal.toUpperCase();
    if (d.includes("BULL")) bullPoints += 0.5;
    else if (d.includes("BEAR")) bearPoints += 0.5;
  }

  const total = bullPoints + bearPoints;
  const score = total > 0 ? Math.round(50 + ((bullPoints - bearPoints) / total) * 50) : 50;

  let signal = "NEUTRAL";
  if (score >= 70) signal = "STRONG_BUY";
  else if (score >= 58) signal = "BUY";
  else if (score <= 30) signal = "STRONG_SELL";
  else if (score <= 42) signal = "SELL";

  return { signal, score, reasons };
}

function SignalBadge({ signal }: { signal: string }) {
  const s = (signal || "").toUpperCase();
  if (s === "STRONG_BUY") return <Badge className="bg-emerald-500/30 text-emerald-300 border-emerald-500/40 font-bold">STRONG BUY</Badge>;
  if (s.includes("BUY") || s.includes("BULLISH")) return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">BUY</Badge>;
  if (s === "STRONG_SELL") return <Badge className="bg-red-500/30 text-red-300 border-red-500/40 font-bold">STRONG SELL</Badge>;
  if (s.includes("SELL") || s.includes("BEARISH")) return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">SELL</Badge>;
  return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">{signal || "NEUTRAL"}</Badge>;
}

function SignalIcon({ signal }: { signal: string }) {
  const s = (signal || "").toUpperCase();
  if (s.includes("BUY") || s.includes("BULLISH")) return <TrendingUp className="w-4 h-4 text-emerald-400" />;
  if (s.includes("SELL") || s.includes("BEARISH")) return <TrendingDown className="w-4 h-4 text-red-400" />;
  return <Minus className="w-4 h-4 text-gray-400" />;
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 60 ? "bg-emerald-500" : score <= 40 ? "bg-red-500" : "bg-yellow-500";
  return (
    <div className="w-full bg-white/10 rounded-full h-2 mt-2">
      <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${score}%` }} />
    </div>
  );
}

export default function TradingViewSignalsTab({ ticker, exchange }: Props) {
  const [enabled, setEnabled] = useState(false);

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

  const sigData = signals.data as any;
  const anaData = analysis.data as any;

  // Extract technical data from combined_analysis (signals endpoint)
  const tech = sigData?.technical || sigData;
  const rsi = tech?.rsi;
  const macd = tech?.macd;
  const ema = tech?.ema;
  const sma = tech?.sma;
  const bb = tech?.bollinger_bands;
  const adx = tech?.adx;
  const stoch = tech?.stochastic;
  const atr = tech?.atr;
  const support = tech?.support_resistance;
  const tradeSetup = tech?.trade_setup;
  const priceData = sigData?.price_data || tech?.price_data;

  // Extract timeframes from multi_timeframe_analysis (analysis endpoint)
  const timeframesRaw = anaData?.timeframes || {};

  // Derive overall signal from the rich data
  const { signal: overallSignal, score: overallScore, reasons } = deriveOverallSignal(sigData);

  // Derive per-timeframe signals
  const timeframeSignals: Record<string, string> = {};
  Object.entries(timeframesRaw).forEach(([tf, data]: [string, any]) => {
    timeframeSignals[tf] = deriveSignal(data);
  });

  // If no timeframes from analysis, create from signals data
  if (Object.keys(timeframeSignals).length === 0 && sigData) {
    const tfLabel = sigData.timeframe || "1D";
    timeframeSignals[tfLabel] = overallSignal;
  }

  const emaSignals = ema?.signals as string[] | undefined;
  const smaSignals = sma?.signals as string[] | undefined;

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

      {/* Overall Signal */}
      <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-gray-400 text-xs uppercase tracking-wide mb-1">Gesamtsignal (TA)</div>
              <div className="flex items-center gap-2">
                <SignalIcon signal={overallSignal} />
                <SignalBadge signal={overallSignal} />
                <span className="text-gray-400 text-sm">Score: <span className="text-white font-mono">{overallScore}/100</span></span>
              </div>
            </div>
            {priceData && (
              <div className="text-right">
                <div className="text-white font-mono text-lg">{priceData.current_price?.toFixed(2)}</div>
                <div className={`text-sm ${(priceData.change_percent || 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {(priceData.change_percent || 0) >= 0 ? "+" : ""}{priceData.change_percent?.toFixed(2)}%
                </div>
              </div>
            )}
          </div>
          <ScoreBar score={overallScore} />
          {reasons.length > 0 && (
            <div className="mt-3 space-y-1">
              {reasons.slice(0, 4).map((r, i) => (
                <div key={i} className="text-gray-400 text-xs flex items-center gap-1">
                  <span className="text-[#00CFC1]">•</span> {r}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Multi-Timeframe */}
      {Object.keys(timeframeSignals).length > 0 && (
        <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-sm">Multi-Timeframe Analyse</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="grid grid-cols-3 gap-3">
              {Object.entries(timeframeSignals).map(([tf, sig]) => {
                const tfData = timeframesRaw[tf];
                const bias = tfData?.timeframe_context?.bias || tfData?.technical?.timeframe_context?.bias;
                return (
                  <div key={tf} className="bg-white/5 rounded-lg p-3 text-center">
                    <div className="text-gray-400 text-xs uppercase mb-2">{tf}</div>
                    <SignalBadge signal={sig} />
                    {bias && <div className="text-gray-500 text-xs mt-1">{bias}</div>}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Key Indicators Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* RSI */}
        {rsi && (
          <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-white/10">
            <CardContent className="p-4">
              <div className="text-gray-400 text-xs uppercase tracking-wide mb-2">RSI (14)</div>
              <div className="flex items-center justify-between">
                <span className={`text-xl font-mono font-bold ${
                  rsi.value < 30 ? "text-emerald-400" : rsi.value > 70 ? "text-red-400" : "text-white"
                }`}>{rsi.value?.toFixed(1)}</span>
                <SignalBadge signal={rsi.signal || (rsi.value < 30 ? "BUY" : rsi.value > 70 ? "SELL" : "NEUTRAL")} />
              </div>
              <div className="text-gray-500 text-xs mt-1">{rsi.direction} · {rsi.value < 30 ? "Überverkauft" : rsi.value > 70 ? "Überkauft" : "Neutral"}</div>
            </CardContent>
          </Card>
        )}

        {/* MACD */}
        {macd && (
          <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-white/10">
            <CardContent className="p-4">
              <div className="text-gray-400 text-xs uppercase tracking-wide mb-2">MACD</div>
              <div className="flex items-center justify-between">
                <span className={`text-sm font-mono ${(macd.histogram || 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  Hist: {macd.histogram?.toFixed(4)}
                </span>
                <SignalBadge signal={macd.crossover || "NEUTRAL"} />
              </div>
              <div className="text-gray-500 text-xs mt-1">
                MACD: {macd.macd_line?.toFixed(4)} · Signal: {macd.signal_line?.toFixed(4)}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ADX */}
        {adx && (
          <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-white/10">
            <CardContent className="p-4">
              <div className="text-gray-400 text-xs uppercase tracking-wide mb-2">ADX (Trendstärke)</div>
              <div className="flex items-center justify-between">
                <span className="text-xl font-mono font-bold text-white">{adx.value?.toFixed(1)}</span>
                <Badge className="bg-white/10 text-gray-300 border-white/20 text-xs">{adx.trend_strength}</Badge>
              </div>
              <div className={`text-xs mt-1 ${adx.di_signal?.includes("Bullish") ? "text-emerald-400" : "text-red-400"}`}>
                {adx.di_signal} · +DI: {adx.plus_di?.toFixed(1)} / -DI: {adx.minus_di?.toFixed(1)}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stochastic */}
        {stoch && (
          <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-white/10">
            <CardContent className="p-4">
              <div className="text-gray-400 text-xs uppercase tracking-wide mb-2">Stochastik</div>
              <div className="flex items-center justify-between">
                <span className={`text-xl font-mono font-bold ${
                  stoch.k < 20 ? "text-emerald-400" : stoch.k > 80 ? "text-red-400" : "text-white"
                }`}>{stoch.k?.toFixed(1)}</span>
                <SignalBadge signal={stoch.signal || "NEUTRAL"} />
              </div>
              <div className="text-gray-500 text-xs mt-1">%K: {stoch.k?.toFixed(1)} · %D: {stoch.d?.toFixed(1)}</div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Bollinger Bands */}
      {bb && (
        <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-sm">Bollinger Bänder</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-red-400 font-mono font-bold">{bb.upper?.toFixed(2)}</div>
                <div className="text-gray-500 text-xs">Oberes Band</div>
              </div>
              <div>
                <div className="text-white font-mono font-bold">{bb.middle?.toFixed(2)}</div>
                <div className="text-gray-500 text-xs">Mittelband</div>
              </div>
              <div>
                <div className="text-emerald-400 font-mono font-bold">{bb.lower?.toFixed(2)}</div>
                <div className="text-gray-500 text-xs">Unteres Band</div>
              </div>
            </div>
            <div className="mt-2 text-gray-400 text-xs text-center">
              Position: {bb.position} · {bb.squeeze ? "⚡ Squeeze aktiv" : "Kein Squeeze"}
            </div>
          </CardContent>
        </Card>
      )}

      {/* EMA Signals */}
      {emaSignals && emaSignals.length > 0 && (
        <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-sm">EMA-Signale</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="space-y-1">
              {emaSignals.map((s: string, i: number) => {
                const isBull = s.toLowerCase().includes("bullish") || s.toLowerCase().includes("above") || s.toLowerCase().includes("golden");
                const isBear = s.toLowerCase().includes("bearish") || s.toLowerCase().includes("below") || s.toLowerCase().includes("death");
                return (
                  <div key={i} className={`text-xs flex items-center gap-2 ${isBull ? "text-emerald-400" : isBear ? "text-red-400" : "text-gray-400"}`}>
                    <span>{isBull ? "↑" : isBear ? "↓" : "–"}</span>
                    <span>{s}</span>
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3 text-xs text-center">
              {ema?.ema20 && <div><div className="text-gray-500">EMA20</div><div className="text-white font-mono">{ema.ema20.toFixed(2)}</div></div>}
              {ema?.ema50 && <div><div className="text-gray-500">EMA50</div><div className="text-white font-mono">{ema.ema50.toFixed(2)}</div></div>}
              {ema?.ema200 && <div><div className="text-gray-500">EMA200</div><div className="text-white font-mono">{ema.ema200.toFixed(2)}</div></div>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Support & Resistance */}
      {support && (
        <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-sm flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-[#00CFC1]" />
              Support & Resistance
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-gray-400 text-xs mb-2">Widerstände</div>
                {[support.resistance_1, support.resistance_2, support.resistance_3].filter(Boolean).map((r, i) => (
                  <div key={i} className="text-red-400 font-mono text-sm">{r?.toFixed(2)}</div>
                ))}
              </div>
              <div>
                <div className="text-gray-400 text-xs mb-2">Unterstützungen</div>
                {[support.support_1, support.support_2, support.support_3].filter(Boolean).map((s, i) => (
                  <div key={i} className="text-emerald-400 font-mono text-sm">{s?.toFixed(2)}</div>
                ))}
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-400">
              <div>Pivot: <span className="text-white font-mono">{support.pivot?.toFixed(2)}</span></div>
              <div>Nächster Widerstand: <span className="text-red-400 font-mono">+{support.distance_to_resistance_pct?.toFixed(1)}%</span></div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Trade Setup */}
      {tradeSetup && (
        <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-sm">Trade Setup</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-gray-400 text-xs mb-1">Einstieg</div>
                <div className="text-[#00CFC1] font-mono font-bold">{tradeSetup.entry_points?.pullback_entry?.toFixed(2) || "–"}</div>
              </div>
              <div>
                <div className="text-gray-400 text-xs mb-1">Stop Loss</div>
                <div className="text-red-400 font-mono font-bold">{tradeSetup.stop_loss?.toFixed(2) || "–"}</div>
              </div>
              <div>
                <div className="text-gray-400 text-xs mb-1">Ziel 1</div>
                <div className="text-emerald-400 font-mono font-bold">{tradeSetup.targets?.target_1?.toFixed(2) || "–"}</div>
              </div>
            </div>
            {tradeSetup.risk_reward?.to_target_1 && (
              <div className="mt-2 text-center text-xs text-gray-400">
                Risk/Reward: <span className="text-white font-mono">{tradeSetup.risk_reward.to_target_1}:1</span>
                {tradeSetup.stop_distance_pct && <span> · Stop: -{tradeSetup.stop_distance_pct?.toFixed(1)}%</span>}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ATR Volatility */}
      {atr && (
        <div className="flex items-center gap-2 text-xs text-gray-400 px-1">
          <span>ATR (14):</span>
          <span className="text-white font-mono">{atr.value?.toFixed(4)}</span>
          <span>({atr.percent_of_price?.toFixed(2)}% des Kurses)</span>
          <Badge className={`text-xs ${atr.volatility === "High" ? "bg-red-500/20 text-red-400 border-red-500/30" : "bg-gray-500/20 text-gray-400 border-gray-500/30"}`}>
            {atr.volatility}
          </Badge>
        </div>
      )}
    </div>
  );
}
