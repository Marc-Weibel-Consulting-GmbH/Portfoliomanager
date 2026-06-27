/**
 * MlSignalWidget
 * WICHTIG: Das GB-Modell hat in der Schritt-0-Evaluation keinen echten Edge bewiesen
 * (Skill = -4.36pp, OverfitRatio = 35.92). Daher wird KEIN Handelssignal angezeigt.
 * Stattdessen: ehrliche Meldung + Modell-Transparenz-Panel für Admins.
 *
 * Reaktivierung: Sobald Skill >= +2pp und OverfitRatio < 1.6 in der Evaluation bestätigt.
 */
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { Brain, ExternalLink, FlaskConical, Info } from "lucide-react";

interface Props {
  ticker: string;
}

export default function MlSignalWidget({ ticker }: Props) {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const { data: modelInfo } = trpc.prediction.getActiveModelInfo.useQuery(
    undefined,
    { staleTime: 10 * 60_000 }
  );

  const activeModel = modelInfo?.model;

  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-violet-400" />
          <span className="text-sm font-semibold text-white">KI-Modell</span>
          <span className="flex items-center gap-1 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5">
            <FlaskConical className="w-3 h-3" />
            In Entwicklung
          </span>
        </div>
        {user?.role === "admin" && (
          <button
            onClick={() => navigate("/admin/ml-trainer")}
            className="text-zinc-500 hover:text-violet-400 transition-colors"
            title="ML Trainer öffnen"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Honest message */}
      <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4 space-y-2">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="text-sm text-amber-300 font-medium">
              Kein nachgewiesener Edge
            </p>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Das Gradient-Boosting-Modell wurde in einer rigorosen Walk-Forward-Evaluation
              getestet. Der echte Skill (OOS HitRate − Basisrate) beträgt aktuell{" "}
              <span className="text-red-400 font-mono font-semibold">−4.4 pp</span> — das Modell
              liegt unter der Mehrheitsklassen-Baseline. Handelssignale werden erst
              angezeigt, wenn Skill ≥ +2 pp und OverfitRatio &lt; 1.6 bestätigt sind.
            </p>
          </div>
        </div>
      </div>

      {/* What we're working on */}
      <div className="space-y-2">
        <p className="text-xs text-zinc-500 font-medium uppercase tracking-wide">
          Aktuelle Verbesserungen
        </p>
        <ul className="space-y-1.5">
          {[
            { done: true,  text: "Embargo/Purge (20 Tage) gegen Label-Leakage" },
            { done: false, text: "Cross-sektionale Feature-Normalisierung pro Datum" },
            { done: false, text: "Ökonomisches Gate (Dezil-Spread, Alpha vs. SPY)" },
          ].map(({ done, text }, i) => (
            <li key={i} className="flex items-center gap-2 text-xs text-zinc-400">
              <span className={done ? "text-emerald-400" : "text-zinc-600"}>
                {done ? "✓" : "○"}
              </span>
              <span className={done ? "text-zinc-300" : "text-zinc-500"}>{text}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Model info for admins */}
      {user?.role === "admin" && activeModel && (
        <div className="border-t border-zinc-800 pt-3 space-y-2">
          <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-medium">
            <Info className="w-3.5 h-3.5" />
            Letztes trainiertes Modell (v{activeModel.version})
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              {
                label: "HitRate",
                value: activeModel.hitRate != null ? `${((activeModel.hitRate as number) * 100).toFixed(1)}%` : "—",
                good: (activeModel.hitRate as number ?? 0) >= 0.52,
              },
              {
                label: "Alpha",
                value: activeModel.alpha != null ? `${((activeModel.alpha as number) * 100).toFixed(1)}%` : "—",
                good: (activeModel.alpha as number ?? -1) >= 0,
              },
              {
                label: "Overfit",
                value: activeModel.overfitRatio != null ? (activeModel.overfitRatio as number).toFixed(2) : "—",
                good: (activeModel.overfitRatio as number ?? 99) <= 1.6,
              },
            ].map(({ label, value, good }) => (
              <div key={label} className="bg-zinc-800/50 rounded-lg p-2 text-center">
                <div className="text-xs text-zinc-500 mb-0.5">{label}</div>
                <div className={`text-sm font-bold font-mono ${good ? "text-emerald-400" : "text-red-400"}`}>
                  {value}
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => navigate("/admin/ml-trainer")}
            className="w-full flex items-center justify-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 bg-violet-500/5 hover:bg-violet-500/10 border border-violet-500/20 rounded-lg py-2 transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            Zum ML Trainer
          </button>
        </div>
      )}

      {/* Disclaimer */}
      <p className="text-xs text-zinc-600 pt-1 border-t border-zinc-800">
        Kein Anlagehinweis · Modell in aktiver Entwicklung · Vergangene Performance ≠ zukünftige Ergebnisse
      </p>
    </div>
  );
}
