import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TrendingUp, FolderOpen } from "lucide-react";
import { useLocation } from "wouter";

export default function PortfolioBuilderLanding() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[oklch(0.15_0.02_250)] via-[oklch(0.18_0.03_260)] to-[oklch(0.12_0.02_240)] flex items-center justify-center p-4">
      <div className="container max-w-4xl">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 mb-4">
            <TrendingUp className="w-10 h-10 text-cyan-400" />
            <h1 className="text-4xl font-bold text-white">Portfolio Optimizer</h1>
          </div>
          <p className="text-lg text-gray-300">
            Erstellen Sie ein neues optimiertes Portfolio oder wählen Sie ein bestehendes aus
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Create New Portfolio Card */}
          <Card className="bg-[oklch(0.20_0.03_250)] border-[oklch(0.30_0.04_260)] hover:border-cyan-400/50 transition-all duration-300 p-8 cursor-pointer group"
            onClick={() => setLocation("/portfolio-builder/wizard")}>
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-cyan-400/10 flex items-center justify-center group-hover:bg-cyan-400/20 transition-colors">
                <TrendingUp className="w-10 h-10 text-cyan-400" />
              </div>
              <h2 className="text-2xl font-semibold text-white">Neues Portfolio erstellen</h2>
              <p className="text-gray-400">
                Erstellen Sie ein neues optimiertes Portfolio basierend auf Ihren Anlagezielen und Risikoprofil
              </p>
              <Button 
                className="w-full bg-cyan-500 hover:bg-cyan-600 text-white font-semibold py-6 text-lg"
                onClick={(e) => {
                  e.stopPropagation();
                  setLocation("/portfolio-builder/wizard");
                }}
              >
                Jetzt erstellen
              </Button>
            </div>
          </Card>

          {/* Select Existing Portfolio Card */}
          <Card className="bg-[oklch(0.20_0.03_250)] border-[oklch(0.30_0.04_260)] hover:border-cyan-400/50 transition-all duration-300 p-8 cursor-pointer group"
            onClick={() => setLocation("/home")}>
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-cyan-400/10 flex items-center justify-center group-hover:bg-cyan-400/20 transition-colors">
                <FolderOpen className="w-10 h-10 text-cyan-400" />
              </div>
              <h2 className="text-2xl font-semibold text-white">Bestehendes Portfolio wählen</h2>
              <p className="text-gray-400">
                Öffnen Sie ein bereits gespeichertes Portfolio und analysieren Sie dessen Performance
              </p>
              <Button 
                className="w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold py-6 text-lg"
                onClick={(e) => {
                  e.stopPropagation();
                  setLocation("/home");
                }}
              >
                Portfolio laden
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
