import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import DashboardLayout from '@/components/DashboardLayout';

interface RechnerProps {
  onBackClick?: () => void;
}

export default function Rechner({ onBackClick }: RechnerProps) {
  return (
    <DashboardLayout>
    <div className="space-y-6">
      {onBackClick && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onBackClick}
          className="text-slate-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Zurück
        </Button>
      )}
      
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Rechner</h1>
        <p className="text-slate-400">
          Finanzrechner für Pension, Budget und Steuern
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Pensionsrechner</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-300">
              Berechne deine Altersvorsorge...
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Budgetrechner</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-300">
              Plane dein Budget...
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Steuerrechner</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-300">
              Berechne deine Steuern...
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
    </DashboardLayout>
  );
}
