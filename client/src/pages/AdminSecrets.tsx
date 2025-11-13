import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Trash2, Plus, Key, Shield } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useLocation } from "wouter";

export default function AdminSecrets() {
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newSecret, setNewSecret] = useState({
    key: "",
    value: "",
    description: "",
  });

  // Redirect if not admin
  if (isAuthenticated && user?.role !== "admin") {
    setLocation("/");
    return null;
  }

  const utils = trpc.useUtils();
  const { data: secrets, isLoading } = trpc.secrets.list.useQuery();
  const setSecretMutation = trpc.secrets.set.useMutation({
    onSuccess: () => {
      toast.success("Secret erfolgreich gespeichert");
      utils.secrets.list.invalidate();
      setIsAddDialogOpen(false);
      setNewSecret({ key: "", value: "", description: "" });
    },
    onError: (error) => {
      toast.error(`Fehler: ${error.message}`);
    },
  });
  const deleteSecretMutation = trpc.secrets.delete.useMutation({
    onSuccess: () => {
      toast.success("Secret erfolgreich gelöscht");
      utils.secrets.list.invalidate();
    },
    onError: (error) => {
      toast.error(`Fehler: ${error.message}`);
    },
  });

  const handleAddSecret = () => {
    if (!newSecret.key || !newSecret.value) {
      toast.error("Bitte Key und Value ausfüllen");
      return;
    }
    setSecretMutation.mutate(newSecret);
  };

  const handleDeleteSecret = (key: string) => {
    if (confirm(`Möchten Sie wirklich das Secret "${key}" löschen?`)) {
      deleteSecretMutation.mutate({ key });
    }
  };

  return (
    <div className="container max-w-5xl py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            API Secrets Verwaltung
          </h1>
          <p className="text-muted-foreground mt-2">
            Verwalten Sie verschlüsselte API-Schlüssel und Secrets für externe Dienste
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Secret hinzufügen
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Neues Secret hinzufügen</DialogTitle>
              <DialogDescription>
                Fügen Sie einen neuen API-Schlüssel oder Secret hinzu. Der Wert wird verschlüsselt gespeichert.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="key">Key (z.B. FINNHUB_API_KEY)</Label>
                <Input
                  id="key"
                  placeholder="API_KEY_NAME"
                  value={newSecret.key}
                  onChange={(e) => setNewSecret({ ...newSecret, key: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="value">Value (API-Schlüssel)</Label>
                <Input
                  id="value"
                  type="password"
                  placeholder="sk_live_..."
                  value={newSecret.value}
                  onChange={(e) => setNewSecret({ ...newSecret, value: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Beschreibung (optional)</Label>
                <Textarea
                  id="description"
                  placeholder="Beschreibung des Secrets..."
                  value={newSecret.description}
                  onChange={(e) => setNewSecret({ ...newSecret, description: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button onClick={handleAddSecret} disabled={setSecretMutation.isPending}>
                {setSecretMutation.isPending ? "Speichert..." : "Speichern"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Lade Secrets...</p>
        </div>
      ) : secrets && secrets.length > 0 ? (
        <div className="grid gap-4">
          {secrets.map((secret) => (
            <Card key={secret.key}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <Key className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <CardTitle className="text-lg font-mono">{secret.key}</CardTitle>
                      {secret.description && (
                        <CardDescription className="mt-1">{secret.description}</CardDescription>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteSecret(secret.key)}
                    disabled={deleteSecretMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Zuletzt aktualisiert:</span>
                  <span>{new Date(secret.updatedAt).toLocaleString("de-DE")}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Key className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              Noch keine Secrets vorhanden. Fügen Sie Ihren ersten API-Schlüssel hinzu.
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="mt-8 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
        <CardHeader>
          <CardTitle className="text-amber-900 dark:text-amber-100 flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Sicherheitshinweise
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-amber-800 dark:text-amber-200 space-y-2">
          <p>• Alle Secrets werden mit AES-256-CBC verschlüsselt in der Datenbank gespeichert</p>
          <p>• Der Verschlüsselungsschlüssel basiert auf JWT_SECRET (niemals in der DB gespeichert)</p>
          <p>• Secrets sind nur für Administratoren sichtbar und verwaltbar</p>
          <p>• Ändern Sie regelmäßig Ihre API-Schlüssel für maximale Sicherheit</p>
        </CardContent>
      </Card>
    </div>
  );
}
