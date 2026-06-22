// Positions section — switches between three views of the same data:
//   Tabelle       — sortable table, dense, classic numbers-first
//   Heatmap       — treemap, size = weight, color = YTD performance
//   Konstellation — packed circles, color = sector, halo = top performer
//
// All three render the same `holdings` array so the user can flip without
// losing context.

import * as React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PositionsTreemap } from "./PositionsTreemap";
import { PositionsConstellation } from "./PositionsConstellation";
import { Sparkline } from "./Sparkline";
import { formatCHF, formatPercent, SECTOR_COLOR } from "./format";
import type { Holding, SectorBucket } from "./types";

interface PositionsViewProps {
  holdings: Holding[];
  sectors: SectorBucket[];
}

type ViewMode = "tabelle" | "heatmap" | "konstellation";

const SUBTITLE: Record<ViewMode, string> = {
  tabelle: "Sortiert nach Gewicht",
  heatmap: "Größe = Gewicht · Farbe = YTD-Performance",
  konstellation: "Größe = Gewicht · Farbe = Sektor · Halo = starker YTD-Performer",
};

export function PositionsView({ holdings, sectors }: PositionsViewProps) {
  const [mode, setMode] = React.useState<ViewMode>("tabelle");
  // Treemap and constellation include CASH, table omits it for readability
  const tableRows = holdings.filter(h => h.ticker !== "CASH");

  return (
    <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30">
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-3">
        <div>
          <div className="text-sm font-semibold text-white">Positionen</div>
          <div className="text-[11px] text-gray-400">
            {tableRows.length} Positionen{mode !== "tabelle" ? " + Cash" : ""} · {SUBTITLE[mode]}
          </div>
        </div>
        <Tabs value={mode} onValueChange={v => setMode(v as ViewMode)}>
          <TabsList className="bg-[#0a0f1a] border border-white/10 h-8">
            <TabsTrigger value="tabelle" className="text-[11px] px-3 h-6 data-[state=active]:bg-[#00CFC1]/20 data-[state=active]:text-[#00CFC1]">
              Tabelle
            </TabsTrigger>
            <TabsTrigger value="heatmap" className="text-[11px] px-3 h-6 data-[state=active]:bg-[#00CFC1]/20 data-[state=active]:text-[#00CFC1]">
              Heatmap
            </TabsTrigger>
            <TabsTrigger value="konstellation" className="text-[11px] px-3 h-6 data-[state=active]:bg-[#00CFC1]/20 data-[state=active]:text-[#00CFC1]">
              Konstellation
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        {mode === "tabelle" && <PositionsTable holdings={tableRows} />}
        {mode === "heatmap" && (
          <PositionsTreemap
            holdings={holdings}
            width={1100}
            height={380}
            dark
            bgColor="#0a0f1a"
            textColor="#ffffff"
            mutedColor="#9ca3af"
            cardAltColor="#131b27"
          />
        )}
        {mode === "konstellation" && (
          <>
            <PositionsConstellation
              holdings={holdings}
              width={1100}
              height={420}
              dark
              textColor="#ffffff"
              positiveColor="#34d399"
            />
            <SectorLegend sectors={sectors} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function PositionsTable({ holdings }: { holdings: Holding[] }) {
  return (
    <>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b border-white/10">
            {["Ticker", "Name", "Sektor", "Gewicht", "Wert", "Heute", "YTD", "Trend"].map((h, i) => (
              <th
                key={h}
                className={`py-2 px-2 text-[10px] font-medium uppercase tracking-wider text-gray-400 ${
                  i >= 3 ? "text-right" : "text-left"
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {holdings.slice(0, 10).map(h => (
            <tr key={h.ticker} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
              <td className="py-2.5 px-2 text-white font-mono font-semibold">{h.ticker}</td>
              <td className="py-2.5 px-2 text-white">{h.name}</td>
              <td className="py-2.5 px-2">
                <span className="inline-flex items-center gap-1.5 text-gray-400 text-[11px]">
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: h.color ?? SECTOR_COLOR[h.sector] ?? "#888" }}
                  />
                  {h.sector}
                </span>
              </td>
              <td className="py-2.5 px-2 text-right text-white font-mono">{h.weight.toFixed(1)}%</td>
              <td className="py-2.5 px-2 text-right text-white font-mono">{formatCHF(h.value)}</td>
              <td className={`py-2.5 px-2 text-right font-mono ${h.change1d >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {formatPercent(h.change1d, 2)}
              </td>
              <td className={`py-2.5 px-2 text-right font-mono ${h.ytd >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {formatPercent(h.ytd, 1)}
              </td>
              <td className="py-2.5 px-2 text-right">
                <Sparkline
                  data={Array.from({ length: 16 }, (_, i) =>
                    50 + Math.sin(i * 0.5 + h.weight) * 8 + i * (h.ytd / 16),
                  )}
                  width={72}
                  height={22}
                  color={h.ytd >= 0 ? "#34d399" : "#f87171"}
                  fill={false}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {holdings.length > 10 && (
        <div className="mt-3 text-right text-[11px] text-[#00CFC1] cursor-pointer hover:underline">
          Alle {holdings.length} Holdings anzeigen →
        </div>
      )}
    </>
  );
}

function SectorLegend({ sectors }: { sectors: SectorBucket[] }) {
  return (
    <div className="flex flex-wrap justify-center gap-3 mt-3 text-[10px] text-gray-400 font-mono">
      {sectors.map(s => (
        <div key={s.name} className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
          <span>{s.name}</span>
        </div>
      ))}
    </div>
  );
}
