/**
 * MlSignalWidget
 * Shows the Gradient-Boosting (or RF fallback) ML signal for a single stock.
 * - Badge is only labelled "KI-Signal" when source === 'gb' (promoted model)
 * - When source === 'rf' (fallback), clearly labelled as "Heuristisches Signal"
 * - Modell-Transparenz-Panel shows active model metadata from DB (via getActiveModelInfo)
 */
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { Brain, TrendingUp, TrendingDown, Minus, ExternalLink, AlertCircle, Info, CheckCircle } from "lucide-react";

interface Props {
  ticker: string;
}

function SignalBadge({ signal, score, isGb }: { signal: string; score: number; isGb: boolean }) {
  const upper = signal.toUpperCase().replace("_", " ");
  const isBuy = upper === "BUY" || upper === "STRONG BUY";
  const isSell = upper === "SELL" || upper === "STRONG SELL";

  if (isBuy) {
    return (
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
          <TrendingUp className="w-4 h-4" />
          KAUFEN
        </span>
        <span className="text-2xl font-bold text-emerald-400 font-mono">{score}/100</span>
        {!isGb && <span className="text-xs text-zinc-500 italic">(Heuristik)</span>}
      </div>
    );
  }
  if (isSell) {
    return (
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold bg-red-500/20 text-red-400 border border-red-500/30">
          <TrendingDown className="w-4 h-4" />
          VERKAUFEN
        </span>
        <span className="text-2xl font-bold text-red-400 font-mono">{score}/100</span>
        {!isGb && <span className="text-xs text-zinc-500 italic">(Heuristik)</span>}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold bg-zinc-500/20 text-zinc-400 border border-zinc-500/30">
        <Minus className="w-4 h-4" />
        NEUTRAL
      </span>
      <span className="text-2xl font-bold text-zinc-400 font-mono">{score}/100</span>
      {!isGb && <span className="text-xs text-zinc-500 italic">(Heuristik)</span>}
    </div>
  );
}

function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const color = pct >= 70 ? "bg-emerald-500" : pct >= 50 ? "bg-yellow-500" : "bg-zinc-500";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-zinc-400">
        <span>Modell-Konfidenz</span>
        <span className="font-mono font-semibold text-white">{pct}%</span>
      </div>
      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function MetricPill({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <div className="bg-zinc-800/50 rounded-lg p-2 text-center">
      <div className="text-xs text-zinc-500 mb-0.5">{label}</div>
      <div className={`text-sm font-bold font-mono ${good ? "text-emerald-400" : "text-red-400"}`}>{value}</div>
    </div>
  );
}

export default function MlSignalWidget({ ticker }: Props) {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const { data, isLoading, error } = trpc.prediction.predict.useQuery(
    { ticker },
    { enabled: !!ticker, staleTime: 5 * 60_000 }
  );

  const { data: modelInfo } = trpc.prediction.getActiveModelInfo.useQuery(
    undefined,
    { staleTime: 10 * 60_000 }
  );

  const rfSignal = (data as any)?.rfSignal;
  const isGbModel = rfSignal?.source === "gb";
  const activeModel = modelInfo?.model;

  if (isLoading) {
    return (
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 animate-pulse">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="w-5 h-5 text-violet-400" />
          <div className="h-4 bg-zinc-700 rounded w-32" />
        </div>
        <div className="space-y-3">
          <div className="h-8 bg-zinc-700 rounded w-48" />
          <div className="h-2 bg-zinc-700 rounded w-full" />
          <div className="h-2 bg-zinc-700 rounded w-3/4" />
        </div>
      </div>
    );
  }

  if (error || !rfSignal) {
    return (
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5">
        <div className="flex items-center gap-2 text-zinc-500">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">ML-Signal nicht verfügbar</span>
        </div>
        {user?.role === "admin" && (
          <button
            onClick={() => navigate("/admin/ml-trainer")}
            className="mt-3 flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300"
          >
            <ExternalLink className="w-3 h-3" />
            Modell trainieren →
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-violet-400" />
          <span className="text-sm font-semibold text-white">
            {isGbModel ? "KI-Signal" : "Heuristisches Signal"}
          </span>
          {isGbModel ? (
            <span className="flex items-center gap-1 text-xs text-violet-400 bg-violet-500/10 border border-violet-500/20 rounded-full px-2 py-0.5">
              <CheckCircle className="w-3 h-3" />
              GB-Modell aktiv
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-zinc-500 bg-zinc-800 border border-zinc-700 rounded-full px-2 py-0.5">
              <Info className="w-3 h-3" />
              RF-Fallback
            </span>
          )}
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

      {/* Signal + Score */}
      <SignalBadge signal={rfSignal.signal} score={rfSignal.score} isGb={isGbModel} />

      {/* Confidence bar */}
      <ConfidenceBar confidence={rfSignal.confidence} />

      {/* Reasons */}
      {rfSignal.reasons && rfSignal.reasons.length > 0 && (
        <ul className="space-y-1">
          {rfSignal.reasons.slice(0, 3).map((r: string, i: number) => (
            <li key={i} className="text-xs text-zinc-400 flex items-start gap-1.5">
              <span className="text-zinc-600 mt-0.5">•</span>
              {r}
            </li>
          ))}
        </ul>
      )}

      {/* Model Transparency Panel – shown when GB model is active */}
      {activeModel && (
        <div className="border-t border-zinc-800 pt-3 space-y-2">
          <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-medium">
            <Info className="w-3.5 h-3.5" />
            Modell-Transparenz
          </div>
          <div className="grid grid-cols-3 gap-2">
            <MetricPill
              label="HitRate"
              value={activeModel.hitRate != null ? `${(activeModel.hitRate * 100).toFixed(1)}%` : "—"}
              good={(activeModel.hitRate ?? 0) >= 0.52}
            />
            <MetricPill
              label="Alpha"
              value={activeModel.alpha != null ? `${(activeModel.alpha * 100).toFixed(1)}%` : "—"}
              good={(activeModel.alpha ?? 0) >= 0}
            />
            <MetricPill
              label="Overfit"
              value={activeModel.overfitRatio != null ? (activeModel.overfitRatio as number).toFixed(2) : "—"}
              good={(activeModel.overfitRatio as number ?? 99) <= 1.6}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-zinc-600">
            <span>v{activeModel.version} · {activeModel.universeSize} Titel</span>
            {activeModel.promotedAt && (
              <span>Trainiert {new Date(activeModel.promotedAt).toLocaleDateString("de-CH")}</span>
            )}
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <p className="text-xs text-zinc-600 pt-1 border-t border-zinc-800">
        {isGbModel
          ? "Statistisches Modell (Gradient Boosting) · Kein Anlagehinweis · Vergangene Performance ≠ zukünftige Ergebnisse"
          : "Heuristisches Modell (Random Forest, lokal trainiert) · Kein Anlagehinweis"}
      </p>
    </div>
  );
}
