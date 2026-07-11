import { useState, useMemo, useEffect } from "react";
import { useParams, useLocation, Link } from "wouter";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Legend as RechartsLegend,
  LineChart,
  Line,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
// Alias, weil recharts oben bereits einen `Tooltip` exportiert (U-13)
import {
  Tooltip as UiTooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Edit,
  Trash2,
  Share2,
  DollarSign,
  Scale,
  PieChart,
  Bell,
  Play,
  Plus,
  FileText,
  Pencil,
  Target,
  Info,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Zap,
  Camera,
  GitCompareArrows,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { PortfolioEditModal } from "@/components/PortfolioEditModal";
import { PortfolioSettingsModal } from "@/components/PortfolioSettingsModal";
import { EditPositionModal } from "@/components/EditPositionModal";
import { EditPositionFieldsModal } from "@/components/EditPositionFieldsModal";
import { PortfolioSignalsTab } from "@/components/portfolio/PortfolioSignalsTab";
import { TransactionModal } from "@/components/TransactionModal";
import { SwissquotePDFImport } from "@/components/SwissquotePDFImport";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RealizedGainsTable } from "@/components/RealizedGainsTable";
import { CostFeesReport } from "@/components/CostFeesReport";
import RiskTab from "@/components/portfolio/RiskTab";
import OptimierenTab from "@/components/portfolio/OptimierenTab";
import PortfolioDeepDive from "@/components/portfolio/PortfolioDeepDive";
import PositionsKonstellation from "@/components/portfolio/PositionsKonstellation";
import { PositionsTreemap } from "@/components/dashboard/PositionsTreemap";
import { SECTOR_COLOR, formatCHF, formatCurrency, formatDate } from "@/lib/format";
import { StockLogo } from "@/components/StockLogo";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { getUserErrorMessage } from "@/lib/errorMessages";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ─── Performance Tab with Attribution Waterfall ───
function PerformanceTab({
  portfolioId, holdings, multiPeriod, totalValueCHF, investmentAmount, realizedGains, transactions
}: {
  portfolioId: number;
  holdings: any[];
  multiPeriod: any;
  totalValueCHF: number;
  investmentAmount: number;
  realizedGains: any[];
  transactions: any[];
}) {
  const [showRealizedGains, setShowRealizedGains] = useState(false);
  const [attributionPeriod, setAttributionPeriod] = useState<'ytd' | 'since_buy'>('ytd');
  // QuantStats-Tearsheet (Kundenreport) — öffnet den self-contained HTML-Report in neuem Tab.
  const tearsheet = trpc.report.tearsheet.useMutation({
    onSuccess: (data) => {
      const blob = new Blob([data.html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    },
    onError: (e) => toast.error('Report konnte nicht erstellt werden', { description: e.message }),
  });
  const entry = (multiPeriod as any[] | undefined)?.find((p: any) => p.portfolioId === portfolioId);
  const ytd = entry?.performance?.YTD ?? null;
  const seitKauf = investmentAmount > 0 ? ((totalValueCHF - investmentAmount) / investmentAmount) * 100 : null;
  const gv = totalValueCHF - investmentAmount;

  // Build sector attribution from holdings (supports YTD and since-buy toggle)
  const sectorAttribution = useMemo(() => {
    const sectors: Record<string, { weight: number; perf: number }> = {};
    holdings.forEach((h: any) => {
      const s = h.sector || 'Andere';
      const w = parseFloat(h.weight || '0') / 100;
      const y = attributionPeriod === 'ytd'
        ? parseFloat(h.ytdPerformance || '0')
        : parseFloat(h.totalReturn || h.ytdPerformance || '0');
      if (!sectors[s]) sectors[s] = { weight: 0, perf: 0 };
      sectors[s].weight += w;
      sectors[s].perf += w * y; // weighted contribution
    });
    return Object.entries(sectors)
      .map(([name, v]) => ({ name, contribution: parseFloat((v.perf).toFixed(2)) }))
      .sort((a, b) => b.contribution - a.contribution);
  }, [holdings, attributionPeriod]);

  // Build top-title attribution
  const titleAttribution = useMemo(() => {
    return holdings
      .map((h: any) => {
        const perf = attributionPeriod === 'ytd'
          ? parseFloat(h.ytdPerformance || '0')
          : parseFloat(h.totalReturn || h.ytdPerformance || '0');
        return {
          name: h.ticker,
          label: h.companyName?.slice(0, 18) || h.ticker,
          contribution: parseFloat(((parseFloat(h.weight || '0') / 100) * perf).toFixed(2)),
        };
      })
      .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
      .slice(0, 8);
  }, [holdings, attributionPeriod]);

  const maxAbs = Math.max(...sectorAttribution.map(s => Math.abs(s.contribution)), 0.01);

  return (
    <div className="space-y-4">
      {/* Kundenreport (QuantStats-Tearsheet) */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Performance</h3>
        <Button
          size="sm" variant="outline"
          disabled={tearsheet.isPending}
          onClick={() => tearsheet.mutate({ portfolioId })}
          className="border-white/10 text-gray-200 hover:text-white hover:border-white/30 gap-2"
        >
          <FileText className="h-4 w-4" />
          {tearsheet.isPending ? 'Report wird erstellt…' : 'Report (Tear-Sheet)'}
        </Button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-3 gap-0 border border-white/10 rounded-lg overflow-hidden">
        <div className="bg-[#0f1420] p-4 border-r border-white/10">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1" title="YTD = seit Jahresbeginn">YTD</p>
          <p className={`text-2xl font-bold font-mono ${(ytd ?? 0) >= 0 ? 'text-[#00CFC1]' : 'text-negative'}`}>{ytd !== null ? `${ytd >= 0 ? '+' : ''}${ytd.toFixed(2)}%` : '–'}</p>
          <p className="text-xs text-gray-400 mt-0.5">Seit Jahresanfang</p>
        </div>
        <div className="bg-[#0f1420] p-4 border-r border-white/10">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">SEIT KAUF</p>
          <p className={`text-2xl font-bold font-mono ${(seitKauf ?? 0) >= 0 ? 'text-[#00CFC1]' : 'text-negative'}`}>{seitKauf !== null ? `${seitKauf >= 0 ? '+' : ''}${seitKauf.toFixed(2)}%` : '–'}</p>
          <p className="text-xs text-gray-400 mt-0.5">Gesamtrendite</p>
        </div>
        <div className="bg-[#0f1420] p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">G/V ABSOLUT</p>
          <p className={`text-2xl font-bold font-mono ${gv >= 0 ? 'text-[#00CFC1]' : 'text-negative'}`}>{formatCHF(gv, { signDisplay: 'always' })}</p>
          <p className="text-xs text-gray-400 mt-0.5">Wert − Kapital</p>
        </div>
      </div>

      {/* Attribution Waterfall */}
      <div className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border border-white/10 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">Performance-Attribution</h3>
          <div className="flex items-center gap-1 bg-[#0a0f1a] rounded-lg p-0.5">
            <button
              onClick={() => setAttributionPeriod('ytd')}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                attributionPeriod === 'ytd'
                  ? 'bg-[#00CFC1]/20 text-[#00CFC1] font-semibold'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              YTD
            </button>
            <button
              onClick={() => setAttributionPeriod('since_buy')}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                attributionPeriod === 'since_buy'
                  ? 'bg-[#00CFC1]/20 text-[#00CFC1] font-semibold'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Seit Kauf
            </button>
          </div>
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {/* Sektor-Attribution */}
        <div className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border border-white/10 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Performance-Attribution nach Sektor</h3>
          <div className="space-y-2">
            {sectorAttribution.map((s) => (
              <div key={s.name}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs text-gray-400 truncate max-w-[140px]">{s.name}</span>
                  <span className={`text-xs font-mono font-semibold ${s.contribution >= 0 ? 'text-[#00CFC1]' : 'text-negative'}`}>
                    {s.contribution >= 0 ? '+' : ''}{s.contribution.toFixed(2)}%
                  </span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${s.contribution >= 0 ? 'bg-[#00CFC1]' : 'bg-negative'}`}
                    style={{ width: `${Math.min(100, (Math.abs(s.contribution) / maxAbs) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
            {sectorAttribution.length === 0 && <p className="text-xs text-gray-400">Keine Daten verfügbar</p>}
          </div>
        </div>

        {/* Titel-Attribution */}
        <div className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border border-white/10 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Top-Beiträger & Belaster</h3>
          <div className="space-y-2">
            {titleAttribution.map((t) => (
              <div key={t.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[#00CFC1] w-14">{t.name}</span>
                  <span className="text-gray-400 truncate max-w-[100px]">{t.label}</span>
                </div>
                <span className={`font-mono font-semibold ${t.contribution >= 0 ? 'text-[#00CFC1]' : 'text-negative'}`}>
                  {t.contribution >= 0 ? '+' : ''}{t.contribution.toFixed(2)}%
                </span>
              </div>
            ))}
            {titleAttribution.length === 0 && <p className="text-xs text-gray-400">Keine Daten verfügbar</p>}
          </div>
        </div>
      </div>

      {/* Realisierte Gewinne — aufklappbar */}
      <div className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border border-white/10 rounded-lg overflow-hidden">
        <button
          onClick={() => setShowRealizedGains(!showRealizedGains)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">Realisierte Gewinne</span>
            {realizedGains.length > 0 && (
              <span className="text-xs bg-[#00CFC1]/20 text-[#00CFC1] px-1.5 py-0.5 rounded">{realizedGains.length}</span>
            )}
          </div>
          <span className="text-gray-400 text-xs">{showRealizedGains ? '▲ Schliessen' : '▼ Aufklappen'}</span>
        </button>
        {showRealizedGains && (
          <div className="border-t border-white/10 p-4">
            {realizedGains.length > 0 ? (
              <RealizedGainsTable gains={realizedGains} />
            ) : (
              <p className="text-gray-400 text-sm text-center py-4">Keine realisierten Gewinne vorhanden</p>
            )}
          </div>
        )}
      </div>

      {/* Kosten & Gebühren */}
      {transactions.length > 0 && (
        <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-400">Kosten & Gebühren</CardTitle></CardHeader>
          <CardContent><CostFeesReport transactions={transactions} portfolioId={portfolioId} /></CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── F-06: Dividenden-Tab — anstehende Dividenden dieses Portfolios ───
function DividendenTab({ portfolioId }: { portfolioId: number }) {
  const { data: dividends = [], isLoading } = trpc.dividendCalendar.getUpcoming.useQuery(
    { portfolioId, daysAhead: 730 },
    { enabled: portfolioId > 0 }
  );

  const rows = useMemo(() => {
    const startOfToday = new Date(new Date().toDateString());
    return (dividends as any[])
      .filter((d) => d.exDividendDate && new Date(d.exDividendDate) >= startOfToday)
      .sort((a, b) => new Date(a.exDividendDate).getTime() - new Date(b.exDividendDate).getTime());
  }, [dividends]);

  // Group by year
  const rowsByYear = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const row of rows) {
      const year = new Date(row.exDividendDate).getFullYear().toString();
      if (!groups[year]) groups[year] = [];
      groups[year].push(row);
    }
    return groups;
  }, [rows]);

  const totalCHF = rows.reduce((s: number, d: any) => s + (d.expectedIncome || 0), 0);

  if (isLoading) {
    return (
      <div className="bg-[#0f1420] border border-white/10 rounded-lg p-5 space-y-3 animate-pulse" aria-label="Dividenden werden geladen">
        <div className="h-4 w-48 bg-white/10 rounded" />
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-8 bg-white/5 rounded" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="bg-[#0f1420] border border-white/10 rounded-lg p-10 text-center">
        <DollarSign className="h-10 w-10 text-gray-600 mx-auto mb-3" />
        <p className="text-gray-400 text-sm">Keine anstehenden Dividenden für dieses Portfolio.</p>
      </div>
    );
  }

  return (
    <div className="bg-[#0f1420] border border-white/10 rounded-lg">
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
        <div>
          <h3 className="text-sm font-semibold text-white">Anstehende Dividenden</h3>
          <p className="text-xs text-gray-400">Angekündigt oder aus der Historie geschätzt · Bestand dieses Portfolios · 2 Jahre Vorschau</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Gesamt (2 Jahre)</p>
          <p className="text-lg font-bold font-mono text-[#00CFC1]">{formatCHF(totalCHF)}</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Titel</th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Ex-Datum</th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Zahldatum</th>
              <th className="text-right px-3 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Betrag je Aktie</th>
              <th className="text-right px-3 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Stück</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Erwartet (CHF)</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(rowsByYear).sort(([a], [b]) => Number(a) - Number(b)).map(([year, yearRows]) => {
              const yearTotal = (yearRows as any[]).reduce((s: number, d: any) => s + (d.expectedIncome || 0), 0);
              return (
                <>
                  {/* Jahr-Trennzeile */}
                  <tr key={`year-${year}`} className="bg-white/[0.04] border-y border-white/10">
                    <td colSpan={5} className="px-5 py-2">
                      <span className="text-xs font-bold text-gray-300 uppercase tracking-widest">{year}</span>
                      <span className="ml-2 text-xs text-gray-500">{(yearRows as any[]).length} Zahlung{(yearRows as any[]).length !== 1 ? 'en' : ''}</span>
                    </td>
                    <td className="px-5 py-2 text-right text-xs font-bold font-mono text-[#00CFC1]">{formatCHF(yearTotal)}</td>
                  </tr>
                  {(yearRows as any[]).map((d: any, i: number) => (
                    <tr key={`${d.ticker}-${d.exDividendDate}-${i}`} className="border-b border-white/5 hover:bg-white/[0.03]">
                      <td className="px-5 py-3">
                        <span className="font-mono text-xs text-[#00CFC1] mr-2">{d.ticker}</span>
                        <span className="text-sm text-white">{d.companyName}</span>
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-400">
                        {formatDate(d.exDividendDate)}
                        {d.type === 'estimated' && (
                          <span
                            className="ml-2 inline-block rounded bg-yellow-500/10 px-1.5 py-0.5 text-[10px] font-medium text-yellow-500/90 align-middle"
                            title="Termin und Betrag aus der Dividendenhistorie projiziert"
                          >
                            geschätzt
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-400">{d.paymentDate ? formatDate(d.paymentDate) : '—'}</td>
                      <td className="px-3 py-3 text-right text-sm text-gray-300">{formatCurrency(d.amount, d.currency || 'CHF')}</td>
                      <td className="px-3 py-3 text-right text-sm text-gray-300">
                        {new Intl.NumberFormat('de-CH', { maximumFractionDigits: 2 }).format(parseFloat(d.shares) || 0)}
                      </td>
                      <td className="px-5 py-3 text-right text-sm font-semibold text-[#00CFC1]">{formatCHF(d.expectedIncome || 0)}</td>
                    </tr>
                  ))}
                </>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-white/10">
              <td colSpan={5} className="px-5 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Summe (2 Jahre gesamt)</td>
              <td className="px-5 py-3 text-right text-sm font-bold font-mono text-[#00CFC1]">{formatCHF(totalCHF)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ─── Track D: wiederkehrende Transaktions-Empfehlungen ───
function EmpfehlungenTab({ portfolioId }: { portfolioId: number }) {
  const utils = trpc.useUtils();
  const { data: config } = trpc.recommendations.getConfig.useQuery({ portfolioId }, { enabled: portfolioId > 0 });
  const [showList, setShowList] = useState(false);
  const analysis = trpc.copilot.analyze.useQuery({ portfolioId }, { enabled: showList && portfolioId > 0 });

  const setConfig = trpc.recommendations.setConfig.useMutation({
    onSuccess: () => { utils.recommendations.getConfig.invalidate({ portfolioId }); toast.success('Einstellung gespeichert'); },
    onError: (e) => toast.error('Fehler', { description: getUserErrorMessage(e) }),
  });
  const apply = trpc.copilot.applyRebalancing.useMutation({
    onSuccess: (r: any) => {
      if (r?.error && !r?.applied) toast.error('Fehler', { description: r.error });
      else toast.success(`${r?.applied ?? 0}/${r?.total ?? 0} Transaktion(en) übernommen`);
      utils.portfolioTransactions.list.invalidate({ portfolioId });
      utils.portfolios.getWithCurrency.invalidate(portfolioId);
    },
    onError: (e) => toast.error('Fehler', { description: getUserErrorMessage(e) }),
  });

  const cadence = config?.cadence ?? 'off';
  const suggestions = (analysis.data?.analysis?.rebalancingSuggestions ?? []).filter((s: any) => s.action !== 'hold');
  const actionLabel: Record<string, string> = { increase: 'Aufstocken', decrease: 'Reduzieren', exit: 'Verkaufen' };

  const applyAll = () => {
    if (suggestions.length === 0) return;
    apply.mutate({ portfolioId, targetWeights: suggestions.map((s: any) => ({ ticker: s.ticker, companyName: s.companyName, targetWeight: s.targetWeight })) });
  };

  return (
    <div className="space-y-4">
      {/* Kadenz-Einstellung */}
      <div className="bg-[#0f1420] border border-white/10 rounded-lg p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Wiederkehrende Empfehlungen</h3>
            <p className="text-xs text-gray-400 mt-1">
              Wie oft möchten Sie eine Empfehlungsliste für Transaktionen erhalten?
              {config?.nextDueAt && cadence !== 'off' && (
                <> · Nächste Aktualisierung fällig: {formatDate(config.nextDueAt)}</>
              )}
            </p>
          </div>
          <select
            value={cadence}
            onChange={(e) => setConfig.mutate({ portfolioId, cadence: e.target.value as any, autoExecute: config?.autoExecute })}
            className="bg-[#1a1f2e] border border-white/10 rounded px-3 py-2 text-sm text-white"
            aria-label="Kadenz der Empfehlungen"
          >
            <option value="off">Aus</option>
            <option value="weekly">Wöchentlich</option>
            <option value="monthly">Monatlich</option>
            <option value="quarterly">Quartalsweise</option>
          </select>
        </div>
        <label className="flex items-center gap-2 mt-3 text-xs text-gray-400">
          <input
            type="checkbox"
            checked={config?.autoExecute ?? false}
            onChange={(e) => setConfig.mutate({ portfolioId, cadence: cadence as any, autoExecute: e.target.checked })}
          />
          Vorschläge automatisch ausführen (sonst manuelle Bestätigung) — <span className="text-yellow-500/80">mit Vorsicht aktivieren</span>
        </label>
      </div>

      {/* Aktuelle Empfehlungsliste */}
      <div className="bg-[#0f1420] border border-white/10 rounded-lg p-5">
        {!showList ? (
          <div className="text-center py-6">
            <p className="text-sm text-gray-400 mb-3">Aktuelle Transaktions-Empfehlungen für dieses Portfolio anzeigen.</p>
            <button onClick={() => setShowList(true)} className="bg-[#00CFC1] text-black text-sm font-semibold px-4 py-2 rounded hover:bg-[#00CFC1]/90">
              Empfehlungen laden
            </button>
          </div>
        ) : analysis.isLoading ? (
          <p className="text-sm text-gray-400 text-center py-6">Empfehlungen werden berechnet…</p>
        ) : analysis.data?.error ? (
          <p className="text-sm text-red-400 text-center py-6">{analysis.data.error}</p>
        ) : suggestions.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">Aktuell keine Handlungsempfehlungen — das Portfolio ist im Zielbereich.</p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Empfohlene Transaktionen ({suggestions.length})</h3>
              <button onClick={applyAll} disabled={apply.isPending} className="text-xs font-semibold text-[#00CFC1] hover:underline disabled:opacity-50">
                Alle übernehmen
              </button>
            </div>
            {suggestions.map((s: any, i: number) => (
              <div key={`${s.ticker}-${i}`} className="flex items-center justify-between border border-white/10 rounded-lg px-4 py-3">
                <div className="min-w-0">
                  <div>
                    <span className="font-mono text-xs text-[#00CFC1] mr-2">{s.ticker}</span>
                    <span className="text-sm text-white">{s.companyName}</span>
                    <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${s.action === 'exit' || s.action === 'decrease' ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
                      {actionLabel[s.action] ?? s.action}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {(s.currentWeight * 100).toFixed(1)}% → {(s.targetWeight * 100).toFixed(1)}% · {s.reason}
                  </p>
                </div>
                <button
                  onClick={() => apply.mutate({ portfolioId, targetWeights: [{ ticker: s.ticker, companyName: s.companyName, targetWeight: s.targetWeight }] })}
                  disabled={apply.isPending}
                  className="text-xs font-semibold text-white bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded disabled:opacity-50 shrink-0 ml-3"
                >
                  Übernehmen
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── F3: Konsolidierter Bereich «Optimierung & Empfehlungen» ───
// Vereint die früheren Subtabs «Optimieren KI» und «Empfehlungen KI» in einem
// Tab mit zwei Modi. Das Anlageprofil (F1) steuert die Optimierungsstrategie und
// wird als Kontext angezeigt; die Diversifikationsregeln (F2) fliessen serverseitig
// in den Optimizer ein.
const PROFILE_RISK_LABEL: Record<string, string> = {
  konservativ: "Konservativ", ausgewogen: "Ausgewogen", wachstum: "Wachstum", aggressiv: "Aggressiv",
};
const PROFILE_GOAL_LABEL: Record<string, string> = {
  dividends: "Ertrag / Dividenden", growth: "Wachstum", balanced: "Ausgewogen",
};

function OptimierungEmpfehlungenTab({
  portfolioId, holdings, totalValueCHF, cashBalance, onNavigateToTransactions,
}: { portfolioId: number; holdings: any[]; totalValueCHF?: number; cashBalance?: number; onNavigateToTransactions?: () => void }) {
  const [mode, setMode] = useState<"empfehlungen" | "optimierung">("empfehlungen");
  const { data: profile } = trpc.investmentProfile.get.useQuery();

  // Strategie aus dem Risikoprofil ableiten (nur DB-basierte Methoden — kein Yahoo):
  // konservativ → Risikominimierung (Min. Varianz), sonst Max. Sharpe.
  type OptMethod = "max_sharpe" | "min_variance" | "equal_weight" | "max_dividend" | "hrp";
  const profileMethod: OptMethod =
    profile?.riskProfile === "konservativ" ? "min_variance" : "max_sharpe";
  const [selectedMethod, setSelectedMethod] = useState<OptMethod | null>(null);
  const method: OptMethod = selectedMethod ?? profileMethod;

  const METHOD_OPTS: { value: OptMethod; label: string }[] = [
    { value: "max_sharpe", label: "Max. Sharpe" },
    { value: "min_variance", label: "Min. Varianz" },
    { value: "hrp", label: "HRP (Risk Parity)" },
    { value: "equal_weight", label: "Gleichgewichtet" },
    { value: "max_dividend", label: "Max. Dividende" },
  ];

  const strategyNote = selectedMethod
    ? undefined // user override — no note
    : profile?.isSet
    ? `Strategie aus Ihrem Anlageprofil (${PROFILE_RISK_LABEL[profile.riskProfile] ?? profile.riskProfile}): ` +
      (method === "min_variance"
        ? "Risiko minimieren (Min. Varianz)."
        : method === "hrp"
        ? "Hierarchical Risk Parity."
        : "maximale risikoadjustierte Rendite (Max. Sharpe).")
    : "Kein Anlageprofil gesetzt — Standardstrategie Max. Sharpe. Hinterlegen Sie Ihr Risikoprofil, damit die Optimierung darauf abgestimmt wird.";

  return (
    <div className="space-y-4">
      {/* Anlageprofil-Kontext */}
      {profile?.isSet ? (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0f1420] border border-white/10 rounded-lg px-4 py-3">
          <div className="flex items-center gap-2 text-sm">
            <Target className="w-4 h-4 text-[#00CFC1]" />
            <span className="text-gray-400">Anlageprofil:</span>
            <span className="text-white font-medium">{PROFILE_RISK_LABEL[profile.riskProfile] ?? profile.riskProfile}</span>
            <span className="text-gray-600">·</span>
            <span className="text-white font-medium">{PROFILE_GOAL_LABEL[profile.investmentGoal] ?? profile.investmentGoal}</span>
          </div>
          <Link href="/einstellungen?tab=anlageprofil" className="text-xs text-[#00CFC1] hover:underline">
            Profil anpassen
          </Link>
        </div>
      ) : (
        <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/40 rounded-lg px-4 py-3">
          <Info className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-200">
            Noch kein Anlageprofil hinterlegt. Optimierung und Empfehlungen nutzen die Standardstrategie.{" "}
            <Link href="/einstellungen?tab=anlageprofil" className="underline font-semibold text-amber-100 hover:text-white">
              Anlageprofil festlegen
            </Link>{" "}
            (Risikoprofil + Anlageziele), damit sie auf Sie abgestimmt werden.
          </p>
        </div>
      )}

      {/* Modus-Umschalter + Methoden-Selektor */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-white/10 bg-[#0f1420] p-1">
        {[
          { key: "empfehlungen" as const, label: "Empfehlungen (laufend)" },
          { key: "optimierung" as const, label: "Vollständige Neu-Optimierung" },
        ].map((m) => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === m.key ? "bg-[#00CFC1] text-black" : "text-gray-400 hover:text-white"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            {m.label}
          </button>
        ))}
        </div>

        {/* Methoden-Selektor (nur bei Optimierung sichtbar) */}
        {mode === "optimierung" && (
          <select
            value={method}
            onChange={(e) => setSelectedMethod(e.target.value as OptMethod)}
            className="bg-[#0f1420] border border-white/20 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#00CFC1] cursor-pointer"
          >
            {METHOD_OPTS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        )}
      </div>

      {mode === "empfehlungen" ? (
        <EmpfehlungenTab portfolioId={portfolioId} />
      ) : (
        <OptimierenTab
          portfolioId={portfolioId}
          holdings={holdings}
          totalValueCHF={totalValueCHF}
          cashBalance={cashBalance ?? 0}
          method={method}
          strategyNote={strategyNote}
          onNavigateToTransactions={onNavigateToTransactions}
        />
      )}
    </div>
  );
}

// Score history sparkline — shown in the expanded detail row of the Positionen table
function ScoreHistorySparkline({ ticker }: { ticker: string }) {
  const { data: history, isLoading } = trpc.signals.getScoreHistory.useQuery(
    { ticker },
    { staleTime: 5 * 60 * 1000 }
  );

  if (isLoading) {
    return (
      <div className="mt-3 bg-[#0f1420] border border-white/10 rounded-lg p-3">
        <p className="text-xs font-semibold text-gray-400 mb-1">Score-Verlauf</p>
        <p className="text-xs text-gray-500">Lade Verlaufsdaten...</p>
      </div>
    );
  }

  if (!history || history.length < 2) {
    return (
      <div className="mt-3 bg-[#0f1420] border border-white/10 rounded-lg p-3">
        <p className="text-xs font-semibold text-gray-400 mb-1">Score-Verlauf</p>
        <p className="text-xs text-gray-500">Noch keine historischen Daten verfügbar — werden täglich gespeichert.</p>
      </div>
    );
  }

  const chartData = history.map((row) => ({
    date: row.snapshotDate,
    qualität: row.qualityScore ?? null,
    signal: row.combinedScore ?? null,
  }));

  return (
    <div className="mt-3 bg-[#0f1420] border border-white/10 rounded-lg p-3">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Score-Verlauf ({history.length} Tage)</p>
      <ResponsiveContainer width="100%" height={80}>
        <LineChart data={chartData} margin={{ top: 2, right: 4, left: -30, bottom: 0 }}>
          <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#6b7280' }} tickFormatter={(v) => v.slice(5)} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#6b7280' }} />
          <Tooltip
            contentStyle={{ background: '#0f1420', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, fontSize: 11 }}
            labelStyle={{ color: '#9ca3af' }}
            formatter={(value: any, name: string) => [value !== null ? `${value}/100` : '–', name === 'qualität' ? 'Qualität' : 'Signal']}
          />
          <Line type="monotone" dataKey="qualität" stroke="#00CFC1" strokeWidth={1.5} dot={false} connectNulls />
          <Line type="monotone" dataKey="signal" stroke="#f59e0b" strokeWidth={1.5} dot={false} connectNulls />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex gap-4 mt-1">
        <span className="flex items-center gap-1 text-xs text-gray-400"><span className="inline-block w-3 h-0.5 bg-[#00CFC1]"></span>Qualität</span>
        <span className="flex items-center gap-1 text-xs text-gray-400"><span className="inline-block w-3 h-0.5 bg-amber-400"></span>Signal</span>
      </div>
    </div>
  );
}

// Inline delete button for individual transactions
function DeleteTransactionButton({ transactionId, portfolioId }: { transactionId: number; portfolioId: number }) {
  const utils = trpc.useUtils();
  const [confirming, setConfirming] = useState(false);
  const deleteTx = trpc.portfolioTransactions.delete.useMutation({
    onSuccess: () => {
      utils.portfolioTransactions.list.invalidate({ portfolioId });
      utils.portfolios.getWithCurrency.invalidate(portfolioId);
      toast.success('Transaktion gelöscht');
      setConfirming(false);
    },
    onError: (err) => { toast.error('Fehler beim Löschen', { description: getUserErrorMessage(err) }); setConfirming(false); },
  });
  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <button onClick={() => deleteTx.mutate({ transactionId })} className="text-xs text-red-400 hover:text-red-300 px-1.5 py-0.5 rounded bg-red-500/10 hover:bg-red-500/20">
          {deleteTx.isPending ? '...' : 'Ja'}
        </button>
        <button onClick={() => setConfirming(false)} className="text-xs text-gray-400 hover:text-white px-1.5 py-0.5 rounded bg-white/5">
          Nein
        </button>
      </div>
    );
  }
  return (
    <button
      onClick={() => setConfirming(true)}
      className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 p-1 rounded hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-all"
      title="Transaktion löschen"
      aria-label="Transaktion löschen"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}

const portfolioTypeConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  dividends: { label: "Dividenden", icon: <DollarSign className="h-4 w-4" />, color: "bg-blue-500" },
  growth: { label: "Wachstum", icon: <TrendingUp className="h-4 w-4" />, color: "bg-green-500" },
  balanced: { label: "Balanced", icon: <Scale className="h-4 w-4" />, color: "bg-purple-500" },
  etf: { label: "ETF", icon: <PieChart className="h-4 w-4" />, color: "bg-orange-500" },
};

export default function PortfolioDetailsPage() {
  const params = useParams<{ id: string }>();
  const [location, navigate] = useLocation();
  const portfolioId = params.id ? parseInt(params.id) : 0;
  
  // URL-based tab persistence: ?tab=positionen etc. (German keys per Mockup S.01-06)
  const legacyTabMap: Record<string, string> = {
    overview: 'uebersicht', positions: 'positionen', transactions: 'transaktionen',
    risk: 'risiko', optimize: 'optimierung', ai: 'optimierung',
    optimieren: 'optimierung', empfehlungen: 'optimierung',
  };
  const searchParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const rawTab = searchParams.get('tab') || 'uebersicht';
  const urlTab = legacyTabMap[rawTab] || rawTab;
  const [activeTab, setActiveTab] = useState(urlTab);
  const [posView, setPosView] = useState<'tabelle' | 'heatmap' | 'konstellation'>('tabelle');
  // Expandable row state for Positionen table
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);
  // Sort state for Positionen table
  type SortKey = 'weight' | 'ytd' | 'today' | 'qualityScore' | 'signalScore';
  const [sortKey, setSortKey] = useState<SortKey>('weight');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    const newSearch = tab === 'uebersicht' ? '' : `?tab=${tab}`;
    navigate(`/portfolios/${portfolioId}${newSearch}`, { replace: true });
  };

  // State for transactions filter
  const [txFilter, setTxFilter] = useState<string>('alle');
  
  // State for edit modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState<any>(null);
  const [isEditPositionModalOpen, setIsEditPositionModalOpen] = useState(false);
  // Positions-Felder bearbeiten (Ticker/ISIN/Stück/Preis/Währung) direkt im portfolioData
  const [editFieldsHolding, setEditFieldsHolding] = useState<any>(null);
  const [isEditFieldsOpen, setIsEditFieldsOpen] = useState(false);

  // State for share
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);

  // U-03: Transaktion erfassen + Swissquote-PDF-Import (Transaktionen-Tab)
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [isPdfImportOpen, setIsPdfImportOpen] = useState(false);
  
  // State for activation modal (Demo -> Live)
  const [isActivationModalOpen, setIsActivationModalOpen] = useState(false);
  const [startCapital, setStartCapital] = useState("");
  const [selectedActivationBenchmark, setSelectedActivationBenchmark] = useState<"SMI" | "SP500" | "MSCI_WORLD">("SMI");

  // U-19: Live-Tracking deaktivieren (Live -> Demo) mit Bestätigungsdialog
  const [isDeactivateDialogOpen, setIsDeactivateDialogOpen] = useState(false);
  
  // Fetch transactions for edit modal
  const { data: transactions = [] } = trpc.portfolioTransactions.list.useQuery(
    { portfolioId },
    { enabled: portfolioId > 0 }
  );
  
  // Fetch realized gains
  const { data: realizedGains = [] } = trpc.realizedGainsHistory.getAll.useQuery(
    { portfolioId },
    { enabled: portfolioId > 0 }
  );
  
  const handleEditPosition = (holding: any) => {
    setEditingPosition({
      ticker: holding.ticker,
      name: holding.companyName,
      shares: holding.shares || 0,
      avgBuyPrice: holding.currentPriceLocal,
      currency: holding.currency,
      totalInvestedCHF: holding.valueCHF
    });
    setIsEditPositionModalOpen(true);
  };
  
  // U-02: Einstieg aus dem Portfolio-Builder-Importpfad (?import=1) —
  // PDF-Import einmalig automatisch öffnen, dann den Query-Param entfernen.
  useEffect(() => {
    if (searchParams.get('import') === '1') {
      setIsPdfImportOpen(true);
      navigate(`/portfolios/${portfolioId}?tab=transaktionen`, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch portfolio data with currency information
  const { data: portfolio, isLoading, refetch } = trpc.portfolios.getWithCurrency.useQuery(
    portfolioId,
    {
      enabled: portfolioId > 0,
      refetchOnMount: true, // Always fetch fresh data on mount
      refetchOnWindowFocus: true, // Refetch when window regains focus
    }
  );
  const { data: allPortfolios } = trpc.portfolios.list.useQuery();
  // Canonical YTD source — same as the Portfolios list ("eine Quelle der Wahrheit")
  const { data: multiPeriod } = trpc.portfolios.getMultiPeriodPerformanceV2.useQuery();
  const deletePortfolio = trpc.portfolios.delete.useMutation();
  const utils = trpc.useUtils();
  
  // Activate portfolio mutation (Demo -> Live)
  const activatePortfolio = trpc.portfolioManagement.activatePortfolio.useMutation({
    onSuccess: (data) => {
      toast.success(`Portfolio aktiviert! ${data.transactionsCreated} Transaktionen erstellt.`);
      setIsActivationModalOpen(false);
      setStartCapital("");
      utils.portfolios.getWithCurrency.invalidate(portfolioId);
      utils.portfolios.list.invalidate();
      refetch();
    },
    onError: (error) => {
      toast.error('Fehler beim Aktivieren', { description: getUserErrorMessage(error) });
    },
  });

  // U-19: Deaktivieren (Live -> Demo) — Transaktionen werden serverseitig entfernt,
  // die Positionen bleiben als Demo-Bestand erhalten.
  const deactivateLive = trpc.portfolios.toggleLive.useMutation({
    onSuccess: () => {
      toast.success('Live-Tracking deaktiviert. Die Positionen bleiben als Demo-Portfolio erhalten.');
      setIsDeactivateDialogOpen(false);
      utils.portfolios.getWithCurrency.invalidate(portfolioId);
      utils.portfolios.list.invalidate();
      utils.portfolioTransactions.list.invalidate({ portfolioId });
      utils.realizedGainsHistory.getAll.invalidate({ portfolioId });
      refetch();
    },
    onError: (error) => {
      setIsDeactivateDialogOpen(false);
      toast.error('Fehler beim Deaktivieren', { description: getUserErrorMessage(error) });
    },
  });

  const [selectedPeriod, setSelectedPeriod] = useState("YTD");
  const [selectedBenchmark, setSelectedBenchmark] = useState("SPY");
  // Performance view: stocks-only vs. total portfolio incl. cash drag.
  const [includeCash, setIncludeCash] = useState(false);
  // Bulk delete state for transactions tab (must be at top level, not inside JSX)
  const [selectedTxIds, setSelectedTxIds] = useState<Set<number>>(new Set());
  // U-08: Bestätigung über AlertDialog statt Browser-confirm()
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const bulkDeleteMutation = trpc.portfolioTransactions.bulkDelete.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.deleted} Transaktion${data.deleted === 1 ? '' : 'en'} gelöscht`);
      setSelectedTxIds(new Set());
      setIsBulkDeleteDialogOpen(false);
      utils.portfolioTransactions.list.invalidate({ portfolioId });
    },
    onError: () => { setIsBulkDeleteDialogOpen(false); toast.error('Fehler beim Löschen'); },
  });
  
  const benchmarkOptions = [
    { value: "SPY", label: "S&P 500" },
    { value: "QQQ", label: "Nasdaq 100" },
    { value: "SSMI.SW", label: "SPI" },
    { value: "FEZ", label: "EuroStoxx 50" },
  ];
  
  // Use enriched stocks from the API (must be before conditional returns)
  const holdings = portfolio?.enrichedStocks || [];

  // U-13: Positionen ohne aktuellen Kurs bzw. Wechselkurs werden mit Wert 0
  // gerechnet — im UI ausweisen statt still falsche Summen zeigen.
  const missingDataCount = holdings.filter((h: any) => h.priceMissing || h.fxMissing).length;
  
  // Calculate sector allocation
  const sectorWeights: Record<string, number> = useMemo(() => {
    const weights: Record<string, number> = {};
    holdings.forEach((h: any) => {
      const sector = h.sector || 'Other';
      weights[sector] = (weights[sector] || 0) + (h.weight || 0);
    });
    return weights;
  }, [holdings]);
  
  // Calculate total portfolio value based on initial capital and weights
  // Backend already includes cash balance in totalValueCHF
  const cashBalance = parseFloat(portfolio?.cashBalance || "0");
  const totalValueCHF = Number(portfolio?.totalValueCHF) || 0;
  const avgDividendYield = portfolio?.avgDividendYield || 0;
  
  // Determine creation date for visual separation in chart
  const creationDate = useMemo(() => {
    if (!portfolio?.liveStartDate) return null;
    if (typeof portfolio.liveStartDate === 'string') {
      return portfolio.liveStartDate.split('T')[0];
    }
    return new Date(portfolio.liveStartDate).toISOString().split('T')[0];
  }, [portfolio?.liveStartDate]);
  
  // Map period labels to getPerformanceMetrics range values
  const perfRange = useMemo(() => {
    const map: Record<string, '1M' | '3M' | '6M' | 'YTD' | '1J' | '3J' | '5J' | 'Max'> = {
      '1M': '1M', '3M': '3M', '6M': '6M', 'YTD': 'YTD',
      '1Y': '1J', '3Y': '3J', '5Y': '5J', 'All': 'Max',
    };
    return map[selectedPeriod] || 'YTD';
  }, [selectedPeriod]);

  // TTWROR + IRR metrics from the new performance engine
  const { data: perfMetrics, isLoading: isLoadingPerfMetrics } = trpc.portfolios.getPerformanceMetrics.useQuery(
    { portfolioId, range: perfRange },
    { enabled: portfolioId > 0 && !!portfolio?.isLive }
  );

  // Risk metrics (real Sharpe ratio + benchmark Sharpe) scoped to this portfolio
  const { data: riskMetrics } = trpc.dashboard.getRiskMetrics.useQuery(
    { scope: portfolioId },
    { enabled: portfolioId > 0 }
  );

  // Signals for Positionen tab detail rows (cache-first, loaded lazily when tab is active)
  const trpcUtils = trpc.useUtils();
  const { data: signalsData, isFetching: isSignalsFetching } = trpc.signals.generate.useQuery(
    { portfolioId },
    { enabled: portfolioId > 0 && activeTab === 'positionen', staleTime: 4 * 60 * 60 * 1000 }
  );
  const refreshSignalsMutation = trpc.signals.refreshSignals.useMutation({
    onSuccess: () => {
      trpcUtils.signals.generate.invalidate({ portfolioId });
    }
  });
  // Build a map from ticker -> signal for O(1) lookup in the table
  const signalMap = useMemo(() => {
    const map = new Map<string, any>();
    if (signalsData) {
      (signalsData as any[]).forEach((s: any) => map.set(s.ticker, s));
    }
    return map;
  }, [signalsData]);

  // Fetch historical performance data from API
  const { data: historicalData, isLoading: isLoadingHistory } = trpc.portfolios.getHistoricalPerformance.useQuery(
    { 
      portfolioId, 
      period: selectedPeriod as '1M' | '3M' | '6M' | '1Y' | 'YTD' | '3Y' | '5Y' | 'All',
      debug: true, // Enable debug payload
      benchmark: selectedBenchmark,
    },
    { enabled: portfolioId > 0 }
  );
  
  // Process chart data - SIMPLIFIED (12.01.2026): No hypothetical line, only Portfolio and Benchmark
  const chartData = useMemo(() => {
    if (!historicalData?.chartData || historicalData.chartData.length === 0) {
      return { data: [], creationDateIndex: -1, hasHypothetical: false };
    }
    
    const realData = historicalData.chartData;
    
    // Sample data to show roughly one point per week for better visualization
    const sampleInterval = Math.max(1, Math.floor(realData.length / 52));
    const sampledData = realData.filter((_: any, index: number) => index % sampleInterval === 0 || index === realData.length - 1);
    
    // Format dates - all data is now "real" (no hypothetical distinction)
    const formattedData = sampledData.map((d: any) => ({
      date: new Date(d.date).toLocaleDateString('de-CH', { day: '2-digit', month: 'short', year: '2-digit' }),
      portfolio: includeCash ? (d.portfolioInclCash ?? d.portfolio) : d.portfolio,
      hypothetical: null, // No hypothetical data anymore
      benchmark: d.benchmark,
    }));

    return {
      data: formattedData,
      creationDateIndex: -1,
      hasHypothetical: false // No hypothetical data anymore
    };
  }, [historicalData, includeCash]);
  
  // Prepare pie chart data for asset allocation
  const assetAllocationData = useMemo(() => {
    // Group by category/type
    const categories: Record<string, number> = {};
    holdings.forEach((h: any) => {
      const category = h.category || 'Aktien';
      const weight = parseFloat(h.weight || '0');
      categories[category] = (categories[category] || 0) + weight;
    });
    
    // Add cash position if exists
    if (portfolio?.cashBalance && parseFloat(portfolio.cashBalance) > 0 && totalValueCHF > 0) {
      const cashWeight = (parseFloat(portfolio.cashBalance) / totalValueCHF) * 100;
      categories['Cash'] = parseFloat(cashWeight.toFixed(2));
    }
    
    return Object.entries(categories).map(([name, value]) => ({
      name,
      value: parseFloat(value.toFixed(2)),
    }));
  }, [holdings, portfolio?.cashBalance, totalValueCHF]);
  
  // Prepare pie chart data for sector allocation  
  const sectorAllocationData = useMemo(() => {
    return Object.entries(sectorWeights).map(([name, value]) => ({
      name,
      value: parseFloat(value.toFixed(2)),
    }));
  }, [sectorWeights]);
  
  // Colors for pie charts
  const COLORS = ['#00CFC1', '#00A89D', '#007D74', '#00524C', '#003D38', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899'];
  
  // Prepare stocks for edit modal
  const stocksForEdit = useMemo(() => {
    return holdings.map((h: any) => ({
      ticker: h.ticker,
      companyName: h.companyName,
      weight: parseFloat(h.weight || '0'),
      currentPrice: h.currentPriceLocal || h.currentPriceCHF || 0,
      currency: h.currency || 'CHF'
    }));
  }, [holdings]);
  
  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-lg text-muted-foreground">Portfolio wird geladen...</div>
        </div>
      </DashboardLayout>
    );
  }
  
  if (!portfolio) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-96 space-y-4">
          <div className="text-lg text-muted-foreground">Portfolio nicht gefunden</div>
          <Button onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zurück zum Dashboard
          </Button>
        </div>
      </DashboardLayout>
    );
  }
  
  const typeConfig = portfolio.portfolioType ? portfolioTypeConfig[portfolio.portfolioType] : null;
  
  const handleDeleteClick = () => {
    setIsDeleteDialogOpen(true);
  };
  
  const handleDeleteConfirm = async () => {
    try {
      await deletePortfolio.mutateAsync({ id: portfolioId });
      toast.success("Portfolio gelöscht");
      navigate("/dashboard");
    } catch (error: any) {
      toast.error('Fehler beim Löschen', { description: getUserErrorMessage(error) });
    }
    setIsDeleteDialogOpen(false);
  };
  
  const handlePortfolioSwitch = (newId: string) => {
    navigate(`/portfolios/${newId}`);
  };
  
  const handleEditSuccess = () => {
    // Invalidate and refetch data
    utils.portfolios.list.invalidate();
    utils.portfolios.getWithCurrency.invalidate(portfolioId);
    utils.portfolios.getHistoricalPerformance.invalidate({ portfolioId });
    refetch();
  };

  // U-03: Nach neuer Transaktion / PDF-Import alle abhängigen Daten neu laden
  const handleTransactionsChanged = () => {
    utils.portfolioTransactions.list.invalidate({ portfolioId });
    utils.realizedGainsHistory.getAll.invalidate({ portfolioId });
    utils.portfolios.list.invalidate();
    utils.portfolios.getWithCurrency.invalidate(portfolioId);
    utils.portfolios.getMultiPeriodPerformanceV2.invalidate();
    utils.portfolios.getPerformanceMetrics.invalidate({ portfolioId });
    utils.portfolios.getHistoricalPerformance.invalidate({ portfolioId });
    refetch();
  };
  
  // Handle portfolio activation (Demo -> Live)
  const handleActivatePortfolio = () => {
    if (!portfolioId || !startCapital) {
      toast.error("Bitte Startkapital eingeben");
      return;
    }

    activatePortfolio.mutate({
      portfolioId,
      startCapital,
      benchmark: selectedActivationBenchmark,
    });
  };
  
  // Check if portfolio is in demo mode (not live)
  const isDemo = portfolio.isLive !== 1;
  
  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header — matches design PDF: breadcrumb + title + subtitle + action buttons */}
        <div>
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-3">
            <button onClick={() => navigate('/dashboard')} className="hover:text-[#00CFC1] transition-colors">Dashboard</button>
            <span>›</span>
            <span className="text-gray-300">{portfolio.name}</span>
            {portfolio.isLive === 1 && (
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs px-1.5 py-0 h-4">
                <span className="relative flex h-1.5 w-1.5 mr-1">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-400"></span>
                </span>
                LIVE
              </Badge>
            )}
          </div>

          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">{portfolio.name}</h1>
              <p className="text-sm text-gray-400 mt-1">
                {typeConfig?.label || 'Portfolio'} · {holdings.length} Positionen
                {(() => {
                  // Priority: 1) manually set inceptionDate, 2) earliest buy transaction, 3) createdAt
                  const displayDate = (portfolio as any).inceptionDate
                    ? new Date((portfolio as any).inceptionDate)
                    : (portfolio as any).earliestBuyDate
                    ? new Date((portfolio as any).earliestBuyDate)
                    : portfolio.createdAt
                    ? new Date(portfolio.createdAt)
                    : null;
                  return displayDate ? ` · seit ${displayDate.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' })}` : '';
                })()}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {isDemo && (
                <Button
                  size="sm"
                  onClick={() => setIsActivationModalOpen(true)}
                  className="bg-[#00CFC1] hover:bg-[#00CFC1]/80 text-black"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Aktivieren
                </Button>
              )}
              {/* U-19: Live-Tracking deaktivieren (mit Warnhinweis) */}
              {!isDemo && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsDeactivateDialogOpen(true)}
                  className="border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
                >
                  Deaktivieren
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => setIsEditModalOpen(true)}>
                + Position
              </Button>
              <Button variant="outline" size="sm" onClick={() => setIsSettingsModalOpen(true)}>
                <Edit className="h-4 w-4 mr-1" />
                Bearbeiten
              </Button>
              {/* U-09/W6: Share-Dialog war fertig gebaut, aber nie öffenbar */}
              <Button
                variant="outline"
                size="sm"
                aria-label="Portfolio teilen"
                title="Portfolio teilen"
                onClick={() => setIsShareDialogOpen(true)}
              >
                <Share2 className="h-4 w-4" />
              </Button>
              <Button size="sm" onClick={() => handleTabChange('optimierung')} className="bg-[#00CFC1] hover:bg-[#00CFC1]/80 text-black">
                Optimieren
              </Button>
            </div>
          </div>
        </div>

        {/* Portfolio Switcher — compact */}
        {allPortfolios && allPortfolios.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Portfolio wechseln:</span>
            <Select value={portfolioId.toString()} onValueChange={handlePortfolioSwitch}>
              <SelectTrigger className="w-48 h-8 text-xs bg-[#1a1f2e] border-white/10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1f2e] border-white/10">
                {allPortfolios.map((p) => (
                  <SelectItem key={p.id} value={p.id.toString()} className="text-xs">
                    <div className="flex items-center gap-2">
                      <span>{p.name}</span>
                      {p.isLive === 1 && (
                        <Badge variant="default" className="bg-green-500 text-white text-xs px-1 py-0">Live</Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        
        {/* KPI Row — matches design PDF: WERT | YTD | GESAMT | SHARPE — flat style, no teal top border */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-0 border border-white/10 rounded-lg overflow-hidden">
          {/* WERT */}
          <div className="bg-[#0f1420] p-5 border-r border-white/10">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">WERT</p>
            <p className="text-2xl font-bold font-mono text-white">
              CHF {new Intl.NumberFormat('de-CH', { maximumFractionDigits: 0 }).format(totalValueCHF)}
            </p>
            {portfolio?.investmentAmount && (
              <p className="text-xs text-gray-400 mt-1">Einstand CHF {new Intl.NumberFormat('de-CH', { maximumFractionDigits: 0 }).format(Number(portfolio.investmentAmount))}</p>
            )}
            {/* U-13: Hinweis, wenn Positionen wegen fehlender Kurs-/FX-Daten
                nicht im Gesamtwert enthalten sind */}
            {missingDataCount > 0 && (
              <UiTooltip>
                <TooltipTrigger asChild>
                  <p className="text-xs text-amber-400 mt-1 cursor-help">
                    ohne {missingDataCount} Position{missingDataCount > 1 ? 'en' : ''} mit fehlenden Daten
                  </p>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-[#1a1f2e] border-white/20 text-white max-w-[260px] p-3">
                  <p className="text-xs">
                    Für {missingDataCount} Position{missingDataCount > 1 ? 'en' : ''} fehlen aktuelle Kurs-
                    oder Wechselkursdaten. Diese Positionen sind im angezeigten Wert nicht enthalten
                    (siehe Markierung in der Positionsliste).
                  </p>
                </TooltipContent>
              </UiTooltip>
            )}
          </div>

          {/* YTD — kanonische Quelle: getMultiPeriodPerformanceV2 (identisch zur Portfolios-Liste) */}
          <div className="bg-[#0f1420] p-5 border-r border-white/10">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2" title="YTD = seit Jahresbeginn">YTD</p>
            {(() => {
              const entry = (multiPeriod as any[] | undefined)?.find(p => p.portfolioId === portfolioId);
              const ytdStocks = entry?.performance?.YTD ?? null;
              const ytdInclCash = entry?.performanceInclCash?.YTD ?? ytdStocks;
              const ytdPerf = includeCash ? ytdInclCash : ytdStocks;
              const benchPerf = entry?.benchmarkPerformance?.YTD ?? null;
              return (
                <>
                  <p className={`text-2xl font-bold font-mono ${(ytdPerf ?? 0) >= 0 ? 'text-[#00CFC1]' : 'text-negative'}`}>
                    {ytdPerf !== null ? `${ytdPerf >= 0 ? '+' : ''}${ytdPerf.toFixed(1)}%` : '—'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    S&amp;P 500 {benchPerf !== null ? `${benchPerf >= 0 ? '+' : ''}${benchPerf.toFixed(1)}%` : '—'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    in CHF · gewichtete Rendite · {includeCash ? 'inkl. Cash' : 'nur Aktien'}
                  </p>
                </>
              );
            })()}
          </div>

          {/* SEIT KAUF — Gesamtrendite seit Erstinvestition */}
          <div className="bg-[#0f1420] p-5 border-r border-white/10">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">SEIT KAUF</p>
            {(() => {
              const invested = Number(portfolio?.investmentAmount || 0);
              const gain = totalValueCHF - invested;
              const pct = invested > 0 ? (gain / invested) * 100 : 0;
              return (
                <>
                  <p className={`text-2xl font-bold font-mono ${pct >= 0 ? 'text-[#00CFC1]' : 'text-negative'}`}>
                    {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
                  </p>
                  <p className={`text-xs mt-1 ${gain >= 0 ? 'text-gray-400' : 'text-negative'}`}>
                    G/V {formatCHF(gain, { decimals: 0, signDisplay: 'always' })}
                  </p>
                </>
              );
            })()}
          </div>

          {/* SHARPE */}
          <div className="bg-[#0f1420] p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2" title="Sharpe Ratio = risikoadjustierte Rendite">SHARPE</p>
            <p className="text-2xl font-bold font-mono text-white">
              {riskMetrics?.sharpeRatio !== undefined ? riskMetrics.sharpeRatio.toFixed(2) : '—'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Bench {riskMetrics?.sharpeBenchmark !== undefined ? riskMetrics.sharpeBenchmark.toFixed(2) : '—'}
            </p>
          </div>
        </div>

        {/* Tabs Section — matches design PDF, with URL persistence */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="flex flex-wrap gap-0 bg-transparent border-b border-white/10 p-0 h-auto rounded-none">
            {[
              { value: 'uebersicht', label: 'Übersicht' },
              { value: 'deepdive', label: 'Deep-Dive', aiBadge: true },
              { value: 'positionen', label: `Positionen`, badge: holdings.length },
              { value: 'signale', label: 'Signale', aiBadge: true },
              { value: 'transaktionen', label: 'Transaktionen', badge: transactions.length },
              { value: 'dividenden', label: 'Dividenden' },
              { value: 'performance', label: 'Performance' },
              { value: 'risiko', label: 'Risiko' },
              { value: 'optimierung', label: 'Optimierung & Empfehlungen', aiBadge: true },
            ].map(tab => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#00CFC1] data-[state=active]:text-[#00CFC1] data-[state=active]:bg-transparent text-gray-400 text-sm px-4 pb-3 pt-2 gap-1.5"
              >
                {tab.label}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="bg-[#00CFC1]/20 text-[#00CFC1] text-xs px-1.5 py-0.5 rounded-full">{tab.badge}</span>
                )}
                {tab.aiBadge && (
                  <span className="bg-[#00CFC1]/20 text-[#00CFC1] text-xs px-1.5 py-0.5 rounded-full uppercase tracking-wider">KI</span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* OVERVIEW TAB — 2 columns: chart left, top-positions + activity right */}
          <TabsContent value="uebersicht" className="mt-6">
            <div className="grid lg:grid-cols-5 gap-6">
              {/* Left: Wertentwicklung Chart */}
              <div className="lg:col-span-3">
                <div className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border border-[#00CFC1]/20 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-semibold text-white">Wertentwicklung seit Ersterfassung</h3>
                    </div>
                    <div className="flex gap-2 items-center">
                      <div className="flex gap-1">
                        {(['stocks', 'total'] as const).map(v => (
                          <button
                            key={v}
                            onClick={() => setIncludeCash(v === 'total')}
                            title={v === 'total' ? 'Gesamtportfolio inkl. Cash (Cash = 0% Rendite)' : 'Nur Aktien-Rendite (ohne Cash)'}
                            className={`px-2 py-1 text-xs rounded transition-colors ${
                              (includeCash ? v === 'total' : v === 'stocks')
                                ? 'bg-[#00CFC1]/20 text-[#00CFC1] font-medium'
                                : 'text-gray-400 hover:text-gray-300'
                            }`}
                          >{v === 'total' ? 'Gesamt' : 'Aktien'}</button>
                        ))}
                      </div>
                      <div className="flex gap-1">
                        {['1M', 'YTD', '1J', 'Max'].map(p => (
                          <button
                            key={p}
                            onClick={() => setSelectedPeriod(p === '1J' ? '1Y' : p === 'Max' ? 'All' : p)}
                            className={`px-2 py-1 text-xs rounded transition-colors ${
                              (selectedPeriod === p || (p === '1J' && selectedPeriod === '1Y') || (p === 'Max' && selectedPeriod === 'All'))
                                ? 'bg-[#00CFC1]/20 text-[#00CFC1] font-medium'
                                : 'text-gray-400 hover:text-gray-300'
                            }`}
                          >{p}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="h-56">
                    {isLoadingHistory ? (
                      <div className="flex items-center justify-center h-full">
                        <div className="w-5 h-5 border-2 border-[#00CFC1] border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : chartData.data.length === 0 ? (
                      <div className="flex items-center justify-center h-full">
                        <p className="text-gray-400 text-sm">Keine historischen Daten verfügbar</p>
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData.data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="overviewGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#00CFC1" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#00CFC1" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" vertical={false} />
                          <XAxis dataKey="date" stroke="#444" fontSize={10} tickLine={false} axisLine={false} />
                          <YAxis stroke="#444" fontSize={10} tickFormatter={(v) => `${v.toFixed(0)}%`} tickLine={false} axisLine={false} width={40} />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#1a1f2e', border: '1px solid #00CFC1', borderRadius: '6px', fontSize: '12px' }}
                            labelStyle={{ color: '#fff' }}
                            formatter={(value: number, name: string) => [`${value.toFixed(2)}%`, name === 'portfolio' ? portfolio.name : 'Benchmark']}
                          />
                          <Area type="monotone" dataKey="portfolio" stroke="#00CFC1" strokeWidth={2} fill="url(#overviewGradient)" />
                          <Area type="monotone" dataKey="benchmark" stroke="rgba(255,255,255,0.3)" strokeWidth={1.5} strokeDasharray="4 4" fill="none" />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Top-Positionen + Letzte Aktivität */}
              <div className="lg:col-span-2 space-y-4">
                {/* Top-Positionen */}
                <div className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border border-[#00CFC1]/20 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-white mb-3">Top-Positionen nach Gewicht</h3>
                  <div className="space-y-2">
                    {holdings
                      .slice()
                      .sort((a: any, b: any) => parseFloat(b.weight || '0') - parseFloat(a.weight || '0'))
                      .slice(0, 5)
                      .map((h: any) => (
                        <div key={h.ticker} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <Link href={`/aktien/${h.ticker}`}>
                              <span className="font-mono text-[#00CFC1] text-xs w-16 hover:underline cursor-pointer">{h.ticker}</span>
                            </Link>
                            <Link href={`/aktien/${h.ticker}`}>
                              <span className="text-gray-400 text-xs truncate max-w-[100px] hover:text-white cursor-pointer">{h.companyName}</span>
                            </Link>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <span className="text-gray-300 text-xs">{parseFloat(h.weight || '0').toFixed(1)}%</span>
                            <span className={`text-xs font-mono ${parseFloat(h.ytdPerformance || '0') >= 0 ? 'text-[#00CFC1]' : 'text-negative'}`}>
                              {parseFloat(h.ytdPerformance || '0') >= 0 ? '+' : ''}{parseFloat(h.ytdPerformance || '0').toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Letzte Aktivität */}
                <div className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border border-[#00CFC1]/20 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-white mb-3">Letzte Aktivität</h3>
                  <div className="space-y-2">
                    {transactions.slice(0, 4).map((tx: any) => {
                      const txDate = new Date(tx.transactionDate);
                      const isToday = txDate.toDateString() === new Date().toDateString();
                      const isYesterday = txDate.toDateString() === new Date(Date.now() - 86400000).toDateString();
                      const dateLabel = isToday ? 'Heute' : isYesterday ? 'Gestern' : txDate.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit' });
                      const isBuy = tx.transactionType === 'buy';
                      const isDividend = tx.transactionType === 'dividend';
                      return (
                        <div key={tx.id} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-400 w-12">{dateLabel}</span>
                            <span className={`${isDividend ? 'text-[#00CFC1]' : isBuy ? 'text-blue-400' : 'text-negative'}`}>
                              {isDividend ? 'Dividende' : isBuy ? 'Kauf' : 'Verkauf'} {tx.ticker}
                            </span>
                          </div>
                          <span className={`font-mono ${isDividend || isBuy ? 'text-[#00CFC1]' : 'text-negative'}`}>
                            {isDividend || isBuy ? '+' : '-'}{tx.shares ? `${Math.abs(parseFloat(tx.shares)).toFixed(0)} Stk.` : `CHF ${Math.abs(parseFloat(tx.totalAmount || '0')).toFixed(0)}`}
                          </span>
                        </div>
                      );
                    })}
                    {transactions.length === 0 && (
                      <p className="text-xs text-gray-400">Keine Transaktionen vorhanden</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
            {/* SNAPSHOTS SECTION — Kopien dieses Portfolios */}
          {allPortfolios && (allPortfolios as any[]).filter((p: any) => p.snapshotOfPortfolioId === portfolioId).length > 0 && (
            <div className="mt-4 bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border border-amber-500/20 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Camera className="h-4 w-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-white">Snapshots</h3>
                <span className="text-xs bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">
                  {(allPortfolios as any[]).filter((p: any) => p.snapshotOfPortfolioId === portfolioId).length}
                </span>
              </div>
              <div className="space-y-2">
                {(allPortfolios as any[])
                  .filter((p: any) => p.snapshotOfPortfolioId === portfolioId)
                  .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .map((snap: any) => (
                    <div key={snap.id} className="flex items-center justify-between text-xs bg-white/[0.03] rounded-lg px-3 py-2">
                      <div className="flex items-center gap-3">
                        <Camera className="h-3 w-3 text-amber-400 flex-shrink-0" />
                        <div>
                          <span className="text-white font-medium">{snap.name}</span>
                          {snap.snapshotNote && (
                            <span className="text-gray-400 ml-2">{snap.snapshotNote}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-gray-400">
                          {new Date(snap.createdAt).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                        </span>
                        <a
                          href={`/portfolio-vergleich?a=${portfolioId}&b=${snap.id}`}
                          className="flex items-center gap-1 text-[#00CFC1] hover:text-[#00CFC1]/80 transition-colors"
                        >
                          <GitCompareArrows className="h-3 w-3" />
                          Vergleichen
                        </a>
                        <a
                          href={`/portfolios/${snap.id}`}
                          className="text-gray-400 hover:text-white transition-colors"
                        >
                          Öffnen
                        </a>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
          </TabsContent>
          {/* POSITIONS TAB — matches design: TICKER | NAME | SEKTOR | GEWICHT | WERT | HEUTE | YTD */}
          <TabsContent value="positionen" className="mt-6">
            <div className={posView === 'tabelle' ? "bg-[#0f1420] border border-white/10 rounded-lg" : ""}>
              <div className={`flex items-center justify-between ${posView === 'tabelle' ? 'px-5 py-4 border-b border-white/10' : 'mb-3'}`}>
                {posView === 'konstellation' ? <div /> : (
                  <div>
                    <h3 className="text-sm font-semibold text-white">{holdings.length} Positionen</h3>
                    {posView === 'tabelle' && <p className="text-xs text-gray-400">sortiert nach {sortKey === 'weight' ? 'Gewicht' : sortKey === 'ytd' ? 'YTD' : sortKey === 'today' ? 'Heute' : sortKey === 'qualityScore' ? 'Qualität' : 'Signal'} {sortDir === 'desc' ? '↓' : '↑'}</p>}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-white/5 rounded-md p-1">
                    {(['tabelle', 'heatmap', 'konstellation'] as const).map((v) => (
                      <button
                        key={v}
                        onClick={() => setPosView(v)}
                        className={`px-2.5 py-1 text-xs rounded ${posView === v ? 'bg-white/10 text-white font-medium' : 'text-gray-400 hover:text-white'}`}
                      >
                        {v === 'tabelle' ? 'Tabelle' : v === 'heatmap' ? 'Heatmap' : 'Konstellation'}
                      </button>
                    ))}
                  </div>
                  {posView === 'tabelle' && (
                    <button
                      onClick={() => refreshSignalsMutation.mutate({ portfolioId })}
                      disabled={refreshSignalsMutation.isPending || isSignalsFetching}
                      title="Signal-Cache leeren und Scores neu berechnen"
                      className="flex items-center gap-1 px-2.5 py-1 text-xs rounded border border-white/20 text-gray-400 hover:text-white hover:border-white/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {(refreshSignalsMutation.isPending || isSignalsFetching) ? (
                        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                      ) : (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                      )}
                      Scores neu berechnen
                    </button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => setIsEditModalOpen(true)} className="border-white/20 text-white hover:bg-white/5 text-xs h-8 gap-1">
                    + Position
                  </Button>
                </div>
              </div>
              {posView === 'tabelle' && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Ticker</th>
                      <th className="text-left px-3 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Name</th>
                      <th className="text-left px-3 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Sektor</th>
                      <th className="text-right px-3 py-3 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none hover:text-white transition-colors" onClick={() => handleSort('weight')}>
                        <span className={sortKey === 'weight' ? 'text-[#00CFC1]' : 'text-gray-400'}>Gewicht {sortKey === 'weight' ? (sortDir === 'desc' ? '↓' : '↑') : ''}</span>
                      </th>
                      <th className="text-right px-3 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Wert</th>
                      <th className="text-right px-3 py-3 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none hover:text-white transition-colors" onClick={() => handleSort('today')}>
                        <span className={sortKey === 'today' ? 'text-[#00CFC1]' : 'text-gray-400'}>Heute {sortKey === 'today' ? (sortDir === 'desc' ? '↓' : '↑') : ''}</span>
                      </th>
                      <th className="text-right px-3 py-3 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none hover:text-white transition-colors" title="YTD = seit Jahresbeginn" onClick={() => handleSort('ytd')}>
                        <span className={sortKey === 'ytd' ? 'text-[#00CFC1]' : 'text-gray-400'}>YTD {sortKey === 'ytd' ? (sortDir === 'desc' ? '↓' : '↑') : ''}</span>
                      </th>
                      <th className="text-right px-3 py-3 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none hover:text-white transition-colors" title="Qualitäts-Score 0-100 — klicken zum Sortieren" onClick={() => handleSort('qualityScore')}>
                        <span className={sortKey === 'qualityScore' ? 'text-[#00CFC1]' : 'text-gray-400'}>Qualität {sortKey === 'qualityScore' ? (sortDir === 'desc' ? '↓' : '↑') : ''}</span>
                      </th>
                      <th className="text-right px-3 py-3 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none hover:text-white transition-colors" title="Signal-Score 0-100 (Momentum + Qualität + LPPL) — klicken zum Sortieren" onClick={() => handleSort('signalScore')}>
                        <span className={sortKey === 'signalScore' ? 'text-[#00CFC1]' : 'text-gray-400'}>Signal {sortKey === 'signalScore' ? (sortDir === 'desc' ? '↓' : '↑') : ''}</span>
                      </th>
                      <th className="w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {holdings
                      .slice()
                      .sort((a: any, b: any) => {
                        let aVal: number, bVal: number;
                        if (sortKey === 'weight') {
                          aVal = parseFloat(a.weight || '0');
                          bVal = parseFloat(b.weight || '0');
                        } else if (sortKey === 'ytd') {
                          aVal = parseFloat(a.ytdPerformance || '0');
                          bVal = parseFloat(b.ytdPerformance || '0');
                        } else if (sortKey === 'today') {
                          aVal = parseFloat(a.dailyChangePercent || a.changePercent || '0');
                          bVal = parseFloat(b.dailyChangePercent || b.changePercent || '0');
                        } else if (sortKey === 'qualityScore') {
                          aVal = a.qualityScore ?? -1;
                          bVal = b.qualityScore ?? -1;
                        } else if (sortKey === 'signalScore') {
                          aVal = signalMap.get(a.ticker)?.combinedScore ?? -1;
                          bVal = signalMap.get(b.ticker)?.combinedScore ?? -1;
                        } else {
                          aVal = 0; bVal = 0;
                        }
                        return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
                      })
                      .map((h: any) => {
                        const ytd = parseFloat(h.ytdPerformance || '0');
                        const today = parseFloat(h.dailyChangePercent || h.changePercent || '0');
                        const weight = parseFloat(h.weight || '0');
                        const value = (h.shares || 0) * (h.currentPriceCHF || 0);
                        const isExpanded = expandedTicker === h.ticker;
                        const sig = signalMap.get(h.ticker);
                        const qualScore = h.qualityScore ?? null;
                        const signalScore = sig?.combinedScore ?? null;
                        const qualColor = qualScore === null ? 'text-gray-500' : qualScore >= 70 ? 'text-emerald-400' : qualScore >= 50 ? 'text-[#00CFC1]' : qualScore >= 35 ? 'text-yellow-400' : 'text-red-400';
                        const sigColor = signalScore === null ? 'text-gray-500' : signalScore >= 70 ? 'text-emerald-400' : signalScore >= 55 ? 'text-[#00CFC1]' : signalScore >= 45 ? 'text-yellow-400' : 'text-red-400';
                        return (
                          <>
                          <tr
                            key={h.ticker}
                            tabIndex={0}
                            aria-label={`${h.companyName || h.ticker} Details anzeigen`}
                            className={`border-b border-white/5 hover:bg-white/[0.03] cursor-pointer focus-visible:outline-none focus-visible:bg-white/[0.06] ${isExpanded ? 'bg-white/[0.02]' : ''}`}
                            onClick={() => setExpandedTicker(isExpanded ? null : h.ticker)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                setExpandedTicker(isExpanded ? null : h.ticker);
                              }
                            }}
                          >
                            <td className="px-5 py-3.5">
                              <span className="font-mono text-xs font-semibold text-gray-300 tracking-wide">{h.ticker}</span>
                            </td>
                            <td className="px-3 py-3.5 text-sm text-white">
                              <div className="flex items-center gap-2">
                                <span>{h.companyName}</span>
                                {/* U-13: fehlender Kurs/Wechselkurs → Badge statt stiller CHF 0 */}
                                {(h.priceMissing || h.fxMissing) && (
                                  <UiTooltip>
                                    <TooltipTrigger asChild>
                                      <span onClick={(e) => e.stopPropagation()}>
                                        <Badge
                                          className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs px-1.5 py-0 cursor-help shrink-0"
                                          aria-label={h.priceMissing ? 'Kurs fehlt' : 'Wechselkurs fehlt'}
                                        >
                                          {h.priceMissing ? 'Kurs fehlt' : 'Wechselkurs fehlt'}
                                        </Badge>
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="bg-[#1a1f2e] border-white/20 text-white max-w-[260px] p-3">
                                      <p className="text-xs">
                                        Für diese Position ist derzeit kein aktueller{' '}
                                        {h.priceMissing ? 'Kurs' : 'Wechselkurs'} verfügbar. Ihr Wert ist
                                        deshalb nicht im Gesamtwert des Portfolios enthalten.
                                      </p>
                                    </TooltipContent>
                                  </UiTooltip>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-3.5">
                              <span className="text-xs text-[#00CFC1]/80">{h.sector || '—'}</span>
                            </td>
                            <td className="px-3 py-3.5 text-right text-sm text-gray-300">{weight.toFixed(1)}%</td>
                            <td className="px-3 py-3.5 text-right">
                              {(h.priceMissing || h.fxMissing) ? (
                                <span className="text-sm text-gray-400" aria-label="Wert nicht verfügbar">—</span>
                              ) : (
                                <span className="text-sm text-white">CHF {new Intl.NumberFormat('de-CH', { maximumFractionDigits: 0 }).format(value)}</span>
                              )}
                            </td>
                            <td className="px-3 py-3.5 text-right">
                              <span className={`text-sm font-mono ${today >= 0 ? 'text-[#00CFC1]' : 'text-negative'}`}>
                                {today >= 0 ? '+' : ''}{today.toFixed(2)}%
                              </span>
                            </td>
                            <td className="px-3 py-3.5 text-right">
                              <span className={`text-sm font-mono ${ytd >= 0 ? 'text-[#00CFC1]' : 'text-negative'}`}>
                                {ytd >= 0 ? '+' : ''}{ytd.toFixed(1)}%
                              </span>
                            </td>
                            <td className="px-3 py-3.5 text-right">
                              <span className={`text-sm font-mono font-semibold ${qualColor}`}>
                                {qualScore !== null ? qualScore : '—'}
                              </span>
                            </td>
                            <td className="px-3 py-3.5 text-right">
                              <span className={`text-sm font-mono font-semibold ${sigColor}`}>
                                {signalScore !== null ? Math.round(signalScore) : '—'}
                              </span>
                            </td>
                            <td className="pr-2 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditFieldsHolding(h);
                                    setIsEditFieldsOpen(true);
                                  }}
                                  aria-label={`Position ${h.ticker} bearbeiten`}
                                  title="Position bearbeiten (Ticker, ISIN, Stück, Preis, Währung)"
                                  className="text-gray-500 hover:text-[#00CFC1] transition-colors p-1"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setExpandedTicker(isExpanded ? null : h.ticker); }}
                                  aria-label={isExpanded ? 'Details schliessen' : 'Details anzeigen'}
                                  title={isExpanded ? 'Details schliessen' : 'Details anzeigen'}
                                  className="text-gray-500 hover:text-[#00CFC1] transition-colors p-1"
                                >
                                  {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                </button>
                              </div>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr key={`${h.ticker}-detail`} className="bg-[#0a0f1a] border-b border-white/10">
                              <td colSpan={10} className="px-5 py-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {/* Scores Panel — transparent, erklärend */}
                                  <div className="bg-[#0f1420] border border-white/10 rounded-lg p-4">
                                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Scores & Signal</h4>

                                    {/* Haupt-Scores: Qualität + Signal nebeneinander */}
                                    <div className="grid grid-cols-2 gap-3 mb-3">
                                      <div className="bg-[#0a0f1a] rounded-md p-2.5">
                                        <div className="flex items-center gap-1.5 mb-1">
                                          <ShieldCheck className="h-3.5 w-3.5 text-[#00CFC1]" />
                                          <p className="text-xs text-gray-400">Qualitäts-Score</p>
                                        </div>
                                        <p className={`text-xl font-bold font-mono ${qualColor}`}>
                                          {qualScore !== null ? qualScore : '—'}<span className="text-xs text-gray-500">/100</span>
                                        </p>
                                        <p className="text-[10px] text-gray-500 mt-0.5">P/E · PEG · Beta · Volatilität · Sharpe</p>
                                      </div>
                                      <div className="bg-[#0a0f1a] rounded-md p-2.5">
                                        <div className="flex items-center gap-1.5 mb-1">
                                          <Zap className="h-3.5 w-3.5 text-yellow-400" />
                                          <p className="text-xs text-gray-400">Signal-Score</p>
                                        </div>
                                        <p className={`text-xl font-bold font-mono ${sigColor}`}>
                                          {signalScore !== null ? Math.round(signalScore) : '—'}<span className="text-xs text-gray-500">/100</span>
                                        </p>
                                        <p className="text-[10px] text-gray-500 mt-0.5">Momentum + Qualität + LPPL-Risiko</p>
                                      </div>
                                    </div>

                                    {/* Signal-Typ + Komponenten */}
                                    {sig && (
                                      <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                          <div>
                                            <p className="text-xs text-gray-400 mb-0.5">Signal-Typ</p>
                                            <Badge className={`text-xs ${
                                              sig.type === 'buy' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                                              sig.type === 'sell' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                                              'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                                            }`}>
                                              {sig.type === 'buy' ? 'Kaufen' : sig.type === 'sell' ? 'Verkaufen' : 'Halten'}
                                            </Badge>
                                          </div>
                                          <div className="text-right">
                                            <p className="text-xs text-gray-400 mb-0.5">Stärke</p>
                                            <p className="text-xs text-white">{sig.strength === 'strong' ? 'Stark' : sig.strength === 'moderate' ? 'Mittel' : 'Schwach'}</p>
                                          </div>
                                        </div>

                                        {/* Komponenten-Breakdown */}
                                        <div className="border-t border-white/5 pt-2">
                                          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">Score-Komponenten</p>
                                          <div className="grid grid-cols-2 gap-1.5">
                                            {/* Momentum */}
                                            <div className="flex items-center justify-between bg-[#0a0f1a] rounded px-2 py-1">
                                              <span className="text-[10px] text-gray-400">Momentum</span>
                                              <div className="flex items-center gap-1">
                                                {sig.momentumScore !== undefined ? (
                                                  <span className={`text-xs font-mono font-semibold ${
                                                    sig.momentumScore >= 0.3 ? 'text-emerald-400' :
                                                    sig.momentumScore >= -0.1 ? 'text-yellow-400' : 'text-red-400'
                                                  }`}>{Math.round((sig.momentumScore + 1) * 50)}/100</span>
                                                ) : <span className="text-xs text-gray-500">—</span>}
                                                {sig.momentumGrade && sig.momentumGrade !== 'N/A' && (
                                                  <span className={`text-[10px] font-bold px-1 rounded ${
                                                    sig.momentumGrade === 'A' ? 'bg-emerald-500/20 text-emerald-400' :
                                                    sig.momentumGrade === 'B' ? 'bg-[#00CFC1]/20 text-[#00CFC1]' :
                                                    sig.momentumGrade === 'C' ? 'bg-yellow-500/20 text-yellow-400' :
                                                    'bg-red-500/20 text-red-400'
                                                  }`}>{sig.momentumGrade}</span>
                                                )}
                                              </div>
                                            </div>
                                            {/* Qualität (ROE/D-E/FCF/Marge) */}
                                            <div className="flex items-center justify-between bg-[#0a0f1a] rounded px-2 py-1">
                                              <span className="text-[10px] text-gray-400">Qualität (Fund.)</span>
                                              <div className="flex items-center gap-1">
                                                {sig.qualityScore !== undefined ? (
                                                  <span className={`text-xs font-mono font-semibold ${
                                                    sig.qualityScore >= 0.3 ? 'text-emerald-400' :
                                                    sig.qualityScore >= -0.1 ? 'text-yellow-400' : 'text-red-400'
                                                  }`}>{Math.round((sig.qualityScore + 1) * 50)}/100</span>
                                                ) : <span className="text-xs text-gray-500">—</span>}
                                                {sig.qualityGrade && sig.qualityGrade !== 'N/A' ? (
                                                  <span className={`text-[10px] font-bold px-1 rounded ${
                                                    sig.qualityGrade === 'A' ? 'bg-emerald-500/20 text-emerald-400' :
                                                    sig.qualityGrade === 'B' ? 'bg-[#00CFC1]/20 text-[#00CFC1]' :
                                                    sig.qualityGrade === 'C' ? 'bg-yellow-500/20 text-yellow-400' :
                                                    'bg-red-500/20 text-red-400'
                                                  }`}>{sig.qualityGrade}</span>
                                                ) : (
                                                  <span className="text-[10px] text-gray-500 px-1">N/A</span>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                          {/* Hinweis wenn Qualitäts-Fundamentaldaten fehlen */}
                                          {sig.qualityGrade === 'N/A' && (
                                            <p className="text-[10px] text-amber-400/70 mt-1.5">
                                              ⚠ ROE/Verschuldung/FCF-Daten fehlen — Qualitäts-Grade nicht berechenbar. Daten unter Admin → Aktien anreichern.
                                            </p>
                                          )}
                                          {/* LPPL Bubble-Risiko wenn vorhanden */}
                                          {sig.bubbleScore !== undefined && sig.bubbleScore > 0.1 && (
                                            <div className="mt-1.5 flex items-center justify-between bg-[#0a0f1a] rounded px-2 py-1">
                                              <span className="text-[10px] text-gray-400">LPPL Bubble-Risiko</span>
                                              <span className={`text-xs font-mono ${
                                                sig.bubbleScore > 0.5 ? 'text-red-400' : sig.bubbleScore > 0.25 ? 'text-yellow-400' : 'text-gray-400'
                                              }`}>{(sig.bubbleScore * 100).toFixed(0)}%</span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  {/* Fundamentals Panel */}
                                  <div className="bg-[#0f1420] border border-white/10 rounded-lg p-4">
                                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Fundamentaldaten</h4>
                                    <div className="grid grid-cols-3 gap-x-4 gap-y-2">
                                      <div>
                                        <p className="text-xs text-gray-400">P/E Ratio</p>
                                        <p className="text-sm font-semibold text-white">{sig?.peRatio?.toFixed(1) ?? (h.peRatio ? parseFloat(h.peRatio).toFixed(1) : '—')}</p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-gray-400">PEG Ratio</p>
                                        <p className="text-sm font-semibold text-white">{sig?.pegRatio?.toFixed(2) ?? (h.pegRatio ? parseFloat(h.pegRatio).toFixed(2) : '—')}</p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-gray-400">Div. Rendite</p>
                                        <p className="text-sm font-semibold text-white">{sig?.dividendYield?.toFixed(2) ?? (h.dividendYield ? parseFloat(h.dividendYield).toFixed(2) : '—')}%</p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-gray-400">RSI (14)</p>
                                        <p className={`text-sm font-semibold ${
                                          sig?.rsi14 ? (sig.rsi14 < 30 ? 'text-emerald-400' : sig.rsi14 > 70 ? 'text-red-400' : 'text-white') : 'text-white'
                                        }`}>{sig?.rsi14?.toFixed(0) ?? '—'}</p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-gray-400">Zielkurs</p>
                                        <p className="text-sm font-semibold text-white">{sig?.targetPrice?.toFixed(2) ?? '—'}</p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-gray-400">52W Hoch</p>
                                        <p className="text-sm font-semibold text-white">{sig?.fiftyTwoWeekHigh?.toFixed(2) ?? '—'}</p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-gray-400">52W Tief</p>
                                        <p className="text-sm font-semibold text-white">{sig?.fiftyTwoWeekLow?.toFixed(2) ?? '—'}</p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-gray-400">Beta</p>
                                        <p className="text-sm font-semibold text-white">{h.beta ? parseFloat(h.beta).toFixed(2) : '—'}</p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-gray-400">Volatilität</p>
                                        <p className="text-sm font-semibold text-white">{h.volatility ? parseFloat(h.volatility).toFixed(1) + '%' : '—'}</p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                {/* Signal Reason */}
                                {sig?.reason && (
                                  <div className="mt-3 bg-[#0f1420] border border-white/10 rounded-lg p-3">
                                    <p className="text-xs font-semibold text-gray-400 mb-1">Signal-Begründung</p>
                                    <p className="text-xs text-gray-300 leading-relaxed">{sig.reason}</p>
                                  </div>
                                )}
                                {/* Score History Sparkline */}
                                <ScoreHistorySparkline ticker={h.ticker} />
                                {/* Link to full stock detail */}
                                <div className="mt-4 flex justify-end">
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); navigate(`/aktien/${h.ticker}?from=${portfolioId}`); }}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#00CFC1] text-black text-sm font-semibold hover:bg-[#00CFC1]/80 transition-colors"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                                    Aktien-Details
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )}
                          </>
                        );
                      })}
                    {portfolio?.cashBalance && parseFloat(portfolio.cashBalance) > 0 && (
                      <tr className="border-b border-white/5">
                        <td className="px-5 py-3.5"><span className="font-mono text-xs text-gray-400">CASH</span></td>
                        <td className="px-3 py-3.5 text-sm text-gray-400">Cash (CHF)</td>
                        <td className="px-3 py-3.5"><span className="text-xs text-gray-400">—</span></td>
                        <td className="px-3 py-3.5 text-right text-sm text-gray-400">{((parseFloat(portfolio.cashBalance) / totalValueCHF) * 100).toFixed(1)}%</td>
                        <td className="px-3 py-3.5 text-right text-sm text-white">CHF {new Intl.NumberFormat('de-CH', { maximumFractionDigits: 0 }).format(parseFloat(portfolio.cashBalance))}</td>
                        <td className="px-3 py-3.5 text-right text-gray-400 text-sm">—</td>
                        <td className="px-5 py-3.5 text-right text-gray-400 text-sm">—</td>
                        <td></td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              )}
              {posView === 'heatmap' && (
                <div className="bg-[#0f1420] border border-[#00CFC1]/30 rounded-lg p-4">
                  <PositionsTreemap
                    holdings={holdings.map((h: any) => ({
                      ticker: h.ticker,
                      name: h.companyName || h.ticker,
                      sector: h.sector || 'Other',
                      region: 'Other' as const,
                      weight: typeof h.weight === 'number' ? h.weight : parseFloat(h.weight || '0'),
                      value: parseFloat(h.shares || '0') * (h.currentPriceCHF || 0),
                      shares: parseFloat(h.shares || '0'),
                      currentPrice: h.currentPrice || 0,
                      currency: h.currency || 'CHF',
                      change1d: parseFloat(h.dailyChangePercent || h.changePercent || '0'),
                      ytd: parseFloat(h.ytdPerformance || '0'),
                      color: SECTOR_COLOR[h.sector] ?? '#888',
                    }))}
                    width={1100}
                    height={380}
                    dark
                    bgColor="#0a0f1a"
                    textColor="#ffffff"
                    mutedColor="#9ca3af"
                    cardAltColor="#131b27"
                  />
                </div>
              )}
              {posView === 'konstellation' && (
                <PositionsKonstellation
                  holdings={holdings}
                  portfolioId={portfolioId}
                  onOptimize={() => handleTabChange('optimierung')}
                />
              )}
            </div>
          </TabsContent>

          {/* SIGNALE TAB — Handelssignale für die aktuellen Positionen dieses Portfolios */}
          <TabsContent value="signale" className="mt-6">
            <PortfolioSignalsTab portfolioId={portfolioId} portfolioValueCHF={totalValueCHF} />
          </TabsContent>

          {/* TRANSACTIONS TAB — matches design: 4 KPIs + filter chips + table */}
          <TabsContent value="transaktionen" className="mt-6">
            {/* U-19: Demo-Portfolios führen keine Transaktionen — Hinweis statt Liste */}
            {isDemo && (
              <div className="bg-[#0f1420] border border-white/10 rounded-lg p-10 text-center">
                <FileText className="h-10 w-10 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-300 text-sm font-medium">Demo-Portfolios führen keine Transaktionen.</p>
                <p className="text-gray-400 text-sm mt-1">
                  Aktivieren Sie Live-Tracking, um Käufe, Verkäufe und Dividenden zu erfassen und auszuwerten.
                </p>
                <Button
                  size="sm"
                  onClick={() => setIsActivationModalOpen(true)}
                  className="mt-4 bg-[#00CFC1] hover:bg-[#00CFC1]/80 text-black"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Live-Tracking aktivieren
                </Button>
              </div>
            )}
            {/* U-03: Transaktion erfassen + PDF-Import — nur für Live-Portfolios
                (konsistent zu den Lösch-Guards weiter unten) */}
            {!isDemo && (
              <div className="flex justify-end gap-2 mb-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsPdfImportOpen(true)}
                  className="border-[#00CFC1]/30 text-[#00CFC1] hover:bg-[#00CFC1]/10"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  PDF importieren
                </Button>
                <Button
                  size="sm"
                  onClick={() => setIsTransactionModalOpen(true)}
                  className="bg-[#00CFC1] hover:bg-[#00CFC1]/80 text-black"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Transaktion erfassen
                </Button>
              </div>
            )}
            {!isDemo && (() => {
              const buys = transactions.filter((t: any) => (t.type || t.transactionType) === 'BUY' || (t.type || t.transactionType) === 'buy');
              const sells = transactions.filter((t: any) => (t.type || t.transactionType) === 'SELL' || (t.type || t.transactionType) === 'sell');
              const dividends = transactions.filter((t: any) => (t.type || t.transactionType) === 'dividend');
              // Volumen in CHF (totalAmountCHF ist der vom Server umgerechnete Betrag; Fallback shares*price)
              const volCHF = (t: any) => parseFloat(t.totalAmountCHF ?? '') || (parseFloat(t.shares || t.quantity || 0) * parseFloat(t.price || t.pricePerShare || 0));
              const buyVolume = buys.reduce((s: number, t: any) => s + volCHF(t), 0);
              const sellVolume = sells.reduce((s: number, t: any) => s + volCHF(t), 0);
              const divTotal = dividends.reduce((s: number, t: any) => s + volCHF(t), 0);
              const realizedTotal = realizedGains.reduce((s: number, g: any) => s + (g.netProfit ?? g.totalGain ?? 0), 0);
              return (
                <>
                  {/* 4 KPI Cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-0 border border-white/10 rounded-lg overflow-hidden mb-6">
                    <div className="bg-[#0f1420] p-4 border-r border-white/10">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">KÄUFE</p>
                      <p className="text-xl font-bold font-mono text-positive">{buys.length}</p>
                      <p className="text-xs text-gray-400 mt-0.5">Vol. CHF {new Intl.NumberFormat('de-CH', { maximumFractionDigits: 0 }).format(buyVolume)}</p>
                    </div>
                    <div className="bg-[#0f1420] p-4 border-r border-white/10">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">VERKÄUFE</p>
                      <p className="text-xl font-bold font-mono text-negative">{sells.length}</p>
                      <p className="text-xs text-gray-400 mt-0.5">Vol. CHF {new Intl.NumberFormat('de-CH', { maximumFractionDigits: 0 }).format(sellVolume)}</p>
                    </div>
                    <div className="bg-[#0f1420] p-4 border-r border-white/10">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">DIVIDENDEN</p>
                      <p className="text-xl font-bold font-mono text-[#00CFC1]">{dividends.length}</p>
                      <p className="text-xs text-gray-400 mt-0.5">CHF {new Intl.NumberFormat('de-CH', { maximumFractionDigits: 0 }).format(divTotal)}</p>
                    </div>
                    <div className="bg-[#0f1420] p-4">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">REAL. G/V</p>
                      <p className={`text-xl font-bold font-mono ${realizedTotal >= 0 ? 'text-[#00CFC1]' : 'text-negative'}`}>
                        {formatCHF(realizedTotal, { decimals: 0, signDisplay: 'always' })}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">{realizedGains.length} Positionen</p>
                    </div>
                  </div>

                  {/* Filter Chips + Table */}
                  {(() => {
                    const isRealized = txFilter === 'realisierte';
                    const filteredTx = txFilter === 'alle' ? transactions :
                      txFilter === 'kaeufe' ? buys :
                      txFilter === 'verkaeufe' ? sells :
                      txFilter === 'dividenden' ? dividends : transactions;

                    // CSV-Export der aktuell sichtbaren Ansicht
                    const handleExport = () => {
                      const csvEscape = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
                      let rows: string[][];
                      if (isRealized) {
                        rows = [["Datum", "Ticker", "Name", "Stk.", "Kaufpreis", "Verkaufspreis", "Netto G/V", "Rendite %"]];
                        realizedGains.forEach((g: any) => rows.push([
                          new Date(g.transactionDate).toLocaleDateString('de-CH'), g.ticker, g.stockName,
                          g.shares, g.avgCostBasis, g.sellPrice, g.netProfit ?? g.totalGain ?? 0, g.realizedGainPercent ?? 0,
                        ]));
                      } else {
                        rows = [["Datum", "Typ", "Ticker", "Stk.", "Preis", "Waehrung", "Total CHF"]];
                        filteredTx.forEach((t: any) => rows.push([
                          new Date(t.date || t.transactionDate).toLocaleDateString('de-CH'),
                          (t.type || t.transactionType), t.ticker, t.shares || t.quantity,
                          t.price || t.pricePerShare, t.currency || 'CHF', volCHF(t).toFixed(2),
                        ]));
                      }
                      const csv = rows.map(r => r.map(csvEscape).join(';')).join('\n');
                      const blob = new Blob(["﻿" + csv], { type: 'text/csv;charset=utf-8;' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${portfolio.name.replace(/[^a-z0-9]/gi, '_')}_${isRealized ? 'realisierte_gewinne' : 'transaktionen'}.csv`;
                      a.click();
                      URL.revokeObjectURL(url);
                      toast.success('Export erstellt');
                    };

                    const allTxIds = filteredTx.map((t: any) => t.id as number);
                    const allSelected = allTxIds.length > 0 && allTxIds.every((id: number) => selectedTxIds.has(id));
                    const toggleAll = () => { if (allSelected) setSelectedTxIds(new Set()); else setSelectedTxIds(new Set(allTxIds)); };
                    const toggleOne = (id: number) => { const next = new Set(selectedTxIds); if (next.has(id)) next.delete(id); else next.add(id); setSelectedTxIds(next); };
                    return (
                      <div className="bg-[#0f1420] border border-white/10 rounded-lg">
                        <div className="flex items-center gap-2 px-5 py-3 border-b border-white/10">
                          {[['alle', 'Alle'], ['kaeufe', 'Käufe'], ['verkaeufe', 'Verkäufe'], ['dividenden', 'Dividenden'], ['realisierte', 'Realisierte Gewinne']].map(([key, label]) => (
                            <button
                              key={key}
                              onClick={() => { setTxFilter(key); setSelectedTxIds(new Set()); }}
                              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                                txFilter === key ? 'bg-[#00CFC1]/20 text-[#00CFC1] font-medium' : 'text-gray-400 hover:text-white hover:bg-white/5'
                              }`}
                            >{label}</button>
                          ))}
                          <span className="ml-auto text-xs text-gray-400">{isRealized ? realizedGains.length : filteredTx.length} Einträge</span>
                          {!isDemo && !isRealized && selectedTxIds.size > 0 && (
                            <button
                              onClick={() => setIsBulkDeleteDialogOpen(true)}
                              disabled={bulkDeleteMutation.isPending}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-md bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25 disabled:opacity-40"
                            >
                              <Trash2 className="h-3 w-3" /> {selectedTxIds.size} löschen
                            </button>
                          )}
                          <button
                            onClick={handleExport}
                            disabled={isRealized ? realizedGains.length === 0 : filteredTx.length === 0}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-md border border-white/15 text-gray-300 hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Share2 className="h-3 w-3" /> Export
                          </button>
                        </div>
                        {isRealized ? (
                          realizedGains.length === 0 ? (
                            <p className="text-gray-400 text-center py-8 text-sm">Keine realisierten Gewinne vorhanden</p>
                          ) : (
                            <div className="p-4"><RealizedGainsTable gains={realizedGains} /></div>
                          )
                        ) : filteredTx.length === 0 ? (
                          <p className="text-gray-400 text-center py-8 text-sm">Keine Transaktionen vorhanden</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead>
                                <tr className="border-b border-white/10">
                                  {!isDemo && (
                                    <th className="px-3 py-3 w-8">
                                      <input type="checkbox" checked={allSelected} onChange={toggleAll} className="accent-[#00CFC1] cursor-pointer" />
                                    </th>
                                  )}
                                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Datum</th>
                                  <th className="text-left px-3 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Typ</th>
                                  <th className="text-left px-3 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Ticker</th>
                                  <th className="text-right px-3 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Stk.</th>
                                  <th className="text-right px-3 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Preis</th>
                                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Total</th>
                                  {!isDemo && <th className="px-3 py-3 w-8"></th>}
                                </tr>
                              </thead>
                              <tbody>
                                {filteredTx.slice(0, 50).map((t: any) => {
                                  const txType = t.type || t.transactionType;
                                  const isBuy = txType === 'BUY' || txType === 'buy';
                                  const isSell = txType === 'SELL' || txType === 'sell';
                                  const isDiv = txType === 'dividend';
                                  return (
                                    <tr key={t.id} className={`border-b border-white/5 hover:bg-white/[0.03] ${selectedTxIds.has(t.id) ? 'bg-red-500/5' : ''}`}>
                                      {!isDemo && (
                                        <td className="px-3 py-3">
                                          <input type="checkbox" checked={selectedTxIds.has(t.id)} onChange={() => toggleOne(t.id)} className="accent-[#00CFC1] cursor-pointer" />
                                        </td>
                                      )}
                                      <td className="px-5 py-3 text-sm text-gray-400">{new Date(t.date || t.transactionDate).toLocaleDateString('de-CH')}</td>
                                      <td className="px-3 py-3">
                                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                                          isBuy ? 'bg-emerald-500/10 text-positive' :
                                          isDiv ? 'bg-[#00CFC1]/10 text-[#00CFC1]' :
                                          'bg-red-500/10 text-negative'
                                        }`}>
                                          {isBuy ? 'Kauf' : isSell ? 'Verkauf' : isDiv ? 'Dividende' : txType}
                                        </span>
                                      </td>
                                      <td className="px-3 py-3 text-sm font-mono font-semibold text-gray-300">{t.ticker}</td>
                                      <td className="px-3 py-3 text-right text-sm text-white">{t.shares || t.quantity || '—'}</td>
                                      <td className="px-3 py-3 text-right text-sm text-gray-300">{formatCurrency(t.price || t.pricePerShare || 0, t.currency || 'CHF')}</td>
                                      <td className="px-5 py-3 text-right text-sm text-white font-semibold">{formatCurrency((t.shares || t.quantity || 0) * (t.price || t.pricePerShare || 0), t.currency || 'CHF')}</td>
                                      {!isDemo && (
                                        <td className="px-2 py-3">
                                          <DeleteTransactionButton transactionId={t.id} portfolioId={portfolioId} />
                                        </td>
                                      )}
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </>
              );
            })()}
          </TabsContent>

          {/* DIVIDENDEN TAB — F-06: anstehende Dividenden dieses Portfolios */}
          <TabsContent value="dividenden" className="mt-6">
            <DividendenTab portfolioId={portfolioId} />
          </TabsContent>

          {/* PERFORMANCE TAB */}
          <TabsContent value="performance" className="mt-6">
            <PerformanceTab
              portfolioId={portfolioId}
              holdings={holdings}
              multiPeriod={multiPeriod}
              totalValueCHF={totalValueCHF}
              investmentAmount={Number(portfolio?.investmentAmount || 0)}
              realizedGains={realizedGains}
              transactions={transactions}
            />
          </TabsContent>

          {/* RISK TAB — echte Kennzahlen + LPPL-Bubble-Indikator (S.05) */}
          <TabsContent value="risiko" className="mt-6">
            <RiskTab portfolioId={portfolioId} />
          </TabsContent>

          {/* OPTIMIERUNG & EMPFEHLUNGEN — F3: konsolidiert (Optimieren KI + Empfehlungen KI) */}
          <TabsContent value="optimierung" className="mt-6">
            <OptimierungEmpfehlungenTab portfolioId={portfolioId} holdings={holdings} totalValueCHF={totalValueCHF} cashBalance={cashBalance} onNavigateToTransactions={() => handleTabChange('transaktionen')} />
          </TabsContent>

          {/* DEEP-DIVE TAB — Fundamentaldaten + KI-Analyse (F-12: aus Copilot hierher verschoben) */}
          <TabsContent value="deepdive" className="mt-6">
            <PortfolioDeepDive portfolioId={portfolioId} />
          </TabsContent>
        </Tabs>

        {/* Quick Actions */}
        <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30">
          <CardHeader>
            <CardTitle className="text-white">Schnellaktionen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" size="sm" onClick={() => navigate('/price-alerts')}>
                <Bell className="h-4 w-4 mr-2" />
                Alarm erstellen
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setIsEditModalOpen(true)}
                className="border-cyan-400/50 text-cyan-400 hover:bg-cyan-400/10"
              >
                <Edit className="h-4 w-4 mr-2" />
                Portfolio bearbeiten
              </Button>
              <Button variant="outline" size="sm" onClick={handleDeleteClick}>
                <Trash2 className="h-4 w-4 mr-2" />
                Portfolio löschen
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Settings Modal */}
      <PortfolioSettingsModal
        open={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        portfolioId={portfolioId}
        initialName={portfolio.name}
        initialDescription={portfolio.description || undefined}
        initialInvestmentAmount={portfolio.investmentAmount}
        initialInceptionDate={(portfolio as any).inceptionDate ?? null}
        portfolioType={portfolio.portfolioType as 'demo' | 'live'}
        onSuccess={() => refetch()}
      />
      
      {/* Edit Modal */}
      <PortfolioEditModal
        open={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        portfolioId={portfolioId}
        portfolioName={portfolio.name}
        initialStocks={stocksForEdit}
        isLive={portfolio.isLive === 1}
        onSuccess={handleEditSuccess}
      />
      
      <EditPositionModal
        open={isEditPositionModalOpen}
        onClose={() => setIsEditPositionModalOpen(false)}
        portfolioId={portfolioId}
        position={editingPosition}
        transactions={transactions}
        onSuccess={() => {
          refetch();
          setIsEditPositionModalOpen(false);
        }}
      />

      <EditPositionFieldsModal
        open={isEditFieldsOpen}
        onClose={() => setIsEditFieldsOpen(false)}
        portfolioId={portfolioId}
        rawPortfolioData={(allPortfolios as any[] | undefined)?.find((p) => p.id === portfolioId)?.portfolioData}
        holding={editFieldsHolding}
        onSuccess={() => refetch()}
      />

      {/* U-03: Transaktion erfassen (nur Live-Portfolios) */}
      {!isDemo && (
        <TransactionModal
          open={isTransactionModalOpen}
          onClose={() => setIsTransactionModalOpen(false)}
          portfolioId={portfolioId}
          portfolioStocks={holdings.map((h: any) => ({
            ticker: h.ticker,
            companyName: h.companyName || h.ticker,
            shares: parseFloat(h.shares || '0'),
          }))}
          onSuccess={handleTransactionsChanged}
        />
      )}

      {/* U-03: Swissquote-PDF-Import (nur Live-Portfolios) */}
      {!isDemo && (
        <Dialog open={isPdfImportOpen} onOpenChange={setIsPdfImportOpen}>
          <DialogContent
            className="max-w-2xl p-0 bg-transparent border-none shadow-none max-h-[90vh] overflow-y-auto"
            aria-describedby={undefined}
          >
            <DialogHeader className="sr-only">
              <DialogTitle>Swissquote-PDF importieren</DialogTitle>
            </DialogHeader>
            <SwissquotePDFImport
              portfolioId={portfolioId}
              portfolioName={portfolio.name}
              onImportComplete={handleTransactionsChanged}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Activation Modal (Demo -> Live) */}
      <Dialog open={isActivationModalOpen} onOpenChange={setIsActivationModalOpen}>
        <DialogContent className="bg-[#1a1f2e] border-[#00CFC1]/30 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Portfolio aktivieren</DialogTitle>
            <DialogDescription className="text-gray-400">
              Geben Sie Ihr Startkapital ein, um das Portfolio zu aktivieren. Es werden automatisch
              Kauf-Transaktionen basierend auf den Gewichtungen erstellt.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="startCapital" className="text-gray-300">Startkapital (CHF)</Label>
              <Input
                id="startCapital"
                type="number"
                placeholder="z.B. 10000"
                value={startCapital}
                onChange={(e) => setStartCapital(e.target.value)}
                className="bg-[#0f1420] border-white/10 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="benchmark" className="text-gray-300">Benchmark (optional)</Label>
              <Select value={selectedActivationBenchmark} onValueChange={(v: any) => setSelectedActivationBenchmark(v)}>
                <SelectTrigger className="bg-[#0f1420] border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1f2e] border-white/10">
                  <SelectItem value="SMI" className="text-white hover:bg-white/10">SPI (Swiss Performance Index)</SelectItem>
                  <SelectItem value="SP500" className="text-white hover:bg-white/10">S&P 500</SelectItem>
                  <SelectItem value="MSCI_WORLD" className="text-white hover:bg-white/10">MSCI World</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsActivationModalOpen(false)} className="border-white/10 text-gray-300 hover:bg-white/10">
              Abbrechen
            </Button>
            <Button 
              onClick={handleActivatePortfolio} 
              disabled={activatePortfolio.isPending}
              className="bg-[#00CFC1] hover:bg-[#00CFC1]/80 text-black"
            >
              {activatePortfolio.isPending ? "Aktiviere..." : "Aktivieren"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Share Dialog */}
      <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
        <DialogContent className="bg-[#1a1f2e] border-[#00CFC1]/30 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Portfolio teilen</DialogTitle>
            <DialogDescription className="text-gray-400">
              Teilen Sie Ihr Portfolio mit anderen.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-gray-300">Portfolio-Link</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={`${window.location.origin}/portfolios/${portfolioId}`}
                  className="bg-[#0f1420] border-white/10 text-white text-sm"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="border-[#00CFC1]/30 text-[#00CFC1] hover:bg-[#00CFC1]/10 whitespace-nowrap"
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/portfolios/${portfolioId}`);
                    toast.success('Link kopiert!');
                    setIsShareDialogOpen(false);
                  }}
                >
                  Kopieren
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">Portfolio-Zusammenfassung</Label>
              <div className="bg-[#0f1420] border border-white/10 rounded-lg p-3 text-sm text-gray-300">
                <p className="font-medium text-white">{portfolio.name}</p>
                <p>{holdings.length} Positionen</p>
                {portfolio.portfolioType && <p>Typ: {portfolioTypeConfig[portfolio.portfolioType]?.label || portfolio.portfolioType}</p>}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 border-white/10 text-gray-300 hover:bg-white/10"
                onClick={() => {
                  const text = `Schau dir mein Portfolio "${portfolio.name}" an: ${window.location.origin}/portfolios/${portfolioId}`;
                  if (navigator.share) {
                    navigator.share({ title: portfolio.name, text, url: `${window.location.origin}/portfolios/${portfolioId}` });
                  } else {
                    navigator.clipboard.writeText(text);
                    toast.success('Text kopiert!');
                  }
                  setIsShareDialogOpen(false);
                }}
              >
                {navigator.share ? 'Teilen...' : 'Als Text kopieren'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* U-19: Live-Tracking deaktivieren — Bestätigung mit Warnhinweis */}
      <ConfirmDialog
        open={isDeactivateDialogOpen}
        onOpenChange={setIsDeactivateDialogOpen}
        title="Live-Tracking deaktivieren?"
        description="Beim Deaktivieren werden die Transaktionen entfernt; die Positionen bleiben erhalten. Das Portfolio wird wieder als Demo-Portfolio geführt. Diese Aktion kann nicht rückgängig gemacht werden."
        confirmLabel="Deaktivieren"
        onConfirm={() => deactivateLive.mutate({ id: portfolioId, isLive: false })}
        isPending={deactivateLive.isPending}
      />

      {/* Bulk Delete Confirmation Dialog (U-08) */}
      <ConfirmDialog
        open={isBulkDeleteDialogOpen}
        onOpenChange={setIsBulkDeleteDialogOpen}
        title={`${selectedTxIds.size} Transaktion${selectedTxIds.size === 1 ? '' : 'en'} löschen?`}
        description={`Die ${selectedTxIds.size === 1 ? 'ausgewählte Transaktion wird' : `${selectedTxIds.size} ausgewählten Transaktionen werden`} unwiderruflich gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.`}
        confirmLabel={`${selectedTxIds.size} Transaktion${selectedTxIds.size === 1 ? '' : 'en'} löschen`}
        onConfirm={() => bulkDeleteMutation.mutate({ transactionIds: Array.from(selectedTxIds) })}
        isPending={bulkDeleteMutation.isPending}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="bg-[#1a1f2e] border-[#00CFC1]/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Portfolio löschen?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Möchten Sie das Portfolio "{portfolio.name}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
              Alle Transaktionen und Daten werden unwiderruflich gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-white/20 text-white hover:bg-white/10">
              Abbrechen
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Portfolio löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
