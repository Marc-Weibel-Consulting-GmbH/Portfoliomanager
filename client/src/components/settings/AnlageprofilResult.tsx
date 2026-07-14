/**
 * AnlageprofilResult — Ergebnis-Dashboard (Anlegerprofil 2.0, Stufe P2).
 * Risiko-Tacho, Musterallokation, Klartext-Bandbreite und Zielkonflikt-Hinweise
 * aus der gespeicherten Bewertung. Reine Anzeige (keine Server-Änderung).
 */
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, AlertTriangle, Clock } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const RISK_LABEL: Record<string, string> = {
  konservativ: "Konservativ", ausgewogen: "Ausgewogen", wachstum: "Wachstum", aggressiv: "Aggressiv",
};
// Tacho-Winkel (0–180°) und langfristige Renditeerwartung je Profil (Richtwerte).
const PROFILE_META: Record<string, { angle: number; expReturn: number }> = {
  konservativ: { angle: 22, expReturn: 3 },
  ausgewogen: { angle: 75, expReturn: 5 },
  wachstum: { angle: 128, expReturn: 7 },
  aggressiv: { angle: 165, expReturn: 8.5 },
};

interface Assessment {
  bindingProfile: string;
  capacityScore: number;
  toleranceScore: number;
  needScore: number | null;
  strategicAllocation: any;
  version?: number;
  lastReviewedAt?: string | Date | null;
  nextReviewDueAt?: string | Date | null;
}

const fmtDate = (d?: string | Date | null) => {
  if (!d) return null;
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? null : dt.toLocaleDateString("de-CH", { year: "numeric", month: "2-digit", day: "2-digit" });
};

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-400">{label}</span>
        <span className="text-white font-medium tabular-nums">{value}/100</span>
      </div>
      <div className="h-2 rounded bg-white/10">
        <div className="h-2 rounded bg-[#00CFC1]" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

// Donut-Segment via stroke-dasharray auf einem Kreis (Umfang 2πr).
function donutDash(pct: number, r: number) {
  const c = 2 * Math.PI * r;
  return { len: (pct / 100) * c, gap: c };
}

