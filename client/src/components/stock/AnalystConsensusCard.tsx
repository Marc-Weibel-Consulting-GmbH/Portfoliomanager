import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { formatNumber as formatNumberCH } from "@/lib/format";

/**
 * Analysten-Konsens (Kaufen / Halten / Verkaufen + Kursziel + Potenzial).
 * Reuses trpc.invest.stockDetail (the legacy invest stock-detail endpoint).
 * Self-contained, no DashboardLayout. Renders nothing if no consensus data.
 */
export default function AnalystConsensusCard({ ticker }: { ticker: string }) {
  const { data } = trpc.invest.stockDetail.useQuery(
    { ticker },
    { enabled: !!ticker }
  );

  const consensus = data?.analystConsensus;
  if (!consensus) return null;

  const { buy, hold, sell, targetPrice } = consensus;
  const total = buy + hold + sell;

  // Nothing meaningful to show
  if (total === 0 && !targetPrice) return null;

  const currency = data?.currency || "";
  const currentPrice = data?.currentPrice ?? null;

  // Zentrale Formatierung (lib/format), plus «—»-Fallback für fehlende Werte.
  const formatNumber = (val: number | null | undefined, decimals = 2) =>
    val === null || val === undefined ? "—" : formatNumberCH(val, { decimals });

  const potential =
    targetPrice != null && currentPrice != null && currentPrice > 0
      ? ((targetPrice - currentPrice) / currentPrice) * 100
      : null;

  return (
    <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/20">
      <CardContent className="p-4">
        <h3 className="text-lg font-semibold text-white mb-3">Analysten-Konsens</h3>
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div className="text-center p-3 rounded-lg bg-[#00CFC1]/10 border border-[#00CFC1]/20">
            <div className="text-2xl font-bold font-mono text-[#00CFC1]">{buy}</div>
            <div className="text-xs text-gray-400">Kaufen</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <div className="text-2xl font-bold font-mono text-yellow-500">{hold}</div>
            <div className="text-xs text-gray-400">Halten</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <div className="text-2xl font-bold font-mono text-red-500">{sell}</div>
            <div className="text-xs text-gray-400">Verkaufen</div>
          </div>
        </div>
        {targetPrice != null && (
          <div className="bg-[#1a1f2e] rounded-lg p-3 border border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Kursziel</span>
              <span className="text-lg font-bold font-mono text-white">
                {currency} {formatNumber(targetPrice)}
              </span>
            </div>
            {potential != null && (
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-gray-400">Potenzial</span>
                <span
                  className={`text-sm font-semibold font-mono ${
                    potential >= 0 ? "text-[#00CFC1]" : "text-red-500"
                  }`}
                >
                  {potential >= 0 ? "+" : ""}
                  {formatNumber(potential, 1)}%
                </span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
