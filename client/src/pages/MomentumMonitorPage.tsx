import { useMemo } from "react";
import type React from "react";
import { Link, useLocation } from "wouter";
import { Activity, AlertTriangle, ArrowRight, BarChart3, DatabaseZap, ShieldCheck, TrendingUp } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";

const pct = (value: number | null | undefined) => value == null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
const trendLabel: Record<string, string> = { intakt: "Intakt", konsolidierung: "Konsolidierung", ueberhitzt: "Überhitzt", trendbruch: "Trendbruch" };
const trendClass: Record<string, string> = { intakt: "text-emerald-300 border-emerald-400/30 bg-emerald-400/10", konsolidierung: "text-amber-300 border-amber-400/30 bg-amber-400/10", ueberhitzt: "text-orange-300 border-orange-400/30 bg-orange-400/10", trendbruch: "text-red-300 border-red-400/30 bg-red-400/10" };

export default function MomentumMonitorPage() {
  const [, setLocation] = useLocation();
  const { data, isLoading, error } = trpc.momentumMonitor.overview.useQuery({ limit: 40 });
  const monitor = data as any;
  const qualified = monitor?.summary?.qualifiedCount ?? 0;
  const leaders = monitor?.leaders ?? [];
  const sectors = monitor?.sectors ?? [];
  const overheatCount = useMemo(() => leaders.filter((row: any) => row.trendState === "ueberhitzt").length, [leaders]);

  return <DashboardLayout>
    <div className="min-h-full bg-[#0b0f19] text-white">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-2xl border border-[#00CFC1]/20 bg-gradient-to-br from-[#102b31] via-[#121b2d] to-[#0d1320] p-6">
          <div className="absolute -right-14 -top-14 h-52 w-52 rounded-full bg-[#00CFC1]/10 blur-3xl" />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div><div className="mb-2 flex items-center gap-2 text-[#00CFC1]"><Activity className="h-5 w-5" /><span className="text-xs font-semibold uppercase tracking-[0.2em]">Research-Monitor</span></div>
              <h1 className="text-2xl font-bold tracking-tight">Momentum & relative Stärke</h1>
              <p className="mt-2 max-w-3xl text-sm text-gray-300">6-/12-Monats-Kursmomentum, Peer-Rang und Trendzustand als <strong>Forschungs-Kontext</strong>. Kein Kaufsignal und keine automatische Umschichtung.</p>
            </div>
            {monitor?.available && <div className="rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-sm"><p className="text-gray-400">Datenstand</p><p className="font-mono font-semibold">{monitor.snapshotDate} <span className="text-xs font-normal text-gray-500">(Schlusskurse je Titel)</span></p></div>}
          </div>
        </section>

        {isLoading && <Card className="border-white/10 bg-[#121826]"><CardContent className="py-12 text-center text-gray-400">Momentum-Monitor wird geladen…</CardContent></Card>}
        {error && <Card className="border-red-400/30 bg-red-400/5"><CardContent className="py-6 text-red-200">Abruf fehlgeschlagen: {error.message}</CardContent></Card>}
        {!isLoading && !error && !monitor?.available && <Card className="border-amber-400/30 bg-amber-400/5"><CardContent className="py-8 text-center"><DatabaseZap className="mx-auto mb-3 h-7 w-7 text-amber-300" /><p className="font-medium text-amber-100">Noch kein qualifizierter Momentum-Snapshot</p><p className="mt-1 text-sm text-gray-400">Der tägliche, rein analytische Lauf legt die erste Auswertung nach dem Deployment an.</p></CardContent></Card>}

        {monitor?.available && <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label="Qualifizierte Aktien" value={qualified} detail={`${monitor.summary.dataGapCount} Datenlücken transparent gesperrt`} icon={<ShieldCheck className="h-4 w-4 text-[#00CFC1]" />} />
            <Kpi label="Sektoren" value={sectors.length} detail="Rang nur innerhalb der vorhandenen, qualifizierten Peergruppe" icon={<BarChart3 className="h-4 w-4 text-blue-300" />} />
            <Kpi label="Überhitzt in Auswahl" value={overheatCount} detail="kein Verkaufssignal – Hinweis für Eintrittsdisziplin" icon={<TrendingUp className="h-4 w-4 text-orange-300" />} />
            <Kpi label="Crash-Gate" value={monitor.summary.crashRiskCount} detail="Volatilitäts-Rebound mit negativer relativer Stärke" icon={<AlertTriangle className="h-4 w-4 text-amber-300" />} />
          </section>

          <Card className="border-white/10 bg-[#121826]">
            <CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle className="text-base">Stärkste qualifizierte Preis-Momentumreihen</CardTitle><CardDescription>Composite: Mittel aus 6- und 12-Monats-Kursrendite; ohne Cashdividenden. Relative Stärke nur mit stichtagsgleicher Benchmarkreihe.</CardDescription></div><Badge variant="outline" className="border-[#00CFC1]/30 bg-[#00CFC1]/10 text-[#00CFC1]">Research, keine Handlungsempfehlung</Badge></div></CardHeader>
            <CardContent className="overflow-x-auto p-0"><table className="min-w-[920px] w-full text-sm"><thead className="border-y border-white/10 bg-black/20 text-left text-[11px] uppercase tracking-wide text-gray-500"><tr><th className="px-5 py-3">Aktie</th><th className="px-3 py-3 text-right">6M</th><th className="px-3 py-3 text-right">12M</th><th className="px-3 py-3 text-right">Rel. 12M</th><th className="px-3 py-3 text-right">Sektor-Rang</th><th className="px-3 py-3">Trend</th><th className="px-3 py-3">Hinweis</th><th className="px-5 py-3" /></tr></thead><tbody>{leaders.map((row: any) => <tr key={row.ticker} className="border-b border-white/5 hover:bg-white/[0.03] cursor-pointer" onClick={() => setLocation(`/aktien/${row.ticker}`)}><td className="px-5 py-3"><p className="font-mono font-semibold text-[#00CFC1]">{row.ticker}</p><p className="max-w-[260px] truncate text-xs text-gray-400">{row.companyName}</p></td><td className="px-3 py-3 text-right font-mono">{pct(row.return6mPct)}</td><td className="px-3 py-3 text-right font-mono">{pct(row.return12mPct)}</td><td className={`px-3 py-3 text-right font-mono ${row.relative12mPct != null && row.relative12mPct >= 0 ? "text-emerald-300" : "text-red-300"}`}>{pct(row.relative12mPct)}</td><td className="px-3 py-3 text-right font-mono">{row.sectorPercentile == null ? "—" : `${row.sectorPercentile}.`}</td><td className="px-3 py-3"><Badge variant="outline" className={trendClass[row.trendState] || "border-white/10 text-gray-300"}>{trendLabel[row.trendState] || "—"}</Badge></td><td className="px-3 py-3 text-xs text-gray-400">{row.crashRiskActive ? "Crash-Gate" : row.sector || "—"}</td><td className="px-5 py-3"><ArrowRight className="h-4 w-4 text-gray-500" /></td></tr>)}</tbody></table></CardContent>
          </Card>

          <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <Card className="border-white/10 bg-[#121826]"><CardHeader><CardTitle className="text-base">Sektorbreite</CardTitle><CardDescription>Median der qualifizierten Titel, nicht kapitalgewichtet und nicht als Sektorprognose.</CardDescription></CardHeader><CardContent className="space-y-2">{sectors.map((row: any) => <div key={row.sector} className="grid grid-cols-[1.4fr_repeat(3,0.8fr)] gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-xs"><span className="truncate text-gray-200">{row.sector}<span className="ml-1 text-gray-500">({row.qualifiedCount})</span></span><span className="text-right font-mono">{pct(row.median6mPct)}</span><span className="text-right font-mono">{pct(row.median12mPct)}</span><span className="text-right font-mono text-[#00CFC1]">{pct(row.medianCompositePct)}</span></div>)}</CardContent></Card>
            <Card className="border-amber-400/20 bg-amber-400/[0.035]"><CardHeader><CardTitle className="flex items-center gap-2 text-base text-amber-100"><AlertTriangle className="h-4 w-4" />Methodik & Grenzen</CardTitle></CardHeader><CardContent className="space-y-3 text-sm text-gray-300"><p><strong>Preisrendite, nicht Gesamtrendite:</strong> Die zugrundeliegenden Reihen sind separat splitbereinigt; Cashdividenden werden nicht reinvestiert.</p><p><strong>Keine Vermischung:</strong> Relative Stärke wird nur bei gleicher Handelslinie, Währung/Quote und gleichem Schlusskursstichtag angezeigt.</p><p><strong>Datenlücken bleiben Lücken:</strong>  {monitor.summary.dataGapCount} Titel mit fehlender oder gesperrter Reihe werden nicht gerankt. Corporate-Action-Sperren gelten auch hier.</p><p><strong>Crash-Gate:</strong> markiert instabile Rebounds; es überschreibt keine bestehenden Signale und löst nie Trades aus.</p><Link href="/aktien" className="inline-flex items-center gap-1 text-[#00CFC1] hover:underline">Zur Aktienauswahl <ArrowRight className="h-3.5 w-3.5" /></Link></CardContent></Card>
          </section>
        </>}
      </div>
    </div>
  </DashboardLayout>;
}

function Kpi({ label, value, detail, icon }: { label: string; value: number; detail: string; icon: React.ReactNode }) {
  return <Card className="border-white/10 bg-[#121826]"><CardContent className="p-4"><div className="flex items-center justify-between"><p className="text-xs text-gray-400">{label}</p>{icon}</div><p className="mt-2 text-2xl font-semibold font-mono">{value}</p><p className="mt-1 min-h-8 text-[11px] leading-4 text-gray-500">{detail}</p></CardContent></Card>;
}
