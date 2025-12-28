import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PortfolioBuilderState, Position } from "../PortfolioBuilderNew";
import { ArrowRight, Info } from "lucide-react";

interface Step3BondsETFsProps {
  state: PortfolioBuilderState;
  addPosition: (position: Position) => void;
  removePosition: (ticker: string) => void;
  updatePosition: (ticker: string, updates: Partial<Position>) => void;
  onSkip: () => void;
}

export default function Step3BondsETFs({
  state,
  addPosition,
  removePosition,
  updatePosition,
  onSkip,
}: Step3BondsETFsProps) {
  const bondsAndETFs = state.positions.filter(p => p.type === 'bond' || p.type === 'etf');

  return (
    <div className="space-y-6">
      <Card className="bg-[#0f1420]/50 border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Info className="h-5 w-5 text-[#00CFC1]" />
            Anleihen & ETFs (Optional)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-[#00CFC1]/10 border border-[#00CFC1]/30 rounded-lg p-6 text-center">
            <p className="text-white mb-2">Dieser Schritt ist optional</p>
            <p className="text-gray-300 text-sm mb-6">
              Du hast bereits {state.positions.filter(p => p.type === 'stock').length} Aktien ausgewählt. 
              Du kannst Anleihen und ETFs hinzufügen, um dein Portfolio weiter zu diversifizieren, 
              oder direkt zum nächsten Schritt gehen.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="outline"
                onClick={onSkip}
                className="border-white/20"
              >
                <ArrowRight className="mr-2 h-4 w-4" />
                Überspringen
              </Button>
            </div>
          </div>

          {bondsAndETFs.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-white font-medium">Ausgewählte Anleihen & ETFs ({bondsAndETFs.length})</h3>
              {bondsAndETFs.map((position) => (
                <div
                  key={position.ticker}
                  className="bg-[#0a0f1a] border border-white/10 rounded-lg p-3 flex items-center justify-between"
                >
                  <div>
                    <p className="font-semibold text-white">{position.ticker}</p>
                    <p className="text-sm text-gray-400">{position.companyName}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-[#00CFC1] font-medium">{position.weight.toFixed(1)}%</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removePosition(position.ticker)}
                      className="text-red-400 hover:text-red-300"
                    >
                      Entfernen
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-[#0a0f1a]/50 border-white/10">
        <CardContent className="p-6 text-center text-gray-400">
          <p className="text-sm">
            Die Anleihen- und ETF-Auswahl wird in einer zukünftigen Version verfügbar sein.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
