import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";

export function WhatsAppAlertsSettings() {
  const { user, isAuthenticated } = useAuth();
  const [mobile, setMobile] = useState("");
  const [whatsappAlerts, setWhatsappAlerts] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "success" | "error">("idle");

  const updateSettingsMutation = trpc.user.updateSettings.useMutation({
    onSuccess: () => {
      setSaveStatus("success");
      setTimeout(() => setSaveStatus("idle"), 3000);
    },
    onError: () => {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    },
  });

  // Load current settings
  useEffect(() => {
    if (user) {
      setMobile(user.mobile || "");
      setWhatsappAlerts(user.whatsappAlerts === 1);
    }
  }, [user]);

  const handleSave = () => {
    if (!isAuthenticated) return;
    
    setSaveStatus("saving");
    updateSettingsMutation.mutate({
      mobile: mobile || null,
      whatsappAlerts: whatsappAlerts ? 1 : 0,
    } as any);
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <Card className="bg-slate-800 border-slate-700 p-6">
      <h3 className="text-xl font-bold text-white mb-4">📱 WhatsApp Portfolio-Alerts</h3>
      <p className="text-slate-300 mb-4">
        Erhalte sofortige Benachrichtigungen per WhatsApp bei Portfolio-Änderungen (Aktien hinzufügen, löschen, Gewichtung ändern).
      </p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Mobilnummer (mit Ländercode, z.B. +41791234567)
          </label>
          <Input
            type="tel"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            className="bg-slate-700 border-slate-600 text-white"
            placeholder="+41791234567"
          />
          <p className="text-xs text-slate-400 mt-1">
            Format: +[Ländercode][Nummer] ohne Leerzeichen
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="whatsapp-alerts"
            checked={whatsappAlerts}
            onChange={(e) => setWhatsappAlerts(e.target.checked)}
            className="w-4 h-4 text-blue-600 bg-slate-700 border-slate-600 rounded focus:ring-blue-500"
          />
          <label htmlFor="whatsapp-alerts" className="text-slate-300">
            WhatsApp-Benachrichtigungen aktivieren
          </label>
        </div>

        {saveStatus === "success" && (
          <div className="p-3 bg-green-900/30 border border-green-700 rounded text-green-400 text-sm">
            ✓ Einstellungen gespeichert!
          </div>
        )}

        {saveStatus === "error" && (
          <div className="p-3 bg-red-900/30 border border-red-700 rounded text-red-400 text-sm">
            ✗ Fehler beim Speichern. Bitte versuche es erneut.
          </div>
        )}

        <Button
          onClick={handleSave}
          disabled={saveStatus === "saving" || !mobile}
          className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50"
        >
          {saveStatus === "saving" ? "Speichern..." : "Einstellungen speichern"}
        </Button>

        <div className="mt-4 p-4 bg-blue-900/20 border border-blue-700 rounded">
          <p className="text-sm text-blue-300 mb-2">
            <strong>Hinweis:</strong> Du musst zuerst die Twilio WhatsApp Sandbox aktivieren:
          </p>
          <ol className="text-xs text-slate-300 space-y-1 ml-4 list-decimal">
            <li>Sende "join [sandbox-code]" an die Twilio WhatsApp-Nummer</li>
            <li>Warte auf die Bestätigung</li>
            <li>Aktiviere dann hier die Benachrichtigungen</li>
          </ol>
        </div>
      </div>
    </Card>
  );
}

