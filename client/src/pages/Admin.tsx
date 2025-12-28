import { useState } from "react";
import { trpc } from "../lib/trpc";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { ArrowLeft, Settings, Shield, Database, FileText, Key, Activity } from "lucide-react";
import { DataQualityDashboard } from "../components/DataQualityDashboard";
import { AlertManagement } from "../components/AlertManagement";
import { Link } from "wouter";
import { Breadcrumb } from "../components/Breadcrumb";
import { AdminTopbar } from "../components/AdminTopbar";

interface AdminProps {
  onBackClick?: () => void;
}

export function Admin({ onBackClick }: AdminProps) {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="container mx-auto max-w-7xl">
        {/* Header with Breadcrumb */}
        <div className="mb-8">
          <Breadcrumb
            items={[
              { label: "Home", href: "/" },
              { label: "Admin", href: "/admin" },
            ]}
          />
          
          <div className="flex items-center justify-between mt-4">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">Admin-Bereich</h1>
              <p className="text-muted-foreground">Verwaltung und Konfiguration Ihrer Portfolio-Anwendung</p>
            </div>
            {onBackClick && (
              <Button
                variant="outline"
                onClick={onBackClick}
                className="border-slate-700 hover:bg-slate-800"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Zurück
              </Button>
            )}
          </div>
        </div>

        {/* Admin Navigation Tabs */}
        <AdminTopbar />

        {/* System Management Category */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-white mb-4 flex items-center gap-2">
            <Settings className="h-6 w-6 text-teal-500" />
            System-Verwaltung
          </h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Link href="/admin/secrets">
              <Card className="gradient-card border-border/50 hover:border-teal-500 transition-colors cursor-pointer h-full">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Key className="h-5 w-5 text-teal-500" />
                    API Secrets
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Verwalten Sie verschlüsselte API-Schlüssel für externe Dienste
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>

            <Link href="/admin/test-secrets">
              <Card className="gradient-card border-border/50 hover:border-teal-500 transition-colors cursor-pointer h-full">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Activity className="h-5 w-5 text-teal-500" />
                    API Secrets Testen
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Testen Sie die Verfügbarkeit und Funktionalität aller APIs
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>

            <Link href="/admin/logs">
              <Card className="gradient-card border-border/50 hover:border-teal-500 transition-colors cursor-pointer h-full">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <FileText className="h-5 w-5 text-teal-500" />
                    Server Logs
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Überwachen Sie Fehler und Systemereignisse in Echtzeit
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          </div>
        </div>

        {/* Data Quality & Monitoring Category */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-white mb-4 flex items-center gap-2">
            <Database className="h-6 w-6 text-blue-500" />
            Datenqualität & Überwachung
          </h2>
          
          {/* Data Quality Dashboard */}
          <Card className="gradient-card border-border/50 mb-6">
            <CardHeader>
              <CardTitle className="text-white">Datenqualität-Dashboard</CardTitle>
              <CardDescription className="text-muted-foreground">
                Überblick über Metriken-Vollständigkeit und Datenqualität
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DataQualityDashboard />
            </CardContent>
          </Card>

          {/* Alert Management */}
          <Card className="gradient-card border-border/50">
            <CardHeader>
              <CardTitle className="text-white">Metriken-Alerts</CardTitle>
              <CardDescription className="text-muted-foreground">
                Konfigurieren Sie Benachrichtigungen für Metriken-Änderungen (Sharpe Ratio, Dividende, etc.)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AlertManagement />
            </CardContent>
          </Card>
        </div>

        {/* Content Management Category */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-white mb-4 flex items-center gap-2">
            <Shield className="h-6 w-6 text-purple-500" />
            Inhalts-Verwaltung
          </h2>
          <div className="grid gap-6 md:grid-cols-2">
            <Link href="/admin/categories">
              <Card className="gradient-card border-border/50 hover:border-purple-500 transition-colors cursor-pointer h-full">
                <CardHeader>
                  <CardTitle className="text-white">Kategorien</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Verwalten Sie Aktien-Kategorien und Zuordnungen
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>

            <Link href="/admin/sectors">
              <Card className="gradient-card border-border/50 hover:border-purple-500 transition-colors cursor-pointer h-full">
                <CardHeader>
                  <CardTitle className="text-white">Sektoren</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Verwalten Sie Branchen-Sektoren und Klassifizierungen
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          </div>
        </div>

        {/* Quick Actions */}
        <Card className="bg-gradient-to-r from-slate-800 to-slate-700 border-border">
          <CardHeader>
            <CardTitle className="text-white">Schnellzugriff</CardTitle>
            <CardDescription className="text-foreground">
              Häufig verwendete Admin-Funktionen
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Link href="/admin/secrets">
                <Button variant="outline" className="border-teal-500 text-teal-400 hover:bg-teal-500/10">
                  <Key className="mr-2 h-4 w-4" />
                  API-Keys verwalten
                </Button>
              </Link>
              <Link href="/admin/test-secrets">
                <Button variant="outline" className="border-blue-500 text-blue-400 hover:bg-blue-500/10">
                  <Activity className="mr-2 h-4 w-4" />
                  APIs testen
                </Button>
              </Link>
              <Link href="/admin/logs">
                <Button variant="outline" className="border-orange-500 text-orange-400 hover:bg-orange-500/10">
                  <FileText className="mr-2 h-4 w-4" />
                  Logs anzeigen
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default Admin;
