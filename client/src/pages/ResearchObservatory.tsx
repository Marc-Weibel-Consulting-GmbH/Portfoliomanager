import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useMemo, useState } from "react";
import { ExternalLink, Telescope } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

// Research Observatory — neutrale Research-FILTERUNG externer Quellen.
// WICHTIG (Compliance): keine Anlageberatung, keine Kauf-/Verkaufsempfehlung.
// Die Signale kommen read-only aus einer externen n8n-Instanz.

function scoreColor(score: number | null): string {
  if (score == null) return "border-l-white/20 bg-white/5";
  if (score >= 9) return "border-l-[#00CFC1] bg-[#00CFC1]/10";
  if (score >= 7) return "border-l-emerald-500 bg-emerald-950/20";
  return "border-l-white/20 bg-white/5";
}

function ResearchObservatoryInner() {
  const { data: signals = [], isLoading, error } = trpc.researchObservatory.list.useQuery(undefined, {
    // Der Server hält einen 24h-Cache; im Client nicht aggressiv nachladen.
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const [onlyConfirmed, setOnlyConfirmed] = useState(false);

  const visible = useMemo(
    () => (onlyConfirmed ? signals.filter((s) => !s.followUpRequired) : signals),
    [signals, onlyConfirmed],
  );

  // Paywall: Server wirft FORBIDDEN, wenn der Plan das Feature nicht enthält.
  // (Nach allen Hooks — react-hooks/rules-of-hooks.)
  if (error?.data?.code === "FORBIDDEN") {
    return (
      <Card className="bg-[#1a1f2e] border-white/10">
        <CardContent className="pt-6 pb-6 text-center space-y-2">
          <Telescope className="h-8 w-8 text-gray-600 mx-auto" />
          <p className="text-gray-300 text-sm">{error.message}</p>
          <a href="/einstellungen" className="text-[#00CFC1] text-sm hover:underline">
            Zum Abo
          </a>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-lg bg-white/5 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Compliance-Hinweis: neutral beschriftet */}
      <Card className="bg-[#1a1f2e] border-white/10">
        <CardContent className="py-3">
          <p className="text-xs text-gray-400 leading-relaxed">
            Research-Filterung aus externen Quellen zur Orientierung — <span className="text-gray-300">keine
            Anlageberatung</span> und keine Kauf-/Verkaufsempfehlung. Als
            «vorläufig» markierte Signale sind noch nicht abschliessend geprüft.
          </p>
        </CardContent>
      </Card>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={onlyConfirmed}
            onChange={(e) => setOnlyConfirmed(e.target.checked)}
            className="accent-[#00CFC1]"
          />
          Vorläufige ausblenden
        </label>
        <span className="text-xs text-gray-600 ml-auto">{visible.length} Signale</span>
      </div>

      {visible.length === 0 ? (
        <Card className="bg-[#1a1f2e] border-white/10">
          <CardContent className="pt-6 pb-6 text-center">
            <Telescope className="h-8 w-8 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">
              Zurzeit keine Research-Signale verfügbar. Der Feed wird täglich aktualisiert.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {visible.map((s) => (
            <div
              key={s.signalId}
              className={`border-l-4 rounded-lg p-4 ${scoreColor(s.relevanceScore)} hover:border-l-[6px] transition-all`}
            >
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    {s.relevanceScore != null && (
                      <span className="px-2 py-0.5 bg-[#00CFC1]/20 text-[#00CFC1] text-xs font-semibold rounded">
                        Score {s.relevanceScore}/10
                      </span>
                    )}
                    {s.sourceName && (
                      <span className="text-xs text-gray-400">{s.sourceName}</span>
                    )}
                    {s.sourceCategory && (
                      <span className="px-2 py-0.5 bg-white/5 text-gray-400 text-xs rounded">
                        {s.sourceCategory}
                      </span>
                    )}
                    {s.followUpRequired && (
                      <span className="px-2 py-0.5 bg-orange-600/70 text-white text-xs font-semibold rounded">
                        vorläufig
                      </span>
                    )}
                    {s.classifiedAt && (
                      <span className="text-xs text-gray-500">
                        {new Date(s.classifiedAt).toLocaleDateString("de-CH")}
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-semibold text-white mb-2 leading-snug">
                    {s.url ? (
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-[#00CFC1] transition-colors inline-flex items-start gap-1"
                      >
                        {s.title}
                        <ExternalLink className="h-3 w-3 mt-0.5 shrink-0 opacity-60" />
                      </a>
                    ) : (
                      s.title
                    )}
                  </h3>

                  {s.topics.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {s.topics.map((t) => (
                        <span
                          key={t}
                          className="px-2 py-0.5 bg-white/5 text-gray-300 text-[11px] rounded-full"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ResearchObservatory() {
  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Telescope className="h-6 w-6 text-[#00CFC1]" />
            Research Observatory
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Gefilterte Research-Signale aus externen Quellen — nach Relevanz sortiert.
          </p>
        </div>
        <ResearchObservatoryInner />
      </div>
    </DashboardLayout>
  );
}
