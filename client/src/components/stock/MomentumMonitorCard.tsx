import { Activity, AlertTriangle, ArrowUpRight, BarChart3, ShieldAlert } from "lucide-react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";

function pct(value: number | null | undefined) {
  return value == null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

const trendConfig: Record<string, { label: string; className: string }> = {
  intakt: { label: "Trend intakt", className: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" },
  konsolidierung: { label: "Konsolidierung", className: "border-amber-400/30 bg-amber-400/10 text-amber-300" },
  ueberhitzt: { label: "Überhitzt", className: "border-orange-400/30 bg-orange-400/10 text-orange-300" },
  trendbruch: { label: "Trendbruch", className: "border-red-400/30 bg-red-400/10 text-red-300" },
};

export default function MomentumMonitorCard({ ticker }: { ticker: string }) {
  const { data, isLoading } = trpc.momentumMonitor.detail.useQuery({ ticker });
  if (isLoading) return <Card className="border-white/10 bg-[#121826]"><CardContent className="py-5 text-sm text-gray-400">Momentum-Kontext wird geladen…</CardContent></Card>;
  if (!data) return null;
  if (data.dataQuality !== "qualified") {
    return (
      <Card className="border-amber-400/25 bg-amber-400/[0.04]">
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm text-amber-200"><ShieldAlert className="h-4 w-4" />Momentum-Monitor: Datenlücke</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-xs text-gray-300">
          <p>{data.dataQualityReason || "Für die direkte splitbereinigte Preisreihe ist derzeit kein belastbares Momentum-Ranking möglich."}</p>
          <p className="text-gray-500">Kein Ersatzwert und keine Signaländerung; getrennt vom Kauf-/Verkaufssignal.</p>
        </CardContent>
      </Card>
    );
  }
  const trend = trendConfig[data.trendState || ""] ?? { label: "Beobachten", className: "border-white/10 bg-white/5 text-gray-300" };
  return (
    <Card className="border-[#00CFC1]/20 bg-gradient-to-br from-[#102329] to-[#111827]">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm text-white"><Activity className="h-4 w-4 text-[#00CFC1]" />Momentum-Monitor</CardTitle>
          <Badge variant="outline" className={trend.className}>{trend.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="rounded-md bg-black/20 px-2.5 py-2"><p className="text-[10px] text-gray-500">6 Monate</p><p className="font-mono text-sm text-white">{pct(data.return6mPct)}</p></div>
          <div className="rounded-md bg-black/20 px-2.5 py-2"><p className="text-[10px] text-gray-500">12 Monate</p><p className="font-mono text-sm text-white">{pct(data.return12mPct)}</p></div>
          <div className="rounded-md bg-black/20 px-2.5 py-2"><p className="text-[10px] text-gray-500">Relativ 12M</p><p className={`font-mono text-sm ${data.relative12mPct != null && data.relative12mPct >= 0 ? "text-emerald-300" : "text-red-300"}`}>{pct(data.relative12mPct)}</p></div>
          <div className="rounded-md bg-black/20 px-2.5 py-2"><p className="text-[10px] text-gray-500">Sektor-Rang</p><p className="font-mono text-sm text-white">{data.sectorPercentile == null ? "—" : `${data.sectorPercentile}. Perz.`}</p></div>
        </div>
        {data.crashRiskActive && <div className="flex gap-2 rounded-md border border-orange-400/30 bg-orange-400/10 p-2 text-xs text-orange-100"><AlertTriangle className="h-4 w-4 shrink-0" /><span>{data.crashRiskReason || "Momentum-Crash-Risiko: Rebound nach hoher Volatilität."}</span></div>}
        <div className="flex flex-wrap justify-between gap-2 text-[11px] text-gray-500"><span>Stichtag {data.priceAsOfDate ?? "—"} · {data.coverageDays} Handelstage</span><Link href="/momentum" className="inline-flex items-center gap-1 text-[#00CFC1] hover:underline"><BarChart3 className="h-3.5 w-3.5" />Universum <ArrowUpRight className="h-3.5 w-3.5" /></Link></div>
      </CardContent>
    </Card>
  );
}
