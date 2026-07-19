import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {PieChart, Plus} from "lucide-react";
import { Breadcrumb } from "@/components/Breadcrumb";

export default function AdminSectors() {
  return (
    <DashboardLayout>
      <Breadcrumb
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Sektoren", icon: <PieChart className="h-4 w-4" /> },
        ]}
      />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Sektoren-Verwaltung</h1>
            <p className="text-muted-foreground mt-2">
              Sektoren für Aktien erstellen und bearbeiten
            </p>
          </div>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Neuer Sektor
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sektoren</CardTitle>
            <CardDescription>
              Verwalten Sie alle Sektoren der Platform
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
