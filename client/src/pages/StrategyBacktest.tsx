/**
 * StrategyBacktest — Full-page backtest interface
 * Allows testing any strategy on any symbol via the TradingView MCP server.
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TrendingUp, TrendingDown, BarChart3, Target, Activity,
  Clock, Play, AlertCircle, CheckCircle2, Trophy
} from "lucide-react";

// ── Constants ──────────────────────────────────────────────────────────────────
const STRATEGIES = [
  { value: "rsi_oversold",      label: "RSI Oversold/Overbought" },
  { value: "macd_crossover",    label: "MACD Crossover" },
  { value: "bollinger_breakout",label: "Bollinger Band Mean Reversion" },
  { value: "ema_crossover",     label: "EMA 20/50 Golden Cross" },
  { value: "sma_crossover",     label: "SMA Crossover" },
  { value: "supertrend",        label: "Supertrend (ATR)" },
  { value: "volume_breakout",   label: "Volume Breakout" },
  { value: "ichimoku",          label: "Ichimoku Cloud" },
];

const PERIODS = [
  { value: "3mo",  label: "3 Monate" },
  { value: "6mo",  label: "6 Monate" },
  { value: "1y",   label: "1 Jahr" },
  { value: "2y",   label: "2 Jahre" },
  { value: "3y",   label: "3 Jahre" },
  { value: "5y",   label: "5 Jahre" },
];

const INTERVALS = [
  { value: "1d",  label: "Täglich" },
  { value: "1wk", label: "Wöchentlich" },
  { value: "1h",  label: "Stündlich" },
  { value: "15m", label: "15 Minuten" },
  { value: "5m",  label: "5 Minuten" },
];

// ── Helpers ────────────────────────────────────────────────────────────────────
function MetricCard({ label, value, positive, sub }: { label: string; value: string; positive?: boolean; sub?: string }) {
  return (
    <div className="bg-white/5 rounded-lg p-3">
      <p className="text-gray-400 text-xs mb-1">{label}</p>
      <p className={`text-lg font-bold font-mono ${
        positive === true ? "text-emerald-400" :
        positive === false ? "text-red-400" :
        "text-white"
      }`}>{value}</p>
      {sub && <p className="text-gray-500 text-[10px] mt-0.5">{sub}</p>}
    </div>
  );
}

function pct(v: number | null | undefined, decimals = 2) {
  if (v == null || isNaN(v)) return "–";
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(decimals)}%`;
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function StrategyBacktest() {
  const [symbol, setSymbol] = useState("AAPL");
  const [inputSymbol, setInputSymbol] = useState("AAPL");
  const [strategy, setStrategy] = useState("rsi_oversold");
  const [period, setPeriod] = useState("3y");
  const [interval, setInterval] = useState("1d");
  const [mode, setMode] = useState<"single" | "compare" | "walkforward">("single");
  const [runEnabled, setRunEnabled] = useState(false);

  // Single backtest
  const singleQuery = trpc.tradingview.backtest.useQuery(
    { symbol, strategy: strategy as any, period, interval },
    { enabled: runEnabled && mode === "single", staleTime: 0, retry: 0 }
  );

  // Compare all strategies
  const compareQuery = trpc.tradingview.compareStrategies.useQuery(
    { symbol, period, interval },
    { enabled: runEnabled && mode === "compare", staleTime: 0, retry: 0 }
  );

  // Walk-forward
  const wfQuery = trpc.tradingview.walkForwardBacktest.useQuery(
    { symbol, strategy, total_period: period, interval, n_splits: 3 },
    { enabled: runEnabled && mode === "walkforward", staleTime: 0, retry: 0 }
  );

  const isLoading = (mode === "single" && singleQuery.isFetching) ||
                    (mode === "compare" && compareQuery.isFetching) ||
                    (mode === "walkforward" && wfQuery.isFetching);

  function handleRun() {
    setSymbol(inputSymbol.trim().toUpperCase());
    setRunEnabled(true);
    // Force refetch if symbol/params changed
    setTimeout(() => {
      if (mode === "single") singleQuery.refetch();
      else if (mode === "compare") compareQuery.refetch();
      else wfQuery.refetch();
    }, 50);
  }

  const singleData = (singleQuery.data as any)?.json ?? singleQuery.data;
  const compareData = (compareQuery.data as any)?.json ?? compareQuery.data;
  const wfData = (wfQuery.data as any)?.json ?? wfQuery.data;

  const compareResults: any[] = useMemo(() => {
    if (!compareData) return [];
    if (Array.isArray(compareData)) return compareData;
    if (Array.isArray(compareData?.results)) return compareData.results;
    return [];
  }, [compareData]);

  const wfFolds: any[] = useMemo(() => {
    if (!wfData) return [];
    if (Array.isArray(wfData)) return wfData;
    if (Array.isArray(wfData?.folds)) return wfData.folds;
    if (Array.isArray(wfData?.results)) return wfData.results;
    return [];
  }, [wfData]);

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white">Strategie-Backtest</h1>
          <p className="text-gray-400 mt-1">
            Teste Handelsstrategien auf historischen Daten via TradingView MCP
          </p>
        </div>

        {/* Controls */}
        <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/20">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3 items-end">
              {/* Symbol */}
              <div className="space-y-1.5">
                <label className="text-xs text-gray-400 font-medium">Symbol</label>
                <Input
                  value={inputSymbol}
                  onChange={e => setInputSymbol(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === "Enter" && handleRun()}
                  placeholder="z.B. AAPL, NESN.SW"
                  className="w-36 bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus:border-[#00CFC1]/50"
                />
              </div>

              {/* Mode */}
              <div className="space-y-1.5">
                <label className="text-xs text-gray-400 font-medium">Modus</label>
                <Select value={mode} onValueChange={(v: any) => setMode(v)}>
                  <SelectTrigger className="w-44 bg-white/5 border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1f2e] border-white/10">
                    <SelectItem value="single">Einzelne Strategie</SelectItem>
                    <SelectItem value="compare">Alle Strategien vergleichen</SelectItem>
                    <SelectItem value="walkforward">Walk-Forward Test</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Strategy (only for single/walkforward) */}
              {mode !== "compare" && (
                <div className="space-y-1.5">
                  <label className="text-xs text-gray-400 font-medium">Strategie</label>
                  <Select value={strategy} onValueChange={setStrategy}>
                    <SelectTrigger className="w-52 bg-white/5 border-white/10 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a1f2e] border-white/10">
                      {STRATEGIES.map(s => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Period */}
              <div className="space-y-1.5">
                <label className="text-xs text-gray-400 font-medium">Zeitraum</label>
                <Select value={period} onValueChange={setPeriod}>
                  <SelectTrigger className="w-32 bg-white/5 border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1f2e] border-white/10">
                    {PERIODS.map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Interval */}
              <div className="space-y-1.5">
                <label className="text-xs text-gray-400 font-medium">Intervall</label>
                <Select value={interval} onValueChange={setInterval}>
                  <SelectTrigger className="w-32 bg-white/5 border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1f2e] border-white/10">
                    {INTERVALS.map(i => (
                      <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Run Button */}
              <Button
                onClick={handleRun}
                disabled={isLoading}
                className="bg-[#00CFC1] hover:bg-[#00b8ad] text-black font-semibold gap-2"
              >
                <Play className="w-4 h-4" />
                {isLoading ? "Läuft..." : "Backtest starten"}
              </Button>
            </div>

            {mode === "compare" && (
              <p className="text-gray-500 text-xs mt-3">
                ⏱ Strategievergleich dauert 2–3 Minuten (9 Strategien werden parallel getestet)
              </p>
            )}
          </CardContent>
        </Card>

        {/* Loading */}
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full bg-white/5" />)}
            <p className="text-gray-500 text-xs text-center">
              {mode === "compare" ? "Alle 9 Strategien werden getestet..." :
               mode === "walkforward" ? "Walk-Forward Analyse läuft..." :
               "Backtest läuft..."}
            </p>
          </div>
        )}

        {/* ── Single Backtest Results ── */}
        {mode === "single" && singleData && !singleQuery.isFetching && (
          <div className="space-y-4">
            <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#00CFC1]" />
                  {symbol} — {STRATEGIES.find(s => s.value === strategy)?.label}
                  <Badge className="bg-[#00CFC1]/20 text-[#00CFC1] border-[#00CFC1]/30 text-xs">
                    {period} · {interval}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <MetricCard
                    label="Gesamtrendite"
                    value={pct(singleData.total_return ?? singleData.total_return_pct)}
                    positive={(singleData.total_return ?? 0) > 0}
                  />
                  <MetricCard
                    label="Trades"
                    value={String(singleData.total_trades ?? singleData.num_trades ?? "–")}
                  />
                  <MetricCard
                    label="Win-Rate"
                    value={`${(singleData.win_rate ?? 0).toFixed(1)}%`}
                    positive={(singleData.win_rate ?? 0) > 50}
                  />
                  <MetricCard
                    label="Max. Drawdown"
                    value={pct(singleData.max_drawdown)}
                    positive={false}
                  />
                  {singleData.sharpe_ratio != null && (
                    <MetricCard
                      label="Sharpe Ratio"
                      value={(singleData.sharpe_ratio ?? 0).toFixed(2)}
                      positive={(singleData.sharpe_ratio ?? 0) > 1}
                    />
                  )}
                  {singleData.profit_factor != null && (
                    <MetricCard
                      label="Profit Factor"
                      value={(singleData.profit_factor ?? 0).toFixed(2)}
                      positive={(singleData.profit_factor ?? 0) > 1}
                    />
                  )}
                  {singleData.buy_hold_return != null && (
                    <MetricCard
                      label="Buy & Hold"
                      value={pct(singleData.buy_hold_return)}
                      positive={(singleData.buy_hold_return ?? 0) > 0}
                      sub="Benchmark"
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Compare Results ── */}
        {mode === "compare" && compareResults.length > 0 && !compareQuery.isFetching && (
          <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-sm flex items-center gap-2">
                <Trophy className="w-4 h-4 text-yellow-400" />
                Strategievergleich — {symbol}
                <Badge className="bg-[#00CFC1]/20 text-[#00CFC1] border-[#00CFC1]/30 text-xs">
                  {period} · {interval}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {/* Buy & Hold benchmark */}
              {compareData?.buy_hold_return != null && (
                <div className="mb-3 px-3 py-2 rounded-lg bg-[#00CFC1]/10 border border-[#00CFC1]/20">
                  <span className="text-[#00CFC1] text-sm font-medium">
                    Buy & Hold Benchmark: {pct(compareData.buy_hold_return)}
                  </span>
                </div>
              )}
              <div className="space-y-2">
                {compareResults
                  .sort((a, b) => (b.total_return ?? 0) - (a.total_return ?? 0))
                  .map((r: any, i: number) => (
                    <div
                      key={i}
                      className={`flex items-center justify-between rounded-lg px-3 py-2.5 ${
                        i === 0 ? "bg-[#00CFC1]/10 border border-[#00CFC1]/20" : "bg-white/5"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {i === 0 && <Trophy className="w-3.5 h-3.5 text-yellow-400" />}
                        {i > 0 && <span className="text-gray-500 text-xs w-4">{i + 1}.</span>}
                        <span className="text-white text-sm font-medium">{r.strategy_name ?? r.strategy}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs font-mono">
                        <span className={r.total_return > 0 ? "text-emerald-400" : "text-red-400"}>
                          {pct(r.total_return)}
                        </span>
                        <span className="text-gray-400">Win: {(r.win_rate ?? 0).toFixed(1)}%</span>
                        <span className="text-gray-400">{r.total_trades ?? 0} Trades</span>
                        {r.sharpe_ratio != null && (
                          <span className="text-gray-500">Sharpe: {(r.sharpe_ratio ?? 0).toFixed(2)}</span>
                        )}
                        {r.max_drawdown != null && (
                          <span className="text-red-400">DD: {pct(r.max_drawdown)}</span>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Walk-Forward Results ── */}
        {mode === "walkforward" && wfFolds.length > 0 && !wfQuery.isFetching && (
          <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-sm flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#00CFC1]" />
                Walk-Forward — {symbol} · {STRATEGIES.find(s => s.value === strategy)?.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {/* Summary */}
              {wfData?.avg_test_return != null && (
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <MetricCard
                    label="Ø Test-Rendite"
                    value={pct(wfData.avg_test_return)}
                    positive={(wfData.avg_test_return ?? 0) > 0}
                    sub="Out-of-Sample"
                  />
                  <MetricCard
                    label="Robustheit"
                    value={`${((wfData.robustness ?? 0) * 100).toFixed(0)}%`}
                    positive={(wfData.robustness ?? 0) > 0.5}
                  />
                  <MetricCard
                    label="Folds"
                    value={String(wfFolds.length)}
                  />
                </div>
              )}
              {/* Overfitting Warning */}
              {(() => {
                const robustness = wfData?.robustness ?? 0;
                const avgTestReturn = wfData?.avg_test_return ?? 0;
                const avgTrainReturn = wfData?.avg_train_return ?? 0;
                const noOosTrades = wfFolds.every((f: any) => (f.test_trades ?? 0) === 0);
                const isOverfitted = noOosTrades || (robustness < 0.3 && avgTrainReturn > 0 && avgTestReturn <= 0);
                const isWeak = !isOverfitted && robustness < 0.5;
                if (isOverfitted) return (
                  <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 p-3">
                    <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-red-400 text-xs font-semibold">Overfitting erkannt</p>
                      <p className="text-gray-400 text-xs mt-0.5">
                        {noOosTrades
                          ? 'Die Strategie generiert im Out-of-Sample-Zeitraum keine Trades — die In-Sample-Signale wiederholen sich nicht. Die historischen Ergebnisse sind statistisch nicht robust.'
                          : 'Hohe Trainings-Rendite, aber negative Test-Rendite. Die Strategie ist auf historische Daten überangepasst.'}
                      </p>
                    </div>
                  </div>
                );
                if (isWeak) return (
                  <div className="mb-4 flex items-start gap-2 rounded-lg border border-orange-500/40 bg-orange-500/10 p-3">
                    <AlertCircle className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-orange-400 text-xs font-semibold">Schwache Robustheit</p>
                      <p className="text-gray-400 text-xs mt-0.5">Robustheit unter 50% — die Strategie ist möglicherweise nicht zuverlässig genug für den Liveeinsatz.</p>
                    </div>
                  </div>
                );
                return (
                  <div className="mb-4 flex items-start gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-emerald-400 text-xs font-semibold">Robuste Strategie</p>
                      <p className="text-gray-400 text-xs mt-0.5">Robustheit über 50% — die Out-of-Sample-Ergebnisse bestätigen die In-Sample-Performance.</p>
                    </div>
                  </div>
                );
              })()}
              {/* Fold Details */}
              <div className="space-y-2">
                {wfFolds.map((fold: any, i: number) => (
                  <div key={i} className="bg-white/5 rounded-lg px-3 py-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-xs font-medium">Fold {i + 1}</span>
                      <div className="flex items-center gap-4 text-xs font-mono">
                        <span className="text-gray-500">
                          Train: <span className={fold.train_return > 0 ? "text-emerald-400" : "text-red-400"}>
                            {pct(fold.train_return)}
                          </span>
                        </span>
                        <span className="text-gray-300">
                          Test: <span className={fold.test_return > 0 ? "text-emerald-400" : "text-red-400"}>
                            {pct(fold.test_return)}
                          </span>
                        </span>
                        <span className="text-gray-500">{fold.test_trades ?? 0} Trades</span>
                        {fold.robustness != null && (
                          <span className={fold.robustness > 0.5 ? "text-emerald-400" : "text-orange-400"}>
                            {fold.robustness > 0.5 ? <CheckCircle2 className="w-3.5 h-3.5 inline" /> : <AlertCircle className="w-3.5 h-3.5 inline" />}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Errors */}
        {(singleQuery.error || compareQuery.error || wfQuery.error) && !isLoading && (
          <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-red-500/20">
            <CardContent className="p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 mt-0.5" />
                <p className="text-gray-400 text-sm">
                  {singleQuery.error?.message || compareQuery.error?.message || wfQuery.error?.message}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
