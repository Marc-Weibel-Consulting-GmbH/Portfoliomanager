// Performance vs. benchmarks — recharts AreaChart for the portfolio
// series, two Line overlays for SMI and MSCI World. Range switcher uses
// shadcn Tabs (segmented control style).

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ComposedChart,
  Area,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { PerformanceTimeseries, RangeKey } from "./types";
import { formatPercent } from "./format";

interface PerformanceChartProps {
  data: PerformanceTimeseries;
  range: RangeKey;
  onRangeChange: (range: RangeKey) => void;
}

const RANGES: RangeKey[] = ["1T", "1M", "YTD", "1J", "3J", "5J", "Max"];

export function PerformanceChart({ data, range, onRangeChange }: PerformanceChartProps) {
  return (
    <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <div className="text-sm font-semibold text-white">Performance vs. Benchmarks</div>
          <div className="text-[11px] text-gray-400">Portfolio · SMI · MSCI World</div>
        </div>
        <Tabs value={range} onValueChange={v => onRangeChange(v as RangeKey)}>
          <TabsList className="bg-[#0a0f1a] border border-white/10 h-8">
            {RANGES.map(r => (
              <TabsTrigger
                key={r}
                value={r}
                className="text-[11px] px-2.5 h-6 data-[state=active]:bg-[#00CFC1]/20 data-[state=active]:text-[#00CFC1]"
              >
                {r}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data.points} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <defs>
                <linearGradient id="portfolioFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00CFC1" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#00CFC1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "#6b7280", fontFamily: "ui-monospace, monospace" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#6b7280", fontFamily: "ui-monospace, monospace" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={v => formatPercent(v, 0)}
                width={40}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0a0f1a",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8,
                  fontSize: 11,
                  fontFamily: "ui-monospace, monospace",
                }}
                labelStyle={{ color: "#fff" }}
                formatter={(value: number, name: string) => [formatPercent(value, 2), name]}
              />
              <Legend
                iconType="line"
                wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                formatter={(name) => <span style={{ color: "#9ca3af" }}>{name}</span>}
              />
              <Area
                type="monotone"
                dataKey="portfolio"
                name="Portfolio"
                stroke="#00CFC1"
                strokeWidth={2.5}
                fill="url(#portfolioFill)"
                dot={false}
                activeDot={{ r: 4, stroke: "#00CFC1", strokeWidth: 2, fill: "#0a0f1a" }}
              />
              <Line
                type="monotone"
                dataKey="smi"
                name="SMI"
                stroke="#9ca3af"
                strokeWidth={1.4}
                strokeDasharray="4 4"
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="msci"
                name="MSCI World"
                stroke="#A78BFA"
                strokeWidth={1.4}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
