/**
 * Signale — Aktien-Sektion (F-14), geroutet unter /aktien/signale.
 *
 * E2 (REFORM_BEWERTUNG_SIGNAL.md): Das Signal beschreibt den ZUSTAND eines
 * Titels (Qualität und Timing, Bewertung als Wächter) — es ordnet keine
 * Kaufliste. Die Seite zeigt die Titel im besten Zustand plus die
 * Signal-Historie; die Kaufentscheidung bleibt beim kuratierten Universum
 * mit Gleichgewichtung und Disziplin.
 */
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import AktienTabsNav from "@/components/AktienTabsNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { TrendingUp, History } from "lucide-react";
import { signalAnzeige } from "@shared/signalAnzeige";

const ACTION_LABELS: Record<string, { label: string; className: string }> = {
  buy: { label: "Kaufen", className: "bg-green-500 hover:bg-green-600 text-white" },
  add: { label: "Erhöhen", className: "bg-emerald-500/20 text-emerald-500 border border-emerald-500/30" },
  hold: { label: "Halten", className: "bg-secondary text-secondary-foreground" },
  reduce: { label: "Reduzieren", className: "bg-amber-500/20 text-amber-500 border border-amber-500/30" },
  sell: { label: "Verkaufen", className: "bg-red-500 hover:bg-red-600 text-white" },
  hedge: { label: "Absichern", className: "bg-purple-500/20 text-purple-400 border border-purple-500/30" },
  rebalance: { label: "Umschichten", className: "bg-blue-500/20 text-blue-400 border border-blue-500/30" },
};

function ActionBadge({ action }: { action: string }) {
  const cfg = ACTION_LABELS[action] ?? ACTION_LABELS.hold;
  return <Badge className={cfg.className}>{cfg.label}</Badge>;
}

function fmtPct(v: number | null | undefined) {
  if (v == null || isNaN(v)) return "–";
  return `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%`;
}

function SignalBadge({ signal }: { signal: string }) {
  const map: Record<string, string> = {
    "STRONG BUY": "bg-emerald-500 text-white",
    "BUY": "bg-[#00CFC1] text-black",
  };
  // E2: neutrale Zustandsworte statt Kauforder (Datenwert bleibt englisch).
  return <Badge className={map[signal] ?? "bg-secondary"}>{signalAnzeige(signal) ?? signal}</Badge>;
}

export default function Signals() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const { data: scoring = [], isLoading } = trpc.dashboard.getScoringWatchlist.useQuery();
  // F-14: Empfehlungs-Historie aus signal_history (global, neueste zuerst)
  const { data: history = [], isLoading: historyLoading } = trpc.signals.getHistory.useQuery();

  if (!user) return null;

  const buys = (scoring as any[])
    .filter((s) => s.signal === "STRONG BUY" || s.signal === "BUY")
    .sort((a, b) => b.combinedScore - a.combinedScore);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* F-14: Aktien-Sektion mit Tabs «Titel | Kaufsignale» */}
        <AktienTabsNav active="signale" />
        <div>
          <h1 className="text-3xl font-bold text-foreground">Signale</h1>
          <p className="text-muted-foreground mt-1">
            Titel aus der Empfehlungsliste im besten Zustand — das Signal entsteht aus Qualität
            und Timing, gewichtet nach Marktlage; extreme Überbewertung deckelt es. Es beschreibt
            den Titel, es ordnet keine Kaufliste.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Titel im besten Zustand ({buys.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Signale werden berechnet…</div>
            ) : buys.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Aktuell kein Titel der Empfehlungsliste im Band «Gut» oder besser.
              </div>
            ) : (
              <div className="space-y-3">
                {buys.map((s) => (
                  <div
                    key={s.ticker}
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(`/aktien/${s.ticker}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        navigate(`/aktien/${s.ticker}`);
                      }
                    }}
                    className="p-4 border border-border rounded-lg flex items-center justify-between gap-3 hover:border-primary/50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <TrendingUp className="h-5 w-5 text-green-500 shrink-0" />
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-lg font-mono">{s.ticker}</span>
                          <SignalBadge signal={s.signal} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Qualität {s.qualitaet != null ? Math.round(s.qualitaet) : "–"} ·
                          Bewertung {s.bewertung != null ? Math.round(s.bewertung) : "–"} ·
                          Timing {s.timing != null ? Math.round(s.timing) : "–"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-muted-foreground">Signal</p>
                      <p className={`text-xl font-bold font-mono ${
                        s.combinedScore >= 70 ? "text-emerald-500" : "text-[#00CFC1]"
                      }`}>{s.combinedScore}<span className="text-sm text-muted-foreground">/100</span></p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* F-14: Empfehlungs-Historie aus signal_history (täglicher Snapshot,
            Auswertung nach Ablauf der Haltedauer inkl. Benchmark/Alpha) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Empfehlungs-Historie
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Vergangene Signale mit tatsächlicher Rendite seit Empfehlung, Benchmark (SPI) und Alpha.
              Die Auswertung erfolgt automatisch nach Ablauf der Haltedauer.
            </p>
          </CardHeader>
          <CardContent>
            {historyLoading ? (
              <div className="text-center py-8 text-muted-foreground">Lade Historie...</div>
            ) : history.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Noch keine ausgewerteten Signale — die Auswertung läuft täglich.
              </div>
            ) : (
              <div className="space-y-2">
                {history.map((h) => {
                  const dateStr = h.date ? new Date(h.date as any).toLocaleDateString("de-CH") : "–";
                  return (
                    <div
                      key={h.id}
                      className="p-3 border border-border rounded-lg flex flex-wrap items-center gap-x-3 gap-y-2 text-sm"
                    >
                      <span className="text-muted-foreground whitespace-nowrap">Empfehlung vom {dateStr}:</span>
                      <ActionBadge action={h.action} />
                      <span className="font-mono font-semibold">{h.ticker}</span>
                      {h.evaluated ? (
                        <span className="text-muted-foreground">
                          — seither{" "}
                          <span className={`font-semibold ${(h.actualReturnPct ?? 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
                            {fmtPct(h.actualReturnPct)}
                          </span>
                          {h.benchmarkReturnPct != null && (
                            <>, Benchmark <span className="font-semibold text-foreground">{fmtPct(h.benchmarkReturnPct)}</span></>
                          )}
                          {h.alphaPct != null && (
                            <>, Alpha{" "}
                              <span className={`font-semibold ${h.alphaPct >= 0 ? "text-green-500" : "text-red-500"}`}>
                                {fmtPct(h.alphaPct)}
                              </span>
                            </>
                          )}
                          {h.directionCorrect === 1 && <span className="text-green-500 ml-1">✓</span>}
                          {h.directionCorrect === 0 && <span className="text-red-500 ml-1">✗</span>}
                        </span>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">Auswertung ausstehend</Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
