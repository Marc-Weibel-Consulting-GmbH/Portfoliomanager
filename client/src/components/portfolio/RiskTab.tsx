import { trpc } from "@/lib/trpc";

// Risiko-Tab (Mockup S.05): Risiko-Kennzahlen + Bubble-Indikator (LPPL).
// Nutzt echte Server-Endpoints dashboard.getRiskMetrics + dashboard.getBubbleIndicator
// (scope = einzelnes Portfolio).
export default function RiskTab({ portfolioId }: { portfolioId: number }) {
  const { data: risk, isLoading: riskLoading } = trpc.dashboard.getRiskMetrics.useQuery(
    { scope: portfolioId },
    { enabled: portfolioId > 0 }
  );
  const { data: bubble, isLoading: bubbleLoading } = trpc.dashboard.getBubbleIndicator.useQuery(
    { scope: portfolioId },
    { enabled: portfolioId > 0 }
  );

  const metrics: { label: string; value: string; sub?: string; tone?: "good" | "bad" | "neutral" }[] = [
    {
      label: "Volatilität (p.a.)",
      value: risk ? `${risk.volatility.toFixed(1)}%` : "—",
      sub: risk ? `Bench ${risk.volBenchmark.toFixed(1)}%` : undefined,
      tone: "neutral",
    },
    {
      label: "Max Drawdown",
      value: risk ? `${risk.maxDrawdown.toFixed(1)}%` : "—",
      sub: risk ? `Bench ${risk.drawdownBenchmark.toFixed(1)}%` : undefined,
      tone: "bad",
    },
    {
      label: "Beta",
      value: risk ? risk.beta.toFixed(2) : "—",
      sub: "vs. SMI",
      tone: "neutral",
    },
    {
      label: "VaR (95%, 1T)",
      value: risk ? `${risk.var95.toFixed(1)}%` : "—",
      sub: "Tagesverlust-Schwelle",
      tone: "bad",
    },
    {
      label: "Sharpe Ratio",
      value: risk ? risk.sharpeRatio.toFixed(2) : "—",
      sub: risk ? `Bench ${risk.sharpeBenchmark.toFixed(2)}` : undefined,
      tone: risk && risk.sharpeRatio >= 1 ? "good" : "neutral",
    },
    {
      label: "Konzentration Top 3",
      value: risk ? `${risk.concentrationTop3.toFixed(1)}%` : "—",
      sub: "Anteil der 3 grössten Positionen",
      tone: risk && risk.concentrationTop3 > 60 ? "bad" : "neutral",
    },
  ];

  const toneClass = (t?: "good" | "bad" | "neutral") =>
    t === "good" ? "text-[#00CFC1]" : t === "bad" ? "text-red-400" : "text-white";

  const bubbleColor =
    bubble?.label === "Hoch" ? "text-red-400" : bubble?.label === "Mittel" ? "text-amber-400" : "text-[#00CFC1]";
  const bubbleBar =
    bubble?.label === "Hoch" ? "bg-red-400" : bubble?.label === "Mittel" ? "bg-amber-400" : "bg-[#00CFC1]";

  return (
    <div className="grid lg:grid-cols-5 gap-6">
      {/* Risiko-Kennzahlen */}
      <div className="lg:col-span-3">
        <div className="bg-[#0f1420] border border-white/10 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Risiko-Kennzahlen</h3>
          {riskLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-5 h-5 border-2 border-[#00CFC1] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-white/10 rounded-lg overflow-hidden">
              {metrics.map((m) => (
                <div key={m.label} className="bg-[#0f1420] p-4">
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5">{m.label}</p>
                  <p className={`text-xl font-bold font-mono ${toneClass(m.tone)}`}>{m.value}</p>
                  {m.sub && <p className="text-xs text-gray-500 mt-0.5">{m.sub}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bubble-Indikator (LPPL) */}
      <div className="lg:col-span-2">
        <div className="bg-[#0f1420] border border-white/10 rounded-lg p-5 h-full">
          <h3 className="text-sm font-semibold text-white mb-1">Bubble-Indikator</h3>
          <p className="text-xs text-gray-500 mb-1">LPPL · S&amp;P 500</p>
          <p className="text-[10px] text-amber-500/70 mb-3">⚠ Globaler Markt-Indikator – identisch für alle Portfolios</p>
          {bubbleLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-5 h-5 border-2 border-[#00CFC1] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <div className="flex items-end gap-2 mb-2">
                <span className={`text-3xl font-bold font-mono ${bubbleColor}`}>{bubble?.score ?? 0}</span>
                <span className={`text-sm font-medium mb-1 ${bubbleColor}`}>{bubble?.label ?? "—"}</span>
              </div>
              <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden mb-4">
                <div className={`h-2 rounded-full ${bubbleBar}`} style={{ width: `${Math.min(100, bubble?.score ?? 0)}%` }} />
              </div>
              {bubble?.history && bubble.history.length > 0 && (
                <div className="flex items-end gap-1 h-16 mb-4">
                  {bubble.history.map((h, i) => (
                    <div key={i} className="flex-1 bg-[#00CFC1]/30 rounded-sm" style={{ height: `${Math.max(4, Math.min(100, h))}%` }} title={`${h}`} />
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-400 leading-relaxed">{bubble?.interpretation}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
