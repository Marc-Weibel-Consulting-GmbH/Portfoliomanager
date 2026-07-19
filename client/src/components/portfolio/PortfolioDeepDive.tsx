/**
 * PortfolioDeepDive — Fundamentaldaten (EODHD) + KI-Analyse einer Portfolio-Position.
 *
 * F-12: Ausgegliedert aus dem früheren Copilot-«Deep-Dive»-Tab. Der Copilot enthält
 * gemäss Fachreview nur noch Chat + Verlauf; die Portfolio-Tiefenanalyse gehört in die
 * Sektion «Portfolios» und wird hier als Tab der Portfolio-Detailseite eingebunden.
 * Anders als die alte Copilot-Variante wählt diese Version kein Portfolio selbst aus,
 * sondern erhält die aktuell geöffnete portfolioId als Prop.
 */
import { useState, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { InsightPanel } from '@/components/InsightPanel';
import {
  Brain,
  RefreshCw,
  AlertTriangle,
  BarChart3,
  PieChart,
  TrendingDown,
  DollarSign,
  Activity,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
} from 'lucide-react';
import { KpiTooltip } from '@/components/ui/KpiTooltip';

const SECTOR_COLORS: Record<string, string> = {
  'Technology': '#00CFC1',
  'Healthcare': '#6366f1',
  'Financials': '#f59e0b',
  'Consumer Discretionary': '#ec4899',
  'Consumer Staples': '#10b981',
  'Industrials': '#3b82f6',
  'Energy': '#f97316',
  'Materials': '#84cc16',
  'Real Estate': '#a78bfa',
  'Utilities': '#06b6d4',
  'Communication Services': '#e879f9',
  'Financial Services': '#f59e0b',
  'Basic Materials': '#84cc16',
  'Consumer Defensive': '#10b981',
  'Unbekannt': '#64748b',
};
function sectorColor(sector: string): string {
  return SECTOR_COLORS[sector] || '#64748b';
}

type SortKey = 'ticker' | 'sector' | 'weight' | 'peRatio' | 'pegRatio' | 'beta' | 'dividendYield';
type SortDir = 'asc' | 'desc';

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown className="w-3 h-3 text-gray-600 inline ml-0.5" />;
  return sortDir === 'asc'
    ? <ChevronUp className="w-3 h-3 text-[#00CFC1] inline ml-0.5" />
    : <ChevronDown className="w-3 h-3 text-[#00CFC1] inline ml-0.5" />;
}

