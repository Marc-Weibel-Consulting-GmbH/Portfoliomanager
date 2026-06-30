import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Key, Trash2, Copy, Check, Pencil } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AdminTopbar } from "@/components/AdminTopbar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";

export default function AdminSecretsManagement() {
  const utils = trpc.useUtils();
  const { data: secrets = [], isLoading } = trpc.secrets.list.useQuery();
  const setSecretMutation = trpc.secrets.set.useMutation({
    onSuccess: () => {
      utils.secrets.list.invalidate();
      toast.success("Secret gespeichert");
      setDialogOpen(false);
      resetForm();
    },
    onError: (err) => toast.error(err.message),
  });
  const deleteSecretMutation = trpc.secrets.delete.useMutation({
    onSuccess: () => {
      utils.secrets.list.invalidate();
      toast.success("Secret gelöscht");
    },
    onError: (err) => toast.error(err.message),
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [formKey, setFormKey] = useState("");
  const [formValue, setFormValue] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  function resetForm() {
    setFormKey("");
    setFormValue("");
    setFormDescription("");
    setEditMode(false);
  }

  function handleAdd() {
    resetForm();
    setDialogOpen(true);
  }

  function handleEdit(key: string, description?: string) {
    setFormKey(key);
    setFormValue("");
    setFormDescription(description || "");
    setEditMode(true);
    setDialogOpen(true);
  }

  function handleSave() {
    if (!formKey.trim() || !formValue.trim()) {
      toast.error("Key und Value sind erforderlich");
      return;
    }
    setSecretMutation.mutate({
      key: formKey.trim(),
      value: formValue.trim(),
      description: formDescription.trim() || undefined,
    });
  }

  function handleDelete(key: string) {
    deleteSecretMutation.mutate({ key });
    setDeleteConfirm(null);
  }

  function handleCopy(key: string) {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <AdminTopbar />
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">API & Secrets</h1>
            <p className="text-muted-foreground mt-2">
              API-Keys und Secrets sicher verwalten
            </p>
          </div>
          <Button onClick={handleAdd}>
            <Plus className="h-4 w-4 mr-2" />
            Hinzufügen
          </Button>
        </div>

        <Alert>
          <Key className="h-4 w-4" />
          <AlertDescription>
            Secrets werden verschlüsselt in der Datenbank gespeichert. Werte werden nur bei Bedarf entschlüsselt.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Gespeicherte Secrets ({secrets.length})</CardTitle>
            <CardDescription>
              Alle API-Keys und Konfigurationswerte
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => (
                  <div key={i} className="h-14 bg-muted/50 rounded animate-pulse" />
                ))}
              </div>
            ) : secrets.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Key className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>Noch keine Secrets gespeichert.</p>
                <Button variant="outline" className="mt-4" onClick={handleAdd}>
                  <Plus className="h-4 w-4 mr-2" />
                  Erstes Secret hinzufügen
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {secrets.map((secret: any) => (
                  <div
                    key={secret.key}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <code className="text-sm font-mono font-medium text-foreground">
                          {secret.key}
                        </code>
                        <button
                          onClick={() => handleCopy(secret.key)}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {copiedKey === secret.key ? (
                            <Check className="h-3.5 w-3.5 text-green-500" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                      {secret.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {secret.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 ml-4">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEdit(secret.key, secret.description)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteConfirm(secret.key)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editMode ? "Secret bearbeiten" : "Neues Secret hinzufügen"}</DialogTitle>
              <DialogDescription>
                {editMode
                  ? "Geben Sie den neuen Wert für dieses Secret ein."
                  : "Geben Sie den Key, Wert und eine optionale Beschreibung ein."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="secret-key">Key</Label>
                <Input
                  id="secret-key"
                  placeholder="z.B. ANTHROPIC_API_KEY"
                  value={formKey}
                  onChange={(e) => setFormKey(e.target.value)}
                  disabled={editMode}
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="secret-value">Wert</Label>
                <Input
                  id="secret-value"
                  type="password"
                  placeholder="Secret-Wert eingeben..."
                  value={formValue}
                  onChange={(e) => setFormValue(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="secret-desc">Beschreibung (optional)</Label>
                <Input
                  id="secret-desc"
                  placeholder="z.B. Anthropic Claude API Key"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button onClick={handleSave} disabled={setSecretMutation.isPending}>
                {setSecretMutation.isPending ? "Speichern..." : "Speichern"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Secret löschen?</DialogTitle>
              <DialogDescription>
                Möchten Sie das Secret <code className="font-mono">{deleteConfirm}</code> wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
                Abbrechen
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
                disabled={deleteSecretMutation.isPending}
              >
                Löschen
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
