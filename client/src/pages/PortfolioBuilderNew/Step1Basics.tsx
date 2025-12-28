import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TrendingUp, DollarSign, Scale } from "lucide-react";
import { PortfolioBuilderState } from "../PortfolioBuilderNew";

interface Step1BasicsProps {
  state: PortfolioBuilderState;
  updateState: (updates: Partial<PortfolioBuilderState>) => void;
}

export default function Step1Basics({ state, updateState }: Step1BasicsProps) {
  const strategies = [
    {
      id: 'growth' as const,
      icon: TrendingUp,
      title: 'Wachstum',
      description: 'Fokus auf Kapitalwachstum und hohe Renditen',
      color: 'text-blue-400',
    },
    {
      id: 'dividends' as const,
      icon: DollarSign,
      title: 'Dividenden',
      description: 'Regelmässige Erträge durch Dividenden',
      color: 'text-green-400',
    },
    {
      id: 'balanced' as const,
      icon: Scale,
      title: 'Ausgewogen',
      description: 'Balance zwischen Wachstum und Dividenden',
      color: 'text-purple-400',
    },
  ];

  const horizons = [
    { id: 'short' as const, label: 'Kurzfristig', description: '< 3 Jahre' },
    { id: 'medium' as const, label: 'Mittelfristig', description: '3-7 Jahre' },
    { id: 'long' as const, label: 'Langfristig', description: '> 7 Jahre' },
  ];

  return (
    <div className="space-y-6">
      <Card className="bg-[#0f1420]/50 border-white/10">
        <CardHeader>
          <CardTitle className="text-white">Portfolio-Grundlagen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Portfolio Name */}
          <div className="space-y-2">
            <Label htmlFor="portfolioName" className="text-white">
              Portfolio-Name *
            </Label>
            <Input
              id="portfolioName"
              placeholder="z.B. Mein Wachstumsportfolio"
              value={state.portfolioName}
              onChange={(e) => updateState({ portfolioName: e.target.value })}
              className="bg-[#0a0f1a] border-white/10 text-white"
            />
            {state.portfolioName.length > 0 && state.portfolioName.length < 3 && (
              <p className="text-xs text-red-400">Mindestens 3 Zeichen erforderlich</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-white">
              Beschreibung (optional)
            </Label>
            <Textarea
              id="description"
              placeholder="Beschreibe deine Anlagestrategie..."
              value={state.description}
              onChange={(e) => updateState({ description: e.target.value })}
              className="bg-[#0a0f1a] border-white/10 text-white min-h-[100px]"
            />
          </div>
        </CardContent>
      </Card>

      {/* Strategy Selection */}
      <Card className="bg-[#0f1420]/50 border-white/10">
        <CardHeader>
          <CardTitle className="text-white">Anlagestrategie *</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {strategies.map((strategy) => {
              const Icon = strategy.icon;
              const isSelected = state.strategy === strategy.id;
              return (
                <button
                  key={strategy.id}
                  onClick={() => updateState({ strategy: strategy.id })}
                  className={`p-6 rounded-lg border-2 transition-all text-left ${
                    isSelected
                      ? "border-[#00CFC1] bg-[#00CFC1]/10"
                      : "border-white/10 bg-[#0a0f1a] hover:border-white/20"
                  }`}
                >
                  <Icon className={`h-8 w-8 mb-3 ${isSelected ? "text-[#00CFC1]" : strategy.color}`} />
                  <h3 className="text-lg font-semibold text-white mb-2">{strategy.title}</h3>
                  <p className="text-sm text-gray-400">{strategy.description}</p>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Investment Horizon */}
      <Card className="bg-[#0f1420]/50 border-white/10">
        <CardHeader>
          <CardTitle className="text-white">Anlagehorizont *</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {horizons.map((horizon) => {
              const isSelected = state.investmentHorizon === horizon.id;
              return (
                <button
                  key={horizon.id}
                  onClick={() => updateState({ investmentHorizon: horizon.id })}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    isSelected
                      ? "border-[#00CFC1] bg-[#00CFC1]/10"
                      : "border-white/10 bg-[#0a0f1a] hover:border-white/20"
                  }`}
                >
                  <h3 className="text-base font-semibold text-white mb-1">{horizon.label}</h3>
                  <p className="text-sm text-gray-400">{horizon.description}</p>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      {state.portfolioName && state.strategy && state.investmentHorizon && (
        <Card className="bg-[#00CFC1]/10 border-[#00CFC1]/30">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-[#00CFC1] mt-2"></div>
              <div>
                <p className="text-white font-medium">Bereit für den nächsten Schritt!</p>
                <p className="text-sm text-gray-300 mt-1">
                  Du erstellst ein <span className="font-semibold">{state.strategy === 'growth' ? 'Wachstums' : state.strategy === 'dividends' ? 'Dividenden' : 'Ausgewogenes'}</span>-Portfolio 
                  mit <span className="font-semibold">{state.investmentHorizon === 'short' ? 'kurzfristigem' : state.investmentHorizon === 'medium' ? 'mittelfristigem' : 'langfristigem'}</span> Anlagehorizont.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
