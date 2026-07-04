// Copilot-Insights inkl. Aktions-Dialog (KI-Vorschläge generieren → anpassen →
// umsetzen). Die Logik stammt unverändert aus pages/Portfolios.tsx und wurde
// im Zuge von F-01 hierher verschoben: Insights leben neu auf dem Dashboard
// (Vorgabe Teil 1 / F-12), ohne Doppel-Anzeige an zwei Orten (D-11).

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Info, Loader2 } from "lucide-react";
import { CopilotInsights } from "./CopilotInsights";

interface CopilotInsightsPanelProps {
  /** "aggregate" oder eine Portfolio-ID — wird an dashboard.getCopilotInsights durchgereicht. */
  scope: "aggregate" | number;
}

export function CopilotInsightsPanel({ scope }: CopilotInsightsPanelProps) {
  const utils = trpc.useUtils();

  const { data: copilotInsights = [], isLoading: insightsLoading, refetch: refetchInsights } =
    trpc.dashboard.getCopilotInsights.useQuery({ scope }, { staleTime: 5 * 60 * 1000 });

  // Portfolio-Liste für den Selektor im Aktions-Dialog
  const { data: portfolios = [] } = trpc.dashboard.getPortfolioCompact.useQuery();

  // State for action popup dialogs
  const [actionDialog, setActionDialog] = useState<{ open: boolean; title: string; body: string; insightId: string; insightType: string }>({ open: false, title: '', body: '', insightId: '', insightType: 'general' });
  const [actionLoading, setActionLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{ ticker: string; companyName: string; action: string; currentWeightPercent: number; targetWeightPercent: number; reason: string; selected: boolean }>>([]);
  const [suggestionSummary, setSuggestionSummary] = useState('');
  const [applyingState, setApplyingState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [selectedPortfolioForAction, setSelectedPortfolioForAction] = useState<number | null>(null);

  const applySuggestionsMutation = trpc.dashboard.applySuggestions.useMutation({
    onSuccess: (result) => {
      setApplyingState('success');
      toast.success('Vorschläge umgesetzt', { description: result.mode === 'live' ? `${result.transactions?.length || 0} Transaktionen erstellt` : `${result.updatedPositions} Positionen aktualisiert` });
      utils.portfolios.list.invalidate();
      utils.dashboard.getAggregatedMetrics.invalidate();
      utils.dashboard.getPortfolioCompact.invalidate();
    },
    onError: (error) => {
      setApplyingState('error');
      toast.error('Fehler', { description: error.message });
    }
  });

  return (
    <>
      <CopilotInsights
        insights={copilotInsights as any[]}
        loading={insightsLoading}
        onRefresh={() => refetchInsights()}
        onAction={(insight) => {
          const insightType = insight.id.includes('sector') ? 'sector_check'
            : insight.id.includes('concentration') || insight.id.includes('position') ? 'top_positions'
            : insight.id.includes('diversif') ? 'diversification'
            : insight.id.includes('cash') ? 'cash_management'
            : 'general';
          setActionDialog({ open: true, title: insight.title, body: insight.body, insightId: insight.id, insightType });
          setSuggestions([]);
          setSuggestionSummary('');
          setApplyingState('idle');
          // Bei Portfolio-Scope das Portfolio direkt vorauswählen
          setSelectedPortfolioForAction(typeof scope === 'number' ? scope : null);
        }}
      />

      {/* Copilot Insight Action Dialog */}
      <Dialog open={actionDialog.open} onOpenChange={(open) => setActionDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="bg-[#1a1f2e] border-white/10 text-white max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Info className="h-5 w-5 text-[#00CFC1]" />
              {actionDialog.title}
            </DialogTitle>
            <DialogDescription className="text-gray-300 text-sm leading-relaxed mt-2">
              {actionDialog.body}
            </DialogDescription>
          </DialogHeader>

          {/* Portfolio-Selektor für Aktion */}
          {suggestions.length === 0 && applyingState === 'idle' && (
            <div className="mt-4">
              <div className="text-xs text-gray-400 mb-2">Portfolio für Analyse wählen:</div>
              <Select
                value={selectedPortfolioForAction?.toString() || ''}
                onValueChange={(v) => setSelectedPortfolioForAction(Number(v))}
              >
                <SelectTrigger className="bg-[#0a0f1a] border-white/10 text-white">
                  <SelectValue placeholder="Portfolio wählen..." />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1f2e] border-white/10">
                  {portfolios.map((p: any) => (
                    <SelectItem key={p.id} value={p.id.toString()} className="text-white hover:bg-white/10">
                      {p.name} {p.isLive === 1 ? '(Live)' : '(Demo)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Vorschläge laden */}
          {suggestions.length === 0 && applyingState === 'idle' && (
            <div className="mt-4">
              <Button
                size="sm"
                className="bg-[#00CFC1] hover:bg-[#00CFC1]/80 text-black font-semibold w-full"
                disabled={actionLoading || !selectedPortfolioForAction}
                onClick={async () => {
                  setActionLoading(true);
                  try {
                    const result = await fetch(`/api/trpc/dashboard.analyzeInsight?input=${encodeURIComponent(JSON.stringify({ json: { insightType: actionDialog.insightType as any, portfolioId: selectedPortfolioForAction } }))}`, { credentials: 'include' });
                    const json = await result.json();
                    const data = json?.result?.data?.json || json?.result?.data;
                    if (data?.suggestions?.length > 0) {
                      setSuggestions(data.suggestions.map((s: any) => ({ ...s, selected: true })));
                      setSuggestionSummary(data.summary || '');
                    } else {
                      setSuggestionSummary(data?.summary || 'Keine konkreten Vorschläge verfügbar.');
                    }
                  } catch (e) {
                    toast.error('Fehler bei der Analyse');
                  } finally {
                    setActionLoading(false);
                  }
                }}
              >
                {actionLoading ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> KI analysiert...</>
                ) : (
                  'KI-Vorschläge generieren'
                )}
              </Button>
            </div>
          )}

          {/* Zusammenfassung */}
          {suggestionSummary && (
            <div className="mt-4 p-3 bg-[#0a0f1a] rounded-lg border border-white/5">
              <div className="text-xs text-gray-400 mb-1">KI-Analyse:</div>
              <div className="text-sm text-gray-200">{suggestionSummary}</div>
            </div>
          )}

          {/* Vorschläge-Liste */}
          {suggestions.length > 0 && applyingState !== 'success' && (
            <div className="mt-4 space-y-2">
              <div className="text-xs text-gray-400 mb-2">Vorschläge ({suggestions.filter(s => s.selected).length}/{suggestions.length} ausgewählt):</div>
              {suggestions.map((s, idx) => (
                <div key={idx} className={`p-3 rounded-lg border ${s.selected ? 'border-[#00CFC1]/40 bg-[#00CFC1]/5' : 'border-white/5 bg-[#0a0f1a] opacity-60'} cursor-pointer`}
                  onClick={() => {
                    const updated = [...suggestions];
                    updated[idx] = { ...updated[idx], selected: !updated[idx].selected };
                    setSuggestions(updated);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Checkbox checked={s.selected} className="border-white/30" />
                      <span className="text-sm font-medium text-white">{s.ticker}</span>
                      <span className="text-xs text-gray-400">{s.companyName}</span>
                    </div>
                    <Badge className={`text-xs ${
                      s.action === 'add_new' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                      s.action === 'increase' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                      s.action === 'reduce' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                      'bg-red-500/20 text-red-400 border-red-500/30'
                    }`}>
                      {s.action === 'add_new' ? 'NEU' : s.action === 'increase' ? 'ERHÖHEN' : s.action === 'reduce' ? 'REDUZIEREN' : 'VERKAUFEN'}
                    </Badge>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs">
                    <span className="text-gray-400">{s.currentWeightPercent.toFixed(1)}% → {s.targetWeightPercent.toFixed(1)}%</span>
                    <span className="text-gray-400">{s.reason}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Erfolgs-Meldung */}
          {applyingState === 'success' && (
            <div className="mt-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg text-center">
              <div className="text-green-400 font-semibold">✓ Vorschläge erfolgreich umgesetzt</div>
              <div className="text-xs text-gray-400 mt-1">Die Positionen wurden angepasst.</div>
            </div>
          )}

          <DialogFooter className="mt-4 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-white/20 text-gray-300 hover:bg-white/10"
              onClick={() => {
                setActionDialog(prev => ({ ...prev, open: false }));
                setSuggestions([]);
                setSuggestionSummary('');
                setApplyingState('idle');
              }}
            >
              Schliessen
            </Button>
            {suggestions.length > 0 && !applySuggestionsMutation.isPending && applyingState !== 'success' && (
              <Button
                size="sm"
                className="bg-[#00CFC1] hover:bg-[#00CFC1]/80 text-black font-semibold"
                disabled={suggestions.filter(s => s.selected).length === 0 || applySuggestionsMutation.isPending}
                onClick={() => {
                  if (!selectedPortfolioForAction) return;
                  setApplyingState('loading');
                  applySuggestionsMutation.mutate({
                    portfolioId: selectedPortfolioForAction,
                    suggestions: suggestions.filter(s => s.selected).map(s => ({
                      ticker: s.ticker,
                      action: s.action as any,
                      targetWeightPercent: s.targetWeightPercent,
                    })),
                    autoCalculateFees: true,
                  });
                }}
              >
                {`${suggestions.filter(s => s.selected).length} Vorschläge umsetzen`}
              </Button>
            )}
            {applySuggestionsMutation.isPending && (
              <Button size="sm" disabled className="bg-[#00CFC1]/50 text-black font-semibold">
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Umsetzen...
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
