import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const CURRENCIES = ["CHF", "EUR", "USD", "GBP", "JPY"];

interface EditPositionFieldsModalProps {
  open: boolean;
  onClose: () => void;
  portfolioId: number;
  /** Rohes portfolioData der DB (nicht angereichert), damit nur das Zielpapier gepatcht wird. */
  rawPortfolioData: string | null | undefined;
  holding: {
    ticker: string;
    companyName?: string;
    shares?: number | string;
    avgBuyPrice?: number | string;
    isin?: string;
    currency?: string;
  } | null;
  onSuccess?: () => void;
}

/**
 * Bearbeitet die persistenten Felder einer Position direkt im portfolioData:
 * Ticker, ISIN (wichtig für nicht mehr gültige Ticker), Stückzahl, Ø-Einstandspreis, Währung.
 * Die Anreicherung (getWithCurrency) respektiert explizite shares/avgBuyPrice/isin.
 */
export function EditPositionFieldsModal({
  open,
  onClose,
  portfolioId,
  rawPortfolioData,
  holding,
  onSuccess,
}: EditPositionFieldsModalProps) {
  const utils = trpc.useUtils();
  const originalTicker = holding?.ticker ?? "";

  const [form, setForm] = useState({ ticker: "", isin: "", shares: "", avgBuyPrice: "", currency: "CHF" });

  useEffect(() => {
    if (holding) {
      setForm({
        ticker: holding.ticker ?? "",
        isin: holding.isin ?? "",
        shares: holding.shares != null ? String(holding.shares) : "",
        avgBuyPrice: holding.avgBuyPrice != null ? String(holding.avgBuyPrice) : "",
        currency: holding.currency || "CHF",
      });
    }
  }, [holding]);

  const update = trpc.portfolios.update.useMutation({
    onSuccess: () => {
      toast.success("Position aktualisiert");
      utils.portfolios.getWithCurrency.invalidate(portfolioId);
      utils.portfolios.list.invalidate();
      onSuccess?.();
      onClose();
    },
    onError: (e) => toast.error(`Fehler: ${e.message}`),
  });

  const handleSave = () => {
    const ticker = form.ticker.trim().toUpperCase();
    if (!ticker) {
      toast.error("Ticker darf nicht leer sein");
      return;
    }
    let parsed: any;
    try {
      parsed = JSON.parse(rawPortfolioData || "{}");
    } catch {
      toast.error("Portfolio-Daten konnten nicht gelesen werden");
      return;
    }
    const isArray = Array.isArray(parsed);
    const stocks: any[] = isArray ? parsed : parsed.stocks || [];
    const idx = stocks.findIndex((s) => s.ticker === originalTicker);
    if (idx === -1) {
      toast.error("Position nicht in den Portfolio-Daten gefunden");
      return;
    }
    stocks[idx] = {
      ...stocks[idx],
      ticker,
      isin: form.isin.trim() || undefined,
      shares: form.shares.trim() !== "" ? form.shares.trim() : stocks[idx].shares,
      avgBuyPrice: form.avgBuyPrice.trim() !== "" ? form.avgBuyPrice.trim() : stocks[idx].avgBuyPrice,
      currency: form.currency,
    };
    const newData = isArray ? stocks : { ...parsed, stocks };
    update.mutate({ id: portfolioId, portfolioData: JSON.stringify(newData) });
  };

  if (!holding) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Position bearbeiten
            <span className="text-muted-foreground ml-2 text-sm font-normal">{holding.companyName || originalTicker}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Ticker *</Label>
              <Input
                value={form.ticker}
                onChange={(e) => setForm({ ...form, ticker: e.target.value })}
                className="bg-slate-600 border-slate-500 text-white mt-1 font-mono"
              />
            </div>
            <div>
              <Label className="text-xs">ISIN</Label>
              <Input
                value={form.isin}
                onChange={(e) => setForm({ ...form, isin: e.target.value })}
                placeholder="z.B. CH0012032048"
                className="bg-slate-600 border-slate-500 text-white mt-1 font-mono"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="text-xs">Stück</Label>
              <Input
                type="number"
                step="0.0001"
                value={form.shares}
                onChange={(e) => setForm({ ...form, shares: e.target.value })}
                className="bg-slate-600 border-slate-500 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Ø-Einstandspreis</Label>
              <Input
                type="number"
                step="0.01"
                value={form.avgBuyPrice}
                onChange={(e) => setForm({ ...form, avgBuyPrice: e.target.value })}
                className="bg-slate-600 border-slate-500 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Währung</Label>
              <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                <SelectTrigger className="bg-slate-600 border-slate-500 text-white mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-white">
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            ISIN korrigieren ist v.a. für nicht mehr gültige Ticker hilfreich. Kurse/Kennzahlen werden nach dem Speichern neu geladen.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-slate-600 text-white hover:bg-slate-700">
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={update.isPending} className="bg-cyan-600 hover:bg-cyan-700">
            {update.isPending ? "Speichern…" : "Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
