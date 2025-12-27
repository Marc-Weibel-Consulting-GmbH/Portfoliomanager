import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, Calendar, Plus, Clock } from "lucide-react";

export default function Reports() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
            <p className="text-muted-foreground mt-1">
              Erstellen und verwalten Sie Portfolio-Reports
            </p>
          </div>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Neuer Report
          </Button>
        </div>

        {/* Report Templates */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Report-Vorlagen</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="cursor-pointer hover:border-primary transition-colors">
              <CardHeader>
                <FileText className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-lg">Performance-Report</CardTitle>
                <CardDescription>
                  Detaillierte Performance-Analyse mit Charts
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full">
                  Report erstellen
                </Button>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:border-primary transition-colors">
              <CardHeader>
                <FileText className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-lg">Steuer-Report</CardTitle>
                <CardDescription>
                  Realisierte Gewinne/Verluste für Steuererklärung
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full">
                  Report erstellen
                </Button>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:border-primary transition-colors">
              <CardHeader>
                <FileText className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-lg">Dividenden-Report</CardTitle>
                <CardDescription>
                  Übersicht aller Dividendenzahlungen
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full">
                  Report erstellen
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Scheduled Reports */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  <CardTitle>Geplante Reports</CardTitle>
                </div>
                <CardDescription className="mt-1">
                  Automatisch generierte Reports nach Zeitplan
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Zeitplan hinzufügen
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Calendar className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Keine geplanten Reports</h3>
                <p className="text-sm text-muted-foreground max-w-md mb-6">
                  Erstellen Sie automatische Reports, die täglich, wöchentlich oder monatlich generiert werden.
                </p>
                <Button variant="outline">
                  Ersten Zeitplan erstellen
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Reports */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              <CardTitle>Letzte Reports</CardTitle>
            </div>
            <CardDescription>
              Ihre zuletzt erstellten Reports
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Noch keine Reports</h3>
                <p className="text-sm text-muted-foreground max-w-md mb-6">
                  Erstellen Sie Ihren ersten Report, um detaillierte Portfolio-Analysen als PDF zu exportieren.
                </p>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Ersten Report erstellen
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Custom Report Builder */}
        <Card>
          <CardHeader>
            <CardTitle>Individueller Report-Builder</CardTitle>
            <CardDescription>
              Erstellen Sie maßgeschneiderte Reports mit eigenen Inhalten
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Custom Report Builder</h3>
              <p className="text-sm text-muted-foreground max-w-md mb-6">
                Wählen Sie aus verschiedenen Modulen und erstellen Sie Ihren perfekten Report.
              </p>
              <Button>Builder öffnen</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
