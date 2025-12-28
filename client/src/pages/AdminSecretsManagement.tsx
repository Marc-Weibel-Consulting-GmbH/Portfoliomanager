import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Key } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function AdminSecretsManagement() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Secrets-Verwaltung</h1>
            <p className="text-muted-foreground mt-2">
              API-Keys und Secrets sicher verwalten
            </p>
          </div>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Neues Secret
          </Button>
        </div>

        <Alert>
          <Key className="h-4 w-4" />
          <AlertDescription>
            Secrets werden verschlüsselt gespeichert und sind nur für autorisierte Benutzer sichtbar.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>API-Keys & Secrets</CardTitle>
            <CardDescription>
              Verwalten Sie alle Secrets der Platform
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
