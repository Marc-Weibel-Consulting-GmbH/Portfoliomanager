import { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlusCircle, Trash2, Search, X } from "lucide-react";

// Editierbare Vorschlags-Position. Spiegelt die gleichnamige Struktur im
// Admin-Protokoll (AdminProposalAnalysis.tsx). TODO: perspektivisch konsolidieren,
// sobald der parallele Multi-Asset-Umbau (KIMI) an der Admin-Datei durch ist.
export type EditablePosition = {
  ticker: string;
  companyName: string;
  sector?: string;
  currency?: string;
  currentPrice?: number;
  exchangeRateToChf?: number;
  weightPct: number;
  originalWeightPct?: number; // Original-KI-Gewicht für den Vergleich
  aiReason?: string;
  assetType?: string; // 'stock' | 'etf' | 'bond'
  assetClass?: string; // 'equity' | 'bond' | 'commodity' | 'gold' | 'realestate' | 'crypto'
  combinedScore?: number | null;
  signal?: string;
};

/** Multi-Asset-Sleeve-Position? (fixer Baustein — keine KI-Aktien-Anpassungen) */
const isSleevePosition = (p: { assetClass?: string }) => !!(p.assetClass && p.assetClass !== "equity");

/** Deutsche Anzeigenamen der Multi-Asset-Anlageklassen. */
const SLEEVE_CLASS_LABELS: Record<string, string> = {
  equity: "Aktien", bond: "Obligationen", commodity: "Rohstoffe",
  gold: "Gold", realestate: "Immobilien", crypto: "Krypto",
};

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

  useEffect(() => { inputRef.current?.focus(); }, []);

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

/**
 * Editor für die Positionen eines KI-Vorschlags VOR der Übernahme:
 * Gewicht erhöhen/reduzieren, Titel austauschen (Ticker anklicken), löschen,
 * neue Titel hinzufügen. Original-Gewicht bleibt zum Vergleich sichtbar.
 */
export function ProposalPositionEditor({
  positions,
  allStocks,
  onChange,
}: {
  positions: EditablePosition[];
  allStocks: any[];
  onChange: (updated: EditablePosition[]) => void;
}) {
  const totalWeight = positions.reduce((s, p) => s + (p.weightPct || 0), 0);
  const [searchOpenIdx, setSearchOpenIdx] = useState<number | null>(null);
  const [addSearchOpen, setAddSearchOpen] = useState(false);

  const update = (idx: number, field: keyof EditablePosition, value: any) => {
    onChange(positions.map((p, i) => i === idx ? { ...p, [field]: value } : p));
  };

  const remove = (idx: number) => onChange(positions.filter((_, i) => i !== idx));

  const replaceWithStock = (idx: number, stock: any) => {
    onChange(positions.map((p, i) => i === idx ? {
      ...p,
      ticker: stock.ticker,
      companyName: stock.companyName ?? stock.name ?? stock.ticker,
      sector: stock.sector ?? stock.industry ?? p.sector,
      currency: stock.currency ?? "CHF",
      currentPrice: parseFloat(stock.currentPrice ?? stock.price ?? "0") || 0,
      exchangeRateToChf: parseFloat(stock.exchangeRateToChf ?? "1") || 1,
      originalWeightPct: undefined, // kein Original-Vergleich für getauschte Titel
      aiReason: undefined,
    } : p));
  };

  const addFromStock = (stock: any) => {
    onChange([...positions, {
      ticker: stock.ticker,
      companyName: stock.companyName ?? stock.name ?? stock.ticker,
      sector: stock.sector ?? stock.industry ?? "Andere",
      currency: stock.currency ?? "CHF",
      currentPrice: parseFloat(stock.currentPrice ?? stock.price ?? "0") || 0,
      exchangeRateToChf: parseFloat(stock.exchangeRateToChf ?? "1") || 1,
      weightPct: 5,
      assetType: stock.category === "ETF" ? "etf" : "stock",
    }]);
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-slate-400">Positionen bearbeiten</span>
        <span className={`text-xs font-mono ${Math.abs(totalWeight - 100) < 0.5 ? "text-emerald-400" : "text-amber-400"}`}>
          Summe: {totalWeight.toFixed(1)}% {Math.abs(totalWeight - 100) < 0.5 ? "✓" : "(wird auf 100% normiert)"}
        </span>
      </div>

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
              <div className="relative w-20 shrink-0">
                <button
                  onClick={() => setSearchOpenIdx(searchOpenIdx === idx ? null : idx)}
                  className="font-mono text-xs text-teal-400 hover:text-teal-300 hover:underline text-left w-full truncate"
                  title="Klicken um Titel auszutauschen"
                >
                  {p.ticker}
                </button>
              </div>

              <span className="text-xs text-slate-300 flex-1 truncate">{p.companyName}</span>

              {isSleevePosition(p) && (
                <span
                  className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium bg-violet-500/20 text-violet-300 border border-violet-500/30"
                  title="Multi-Asset-Baustein"
                >
                  {SLEEVE_CLASS_LABELS[p.assetClass!] ?? p.assetClass}
                </span>
              )}

              <div className="w-20 shrink-0 text-right">
                {origWeight !== undefined ? (
                  <span className="text-xs text-slate-500 font-mono">{origWeight.toFixed(1)}%</span>
                ) : (
                  <span className="text-xs text-slate-700">—</span>
                )}
              </div>

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

              <button
                onClick={() => remove(idx)}
                className="text-slate-600 hover:text-red-400 transition-colors"
                title="Position entfernen"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

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
