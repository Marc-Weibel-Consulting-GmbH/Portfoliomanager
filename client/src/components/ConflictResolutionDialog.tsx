import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";

interface ConflictResolutionDialogProps {
  open: boolean;
  onClose: () => void;
  onResolve: (strategy: "dividend" | "sharpe" | "balanced" | "reduce_positions") => void;
  conflict: {
    targetDividend: number;
    achievedDividend: number;
    targetSharpe: number;
    achievedSharpe: number;
    currentPositions: number;
    suggestedPositions?: number;
  };
}

export default function ConflictResolutionDialog({
  open,
  onClose,
  onResolve,
  conflict,
}: ConflictResolutionDialogProps) {
  const [selectedStrategy, setSelectedStrategy] = useState<"dividend" | "sharpe" | "balanced" | "reduce_positions">("balanced");

  const handleResolve = () => {
    onResolve(selectedStrategy);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <AlertTriangle className="w-6 h-6 text-yellow-500" />
            Zielkonflikt erkannt
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-slate-300">
            Ihre Anforderungen können nicht gleichzeitig optimal erfüllt werden:
          </p>

          <div className="bg-slate-900 p-4 rounded-lg space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-400">Ziel-Dividende:</span>
              <span className="text-white font-bold">{conflict.targetDividend.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Erreichte Dividende:</span>
              <span className={conflict.achievedDividend < conflict.targetDividend ? "text-yellow-400" : "text-green-400"}>
                {conflict.achievedDividend.toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between border-t border-slate-700 pt-2 mt-2">
              <span className="text-slate-400">Optimale Sharpe Ratio:</span>
              <span className="text-white font-bold">{conflict.targetSharpe.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Erreichte Sharpe Ratio:</span>
              <span className={conflict.achievedSharpe < conflict.targetSharpe ? "text-yellow-400" : "text-green-400"}>
                {conflict.achievedSharpe.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-slate-300 font-medium">Wählen Sie Ihre Priorität:</p>
            
            <RadioGroup value={selectedStrategy} onValueChange={(value: any) => setSelectedStrategy(value)}>
              <div className="space-y-3">
                <div className="flex items-start space-x-3 p-3 rounded-lg border border-slate-700 hover:border-cyan-600 hover:bg-slate-750 transition-colors">
                  <RadioGroupItem value="dividend" id="dividend" className="mt-1" />
                  <Label htmlFor="dividend" className="cursor-pointer flex-1">
                    <div className="font-medium text-white">Dividende priorisieren</div>
                    <div className="text-sm text-slate-400 mt-1">
                      Erreicht {conflict.targetDividend.toFixed(1)}% Dividende, Sharpe Ratio ~{(conflict.targetSharpe * 0.85).toFixed(2)}
                    </div>
                  </Label>
                </div>

                <div className="flex items-start space-x-3 p-3 rounded-lg border border-slate-700 hover:border-green-600 hover:bg-slate-750 transition-colors">
                  <RadioGroupItem value="sharpe" id="sharpe" className="mt-1" />
                  <Label htmlFor="sharpe" className="cursor-pointer flex-1">
                    <div className="font-medium text-white">Sharpe Ratio priorisieren</div>
                    <div className="text-sm text-slate-400 mt-1">
                      Erreicht Sharpe {conflict.targetSharpe.toFixed(2)}, Dividende ~{(conflict.targetDividend * 0.8).toFixed(1)}%
                    </div>
                  </Label>
                </div>

                <div className="flex items-start space-x-3 p-3 rounded-lg border border-slate-700 hover:border-blue-600 hover:bg-slate-750 transition-colors">
                  <RadioGroupItem value="balanced" id="balanced" className="mt-1" />
                  <Label htmlFor="balanced" className="cursor-pointer flex-1">
                    <div className="font-medium text-white">Ausgewogen (empfohlen)</div>
                    <div className="text-sm text-slate-400 mt-1">
                      Dividende {((conflict.targetDividend + conflict.achievedDividend) / 2).toFixed(1)}%, 
                      Sharpe {((conflict.targetSharpe + conflict.achievedSharpe) / 2).toFixed(2)}
                    </div>
                  </Label>
                </div>

                {conflict.suggestedPositions && conflict.suggestedPositions < conflict.currentPositions && (
                  <div className="flex items-start space-x-3 p-3 rounded-lg border border-slate-700 hover:border-purple-600 hover:bg-slate-750 transition-colors">
                    <RadioGroupItem value="reduce_positions" id="reduce_positions" className="mt-1" />
                    <Label htmlFor="reduce_positions" className="cursor-pointer flex-1">
                      <div className="font-medium text-white">Anzahl Positionen reduzieren</div>
                      <div className="text-sm text-slate-400 mt-1">
                        {conflict.suggestedPositions} Titel statt {conflict.currentPositions} → Beide Ziele erreichbar
                      </div>
                    </Label>
                  </div>
                )}
              </div>
            </RadioGroup>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleResolve}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              Übernehmen
            </Button>
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1 border-slate-600 text-white hover:bg-slate-700"
            >
              Abbrechen
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

