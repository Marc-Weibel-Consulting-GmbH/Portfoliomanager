/**
 * AnlageprofilWizard — geführter Fragebogen (Anlegerprofil 2.0, Stufe P1).
 * Fünf Schritte → Auswertung (Fähigkeit/Bereitschaft/Bedarf) → speichert das aktive
 * Profil und die Bewertung. Klartext, ein Thema pro Schritt (50+-tauglich).
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";

type Answers = {
  goal: "dividends" | "growth" | "balanced";
  horizonYears: number;
  purpose: "aufbau" | "entnahme" | "vorsorge";
  wealthBand: "u50" | "b50_250" | "b250_1m" | "o1m";
  savingsRateBand: "keine" | "niedrig" | "mittel" | "hoch";
  liquidityReserveBand: "u3m" | "b3_6m" | "b6_12m" | "o12m";
  incomeStability: "niedrig" | "mittel" | "hoch";
  drawdownReaction: "nachkaufen" | "halten" | "teilverkauf" | "verkauf";
  lossComfortPct: number;
  experienceWithLosses: "ja_ok" | "ja_unruhig" | "nein";
  knowledgeLevel: "einsteiger" | "fortgeschritten" | "erfahren";
  excludedSectors: string[];
  esgOnly: boolean;
  targetReturnPct: number | null;
  liquidityNeedPct: number;
};

const DEFAULTS: Answers = {
  goal: "balanced", horizonYears: 10, purpose: "aufbau",
  wealthBand: "b50_250", savingsRateBand: "mittel", liquidityReserveBand: "b3_6m", incomeStability: "mittel",
  drawdownReaction: "halten", lossComfortPct: 20, experienceWithLosses: "ja_unruhig",
  knowledgeLevel: "fortgeschritten",
  excludedSectors: [], esgOnly: false, targetReturnPct: null, liquidityNeedPct: 0,
};

// DB-Sektornamen (Werte) mit Anzeige-Label — müssen mit buildProposal übereinstimmen.
const SECTOR_OPTIONS = [
  { value: "Energy", label: "Energie (u. a. Öl & Gas)" },
  { value: "Industrials", label: "Industrie (u. a. Rüstung)" },
  { value: "Consumer", label: "Basiskonsum (u. a. Alkohol & Tabak)" },
  { value: "Consumer Cyclical", label: "Zyklischer Konsum (u. a. Glücksspiel, Handel, Reisen)" },
  { value: "Finance", label: "Finanzsektor" },
  { value: "Telecommunications", label: "Telekommunikation" },
];
const STEP_TITLES = ["Ziel & Horizont", "Finanzielle Situation", "Risikobereitschaft", "Kenntnisse", "Präferenzen"];

function Chips<T extends string>({ value, options, onChange, cols = 2 }: {
  value: T; options: { value: T; label: string; hint?: string }[]; onChange: (v: T) => void; cols?: number;
}) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`text-left rounded-lg border px-3 py-2.5 transition-colors ${
              active
                ? "border-[#00CFC1] bg-[#00CFC1]/10 text-white"
                : "border-white/10 bg-white/[0.02] text-gray-300 hover:border-white/30"
            }`}
          >
            <div className="text-sm font-medium">{o.label}</div>
            {o.hint && <div className="text-xs text-gray-500 mt-0.5">{o.hint}</div>}
          </button>
        );
      })}
    </div>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

export default function AnlageprofilWizard({
  initialAnswers, onDone, onCancel,
}: { initialAnswers?: Partial<Answers>; onDone: () => void; onCancel?: () => void }) {
  const [step, setStep] = useState(0);
  const [a, setA] = useState<Answers>({ ...DEFAULTS, ...initialAnswers });
  const set = (patch: Partial<Answers>) => setA((prev) => ({ ...prev, ...patch }));

  const save = trpc.investmentProfile.saveAssessment.useMutation({
    onSuccess: (r) => {
      toast.success(`Profil ermittelt: ${r.result.bindingProfile}`);
      onDone();
    },
    onError: (e) => toast.error(`Fehler: ${e.message}`),
  });

  const toggleSector = (s: string) =>
    set({ excludedSectors: a.excludedSectors.includes(s) ? a.excludedSectors.filter((x) => x !== s) : [...a.excludedSectors, s] });

  const isLast = step === STEP_TITLES.length - 1;
  const progress = ((step + 1) / STEP_TITLES.length) * 100;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#00CFC1]" /> Anlageprofil-Assistent
            </CardTitle>
            <CardDescription>Schritt {step + 1} von {STEP_TITLES.length} · {STEP_TITLES[step]}</CardDescription>
          </div>
          {onCancel && (
            <button onClick={onCancel} className="text-xs text-gray-400 hover:text-white">Abbrechen</button>
          )}
        </div>
        <div className="h-1.5 rounded bg-white/10 mt-3">
          <div className="h-1.5 rounded bg-[#00CFC1] transition-all" style={{ width: `${progress}%` }} />
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Schritt 1 — Ziel & Horizont */}
        {step === 0 && (
          <>
            <Field label="Wofür legen Sie an?">
              <Chips value={a.purpose} cols={3} onChange={(v) => set({ purpose: v })} options={[
                { value: "aufbau", label: "Vermögensaufbau" },
                { value: "entnahme", label: "Regelmässige Entnahme" },
                { value: "vorsorge", label: "Vorsorge" },
              ]} />
            </Field>
            <Field label="Was möchten Sie erreichen?">
              <Chips value={a.goal} cols={3} onChange={(v) => set({ goal: v })} options={[
                { value: "dividends", label: "Ertrag / Dividenden" },
                { value: "growth", label: "Wachstum" },
                { value: "balanced", label: "Ausgewogen" },
              ]} />
            </Field>
            <Field label="Anlagehorizont (Jahre)" hint="Wie lange können Sie das Geld investiert lassen?">
              <Input type="number" min={1} max={50} value={a.horizonYears}
                onChange={(e) => set({ horizonYears: Number(e.target.value) })} />
            </Field>
          </>
        )}

        {/* Schritt 2 — Finanzielle Situation */}
        {step === 1 && (
          <>
            <Field label="Anlagevermögen (frei verfügbar)">
              <Chips value={a.wealthBand} cols={2} onChange={(v) => set({ wealthBand: v })} options={[
                { value: "u50", label: "bis 50'000" },
                { value: "b50_250", label: "50'000 – 250'000" },
                { value: "b250_1m", label: "250'000 – 1 Mio." },
                { value: "o1m", label: "über 1 Mio." },
              ]} />
            </Field>
            <Field label="Monatliche Sparquote">
              <Chips value={a.savingsRateBand} cols={4} onChange={(v) => set({ savingsRateBand: v })} options={[
                { value: "keine", label: "Keine" },
                { value: "niedrig", label: "Niedrig" },
                { value: "mittel", label: "Mittel" },
                { value: "hoch", label: "Hoch" },
              ]} />
            </Field>
            <Field label="Liquiditätsreserve" hint="Notgroschen ausserhalb der Anlage, in Monatsausgaben.">
              <Chips value={a.liquidityReserveBand} cols={4} onChange={(v) => set({ liquidityReserveBand: v })} options={[
                { value: "u3m", label: "< 3 Mte." },
                { value: "b3_6m", label: "3–6 Mte." },
                { value: "b6_12m", label: "6–12 Mte." },
                { value: "o12m", label: "> 12 Mte." },
              ]} />
            </Field>
            <Field label="Stabilität Ihres Einkommens">
              <Chips value={a.incomeStability} cols={3} onChange={(v) => set({ incomeStability: v })} options={[
                { value: "niedrig", label: "Eher unsicher" },
                { value: "mittel", label: "Mittel" },
                { value: "hoch", label: "Sehr stabil" },
              ]} />
            </Field>
          </>
        )}

        {/* Schritt 3 — Risikobereitschaft */}
        {step === 2 && (
          <>
            <Field label="Ihr Depot fällt in drei Monaten um 20 %. Was tun Sie?">
              <Chips value={a.drawdownReaction} cols={2} onChange={(v) => set({ drawdownReaction: v })} options={[
                { value: "nachkaufen", label: "Nachkaufen", hint: "Gelegenheit" },
                { value: "halten", label: "Halten", hint: "Aussitzen" },
                { value: "teilverkauf", label: "Teil verkaufen", hint: "Ruhe finden" },
                { value: "verkauf", label: "Alles verkaufen", hint: "Verluste stoppen" },
              ]} />
            </Field>
            <Field label="Maximal tolerierter Jahresverlust (%)" hint="Ab welchem Verlust würden Sie ernsthaft nervös?">
              <Input type="number" min={5} max={80} value={a.lossComfortPct}
                onChange={(e) => set({ lossComfortPct: Number(e.target.value) })} />
            </Field>
            <Field label="Haben Sie schon einmal einen grösseren Kursrückgang erlebt?">
              <Chips value={a.experienceWithLosses} cols={3} onChange={(v) => set({ experienceWithLosses: v })} options={[
                { value: "ja_ok", label: "Ja, blieb ruhig" },
                { value: "ja_unruhig", label: "Ja, war unruhig" },
                { value: "nein", label: "Nein" },
              ]} />
            </Field>
          </>
        )}

        {/* Schritt 4 — Kenntnisse */}
        {step === 3 && (
          <Field label="Wie vertraut sind Sie mit Aktien, ETFs und Anleihen?"
                 hint="Bestimmt, welche Instrumente Ihnen vorgeschlagen werden.">
            <Chips value={a.knowledgeLevel} cols={3} onChange={(v) => set({ knowledgeLevel: v })} options={[
              { value: "einsteiger", label: "Einsteiger", hint: "Wenig Erfahrung" },
              { value: "fortgeschritten", label: "Fortgeschritten", hint: "Grundlagen sicher" },
              { value: "erfahren", label: "Erfahren", hint: "Handle selbst aktiv" },
            ]} />
          </Field>
        )}

        {/* Schritt 5 — Präferenzen */}
        {step === 4 && (
          <>
            <Field label="Ausgeschlossene Sektoren">
              <div className="flex flex-wrap gap-2">
                {SECTOR_OPTIONS.map((s) => {
                  const active = a.excludedSectors.includes(s.value);
                  return (
                    <button key={s.value} type="button" onClick={() => toggleSector(s.value)}
                      className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                        active ? "bg-red-500/20 text-red-400 border-red-500/40"
                               : "bg-white/5 text-gray-300 border-white/10 hover:border-white/30"}`}>
                      {active ? "✕ " : "+ "}{s.label}
                    </button>
                  );
                })}
              </div>
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={a.esgOnly}
                onChange={(e) => set({ esgOnly: e.target.checked })} className="h-4 w-4 accent-[#00CFC1]" />
              Nur nachhaltige Anlagen (ESG)
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Zielrendite p.a. (%, optional)">
                <Input type="number" min={0} max={100} step="0.5"
                  value={a.targetReturnPct ?? ""} placeholder="z.B. 6"
                  onChange={(e) => set({ targetReturnPct: e.target.value === "" ? null : Number(e.target.value) })} />
              </Field>
              <Field label="Liquiditätsbedarf / Cash-Quote (%)">
                <Input type="number" min={0} max={100} value={a.liquidityNeedPct}
                  onChange={(e) => set({ liquidityNeedPct: Number(e.target.value) })} />
              </Field>
            </div>
          </>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-2 border-t border-white/10">
          <Button variant="outline" disabled={step === 0} onClick={() => setStep((s) => s - 1)}
            className="border-white/10 text-gray-300">
            <ChevronLeft className="h-4 w-4 mr-1" /> Zurück
          </Button>
          {!isLast ? (
            <Button onClick={() => setStep((s) => s + 1)} className="bg-[#00CFC1] text-black hover:bg-[#00CFC1]/80">
              Weiter <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={() => save.mutate(a)} disabled={save.isPending}
              className="bg-[#00CFC1] text-black hover:bg-[#00CFC1]/80">
              {save.isPending ? "Wird ausgewertet…" : "Auswerten & speichern"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
