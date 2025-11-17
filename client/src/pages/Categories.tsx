import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

export default function Categories() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});

  const utils = trpc.useUtils();
  const { data: categories = [], isLoading } = trpc.categories.list.useQuery();

  const addCategoryMutation = trpc.categories.add.useMutation({
    onSuccess: () => {
      toast.success("Erfolg", { description: "Kategorie wurde hinzugefügt" });
      utils.categories.list.invalidate();
      setIsAddDialogOpen(false);
      setFormData({});
    },
    onError: (error) => {
      toast.error("Fehler", { description: error.message });
    },
  });

  const updateCategoryMutation = trpc.categories.update.useMutation({
    onSuccess: () => {
      toast.success("Erfolg", { description: "Kategorie wurde aktualisiert" });
      utils.categories.list.invalidate();
      setIsEditDialogOpen(false);
      setEditingCategory(null);
      setFormData({});
    },
    onError: (error) => {
      toast.error("Fehler", { description: error.message });
    },
  });

  const deleteCategoryMutation = trpc.categories.delete.useMutation({
    onSuccess: () => {
      toast.success("Erfolg", { description: "Kategorie wurde gelöscht" });
      utils.categories.list.invalidate();
    },
    onError: (error) => {
      toast.error("Fehler", { description: error.message });
    },
  });

  // Only admins can access this page
  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <Card className="bg-slate-800 border-slate-700 max-w-md">
          <CardContent className="pt-6">
            <p className="text-slate-300 text-center">
              Sie haben keine Berechtigung, diese Seite zu sehen.
            </p>
            <Button onClick={() => window.history.back()} className="w-full mt-4">
              Zurück
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleAdd = () => {
    if (!formData.name) {
      toast.error("Fehler", { description: "Name ist erforderlich" });
      return;
    }
    addCategoryMutation.mutate(formData);
  };

  const handleUpdate = () => {
    if (!formData.name) {
      toast.error("Fehler", { description: "Name ist erforderlich" });
      return;
    }
    updateCategoryMutation.mutate({ id: editingCategory.id, ...formData });
  };

  const handleDelete = (id: number, name: string) => {
    if (confirm(`Möchten Sie die Kategorie "${name}" wirklich löschen?`)) {
      deleteCategoryMutation.mutate(id);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => window.history.back()}
              variant="outline"
              size="sm"
              className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Zurück
            </Button>
            <h1 className="text-3xl font-bold text-white">Kategorie-Verwaltung</h1>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                <Plus className="w-4 h-4 mr-2" />
                Neue Kategorie
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-800 border-slate-700 text-white [&>button]:text-white">
              <DialogHeader>
                <DialogTitle className="text-white">Neue Kategorie hinzufügen</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Input
                  placeholder="Name *"
                  value={formData.name || ""}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-slate-700 border-slate-600 text-white"
                />
                <Textarea
                  placeholder="Beschreibung (optional)"
                  value={formData.description || ""}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="bg-slate-700 border-slate-600 text-white"
                  rows={3}
                />
                <Input
                  placeholder="Farbe (optional, z.B. bg-blue-500)"
                  value={formData.color || ""}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="bg-slate-700 border-slate-600 text-white"
                />
                <Button onClick={handleAdd} className="w-full bg-green-600 hover:bg-green-700">
                  Hinzufügen
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6">
              <p className="text-slate-400 text-center">Lädt...</p>
            </CardContent>
          </Card>
        ) : categories.length === 0 ? (
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6">
              <p className="text-slate-400 text-center">Keine Kategorien vorhanden</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {categories.map((category: any) => (
              <Card key={category.id} className="bg-slate-800 border-slate-700">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xl font-bold text-white">
                    {category.name}
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        setEditingCategory(category);
                        setFormData(category);
                        setIsEditDialogOpen(true);
                      }}
                      size="sm"
                      variant="outline"
                      className="bg-blue-600 border-blue-500 text-white hover:bg-blue-700"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      onClick={() => handleDelete(category.id, category.name)}
                      size="sm"
                      variant="outline"
                      className="bg-red-600 border-red-500 text-white hover:bg-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {category.description && (
                    <p className="text-slate-400 mb-2">{category.description}</p>
                  )}
                  {category.color && (
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded ${category.color}`}></div>
                      <span className="text-slate-500 text-sm">{category.color}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white [&>button]:text-white">
            <DialogHeader>
              <DialogTitle className="text-white">Kategorie bearbeiten</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Name *"
                value={formData.name || ""}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="bg-slate-700 border-slate-600 text-white"
              />
              <Textarea
                placeholder="Beschreibung (optional)"
                value={formData.description || ""}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="bg-slate-700 border-slate-600 text-white"
                rows={3}
              />
              <Input
                placeholder="Farbe (optional, z.B. bg-blue-500)"
                value={formData.color || ""}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="bg-slate-700 border-slate-600 text-white"
              />
              <Button onClick={handleUpdate} className="w-full bg-green-600 hover:bg-green-700">
                Aktualisieren
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
