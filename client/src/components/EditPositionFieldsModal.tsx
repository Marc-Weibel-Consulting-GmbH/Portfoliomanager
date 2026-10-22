import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { trpc } from "@/lib/trpc";
import { isShareOnlyDemoPositionEdit } from "@/lib/manualDemoPositionEdit";
import { resolveInitialEntryDate } from "@/lib/positionEntryDate";
import { calculateSharesForPositionValueChf, getPositionSizeEditorBounds } from "@/lib/positionSizeEditor";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { GitCompareArrows, Trash2 } from "lucide-react";

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
    entryDate?: string | null;
    entryBasisStatus?: string | null;
    entryBasisLabel?: string | null;
    isin?: string;
    currency?: string;
    currentPriceChf?: number | string | null;
  } | null;
  allowAlternatives?: boolean;
  /** Nur für nicht aktivierte, ledgerfreie Demoportfolios freischalten. */
  allowDelete?: boolean;
  /** Erlaubt die wertbasierte Stückzahlvorschau nur im serverseitig unterstützten Demo-Cash-Pfad. */
  allowPositionSizeEdit?: boolean;
  /** Aktuelle Cash-Reserve; begrenzt den Regler auf die finanzierbare Aufstockung. */
  cashBalanceChf?: number;
  /** Portfolio-Startdatum ist nur ein reversibler Dialogstandard, nie eine Sofortmutation. */
  portfolioCreatedAt?: string | Date | null;
  onShowAlternatives?: (source: { ticker: string; companyName?: string }) => void;
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
  allowAlternatives = false,
  allowDelete = false,
  allowPositionSizeEdit = false,
  cashBalanceChf = 0,
  portfolioCreatedAt = null,
  onShowAlternatives,
  onSuccess,
}: EditPositionFieldsModalProps) {
  const utils = trpc.useUtils();
  const originalTicker = holding?.ticker ?? "";
  const initialEntryDate = resolveInitialEntryDate({
    storedEntryDate: holding?.entryDate,
    entryBasisStatus: holding?.entryBasisStatus,
    portfolioCreatedAt,
  });

  // Der Aufrufer montiert das Modal bei jedem Öffnen neu (wechselnder `key`),
  // daher genügt das Seeding über den useState-Initializer — kein Reset-Effect.
  const [form, setForm] = useState(() => ({
    ticker: holding?.ticker ?? "",
    isin: holding?.isin ?? "",
    shares: holding?.shares != null ? String(holding.shares) : "",
    avgBuyPrice: holding?.avgBuyPrice != null ? String(holding.avgBuyPrice) : "",
    entryDate: initialEntryDate,
    currency: holding?.currency || "CHF",
  }));
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [autoQuoteEnabled, setAutoQuoteEnabled] = useState(() =>
    !holding?.entryDate && holding?.entryBasisStatus !== "multiple_transaction_dates",
  );
  const [appliedQuoteKey, setAppliedQuoteKey] = useState<string | null>(null);
  const currentPriceChf = Number(holding?.currentPriceChf);
  const initialPositionValueChf = Number(holding?.shares) * currentPriceChf;
  const [positionValueInput, setPositionValueInput] = useState(() =>
    Number.isFinite(initialPositionValueChf) && initialPositionValueChf >= 0
      ? initialPositionValueChf.toFixed(2)
      : "",
  );

  const quoteTicker = form.ticker.trim().toUpperCase();
  const quoteKey = useMemo(
    () => `${quoteTicker}|${form.entryDate}`,
    [quoteTicker, form.entryDate],
  );
  const historicalQuote = trpc.portfolios.getHistoricalEntryPrice.useQuery(
    {
      portfolioId,
      sourceTicker: originalTicker,
      ticker: quoteTicker || originalTicker,
      entryDate: form.entryDate || "1900-01-01",
    },
    {
      enabled: open && autoQuoteEnabled && Boolean(quoteTicker && form.entryDate),
      staleTime: 60_000,
    },
  );

  useEffect(() => {
    const quote = historicalQuote.data;
    if (!autoQuoteEnabled || !quote || quote.requestedDate !== form.entryDate || appliedQuoteKey === quoteKey) return;

    if (quote.status === "available") {
      setForm((current) => current.entryDate === quote.requestedDate
        ? { ...current, avgBuyPrice: quote.priceChf.toFixed(4) }
        : current,
      );
    }
    setAppliedQuoteKey(quoteKey);
  }, [appliedQuoteKey, autoQuoteEnabled, form.entryDate, historicalQuote.data, quoteKey]);

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
  const updateDemoPositionShares = trpc.portfolios.updateDemoPositionShares.useMutation({
    onSuccess: (result) => {
      const formattedCash = result.cashBalanceChf.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      toast.success(isDeleting
        ? `Position gelöscht · Cash-Reserve: CHF ${formattedCash}`
        : `Position und Cash-Reserve aktualisiert (Cash: CHF ${formattedCash})`);
      utils.portfolios.getWithCurrency.invalidate(portfolioId);
      utils.portfolios.list.invalidate();
      setIsDeleteConfirmOpen(false);
      onSuccess?.();
      onClose();
    },
    onError: (e) => toast.error(`Fehler: ${e.message}`),
  });

  const handleSave = () => {
    setIsDeleting(false);
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
    const original = stocks[idx];
    const nextShares = form.shares.trim() !== "" ? Number(form.shares) : Number(original.shares);
    if (!Number.isFinite(nextShares) || nextShares < 0) {
      toast.error("Stückzahl muss mindestens 0 sein");
      return;
    }
    const isShareOnlyChange = isShareOnlyDemoPositionEdit({
      originalTicker,
      displayedHolding: holding,
      initialEntryDate,
      form,
    });
    const displayedShares = Number(holding.shares);
    if (isShareOnlyChange && Number.isFinite(displayedShares) && nextShares !== displayedShares) {
      updateDemoPositionShares.mutate({ portfolioId, ticker, shares: nextShares });
      return;
    }
    stocks[idx] = {
      ...stocks[idx],
      ticker,
      isin: form.isin.trim() || undefined,
      shares: form.shares.trim() !== "" ? form.shares.trim() : original.shares,
      avgBuyPrice: form.avgBuyPrice.trim() !== "" ? form.avgBuyPrice.trim() : original.avgBuyPrice,
      entryDate: form.entryDate || undefined,
      currency: form.currency,
    };
    const newData = isArray ? stocks : { ...parsed, stocks };
    update.mutate({ id: portfolioId, portfolioData: JSON.stringify(newData) });
  };

  const handleDelete = () => {
    setIsDeleting(true);
    updateDemoPositionShares.mutate({ portfolioId, ticker: originalTicker, shares: 0 });
  };

  const positionSizeBounds = allowPositionSizeEdit
    ? getPositionSizeEditorBounds({
      shares: Number(form.shares),
      currentPriceChf,
      cashBalanceChf,
    })
    : null;
  const currentPositionValueChf = positionSizeBounds?.currentValueChf ?? null;

  const setPositionValueChf = (nextValueChf: number, options?: { preserveInput?: boolean }) => {
    if (!positionSizeBounds) return;
    const boundedValueChf = Math.min(positionSizeBounds.maxValueChf, Math.max(0, nextValueChf));
    const shares = calculateSharesForPositionValueChf({
      targetValueChf: boundedValueChf,
      currentPriceChf,
    });
    if (shares === null) return;
    setForm((current) => ({ ...current, shares: String(shares) }));
    if (!options?.preserveInput) setPositionValueInput(boundedValueChf.toFixed(2));
  };

  const handlePositionValueInput = (raw: string) => {
    setPositionValueInput(raw);
    if (raw.trim() === "") return;
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= 0) {
      // Bis zur Obergrenze bleibt die Zahl während der Eingabe editierbar.
      // Darüber wird sie sofort auf den finanzierten Höchstwert begrenzt,
      // damit Feld, Regler und Stückvorschau nie auseinanderlaufen.
      setPositionValueChf(parsed, {
        preserveInput: !positionSizeBounds || parsed <= positionSizeBounds.maxValueChf,
      });
    }
  };

  const formatChf = (value: number) => new Intl.NumberFormat("de-CH", {
    style: "currency",
    currency: "CHF",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

  if (!holding) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-2xl">
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
                onChange={(e) => {
                  setAutoQuoteEnabled(true);
                  setAppliedQuoteKey(null);
                  setForm({ ...form, ticker: e.target.value });
                }}
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
          {allowPositionSizeEdit && positionSizeBounds && currentPositionValueChf !== null && (
            <div className="rounded-lg border border-cyan-400/25 bg-cyan-400/5 p-4 space-y-3" data-testid="position-size-editor">
              <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
                <div>
                  <Label htmlFor="position-size-chf" className="text-xs text-cyan-100">Positionsgrösse (CHF)</Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Aktueller Kurs: {formatChf(currentPriceChf)} je Stück · verfügbare Cash-Reserve: {formatChf(Math.max(0, cashBalanceChf))}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Entspricht</p>
                  <p className="font-mono text-sm font-semibold text-cyan-200" data-testid="position-size-shares-preview">
                    {Number(form.shares || 0).toLocaleString("de-CH", { maximumFractionDigits: 6 })} Stück
                  </p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_11rem] sm:items-center">
                <Slider
                  aria-label="Positionsgrösse in CHF"
                  value={[Math.min(positionSizeBounds.maxValueChf, Math.max(0, currentPositionValueChf))]}
                  min={0}
                  max={positionSizeBounds.maxValueChf}
                  step={positionSizeBounds.sliderStepChf}
                  onValueChange={([value]) => setPositionValueChf(value)}
                  className="[&_[data-slot=slider-track]]:bg-slate-600 [&_[data-slot=slider-range]]:bg-cyan-400 [&_[data-slot=slider-thumb]]:border-cyan-300"
                />
                <Input
                  id="position-size-chf"
                  aria-label="Positionsgrösse in CHF eingeben"
                  type="number"
                  min="0"
                  max={positionSizeBounds.maxValueChf}
                  step={positionSizeBounds.sliderStepChf}
                  value={positionValueInput}
                  onChange={(e) => handlePositionValueInput(e.target.value)}
                  onBlur={() => {
                    const parsed = Number(positionValueInput);
                    if (!Number.isFinite(parsed) || parsed < 0) {
                      setPositionValueInput(currentPositionValueChf.toFixed(2));
                      return;
                    }
                    setPositionValueChf(parsed);
                  }}
                  className="bg-slate-600 border-slate-500 text-white font-mono"
                />
              </div>
              <div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
                <span>CHF 0.00</span>
                <span>Max. {formatChf(positionSizeBounds.maxValueChf)}</span>
              </div>
              <p className="text-xs text-cyan-100/80">
                Vorschau auf Basis des aktuellen CHF-Kurses. Erst «Speichern» passt Stückzahl und Cash-Reserve gemeinsam an; es werden keine Orders oder Ledgerbuchungen erstellt.
              </p>
            </div>
          )}
          {allowPositionSizeEdit && !positionSizeBounds && (
            <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-200">
              Die wertbasierte Positionsgrösse ist erst verfügbar, wenn ein positiver aktueller CHF-Kurs vorliegt.
            </p>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label className="text-xs">Stück</Label>
              <Input
                type="number"
                step="0.0001"
                value={form.shares}
                onChange={(e) => {
                  const nextShares = e.target.value;
                  setForm({ ...form, shares: nextShares });
                  if (allowPositionSizeEdit && currentPriceChf > 0) {
                    const parsedShares = Number(nextShares);
                    if (Number.isFinite(parsedShares) && parsedShares >= 0) {
                      setPositionValueInput((parsedShares * currentPriceChf).toFixed(2));
                    }
                  }
                }}
                className="bg-slate-600 border-slate-500 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Ø-Einstandspreis (CHF)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.avgBuyPrice}
                onChange={(e) => {
                  setAutoQuoteEnabled(false);
                  setForm({ ...form, avgBuyPrice: e.target.value });
                }}
                className="bg-slate-600 border-slate-500 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Einstandsdatum</Label>
              <Input
                type="date"
                value={form.entryDate}
                onChange={(e) => {
                  setAutoQuoteEnabled(true);
                  setAppliedQuoteKey(null);
                  setForm({ ...form, entryDate: e.target.value });
                }}
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
          {autoQuoteEnabled && form.entryDate && (
            <p className={`text-xs ${historicalQuote.data?.status && historicalQuote.data.status !== "available" ? "text-amber-300" : "text-cyan-300"}`}>
              {historicalQuote.isFetching
                ? "Historischer Einstandskurs wird geladen …"
                : historicalQuote.data?.status === "available"
                  ? <>Einstand automatisch aus dem splitbereinigten Schlusskurs vom {historicalQuote.data.effectiveDate} ({historicalQuote.data.priceLocal.toFixed(4)} {historicalQuote.data.priceCurrency}; FX {historicalQuote.data.fxRateToChf.toFixed(6)}) = CHF {historicalQuote.data.priceChf.toFixed(4)}. Erst «Speichern» übernimmt ihn.</>
                  : historicalQuote.data?.message ?? "Für das gewählte Datum ist noch kein historischer Einstandskurs verfügbar."}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Bei einer reinen Stückzahländerung in einem nicht aktivierten Demoportfolio wird der Gegenwert zum aktuellen CHF-Kurs automatisch der Cash-Reserve gutgeschrieben oder aus ihr belastet. ISIN, Ticker, Einstand, Einstandsdatum und Währung können weiterhin separat korrigiert werden.
            {holding.entryBasisLabel ? ` Gespeicherter Status: ${holding.entryBasisLabel}.` : ""}
          </p>
        </div>

        <DialogFooter>
          {allowDelete && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteConfirmOpen(true)}
              disabled={update.isPending || updateDemoPositionShares.isPending}
              className="mr-auto border-red-400/50 text-red-300 hover:border-red-400 hover:bg-red-500/10 hover:text-red-200"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Löschen
            </Button>
          )}
          {allowAlternatives && onShowAlternatives && (
            <Button
              type="button"
              variant="outline"
              onClick={() => onShowAlternatives({ ticker: originalTicker, companyName: holding.companyName })}
              className={allowDelete ? "border-[#00CFC1]/45 text-[#00CFC1] hover:bg-[#00CFC1]/10" : "mr-auto border-[#00CFC1]/45 text-[#00CFC1] hover:bg-[#00CFC1]/10"}
            >
              <GitCompareArrows className="h-4 w-4 mr-2" />
              Alternativen
            </Button>
          )}
          <Button variant="outline" onClick={onClose} className="border-slate-600 text-white hover:bg-slate-700">
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={update.isPending || updateDemoPositionShares.isPending} className="bg-cyan-600 hover:bg-cyan-700">
            {update.isPending || updateDemoPositionShares.isPending ? "Speichern…" : "Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
      <ConfirmDialog
        open={isDeleteConfirmOpen}
        onOpenChange={setIsDeleteConfirmOpen}
        title="Position löschen?"
        description={
          <>
            <strong className="text-white">{originalTicker}{holding.companyName ? ` · ${holding.companyName}` : ""}</strong> wird aus diesem nicht aktivierten Demoportfolio entfernt. Der aktuelle CHF-Gegenwert wird der Cash-Reserve gutgeschrieben. Es werden keine Börsenorder, Zahlungen oder Ledgerbuchungen erstellt.
          </>
        }
        confirmLabel="Position löschen"
        pendingLabel="Wird gelöscht…"
        onConfirm={handleDelete}
        isPending={updateDemoPositionShares.isPending}
      />
    </Dialog>
  );
}
