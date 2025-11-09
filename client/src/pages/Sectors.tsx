import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

export default function Sectors() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const { data: sectors = [], isLoading } = trpc.sectors.list.useQuery();
  const { data: allStocks = [] } = trpc.stocks.getAll.useQuery();

  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-6">
            <p className="text-white">Nur für Administratoren zugänglich</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/admin")}
            className="text-white hover:bg-slate-800"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-3xl font-bold text-white">Branchen-Verwaltung</h1>
        </div>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Aktuelle Branchen</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-slate-400">Laden...</p>
            ) : sectors.length === 0 ? (
              <p className="text-slate-400">Keine Branchen gefunden</p>
            ) : (
              <div className="space-y-2">
                {sectors.map((sector, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg"
                  >
                    <div>
                      <h3 className="text-white font-medium">{sector}</h3>
                      <p className="text-sm text-slate-400">
                        {allStocks.filter(s => s.sector === sector).length} Aktien
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-6 p-4 bg-blue-900/20 border border-blue-700/50 rounded-lg">
          <p className="text-blue-200 text-sm">
            <strong>Hinweis:</strong> Branchen werden automatisch aus den Aktien-Daten geladen. 
            Um eine Branche zu ändern, bearbeiten Sie die entsprechende Aktie auf der Hauptseite.
          </p>
        </div>
      </div>
    </div>
  );
}
