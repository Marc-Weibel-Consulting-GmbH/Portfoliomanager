/**
 * ValuationTab
 * Inline Fair-Value / DCF view for the stock-detail "Bewertung (DCF)" tab.
 * Reuses the existing `trpc.analytics.dcfValuation` endpoint (same call as DCFValuation.tsx)
 * and renders the key metrics plus a WACC × terminal-growth sensitivity heatmap.
 *
 * The DCF endpoint returns a single scenario per call. To draw the sensitivity grid
 * without spamming the backend, we reconstruct the intrinsic value across a WACC ×
 * growth matrix client-side from the base scenario's returned components
 * (projected FCFs, shares outstanding, base WACC and terminal growth). This is a
 * standard Gordon-growth / DCF re-discounting and is clearly an approximation.
 */
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calculator, RefreshCw, TrendingUp, TrendingDown } from "lucide-react";
import PegContextCard from "./PegContextCard";

interface Props {
  ticker: string;
  stock: any;
}

function MetricBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-[#1a1f2e] rounded-lg p-3 border border-white/10">
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className={`text-lg font-bold font-mono ${color || "text-white"}`}>{value}</div>
    </div>
  );
}

// Re-discount projected FCFs + terminal value for a given WACC / terminal growth.
// Returns intrinsic value per share (capped/floored like the backend).
function recomputeIntrinsic(
  projectedFCF: number[],
  shares: number,
  currentPrice: number,
  wacc: number,
  terminalGrowth: number
): number {
  if (!projectedFCF.length || shares <= 0) return 0;
  const effectiveWacc = Math.max(wacc, 0.08);
  const last = projectedFCF[projectedFCF.length - 1];
  const terminalFCF = last * (1 + terminalGrowth);
  const spread = Math.max(effectiveWacc - terminalGrowth, 0.035);
  const terminalValue = terminalFCF / spread;
  const pvFCF = projectedFCF.reduce(
    (sum, cf, i) => sum + cf / (1 + effectiveWacc) ** (i + 1),
    0
  );
  const pvTerminal = terminalValue / (1 + effectiveWacc) ** projectedFCF.length;
  let perShare = (pvFCF + pvTerminal) / shares;
  const maxReasonable = currentPrice * 2;
  if (perShare > maxReasonable) perShare = maxReasonable;
  if (perShare < 0) perShare = 0;
  return perShare;
}

// Map an upside % to a heatmap cell colour (red -> neutral -> teal).
function heatColor(upsidePct: number): string {
  const clamped = Math.max(-40, Math.min(40, upsidePct));
  if (clamped >= 0) {
    const alpha = 0.12 + (clamped / 40) * 0.55;
    return `rgba(0, 207, 193, ${alpha.toFixed(2)})`;
  }
  const alpha = 0.12 + (Math.abs(clamped) / 40) * 0.55;
  return `rgba(239, 68, 68, ${alpha.toFixed(2)})`;
}

