/**
 * TradingViewBacktestTab
 * Allows running a strategy backtest via the TradingView Analytics Bridge.
 */
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, Play, TrendingUp, TrendingDown, BarChart2, RefreshCw } from "lucide-react";
import { useState } from "react";

interface Props {
  ticker: string;
  exchange?: string;
}

const STRATEGIES = [
  { value: "rsi", label: "RSI (14)" },
  { value: "bollinger", label: "Bollinger Bands" },
  { value: "macd", label: "MACD" },
  { value: "ema_cross", label: "EMA Cross" },
  { value: "supertrend", label: "Supertrend" },
  { value: "donchian", label: "Donchian Channel" },
  { value: "rsi_pullback", label: "RSI Pullback" },
  { value: "keltner", label: "Keltner Breakout" },
  { value: "triple_ema", label: "Triple EMA" },
];

const TIMEFRAMES = [
  { value: "1d", label: "Täglich" },
  { value: "1w", label: "Wöchentlich" },
  { value: "4h", label: "4 Stunden" },
  { value: "1h", label: "1 Stunde" },
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

export default function TradingViewBacktestTab({ ticker, exchange }: Props) {
  const [strategy, setStrategy] = useState<string>("rsi");
  const [timeframe, setTimeframe] = useState<string>("1d");
  const [runCompare, setRunCompare] = useState(false);

  const health = trpc.tradingview.health.useQuery(undefined, { staleTime: 60_000 });

  const backtest = trpc.tradingview.backtest.useMutation();
  const compare = trpc.tradingview.compareStrategies.useMutation();

  if (!health.data || health.data.status !== "ok") {
    return (
      <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-amber-500/20">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
            <div>
              <h3 className="text-white font-medium mb-1">TradingView Bridge nicht konfiguriert</h3>
              <p className="text-gray-400 text-sm">
                Deploye den <code className="text-[#00CFC1]">tradingview-service</code> auf Railway und setze{" "}
                <code className="text-[#00CFC1]">TRADINGVIEW_BRIDGE_URL</code> in den App-Secrets.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const result = backtest.data as any;
  const compareResult = compare.data as any;

  return (
    <div className="space-y-4">
      {/* Strategy Selector */}
      <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-base flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-[#00CFC1]" />
            Strategie-Backtest für {ticker}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="flex-1 min-w-[180px]">
              <label className="text-gray-500 text-xs uppercase tracking-wide mb-1.5 block">Strategie</label>
              <Select value={strategy} onValueChange={setStrategy}>
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
            <div className="flex-1 min-w-[140px]">
              <label className="text-gray-500 text-xs uppercase tracking-wide mb-1.5 block">Zeitrahmen</label>
              <Select value={timeframe} onValueChange={setTimeframe}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1f2e] border-white/10">
                  {TIMEFRAMES.map(t => (
                    <SelectItem key={t.value} value={t.value} className="text-white hover:bg-white/10">
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              className="bg-[#00CFC1] hover:bg-[#00b8ad] text-black font-medium"
              disabled={backtest.isPending}
              onClick={() => {
                setRunCompare(false);
                backtest.mutate({ symbol: ticker, exchange, strategy: strategy as any, timeframe, includeEquityCurve: false });
              }}
            >
              {backtest.isPending ? (
                <><RefreshCw className="w-3 h-3 mr-2 animate-spin" /> Läuft…</>
              ) : (
                <><Play className="w-3 h-3 mr-2" /> Backtest starten</>
              )}
            </Button>
            <Button
              variant="outline"
              className="border-[#00CFC1]/30 text-[#00CFC1] hover:bg-[#00CFC1]/10"
              disabled={compare.isPending}
              onClick={() => {
                setRunCompare(true);
                compare.mutate({ symbol: ticker, exchange, timeframe });
              }}
            >
              {compare.isPending ? (
                <><RefreshCw className="w-3 h-3 mr-2 animate-spin" /> Vergleiche…</>
              ) : (
                "Alle 9 Strategien vergleichen"
              )}
            </Button>
          </div>

          {(backtest.error || compare.error) && (
            <p className="text-red-400 text-sm mt-3">
              {(backtest.error || compare.error)?.message}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Single Backtest Result */}
      {!runCompare && result && (
        <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base flex items-center gap-2">
              Ergebnis: {STRATEGIES.find(s => s.value === strategy)?.label}
              <Badge className={
                (result.total_return ?? result.totalReturn ?? 0) >= 0
                  ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                  : "bg-red-500/20 text-red-400 border-red-500/30"
              }>
                {(result.total_return ?? result.totalReturn ?? 0) >= 0 ? "+" : ""}
                {((result.total_return ?? result.totalReturn ?? 0) * 100).toFixed(2)}%
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <MetricCard label="Gesamtrendite" value={`${((result.total_return ?? result.totalReturn ?? 0) * 100).toFixed(2)}%`} positive={(result.total_return ?? result.totalReturn ?? 0) >= 0} />
              <MetricCard label="Sharpe Ratio" value={(result.sharpe_ratio ?? result.sharpeRatio ?? 0).toFixed(3)} positive={(result.sharpe_ratio ?? result.sharpeRatio ?? 0) >= 1} />
              <MetricCard label="Max Drawdown" value={`${((result.max_drawdown ?? result.maxDrawdown ?? 0) * 100).toFixed(2)}%`} positive={false} />
              <MetricCard label="Win Rate" value={`${((result.win_rate ?? result.winRate ?? 0) * 100).toFixed(1)}%`} positive={(result.win_rate ?? result.winRate ?? 0) >= 0.5} />
              <MetricCard label="Trades" value={String(result.total_trades ?? result.totalTrades ?? 0)} />
              <MetricCard label="Profit Factor" value={(result.profit_factor ?? result.profitFactor ?? 0).toFixed(2)} positive={(result.profit_factor ?? result.profitFactor ?? 0) >= 1} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Compare All Strategies Result */}
      {runCompare && compareResult && (
        <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base">Strategie-Vergleich (Leaderboard)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(compareResult.strategies || compareResult.results || []).map((s: any, i: number) => {
                const ret = s.total_return ?? s.totalReturn ?? 0;
                const isPositive = ret >= 0;
                return (
                  <div key={i} className="flex items-center gap-3 p-2.5 bg-white/5 rounded-lg">
                    <span className="text-gray-500 text-xs w-5 text-right">{i + 1}.</span>
                    <span className="text-white text-sm flex-1">{s.strategy_name ?? s.name ?? s.strategy}</span>
                    <span className={`font-mono text-sm ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
                      {isPositive ? "+" : ""}{(ret * 100).toFixed(2)}%
                    </span>
                    <span className="text-gray-500 text-xs font-mono">
                      SR {(s.sharpe_ratio ?? s.sharpeRatio ?? 0).toFixed(2)}
                    </span>
                    {i === 0 && <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">Beste</Badge>}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
