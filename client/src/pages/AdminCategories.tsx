import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Breadcrumb } from "@/components/Breadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Grid3x3, Pencil, Plus, RefreshCw, Trash2, Wand2 } from "lucide-react";

const COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#06b6d4",
  "#64748b", "#f97316", "#84cc16", "#ec4899", "#a16207",
  "#7c3aed", "#ef4444", "#0ea5e9", "#14b8a6", "#d97706",
];

interface CategoryRow {
  id: number;
  name: string;
  description: string | null;
  color: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface FormState {
  name: string;
  description: string;
  color: string;
}

const EMPTY_FORM: FormState = { name: "", description: "", color: "#3b82f6" };

export default function AdminCategories() {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<CategoryRow | null>(null);

  const utils = trpc.useUtils();

  const { data: categories, isLoading } = trpc.admin.listCategories.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const createMutation = trpc.admin.createCategory.useMutation({
    onSuccess: () => {
      toast.success("Kategorie erstellt");
      utils.admin.listCategories.invalidate();
      setFormOpen(false);
      setForm(EMPTY_FORM);
    },
    onError: (e) => toast.error("Fehler", { description: e.message }),
  });

  const updateMutation = trpc.admin.updateCategory.useMutation({
    onSuccess: () => {
      toast.success("Kategorie aktualisiert");
      utils.admin.listCategories.invalidate();
      setFormOpen(false);
      setEditing(null);
    },
    onError: (e) => toast.error("Fehler", { description: e.message }),
  });

  const deleteMutation = trpc.admin.deleteCategory.useMutation({
    onSuccess: () => {
      toast.success("Kategorie gelöscht");
      utils.admin.listCategories.invalidate();
      setDeleteTarget(null);
    },
    onError: (e) => toast.error("Fehler", { description: e.message }),
  });

  const seedMutation = trpc.admin.seedDefaultCategories.useMutation({
    onSuccess: (data) => {
      if (data.seeded > 0) {
        toast.success(`${data.seeded} Standard-Kategorien hinzugefügt`);
        utils.admin.listCategories.invalidate();
      } else {
        toast.info("Kategorien bereits vorhanden");
      }
    },
    onError: (e) => toast.error("Fehler", { description: e.message }),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };

  const openEdit = (cat: CategoryRow) => {
    setEditing(cat);
    setForm({ name: cat.name, description: cat.description ?? "", color: cat.color ?? "#3b82f6" });
    setFormOpen(true);
  };

  const handleSubmit = () => {
    if (!form.name.trim()) { toast.error("Name ist erforderlich"); return; }
    if (editing) {
      updateMutation.mutate({ id: editing.id, name: form.name.trim(), description: form.description || undefined, color: form.color || undefined });
    } else {
      createMutation.mutate({ name: form.name.trim(), description: form.description || undefined, color: form.color || undefined });
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <Breadcrumb
          items={[
            { label: "Admin", href: "/admin" },
            { label: "Kategorien-Verwaltung", icon: <Grid3x3 className="h-4 w-4" /> },
          ]}
        />

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Grid3x3 className="w-6 h-6 text-primary" />
              Kategorien-Verwaltung
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Investmentkategorien erstellen und bearbeiten (z. B. Dividendenaktien, ETF, Value-Aktien).
            </p>
          </div>
          <div className="flex gap-2">
            {(!categories || categories.length === 0) && (
              <Button variant="outline" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending} className="gap-2">
                <Wand2 className="h-4 w-4" />
                Standard-Kategorien
              </Button>
            )}
            <Button onClick={openCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              Neue Kategorie
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Kategorien{" "}
              {categories && <span className="text-muted-foreground font-normal">({categories.length})</span>}
            </CardTitle>
            <CardDescription>
              Kategorien werden Aktien als Investmenttyp zugewiesen und erscheinen in Filtern und Charts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Lade Kategorien...
              </div>
            ) : !categories || categories.length === 0 ? (
              <div className="text-center py-10 space-y-3">
                <Grid3x3 className="h-10 w-10 text-muted-foreground mx-auto opacity-40" />
                <p className="text-sm text-muted-foreground">Noch keine Kategorien vorhanden.</p>
                <Button variant="outline" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending} className="gap-2">
                  <Wand2 className="h-4 w-4" />
                  Standard-Kategorien einfügen
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {(categories as CategoryRow[]).map((cat) => (
                  <div key={cat.id} className="flex items-center gap-3 py-3">
                    <div
                      className="w-4 h-4 rounded-full flex-shrink-0 border border-white/20"
                      style={{ backgroundColor: cat.color ?? "#64748b" }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{cat.name}</span>
                        {cat.color && (
                          <Badge variant="outline" className="text-xs font-mono px-1.5 py-0">
                            {cat.color}
                          </Badge>
                        )}
                      </div>
                      {cat.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{cat.description}</p>
                      )}
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(cat)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(cat)}
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
      </div>

      <Dialog open={formOpen} onOpenChange={(v) => { if (!v) { setFormOpen(false); setEditing(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Kategorie bearbeiten" : "Neue Kategorie"}</DialogTitle>
            <DialogDescription>
              {editing ? `Bearbeite die Kategorie «${editing.name}».` : "Erstelle eine neue Investmentkategorie."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input
                placeholder="z. B. Dividendenaktien"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                maxLength={100}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Beschreibung</Label>
              <Textarea
                placeholder="Kurze Beschreibung der Kategorie…"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
                maxLength={500}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Farbe</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${
                      form.color === c ? "border-white scale-110 ring-2 ring-primary" : "border-transparent"
                    }`}
                    style={{ backgroundColor: c }}
                    onClick={() => setForm((f) => ({ ...f, color: c }))}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <div className="w-6 h-6 rounded-full border border-border" style={{ backgroundColor: form.color }} />
                <Input
                  value={form.color}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                  placeholder="#3b82f6"
                  className="w-32 font-mono text-sm"
                  maxLength={20}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setFormOpen(false); setEditing(null); }}>
              Abbrechen
            </Button>
            <Button onClick={handleSubmit} disabled={isSaving} className="gap-2">
              {isSaving && <RefreshCw className="h-4 w-4 animate-spin" />}
              {editing ? "Speichern" : "Erstellen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kategorie löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Die Kategorie <strong>«{deleteTarget?.name}»</strong> wird dauerhaft gelöscht.
              Aktien, die dieser Kategorie zugewiesen sind, verlieren ihre Kategorisierung.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate({ id: deleteTarget.id })}
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
