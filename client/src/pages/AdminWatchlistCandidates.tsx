import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useState } from "react";
import { CheckCircle, XCircle, CheckCheck, RefreshCw, Globe, TrendingUp, Info } from "lucide-react";

function parseNotes(notes: string | null): { gap: string; reason: string } {
  if (!notes) return { gap: "—", reason: "—" };
  // format: "universe_expansion|gap|reason"
  const parts = notes.split("|");
  return {
    gap: parts[1] ?? "—",
    reason: parts[2] ?? "—",
  };
}

export default function AdminWatchlistCandidates() {
  const utils = trpc.useUtils();
  const { data: candidates = [], isLoading, refetch } = trpc.admin.getUniverseCandidates.useQuery();

  const approveMutation = trpc.admin.approveUniverseCandidate.useMutation({
    onSuccess: () => {
      toast.success("Titel in Watchlist übernommen");
      utils.admin.getUniverseCandidates.invalidate();
    },
    onError: (err) => toast.error(`Fehler: ${err.message}`),
  });

  const rejectMutation = trpc.admin.rejectUniverseCandidate.useMutation({
    onSuccess: () => {
      toast.success("Titel abgelehnt und entfernt");
      utils.admin.getUniverseCandidates.invalidate();
    },
    onError: (err) => toast.error(`Fehler: ${err.message}`),
  });

  const approveAllMutation = trpc.admin.approveAllUniverseCandidates.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.approved} Titel in Watchlist übernommen`);
      utils.admin.getUniverseCandidates.invalidate();
    },
    onError: (err) => toast.error(`Fehler: ${err.message}`),
  });

  const [confirmApproveAll, setConfirmApproveAll] = useState(false);

  return (
    <div className="min-h-screen bg-[#080d17] text-white p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <Globe className="w-6 h-6 text-violet-400" />
          <h1 className="text-2xl font-bold text-white">Universum-Kandidaten</h1>
          <Badge className="bg-violet-500/20 text-violet-300 border-violet-500/30 text-xs">
            {candidates.length} ausstehend
          </Badge>
        </div>
        <p className="text-sm text-gray-400 mt-1">
          Titel, die der KI-Builder aus dem gesamten Aktienuniversum vorgeschlagen hat, um Lücken in der Watchlist zu schliessen.
          Übernommene Titel werden sofort in den KI-Builder-Kandidatenpool aufgenommen.
        </p>
      </div>

      {/* Info Banner */}
      <div className="flex items-start gap-3 bg-violet-500/10 border border-violet-500/20 rounded-xl p-4 mb-6">
        <Info className="w-4 h-4 text-violet-400 mt-0.5 shrink-0" />
        <div className="text-xs text-violet-300 leading-relaxed">
          <strong>Wie funktioniert das?</strong> Wenn die Watchlist in einem Sektor, Dividenden-Tier, Sharpe-Ratio-Bereich oder Momentum-Klasse
          weniger als 3 geeignete Titel hat, sucht der KI-Builder automatisch im EODHD-Universum nach neuen Kandidaten.
          Maximal 20% der Vorschläge in einem Portfolio stammen aus dem Universum. Diese Seite zeigt alle so gefundenen Titel —
          Sie entscheiden, ob sie dauerhaft in die Watchlist übernommen werden sollen.
        </div>
      </div>

      {/* Bulk Actions */}
      {candidates.length > 0 && (
        <div className="flex items-center gap-3 mb-4">
          {!confirmApproveAll ? (
            <Button
              variant="outline"
              size="sm"
              className="border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
              onClick={() => setConfirmApproveAll(true)}
            >
              <CheckCheck className="w-4 h-4 mr-2" />
              Alle übernehmen ({candidates.length})
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-amber-300">Wirklich alle {candidates.length} Titel übernehmen?</span>
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => {
                  approveAllMutation.mutate();
                  setConfirmApproveAll(false);
                }}
                disabled={approveAllMutation.isPending}
              >
                Ja, alle übernehmen
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmApproveAll(false)}
              >
                Abbrechen
              </Button>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-400"
            onClick={() => refetch()}
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Aktualisieren
          </Button>
        </div>
      )}

      {/* Candidates Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-gray-500">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" />
          Lade Kandidaten...
        </div>
      ) : candidates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Globe className="w-12 h-12 text-gray-600 mb-4" />
          <p className="text-gray-400 text-lg font-medium">Keine ausstehenden Kandidaten</p>
          <p className="text-gray-600 text-sm mt-1">
            Neue Kandidaten erscheinen hier, sobald der KI-Builder Lücken in der Watchlist erkennt und externe Titel vorschlägt.
          </p>
        </div>
      ) : (
        <div className="border border-white/10 rounded-xl overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4 px-4 py-2.5 bg-white/5 text-xs text-gray-400 font-medium uppercase tracking-wide">
            <span>Titel</span>
            <span>Sektor</span>
            <span>Lücke geschlossen</span>
            <span>Grund</span>
            <span>Marktkapital.</span>
            <span>Aktionen</span>
          </div>

          {/* Table Rows */}
          {candidates.map((c: any) => {
            const { gap, reason } = parseNotes(c.notes);
            const mcap = c.marketCap ? (Number(c.marketCap) / 1e9).toFixed(1) + " Mrd." : "—";
            return (
              <div
                key={c.id}
                className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4 px-4 py-3 border-t border-white/5 items-center hover:bg-white/[0.02] transition-colors"
              >
                {/* Ticker + Name */}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-violet-300">{c.ticker}</span>
                    <span className="text-sm text-white truncate">{c.companyName}</span>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-violet-500/20 text-violet-300 border border-violet-500/30">
                      ✨ Universum
                    </span>
                  </div>
                  {c.currency && (
                    <span className="text-xs text-gray-600">{c.currency}</span>
                  )}
                </div>

                {/* Sector */}
                <span className="text-xs text-gray-400 truncate">{c.sector ?? "—"}</span>

                {/* Gap */}
                <span className="text-xs text-violet-300 truncate">{gap}</span>

                {/* Reason */}
                <span className="text-xs text-gray-500 truncate" title={reason}>{reason}</span>

                {/* Market Cap */}
                <span className="text-xs text-gray-400">{mcap}</span>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 h-7 px-2"
                    onClick={() => approveMutation.mutate({ stockId: c.id })}
                    disabled={approveMutation.isPending}
                    title="In Watchlist übernehmen"
                  >
                    <CheckCircle className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-400 hover:bg-red-500/10 hover:text-red-300 h-7 px-2"
                    onClick={() => rejectMutation.mutate({ stockId: c.id })}
                    disabled={rejectMutation.isPending}
                    title="Ablehnen und entfernen"
                  >
                    <XCircle className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