export default function PortfolioDeepDive({ portfolioId }: { portfolioId: number }) {
  const { data, isLoading, error, refetch, isFetching } = trpc.copilot.portfolioDeepDive.useQuery(
    { portfolioId },
    { enabled: !!portfolioId, staleTime: 10 * 60 * 1000, retry: 1 }
  );

  const [sortKey, setSortKey] = useState<SortKey>('weight');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const fmtNum = (v: number | null | undefined, dec = 2) =>
    v !== null && v !== undefined ? v.toFixed(dec) : '–';

  function handleSort(col: SortKey) {
    if (sortKey === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(col);
      // Numeric columns default desc (highest first), text columns default asc
      setSortDir(['ticker', 'sector'].includes(col) ? 'asc' : 'desc');
    }
  }

  const sortedHoldings = useMemo(() => {
    if (!data?.holdings) return [];
    const rows = [...data.holdings];
    rows.sort((a: any, b: any) => {
      let av = a[sortKey];
      let bv = b[sortKey];

      // Nulls always last regardless of direction
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;

      if (typeof av === 'string') {
        const cmp = av.localeCompare(bv);
        return sortDir === 'asc' ? cmp : -cmp;
      }
      return sortDir === 'asc' ? av - bv : bv - av;
    });
    return rows;
  }, [data?.holdings, sortKey, sortDir]);

  const thClass = (col: SortKey, align: 'left' | 'right' = 'right') =>
    `${align === 'left' ? 'text-left' : 'text-right'} text-gray-500 pb-2 pr-3 cursor-pointer select-none hover:text-gray-300 transition-colors whitespace-nowrap`;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <PieChart className="w-4 h-4 text-[#00CFC1]" />
            Portfolio Deep-Dive
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">EODHD-Fundamentaldaten + KI-Analyse</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}
          className="text-slate-400 hover:text-[#00CFC1] h-8">
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {isLoading && (
        <div className="space-y-4">
          {/* Progress indicator with estimated time */}
          <div className="bg-slate-900/60 border border-slate-700/40 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-300 flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-[#00CFC1] animate-pulse" />
                Fundamentaldaten werden geladen…
              </span>
              <span className="text-xs text-slate-500">ca. 15–30 Sek.</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div className="h-full bg-[#00CFC1] rounded-full" style={{ width: '100%', animation: 'indeterminate 2s ease-in-out infinite' }} />
            </div>
            <p className="text-xs text-slate-600 mt-2">EODHD-API · KI-Analyse · Sektorverteilung</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-20 bg-slate-800/50" />)}
          </div>
        </div>
      )}

      {error && (
        <Card className="bg-slate-800/30 border-slate-700/50">
          <CardContent className="py-8 text-center">
            <AlertTriangle className="w-8 h-8 mx-auto text-amber-500/50 mb-2" />
            <p className="text-slate-400 text-sm">Fehler beim Laden der Fundamentaldaten.</p>
          </CardContent>
        </Card>
      )}

      {!isLoading && data && !data.error && (
        <>
          {/* KPI Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Ø KGV (P/E)', value: fmtNum(data.portfolioMetrics?.avgPE, 1), icon: <BarChart3 className="w-4 h-4 text-[#00CFC1]" />, hint: 'Gewichtetes Kurs-Gewinn-Verhältnis', kpi: 'pe' as const },
              { label: 'Ø PEG', value: fmtNum(data.portfolioMetrics?.avgPEG, 2), icon: <Activity className="w-4 h-4 text-blue-400" />, hint: 'PEG < 1 = günstig bewertet', kpi: 'peg' as const },
              { label: 'Ø Beta', value: fmtNum(data.portfolioMetrics?.avgBeta, 2), icon: <TrendingDown className="w-4 h-4 text-amber-400" />, hint: 'Marktrisiko: 1 = Markt, >1 = aggressiv', kpi: 'beta' as const },
              { label: 'Ø Dividende', value: data.portfolioMetrics?.avgDividendYield !== null && data.portfolioMetrics?.avgDividendYield !== undefined ? `${fmtNum(data.portfolioMetrics.avgDividendYield, 1)}%` : '–', icon: <DollarSign className="w-4 h-4 text-emerald-400" />, hint: 'Gewichtete Dividendenrendite', kpi: 'dividend' as const },
            ].map((kpi) => (
              <div key={kpi.label} className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border border-white/10 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  {kpi.icon}
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider">{kpi.label}</span>
                  <KpiTooltip kpi={kpi.kpi} iconOnly side="top" />
                </div>
                <div className="text-xl font-bold text-white">{kpi.value}</div>
                <div className="text-[10px] text-gray-600 mt-0.5">{kpi.hint}</div>
              </div>
            ))}
          </div>

          {/* Sector Breakdown + Top Dividend */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border border-white/10 rounded-lg p-4">
              <h4 className="text-xs font-semibold text-white mb-3 flex items-center gap-2">
                <PieChart className="w-3.5 h-3.5 text-[#00CFC1]" /> Sektorverteilung
              </h4>
              <div className="space-y-2">
                {(data.sectorBreakdown || []).map((s: any) => (
                  <div key={s.sector}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs text-gray-300">{s.sector}</span>
                      <span className="text-xs font-medium" style={{ color: sectorColor(s.sector) }}>{s.weight.toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(s.weight, 100)}%`, backgroundColor: sectorColor(s.sector) }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {(data.topDividend || []).length > 0 && (
                <div className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border border-white/10 rounded-lg p-4">
                  <h4 className="text-xs font-semibold text-white mb-2 flex items-center gap-2">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-400" /> Top Dividendenzahler
                  </h4>
                  <div className="space-y-1.5">
                    {data.topDividend.map((d: any) => (
                      <div key={d.ticker} className="flex items-center justify-between">
                        <span className="text-xs text-gray-300">{d.ticker} <span className="text-gray-600 text-[10px]">{d.name}</span></span>
                        <span className="text-xs font-medium text-emerald-400">{fmtNum(d.yield, 1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {(data.highBeta || []).length > 0 && (
                <div className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border border-white/10 rounded-lg p-4">
                  <h4 className="text-xs font-semibold text-white mb-2 flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5 text-amber-400" /> Höchstes Beta (Risiko)
                  </h4>
                  <div className="space-y-1.5">
                    {data.highBeta.map((b: any) => (
                      <div key={b.ticker} className="flex items-center justify-between">
                        <span className="text-xs text-gray-300">{b.ticker} <span className="text-gray-600 text-[10px]">{b.name}</span></span>
                        <span className={`text-xs font-medium ${Math.abs(b.beta) > 1.5 ? 'text-red-400' : 'text-amber-400'}`}>{fmtNum(b.beta, 2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Holdings Table — sortierbar */}
          <div className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border border-white/10 rounded-lg p-4">
            <h4 className="text-xs font-semibold text-white mb-3 flex items-center gap-2">
              <BarChart3 className="w-3.5 h-3.5 text-[#00CFC1]" /> Positionen — Fundamentaldaten
              <span className="text-[10px] text-gray-600 font-normal ml-1">Spaltenüberschrift klicken zum Sortieren</span>
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className={thClass('ticker', 'left')} onClick={() => handleSort('ticker')}>
                      Ticker <SortIcon col="ticker" sortKey={sortKey} sortDir={sortDir} />
                    </th>
                    <th className={thClass('sector', 'left')} onClick={() => handleSort('sector')}>
                      Sektor <SortIcon col="sector" sortKey={sortKey} sortDir={sortDir} />
                    </th>
                    <th className={thClass('weight')} onClick={() => handleSort('weight')}>
                      Gewicht <SortIcon col="weight" sortKey={sortKey} sortDir={sortDir} />
                    </th>
                    <th className={thClass('peRatio')} onClick={() => handleSort('peRatio')}>
                      <span className="inline-flex items-center gap-0.5">KGV <SortIcon col="peRatio" sortKey={sortKey} sortDir={sortDir} /><KpiTooltip kpi="pe" iconOnly side="top" /></span>
                    </th>
                    <th className={thClass('pegRatio')} onClick={() => handleSort('pegRatio')}>
                      <span className="inline-flex items-center gap-0.5">PEG <SortIcon col="pegRatio" sortKey={sortKey} sortDir={sortDir} /><KpiTooltip kpi="peg" iconOnly side="top" /></span>
                    </th>
                    <th className={thClass('beta')} onClick={() => handleSort('beta')}>
                      <span className="inline-flex items-center gap-0.5">Beta <SortIcon col="beta" sortKey={sortKey} sortDir={sortDir} /><KpiTooltip kpi="beta" iconOnly side="top" /></span>
                    </th>
                    <th className={`text-right text-gray-500 pb-2 cursor-pointer select-none hover:text-gray-300 transition-colors whitespace-nowrap`} onClick={() => handleSort('dividendYield')}>
                      <span className="inline-flex items-center gap-0.5">Div. <SortIcon col="dividendYield" sortKey={sortKey} sortDir={sortDir} /><KpiTooltip kpi="dividend" iconOnly side="top" /></span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedHoldings.map((h: any, idx: number) => (
                    <tr key={`${h.ticker}-${idx}`} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                      <td className="py-1.5 pr-3">
                        <span className="font-medium text-white">{h.ticker}</span>
                        <span className="text-gray-600 ml-1 hidden md:inline">{h.name}</span>
                      </td>
                      <td className="py-1.5 pr-3">
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: `${sectorColor(h.sector)}20`, color: sectorColor(h.sector) }}>{h.sector}</span>
                      </td>
                      <td className="py-1.5 pr-3 text-right text-gray-300">{h.weight.toFixed(1)}%</td>
                      <td className="py-1.5 pr-3 text-right text-gray-300">{h.peRatio !== null ? h.peRatio : '–'}</td>
                      <td className="py-1.5 pr-3 text-right text-gray-300">{h.pegRatio !== null ? h.pegRatio : '–'}</td>
                      <td className="py-1.5 pr-3 text-right">
                        <span className={h.beta !== null && Math.abs(h.beta) > 1.5 ? 'text-red-400' : 'text-gray-300'}>{h.beta !== null ? h.beta : '–'}</span>
                      </td>
                      <td className="py-1.5 text-right text-emerald-400">{h.dividendYield !== null && h.dividendYield > 0 ? `${h.dividendYield.toFixed(1)}%` : '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* KI-Qualitätserklärung (InsightPanel) */}
          {(() => {
            const m = data.portfolioMetrics;
            if (!m) return null;
            const avgPE = m.avgPE ?? null;
            const avgPEG = m.avgPEG ?? null;
            const avgBeta = m.avgBeta ?? null;
            const avgDiv = m.avgDividendYield ?? null;
            const avgEG = m.avgEarningsGrowth ?? null;
            const posCount = m.positionCount ?? 0;
            const sectors = (data.sectorBreakdown ?? []) as any[];
            const topSector = sectors[0];
            const sectorCount = sectors.length;

            // Build summary text
            const parts: string[] = [];
            if (posCount > 0) parts.push(`Das Portfolio umfasst ${posCount} Positionen in ${sectorCount} Sektoren.`);
            if (avgPE != null) {
              if (avgPE < 15) parts.push(`Das Ø KGV von ${avgPE.toFixed(1)} ist günstig bewertet.`);
              else if (avgPE < 25) parts.push(`Das Ø KGV von ${avgPE.toFixed(1)} liegt im normalen Bereich.`);
              else parts.push(`Das Ø KGV von ${avgPE.toFixed(1)} deutet auf eine hohe Bewertung hin.`);
            }
            if (avgBeta != null) {
              if (avgBeta < 0.8) parts.push(`Das Ø Beta von ${avgBeta.toFixed(2)} zeigt ein defensives Risikoprofil.`);
              else if (avgBeta <= 1.2) parts.push(`Das Ø Beta von ${avgBeta.toFixed(2)} entspricht dem Marktrisiko.`);
              else parts.push(`Das Ø Beta von ${avgBeta.toFixed(2)} zeigt ein erhöhtes Marktrisiko.`);
            }
            if (avgDiv != null && avgDiv > 0) parts.push(`Die gewichtete Dividendenrendite beträgt ${avgDiv.toFixed(1)}%.`);
            if (topSector) parts.push(`Größter Sektor: ${topSector.sector} (${topSector.weight.toFixed(1)}%).`);

            const summary = parts.join(' ') || 'Fundamentaldaten-Analyse des Portfolios.';

            // Build factors
            const factors = [
              ...(avgPE != null ? [{ label: 'Ø KGV', value: avgPE.toFixed(1), sentiment: avgPE < 15 ? 'positive' as const : avgPE < 25 ? 'neutral' as const : 'negative' as const }] : []),
              ...(avgPEG != null ? [{ label: 'Ø PEG', value: avgPEG.toFixed(2), sentiment: avgPEG < 1 ? 'positive' as const : avgPEG < 2 ? 'neutral' as const : 'negative' as const }] : []),
              ...(avgBeta != null ? [{ label: 'Ø Beta', value: avgBeta.toFixed(2), sentiment: avgBeta < 0.8 ? 'positive' as const : avgBeta <= 1.2 ? 'neutral' as const : 'negative' as const }] : []),
              ...(avgDiv != null && avgDiv > 0 ? [{ label: 'Div.-Rendite', value: `${avgDiv.toFixed(1)}%`, sentiment: avgDiv >= 3 ? 'positive' as const : avgDiv >= 1 ? 'neutral' as const : 'negative' as const }] : []),
              ...(avgEG != null ? [{ label: 'Gew.-Wachstum', value: `${avgEG.toFixed(1)}%`, sentiment: avgEG >= 10 ? 'positive' as const : avgEG >= 0 ? 'neutral' as const : 'negative' as const }] : []),
              ...(sectorCount > 0 ? [{ label: 'Sektoren', value: `${sectorCount}`, sentiment: sectorCount >= 5 ? 'positive' as const : sectorCount >= 3 ? 'neutral' as const : 'negative' as const }] : []),
            ];

            // Determine variant based on overall quality
            const positiveCount = factors.filter(f => f.sentiment === 'positive').length;
            const negativeCount = factors.filter(f => f.sentiment === 'negative').length;
            const variant = negativeCount >= 2 ? 'warning' as const : positiveCount >= 3 ? 'success' as const : 'default' as const;

            return (
              <InsightPanel
                title="Fundamentaldaten-Erklärung"
                summary={summary}
                factors={factors}
                variant={variant}
                collapsible
                defaultOpen
                riskNote="Fundamentaldaten von EODHD — können von anderen Quellen abweichen. Keine Anlageberatung."
              />
            );
          })()}

          {/* AI Summary */}
          {data.aiSummary && (
            <div className="bg-gradient-to-br from-[#0f1a1f] to-[#0a1015] border border-[#00CFC1]/20 rounded-lg p-4">
              <h4 className="text-xs font-semibold text-[#00CFC1] mb-2 flex items-center gap-2">
                <Brain className="w-3.5 h-3.5" /> KI-Portfolioanalyse
              </h4>
              <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">{data.aiSummary}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
