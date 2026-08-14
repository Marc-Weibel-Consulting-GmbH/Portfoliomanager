/**
 * Sektor-Rotation (RRG) — US-Sektor-ETFs gegen den S&P 500.
 *
 * X: RS-Ratio (relative Stärke über 6 Monate, >100 = stärker als der Markt).
 * Y: RS-Momentum (Veränderung der Stärke über 1 Monat, >100 = zunehmend).
 * Kleine Punkte: die Spur der letzten Wochen. Reine Anzeige — die Rotation
 * fliesst bewusst NICHT ins Signal oder in Gewichte; der Server zeichnet den
 * Stand täglich auf (`rrg_verlauf`), damit zuerst eine messbare Vorwärtsreihe
 * entsteht.
 */
import { trpc } from "@/lib/trpc";
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ReferenceLine, ReferenceArea,
  ResponsiveContainer, Cell, LabelList,
} from "recharts";

const QUADRANT_FARBEN: Record<string, string> = {
  fuehrend: "#4ade80",
  nachlassend: "#eab308",
  zurueckliegend: "#ef4444",
  aufholend: "#60a5fa",
};

/** Kurzlabel im Diagramm: der ETF-Ticker ohne Suffix (XLK statt Technology). */
const kurz = (etf: string) => etf.replace(/\.US$/, "");

