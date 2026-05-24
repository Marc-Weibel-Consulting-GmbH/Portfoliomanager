/**
 * CopilotBacktest Component
 * =========================
 * Displays the backtest results of the Portfolio Copilot strategy
 * with equity curve chart, summary KPIs, and monthly breakdown.
 */

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TrendingUp, TrendingDown, BarChart3, Target, Clock, AlertTriangle, Info } from 'lucide-react';

interface CopilotBacktestProps {
  portfolioId: number;
}

export default function CopilotBacktest({ portfolioId }: CopilotBacktestProps) {
  const [months, setMonths] = useState(12);
  const [tradingCostBps, setTradingCostBps] = useState(10);
  const [maxTurnover, setMaxTurnover] = useState(0.30);
  const [runBacktest, setRunBacktest] = useState(false);

  const { data, isLoading, error } = trpc.copilot.backtest.useQuery(
    { portfolioId, months, tradingCostBps, maxTurnoverPerMonth: maxTurnover },
    { enabled: runBacktest, staleTime: 5 * 60 * 1000 }
  );

  const result = data?.result;
  const apiError = data?.error;

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Copilot Backtest
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Simuliert die monatlichen Rebalancing-Empfehlungen des Copilots über die Vergangenheit 
            und vergleicht die Performance mit Buy-and-Hold.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Zeitraum</label>
              <Select value={String(months)} onValueChange={(v) => { setMonths(Number(v)); setRunBacktest(false); }}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="6">6 Monate</SelectItem>
                  <SelectItem value="9">9 Monate</SelectItem>
                  <SelectItem value="12">12 Monate</SelectItem>
                  <SelectItem value="18">18 Monate</SelectItem>
                  <SelectItem value="24">2 Jahre</SelectItem>
                  <SelectItem value="36">3 Jahre</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Handelskosten</label>
              <Select value={String(tradingCostBps)} onValueChange={(v) => { setTradingCostBps(Number(v)); setRunBacktest(false); }}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">0 bps (kostenlos)</SelectItem>
                  <SelectItem value="5">5 bps</SelectItem>
                  <SelectItem value="10">10 bps</SelectItem>
                  <SelectItem value="20">20 bps</SelectItem>
                  <SelectItem value="50">50 bps</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Max. Turnover/Monat</label>
              <Select value={String(maxTurnover)} onValueChange={(v) => { setMaxTurnover(Number(v)); setRunBacktest(false); }}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.10">10%</SelectItem>
                  <SelectItem value="0.20">20%</SelectItem>
                  <SelectItem value="0.30">30%</SelectItem>
                  <SelectItem value="0.50">50%</SelectItem>
                  <SelectItem value="1.00">100% (unbegrenzt)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button 
              onClick={() => setRunBacktest(true)} 
              disabled={isLoading}
              className="min-w-[160px]"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                  Berechne...
                </span>
              ) : (
                'Backtest starten'
              )}
            </Button>
          </div>
          {isLoading && (
            <p className="text-xs text-muted-foreground mt-3">
              ⏳ Lade historische Kursdaten und berechne monatliche Rankings... Dies kann 30-60 Sekunden dauern.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Error */}
      {(apiError || error) && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-4">
            <p className="text-sm text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              {apiError || error?.message || 'Backtest fehlgeschlagen'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && (
        <>
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPICard
              label="Copilot Rendite"
              value={`${(result.summary.copilotTotalReturn * 100).toFixed(1)}%`}
              positive={result.summary.copilotTotalReturn > 0}
              icon={<TrendingUp className="h-4 w-4" />}
            />
            <KPICard
              label="Buy & Hold Rendite"
              value={`${(result.summary.buyHoldTotalReturn * 100).toFixed(1)}%`}
              positive={result.summary.buyHoldTotalReturn > 0}
              icon={<BarChart3 className="h-4 w-4" />}
            />
            <KPICard
              label="Alpha (Überperformance)"
              value={`${result.summary.alpha > 0 ? '+' : ''}${(result.summary.alpha * 100).toFixed(2)}%`}
              positive={result.summary.alpha > 0}
              highlight
              icon={<Target className="h-4 w-4" />}
            />
            <KPICard
              label="Hit Rate"
              value={`${(result.summary.hitRate * 100).toFixed(0)}%`}
              positive={result.summary.hitRate > 0.5}
              subtitle={`${result.summary.monthsOutperformed}/${result.monthly.length} Monate`}
              icon={<Target className="h-4 w-4" />}
            />
          </div>

          {/* Detailed metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard label="Copilot Sharpe" value={result.summary.copilotSharpe.toFixed(2)} />
            <MetricCard label="B&H Sharpe" value={result.summary.buyHoldSharpe.toFixed(2)} />
            <MetricCard label="Copilot Max DD" value={`-${(result.summary.copilotMaxDrawdown * 100).toFixed(1)}%`} />
            <MetricCard label="B&H Max DD" value={`-${(result.summary.buyHoldMaxDrawdown * 100).toFixed(1)}%`} />
            <MetricCard label="Ø Alpha/Monat" value={`${(result.summary.avgMonthlyAlpha * 100).toFixed(2)}%`} />
            <MetricCard label="Gesamter Turnover" value={`${(result.summary.totalTurnover * 100).toFixed(0)}%`} />
            <MetricCard label="Handelskosten" value={`-${(result.summary.totalTradingCosts * 100).toFixed(2)}%`} />
            <MetricCard label="Monate positiv" value={`${result.summary.monthsPositive}/${result.monthly.length}`} />
          </div>

          {/* Equity Curve */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Equity-Kurve</CardTitle>
            </CardHeader>
            <CardContent>
              <EquityCurveChart equityCurve={result.equityCurve} />
            </CardContent>
          </Card>

          {/* Monthly Breakdown */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                Monatliche Performance
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs text-xs">
                      Zeigt die monatliche Rendite des Copilots vs. Buy-and-Hold. 
                      Grün = Copilot hat outperformed, Rot = underperformed.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground">Monat</th>
                      <th className="text-right py-2 px-2 font-medium text-muted-foreground">Copilot</th>
                      <th className="text-right py-2 px-2 font-medium text-muted-foreground">B&H</th>
                      <th className="text-right py-2 px-2 font-medium text-muted-foreground">Alpha</th>
                      <th className="text-right py-2 px-2 font-medium text-muted-foreground">Turnover</th>
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground">Top Ranking</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.monthly.map((m, idx) => (
                      <tr key={idx} className="border-b border-border/20 hover:bg-muted/30">
                        <td className="py-2 px-2 font-mono text-xs">{m.month}</td>
                        <td className={`py-2 px-2 text-right font-mono text-xs ${m.copilotReturn >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                          {m.copilotReturn >= 0 ? '+' : ''}{(m.copilotReturn * 100).toFixed(2)}%
                        </td>
                        <td className={`py-2 px-2 text-right font-mono text-xs ${m.buyHoldReturn >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                          {m.buyHoldReturn >= 0 ? '+' : ''}{(m.buyHoldReturn * 100).toFixed(2)}%
                        </td>
                        <td className={`py-2 px-2 text-right font-mono text-xs font-semibold ${m.alpha >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                          {m.alpha >= 0 ? '+' : ''}{(m.alpha * 100).toFixed(2)}%
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-xs text-muted-foreground">
                          {(m.turnover * 100).toFixed(0)}%
                        </td>
                        <td className="py-2 px-2 text-xs text-muted-foreground">
                          {m.rankings.slice(0, 2).map(r => `${r.ticker}(${r.score})`).join(', ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Disclaimer */}
          <p className="text-xs text-muted-foreground italic px-1">
            ⚠️ Hinweis: Vergangene Performance ist kein Indikator für zukünftige Ergebnisse. 
            Der Backtest verwendet historische Daten und simuliert die Ranking-Algorithmen rückwirkend. 
            Tatsächliche Handelskosten, Slippage und Liquidität können abweichen.
          </p>
        </>
      )}
    </div>
  );
}

// ============================================================
// SUB-COMPONENTS
// ============================================================

function KPICard({ label, value, positive, highlight, subtitle, icon }: {
  label: string;
  value: string;
  positive: boolean;
  highlight?: boolean;
  subtitle?: string;
  icon?: React.ReactNode;
}) {
  return (
    <Card className={`border-border/50 ${highlight ? (positive ? 'ring-1 ring-emerald-500/30 bg-emerald-500/5' : 'ring-1 ring-red-500/30 bg-red-500/5') : ''}`}>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
          {icon}
          {label}
        </div>
        <p className={`text-xl font-bold ${positive ? 'text-emerald-500' : 'text-red-500'}`}>
          {value}
        </p>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/30 rounded-lg px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold font-mono">{value}</p>
    </div>
  );
}

function EquityCurveChart({ equityCurve }: { equityCurve: { dates: string[]; copilot: number[]; buyHold: number[] } }) {
  const { dates, copilot, buyHold } = equityCurve;
  
  if (dates.length < 2) return <p className="text-sm text-muted-foreground">Nicht genug Daten für Chart.</p>;

  // SVG-based equity curve
  const width = 700;
  const height = 250;
  const padding = { top: 20, right: 60, bottom: 30, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const allValues = [...copilot, ...buyHold];
  const minVal = Math.min(...allValues) * 0.98;
  const maxVal = Math.max(...allValues) * 1.02;

  const xScale = (i: number) => padding.left + (i / (dates.length - 1)) * chartWidth;
  const yScale = (v: number) => padding.top + (1 - (v - minVal) / (maxVal - minVal)) * chartHeight;

  const copilotPath = copilot.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(v)}`).join(' ');
  const buyHoldPath = buyHold.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(v)}`).join(' ');

  // Y-axis ticks
  const yTicks = 5;
  const yTickValues = Array.from({ length: yTicks }, (_, i) => minVal + (i / (yTicks - 1)) * (maxVal - minVal));

  // X-axis labels (show every 3rd date)
  const xLabelInterval = Math.max(1, Math.floor(dates.length / 6));

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-[700px] h-auto">
        {/* Grid lines */}
        {yTickValues.map((v, i) => (
          <g key={i}>
            <line
              x1={padding.left}
              y1={yScale(v)}
              x2={width - padding.right}
              y2={yScale(v)}
              stroke="currentColor"
              strokeOpacity={0.1}
              strokeDasharray="2,2"
            />
            <text
              x={padding.left - 8}
              y={yScale(v) + 4}
              textAnchor="end"
              className="fill-muted-foreground"
              fontSize={10}
            >
              {((v - 1) * 100).toFixed(0)}%
            </text>
          </g>
        ))}

        {/* X-axis labels */}
        {dates.map((d, i) => {
          if (i % xLabelInterval !== 0 && i !== dates.length - 1) return null;
          return (
            <text
              key={i}
              x={xScale(i)}
              y={height - 5}
              textAnchor="middle"
              className="fill-muted-foreground"
              fontSize={9}
            >
              {d.substring(5, 7)}/{d.substring(2, 4)}
            </text>
          );
        })}

        {/* Zero line */}
        <line
          x1={padding.left}
          y1={yScale(1)}
          x2={width - padding.right}
          y2={yScale(1)}
          stroke="currentColor"
          strokeOpacity={0.3}
          strokeWidth={1}
        />

        {/* Buy & Hold line */}
        <path d={buyHoldPath} fill="none" stroke="#94a3b8" strokeWidth={2} strokeDasharray="4,3" />

        {/* Copilot line */}
        <path d={copilotPath} fill="none" stroke="#10b981" strokeWidth={2.5} />

        {/* End labels */}
        <text x={xScale(dates.length - 1) + 8} y={yScale(copilot[copilot.length - 1]) + 4} fontSize={10} className="fill-emerald-500 font-semibold">
          {((copilot[copilot.length - 1] - 1) * 100).toFixed(1)}%
        </text>
        <text x={xScale(dates.length - 1) + 8} y={yScale(buyHold[buyHold.length - 1]) + 4} fontSize={10} className="fill-slate-400">
          {((buyHold[buyHold.length - 1] - 1) * 100).toFixed(1)}%
        </text>

        {/* Legend */}
        <line x1={padding.left} y1={8} x2={padding.left + 20} y2={8} stroke="#10b981" strokeWidth={2.5} />
        <text x={padding.left + 25} y={12} fontSize={10} className="fill-foreground">Copilot</text>
        <line x1={padding.left + 80} y1={8} x2={padding.left + 100} y2={8} stroke="#94a3b8" strokeWidth={2} strokeDasharray="4,3" />
        <text x={padding.left + 105} y={12} fontSize={10} className="fill-foreground">Buy & Hold</text>
      </svg>
    </div>
  );
}
