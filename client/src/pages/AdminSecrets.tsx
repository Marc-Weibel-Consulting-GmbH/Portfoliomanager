import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Trash2, Plus, Key, Shield, ArrowLeft, Settings, Edit } from "lucide-react";
import { Breadcrumb } from "@/components/Breadcrumb";
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
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [secretForm, setSecretForm] = useState({
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
      toast.success(editingKey ? "Secret erfolgreich aktualisiert" : "Secret erfolgreich gespeichert");
      utils.secrets.list.invalidate();
      setIsAddDialogOpen(false);
      setEditingKey(null);
      setSecretForm({ key: "", value: "", description: "" });
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

  const handleSaveSecret = () => {
    if (!secretForm.key || !secretForm.value) {
      toast.error("Bitte Key und Value ausfüllen");
      return;
    }
    setSecretMutation.mutate(secretForm);
  };

  const handleEditSecret = async (secret: { key: string; description: string }) => {
    setEditingKey(secret.key);
    
    // Fetch the current value
    try {
      const result = await utils.client.secrets.get.query({ key: secret.key });
      setSecretForm({
        key: secret.key,
        value: result.value,
        description: secret.description || "",
      });
    } catch (error) {
      toast.error("Fehler beim Laden des Secrets");
      setSecretForm({
        key: secret.key,
        value: "",
        description: secret.description || "",
      });
    }
    
    setIsAddDialogOpen(true);
  };

  const handleAddNew = () => {
    setEditingKey(null);
    setSecretForm({ key: "", value: "", description: "" });
    setIsAddDialogOpen(true);
  };

  const handleDeleteSecret = (key: string) => {
    if (confirm(`Möchten Sie wirklich das Secret "${key}" löschen?`)) {
      deleteSecretMutation.mutate({ key });
    }
  };

  return (
    <div className="container max-w-5xl py-8">
      <Breadcrumb
        items={[
          { label: "Admin", href: "/" },
          { label: "API Secrets", icon: <Key className="h-4 w-4" /> },
        ]}
      />
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
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => window.history.back()}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zurück
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleAddNew}>
                <Plus className="h-4 w-4 mr-2" />
                Secret hinzufügen
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingKey ? "Secret bearbeiten" : "Neues Secret hinzufügen"}</DialogTitle>
                <DialogDescription>
                  {editingKey 
                    ? "Aktualisieren Sie den API-Schlüssel. Der Wert wird verschlüsselt gespeichert."
                    : "Fügen Sie einen neuen API-Schlüssel oder Secret hinzu. Der Wert wird verschlüsselt gespeichert."
                  }
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="key">Key (z.B. FINNHUB_API_KEY)</Label>
                  <Input
                    id="key"
                    placeholder="API_KEY_NAME"
                    value={secretForm.key}
                    onChange={(e) => setSecretForm({ ...secretForm, key: e.target.value })}
                    disabled={!!editingKey}
                  />
                  {editingKey && (
                    <p className="text-xs text-muted-foreground">Der Key kann nicht geändert werden. Löschen Sie das Secret und erstellen Sie ein neues, falls nötig.</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="value">Value (API-Schlüssel)</Label>
                  <Input
                    id="value"
                    type="password"
                    placeholder={editingKey ? "Neuen Wert eingeben..." : "sk_live_..."}
                    value={secretForm.value}
                    onChange={(e) => setSecretForm({ ...secretForm, value: e.target.value })}
                  />
                  {editingKey && (
                    <p className="text-xs text-muted-foreground">Geben Sie einen neuen Wert ein, um das Secret zu aktualisieren.</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Beschreibung (optional)</Label>
                  <Textarea
                    id="description"
                    placeholder="Beschreibung des Secrets..."
                    value={secretForm.description}
                    onChange={(e) => setSecretForm({ ...secretForm, description: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Abbrechen
                </Button>
                <Button onClick={handleSaveSecret} disabled={setSecretMutation.isPending}>
                  {setSecretMutation.isPending ? "Speichert..." : "Speichern"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
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
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditSecret({ key: secret.key || '', description: secret.description || '' })}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteSecret(secret.key)}
                      disabled={deleteSecretMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Zuletzt aktualisiert:</span>
                  <span>{new Date(secret.updatedAt).toLocaleString("de-CH")}</span>
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
