import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertCircle, RefreshCw, Mail, MessageSquare, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { Breadcrumb } from "@/components/Breadcrumb";
import { toast } from "sonner";

export default function TestSecrets() {
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [testEmail, setTestEmail] = useState(user?.email || "");
  const [testPhone, setTestPhone] = useState(user?.mobile || "");

  // Redirect if not admin
  if (isAuthenticated && user?.role !== "admin") {
    setLocation("/");
    return null;
  }

  const { data: apiTests, isLoading: isLoadingTests, refetch: refetchTests } = trpc.testSecrets.testAllApis.useQuery();
  const sendTestEmailMutation = trpc.testSecrets.sendTestEmail.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success("Test-Email erfolgreich gesendet!");
      } else {
        toast.error("Fehler beim Senden der Test-Email");
      }
    },
    onError: (error) => {
      toast.error(`Fehler: ${error.message}`);
    },
  });

  const sendTestWhatsAppMutation = trpc.testSecrets.sendTestWhatsApp.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success("Test-WhatsApp-Nachricht erfolgreich gesendet!");
      } else {
        toast.error("Fehler beim Senden der WhatsApp-Nachricht");
      }
    },
    onError: (error) => {
      toast.error(`Fehler: ${error.message}`);
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "error":
        return <XCircle className="h-5 w-5 text-red-500" />;
      case "missing":
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string): "default" | "destructive" | "secondary" => {
    switch (status) {
      case "success":
        return "default";
      case "error":
        return "destructive";
      default:
        return "secondary";
    }
  };

  const apiNames: Record<string, string> = {
    stripe: "Stripe (Payments)",
    finnhub: "Finnhub (Stock Data)",
    eodhd: "EODHD (Historical Prices)",
    resend: "Resend (Email)",
    twilio: "Twilio (WhatsApp)",
  };

  return (
    <div className="container max-w-6xl py-8">
      <Breadcrumb
        items={[
          { label: "Admin", href: "/" },
          { label: "Test API Secrets" },
        ]}
      />

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-primary" />
            API Secrets Testen
          </h1>
          <p className="text-muted-foreground mt-2">
            Überprüfen Sie die Verfügbarkeit und Funktionalität aller API-Keys
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.history.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zurück
          </Button>
          <Button onClick={() => refetchTests()} disabled={isLoadingTests}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingTests ? "animate-spin" : ""}`} />
            Neu laden
          </Button>
        </div>
      </div>

      {/* API Tests Overview */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>API-Status Übersicht</CardTitle>
          <CardDescription>
            Zeigt an, welche API-Keys konfiguriert sind und ob sie funktionieren
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingTests ? (
            <p className="text-muted-foreground">Lade API-Tests...</p>
          ) : apiTests ? (
            <div className="space-y-3">
              {Object.entries(apiTests).map(([key, result]) => (
                <div
                  key={key}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(result.status)}
                    <div>
                      <p className="font-medium">{apiNames[key] || key}</p>
                      <p className="text-sm text-muted-foreground">{result.message}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {result.source && (
                      <Badge variant="outline" className="text-xs">
                        {result.source === "environment" ? "Umgebung" : "Datenbank"}
                      </Badge>
                    )}
                    <Badge variant={getStatusBadge(result.status)}>
                      {result.status === "success"
                        ? "OK"
                        : result.status === "error"
                        ? "Fehler"
                        : "Fehlt"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">Keine Testergebnisse verfügbar</p>
          )}
        </CardContent>
      </Card>

      {/* Test Email */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Test-Email senden
          </CardTitle>
          <CardDescription>
            Senden Sie eine Test-Email, um die Resend-Integration zu überprüfen
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="ihre-email@example.com"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="flex-1"
            />
            <Button
              onClick={() => sendTestEmailMutation.mutate({ to: testEmail })}
              disabled={
                !testEmail ||
                sendTestEmailMutation.isPending ||
                apiTests?.resend?.status !== "success"
              }
            >
              {sendTestEmailMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Sende...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Senden
                </>
              )}
            </Button>
          </div>
          {apiTests?.resend?.status !== "success" && (
            <p className="text-sm text-yellow-600 mt-2">
              ⚠️ Resend API-Key fehlt oder ist ungültig. Bitte fügen Sie RESEND_API_KEY über
              /admin/secrets hinzu.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Test WhatsApp */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Test-WhatsApp-Nachricht senden
          </CardTitle>
          <CardDescription>
            Senden Sie eine Test-Nachricht, um die Twilio-Integration zu überprüfen
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              type="tel"
              placeholder="+41791234567"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              className="flex-1"
            />
            <Button
              onClick={() => sendTestWhatsAppMutation.mutate({ to: testPhone })}
              disabled={
                !testPhone ||
                sendTestWhatsAppMutation.isPending ||
                apiTests?.twilio?.status !== "success"
              }
            >
              {sendTestWhatsAppMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Sende...
                </>
              ) : (
                <>
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Senden
                </>
              )}
            </Button>
          </div>
          {apiTests?.twilio?.status !== "success" && (
            <p className="text-sm text-yellow-600 mt-2">
              ⚠️ Twilio-Credentials fehlen oder sind ungültig. Bitte fügen Sie
              TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN und TWILIO_WHATSAPP_NUMBER über /admin/secrets
              hinzu.
            </p>
          )}
          <p className="text-sm text-muted-foreground mt-2">
            Hinweis: Die Telefonnummer muss das Ländercode-Präfix enthalten (z.B. +41 für
            Schweiz)
          </p>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card className="mt-6 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <CardHeader>
          <CardTitle className="text-blue-900 dark:text-blue-100">
            💡 So fügen Sie API-Keys hinzu
          </CardTitle>
        </CardHeader>
        <CardContent className="text-blue-800 dark:text-blue-200">
          <ol className="list-decimal list-inside space-y-2">
            <li>Gehen Sie zu <a href="/admin/secrets" className="underline font-medium">/admin/secrets</a></li>
            <li>Klicken Sie auf "Secret hinzufügen"</li>
            <li>Geben Sie den Key-Namen ein (z.B. FINNHUB_API_KEY)</li>
            <li>Fügen Sie den API-Key-Wert ein</li>
            <li>Speichern Sie - die API funktioniert sofort ohne Redeploy!</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
