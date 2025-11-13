import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, RefreshCw, Key, Database, Server } from "lucide-react";
import { useLocation } from "wouter";
import { Breadcrumb } from "@/components/Breadcrumb";

export default function TestSecrets() {
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  // Redirect if not admin
  if (isAuthenticated && user?.role !== "admin") {
    setLocation("/");
    return null;
  }

  const { data: testResult, isLoading, refetch } = trpc.testSecrets.testStripeKey.useQuery();

  return (
    <div className="container max-w-4xl py-8">
      <Breadcrumb
        items={[
          { label: "Admin", href: "/" },
          { label: "Test Secrets", icon: <Key className="h-4 w-4" /> },
        ]}
      />

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Key className="h-8 w-8 text-primary" />
            Secrets Test
          </h1>
          <p className="text-muted-foreground mt-2">
            Testen Sie, ob DB-Secrets als Fallback funktionieren
          </p>
        </div>
        <Button onClick={() => refetch()} disabled={isLoading}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Neu laden
        </Button>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Teste Secret-Loading...</p>
          </CardContent>
        </Card>
      ) : testResult ? (
        <div className="space-y-6">
          {/* Test Result Card */}
          <Card className={testResult.hasKey ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950" : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950"}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {testResult.hasKey ? (
                  <>
                    <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
                    <span className="text-green-900 dark:text-green-100">STRIPE_SECRET_KEY gefunden</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
                    <span className="text-red-900 dark:text-red-100">STRIPE_SECRET_KEY nicht gefunden</span>
                  </>
                )}
              </CardTitle>
              <CardDescription className={testResult.hasKey ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"}>
                {testResult.hasKey 
                  ? `Secret wurde erfolgreich geladen (${testResult.keyLength} Zeichen)`
                  : "Kein Secret in Umgebungsvariablen oder Datenbank gefunden"
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <Server className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Quelle</p>
                      <p className="text-sm text-muted-foreground capitalize">{testResult.source}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Key className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Key Prefix</p>
                      <p className="text-sm text-muted-foreground font-mono">{testResult.keyPrefix}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Instructions Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Anleitung: DB-Secret hinzufügen
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">So fügen Sie STRIPE_SECRET_KEY zur Datenbank hinzu:</p>
                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                  <li>Gehen Sie zu <a href="/admin/secrets" className="text-primary hover:underline">Admin → API Secrets</a></li>
                  <li>Klicken Sie auf "Secret hinzufügen"</li>
                  <li>Key: <code className="bg-muted px-1 py-0.5 rounded">STRIPE_SECRET_KEY</code></li>
                  <li>Value: Ihr Stripe Secret Key (beginnt mit <code className="bg-muted px-1 py-0.5 rounded">sk_live_</code> oder <code className="bg-muted px-1 py-0.5 rounded">sk_test_</code>)</li>
                  <li>Klicken Sie auf "Speichern"</li>
                  <li>Laden Sie diese Seite neu, um zu testen</li>
                </ol>
              </div>

              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-2">Erwartetes Verhalten:</p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• <strong>Quelle: environment</strong> → Platform-Secret wird verwendet (höchste Priorität)</li>
                  <li>• <strong>Quelle: database</strong> → DB-Secret wird als Fallback verwendet ✅</li>
                  <li>• <strong>Quelle: none</strong> → Kein Secret gefunden (fügen Sie eins hinzu)</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Keine Daten verfügbar</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
