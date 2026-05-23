import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Database, Grid3x3, PieChart, Key, BarChart3, Eye } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";

export default function AdminDashboard() {
  const [, setLocation] = useLocation();

  const adminSections = [
    {
      icon: Database,
      title: "Aktien-Verwaltung",
      description: "Verwalten Sie die Aktienliste und Stammdaten",
      path: "/admin/stocks",
      color: "text-blue-500",
    },
    {
      icon: Grid3x3,
      title: "Kategorien-Verwaltung",
      description: "Kategorien erstellen und bearbeiten",
      path: "/admin/categories",
      color: "text-green-500",
    },
    {
      icon: PieChart,
      title: "Sektoren-Verwaltung",
      description: "Sektoren erstellen und bearbeiten",
      path: "/admin/sectors",
      color: "text-purple-500",
    },
    {
      icon: Key,
      title: "Secrets-Verwaltung",
      description: "API-Keys und Secrets verwalten",
      path: "/admin/secrets",
      color: "text-orange-500",
    },
    {
      icon: BarChart3,
      title: "Platform-KPIs",
      description: "Benutzer-Statistiken und Metriken",
      path: "/admin/kpis",
      color: "text-cyan-500",
    },
    {
      icon: Eye,
      title: "Watchlist",
      description: "Aktien-Universum verwalten (max. 200 Titel)",
      path: "/admin/watchlist",
      color: "text-emerald-500",
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Zentrale Verwaltung der Platform
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {adminSections.map((section) => (
            <Card
              key={section.path}
              className="hover:shadow-lg transition-shadow cursor-pointer group"
              onClick={() => setLocation(section.path)}
            >
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-lg bg-muted group-hover:bg-accent transition-colors`}>
                    <section.icon className={`h-6 w-6 ${section.color}`} />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-lg">{section.title}</CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm">
                  {section.description}
                </CardDescription>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-4 w-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLocation(section.path);
                  }}
                >
                  Öffnen →
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
