import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Save, X, Loader2, Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface PortfolioSettingsModalProps {
  open: boolean;
  onClose: () => void;
  portfolioId: number;
  initialName: string;
  initialDescription?: string;
  initialInvestmentAmount: string;
  portfolioType: 'demo' | 'live';
  onSuccess?: () => void;
}

export function PortfolioSettingsModal({
  open,
  onClose,
  portfolioId,
  initialName,
  initialDescription,
  initialInvestmentAmount,
  portfolioType,
  onSuccess
}: PortfolioSettingsModalProps) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription || "");
  const [investmentAmount, setInvestmentAmount] = useState(initialInvestmentAmount);
  const [hasChanges, setHasChanges] = useState(false);

  const utils = trpc.useUtils();

  // Initialize form when modal opens
  useEffect(() => {
    if (open) {
      setName(initialName);
      setDescription(initialDescription || "");
      setInvestmentAmount(initialInvestmentAmount);
      setHasChanges(false);
    }
  }, [open, initialName, initialDescription, initialInvestmentAmount]);

  // Track changes
  useEffect(() => {
    const changed = 
      name !== initialName ||
      description !== (initialDescription || "") ||
      investmentAmount !== initialInvestmentAmount;
    setHasChanges(changed);
  }, [name, description, investmentAmount, initialName, initialDescription, initialInvestmentAmount]);

  // Update portfolio mutation
  const updatePortfolio = trpc.portfolios.update.useMutation({
    onSuccess: () => {
      toast.success("Portfolio-Einstellungen erfolgreich aktualisiert");
      utils.portfolios.list.invalidate();
      utils.portfolios.getWithCurrency.invalidate();
      onSuccess?.();
      onClose();
    },
    onError: (error) => {
      toast.error(`Fehler beim Speichern: ${error.message}`);
    },
  });

  // Save changes
  const handleSave = () => {
    if (!name.trim()) {
      toast.error("Portfolio-Name darf nicht leer sein");
      return;
    }

    const amount = parseFloat(investmentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Investitionssumme muss eine positive Zahl sein");
      return;
    }

    updatePortfolio.mutate({
      id: portfolioId,
      name: name.trim(),
      description: description.trim() || undefined,
      // Note: investmentAmount cannot be updated via this mutation
      // It's displayed for reference only
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl">
            <Settings className="h-5 w-5 text-cyan-400" />
            <span>Portfolio-Einstellungen</span>
            <Badge variant="outline" className="text-cyan-400 border-cyan-400/50">
              {portfolioType === 'demo' ? 'Demo' : 'Live'}
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Grundlegende Parameter des Portfolios bearbeiten
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Portfolio Name */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium text-white">
              Portfolio-Name *
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. Mein Dividenden-Portfolio"
              className="bg-slate-700 border-slate-600 text-white"
              maxLength={100}
            />
            <p className="text-xs text-muted-foreground">
              Ein aussagekräftiger Name hilft bei der Übersicht
            </p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium text-white">
              Beschreibung
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optionale Beschreibung oder Strategie-Notizen..."
              className="bg-slate-700 border-slate-600 text-white min-h-[100px]"
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">
              {description.length}/500 Zeichen
            </p>
          </div>

          {/* Investment Amount (Read-only for now) */}
          <div className="space-y-2">
            <Label htmlFor="investmentAmount" className="text-sm font-medium text-white">
              Investitionssumme
            </Label>
            <div className="relative">
              <Input
                id="investmentAmount"
                value={investmentAmount}
                disabled
                className="bg-slate-700/50 border-slate-600 text-white/70 cursor-not-allowed"
              />
              <Badge 
                variant="outline" 
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-yellow-400 border-yellow-400/50"
              >
                Nicht änderbar
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Die Investitionssumme kann nach der Erstellung nicht mehr geändert werden
            </p>
          </div>

          {/* Info Box */}
          {portfolioType === 'demo' && (
            <div className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-cyan-400 mt-2"></div>
                <div>
                  <p className="text-white font-medium mb-1">Demo-Portfolio</p>
                  <p className="text-sm text-gray-300">
                    Dies ist ein Test-Portfolio. Sie können jederzeit Positionen hinzufügen, 
                    entfernen oder Gewichtungen anpassen, ohne echtes Geld zu investieren.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-slate-700 pt-4">
          <div className="flex items-center justify-between w-full">
            <Button
              variant="ghost"
              onClick={onClose}
              className="text-muted-foreground hover:text-white"
            >
              <X className="h-4 w-4 mr-2" />
              Abbrechen
            </Button>
            
            <Button
              onClick={handleSave}
              disabled={!hasChanges || updatePortfolio.isPending}
              className="bg-cyan-600 hover:bg-cyan-700 text-white"
            >
              {updatePortfolio.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Speichern...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Änderungen speichern
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
