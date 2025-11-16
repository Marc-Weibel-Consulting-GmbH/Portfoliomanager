import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Plus, Bell, BellOff, Trash2, TrendingUp, TrendingDown, Activity } from "lucide-react";
import { toast } from "sonner";

export default function PriceAlerts() {
  const [, setLocation] = useLocation();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newAlert, setNewAlert] = useState({
    ticker: "",
    alertType: "above_price" as "above_price" | "below_price" | "percent_change",
    targetPrice: "",
    percentChange: "",
  });

  const utils = trpc.useUtils();

  // Fetch all alerts
  const { data: alerts = [], isLoading } = trpc.priceAlerts.list.useQuery();

  // Fetch all stocks for ticker autocomplete
  const { data: allStocks = [] } = trpc.stocks.getAll.useQuery();

  // Create alert mutation
  const createMutation = trpc.priceAlerts.create.useMutation({
    onSuccess: () => {
      toast.success("Alert erfolgreich erstellt");
      utils.priceAlerts.list.invalidate();
      setShowCreateDialog(false);
      setNewAlert({
        ticker: "",
        alertType: "above_price",
        targetPrice: "",
        percentChange: "",
      });
    },
    onError: (error) => {
      toast.error(`Fehler: ${error.message}`);
    },
  });

  // Update alert mutation
  const updateMutation = trpc.priceAlerts.update.useMutation({
    onSuccess: () => {
      toast.success("Alert aktualisiert");
      utils.priceAlerts.list.invalidate();
    },
    onError: (error) => {
      toast.error(`Fehler: ${error.message}`);
    },
  });

  // Delete alert mutation
  const deleteMutation = trpc.priceAlerts.delete.useMutation({
    onSuccess: () => {
      toast.success("Alert gelöscht");
      utils.priceAlerts.list.invalidate();
    },
    onError: (error) => {
      toast.error(`Fehler: ${error.message}`);
    },
  });

  const handleCreateAlert = () => {
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

    createMutation.mutate(newAlert);
  };

  const toggleAlert = (id: number, currentStatus: number) => {
    updateMutation.mutate({
      id,
      isActive: currentStatus ? 0 : 1,
    });
  };

  const deleteAlert = (id: number) => {
    if (confirm("Alert wirklich löschen?")) {
      deleteMutation.mutate({ id });
    }
  };

  const getAlertIcon = (alertType: string) => {
    switch (alertType) {
      case "above_price":
        return <TrendingUp className="w-5 h-5 text-green-400" />;
      case "below_price":
        return <TrendingDown className="w-5 h-5 text-red-400" />;
      case "percent_change":
        return <Activity className="w-5 h-5 text-blue-400" />;
      default:
        return <Bell className="w-5 h-5 text-slate-400" />;
    }
  };

  const getAlertDescription = (alert: any) => {
    const stock = allStocks.find((s: any) => s.ticker === alert.ticker);
    const currentPrice = stock?.currentPrice ? parseFloat(stock.currentPrice) : null;

    switch (alert.alertType) {
      case "above_price":
        return (
          <div>
            <p className="text-slate-300">
              Benachrichtigung wenn Preis über{" "}
              <span className="font-bold text-green-400">{alert.targetPrice}</span> steigt
            </p>
            {currentPrice && (
              <p className="text-sm text-slate-400 mt-1">
                Aktueller Preis: {currentPrice.toFixed(2)}
              </p>
            )}
          </div>
        );
      case "below_price":
        return (
          <div>
            <p className="text-slate-300">
              Benachrichtigung wenn Preis unter{" "}
              <span className="font-bold text-red-400">{alert.targetPrice}</span> fällt
            </p>
            {currentPrice && (
              <p className="text-sm text-slate-400 mt-1">
                Aktueller Preis: {currentPrice.toFixed(2)}
              </p>
            )}
          </div>
        );
      case "percent_change":
        return (
          <div>
            <p className="text-slate-300">
              Benachrichtigung bei Änderung von{" "}
              <span className="font-bold text-blue-400">±{alert.percentChange}%</span>
            </p>
            {alert.lastTriggered && (
              <p className="text-sm text-slate-400 mt-1">
                Zuletzt ausgelöst: {new Date(alert.lastTriggered).toLocaleDateString("de-CH")}
              </p>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 p-8">
        <div className="max-w-5xl mx-auto">
          <p className="text-slate-400 text-center">Lade Alerts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button
            onClick={() => setLocation("/dashboard")}
            variant="ghost"
            className="mb-4 text-slate-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Zurück zur Übersicht
          </Button>

          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">Preis-Alerts</h1>
              <p className="text-slate-400">
                Erhalten Sie Benachrichtigungen bei Preisänderungen
              </p>
            </div>

            <Button
              onClick={() => setShowCreateDialog(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Neuer Alert
            </Button>
          </div>
        </div>

        {/* Alerts List */}
        {alerts.length === 0 ? (
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="py-12 text-center">
              <Bell className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400 text-lg mb-2">Keine Alerts vorhanden</p>
              <p className="text-slate-500 text-sm mb-6">
                Erstellen Sie Ihren ersten Alert, um bei Preisänderungen benachrichtigt zu werden
              </p>
              <Button
                onClick={() => setShowCreateDialog(true)}
                variant="outline"
                className="text-blue-400 border-blue-400 hover:bg-blue-400/10"
              >
                <Plus className="w-4 h-4 mr-2" />
                Alert erstellen
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {alerts.map((alert: any) => {
              const stock = allStocks.find((s: any) => s.ticker === alert.ticker);
              
              return (
                <Card
                  key={alert.id}
                  className={`bg-slate-800 border-slate-700 ${
                    !alert.isActive ? "opacity-50" : ""
                  }`}
                >
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="flex items-start gap-3 flex-1">
                        {getAlertIcon(alert.alertType)}
                        <div className="flex-1">
                          <CardTitle className="text-white text-xl mb-1">
                            {alert.ticker}
                            {stock && (
                              <span className="text-slate-400 text-sm font-normal ml-2">
                                {stock.companyName}
                              </span>
                            )}
                          </CardTitle>
                          {getAlertDescription(alert)}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Active Toggle */}
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={Boolean(alert.isActive)}
                            onCheckedChange={() => toggleAlert(alert.id, alert.isActive)}
                          />
                          {alert.isActive ? (
                            <Bell className="w-4 h-4 text-green-400" />
                          ) : (
                            <BellOff className="w-4 h-4 text-slate-500" />
                          )}
                        </div>

                        {/* Delete Button */}
                        <Button
                          onClick={() => deleteAlert(alert.id)}
                          variant="ghost"
                          size="sm"
                          className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        )}

        {/* Create Alert Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="bg-slate-800 text-white border-slate-700">
            <DialogHeader>
              <DialogTitle>Neuer Preis-Alert</DialogTitle>
              <DialogDescription className="text-slate-400">
                Erstellen Sie einen Alert für Preisänderungen
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Ticker Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Ticker</label>
                <Input
                  value={newAlert.ticker}
                  onChange={(e) =>
                    setNewAlert({ ...newAlert, ticker: e.target.value.toUpperCase() })
                  }
                  placeholder="z.B. AAPL, NESN.SW"
                  className="bg-slate-900 border-slate-700 text-white"
                />
              </div>

              {/* Alert Type */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Alert-Typ</label>
                <Select
                  value={newAlert.alertType}
                  onValueChange={(value: any) => setNewAlert({ ...newAlert, alertType: value })}
                >
                  <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700">
                    <SelectItem value="above_price">Preis über Zielwert</SelectItem>
                    <SelectItem value="below_price">Preis unter Zielwert</SelectItem>
                    <SelectItem value="percent_change">Prozentuale Änderung</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Conditional Inputs */}
              {(newAlert.alertType === "above_price" || newAlert.alertType === "below_price") && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Zielpreis</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={newAlert.targetPrice}
                    onChange={(e) => setNewAlert({ ...newAlert, targetPrice: e.target.value })}
                    placeholder="z.B. 150.00"
                    className="bg-slate-900 border-slate-700 text-white"
                  />
                </div>
              )}

              {newAlert.alertType === "percent_change" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">
                    Prozentänderung (%)
                  </label>
                  <Input
                    type="number"
                    step="0.1"
                    value={newAlert.percentChange}
                    onChange={(e) => setNewAlert({ ...newAlert, percentChange: e.target.value })}
                    placeholder="z.B. 5"
                    className="bg-slate-900 border-slate-700 text-white"
                  />
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                onClick={() => setShowCreateDialog(false)}
                variant="outline"
                className="text-slate-300 border-slate-600 hover:bg-slate-700"
              >
                Abbrechen
              </Button>
              <Button
                onClick={handleCreateAlert}
                disabled={createMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {createMutation.isPending ? "Erstelle..." : "Alert erstellen"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
