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
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { PortfolioEditModal } from "@/components/PortfolioEditModal";
import { PortfolioSettingsModal } from "@/components/PortfolioSettingsModal";
import { EditPositionModal } from "@/components/EditPositionModal";
import { EditPositionFieldsModal } from "@/components/EditPositionFieldsModal";
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
    { portfolioId, daysAhead: 365 },
    { enabled: portfolioId > 0 }
  );

  const rows = useMemo(() => {
    const startOfToday = new Date(new Date().toDateString());
    return (dividends as any[])
      .filter((d) => d.exDividendDate && new Date(d.exDividendDate) >= startOfToday)
      .sort((a, b) => new Date(a.exDividendDate).getTime() - new Date(b.exDividendDate).getTime());
  }, [dividends]);

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
          <h3 className="text-sm font-semibold text-white">Nächste Dividende je Titel</h3>
          <p className="text-xs text-gray-400">Angekündigt oder aus der Historie geschätzt · Bestand dieses Portfolios</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Erwartet (nächste Runde)</p>
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
            {rows.map((d: any, i: number) => (
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
          </tbody>
          <tfoot>
            <tr className="border-t border-white/10">
              <td colSpan={5} className="px-5 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Summe (gesamt)</td>
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
                  <p className="text-xs text-gray-400 mt-1 truncate">
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
    risk: 'risiko', optimize: 'optimieren', ai: 'optimieren',
  };
  const searchParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const rawTab = searchParams.get('tab') || 'uebersicht';
  const urlTab = legacyTabMap[rawTab] || rawTab;
  const [activeTab, setActiveTab] = useState(urlTab);
  const [posView, setPosView] = useState<'tabelle' | 'heatmap' | 'konstellation'>('tabelle');

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
                {portfolio.createdAt && ` · seit ${new Date(portfolio.createdAt).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' })}`}
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
              <Button size="sm" onClick={() => handleTabChange('optimieren')} className="bg-[#00CFC1] hover:bg-[#00CFC1]/80 text-black">
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
              { value: 'transaktionen', label: 'Transaktionen', badge: transactions.length },
              { value: 'dividenden', label: 'Dividenden' },
              { value: 'performance', label: 'Performance' },
              { value: 'risiko', label: 'Risiko' },
              { value: 'optimieren', label: 'Optimieren', aiBadge: true },
              { value: 'empfehlungen', label: 'Empfehlungen', aiBadge: true },
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
          </TabsContent>

          {/* POSITIONS TAB — matches design: TICKER | NAME | SEKTOR | GEWICHT | WERT | HEUTE | YTD */}
          <TabsContent value="positionen" className="mt-6">
            <div className={posView === 'tabelle' ? "bg-[#0f1420] border border-white/10 rounded-lg" : ""}>
              <div className={`flex items-center justify-between ${posView === 'tabelle' ? 'px-5 py-4 border-b border-white/10' : 'mb-3'}`}>
                {posView === 'konstellation' ? <div /> : (
                  <div>
                    <h3 className="text-sm font-semibold text-white">{holdings.length} Positionen</h3>
                    {posView === 'tabelle' && <p className="text-xs text-gray-400">sortiert nach Gewicht</p>}
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
                      <th className="text-right px-3 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Gewicht</th>
                      <th className="text-right px-3 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Wert</th>
                      <th className="text-right px-3 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Heute</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider" title="YTD = seit Jahresbeginn">YTD</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {holdings
                      .slice()
                      .sort((a: any, b: any) => parseFloat(b.weight || '0') - parseFloat(a.weight || '0'))
                      .map((h: any) => {
                        const ytd = parseFloat(h.ytdPerformance || '0');
                        const today = parseFloat(h.dailyChangePercent || h.changePercent || '0');
                        const weight = parseFloat(h.weight || '0');
                        const value = (h.shares || 0) * (h.currentPriceCHF || 0);
                        return (
                          <tr
                            key={h.ticker}
                            role="link"
                            tabIndex={0}
                            aria-label={`${h.companyName || h.ticker} öffnen`}
                            className="border-b border-white/5 hover:bg-white/[0.03] cursor-pointer focus-visible:outline-none focus-visible:bg-white/[0.06]"
                            onClick={() => navigate(`/aktien/${h.ticker}?from=${portfolioId}`)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                navigate(`/aktien/${h.ticker}?from=${portfolioId}`);
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
                            <td className="px-5 py-3.5 text-right">
                              <span className={`text-sm font-mono ${ytd >= 0 ? 'text-[#00CFC1]' : 'text-negative'}`}>
                                {ytd >= 0 ? '+' : ''}{ytd.toFixed(1)}%
                              </span>
                            </td>
                            <td className="pr-4 text-right">
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
                            </td>
                          </tr>
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
                  onOptimize={() => handleTabChange('optimieren')}
                />
              )}
            </div>
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

          {/* OPTIMIZE TAB — KI-Re-Allocation + Effizienzgrenze (S.06) */}
          <TabsContent value="optimieren" className="mt-6">
            <OptimierenTab portfolioId={portfolioId} holdings={holdings} totalValueCHF={totalValueCHF} />
          </TabsContent>

          {/* EMPFEHLUNGEN TAB — wiederkehrende Transaktions-Empfehlungen (Track D) */}
          <TabsContent value="empfehlungen" className="mt-6">
            <EmpfehlungenTab portfolioId={portfolioId} />
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
