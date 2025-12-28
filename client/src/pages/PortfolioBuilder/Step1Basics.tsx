import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, DollarSign, Scale } from "lucide-react";

interface Step1BasicsProps {
  data: {
    name: string;
    description: string;
    strategy: 'growth' | 'dividends' | 'balanced' | '';
    investmentHorizon: 'short' | 'medium' | 'long' | '';
  };
  onChange: (field: string, value: string) => void;
}

export default function Step1Basics({ data, onChange }: Step1BasicsProps) {
  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Neues Portfolio erstellen</h2>
        <p className="text-slate-400">Definiere die Grundlagen für dein Portfolio</p>
      </div>

      {/* Portfolio Name */}
      <div className="space-y-2">
        <Label htmlFor="name" className="text-white">Portfolio Name *</Label>
        <Input
          id="name"
          value={data.name}
          onChange={(e) => onChange('name', e.target.value)}
          placeholder="z.B. Mein Wachstumsportfolio"
          className="bg-[#0f1420] border-white/10 text-white"
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description" className="text-white">Beschreibung (optional)</Label>
        <Textarea
          id="description"
          value={data.description}
          onChange={(e) => onChange('description', e.target.value)}
          placeholder="Beschreibe deine Anlagestrategie..."
          className="bg-[#0f1420] border-white/10 text-white min-h-[100px]"
        />
      </div>

      {/* Strategy */}
      <div className="space-y-4">
        <Label className="text-white">Anlagestrategie *</Label>
        <RadioGroup
          value={data.strategy}
          onValueChange={(value) => onChange('strategy', value)}
          className="space-y-3"
        >
          <div
            className={`flex items-start space-x-3 p-4 rounded-lg border-2 transition-all cursor-pointer ${
              data.strategy === 'growth'
                ? 'border-[#00CFC1] bg-[#00CFC1]/10'
                : 'border-white/10 bg-[#0f1420]/50 hover:border-white/20'
            }`}
            onClick={() => onChange('strategy', 'growth')}
          >
            <RadioGroupItem value="growth" id="growth" className="mt-1" />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-5 w-5 text-[#00CFC1]" />
                <Label htmlFor="growth" className="text-white font-semibold cursor-pointer">
                  Wachstum
                </Label>
              </div>
              <p className="text-sm text-slate-400">
                Fokus auf Kapitalwachstum durch Investitionen in wachstumsstarke Unternehmen.
                Höheres Risiko, höheres Renditepotenzial.
              </p>
            </div>
          </div>

          <div
            className={`flex items-start space-x-3 p-4 rounded-lg border-2 transition-all cursor-pointer ${
              data.strategy === 'dividends'
                ? 'border-[#00CFC1] bg-[#00CFC1]/10'
                : 'border-white/10 bg-[#0f1420]/50 hover:border-white/20'
            }`}
            onClick={() => onChange('strategy', 'dividends')}
          >
            <RadioGroupItem value="dividends" id="dividends" className="mt-1" />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="h-5 w-5 text-green-400" />
                <Label htmlFor="dividends" className="text-white font-semibold cursor-pointer">
                  Dividenden
                </Label>
              </div>
              <p className="text-sm text-slate-400">
                Regelmässige Einnahmen durch dividendenstarke Aktien. Fokus auf stabile,
                etablierte Unternehmen mit hoher Ausschüttungsquote.
              </p>
            </div>
          </div>

          <div
            className={`flex items-start space-x-3 p-4 rounded-lg border-2 transition-all cursor-pointer ${
              data.strategy === 'balanced'
                ? 'border-[#00CFC1] bg-[#00CFC1]/10'
                : 'border-white/10 bg-[#0f1420]/50 hover:border-white/20'
            }`}
            onClick={() => onChange('strategy', 'balanced')}
          >
            <RadioGroupItem value="balanced" id="balanced" className="mt-1" />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Scale className="h-5 w-5 text-blue-400" />
                <Label htmlFor="balanced" className="text-white font-semibold cursor-pointer">
                  Ausgewogen
                </Label>
              </div>
              <p className="text-sm text-slate-400">
                Ausgewogene Mischung aus Wachstum und Dividenden. Diversifiziertes Portfolio
                mit moderatem Risiko und stabilen Erträgen.
              </p>
            </div>
          </div>
        </RadioGroup>
      </div>

      {/* Investment Horizon */}
      <div className="space-y-2">
        <Label htmlFor="horizon" className="text-white">Anlagehorizont *</Label>
        <Select value={data.investmentHorizon} onValueChange={(value) => onChange('investmentHorizon', value)}>
          <SelectTrigger className="bg-[#0f1420] border-white/10 text-white">
            <SelectValue placeholder="Wähle deinen Anlagehorizont" />
          </SelectTrigger>
          <SelectContent className="bg-[#0f1420] border-white/10">
            <SelectItem value="short" className="text-white hover:bg-white/10">
              Kurzfristig (&lt; 3 Jahre)
            </SelectItem>
            <SelectItem value="medium" className="text-white hover:bg-white/10">
              Mittelfristig (3-7 Jahre)
            </SelectItem>
            <SelectItem value="long" className="text-white hover:bg-white/10">
              Langfristig (&gt; 7 Jahre)
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
