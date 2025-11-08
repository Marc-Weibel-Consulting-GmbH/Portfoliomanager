import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Bell, Plus, Trash2, Mail, MessageSquare } from "lucide-react";
import { toast } from "sonner";

export function AlertManagement() {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    ticker: '',
    metricName: 'sharpeRatio',
    condition: 'below' as 'above' | 'below' | 'change',
    threshold: '',
    notificationMethod: 'email' as 'email' | 'whatsapp' | 'both',
  });

  const { data: rules, isLoading, refetch } = trpc.alerts.getMyRules.useQuery();
  const { data: history } = trpc.alerts.getMyHistory.useQuery({ limit: 10 });
  const createMutation = trpc.alerts.createRule.useMutation({
    onSuccess: () => {
      toast.success('Alert-Regel erstellt!');
      setShowCreateForm(false);
      setFormData({
        ticker: '',
        metricName: 'sharpeRatio',
        condition: 'below',
        threshold: '',
        notificationMethod: 'email',
      });
      refetch();
    },
    onError: (error) => {
      toast.error(`Fehler: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      ticker: formData.ticker || undefined,
      metricName: formData.metricName,
      condition: formData.condition,
      threshold: formData.threshold,
      notificationMethod: formData.notificationMethod,
    });
  };

  const metricLabels: Record<string, string> = {
    sharpeRatio: 'Sharpe Ratio',
    peRatio: 'KGV (PE)',
    dividendYield: 'Dividende (%)',
    beta: 'Beta',
    volatility: 'Volatilität (%)',
  };

  const conditionLabels: Record<string, string> = {
    above: 'Über',
    below: 'Unter',
    change: 'Änderung >',
  };

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">Metriken-Alerts</h3>
        </div>
        <Button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Neue Regel
        </Button>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white text-sm">Neue Alert-Regel erstellen</CardTitle>
            <CardDescription className="text-slate-400 text-xs">
              Erhalte Benachrichtigungen bei Metriken-Änderungen
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="ticker" className="text-slate-300 text-xs">
                    Ticker (optional, leer = alle Aktien)
                  </Label>
                  <Input
                    id="ticker"
                    value={formData.ticker}
                    onChange={(e) => setFormData({ ...formData, ticker: e.target.value })}
                    placeholder="z.B. AAPL"
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>

                <div>
                  <Label htmlFor="metricName" className="text-slate-300 text-xs">
                    Metrik
                  </Label>
                  <Select
                    value={formData.metricName}
                    onValueChange={(value) => setFormData({ ...formData, metricName: value })}
                  >
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(metricLabels).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="condition" className="text-slate-300 text-xs">
                    Bedingung
                  </Label>
                  <Select
                    value={formData.condition}
                    onValueChange={(value: any) => setFormData({ ...formData, condition: value })}
                  >
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="above">Über Schwellenwert</SelectItem>
                      <SelectItem value="below">Unter Schwellenwert</SelectItem>
                      <SelectItem value="change">Änderung % (absolut)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="threshold" className="text-slate-300 text-xs">
                    Schwellenwert
                  </Label>
                  <Input
                    id="threshold"
                    type="number"
                    step="0.01"
                    value={formData.threshold}
                    onChange={(e) => setFormData({ ...formData, threshold: e.target.value })}
                    placeholder="z.B. 1.0"
                    required
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>

                <div>
                  <Label htmlFor="notificationMethod" className="text-slate-300 text-xs">
                    Benachrichtigung
                  </Label>
                  <Select
                    value={formData.notificationMethod}
                    onValueChange={(value: any) => setFormData({ ...formData, notificationMethod: value })}
                  >
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="both">Beide</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={createMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
                  {createMutation.isPending ? 'Erstelle...' : 'Erstellen'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateForm(false)}
                  className="bg-transparent border-slate-600 text-slate-300"
                >
                  Abbrechen
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Active Rules */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white text-sm">Aktive Regeln ({rules?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {!rules || rules.length === 0 ? (
            <p className="text-slate-400 text-sm">Keine Regeln konfiguriert</p>
          ) : (
            <div className="space-y-2">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-center justify-between p-3 bg-slate-700 rounded-lg"
                >
                  <div className="flex-1">
                    <div className="text-white text-sm font-medium">
                      {rule.ticker || 'Alle Aktien'}: {metricLabels[rule.metricName] || rule.metricName}
                    </div>
                    <div className="text-slate-400 text-xs">
                      {conditionLabels[rule.condition]} {rule.threshold}
                      {' • '}
                      {rule.notificationMethod === 'email' && <Mail className="inline w-3 h-3" />}
                      {rule.notificationMethod === 'whatsapp' && <MessageSquare className="inline w-3 h-3" />}
                      {rule.notificationMethod === 'both' && (
                        <>
                          <Mail className="inline w-3 h-3" /> + <MessageSquare className="inline w-3 h-3" />
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded ${rule.isActive ? 'bg-green-900/30 text-green-400' : 'bg-slate-600 text-slate-400'}`}>
                      {rule.isActive ? 'Aktiv' : 'Inaktiv'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Alerts */}
      {history && history.length > 0 && (
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white text-sm">Letzte Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {history.map((alert) => (
                <div
                  key={alert.id}
                  className="p-3 bg-slate-700 rounded-lg"
                >
                  <div className="text-white text-sm">{alert.message}</div>
                  <div className="text-slate-400 text-xs mt-1">
                    {new Date(alert.triggeredAt).toLocaleString('de-DE')}
                    {' • '}
                    {alert.notificationSent ? '✅ Gesendet' : '⏳ Ausstehend'}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