export default function AnlageprofilResult({
  assessment, horizonYears, onReassess,
}: { assessment: Assessment; horizonYears?: number; onReassess: () => void }) {
  const profile = assessment.bindingProfile;
  const meta = PROFILE_META[profile] ?? PROFILE_META.ausgewogen;
  const alloc = (assessment.strategicAllocation ?? { equity: 50, bond: 38, cash: 12, targetVolPct: 9 }) as
    { equity: number; bond: number; cash: number; targetVolPct: number };

  const vol = alloc.targetVolPct;
  const exp = meta.expReturn;
  const goodYear = Math.round(exp + vol);
  const badYear = Math.round(exp - vol); // ~ −1σ; kann negativ sein
  const capacityBinds = assessment.capacityScore < assessment.toleranceScore;
  const needConflict = assessment.needScore != null && assessment.needScore > assessment.capacityScore + 15;

  // P4: jährliche Überprüfung
  const utils = trpc.useUtils();
  const confirmReview = trpc.investmentProfile.confirmReview.useMutation({
    onSuccess: () => {
      toast.success("Profil als geprüft bestätigt");
      utils.investmentProfile.getAssessment.invalidate();
    },
    onError: (e) => toast.error(`Fehler: ${e.message}`),
  });
  const reviewDue = assessment.nextReviewDueAt ? new Date(assessment.nextReviewDueAt).getTime() < Date.now() : false;
  const lastReviewed = fmtDate(assessment.lastReviewedAt);

  const R = 60; // donut radius
  const eq = donutDash(alloc.equity, R);
  const bd = donutDash(alloc.bond, R);
  const cs = donutDash(alloc.cash, R);
  const eqOff = 0;
  const bdOff = -(alloc.equity / 100) * (2 * Math.PI * R);
  const csOff = -((alloc.equity + alloc.bond) / 100) * (2 * Math.PI * R);

  return (
    <Card className="bg-[#1a1f2e] border-white/10">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base text-white">Ihr Anlegerprofil</CardTitle>
            <CardDescription>
              Bindendes Profil <span className="text-white font-semibold">{RISK_LABEL[profile] ?? profile}</span>{" "}
              — das Minimum aus Fähigkeit und Bereitschaft.
            </CardDescription>
          </div>
          <Button variant="outline" className="border-white/10 text-gray-200 gap-2 shrink-0" onClick={onReassess}>
            <Sparkles className="h-4 w-4" /> Neu bewerten
          </Button>
        </div>
      </CardHeader>

      <CardContent className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* P4: Überprüfung fällig */}
        {reviewDue && (
          <div className="lg:col-span-3 flex flex-wrap items-center justify-between gap-3 bg-amber-500/10 border border-amber-500/40 rounded-lg px-4 py-3">
            <div className="flex items-start gap-2 text-sm text-amber-200">
              <Clock className="w-4 h-4 mt-0.5 shrink-0" />
              <span>Ihr Anlegerprofil ist über ein Jahr alt. Bitte prüfen Sie, ob es noch passt.</span>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" className="border-white/10 text-gray-200 h-8" onClick={onReassess}>Neu bewerten</Button>
              <Button className="bg-[#00CFC1] text-black hover:bg-[#00CFC1]/80 h-8"
                disabled={confirmReview.isPending} onClick={() => confirmReview.mutate()}>
                {confirmReview.isPending ? "…" : "Profil bestätigen"}
              </Button>
            </div>
          </div>
        )}

        {/* Risiko-Tacho */}
        <div className="flex flex-col items-center justify-center">
          <svg viewBox="0 0 220 140" width="100%" style={{ maxWidth: 240 }} role="img" aria-label={`Risiko-Tacho ${profile}`}>
            <defs>
              <linearGradient id="apGauge" x1="0" x2="1">
                <stop offset="0" stopColor="#2f9e6f" />
                <stop offset="0.5" stopColor="#d9932b" />
                <stop offset="1" stopColor="#e0654a" />
              </linearGradient>
            </defs>
            <path d="M20 120 A100 100 0 0 1 200 120" fill="none" stroke="#2a3342" strokeWidth="16" strokeLinecap="round" />
            <path d="M20 120 A100 100 0 0 1 200 120" fill="none" stroke="url(#apGauge)" strokeWidth="16" strokeLinecap="round" opacity="0.9" />
            <g transform={`rotate(${meta.angle - 90} 110 120)`}>
              <line x1="110" y1="120" x2="110" y2="44" stroke="#eaf1f3" strokeWidth="3.5" strokeLinecap="round" />
              <circle cx="110" cy="120" r="7" fill="#eaf1f3" />
            </g>
            <text x="24" y="136" fill="#93a4ae" fontSize="9">konservativ</text>
            <text x="168" y="136" fill="#93a4ae" fontSize="9">aggressiv</text>
          </svg>
          <div className="text-center mt-1">
            <div className="text-lg font-bold text-white">{RISK_LABEL[profile] ?? profile}</div>
            <div className="text-xs text-gray-400">Zielvolatilität ≈ {vol}% p.a.</div>
          </div>
        </div>

        {/* Musterallokation Donut */}
        <div className="flex flex-col items-center justify-center">
          <svg viewBox="0 0 160 160" width="150" height="150" role="img" aria-label="Musterallokation">
            <g transform="rotate(-90 80 80)">
              <circle cx="80" cy="80" r={R} fill="none" stroke="#00CFC1" strokeWidth="24" strokeDasharray={`${eq.len} ${eq.gap}`} strokeDashoffset={eqOff} />
              <circle cx="80" cy="80" r={R} fill="none" stroke="#3f7c9c" strokeWidth="24" strokeDasharray={`${bd.len} ${bd.gap}`} strokeDashoffset={bdOff} />
              <circle cx="80" cy="80" r={R} fill="none" stroke="#6b7684" strokeWidth="24" strokeDasharray={`${cs.len} ${cs.gap}`} strokeDashoffset={csOff} />
            </g>
            <text x="80" y="78" textAnchor="middle" fill="#eaf1f3" fontSize="12" fontWeight="700">STRATEG.</text>
            <text x="80" y="94" textAnchor="middle" fill="#93a4ae" fontSize="11">Allokation</text>
          </svg>
          <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-2 text-xs text-gray-400">
            <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: "#00CFC1" }} />Aktien {alloc.equity}%</span>
            <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: "#3f7c9c" }} />Anleihen {alloc.bond}%</span>
            <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: "#6b7684" }} />Cash {alloc.cash}%</span>
          </div>
        </div>

        {/* Scores + Klartext */}
        <div className="space-y-3">
          <ScoreBar label="Risikofähigkeit (tragen können)" value={assessment.capacityScore} />
          <ScoreBar label="Risikobereitschaft (tragen wollen)" value={assessment.toleranceScore} />
          <div className="text-xs text-gray-300 border-t border-white/10 pt-3 leading-relaxed">
            <span className="text-gray-400 font-medium">Was das heisst: </span>
            In einem typischen Jahr liegt die Bandbreite etwa zwischen{" "}
            <span className="text-white tabular-nums">{badYear}%</span> und{" "}
            <span className="text-white tabular-nums">+{goodYear}%</span>.
            {horizonYears ? <> Über {horizonYears} Jahre liegt der Richtwert für dieses Profil bei</> : <> Langfristig liegt der Richtwert für dieses Profil bei</>}{" "}
            <span className="text-white tabular-nums">~{exp}% p.a.</span>{" "}
            (Marktannahme, keine Prognose) — mit zwischenzeitlichen Rückschlägen, die zu Ihrem Profil passen.
          </div>
          {capacityBinds && (
            <div className="flex items-start gap-2 text-xs text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              Ihre Risikofähigkeit begrenzt das Profil — Ihre Bereitschaft wäre höher. Bewusst so gewählt: nie mehr Risiko, als Sie tragen können.
            </div>
          )}
          {needConflict && (
            <div className="flex items-start gap-2 text-xs text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              Ihre Zielrendite verlangt mehr Risiko, als Ihre Tragfähigkeit zulässt. Ziel anpassen oder Sparrate erhöhen.
            </div>
          )}
        </div>

        {/* P4: Version + letzte Überprüfung */}
        {(assessment.version || lastReviewed) && (
          <div className="lg:col-span-3 border-t border-white/10 pt-3 text-xs text-gray-500 flex flex-wrap gap-x-4 gap-y-1">
            {assessment.version ? <span>Version {assessment.version}</span> : null}
            {lastReviewed ? <span>Zuletzt geprüft: {lastReviewed}</span> : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
