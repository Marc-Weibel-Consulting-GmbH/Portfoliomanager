import { useState, useEffect, useMemo, useRef } from "react";
import { useLocation } from "wouter";

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
  Save, X, PlusCircle, Trash2, Search, Mail, Bell,
  ShieldCheck, RefreshCw, Columns2
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

function ReviewStatusBadge({ status, reviewedAt }: { status: string | null; reviewedAt: Date | string | null }) {
  if (!status || status === 'pending') {
    return <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-xs">Pending Review</Badge>;
  }
  if (status === 'reviewed' || status === 'approved') {
    const dateStr = reviewedAt ? new Date(reviewedAt).toLocaleDateString('de-CH') : '';
    return (
      <Badge className="bg-teal-500/15 text-teal-400 border-teal-500/30 text-xs flex items-center gap-1">
        <ShieldCheck className="w-3 h-3" />
        Reviewed{dateStr ? ` ${dateStr}` : ''}
      </Badge>
    );
  }
  return null;
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


// ─── ApplyRecommendationButton ────────────────────────────────────────────────

function ApplyRecommendationButton({
  adj,
  rowId,
  allStocks,
  onApply,
}: {
  adj: any;
  rowId: number;
  allStocks: any[];
  onApply?: React.Dispatch<React.SetStateAction<EditablePosition[]>>;
}) {
  const handleApply = () => {
    if (!onApply) return;
    onApply((prev) => {
      let updated = prev.map(p => {
        if (p.ticker.toUpperCase() !== adj.ticker?.toUpperCase()) return p;
        if (adj.action === 'reduce') {
          const newWeight = Math.max(1, p.weightPct * 0.7);
          return { ...p, weightPct: Math.round(newWeight * 10) / 10 };
        }
        if (adj.action === 'increase') {
          const newWeight = p.weightPct * 1.3;
          return { ...p, weightPct: Math.round(newWeight * 10) / 10 };
        }
        if (adj.action === 'replace' && adj.replaceTicker) {
          const replacement = allStocks.find(
            (s: any) => s.ticker?.toUpperCase() === adj.replaceTicker?.toUpperCase()
          );
          if (replacement) {
            return {
              ...p,
              ticker: replacement.ticker,
              companyName: replacement.companyName ?? replacement.name ?? replacement.ticker,
              sector: replacement.sector ?? replacement.industry ?? p.sector,
              currency: replacement.currency ?? 'CHF',
              currentPrice: parseFloat(replacement.currentPrice ?? replacement.price ?? '0') || 0,
              exchangeRateToChf: parseFloat(replacement.exchangeRateToChf ?? '1') || 1,
            };
          }
        }
        return p;
      });
      // Normalize to 100%
      const total = updated.reduce((s, p) => s + p.weightPct, 0);
      if (total > 0 && Math.abs(total - 100) > 0.5) {
        updated = updated.map(p => ({ ...p, weightPct: Math.round((p.weightPct / total * 100) * 10) / 10 }));
      }
      return updated;
    });
    toast.success(`Empfehlung angewendet: ${adj.ticker} ${adj.action}`, { duration: 2000 });
  };

  const label = adj.action === 'reduce' ? '−30%' : adj.action === 'increase' ? '+30%' : adj.replaceTicker ? `→ ${adj.replaceTicker}` : 'Anwenden';

  return (
    <button
      onClick={handleApply}
      className="shrink-0 text-xs px-2 py-0.5 rounded border border-slate-600 text-slate-400 hover:border-teal-500 hover:text-teal-400 transition-colors"
      title={`Empfehlung direkt anwenden: ${adj.action} ${adj.ticker}`}
    >
      {label}
    </button>
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

// ─── Backfill Button ────────────────────────────────────────────────────────

function BackfillButton({ portfolioId, tickers }: { portfolioId: number; tickers: string[] }) {
  const backfillMutation = trpc.admin.triggerMaxBackfill.useMutation({
    onSuccess: (data) => {
      toast.success(`Backfill abgeschlossen`, {
        description: `${data.summary.successful}/${data.summary.total} Titel, ${data.summary.totalPricesInserted.toLocaleString('de-CH')} Preispunkte importiert.`,
        duration: 6000,
      });
    },
    onError: (e) => toast.error('Backfill fehlgeschlagen', { description: e.message }),
  });

  return (
    <Button
      size="sm"
      variant="outline"
      className="border-teal-600 text-teal-400 hover:bg-teal-900/20 text-xs"
      onClick={() => backfillMutation.mutate({ tickers, force: false })}
      disabled={backfillMutation.isPending || backfillMutation.isSuccess}
    >
      <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${backfillMutation.isPending ? 'animate-spin' : ''}`} />
      {backfillMutation.isPending ? 'Lade Kurse…' : backfillMutation.isSuccess ? 'Kurse geladen ✓' : 'Historische Kurse nachladen'}
    </Button>
  );
}

// ─── Approve panel (inline) ───────────────────────────────────────────────────

function ApprovePanel({
  row,
  allStocks,
  onDone,
  positions,
  setPositions,
}: {
  row: any;
  allStocks: any[];
  onDone: () => void;
  positions: EditablePosition[];
  setPositions: React.Dispatch<React.SetStateAction<EditablePosition[]>>;
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
  const [portfolioName, setPortfolioName] = useState(`KI-Portfolio #${row.id}`);
  const [investmentAmount, setInvestmentAmount] = useState(String(row.investmentAmount ?? 10000));
  const [portfolioType, setPortfolioType] = useState<"demo" | "live">("demo");
  const [notificationSent, setNotificationSent] = useState(false);
  const [emailStatus, setEmailStatus] = useState<'pending' | 'sent' | 'no-email' | 'failed'>('pending');
  const [createdPortfolioId, setCreatedPortfolioId] = useState<number | null>(null);

  const approveMutation = trpc.admin.approveProposalAndCreate.useMutation({
    onSuccess: (data) => {
      const emailMsg = data.userEmailSent
        ? "E-Mail wurde gesendet."
        : data.noEmailOnFile
          ? "Kein E-Mail-Konto hinterlegt."
          : "E-Mail-Versand fehlgeschlagen.";
      toast.success(`Portfolio erstellt (ID: ${data.portfolioId})`, {
        description: `${emailMsg} Historische Kurse werden automatisch nachgeladen (Backfill gestartet).`,
        duration: 6000,
      });
      setNotificationSent(true);
      setEmailStatus(data.userEmailSent ? 'sent' : data.noEmailOnFile ? 'no-email' : 'failed');
      setCreatedPortfolioId(data.portfolioId);
      // Don't auto-close — let admin trigger backfill manually if needed
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
      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          size="sm"
          className="bg-violet-600 hover:bg-violet-700 text-white text-xs"
          onClick={handleApprove}
          disabled={approveMutation.isPending || notificationSent}
        >
          <Save className="w-3.5 h-3.5 mr-1.5" />
          {approveMutation.isPending ? "Erstelle Portfolio…" : notificationSent ? "Erstellt ✓" : "Portfolio erstellen & genehmigen"}
        </Button>
        {notificationSent && createdPortfolioId && (
          <BackfillButton portfolioId={createdPortfolioId} tickers={positions.map(p => p.ticker)} />
        )}
        <Button size="sm" variant="outline" className="border-slate-600 text-slate-400 text-xs" onClick={onDone}>
          <X className="w-3.5 h-3.5 mr-1" /> Schliessen
        </Button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminProposalAnalysis() {
  const [, navigate] = useLocation();
  const [confidence, setConfidence] = useState<string>("all");
  const [meetsFilter, setMeetsFilter] = useState<string>("all");
  const [offset, setOffset] = useState(0);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [approveId, setApproveId] = useState<number | null>(null);
  // Lifted positions state so recommendation buttons can mutate approve-panel positions
  const [approvePositions, setApprovePositions] = useState<EditablePosition[]>([]);
  // Explicit accepted set: tracks which adj tickers have been accepted (green checkmark, no diff-based detection)
  const [acceptedSet, setAcceptedSet] = useState<Set<string>>(new Set());
  // Selected recommendation index for detail view in right panel (no layout shift)
  const [selectedAdjIdx, setSelectedAdjIdx] = useState<number | null>(null);
  // Admin comments per ticker (for the review workflow)
  const [adminComments, setAdminComments] = useState<Record<string, string>>({});
  // URL param: proposalId — auto-expand and open review panel
  const urlProposalId = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const v = params.get('proposalId');
    return v ? parseInt(v, 10) : null;
  }, []);
  // returnTo param — where to go after saving admin review
  const returnTo = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    return params.get('returnTo');
  }, []);
  // saveAdminReview mutation
  const saveAdminReviewMutation = trpc.admin.saveAdminReview.useMutation({
    onSuccess: (data) => {
      toast.success('Angepasster Vorschlag gespeichert — weiterleitung zum Portfolio Wizard…');
      // Always redirect to Portfolio Wizard with the reviewed proposal preloaded.
      // If a returnTo param is present (e.g. from the Wizard flow), use it; otherwise default to /portfolio-builder.
      const destination = returnTo ?? '/portfolio-builder';
      window.location.href = `${destination}?reviewedProposalId=${data.proposalId}`;
    },
    onError: (e) => toast.error('Fehler beim Speichern', { description: e.message }),
  });
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

  // Auto-expand and open review panel when proposalId is in URL
  const autoExpandDone = useRef(false);
  useEffect(() => {
    if (!urlProposalId || autoExpandDone.current || rows.length === 0) return;
    const row = rows.find(r => r.id === urlProposalId);
    if (row) {
      setExpandedId(urlProposalId);
      setApproveId(urlProposalId);
      // Pre-fill existing adminComments if this proposal was already reviewed
      const existing = row.adminComments as Record<string, string> | null;
      setAdminComments(existing && typeof existing === 'object' ? existing : {});
      autoExpandDone.current = true;
      // Scroll to the row after a short delay
      setTimeout(() => {
        document.getElementById(`proposal-row-${urlProposalId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    } else if (offset === 0) {
      // Proposal not on first page — search by fetching it directly
      autoExpandDone.current = true;
    }
  }, [rows, urlProposalId, offset]);

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
                  if (!open) {
                    setApproveId(null);
                    setAdminComments({});
                  } else {
                    // Pre-fill existing adminComments if this proposal was already reviewed
                    const existing = row.adminComments as Record<string, string> | null;
                    setAdminComments(existing && typeof existing === 'object' ? existing : {});
                  }
                }}
              >
                <Card id={`proposal-row-${row.id}`} className="bg-slate-800/50 border-slate-700">
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
                          <ReviewStatusBadge status={row.reviewStatus} reviewedAt={row.reviewedAt} />
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

                      {/* ═══════════════════════════════════════════════════════
                           2-SPALTEN REVIEW PANEL (v2)
                           Links: KI-Empfehlungen (kompakte Karten mit ✓/✗)
                           Rechts: Bearbeitbare Positionstabelle (fix, kein Layout-Shift)
                           isApplied: expliziter acceptedSet statt Diff-Erkennung
                      ════════════════════════════════════════════════════════ */}
                      {(() => {
                        const rawPos: EditablePosition[] = (Array.isArray(row.positions) ? row.positions : []).map((p: any) => ({
                          ticker: p.ticker ?? "",
                          companyName: p.companyName ?? p.ticker ?? "",
                          sector: p.sector,
                          currency: p.currency ?? "CHF",
                          currentPrice: parseFloat(p.currentPrice ?? p.currentPriceCHF ?? "0") || 0,
                          exchangeRateToChf: parseFloat(p.exchangeRateToChf ?? "1") || 1,
                          weightPct: parseFloat(p.weightPct ?? p.weight ?? "0") || 0,
                          originalWeightPct: parseFloat(p.weightPct ?? p.weight ?? "0") || 0,
                        }));

                        const effectivePositions: EditablePosition[] = approvePositions.length > 0 ? approvePositions : rawPos;
                        const adjustments: any[] = Array.isArray(row.finalAdjustments) ? row.finalAdjustments : [];
                        const actionableAdjs = adjustments.filter(a => a.action !== 'keep');

                        // Helper: apply one adj to a positions array
                        const applyAdjToPositions = (positions: EditablePosition[], adj: any): EditablePosition[] =>
                          positions.map(p => {
                            if (p.ticker.toUpperCase() !== adj.ticker?.toUpperCase()) return p;
                            if (adj.action === 'reduce') return { ...p, weightPct: Math.round(Math.max(1, p.weightPct * 0.7) * 10) / 10 };
                            if (adj.action === 'increase') return { ...p, weightPct: Math.round(p.weightPct * 1.3 * 10) / 10 };
                            if (adj.action === 'replace' && adj.replaceTicker) {
                              const repl = allStocks.find((s: any) => s.ticker?.toUpperCase() === adj.replaceTicker?.toUpperCase());
                              if (repl) return { ...p, ticker: repl.ticker, companyName: repl.companyName ?? repl.name ?? repl.ticker, sector: repl.sector ?? p.sector, currency: repl.currency ?? 'CHF', currentPrice: parseFloat(repl.currentPrice ?? '0') || 0, exchangeRateToChf: parseFloat(repl.exchangeRateToChf ?? '1') || 1 };
                            }
                            return p;
                          });

                        const normalizeWeights = (positions: EditablePosition[]): EditablePosition[] => {
                          const total = positions.reduce((s, p) => s + p.weightPct, 0);
                          if (total > 0 && Math.abs(total - 100) > 0.5) {
                            return positions.map(p => ({ ...p, weightPct: Math.round(p.weightPct / total * 100 * 10) / 10 }));
                          }
                          return positions;
                        };

                        const applyAllAdjustments = () => {
                          let updated = [...rawPos];
                          for (const adj of actionableAdjs) updated = applyAdjToPositions(updated, adj);
                          setApprovePositions(normalizeWeights(updated));
                          setAcceptedSet(new Set(actionableAdjs.map((a: any) => (a.ticker ?? '').toUpperCase())));
                          toast.success(`${actionableAdjs.length} Empfehlungen angewendet`);
                        };

                        const applySingleAdj = (adj: any) => {
                          setApprovePositions(prev => normalizeWeights(applyAdjToPositions(prev.length > 0 ? prev : rawPos, adj)));
                          setAcceptedSet(prev => new Set([...prev, (adj.ticker ?? '').toUpperCase()]));
                          toast.success(`Empfehlung übernommen: ${adj.ticker}`, { duration: 1500 });
                        };

                        const rejectAdj = (adj: any) => {
                          const orig = rawPos.find(p => p.ticker.toUpperCase() === adj.ticker?.toUpperCase());
                          if (!orig) return;
                          const replTickerUpper = adj.replaceTicker?.toUpperCase();
                          setApprovePositions(prev => {
                            const base = prev.length > 0 ? prev : rawPos;
                            return base.map(p => {
                              const matchesOrig = p.ticker.toUpperCase() === adj.ticker?.toUpperCase();
                              const matchesRepl = replTickerUpper && p.ticker.toUpperCase() === replTickerUpper;
                              if (matchesOrig || matchesRepl) return { ...p, ticker: orig.ticker, companyName: orig.companyName, sector: orig.sector, currency: orig.currency, currentPrice: orig.currentPrice, exchangeRateToChf: orig.exchangeRateToChf, weightPct: orig.weightPct, originalWeightPct: orig.originalWeightPct };
                              return p;
                            });
                          });
                          setAcceptedSet(prev => { const s = new Set(prev); s.delete((adj.ticker ?? '').toUpperCase()); return s; });
                          toast.info(`Abgelehnt: ${adj.ticker} zurückgesetzt`, { duration: 1500 });
                        };

                        const resetAll = () => {
                          setApprovePositions([]);
                          setAcceptedSet(new Set());
                          setSelectedAdjIdx(null);
                          toast.info('Alle Anpassungen zurückgesetzt');
                        };

                        return (
                          <div className="space-y-3">
                            {/* Header bar */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <Columns2 className="w-4 h-4 text-teal-400" />
                              <span className="text-sm font-semibold text-white">Vorschlag überprüfen &amp; anpassen</span>
                              {approvePositions.length > 0 && <span className="text-xs text-amber-400 ml-1">(bearbeitet)</span>}
                              {actionableAdjs.length > 0 && (
                                <button
                                  className="ml-auto text-xs px-3 py-1.5 rounded-md bg-teal-600 hover:bg-teal-700 text-white font-medium transition-colors flex items-center gap-1.5"
                                  onClick={applyAllAdjustments}
                                >
                                  <CheckCircle className="w-3.5 h-3.5" />
                                  Alle {actionableAdjs.length} Empfehlungen übernehmen
                                </button>
                              )}
                              {approvePositions.length > 0 && (
                                <button className="text-xs px-2.5 py-1.5 rounded-md border border-slate-600 text-slate-400 hover:text-white transition-colors" onClick={resetAll}>
                                  Zurücksetzen
                                </button>
                              )}
                            </div>

                            {/* 2-column layout: LEFT=Empfehlungen, RIGHT=Positionen (no layout shift) */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">

                              {/* LEFT: KI-Empfehlungen (kompakte Karten, Klick zeigt Details rechts) */}
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 px-1">
                                  <div className="w-2 h-2 rounded-full bg-teal-400"></div>
                                  <span className="text-xs font-semibold text-teal-300">KI-Empfehlungen (Synthesizer)</span>
                                  <span className="text-xs text-slate-500 ml-auto">{actionableAdjs.length} Aktionen</span>
                                </div>

                                {actionableAdjs.length === 0 && (
                                  <p className="text-xs text-slate-500 px-3 py-2">Keine Empfehlungen vorhanden.</p>
                                )}

                                {actionableAdjs.map((adj: any, i: number) => {
                                  const meta = actionMeta(adj.action);
                                  const isAccepted = acceptedSet.has((adj.ticker ?? '').toUpperCase());
                                  const isSelected = selectedAdjIdx === i;
                                  return (
                                    <div key={i}>
                                      {/* Compact card row — click to toggle detail */}
                                      <div
                                        className={`flex items-center gap-2 rounded-md px-3 py-2 border cursor-pointer transition-colors ${
                                          isAccepted
                                            ? 'bg-teal-900/20 border-teal-500/40'
                                            : isSelected
                                              ? 'bg-slate-800/80 border-slate-500/60'
                                              : 'bg-slate-900/60 border-slate-700/50 hover:border-slate-600'
                                        }`}
                                        onClick={() => setSelectedAdjIdx(isSelected ? null : i)}
                                      >
                                        <Badge className={`${meta.cls} text-xs shrink-0 flex items-center gap-1`}>
                                          {meta.icon} {meta.label}
                                        </Badge>
                                        <span className="font-mono text-xs text-teal-400 shrink-0">{adj.ticker}</span>
                                        {adj.replaceTicker && <span className="text-xs text-violet-400">→ {adj.replaceTicker}</span>}
                                        <span className="flex-1" />
                                        {isAccepted && <CheckCircle className="w-3.5 h-3.5 text-teal-400 shrink-0" />}
                                        {/* Accept / Reject buttons */}
                                        <button
                                          onClick={e => { e.stopPropagation(); applySingleAdj(adj); }}
                                          className={`text-xs px-1.5 py-1 rounded border transition-colors ${
                                            isAccepted
                                              ? 'bg-teal-600/30 border-teal-500/50 text-teal-300'
                                              : 'border-slate-600 text-slate-400 hover:border-teal-500 hover:text-teal-400'
                                          }`}
                                          title="Empfehlung übernehmen"
                                        >
                                          <CheckCircle className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          onClick={e => { e.stopPropagation(); rejectAdj(adj); }}
                                          className={`text-xs px-1.5 py-1 rounded border transition-colors ${
                                            !isAccepted && approvePositions.length > 0
                                              ? 'bg-red-600/20 border-red-500/40 text-red-400'
                                              : 'border-slate-600 text-slate-400 hover:border-red-500 hover:text-red-400'
                                          }`}
                                          title="Empfehlung ablehnen"
                                        >
                                          <XCircle className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                      {/* Detail panel — only shown when this card is selected, inline below */}
                                      {isSelected && (
                                        <div className="mt-1 rounded-md px-3 py-2 bg-slate-800/60 border border-slate-700/40 space-y-1.5">
                                          <p className="text-xs text-slate-300 leading-relaxed">{adj.reason}</p>
                                          <textarea
                                            rows={1}
                                            placeholder="Interne Notiz zu dieser Empfehlung (optional)…"
                                            value={adminComments[adj.ticker ?? ''] ?? ''}
                                            onChange={e => setAdminComments(prev => ({ ...prev, [adj.ticker ?? '']: e.target.value }))}
                                            className="w-full text-xs bg-slate-900/60 border border-slate-700/50 rounded px-2 py-1 text-slate-300 placeholder-slate-600 resize-none focus:outline-none focus:border-teal-500/50"
                                            style={{ minHeight: '28px' }}
                                            onClick={e => e.stopPropagation()}
                                          />
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>

                              {/* RIGHT: Bearbeitbare Positionen (immer fix, kein Shift durch Empfehlungs-Klicks) */}
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 px-1">
                                  <div className="w-2 h-2 rounded-full bg-slate-400"></div>
                                  <span className="text-xs font-semibold text-slate-300">Positionen bearbeiten</span>
                                  <span className="text-xs text-slate-500 ml-auto">{effectivePositions.length} Positionen</span>
                                </div>
                                <PositionEditor
                                  positions={effectivePositions}
                                  originalPositions={rawPos}
                                  allStocks={allStocks}
                                  onChange={setApprovePositions}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Global admin comment */}
                      <div className="pt-2">
                        <label className="text-xs text-slate-500 mb-1 block">Globale Admin-Notiz (wird im Wizard als Begründung angezeigt)</label>
                        <textarea
                          rows={2}
                          placeholder="Allgemeine Anmerkungen zum Vorschlag für den Kunden…"
                          value={adminComments['__global__'] ?? ''}
                          onChange={e => setAdminComments(prev => ({ ...prev, '__global__': e.target.value }))}
                          className="w-full text-xs bg-slate-800/60 border border-slate-700/50 rounded px-2 py-1.5 text-slate-300 placeholder-slate-600 resize-none focus:outline-none focus:border-teal-500/50"
                        />
                      </div>

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

                        {/* Save-and-return button — always visible, uses effective positions */}
                        {(() => {
                          const savePositions = approvePositions.length > 0
                            ? approvePositions
                            : (Array.isArray(row.positions) ? row.positions : []).map((p: any) => ({
                                ticker: p.ticker ?? "",
                                companyName: p.companyName ?? p.ticker ?? "",
                                sector: p.sector,
                                currency: p.currency ?? "CHF",
                                currentPrice: parseFloat(p.currentPrice ?? p.currentPriceCHF ?? "0") || 0,
                                exchangeRateToChf: parseFloat(p.exchangeRateToChf ?? "1") || 1,
                                weightPct: parseFloat(p.weightPct ?? p.weight ?? "0") || 0,
                                originalWeightPct: parseFloat(p.weightPct ?? p.weight ?? "0") || 0,
                              }));
                          return (
                            <Button
                              size="sm"
                              className="ml-auto bg-teal-600 hover:bg-teal-700 text-white text-xs"
                              onClick={() => saveAdminReviewMutation.mutate({
                                proposalId: row.id,
                                reviewedPositions: savePositions,
                                adminComments,
                              })}
                              disabled={saveAdminReviewMutation.isPending || savePositions.length === 0}
                            >
                              <Save className="w-3.5 h-3.5 mr-1.5" />
                              {saveAdminReviewMutation.isPending
                                ? 'Speichert…'
                                : returnTo
                                  ? 'Vorschlag speichern & zurück zum Wizard'
                                  : 'Vorschlag speichern & zum Portfolio Wizard'
                              }
                            </Button>
                          );
                        })()}
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