export default function ValuationTab({ ticker, stock }: Props) {
  const [params, setParams] = useState<any>({ ticker });
  const [enabled, setEnabled] = useState(false);

  const { data: dcf, isFetching, error } = trpc.analytics.dcfValuation.useQuery(
    params,
    { enabled: enabled && !!params?.ticker, staleTime: 5 * 60_000 }
  );

  const currency = stock?.currency || "CHF";

  const runDCF = () => {
    setParams({ ticker });
    setEnabled(true);
  };

  // Build the WACC × terminal-growth sensitivity matrix from the base DCF result.
  const sensitivity = useMemo(() => {
    if (!dcf) return null;
    const baseWacc = dcf.wacc / 100; // returned in percent
    const baseGrowth = dcf.terminalGrowthRate / 100;
    const shares = dcf.sharesOutstanding;
    const projected = dcf.projectedFCF;
    const price = dcf.currentPrice;

    // WACC rows: base ± 1.5% in 0.75% steps. Growth columns: base ± 1% in 0.5% steps.
    const waccSteps = [-0.015, -0.0075, 0, 0.0075, 0.015].map((d) =>
      Math.max(0.06, baseWacc + d)
    );
    const growthSteps = [-0.01, -0.005, 0, 0.005, 0.01].map((d) =>
      Math.max(0, baseGrowth + d)
    );

    const rows = waccSteps.map((w) => ({
      wacc: w,
      cells: growthSteps.map((g) => {
        const intrinsic = recomputeIntrinsic(projected, shares, price, w, g);
        const upside = price > 0 ? ((intrinsic - price) / price) * 100 : 0;
        return { growth: g, intrinsic, upside };
      }),
    }));

    return { rows, growthSteps, baseWacc, baseGrowth };
  }, [dcf]);

  const upsideColor = dcf
    ? dcf.upsideDownside >= 20
      ? "text-[#00CFC1]"
      : dcf.upsideDownside >= 0
      ? "text-yellow-500"
      : "text-red-500"
    : "text-white";

  return (
    <div className="space-y-6">
      {/* Quick metrics (always available from `stock`) */}
      <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Calculator className="h-5 w-5 text-[#00CFC1]" />
            Bewertung &amp; Fair Value
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricBox label="KGV (P/E)" value={stock?.peRatio || "-"} />
            <MetricBox
              label="KBV (P/B)"
              value={(stock as any)?.pbRatio || "-"}
            />
            {/* PEG Ratio: wird in PegContextCard (EODHD-Quelle) unten detailliert angezeigt */}
            <MetricBox
              label="Div. Rendite"
              value={stock?.dividendYield ? `${parseFloat(stock.dividendYield).toFixed(2)}%` : "-"}
              color="text-[#00CFC1]"
            />
            <MetricBox
              label="Marktkapitalisierung"
              value={stock?.marketCap ? `${currency} ${parseFloat(stock.marketCap).toFixed(1)}B` : "-"}
            />
            <MetricBox
              label="52W Hoch"
              value={stock?.week52High ? `${currency} ${parseFloat(stock.week52High).toFixed(2)}` : "-"}
            />
            <MetricBox
              label="52W Tief"
              value={stock?.week52Low ? `${currency} ${parseFloat(stock.week52Low).toFixed(2)}` : "-"}
            />
            <MetricBox
              label="Beta"
              value={stock?.beta ? parseFloat(stock.beta).toFixed(2) : "-"}
            />
          </div>

          {!enabled && (
            <div className="pt-2 border-t border-white/10">
              <Button onClick={runDCF} className="bg-[#00CFC1] hover:bg-[#00CFC1]/80 text-black gap-2">
                <Calculator className="h-4 w-4" />
                DCF-Analyse berechnen
              </Button>
              <p className="text-xs text-gray-500 mt-2">
                Diskontierte Cashflow-Bewertung mit Sensitivitätsanalyse (WACC × Wachstum). Dauert ca. 5-10 Sekunden.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* PEG-Analyse & Qualitätsbewertung */}
      <PegContextCard
        ticker={ticker}
        companyName={stock?.name || stock?.shortName}
        sector={stock?.sector}
      />

      {/* Loading */}
      {isFetching && (
        <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/20">
          <CardContent className="py-12 text-center">
            <RefreshCw className="h-8 w-8 text-[#00CFC1] mx-auto mb-3 animate-spin" />
            <p className="text-gray-400 text-sm">DCF-Bewertung wird berechnet...</p>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {error && !isFetching && (
        <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-red-500/30">
          <CardContent className="py-6">
            <p className="text-red-500 text-sm">
              DCF-Berechnung fehlgeschlagen: {(error as any)?.message || "Möglicherweise sind keine Cashflow-Daten verfügbar."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* DCF result */}
      {dcf && !isFetching && (
        <>
          <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center justify-between">
                <span>DCF-Ergebnis</span>
                <Badge
                  variant="outline"
                  className={`text-xs px-3 py-1 ${
                    dcf.upsideDownside >= 0
                      ? "border-[#00CFC1]/50 text-[#00CFC1]"
                      : "border-red-500/50 text-red-500"
                  }`}
                >
                  {dcf.upsideDownside >= 0 ? "Unterbewertet" : "Überbewertet"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricBox
                  label="Aktueller Kurs"
                  value={`${dcf.currency} ${dcf.currentPrice.toLocaleString("de-CH", { minimumFractionDigits: 2 })}`}
                />
                <MetricBox
                  label="Fair Value (DCF)"
                  value={`${dcf.currency} ${dcf.intrinsicValue.toLocaleString("de-CH", { minimumFractionDigits: 2 })}`}
                  color={dcf.intrinsicValue > dcf.currentPrice ? "text-[#00CFC1]" : "text-red-500"}
                />
                <MetricBox
                  label="Upside / Downside"
                  value={`${dcf.upsideDownside >= 0 ? "+" : ""}${dcf.upsideDownside.toFixed(1)}%`}
                  color={upsideColor}
                />
                <MetricBox label="WACC" value={`${dcf.wacc.toFixed(2)}%`} />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricBox
                  label="Free Cash Flow"
                  value={`${dcf.currency} ${(dcf.freeCashFlow / 1e9).toFixed(2)} Mrd.`}
                />
                <MetricBox
                  label="Umsatzwachstum"
                  value={`${dcf.revenueGrowthEstimate.toFixed(1)}%`}
                />
                <MetricBox
                  label="Term. Wachstum"
                  value={`${dcf.terminalGrowthRate.toFixed(1)}%`}
                />
                <MetricBox label="Projektion" value={`${dcf.projectionYears} Jahre`} />
              </div>
            </CardContent>
          </Card>

          {/* Sensitivity heatmap: WACC (rows) × terminal growth (cols) */}
          {sensitivity && (
            <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/20">
              <CardHeader>
                <CardTitle className="text-white text-base">
                  Sensitivitätsanalyse — Fair Value Upside (%)
                </CardTitle>
                <p className="text-xs text-gray-500">
                  Zeilen: WACC · Spalten: terminales Wachstum. Farbe = Upside/Downside gegenüber dem aktuellen Kurs.
                </p>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr>
                        <th className="text-left p-2 text-xs text-gray-400 font-medium">
                          WACC \ Wachstum
                        </th>
                        {sensitivity.growthSteps.map((g, i) => (
                          <th
                            key={i}
                            className={`text-center p-2 text-xs font-mono ${
                              Math.abs(g - sensitivity.baseGrowth) < 1e-6
                                ? "text-[#00CFC1]"
                                : "text-gray-400"
                            }`}
                          >
                            {(g * 100).toFixed(1)}%
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sensitivity.rows.map((row, ri) => {
                        const isBaseRow = Math.abs(row.wacc - sensitivity.baseWacc) < 1e-6;
                        return (
                          <tr key={ri}>
                            <td
                              className={`p-2 text-xs font-mono font-medium ${
                                isBaseRow ? "text-[#00CFC1]" : "text-gray-300"
                              }`}
                            >
                              {(row.wacc * 100).toFixed(2)}%
                            </td>
                            {row.cells.map((cell, ci) => {
                              const isBaseCell =
                                isBaseRow &&
                                Math.abs(cell.growth - sensitivity.baseGrowth) < 1e-6;
                              return (
                                <td
                                  key={ci}
                                  className="text-center p-2 font-mono text-xs"
                                  style={{
                                    backgroundColor: heatColor(cell.upside),
                                    outline: isBaseCell ? "2px solid #00CFC1" : undefined,
                                  }}
                                  title={`Fair Value: ${dcf.currency} ${cell.intrinsic.toFixed(2)}`}
                                >
                                  <span
                                    className={
                                      cell.upside >= 0 ? "text-white" : "text-white"
                                    }
                                  >
                                    {cell.upside >= 0 ? "+" : ""}
                                    {cell.upside.toFixed(0)}%
                                  </span>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center gap-4 mt-4 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <TrendingUp className="h-3 w-3 text-[#00CFC1]" /> Unterbewertet (positives Upside)
                  </span>
                  <span className="flex items-center gap-1">
                    <TrendingDown className="h-3 w-3 text-red-500" /> Überbewertet
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-3">
                  ⚠️ Vereinfachte DCF-Annäherung auf Basis öffentlich verfügbarer Daten. Keine Anlageberatung.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
