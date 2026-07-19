import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {Grid3x3, Plus} from "lucide-react";
import { Breadcrumb } from "@/components/Breadcrumb";

export default function AdminCategories() {
  return (
    <DashboardLayout>
      <Breadcrumb
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Kategorien", icon: <Grid3x3 className="h-4 w-4" /> },
        ]}
      />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Kategorien-Verwaltung</h1>
            <p className="text-muted-foreground mt-2">
              Kategorien für Aktien erstellen und bearbeiten
            </p>
          </div>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Neue Kategorie
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Kategorien</CardTitle>
            <CardDescription>
              Verwalten Sie alle Kategorien der Platform
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Diese Funktion wird in Kürze verfügbar sein.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
