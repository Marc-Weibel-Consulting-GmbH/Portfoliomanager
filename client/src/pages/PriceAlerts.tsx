import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Bell, Mail, MessageSquare, Edit, Trash2, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type AlertType = "above_price" | "below_price" | "percent_change";
type NotificationMethod = "email" | "whatsapp" | "both";
type AlertStatus = "active" | "triggered" | "disabled";

interface PriceAlert {
  id: number;
  userId: number;
  ticker: string;
  alertType: AlertType;
  targetPrice: string | null;
  percentChange: string | null;
  notificationMethod: NotificationMethod;
  status: AlertStatus;
  isActive: number;
  lastTriggered: string | null;
  triggeredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function PriceAlerts() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingAlert, setEditingAlert] = useState<PriceAlert | null>(null);
  // U-08: Löschbestätigung über AlertDialog statt Browser-confirm()
  const [deletingAlert, setDeletingAlert] = useState<PriceAlert | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tickerFilter, setTickerFilter] = useState<string>("all");
  
  const [newAlert, setNewAlert] = useState({
    ticker: "",
    alertType: "above_price" as AlertType,
    targetPrice: "",
    percentChange: "",
    notificationMethod: "email" as NotificationMethod,
    emailEnabled: true,
    whatsappEnabled: false,
  });

  const utils = trpc.useUtils();

  // Fetch all alerts
  const { data: alerts = [], isLoading } = trpc.priceAlerts.list.useQuery();

  // Fetch all stocks for ticker autocomplete
  const { data: allStocks = [] } = trpc.stocks.getAll.useQuery();

  // Create alert mutation
  const createMutation = trpc.priceAlerts.create.useMutation({
    onSuccess: () => {
      toast.success("Alarm erfolgreich erstellt");
      utils.priceAlerts.list.invalidate();
      setShowCreateDialog(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(`Fehler: ${error.message}`);
    },
  });

  // Update alert mutation
  const updateMutation = trpc.priceAlerts.update.useMutation({
    onSuccess: () => {
      toast.success("Alarm aktualisiert");
      utils.priceAlerts.list.invalidate();
      setEditingAlert(null);
      setShowCreateDialog(false);
    },
    onError: (error) => {
      toast.error(`Fehler: ${error.message}`);
    },
  });

  // Delete alert mutation
  const deleteMutation = trpc.priceAlerts.delete.useMutation({
    onSuccess: () => {
      toast.success("Alarm gelöscht");
      setDeletingAlert(null);
      utils.priceAlerts.list.invalidate();
    },
    onError: (error) => {
      toast.error(`Fehler: ${error.message}`);
    },
  });

  const resetForm = () => {
    setNewAlert({
      ticker: "",
      alertType: "above_price",
      targetPrice: "",
      percentChange: "",
      notificationMethod: "email",
      emailEnabled: true,
      whatsappEnabled: false,
    });
    setEditingAlert(null);
  };

  const handleCreateOrUpdateAlert = () => {
    if (!newAlert.ticker) {
      toast.error("Bitte Ticker eingeben");
      return;
    }

    if (
      (newAlert.alertType === "above_price" || newAlert.alertType === "below_price") &&
      !newAlert.targetPrice
    ) {
      toast.error("Bitte Zielpreis eingeben");
      return;
    }

    if (newAlert.alertType === "percent_change" && !newAlert.percentChange) {
      toast.error("Bitte Prozentänderung eingeben");
      return;
    }

    // Determine notification method based on checkboxes
    let notificationMethod: NotificationMethod = "email";
    if (newAlert.emailEnabled && newAlert.whatsappEnabled) {
      notificationMethod = "both";
    } else if (newAlert.whatsappEnabled) {
      notificationMethod = "whatsapp";
    }

    if (editingAlert) {
      updateMutation.mutate({
        id: editingAlert.id,
        ...newAlert,
        notificationMethod,
      });
    } else {
      createMutation.mutate({
        ...newAlert,
        notificationMethod,
      });
    }
  };

  // U-17: eigener Mutation-Hook für den Schalter, damit ein spezifischer
  // Erfolgs-Toast erscheint (statt des generischen «Alarm aktualisiert»,
  // der zudem den Dialog-State zurücksetzt).
  const toggleMutation = trpc.priceAlerts.update.useMutation({
    onSuccess: (_data, variables) => {
      const activated = !!(variables && variables.isActive);
      toast.success(activated ? "Alarm aktiviert" : "Alarm deaktiviert");
      utils.priceAlerts.list.invalidate();
    },
    onError: (error) => {
      toast.error(`Fehler: ${error.message}`);
    },
  });

  const toggleAlert = (id: number, currentStatus: number) => {
    toggleMutation.mutate({
      id,
      isActive: currentStatus ? 0 : 1,
    });
  };

  const deleteAlert = (alert: PriceAlert) => {
    setDeletingAlert(alert);
  };

  const openEditDialog = (alert: PriceAlert) => {
    setEditingAlert(alert);
    setNewAlert({
      ticker: alert.ticker,
      alertType: alert.alertType,
      targetPrice: alert.targetPrice || "",
      percentChange: alert.percentChange || "",
      notificationMethod: alert.notificationMethod,
      emailEnabled: alert.notificationMethod === "email" || alert.notificationMethod === "both",
      whatsappEnabled: alert.notificationMethod === "whatsapp" || alert.notificationMethod === "both",
    });
    setShowCreateDialog(true);
  };

  // Get unique tickers for filter
  const uniqueTickers = useMemo(() => {
    const tickers = new Set((alerts as PriceAlert[]).map((a) => a.ticker));
    return Array.from(tickers).sort();
  }, [alerts]);

  // Filter alerts
  const filteredAlerts = useMemo(() => {
    return (alerts as PriceAlert[]).filter((alert) => {
      const matchesStatus = statusFilter === "all" || 
        (statusFilter === "active" && alert.status === "active") ||
        (statusFilter === "triggered" && alert.status === "triggered") ||
        (statusFilter === "disabled" && alert.status === "disabled");
      
      const matchesTicker = tickerFilter === "all" || alert.ticker === tickerFilter;
      
      return matchesStatus && matchesTicker;
    });
  }, [alerts, statusFilter, tickerFilter]);

  // Calculate summary stats
  const stats = useMemo(() => {
    const typedAlerts = alerts as PriceAlert[];
    const active = typedAlerts.filter((a) => a.status === "active").length;
    const triggeredToday = typedAlerts.filter((a) => {
      if (!a.triggeredAt) return false;
      const today = new Date();
      const triggered = new Date(a.triggeredAt);
      return triggered.toDateString() === today.toDateString();
    }).length;
    const disabled = typedAlerts.filter((a) => a.status === "disabled").length;
    
    return { active, triggeredToday, disabled };
  }, [alerts]);

  const getTriggerTypeLabel = (alertType: AlertType, targetPrice?: string | null, percentChange?: string | null) => {
    switch (alertType) {
      case "above_price":
        return `Über CHF ${targetPrice}`;
      case "below_price":
        return `Unter CHF ${targetPrice}`;
      case "percent_change":
        return `Änderung ${percentChange}%`;
      default:
        return "";
    }
  };

  const getTriggerTypeBadgeClass = (alertType: AlertType) => {
    switch (alertType) {
      case "above_price":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "below_price":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      case "percent_change":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      default:
        return "bg-slate-500/20 text-slate-400 border-slate-500/30";
    }
  };

  const getStatusBadge = (status: AlertStatus) => {
    switch (status) {
      case "active":
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">● Aktiv</span>;
      case "triggered":
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">● Ausgelöst</span>;
      case "disabled":
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-500/20 text-slate-400 border border-slate-500/30">● Deaktiviert</span>;
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="p-8">
          <p className="text-slate-400 text-center">Lade Alarme...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-8 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Preisalarme</h1>
            <p className="text-slate-400">
              Erhalte Benachrichtigungen bei Preisänderungen
            </p>
          </div>

          <Button
            onClick={() => {
              resetForm();
              setShowCreateDialog(true);
            }}
            className="bg-teal-500 hover:bg-teal-600 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Neuer Alarm
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-4">
          <div className="w-48">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="all">Alle</SelectItem>
                <SelectItem value="active">Aktiv</SelectItem>
                <SelectItem value="triggered">Ausgelöst</SelectItem>
                <SelectItem value="disabled">Deaktiviert</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="w-48">
            <Select value={tickerFilter} onValueChange={setTickerFilter}>
              <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                <SelectValue placeholder="Ticker (Alle)" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="all">Alle</SelectItem>
                {uniqueTickers.map((ticker) => (
                  <SelectItem key={ticker} value={ticker}>
                    {ticker}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm mb-1">Aktive Alarme</p>
                  <p className="text-3xl font-bold text-white">{stats.active}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-teal-500/20 flex items-center justify-center">
                  <Bell className="w-6 h-6 text-teal-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm mb-1">Ausgelöst (heute)</p>
                  <p className="text-3xl font-bold text-white">{stats.triggeredToday}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
                  <Bell className="w-6 h-6 text-yellow-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm mb-1">Deaktiviert</p>
                  <p className="text-3xl font-bold text-white">{stats.disabled}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-slate-500/20 flex items-center justify-center">
                  <Bell className="w-6 h-6 text-slate-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Alerts Table */}
        {filteredAlerts.length === 0 ? (
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="py-12 text-center">
              <Bell className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400 text-lg mb-2">
                {alerts.length === 0 ? "Keine Alarme vorhanden" : "Keine Alarme gefunden"}
              </p>
              <p className="text-slate-500 text-sm mb-6">
                {alerts.length === 0 
                  ? "Erstelle deinen ersten Alarm, um bei Preisänderungen benachrichtigt zu werden"
                  : "Versuche einen anderen Filter"}
              </p>
              {alerts.length === 0 && (
                <Button
                  onClick={() => {
                    resetForm();
                    setShowCreateDialog(true);
                  }}
                  variant="outline"
                  className="text-teal-400 border-teal-400 hover:bg-teal-400/10"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Alarm erstellen
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-slate-800 border-slate-700">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left p-4 text-slate-400 font-medium text-sm">Ticker</th>
                    <th className="text-left p-4 text-slate-400 font-medium text-sm">Trigger-Typ</th>
                    <th className="text-left p-4 text-slate-400 font-medium text-sm">Zielpreis</th>
                    <th className="text-left p-4 text-slate-400 font-medium text-sm">Aktueller Preis</th>
                    <th className="text-left p-4 text-slate-400 font-medium text-sm">Status</th>
                    <th className="text-left p-4 text-slate-400 font-medium text-sm">Benachrichtigung</th>
                    <th className="text-left p-4 text-slate-400 font-medium text-sm">Erstellt am</th>
                    <th className="text-left p-4 text-slate-400 font-medium text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(filteredAlerts as PriceAlert[]).map((alert) => {
                    const stock = allStocks.find((s: any) => s.ticker === alert.ticker);
                    const currentPrice = stock?.currentPrice ? parseFloat(stock.currentPrice) : null;
                    
                    return (
                      <tr key={alert.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            {stock?.logoUrl && (
                              <img 
                                src={stock.logoUrl} 
                                alt={alert.ticker}
                                className="w-8 h-8 rounded-full"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            )}
                            <div>
                              <p className="text-white font-medium">{alert.ticker}</p>
                              {stock && (
                                <p className="text-slate-400 text-sm">{stock.companyName}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getTriggerTypeBadgeClass(alert.alertType)}`}>
                            {getTriggerTypeLabel(alert.alertType, alert.targetPrice, alert.percentChange)}
                          </span>
                        </td>
                        <td className="p-4 text-white">
                          {alert.alertType === "percent_change" 
                            ? `${alert.percentChange}%`
                            : `CHF ${alert.targetPrice}`}
                        </td>
                        <td className="p-4 text-white">
                          {currentPrice ? `CHF ${currentPrice.toFixed(2)}` : "-"}
                        </td>
                        <td className="p-4">
                          {getStatusBadge(alert.status)}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            {(alert.notificationMethod === "email" || alert.notificationMethod === "both") && (
                              <Mail className="w-4 h-4 text-slate-400" />
                            )}
                            {(alert.notificationMethod === "whatsapp" || alert.notificationMethod === "both") && (
                              <MessageSquare className="w-4 h-4 text-slate-400" />
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-slate-400 text-sm">
                          {new Date(alert.createdAt).toLocaleDateString("de-CH")}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <Button
                              onClick={() => openEditDialog(alert)}
                              variant="ghost"
                              size="sm"
                              className="text-slate-400 hover:text-white"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              onClick={() => deleteAlert(alert)}
                              variant="ghost"
                              size="sm"
                              className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                            <Switch
                              checked={Boolean(alert.isActive)}
                              onCheckedChange={() => toggleAlert(alert.id, alert.isActive)}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Create/Edit Alert Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={(open) => {
          setShowCreateDialog(open);
          if (!open) {
            resetForm();
          }
        }}>
          <DialogContent className="bg-slate-800 text-white border-slate-700 max-w-md">
            <DialogHeader>
              <DialogTitle>{editingAlert ? "Alarm bearbeiten" : "Neuer Alarm"}</DialogTitle>
              <DialogDescription className="text-slate-400">
                {editingAlert ? "Bearbeite die Alarm-Einstellungen" : "Erstelle einen Alarm für Preisänderungen"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Ticker Selection */}
              <div className="space-y-2">
                <Label htmlFor="ticker" className="text-white">Ticker *</Label>
                <Select
                  value={newAlert.ticker}
                  onValueChange={(value) => setNewAlert({ ...newAlert, ticker: value })}
                >
                  <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                    <SelectValue placeholder="Ticker auswählen" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 max-h-60">
                    {allStocks.map((stock: any) => (
                      <SelectItem key={stock.ticker} value={stock.ticker}>
                        {stock.ticker} - {stock.companyName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Alert Type */}
              <div className="space-y-2">
                <Label htmlFor="alertType" className="text-white">Trigger-Typ *</Label>
                <Select
                  value={newAlert.alertType}
                  onValueChange={(value: AlertType) => setNewAlert({ ...newAlert, alertType: value })}
                >
                  <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="above_price">Über CHF X</SelectItem>
                    <SelectItem value="below_price">Unter CHF X</SelectItem>
                    <SelectItem value="percent_change">Änderung +/- X%</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Target Price or Percent Change */}
              {(newAlert.alertType === "above_price" || newAlert.alertType === "below_price") && (
                <div className="space-y-2">
                  <Label htmlFor="targetPrice" className="text-white">Zielpreis (CHF) *</Label>
                  <Input
                    id="targetPrice"
                    type="number"
                    step="0.01"
                    placeholder="z.B. 150.00"
                    value={newAlert.targetPrice}
                    onChange={(e) => setNewAlert({ ...newAlert, targetPrice: e.target.value })}
                    className="bg-slate-900 border-slate-700 text-white"
                  />
                </div>
              )}

              {newAlert.alertType === "percent_change" && (
                <div className="space-y-2">
                  <Label htmlFor="percentChange" className="text-white">Prozentänderung (%) *</Label>
                  <Input
                    id="percentChange"
                    type="number"
                    step="0.1"
                    placeholder="z.B. 5"
                    value={newAlert.percentChange}
                    onChange={(e) => setNewAlert({ ...newAlert, percentChange: e.target.value })}
                    className="bg-slate-900 border-slate-700 text-white"
                  />
                </div>
              )}

              {/* Notification Channels */}
              <div className="space-y-2">
                <Label className="text-white">Benachrichtigungskanäle *</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="email"
                      checked={newAlert.emailEnabled}
                      onCheckedChange={(checked) => 
                        setNewAlert({ ...newAlert, emailEnabled: checked as boolean })
                      }
                    />
                    <label
                      htmlFor="email"
                      className="text-sm text-slate-300 cursor-pointer flex items-center gap-2"
                    >
                      <Mail className="w-4 h-4" />
                      Email
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="whatsapp"
                      checked={newAlert.whatsappEnabled}
                      onCheckedChange={(checked) => 
                        setNewAlert({ ...newAlert, whatsappEnabled: checked as boolean })
                      }
                    />
                    <label
                      htmlFor="whatsapp"
                      className="text-sm text-slate-300 cursor-pointer flex items-center gap-2"
                    >
                      <MessageSquare className="w-4 h-4" />
                      WhatsApp
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateDialog(false);
                  resetForm();
                }}
                className="border-slate-700 text-slate-300 hover:bg-slate-700"
              >
                Abbrechen
              </Button>
              <Button
                onClick={handleCreateOrUpdateAlert}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="bg-teal-500 hover:bg-teal-600 text-white"
              >
                {editingAlert ? "Aktualisieren" : "Erstellen"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog (U-08) */}
        <ConfirmDialog
          open={deletingAlert !== null}
          onOpenChange={(open) => { if (!open) setDeletingAlert(null); }}
          title={`Alarm für ${deletingAlert?.ticker ?? ''} löschen?`}
          description="Der Preisalarm wird dauerhaft entfernt. Sie erhalten dafür keine Benachrichtigungen mehr."
          confirmLabel="Alarm löschen"
          onConfirm={() => { if (deletingAlert) deleteMutation.mutate({ id: deletingAlert.id }); }}
          isPending={deleteMutation.isPending}
        />
      </div>
    </DashboardLayout>
  );
}
