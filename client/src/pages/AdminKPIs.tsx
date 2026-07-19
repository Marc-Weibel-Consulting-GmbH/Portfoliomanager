import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, TrendingUp, DollarSign, Activity } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function AdminKPIs() {
  // L-18: echte Zahlen aus der DB statt hartkodierter Platzhalter-Nullen.
  const { data, isLoading, isError } = trpc.admin.getPlatformKpis.useQuery();

  const fmt = (v: number | undefined) =>
    isLoading ? "…" : typeof v === "number" ? v.toLocaleString("de-CH") : "—";

  const metrics = [
    {
      title: "Gesamt-Benutzer",
      value: fmt(data?.totalUsers),
      description: "Registrierte Benutzer",
      icon: Users,
      color: "text-blue-500",
    },
    {
      title: "Neue Benutzer (30 Tage)",
      value: fmt(data?.newUsers30d),
      description: "Neue Registrierungen",
      icon: TrendingUp,
      color: "text-green-500",
    },
    {
      title: "Zahlende Benutzer",
      value: fmt(data?.premiumUsers),
      description: "Einmalzahlung getätigt",
      icon: DollarSign,
      color: "text-purple-500",
    },
    {
      title: "Gesamt-Portfolios",
      value: fmt(data?.totalPortfolios),
      description: "Erstellte Portfolios",
      icon: Activity,
      color: "text-cyan-500",
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Platform-KPIs</h1>
          <p className="text-muted-foreground mt-2">
            Übersicht über wichtige Metriken und Statistiken
          </p>
        </div>

        {isError && (
          <Card className="border-red-500/40">
            <CardContent className="py-4">
              <p className="text-sm text-red-500">
                Die Kennzahlen konnten nicht geladen werden. Bitte später erneut versuchen.
              </p>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {metrics.map((metric) => (
            <Card key={metric.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {metric.title}
                </CardTitle>
                <metric.icon className={`h-4 w-4 ${metric.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums">{metric.value}</div>
                <p className="text-xs text-muted-foreground">
                  {metric.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
