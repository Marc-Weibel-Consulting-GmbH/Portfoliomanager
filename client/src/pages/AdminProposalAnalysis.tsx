import { useState, useMemo, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  ChevronDown, ChevronRight, Brain, TrendingUp, AlertTriangle,
  CheckCircle, XCircle, ArrowDown, ArrowUp, ArrowLeftRight, Check,
  Save, X, PlusCircle, Trash2, Search, Mail, Bell
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";

// ─── Badges ──────────────────────────────────────────────────────────────────

function ConfidenceBadge({ value }: { value: string | null }) {
  if (!value) return <Badge variant="outline">—</Badge>;
  const map: Record<string, string> = {
    hoch: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    mittel: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    niedrig: "bg-red-500/20 text-red-400 border-red-500/30",
  };
  return <Badge className={map[value] ?? ""}>{value}</Badge>;
}

function KennzahlenBadge({ value }: { value: string | null }) {
  if (!value || value === "n/a") return <Badge variant="outline">n/a</Badge>;
  if (value === "ja") return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30"><CheckCircle className="w-3 h-3 mr-1" />Erfüllt</Badge>;
  return <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><XCircle className="w-3 h-3 mr-1" />Nicht erfüllt</Badge>;
}

function AcceptedBadge({ value }: { value: string | null }) {
  if (!value || value === "unbekannt") return <Badge variant="outline">Unbekannt</Badge>;
  if (value === "ja") return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Übernommen</Badge>;
  return <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">Abgelehnt</Badge>;
}

// ─── Action icon + colour helpers ────────────────────────────────────────────

function actionMeta(action: string) {
  switch (action) {
    case "reduce":   return { icon: <ArrowDown className="w-3.5 h-3.5" />, label: "Reduzieren",  cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" };
    case "increase": return { icon: <ArrowUp className="w-3.5 h-3.5" />,   label: "Aufstocken", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" };
    case "replace":  return { icon: <ArrowLeftRight className="w-3.5 h-3.5" />, label: "Austauschen", cls: "bg-violet-500/15 text-violet-400 border-violet-500/30" };
    default:         return { icon: <Check className="w-3.5 h-3.5" />,     label: "Behalten",   cls: "bg-slate-500/15 text-slate-400 border-slate-500/30" };
  }
}

// ─── Stock search dropdown ────────────────────────────────────────────────────

function StockSearchDropdown({
  allStocks,
  onSelect,
  onClose,
}: {
  allStocks: any[];
  onSelect: (stock: any) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return allStocks.slice(0, 12);
    const q = query.toLowerCase();
    return allStocks
      .filter(s =>
        s.ticker?.toLowerCase().includes(q) ||
        s.companyName?.toLowerCase().includes(q) ||
        s.name?.toLowerCase().includes(q)
      )
      .slice(0, 12);
  }, [query, allStocks]);

  return (
    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl overflow-hidden">
      <div className="p-2 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Ticker oder Name suchen…"
            className="bg-transparent text-white text-sm outline-none flex-1 placeholder:text-slate-500"
          />
          <button onClick={onClose} className="text-slate-500 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="max-h-48 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="px-3 py-2 text-xs text-slate-500">Keine Treffer</div>
        ) : filtered.map((s: any) => (
          <button
            key={s.ticker}
            onClick={() => { onSelect(s); onClose(); }}
            className="w-full text-left px-3 py-2 hover:bg-slate-700 transition-colors flex items-center gap-2"
          >
            <span className="font-mono text-xs text-teal-400 w-20 shrink-0">{s.ticker}</span>
            <span className="text-xs text-slate-300 truncate">{s.companyName ?? s.name}</span>
            <span className="text-xs text-slate-500 ml-auto shrink-0">{s.currency ?? s.exchange}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Editable position row ────────────────────────────────────────────────────

type EditablePosition = {
  ticker: string;
  companyName: string;
  sector?: string;
  currency: string;
  currentPrice: number;
  exchangeRateToChf: number;
  weightPct: number;
  originalWeightPct?: number; // Original KI-Gewicht für Vergleich
};

function PositionEditor({
  positions,
  originalPositions,
  allStocks,
  onChange,
}: {
  positions: EditablePosition[];
  originalPositions: EditablePosition[];
  allStocks: any[];
  onChange: (updated: EditablePosition[]) => void;
}) {
  const totalWeight = positions.reduce((s, p) => s + p.weightPct, 0);
  const [searchOpenIdx, setSearchOpenIdx] = useState<number | null>(null);

  const update = (idx: number, field: keyof EditablePosition, value: any) => {
    const next = positions.map((p, i) => i === idx ? { ...p, [field]: value } : p);
    onChange(next);
  };

  const remove = (idx: number) => onChange(positions.filter((_, i) => i !== idx));

  const replaceWithStock = (idx: number, stock: any) => {
    const next = positions.map((p, i) => i === idx ? {
      ...p,
      ticker: stock.ticker,
      companyName: stock.companyName ?? stock.name ?? stock.ticker,
      sector: stock.sector ?? stock.industry ?? p.sector,
      currency: stock.currency ?? 'CHF',
      currentPrice: parseFloat(stock.currentPrice ?? stock.price ?? '0') || 0,
      exchangeRateToChf: parseFloat(stock.exchangeRateToChf ?? '1') || 1,
      originalWeightPct: undefined, // Kein Original-Vergleich für neu hinzugefügte Titel
    } : p);
    onChange(next);
  };

  const addFromStock = (stock: any) => {
    onChange([...positions, {
      ticker: stock.ticker,
      companyName: stock.companyName ?? stock.name ?? stock.ticker,
      sector: stock.sector ?? stock.industry ?? 'Andere',
      currency: stock.currency ?? 'CHF',
      currentPrice: parseFloat(stock.currentPrice ?? stock.price ?? '0') || 0,
      exchangeRateToChf: parseFloat(stock.exchangeRateToChf ?? '1') || 1,
      weightPct: 5,
    }]);
  };

  const [addSearchOpen, setAddSearchOpen] = useState(false);

  return (
    <div className="space-y-1">
      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-slate-500">Positionen bearbeiten</span>
        <span className={`text-xs font-mono ${Math.abs(totalWeight - 100) < 0.5 ? "text-emerald-400" : "text-amber-400"}`}>
          Summe: {totalWeight.toFixed(1)}% {Math.abs(totalWeight - 100) < 0.5 ? "✓" : "(wird auf 100% normiert)"}
        </span>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_2fr_80px_80px_24px] gap-2 px-2 mb-1">
        <span className="text-xs text-slate-600">Ticker</span>
        <span className="text-xs text-slate-600">Name</span>
        <span className="text-xs text-slate-600 text-right">Original</span>
        <span className="text-xs text-slate-600 text-right">Neu</span>
        <span></span>
      </div>

      {positions.map((p, idx) => {
        const origWeight = p.originalWeightPct;
        const diff = origWeight !== undefined ? p.weightPct - origWeight : null;
        const diffColor = diff === null ? "" : diff > 0.5 ? "text-emerald-400" : diff < -0.5 ? "text-amber-400" : "text-slate-500";

        return (
          <div key={idx} className="relative">
            <div className="flex items-center gap-2 bg-slate-900/60 rounded px-2 py-1.5">
              {/* Ticker (clickable to open search) */}
              <div className="relative w-20 shrink-0">
                <button
                  onClick={() => setSearchOpenIdx(searchOpenIdx === idx ? null : idx)}
                  className="font-mono text-xs text-teal-400 hover:text-teal-300 hover:underline text-left w-full truncate"
                  title="Klicken um Titel auszutauschen"
                >
                  {p.ticker}
                </button>
              </div>

              {/* Name */}
              <span className="text-xs text-slate-300 flex-1 truncate">{p.companyName}</span>

              {/* Original weight (read-only) */}
              <div className="w-20 shrink-0 text-right">
                {origWeight !== undefined ? (
                  <span className="text-xs text-slate-500 font-mono">{origWeight.toFixed(1)}%</span>
                ) : (
                  <span className="text-xs text-slate-700">—</span>
                )}
              </div>

              {/* Editable weight */}
              <div className="flex items-center gap-0.5 shrink-0">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={p.weightPct}
                  onChange={(e) => update(idx, "weightPct", parseFloat(e.target.value) || 0)}
                  className="w-16 h-6 text-xs bg-slate-800 border-slate-600 text-white text-right px-1 py-0"
                />
                <span className="text-xs text-slate-500">%</span>
                {diff !== null && Math.abs(diff) > 0.5 && (
                  <span className={`text-xs font-mono ml-1 ${diffColor}`}>
                    {diff > 0 ? "+" : ""}{diff.toFixed(1)}
                  </span>
                )}
              </div>

              {/* Delete */}
              <button
                onClick={() => remove(idx)}
                className="text-slate-600 hover:text-red-400 transition-colors"
                title="Position entfernen"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Stock search dropdown for this row */}
            {searchOpenIdx === idx && (
              <StockSearchDropdown
                allStocks={allStocks}
                onSelect={(stock) => replaceWithStock(idx, stock)}
                onClose={() => setSearchOpenIdx(null)}
              />
            )}
          </div>
        );
      })}

      {/* Add position */}
      <div className="relative mt-2">
        <Button
          size="sm"
          variant="outline"
          className="border-dashed border-slate-600 text-slate-500 hover:text-white text-xs w-full"
          onClick={() => setAddSearchOpen(true)}
        >
          <PlusCircle className="w-3.5 h-3.5 mr-1.5" /> Titel hinzufügen
        </Button>
        {addSearchOpen && (
          <StockSearchDropdown
            allStocks={allStocks}
            onSelect={(stock) => { addFromStock(stock); setAddSearchOpen(false); }}
            onClose={() => setAddSearchOpen(false)}
          />
        )}
      </div>
    </div>
  );
}

// ─── Approve panel (inline) ───────────────────────────────────────────────────

function ApprovePanel({
  row,
  allStocks,
  onDone,
}: {
  row: any;
  allStocks: any[];
  onDone: () => void;
}) {
  const rawPositions: EditablePosition[] = (Array.isArray(row.positions) ? row.positions : []).map((p: any) => ({
    ticker: p.ticker ?? "",
    companyName: p.companyName ?? p.ticker ?? "",
    sector: p.sector,
    currency: p.currency ?? "CHF",
    currentPrice: parseFloat(p.currentPrice ?? p.currentPriceCHF ?? "0") || 0,
    exchangeRateToChf: parseFloat(p.exchangeRateToChf ?? "1") || 1,
    weightPct: parseFloat(p.weightPct ?? p.weight ?? "0") || 0,
    originalWeightPct: parseFloat(p.weightPct ?? p.weight ?? "0") || 0, // Snapshot des Original-Gewichts
  }));

  const [positions, setPositions] = useState<EditablePosition[]>(rawPositions);
  const [portfolioName, setPortfolioName] = useState(`KI-Portfolio #${row.id}`);
  const [investmentAmount, setInvestmentAmount] = useState(String(row.investmentAmount ?? 10000));
  const [portfolioType, setPortfolioType] = useState<"demo" | "live">("demo");
  const [notificationSent, setNotificationSent] = useState(false);
  const [emailStatus, setEmailStatus] = useState<'pending' | 'sent' | 'no-email' | 'failed'>('pending');

  const approveMutation = trpc.admin.approveProposalAndCreate.useMutation({
    onSuccess: (data) => {
      const emailMsg = data.userEmailSent
        ? "E-Mail wurde gesendet."
        : data.noEmailOnFile
          ? "Kein E-Mail-Konto hinterlegt."
          : "E-Mail-Versand fehlgeschlagen.";
      toast.success(`Portfolio erstellt (ID: ${data.portfolioId})`, {
        description: emailMsg,
      });
      setNotificationSent(true);
      setEmailStatus(data.userEmailSent ? 'sent' : data.noEmailOnFile ? 'no-email' : 'failed');
      setTimeout(onDone, 2500);
    },
    onError: (e) => toast.error("Fehler beim Erstellen", { description: e.message }),
  });

  const handleApprove = () => {
    const amount = parseFloat(investmentAmount);
    if (!(amount > 0)) { toast.error("Bitte gültigen Anlagebetrag eingeben"); return; }
    if (positions.length === 0) { toast.error("Mindestens eine Position erforderlich"); return; }
    approveMutation.mutate({
      proposalId: row.id,
      portfolioName,
      investmentAmount: amount,
      portfolioType,
      positions,
    });
  };

  // Summary: how many positions were changed vs original
  const changedCount = positions.filter(p => {
    if (p.originalWeightPct === undefined) return true; // new position
    return Math.abs(p.weightPct - p.originalWeightPct) > 0.5;
  }).length;
  const removedCount = rawPositions.filter(orig =>
    !positions.find(p => p.ticker === orig.ticker)
  ).length;
  const addedCount = positions.filter(p => p.originalWeightPct === undefined).length;

  return (
    <div className="border border-violet-500/30 rounded-lg p-4 bg-violet-900/10 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PlusCircle className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-medium text-violet-300">Portfolio aus diesem Vorschlag erstellen</span>
        </div>
        {(changedCount > 0 || removedCount > 0 || addedCount > 0) && (
          <div className="flex gap-2 text-xs">
            {changedCount > 0 && <span className="text-amber-400">{changedCount} geändert</span>}
            {addedCount > 0 && <span className="text-emerald-400">+{addedCount} neu</span>}
            {removedCount > 0 && <span className="text-red-400">−{removedCount} entfernt</span>}
          </div>
        )}
      </div>

      {/* Form fields */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Portfolio-Name</label>
          <Input
            value={portfolioName}
            onChange={(e) => setPortfolioName(e.target.value)}
            className="bg-slate-800 border-slate-600 text-white text-sm h-8"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Anlagebetrag (CHF)</label>
          <Input
            type="number"
            value={investmentAmount}
            onChange={(e) => setInvestmentAmount(e.target.value)}
            className="bg-slate-800 border-slate-600 text-white text-sm h-8"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Portfolio-Typ</label>
          <Select value={portfolioType} onValueChange={(v) => setPortfolioType(v as any)}>
            <SelectTrigger className="bg-slate-800 border-slate-600 text-white h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="demo">Demo (Simulation)</SelectItem>
              <SelectItem value="live">Live (echte Transaktionen)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Notification info */}
      <div className={`flex items-center gap-2 text-xs rounded px-3 py-2 ${
        emailStatus === 'sent' ? 'bg-emerald-900/20 text-emerald-400' :
        emailStatus === 'no-email' ? 'bg-amber-900/20 text-amber-400' :
        emailStatus === 'failed' ? 'bg-red-900/20 text-red-400' :
        'bg-slate-900/40 text-slate-500'
      }`}>
        {emailStatus === 'sent' && <><Mail className="w-3.5 h-3.5" /> E-Mail-Benachrichtigung erfolgreich gesendet</>}
        {emailStatus === 'no-email' && <><Bell className="w-3.5 h-3.5" /> Kein E-Mail-Konto beim Nutzer hinterlegt</>}
        {emailStatus === 'failed' && <><XCircle className="w-3.5 h-3.5" /> E-Mail-Versand fehlgeschlagen</>}
        {emailStatus === 'pending' && <><Bell className="w-3.5 h-3.5" /> Nach Erstellung wird der Nutzer automatisch per E-Mail benachrichtigt</>}
      </div>

      {/* Editable positions with comparison */}
      <PositionEditor
        positions={positions}
        originalPositions={rawPositions}
        allStocks={allStocks}
        onChange={setPositions}
      />

      {/* Action buttons */}
      <div className="flex gap-2 pt-1">
        <Button
          size="sm"
          className="bg-violet-600 hover:bg-violet-700 text-white text-xs"
          onClick={handleApprove}
          disabled={approveMutation.isPending || notificationSent}
        >
          <Save className="w-3.5 h-3.5 mr-1.5" />
          {approveMutation.isPending ? "Erstelle Portfolio…" : notificationSent ? "Erstellt ✓" : "Portfolio erstellen & genehmigen"}
        </Button>
        <Button size="sm" variant="outline" className="border-slate-600 text-slate-400 text-xs" onClick={onDone}>
          <X className="w-3.5 h-3.5 mr-1" /> Abbrechen
        </Button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminProposalAnalysis() {
  const [confidence, setConfidence] = useState<string>("all");
  const [meetsFilter, setMeetsFilter] = useState<string>("all");
  const [offset, setOffset] = useState(0);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [approveId, setApproveId] = useState<number | null>(null);
  const LIMIT = 20;

  const { data, isLoading, refetch } = trpc.admin.listProposalLogs.useQuery({
    limit: LIMIT,
    offset,
    confidence: confidence !== "all" ? (confidence as any) : undefined,
    meetsFilter: meetsFilter !== "all" ? (meetsFilter as any) : undefined,
  });

  // Load all stocks for the search dropdown (once)
  const { data: stocksData } = trpc.stocks.list.useQuery();
  const allStocks: any[] = useMemo(() => stocksData ?? [], [stocksData]);

  const updateAccepted = trpc.admin.updateProposalAccepted.useMutation({
    onSuccess: () => refetch(),
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Brain className="w-6 h-6 text-violet-400" />
            <div>
              <h1 className="text-xl font-semibold text-white">KI-Analyse Protokoll</h1>
              <p className="text-sm text-slate-400">
                Multi-Agent Portfolio-Vorschläge — Admin-Review &amp; Portfolio-Erstellung
              </p>
            </div>
          </div>
          <div className="text-sm text-slate-400">{total} Einträge gesamt</div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <Select value={confidence} onValueChange={(v) => { setConfidence(v); setOffset(0); }}>
            <SelectTrigger className="w-44 bg-slate-800 border-slate-700 text-white">
              <SelectValue placeholder="Vertrauen" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="all">Alle Vertrauensstufen</SelectItem>
              <SelectItem value="hoch">Hoch</SelectItem>
              <SelectItem value="mittel">Mittel</SelectItem>
              <SelectItem value="niedrig">Niedrig</SelectItem>
            </SelectContent>
          </Select>
          <Select value={meetsFilter} onValueChange={(v) => { setMeetsFilter(v); setOffset(0); }}>
            <SelectTrigger className="w-48 bg-slate-800 border-slate-700 text-white">
              <SelectValue placeholder="Kennzahlen-Filter" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="all">Alle Kennzahlen</SelectItem>
              <SelectItem value="ja">Erfüllt</SelectItem>
              <SelectItem value="nein">Nicht erfüllt</SelectItem>
              <SelectItem value="n/a">N/A</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="text-slate-400 text-sm">Lade Daten…</div>
        ) : rows.length === 0 ? (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="py-12 text-center text-slate-400">
              <Brain className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>Noch keine KI-Analyse-Protokolle vorhanden.</p>
              <p className="text-xs mt-1">Protokolle werden automatisch gespeichert, wenn ein Portfolio-Vorschlag generiert wird.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {rows.map((row: any) => (
              <Collapsible
                key={row.id}
                open={expandedId === row.id}
                onOpenChange={(open) => {
                  setExpandedId(open ? row.id : null);
                  if (!open) setApproveId(null);
                }}
              >
                <Card className="bg-slate-800/50 border-slate-700">
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-slate-700/30 transition-colors rounded-t-lg py-3 px-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          {expandedId === row.id
                            ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                            : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-white text-sm font-medium">#{row.id}</span>
                              <span className="text-slate-400 text-xs">{new Date(row.createdAt).toLocaleString("de-CH")}</span>
                              <Badge variant="outline" className="text-xs">{row.riskProfile}</Badge>
                              <Badge variant="outline" className="text-xs">{row.investmentGoal}</Badge>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                          <ConfidenceBadge value={row.overallConfidence} />
                          <KennzahlenBadge value={row.meetsKennzahlenFilter} />
                          <AcceptedBadge value={row.accepted} />
                          {row.positionCount && <span className="text-slate-400 text-xs">{row.positionCount} Titel</span>}
                          {row.sharpe && <span className="text-slate-400 text-xs">Sharpe {parseFloat(row.sharpe).toFixed(2)}</span>}
                          {row.fxWeightPct && <span className="text-slate-400 text-xs">FX {parseFloat(row.fxWeightPct).toFixed(1)}%</span>}
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <CardContent className="pt-0 pb-4 px-4 space-y-4">

                      {/* Metrics row */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                          { label: "Methode", value: row.method },
                          { label: "Erwartete Rendite", value: row.expectedReturnPct ? `${parseFloat(row.expectedReturnPct).toFixed(1)}%` : "—" },
                          { label: "Volatilität", value: row.volatilityPct ? `${parseFloat(row.volatilityPct).toFixed(1)}%` : "—" },
                          { label: "Sharpe", value: row.sharpe ? parseFloat(row.sharpe).toFixed(2) : "—" },
                          { label: "FX-Anteil", value: row.fxWeightPct ? `${parseFloat(row.fxWeightPct).toFixed(1)}%` : "—" },
                          { label: "FX-Limit", value: row.maxFxExposurePct ? `${row.maxFxExposurePct}%` : "—" },
                          { label: "Agenten-Dauer", value: row.agentDurationMs ? `${(row.agentDurationMs / 1000).toFixed(1)}s` : "—" },
                          { label: "Challenger-Ablehnungen", value: row.challengerRejectedCount ?? "—" },
                        ].map(({ label, value }) => (
                          <div key={label} className="bg-slate-900/50 rounded p-2">
                            <div className="text-xs text-slate-500">{label}</div>
                            <div className="text-sm text-white font-medium">{value}</div>
                          </div>
                        ))}
                      </div>

                      {/* Synthesizer Verdict */}
                      {row.synthesizerVerdict && (
                        <div className="bg-violet-900/20 border border-violet-500/20 rounded p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <Brain className="w-4 h-4 text-violet-400" />
                            <span className="text-xs font-medium text-violet-400">Synthesizer-Urteil</span>
                          </div>
                          <p className="text-sm text-slate-300">{row.synthesizerVerdict}</p>
                        </div>
                      )}

                      {/* Challenger Critique */}
                      {row.challengerCritique && (
                        <div className="bg-amber-900/20 border border-amber-500/20 rounded p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <AlertTriangle className="w-4 h-4 text-amber-400" />
                            <span className="text-xs font-medium text-amber-400">Challenger-Kritik</span>
                          </div>
                          <p className="text-sm text-slate-300">{row.challengerCritique}</p>
                        </div>
                      )}

                      {/* Kennzahlen Filter Reason */}
                      {row.kennzahlenFilterReason && (
                        <div className={`rounded p-3 border ${row.meetsKennzahlenFilter === "ja" ? "bg-emerald-900/20 border-emerald-500/20" : "bg-red-900/20 border-red-500/20"}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <TrendingUp className={`w-4 h-4 ${row.meetsKennzahlenFilter === "ja" ? "text-emerald-400" : "text-red-400"}`} />
                            <span className={`text-xs font-medium ${row.meetsKennzahlenFilter === "ja" ? "text-emerald-400" : "text-red-400"}`}>Kennzahlen-Filter</span>
                          </div>
                          <p className="text-sm text-slate-300">{row.kennzahlenFilterReason}</p>
                        </div>
                      )}

                      {/* ── KI-Empfehlungen (finalAdjustments) ── */}
                      {Array.isArray(row.finalAdjustments) && row.finalAdjustments.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <ArrowLeftRight className="w-4 h-4 text-teal-400" />
                            <span className="text-xs font-medium text-teal-400">KI-Empfehlungen (Synthesizer)</span>
                            <span className="text-xs text-slate-600">— Ticker anklicken um Titel auszutauschen</span>
                          </div>
                          <div className="space-y-1.5">
                            {(row.finalAdjustments as any[]).map((adj: any, i: number) => {
                              const meta = actionMeta(adj.action);
                              return (
                                <div key={i} className="flex items-start gap-2 bg-slate-900/50 rounded px-3 py-2">
                                  <Badge className={`${meta.cls} text-xs shrink-0 flex items-center gap-1 mt-0.5`}>
                                    {meta.icon}
                                    {meta.label}
                                  </Badge>
                                  <div className="min-w-0">
                                    <span className="font-mono text-xs text-teal-400 mr-2">{adj.ticker}</span>
                                    <span className="text-xs text-slate-300">{adj.reason}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Positions preview (when approve panel is closed) */}
                      {row.positions && Array.isArray(row.positions) && row.positions.length > 0 && approveId !== row.id && (
                        <div>
                          <div className="text-xs text-slate-500 mb-2">Positionen ({row.positions.length})</div>
                          <div className="flex flex-wrap gap-2">
                            {(row.positions as any[]).map((p: any) => {
                              const adj = Array.isArray(row.finalAdjustments)
                                ? (row.finalAdjustments as any[]).find((a: any) => a.ticker?.toUpperCase() === p.ticker?.toUpperCase())
                                : null;
                              const meta = adj ? actionMeta(adj.action) : null;
                              return (
                                <div
                                  key={p.ticker}
                                  className={`rounded px-2 py-1 text-xs flex items-center gap-1 ${meta ? "bg-slate-900/80 border border-slate-700" : "bg-slate-900/60"}`}
                                  title={adj ? `${actionMeta(adj.action).label}: ${adj.reason}` : undefined}
                                >
                                  {meta && <span className={meta.cls.split(" ").find(c => c.startsWith("text-")) ?? ""}>{meta.icon}</span>}
                                  <span className="text-teal-400 font-mono">{p.ticker}</span>
                                  <span className="text-slate-400">{p.weightPct?.toFixed(1)}%</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Approve panel */}
                      {approveId === row.id && (
                        <ApprovePanel
                          row={row}
                          allStocks={allStocks}
                          onDone={() => { setApproveId(null); refetch(); }}
                        />
                      )}

                      {/* Bottom action bar */}
                      <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-700">
                        <span className="text-xs text-slate-500 self-center mr-2">Feedback für Training:</span>
                        <Button
                          size="sm"
                          variant="outline"
                          className={`text-xs ${row.accepted === "ja" ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" : "border-slate-600 text-slate-400"}`}
                          onClick={() => updateAccepted.mutate({ id: row.id, accepted: "ja" })}
                          disabled={updateAccepted.isPending}
                        >
                          <CheckCircle className="w-3 h-3 mr-1" /> Übernommen
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className={`text-xs ${row.accepted === "nein" ? "bg-red-500/20 border-red-500/40 text-red-400" : "border-slate-600 text-slate-400"}`}
                          onClick={() => updateAccepted.mutate({ id: row.id, accepted: "nein" })}
                          disabled={updateAccepted.isPending}
                        >
                          <XCircle className="w-3 h-3 mr-1" /> Abgelehnt
                        </Button>

                        {approveId !== row.id && (
                          <Button
                            size="sm"
                            className="ml-auto bg-violet-600 hover:bg-violet-700 text-white text-xs"
                            onClick={() => setApproveId(row.id)}
                          >
                            <PlusCircle className="w-3.5 h-3.5 mr-1.5" />
                            Portfolio erstellen
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            ))}
          </div>
        )}

        {/* Pagination */}
        {total > LIMIT && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">{offset + 1}–{Math.min(offset + LIMIT, total)} von {total}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - LIMIT))} className="border-slate-600 text-slate-300">Zurück</Button>
              <Button size="sm" variant="outline" disabled={offset + LIMIT >= total} onClick={() => setOffset(offset + LIMIT)} className="border-slate-600 text-slate-300">Weiter</Button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
