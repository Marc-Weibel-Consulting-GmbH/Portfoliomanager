import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, TrendingUp, DollarSign, Activity } from "lucide-react";

export default function AdminKPIs() {
  // Placeholder data - will be replaced with real data from backend
  const metrics = [
    {
      title: "Gesamt-Benutzer",
      value: "0",
      description: "Registrierte Benutzer",
      icon: Users,
      color: "text-blue-500",
    },
    {
      title: "Neue Benutzer (30 Tage)",
      value: "0",
      description: "Neue Registrierungen",
      icon: TrendingUp,
      color: "text-green-500",
    },
    {
      title: "Premium-Benutzer",
      value: "0",
      description: "Aktive Premium-Abos",
      icon: DollarSign,
      color: "text-purple-500",
    },
    {
      title: "Gesamt-Portfolios",
      value: "0",
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
                <div className="text-2xl font-bold">{metric.value}</div>
                <p className="text-xs text-muted-foreground">
                  {metric.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Detaillierte Statistiken</CardTitle>
            <CardDescription>
              Erweiterte Metriken und Analysen
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Diese Funktion wird in Kürze verfügbar sein.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
