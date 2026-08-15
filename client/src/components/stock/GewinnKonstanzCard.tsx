import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { History } from "lucide-react";

/**
 * Gewinn-Konstanz & Verlust-Ratio — beschreibende Halteperioden-Kennzahlen
 * über 10 Jahre (alle Kauf/Verkauf-Paare auf Monatsbasis, inkl. Dividenden).
 * Reine Beschreibung der Vergangenheit: fliesst bewusst NICHT in Score oder
 * Signal ein (STRATEGIE_DREI_SCORES.md, Regel 1). Self-contained wie
 * BubbleRiskCard: rendert nichts, solange keine Daten da sind.
 */
export default function GewinnKonstanzCard({ ticker }: { ticker: string }) {
  const { data, isLoading } = trpc.analytics.gewinnKonstanz.useQuery(
    { ticker },
    { enabled: !!ticker, staleTime: 24 * 60 * 60 * 1000, retry: false },
  );

  if (isLoading || !data) return null;

  const konstanzFarbe =
    data.gewinnKonstanz == null ? "text-gray-500"
    : data.gewinnKonstanz >= 70 ? "text-[#00CFC1]"
    : data.gewinnKonstanz >= 50 ? "text-white"
    : "text-red-400";
  const ratioFarbe =
    data.verlustRatio == null ? "text-gray-500"
    : data.verlustRatio <= 1 ? "text-[#00CFC1]"
    : data.verlustRatio <= 3 ? "text-white"
    : "text-red-400";

  return (
    <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/20">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <History className="w-4 h-4 text-[#00CFC1]" />
          <h3 className="text-sm font-semibold text-white">Verlässlichkeit über 10 Jahre</h3>
        </div>
        {data.gewinnKonstanz == null ? (
          <p className="text-xs text-gray-400">{data.hinweis}</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div
                className="bg-[#1a1f2e] rounded-lg p-3 border border-white/10"
                title="Anteil aller durchgespielten Kauf/Verkauf-Zeitpunkte der letzten 10 Jahre, die mit Gewinn endeten (Monatsbasis, inkl. Dividenden)."
              >
                <div className="text-xs text-gray-400 mb-1">Gewinn-Konstanz</div>
                <div className={`text-xl font-bold font-mono ${konstanzFarbe}`}>
                  {data.gewinnKonstanz.toFixed(0)}%
                </div>
                <div className="text-[11px] text-gray-500 mt-1">der Halteperioden mit Gewinn</div>
              </div>
              <div
                className="bg-[#1a1f2e] rounded-lg p-3 border border-white/10"
                title={`Verlustwahrscheinlichkeit (${data.verlustWahrscheinlichkeit?.toFixed(0)}%) × zeitgewichteter mittlerer Verlust (${data.mittlererVerlust?.toFixed(1)}%). Nur Verluste zählen als Risiko — Aufwärtsschwankung nicht. Je tiefer, desto besser.`}
              >
                <div className="text-xs text-gray-400 mb-1">Verlust-Ratio</div>
                <div className={`text-xl font-bold font-mono ${ratioFarbe}`}>
                  {data.verlustRatio?.toFixed(2)}
                </div>
                <div className="text-[11px] text-gray-500 mt-1">
                  {data.verlustWahrscheinlichkeit?.toFixed(0)}% Verlustrisiko × Ø −{data.mittlererVerlust?.toFixed(1)}%
                </div>
              </div>
            </div>
            <p className="text-[11px] text-gray-500 mt-3" title={data.hinweis}>
              Beschreibende Kennzahl aus {data.szenarien.toLocaleString("de-CH")} Halteperioden-Szenarien
              ({data.von?.slice(0, 7)} bis {data.bis?.slice(0, 7)}), inkl. Dividenden — Blick zurück,
              keine Prognose; fliesst nicht in Score oder Signal ein.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
