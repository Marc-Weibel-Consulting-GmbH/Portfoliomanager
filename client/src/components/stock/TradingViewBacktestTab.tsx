/**
 * TradingViewBacktestTab
 * Runs strategy backtests via the TradingView MCP Server.
 * Falls back gracefully if TRADINGVIEW_MCP_URL is not configured.
 */
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Play, TrendingUp, TrendingDown, BarChart2, RefreshCw } from "lucide-react";
import { useState } from "react";

interface Props {
  ticker: string;
  exchange?: string;
}

const STRATEGIES = [
  { value: "rsi",              label: "RSI Oversold/Overbought" },
  { value: "macd",             label: "MACD Crossover" },
  { value: "bollinger",        label: "Bollinger Band Mean Reversion" },
  { value: "ema_cross",        label: "EMA 20/50 Golden/Death Cross" },
  { value: "supertrend",       label: "Supertrend (ATR-based)" },
  { value: "donchian",         label: "Donchian Channel Breakout" },
  { value: "rsi_pullback",     label: "RSI Pullback in Uptrend" },
  { value: "keltner_breakout", label: "Keltner Channel Breakout" },
  { value: "triple_ema",       label: "EMA 20/50 + SMA200 Filter" },
] as const;

type StrategyValue = typeof STRATEGIES[number]["value"];

const PERIODS = [
  { value: "3mo",  label: "3 Monate" },
  { value: "6mo",  label: "6 Monate" },
  { value: "1y",   label: "1 Jahr" },
  { value: "2y",   label: "2 Jahre" },
  { value: "5y",   label: "5 Jahre" },
];

