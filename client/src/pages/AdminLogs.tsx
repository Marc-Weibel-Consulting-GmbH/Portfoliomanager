import { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, AlertTriangle, Info, RefreshCw, Trash2, FileText } from "lucide-react";
import { useLocation } from "wouter";
import { Breadcrumb } from "@/components/Breadcrumb";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { toast } from "sonner";

export default function AdminLogs() {
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedLevel, setSelectedLevel] = useState<"error" | "warn" | "info" | "all">("all");
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Redirect if not admin
  if (isAuthenticated && user?.role !== "admin") {
    setLocation("/");
    return null;
  }

  const utils = trpc.useUtils();
  const { data: logs = [], isLoading, refetch } = trpc.logs.list.useQuery(
    selectedLevel === "all" ? {} : { level: selectedLevel },
    { refetchInterval: autoRefresh ? 5000 : false }
  );
  const { data: stats } = trpc.logs.stats.useQuery(undefined, {
    refetchInterval: autoRefresh ? 5000 : false,
  });
  const clearLogsMutation = trpc.logs.clear.useMutation({
    onSuccess: () => {
      toast.success("Alle Logs gelöscht");
      setIsClearDialogOpen(false);
      utils.logs.list.invalidate();
      utils.logs.stats.invalidate();
    },
    onError: (error) => {
      setIsClearDialogOpen(false);
      toast.error(`Fehler: ${error.message}`);
    },
  });

  // U-08: Löschbestätigung über AlertDialog statt Browser-confirm()
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);

  const handleClearLogs = () => {
    setIsClearDialogOpen(true);
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case "warn":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case "info":
        return <Info className="h-4 w-4 text-blue-500" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getLevelBadgeVariant = (level: string): "destructive" | "default" | "secondary" => {
    switch (level) {
      case "error":
        return "destructive";
      case "warn":
        return "default";
      default:
        return "secondary";
    }
  };

  return (
    <div className="container max-w-7xl py-8">
      <Breadcrumb
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Server Logs", icon: <FileText className="h-4 w-4" /> },
        ]}
      />

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <FileText className="h-8 w-8 text-primary" />
            Server Logs
          </h1>
          <p className="text-muted-foreground mt-2">
            Echtzeit-Überwachung von Server-Fehlern und Warnungen
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={autoRefresh ? "default" : "outline"}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? "animate-spin" : ""}`} />
            Auto-Refresh {autoRefresh ? "An" : "Aus"}
          </Button>
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Neu laden
          </Button>
          <Button
            variant="destructive"
            onClick={handleClearLogs}
            disabled={clearLogsMutation.isPending || logs.length === 0}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Logs löschen
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Gesamt</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">Log-Einträge</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-500" />
                Fehler
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">{stats.errors}</div>
              <p className="text-xs text-muted-foreground">Kritische Fehler</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                Warnungen
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-500">{stats.warnings}</div>
              <p className="text-xs text-muted-foreground">Warnmeldungen</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Neuester Log</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm font-medium">
                {stats.newestLog
                  ? new Date(stats.newestLog).toLocaleTimeString("de-CH")
                  : "Keine Logs"}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.newestLog
                  ? new Date(stats.newestLog).toLocaleDateString("de-CH")
                  : "-"}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filter Buttons */}
      <div className="flex gap-2 mb-6">
        <Button
          variant={selectedLevel === "all" ? "default" : "outline"}
          onClick={() => setSelectedLevel("all")}
        >
          Alle ({stats?.total || 0})
        </Button>
        <Button
          variant={selectedLevel === "error" ? "default" : "outline"}
          onClick={() => setSelectedLevel("error")}
        >
          <AlertCircle className="h-4 w-4 mr-2" />
          Fehler ({stats?.errors || 0})
        </Button>
        <Button
          variant={selectedLevel === "warn" ? "default" : "outline"}
          onClick={() => setSelectedLevel("warn")}
        >
          <AlertTriangle className="h-4 w-4 mr-2" />
          Warnungen ({stats?.warnings || 0})
        </Button>
      </div>

      {/* Logs List */}
      {isLoading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Lade Logs...</p>
          </CardContent>
        </Card>
      ) : logs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {selectedLevel === "all"
                ? "Keine Logs vorhanden"
                : `Keine ${selectedLevel === "error" ? "Fehler" : "Warnungen"} vorhanden`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => (
            <Card key={log.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {getLevelIcon(log.level)}
                    <Badge variant={getLevelBadgeVariant(log.level)}>
                      {log.level.toUpperCase()}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {new Date(log.timestamp).toLocaleString("de-CH")}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <pre className="text-sm bg-muted p-3 rounded-md overflow-x-auto whitespace-pre-wrap break-words">
                  {log.message}
                </pre>
                {log.stack && (
                  <details className="mt-3">
                    <summary className="text-sm text-muted-foreground cursor-pointer hover:text-foreground">
                      Stack Trace anzeigen
                    </summary>
                    <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto mt-2 whitespace-pre-wrap break-words">
                      {log.stack}
                    </pre>
                  </details>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Löschbestätigung (U-08) */}
      <ConfirmDialog
        open={isClearDialogOpen}
        onOpenChange={setIsClearDialogOpen}
        title="Alle Logs löschen?"
        description={`Alle ${logs.length} Server-Log-Einträge werden dauerhaft gelöscht.`}
        confirmLabel="Alle Logs löschen"
        onConfirm={() => clearLogsMutation.mutate()}
        isPending={clearLogsMutation.isPending}
      />
    </div>
  );
}
