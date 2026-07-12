import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Grid3x3, PieChart, Key, BarChart3, Eye, BrainCircuit, Activity, Wallet, Brain, RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const [refreshStatus, setRefreshStatus] = useState<{ success: boolean; message: string } | null>(null);
  const triggerRefresh = trpc.admin.triggerSignalScoreRefresh.useMutation({
    onSuccess: (data) => {
      setRefreshStatus({ success: data.success, message: data.message });
      if (data.success) {
        toast.success("Signal-Scores aktualisiert", { description: data.message });
      } else {
        toast.error("Fehler beim Aktualisieren", { description: data.message });
      }
    },
    onError: (err) => {
      setRefreshStatus({ success: false, message: err.message });
      toast.error("Fehler", { description: err.message });
    },
  });

  const adminSections = [
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
      title: "Aktienliste & Watchlist",
      description: "Aktien-Universum kuratieren (max. 200 Titel) — inkl. nicht-kuratierter Portfolio-Titel",
      path: "/admin/watchlist",
      color: "text-emerald-500",
    },
    {
      icon: BrainCircuit,
      title: "ML Trainer",
      description: "Gradient-Boosting Modell trainieren, Metriken & Historie",
      path: "/admin/ml-trainer",
      color: "text-violet-500",
    },
    {
      icon: Activity,
      title: "Signal-Performance",
      description: "Trefferquote, Rendite und Kalibrierung je Signal-Engine — Basis für Signalmix-Optimierung",
      path: "/admin/signal-performance",
      color: "text-teal-500",
    },
    {
      icon: Wallet,
      title: "Wikifolio Portfolio",
      description: "Portfoliopositionen aus Wikifolio abrufen, analysieren und in die Watchlist importieren",
      path: "/admin/wikifolio",
      color: "text-amber-500",
    },
    {
      icon: Brain,
      title: "Research & Multi-Agent",
      description: "Dokumente hochladen, KI-Analyse und Multi-Agent-System (Anthropic + Perplexity + Manus)",
      path: "/admin/research",
      color: "text-pink-500",
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

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-3 p-4 bg-muted/30 rounded-lg border">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Schnellaktionen</p>
            <p className="text-xs text-muted-foreground mt-0.5">Manuelle Trigger für geplante Jobs</p>
          </div>
          <div className="flex items-center gap-3">
            {refreshStatus && (
              <div className={`flex items-center gap-1.5 text-xs ${
                refreshStatus.success ? "text-green-500" : "text-red-500"
              }`}>
                {refreshStatus.success
                  ? <CheckCircle2 className="h-4 w-4" />
                  : <XCircle className="h-4 w-4" />}
                <span className="max-w-xs truncate">{refreshStatus.message}</span>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setRefreshStatus(null);
                triggerRefresh.mutate();
              }}
              disabled={triggerRefresh.isPending}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${triggerRefresh.isPending ? "animate-spin" : ""}`} />
              {triggerRefresh.isPending ? "Aktualisiert..." : "Scores jetzt aktualisieren"}
            </Button>
          </div>
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
