import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, BarChart3, DollarSign, TrendingUp, Users, X, Mail, Calendar, Crown, Shield } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Breadcrumb } from "@/components/Breadcrumb";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

type UserRow = {
  id: number;
  name: string | null;
  email: string | null;
  createdAt: Date;
  hasPaid: number;
  role: "user" | "admin";
};

function UserDetailSheet({
  open,
  onClose,
  title,
  description,
  users,
  isLoading,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  users: UserRow[] | undefined;
  isLoading: boolean;
}) {
  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-[420px] sm:w-[520px] overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            {title}
          </SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
            Lade Benutzer…
          </div>
        )}

        {!isLoading && users && users.length === 0 && (
          <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
            Keine Benutzer gefunden.
          </div>
        )}

        {!isLoading && users && users.length > 0 && (
          <div className="space-y-3">
            {users.map((u) => (
              <div
                key={u.id}
                className="rounded-lg border border-border bg-card p-4 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium text-sm truncate">
                    {u.name ?? <span className="text-muted-foreground italic">Kein Name</span>}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {u.hasPaid === 1 && (
                      <Badge variant="default" className="bg-purple-600/20 text-purple-400 border-purple-500/30 text-xs px-1.5 py-0">
                        <Crown className="h-3 w-3 mr-1" />
                        Plus
                      </Badge>
                    )}
                    {u.role === "admin" && (
                      <Badge variant="outline" className="text-xs px-1.5 py-0">
                        <Shield className="h-3 w-3 mr-1" />
                        Admin
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{u.email ?? "—"}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    Registriert: {new Date(u.createdAt).toLocaleString("de-CH", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default function AdminKPIs() {
  const { data, isLoading, isError } = trpc.admin.getPlatformKpis.useQuery();

  // Which detail panel is open: "new" | "all" | "premium" | null
  const [openPanel, setOpenPanel] = useState<"new" | "all" | "premium" | null>(null);

  const { data: newUsersData, isLoading: newUsersLoading } = trpc.admin.getNewUsersDetail.useQuery(
    { days: 30 },
    { enabled: openPanel === "new" }
  );

  const { data: allUsersData, isLoading: allUsersLoading } = trpc.admin.getAllUsersDetail.useQuery(
    undefined,
    { enabled: openPanel === "all" || openPanel === "premium" }
  );

  const premiumUsers = allUsersData?.filter((u) => u.hasPaid === 1);

  const fmt = (v: number | undefined) =>
    isLoading ? "…" : typeof v === "number" ? v.toLocaleString("de-CH") : "—";

  const metrics = [
    {
      id: "all" as const,
      title: "Gesamt-Benutzer",
      value: fmt(data?.totalUsers),
      description: "Registrierte Benutzer",
      icon: Users,
      color: "text-blue-500",
      clickable: true,
    },
    {
      id: "new" as const,
      title: "Neue Benutzer (30 Tage)",
      value: fmt(data?.newUsers30d),
      description: "Neue Registrierungen",
      icon: TrendingUp,
      color: "text-green-500",
      clickable: true,
    },
    {
      id: "premium" as const,
      title: "Zahlende Benutzer",
      value: fmt(data?.premiumUsers),
      description: "Einmalzahlung getätigt",
      icon: DollarSign,
      color: "text-purple-500",
      clickable: true,
    },
    {
      id: null,
      title: "Gesamt-Portfolios",
      value: fmt(data?.totalPortfolios),
      description: "Erstellte Portfolios",
      icon: Activity,
      color: "text-cyan-500",
      clickable: false,
    },
  ];

  // Determine which users/loading state to show in the sheet
  const sheetUsers =
    openPanel === "new"
      ? newUsersData
      : openPanel === "premium"
      ? premiumUsers
      : allUsersData;
  const sheetLoading =
    openPanel === "new" ? newUsersLoading : allUsersLoading;
  const sheetTitle =
    openPanel === "new"
      ? "Neue Benutzer (30 Tage)"
      : openPanel === "premium"
      ? "Zahlende Benutzer"
      : "Alle Benutzer";
  const sheetDescription =
    openPanel === "new"
      ? "Benutzer, die sich in den letzten 30 Tagen registriert haben"
      : openPanel === "premium"
      ? "Benutzer mit aktiver Plus-Mitgliedschaft"
      : "Alle registrierten Benutzer der Plattform";

  return (
    <DashboardLayout>
      <Breadcrumb
        items={[
          { label: "Admin", href: "/admin" },
          { label: "KPI Übersicht", icon: <BarChart3 className="h-4 w-4" /> },
        ]}
      />
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Platform-KPIs</h1>
          <p className="text-muted-foreground mt-2">
            Übersicht über wichtige Metriken und Statistiken — klicken Sie auf eine Kachel für Details
          </p>
        </div>

        {isError && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3">
            <p className="text-sm text-red-500">
              Die Kennzahlen konnten nicht geladen werden. Bitte später erneut versuchen.
            </p>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {metrics.map((metric) => (
            <Card
              key={metric.title}
              className={metric.clickable ? "cursor-pointer hover:border-primary/50 transition-colors" : ""}
              onClick={() => metric.clickable && metric.id !== null && setOpenPanel(metric.id)}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {metric.title}
                </CardTitle>
                <metric.icon className={`h-4 w-4 ${metric.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums">{metric.value}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {metric.description}
                  {metric.clickable && (
                    <span className="ml-1 text-primary/60">· Details anzeigen</span>
                  )}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <UserDetailSheet
        open={openPanel !== null}
        onClose={() => setOpenPanel(null)}
        title={sheetTitle}
        description={sheetDescription}
        users={sheetUsers as unknown as UserRow[] | undefined}
        isLoading={sheetLoading ?? false}
      />
    </DashboardLayout>
  );
}
