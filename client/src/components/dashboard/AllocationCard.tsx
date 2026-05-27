// Allocation card — donut chart with sector breakdown.
// Per IA-Optimierung spec: title "Allokation", subtitle "Sektor · Region",
// center shows "100% Allokation", legend on right.

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { SectorBucket } from "./types";

interface AllocationCardProps {
  sectors: SectorBucket[];
}

export function AllocationCard({ sectors }: AllocationCardProps) {
  return (
    <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30">
      <CardHeader className="pb-2 space-y-0">
        <div className="text-sm font-semibold text-white">Allokation</div>
        <div className="text-[11px] text-gray-400">Sektor · Region</div>
      </CardHeader>
      <CardContent className="flex items-center gap-4">
        <div className="relative w-[140px] h-[140px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0a0f1a",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 6,
                  fontSize: 11,
                }}
                formatter={(value: number, name: string) => [`${value.toFixed(1)}%`, name]}
              />
              <Pie
                data={sectors}
                dataKey="weight"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={42}
                outerRadius={62}
                paddingAngle={2}
                stroke="none"
              >
                {sectors.map(s => (
                  <Cell key={s.name} fill={s.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <div className="text-sm font-semibold text-white font-mono leading-none">100%</div>
            <div className="text-[9px] uppercase tracking-wider text-gray-400 mt-1">Allokation</div>
          </div>
        </div>

        <div className="flex-1 flex flex-col gap-1.5">
          {sectors.slice(0, 6).map(s => (
            <div key={s.name} className="flex items-center gap-2 text-[11px]">
              <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: s.color }} />
              <span className="flex-1 text-white truncate">{s.name}</span>
              <span className="font-mono text-gray-400">{s.weight.toFixed(1)}%</span>
            </div>
          ))}
          {sectors.length > 6 && (
            <div className="text-[10px] text-gray-500 mt-0.5">+ {sectors.length - 6} weitere</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
