// Region allocation as a stack of horizontal progress bars. Lighter than
// another donut next to the sector one and easier to scan with only 4-5
// regions.

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { RegionBucket } from "./types";

interface RegionCardProps {
  regions: RegionBucket[];
}

export function RegionCard({ regions }: RegionCardProps) {
  return (
    <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30">
      <CardHeader className="pb-3 space-y-0">
        <div className="text-sm font-semibold text-white">Geografische Verteilung</div>
        <div className="text-[11px] text-gray-400">Nach Region</div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {regions.map(r => (
          <div key={r.name}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-white">{r.name}</span>
              <span className="font-mono text-gray-400">{r.weight.toFixed(1)}%</span>
            </div>
            <div className="h-1.5 bg-[#0a0f1a] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${r.weight}%`, background: r.color }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
