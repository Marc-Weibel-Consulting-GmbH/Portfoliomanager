import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";

interface PortfolioAdjustmentDialogProps {
  open: boolean;
  onClose: () => void;
  currentInputs: {
    investmentAmount: number;
    expectedDividendYield: number;
    numberOfPositions: number;
    investorType: "conservative" | "balanced" | "dynamic";
  };
  onAdjust: (newInputs: {
    investmentAmount: number;
    expectedDividendYield: number;
    numberOfPositions: number;
    investorType: "conservative" | "balanced" | "dynamic";
  }) => void;
}

export default function PortfolioAdjustmentDialog({
  open,
  onClose,
  currentInputs,
  onAdjust,
}: PortfolioAdjustmentDialogProps) {
  const [changeInvestment, setChangeInvestment] = useState(false);
  const [changeDividend, setChangeDividend] = useState(false);
  const [changePositions, setChangePositions] = useState(false);
  const [changeProfile, setChangeProfile] = useState(false);

  const [investmentAmount, setInvestmentAmount] = useState(currentInputs.investmentAmount);
  const [expectedDividendYield, setExpectedDividendYield] = useState(currentInputs.expectedDividendYield);
  const [numberOfPositions, setNumberOfPositions] = useState(currentInputs.numberOfPositions);
  const [investorType, setInvestorType] = useState(currentInputs.investorType);

  const handleSubmit = () => {
    const newInputs = {
      investmentAmount: changeInvestment ? investmentAmount : currentInputs.investmentAmount,
      expectedDividendYield: changeDividend ? expectedDividendYield : currentInputs.expectedDividendYield,
      numberOfPositions: changePositions ? numberOfPositions : currentInputs.numberOfPositions,
      investorType: changeProfile ? investorType : currentInputs.investorType,
    };
    onAdjust(newInputs);
    onClose();
  };

  const investorTypeLabels = {
    conservative: "Konservativ",
    balanced: "Ausgewogen",
    dynamic: "Dynamisch",
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">📊 Portfolio anpassen</DialogTitle>
          <p className="text-slate-400 text-sm mt-2">
            Wählen Sie die Parameter, die Sie ändern möchten
          </p>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Investment Amount */}
          <div className="flex items-start gap-3">
            <Checkbox
              checked={changeInvestment}
              onCheckedChange={(checked) => setChangeInvestment(checked as boolean)}
              className="mt-1"
            />
            <div className="flex-1">
              <Label className="text-white">Investitionsbetrag</Label>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-slate-400 text-sm">CHF</span>
                <Input
                  type="number"
                  value={investmentAmount}
                  onChange={(e) => setInvestmentAmount(Number(e.target.value))}
                  disabled={!changeInvestment}
                  className="bg-slate-700 border-slate-600 text-white disabled:opacity-50"
                  min={10000}
                  step={1000}
                />
              </div>
            </div>
          </div>

          {/* Dividend Yield */}
          <div className="flex items-start gap-3">
            <Checkbox
              checked={changeDividend}
              onCheckedChange={(checked) => setChangeDividend(checked as boolean)}
              className="mt-1"
            />
            <div className="flex-1">
              <Label className="text-white">Dividendenrendite</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  type="number"
                  value={expectedDividendYield}
                  onChange={(e) => setExpectedDividendYield(Number(e.target.value))}
                  disabled={!changeDividend}
                  className="bg-slate-700 border-slate-600 text-white disabled:opacity-50"
                  min={0}
                  max={10}
                  step={0.1}
                />
                <span className="text-slate-400 text-sm">%</span>
              </div>
            </div>
          </div>

          {/* Number of Positions */}
          <div className="flex items-start gap-3">
            <Checkbox
              checked={changePositions}
              onCheckedChange={(checked) => setChangePositions(checked as boolean)}
              className="mt-1"
            />
            <div className="flex-1">
              <Label className="text-white">Anzahl Titel</Label>
              <Input
                type="number"
                value={numberOfPositions}
                onChange={(e) => setNumberOfPositions(Number(e.target.value))}
                disabled={!changePositions}
                className="bg-slate-700 border-slate-600 text-white disabled:opacity-50 mt-1"
                min={5}
                max={30}
                step={1}
              />
            </div>
          </div>

          {/* Investor Profile */}
          <div className="flex items-start gap-3">
            <Checkbox
              checked={changeProfile}
              onCheckedChange={(checked) => setChangeProfile(checked as boolean)}
              className="mt-1"
            />
            <div className="flex-1">
              <Label className="text-white">Anlegerprofil</Label>
              <Select
                value={investorType}
                onValueChange={(value) => setInvestorType(value as "conservative" | "balanced" | "dynamic")}
                disabled={!changeProfile}
              >
                <SelectTrigger className="bg-slate-700 border-slate-600 text-white disabled:opacity-50 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-700 border-slate-600">
                  <SelectItem value="conservative" className="text-white hover:bg-slate-600">
                    Konservativ
                  </SelectItem>
                  <SelectItem value="balanced" className="text-white hover:bg-slate-600">
                    Ausgewogen
                  </SelectItem>
                  <SelectItem value="dynamic" className="text-white hover:bg-slate-600">
                    Dynamisch
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button
            onClick={onClose}
            variant="outline"
            className="flex-1 border-slate-600 text-white hover:bg-slate-700"
          >
            Abbrechen
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!changeInvestment && !changeDividend && !changePositions && !changeProfile}
            className="flex-1 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50"
          >
            Übernehmen
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

