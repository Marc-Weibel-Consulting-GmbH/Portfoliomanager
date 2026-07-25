import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Breadcrumb } from "@/components/Breadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import { PieChart, Pencil, Plus, RefreshCw, Trash2, Wand2 } from "lucide-react";

const COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#06b6d4",
  "#64748b", "#f97316", "#84cc16", "#ec4899", "#a16207",
  "#7c3aed", "#ef4444", "#0ea5e9", "#14b8a6", "#d97706",
];

interface SectorRow {
  id: number;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  includeInGapFilling: number;
  sortOrder: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface FormState {
  name: string;
  description: string;
  color: string;
  icon: string;
  includeInGapFilling: boolean;
  sortOrder: number;
}

const EMPTY_FORM: FormState = {
  name: "", description: "", color: "#3b82f6", icon: "",
  includeInGapFilling: true, sortOrder: 0,
};

export default function AdminSectors() {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SectorRow | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<SectorRow | null>(null);

  const utils = trpc.useUtils();

  const { data: sectorList, isLoading } = trpc.admin.listSectors.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const createMutation = trpc.admin.createSector.useMutation({
    onSuccess: () => {
      toast.success("Sektor erstellt");
      utils.admin.listSectors.invalidate();
      setFormOpen(false);
      setForm(EMPTY_FORM);
    },
    onError: (e) => toast.error("Fehler", { description: e.message }),
  });

  const updateMutation = trpc.admin.updateSector.useMutation({
    onSuccess: () => {
      toast.success("Sektor aktualisiert");
      utils.admin.listSectors.invalidate();
      setFormOpen(false);
      setEditing(null);
    },
    onError: (e) => toast.error("Fehler", { description: e.message }),
  });

  const deleteMutation = trpc.admin.deleteSector.useMutation({
    onSuccess: () => {
      toast.success("Sektor gelöscht");
      utils.admin.listSectors.invalidate();
      setDeleteTarget(null);
    },
    onError: (e) => toast.error("Fehler", { description: e.message }),
  });

  const seedMutation = trpc.admin.seedDefaultSectors.useMutation({
    onSuccess: (data) => {
      if (data.seeded > 0) {
        toast.success(`${data.seeded} Standard-Sektoren hinzugefügt`);
        utils.admin.listSectors.invalidate();
      } else {
        toast.info("Sektoren bereits vorhanden");
      }
    },
    onError: (e) => toast.error("Fehler", { description: e.message }),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };

  const openEdit = (sec: SectorRow) => {
    setEditing(sec);
    setForm({
      name: sec.name,
      description: sec.description ?? "",
      color: sec.color ?? "#3b82f6",
      icon: sec.icon ?? "",
      includeInGapFilling: sec.includeInGapFilling === 1,
      sortOrder: sec.sortOrder,
    });
    setFormOpen(true);
  };

  const handleSubmit = () => {
    if (!form.name.trim()) { toast.error("Name ist erforderlich"); return; }
    const payload = {
      name: form.name.trim(),
      description: form.description || undefined,
      color: form.color || undefined,
      icon: form.icon || undefined,
      includeInGapFilling: form.includeInGapFilling ? 1 : 0,
      sortOrder: form.sortOrder,
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const gapFillCount = (sectorList as SectorRow[] | undefined)?.filter(s => s.includeInGapFilling === 1).length ?? 0;

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <Breadcrumb
          items={[
            { label: "Admin", href: "/admin" },
            { label: "Sektoren-Verwaltung", icon: <PieChart className="h-4 w-4" /> },
          ]}
        />

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <PieChart className="w-6 h-6 text-primary" />
              Sektoren-Verwaltung
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              GICS-Sektoren erstellen und bearbeiten. Sektoren werden für Gap-Filling und Diversifikations-Checks verwendet.
            </p>
          </div>
          <div className="flex gap-2">
            {(!sectorList || sectorList.length === 0) && (
              <Button variant="outline" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending} className="gap-2">
                <Wand2 className="h-4 w-4" />
                Standard-Sektoren
              </Button>
            )}
            <Button onClick={openCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              Neuer Sektor
            </Button>
          </div>
        </div>

        {/* Stats bar */}
        {sectorList && sectorList.length > 0 && (
          <div className="flex gap-4 text-sm text-muted-foreground">
            <span><strong className="text-foreground">{sectorList.length}</strong> Sektoren total</span>
            <span><strong className="text-primary">{gapFillCount}</strong> im Gap-Filling aktiv</span>
          </div>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Sektoren{" "}
              {sectorList && <span className="text-muted-foreground font-normal">({sectorList.length})</span>}
            </CardTitle>
            <CardDescription>
              Sektoren entsprechen dem GICS-Standard und werden für Diversifikations-Analysen und Gap-Filling verwendet.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Lade Sektoren...
              </div>
            ) : !sectorList || sectorList.length === 0 ? (
              <div className="text-center py-10 space-y-3">
                <PieChart className="h-10 w-10 text-muted-foreground mx-auto opacity-40" />
                <p className="text-sm text-muted-foreground">Noch keine Sektoren vorhanden.</p>
                <Button variant="outline" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending} className="gap-2">
                  <Wand2 className="h-4 w-4" />
                  Standard-Sektoren (GICS) einfügen
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {(sectorList as SectorRow[]).map((sec) => (
                  <div key={sec.id} className="flex items-center gap-3 py-3">
                    {/* Color dot + icon */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <div
                        className="w-4 h-4 rounded-full border border-white/20"
                        style={{ backgroundColor: sec.color ?? "#64748b" }}
                      />
                      {sec.icon && <span className="text-base leading-none">{sec.icon}</span>}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{sec.name}</span>
                        {sec.includeInGapFilling === 1 ? (
                          <Badge variant="outline" className="text-xs text-primary border-primary/40 px-1.5 py-0">
                            Gap-Filling
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-muted-foreground px-1.5 py-0">
                            inaktiv
                          </Badge>
                        )}
                        {sec.color && (
                          <Badge variant="outline" className="text-xs font-mono px-1.5 py-0 hidden sm:inline-flex">
                            {sec.color}
                          </Badge>
                        )}
                      </div>
                      {sec.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{sec.description}</p>
                      )}
                    </div>

                    <div className="flex gap-1 flex-shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(sec)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(sec)}
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

      {/* Create / Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={(v) => { if (!v) { setFormOpen(false); setEditing(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Sektor bearbeiten" : "Neuer Sektor"}</DialogTitle>
            <DialogDescription>
              {editing ? `Bearbeite den Sektor «${editing.name}».` : "Erstelle einen neuen GICS-Sektor."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input
                placeholder="z. B. Technology"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                maxLength={100}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Beschreibung</Label>
              <Textarea
                placeholder="Kurze Beschreibung des Sektors…"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
                maxLength={500}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Icon / Emoji</Label>
                <Input
                  placeholder="💻"
                  value={form.icon}
                  onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
                  maxLength={10}
                  className="text-lg"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Reihenfolge</Label>
                <Input
                  type="number"
                  min={0}
                  max={999}
                  value={form.sortOrder}
                  onChange={(e) => setForm((f) => ({ ...f, sortOrder: parseInt(e.target.value, 10) || 0 }))}
                />
              </div>
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

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <div className="text-sm font-medium">Gap-Filling aktiv</div>
                <div className="text-xs text-muted-foreground">
                  Dieser Sektor wird im Universum Gap-Filling auf Lücken geprüft.
                </div>
              </div>
              <Switch
                checked={form.includeInGapFilling}
                onCheckedChange={(v) => setForm((f) => ({ ...f, includeInGapFilling: v }))}
              />
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

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sektor löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Der Sektor <strong>«{deleteTarget?.name}»</strong> wird dauerhaft gelöscht.
              Aktien, die diesem Sektor zugewiesen sind, behalten ihren Sektor-String,
              der Sektor erscheint aber nicht mehr in der verwalteten Liste.
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