export function RrgKarte() {
  const { data, isLoading } = trpc.marketRegime.getRrg.useQuery(undefined, {
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });

  const sektoren = data?.sektoren ?? [];
  const spurPunkte = sektoren.flatMap((s) =>
    s.spur.slice(0, -1).map((p) => ({ ...p, sektor: s.sektor, etf: s.etf })));
  const aktuell = sektoren.map((s) => ({
    rsRatio: s.rsRatio, rsMomentum: s.rsMomentum,
    sektor: s.sektor, etf: s.etf, quadrant: s.quadrant, quadrantLabel: s.quadrantLabel,
  }));

  // Achsenbereich um die Daten, 100/100 immer im Bild.
  const alleX = [...spurPunkte, ...aktuell].map((p) => p.rsRatio).concat(100);
  const alleY = [...spurPunkte, ...aktuell].map((p) => p.rsMomentum).concat(100);
  const xMin = Math.floor(Math.min(...alleX) - 1);
  const xMax = Math.ceil(Math.max(...alleX) + 1);
  const yMin = Math.floor(Math.min(...alleY) - 1);
  const yMax = Math.ceil(Math.max(...alleY) + 1);

  return (
    <div className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border border-[#00CFC1]/20 rounded-lg p-5">
      <div className="flex items-baseline justify-between flex-wrap gap-2 mb-1">
        <h3 className="text-sm font-semibold text-white">Sektor-Rotation gegen den S&P 500</h3>
        {data?.stand && <span className="text-[10px] text-gray-500">Stand {data.stand} · Wochendaten</span>}
      </div>
      <p className="text-[11px] text-gray-500 mb-4">
        Rechts von der Mittellinie: stärker als der Markt über 6 Monate. Oben: die Stärke nimmt
        seit einem Monat zu. Kleine Punkte zeigen den Weg der letzten Wochen. Reine Beobachtung —
        fliesst nicht ins Signal, wird aber täglich aufgezeichnet.
      </p>

      {isLoading ? (
        <div className="h-80 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-[#00CFC1] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : sektoren.length === 0 ? (
        <div className="h-40 flex items-center justify-center">
          <p className="text-gray-500 text-sm">Keine Sektor-Daten verfügbar</p>
        </div>
      ) : (
        <>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                {/* Quadranten als Kulisse */}
                <ReferenceArea x1={100} x2={xMax} y1={100} y2={yMax} fill="#4ade80" fillOpacity={0.05} />
                <ReferenceArea x1={100} x2={xMax} y1={yMin} y2={100} fill="#eab308" fillOpacity={0.05} />
                <ReferenceArea x1={xMin} x2={100} y1={yMin} y2={100} fill="#ef4444" fillOpacity={0.05} />
                <ReferenceArea x1={xMin} x2={100} y1={100} y2={yMax} fill="#60a5fa" fillOpacity={0.05} />
                <XAxis
                  type="number" dataKey="rsRatio" domain={[xMin, xMax]} stroke="#444" fontSize={10}
                  tickLine={false} axisLine={false}
                  label={{ value: "RS-Ratio (6 Monate)", position: "insideBottom", offset: -5, fill: "#6b7280", fontSize: 10 }}
                />
                <YAxis
                  type="number" dataKey="rsMomentum" domain={[yMin, yMax]} stroke="#444" fontSize={10}
                  tickLine={false} axisLine={false} width={40}
                  label={{ value: "RS-Momentum (1 Monat)", angle: -90, position: "insideLeft", fill: "#6b7280", fontSize: 10 }}
                />
                <ZAxis range={[60, 60]} />
                <ReferenceLine x={100} stroke="#4b5563" strokeDasharray="4 4" />
                <ReferenceLine y={100} stroke="#4b5563" strokeDasharray="4 4" />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  contentStyle={{ backgroundColor: "#1a1f2e", border: "1px solid #00CFC1", borderRadius: 6, fontSize: 12 }}
                  labelStyle={{ color: "#fff" }}
                  formatter={(value: number) => value.toFixed(1)}
                  content={({ payload }) => {
                    const p: any = payload?.[0]?.payload;
                    if (!p) return null;
                    return (
                      <div className="bg-[#1a1f2e] border border-[#00CFC1]/40 rounded px-3 py-2 text-xs">
                        <p className="text-white font-semibold">{p.sektor} ({kurz(p.etf)})</p>
                        <p className="text-gray-400 font-mono">
                          Ratio {p.rsRatio.toFixed(1)} · Momentum {p.rsMomentum.toFixed(1)}
                        </p>
                        {p.datum && <p className="text-gray-600">{p.datum}</p>}
                      </div>
                    );
                  }}
                />
                {/* Spur (ältere Wochenpunkte, dezent) */}
                <Scatter data={spurPunkte} fill="#6b7280" fillOpacity={0.35} shape="circle" />
                {/* Aktueller Stand, nach Quadrant eingefärbt und beschriftet */}
                <Scatter data={aktuell} shape="circle">
                  {aktuell.map((p) => (
                    <Cell key={p.etf} fill={QUADRANT_FARBEN[p.quadrant] ?? "#9ca3af"} />
                  ))}
                  <LabelList dataKey="etf" position="top" formatter={kurz}
                    style={{ fill: "#d1d5db", fontSize: 10 }} />
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          <div className="overflow-x-auto mt-3">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 text-left">
                  <th className="py-1 pr-3 font-medium">Sektor</th>
                  <th className="py-1 pr-3 font-medium">ETF</th>
                  <th className="py-1 pr-3 text-right font-medium">RS-Ratio</th>
                  <th className="py-1 pr-3 text-right font-medium">RS-Momentum</th>
                  <th className="py-1 font-medium">Quadrant</th>
                </tr>
              </thead>
              <tbody>
                {[...sektoren].sort((a, b) => b.rsRatio - a.rsRatio).map((s) => (
                  <tr key={s.etf} className="border-t border-white/5">
                    <td className="py-1.5 pr-3 text-gray-300">{s.sektor}</td>
                    <td className="py-1.5 pr-3 font-mono text-gray-500">{kurz(s.etf)}</td>
                    <td className="py-1.5 pr-3 text-right font-mono text-gray-300">{s.rsRatio.toFixed(1)}</td>
                    <td className="py-1.5 pr-3 text-right font-mono text-gray-300">{s.rsMomentum.toFixed(1)}</td>
                    <td className="py-1.5">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                        style={{ color: QUADRANT_FARBEN[s.quadrant], backgroundColor: `${QUADRANT_FARBEN[s.quadrant]}1a` }}>
                        {s.quadrantLabel}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {(data?.fehlend?.length ?? 0) > 0 && (
            <p className="text-[10px] text-amber-400 mt-2">
              Ohne Daten: {data!.fehlend.join(", ")} — Kursreihe bei EODHD nicht verfügbar.
            </p>
          )}
        </>
      )}
    </div>
  );
}