function MetricCard({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  const color = positive === undefined ? "text-white" : positive ? "text-emerald-400" : "text-red-400";
  return (
    <div className="bg-white/5 rounded-lg p-3">
      <div className="text-gray-500 text-xs uppercase tracking-wide mb-1">{label}</div>
      <div className={`font-mono text-sm font-medium ${color}`}>{value}</div>
    </div>
  );
}

export default function TradingViewBacktestTab({ ticker }: Props) {
  const [strategy, setStrategy] = useState<StrategyValue>("rsi");
  const [period, setPeriod] = useState<string>("1y");
  const [runBacktest, setRunBacktest] = useState(false);
  const [runCompare, setRunCompare] = useState(false);

  // Check if MCP server is configured
  const status = trpc.tradingview.status.useQuery(undefined, { staleTime: 60_000 });

  // Backtest query — only runs when user clicks "Backtest starten"
  const backtest = trpc.tradingview.backtest.useQuery(
    { symbol: ticker, strategy, period },
    { enabled: runBacktest && status.data?.reachable === true, staleTime: 0 }
  );

  // Compare all strategies
  const compare = trpc.tradingview.compareStrategies.useQuery(
    { symbol: ticker, period },
    { enabled: runCompare && status.data?.reachable === true, staleTime: 0 }
  );

  if (!status.data?.configured || !status.data?.reachable) {
    return (
      <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-amber-500/20">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
            <div>
              <h3 className="text-white font-medium mb-1">TradingView MCP nicht konfiguriert</h3>
              <p className="text-gray-400 text-sm">
                Deploye <code className="text-[#00CFC1]">mcp-servers/tradingview</code> auf Railway und setze{" "}
                <code className="text-[#00CFC1]">TRADINGVIEW_MCP_URL</code> in den App-Secrets.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const backtestData = backtest.data as Record<string, unknown> | null;
  const compareData = compare.data as Record<string, unknown> | null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <BarChart2 className="w-4 h-4 text-[#00CFC1]" />
        <span className="text-white font-medium">Strategie-Backtest — {ticker}</span>
        <Badge className="bg-[#00CFC1]/10 text-[#00CFC1] border-[#00CFC1]/20 text-xs">TradingView MCP</Badge>
      </div>

      {/* Controls */}
      <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-white/10">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[160px]">
              <label className="text-gray-400 text-xs uppercase tracking-wide mb-1 block">Strategie</label>
              <Select value={strategy} onValueChange={(v) => { setStrategy(v as StrategyValue); setRunBacktest(false); }}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1f2e] border-white/10">
                  {STRATEGIES.map(s => (
                    <SelectItem key={s.value} value={s.value} className="text-white hover:bg-white/10">
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-36">
              <label className="text-gray-400 text-xs uppercase tracking-wide mb-1 block">Zeitraum</label>
              <Select value={period} onValueChange={(v) => { setPeriod(v); setRunBacktest(false); }}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1f2e] border-white/10">
                  {PERIODS.map(p => (
                    <SelectItem key={p.value} value={p.value} className="text-white hover:bg-white/10">
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={() => { setRunBacktest(true); setRunCompare(false); }}
              disabled={backtest.isFetching}
              className="bg-[#00CFC1] hover:bg-[#00CFC1]/80 text-black font-medium"
            >
              {backtest.isFetching ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              Backtest starten
            </Button>

            <Button
              variant="outline"
              onClick={() => { setRunCompare(true); setRunBacktest(false); }}
              disabled={compare.isFetching}
              className="border-white/20 text-gray-300 hover:text-white"
            >
              {compare.isFetching ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <BarChart2 className="w-4 h-4 mr-2" />
              )}
              Alle Strategien vergleichen
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Backtest Loading */}
      {backtest.isFetching && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full bg-white/5" />)}
          <p className="text-gray-500 text-xs text-center">Backtest läuft... (kann 30–60 Sek. dauern)</p>
        </div>
      )}

      {/* Backtest Results */}
      {backtestData && !backtest.isFetching && (
        <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#00CFC1]" />
              Backtest-Ergebnis: {STRATEGIES.find(s => s.value === strategy)?.label}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <MetricCard
                label="Gesamtrendite"
                value={`${((backtestData as any)?.total_return ?? (backtestData as any)?.total_return_pct ?? 0).toFixed(2)}%`}
                positive={(backtestData as any)?.total_return > 0}
              />
              <MetricCard
                label="Trades"
                value={String((backtestData as any)?.total_trades ?? (backtestData as any)?.num_trades ?? "–")}
              />
              <MetricCard
                label="Win Rate"
                value={`${((backtestData as any)?.win_rate ?? 0).toFixed(1)}%`}
                positive={(backtestData as any)?.win_rate > 50}
              />
              <MetricCard
                label="Max Drawdown"
                value={`${((backtestData as any)?.max_drawdown ?? 0).toFixed(2)}%`}
                positive={false}
              />
            </div>
            {/* Raw data fallback */}
            {!(backtestData as any)?.total_return && !(backtestData as any)?.total_return_pct && (
              <pre className="text-gray-300 text-xs overflow-auto max-h-48 font-mono bg-white/5 rounded p-3">
                {JSON.stringify(backtestData, null, 2)}
              </pre>
            )}
          </CardContent>
        </Card>
      )}

      {/* Compare Loading */}
      {compare.isFetching && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full bg-white/5" />)}
          <p className="text-gray-500 text-xs text-center">Alle 9 Strategien werden verglichen... (kann 2–3 Min. dauern)</p>
        </div>
      )}

      {/* Compare Results */}
      {compareData && !compare.isFetching && (
        <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-sm flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-[#00CFC1]" />
              Strategievergleich
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {Array.isArray((compareData as any)?.results) ? (
              <div className="space-y-2">
                {((compareData as any).results as any[])
                  .sort((a, b) => (b.total_return ?? 0) - (a.total_return ?? 0))
                  .map((r: any, i: number) => (
                    <div key={i} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
                      <span className="text-white text-sm font-medium">{r.strategy}</span>
                      <div className="flex items-center gap-4 text-xs">
                        <span className={r.total_return > 0 ? "text-emerald-400 font-mono" : "text-red-400 font-mono"}>
                          {r.total_return?.toFixed(2)}%
                        </span>
                        <span className="text-gray-400">Win: {r.win_rate?.toFixed(1)}%</span>
                        <span className="text-gray-400">{r.total_trades} Trades</span>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <pre className="text-gray-300 text-xs overflow-auto max-h-64 font-mono bg-white/5 rounded p-3">
                {JSON.stringify(compareData, null, 2)}
              </pre>
            )}
          </CardContent>
        </Card>
      )}

      {/* Errors */}
      {(backtest.error || compare.error) && (
        <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-red-500/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5" />
              <p className="text-gray-400 text-sm">{backtest.error?.message || compare.error?.message}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
