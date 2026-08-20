/**
 * Die Erklär-Dialoge der drei Scores und des Signals — als eigene Komponente,
 * damit Titelseite UND Positionsliste dasselbe Fenster zeigen (Marc-Wunsch
 * 19.08.: «beim Klick auf die Scores in der Positionenliste dasselbe Popup»).
 *
 * Die Daten holt der Dialog selbst über `analytics.dreiScores` — derselbe
 * Query-Schlüssel wie auf der Titelseite, react-query dedupliziert also. Für
 * Watchlist-Titel beantwortet der Server die Abfrage aus den vorberechneten
 * `stock_scores` (kein EODHD-Abruf).
 */
import { useState } from "react";
import { X, Info } from "lucide-react";
import { trpc } from "@/lib/trpc";
import StockScoringWidget from "@/components/stock/StockScoringWidget";

export type ScoreDialogArt = "qualitaet" | "bewertung" | "timing" | "signal";

/** Timing-Faktoren als Tabelle — genutzt vom Timing- UND vom Signal-Dialog. */
function TimingFaktorenTabelle({ dreiScores }: { dreiScores: any }) {
  if (!dreiScores?.timing?.faktoren?.length) return null;
  return (
    <div className="rounded-md border border-white/10 overflow-hidden mb-4">
      <p className="font-semibold text-white text-xs px-3 py-2 bg-white/5">
        Timing für diesen Titel — {dreiScores.timing.score !== null
          ? `${Math.round(dreiScores.timing.score)}/100` : "—"}
      </p>
      <table className="w-full text-xs">
        <tbody>
          {dreiScores.timing.faktoren.map((f: any) => (
            <tr key={f.name} className="border-t border-white/5" title={f.hinweis ?? ""}>
              <td className="px-3 py-1.5 text-gray-300">{f.name}
                <span className="text-gray-600"> · {Math.round(f.gewicht * 100)}%</span>
                {f.punkte === null && f.hinweis && (
                  <span className="block text-[10px] text-gray-500">{f.hinweis}</span>
                )}
              </td>
              <td className="px-2 py-1.5 text-right text-gray-400 font-mono">
                {f.wert !== null && f.wert !== undefined ? Number(f.wert).toFixed(2) : "—"}
              </td>
              <td className={`px-3 py-1.5 text-right font-mono font-semibold ${
                f.punkte === null ? "text-gray-600"
                  : f.punkte >= 65 ? "text-emerald-400"
                  : f.punkte >= 45 ? "text-yellow-400" : "text-red-400"}`}>
                {f.punkte !== null ? `${Math.round(f.punkte)}/100` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ScoreErklaerDialog({
  ticker,
  art,
  onClose,
}: {
  ticker: string;
  art: ScoreDialogArt | null;
  onClose: () => void;
}) {
  const { data: dreiScores } = trpc.analytics.dreiScores.useQuery(
    { ticker },
    { enabled: art !== null && !!ticker },
  );
  // Aufgeklappte Faktor-Herleitung («per Klick nachvollziehbar»): Schlüssel
  // ist "q:<Name>" bzw. "b:<Name>", damit ein Klick im einen Dialog nicht den
  // anderen aufklappt.
  const [faktorRechnung, setFaktorRechnung] = useState<string | null>(null);

  if (!art) return null;

  // Eigener Timing-Dialog (Live-Befund 20.08.): Der Timing-Kreis öffnete den
  // Signal-Dialog — verwirrend, weil das Signal als eigene Skala daneben steht.
  if (art === "timing") {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
        <div className="bg-[#0f1420] border border-[#00CFC1]/30 rounded-lg max-w-lg w-full p-6 relative max-h-[85vh] overflow-y-auto">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors z-10"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-[#00CFC1]/20 flex items-center justify-center">
              <Info className="w-5 h-5 text-[#00CFC1]" />
            </div>
            <h3 className="text-xl font-bold text-white">Timing</h3>
          </div>

          <p className="text-sm text-gray-300 mb-4">
            Das <strong className="text-[#00CFC1]">Timing</strong> beschreibt den
            <strong> Zeitpunkt</strong>, nicht das Unternehmen: Wie läuft der Kurs
            (Momentum, Trend), gab es einen Rücksetzer (RSI), wo steht der Kurs im
            52-Wochen-Band, und meldet das Blasensignal Überhitzung. Alles kommt aus
            der Kursreihe — Fundamentaldaten stecken in Qualität und Bewertung.
          </p>
          <p className="text-xs text-gray-400 mb-4">
            Ins Signal fliesst das Timing zusammen mit der Qualität ein, gewichtet
            nach Marktregime — die Herleitung zeigt der Klick auf die Signal-Skala.
          </p>

          <TimingFaktorenTabelle dreiScores={dreiScores} />
        </div>
      </div>
    );
  }

  if (art === "signal") {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
        <div className="bg-[#0f1420] border border-[#00CFC1]/30 rounded-lg max-w-lg w-full p-6 relative max-h-[85vh] overflow-y-auto">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors z-10"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-[#00CFC1]/20 flex items-center justify-center">
              <Info className="w-5 h-5 text-[#00CFC1]" />
            </div>
            <h3 className="text-xl font-bold text-white">Signal</h3>
          </div>

          <p className="text-sm text-gray-300 mb-4">
            Das <strong className="text-[#00CFC1]">Signal</strong> beschreibt den Zustand eines
            Titels aus <strong>Qualität</strong> (wie gut ist das Unternehmen) und
            <strong> Timing</strong> (wie günstig ist der Zeitpunkt) — gewichtet nach Marktregime:
            in der Krise wiegt das Unternehmen schwerer, im Aufschwung der Zeitpunkt. Die
            <strong> Bewertung</strong> wirkt als Wächter: Extrem teure Titel werden gedeckelt,
            «günstig» gibt keine Zusatzpunkte. Es ordnet keine Kaufliste.
          </p>
          <p className="text-xs text-gray-400 mb-4">
            Bis zur Umstellung bestand diese Zahl zu 40 % aus einer eigenen Qualitätsrechnung. Wer
            Qualität und Signal nebeneinander las, zählte Qualität damit zweimal. Jetzt zählt jeder
            Teil genau einmal, und die Rechnung steht offen: Die Beiträge summieren sich zum
            Signal.
          </p>

          <TimingFaktorenTabelle dreiScores={dreiScores} />

          {/* Die alte Zusammensetzung nur noch zugeklappt: Sie entscheidet
              nicht mehr, und offen dargestellt las sie sich wie eine
              zweite, konkurrierende Signal-Formel. */}
          <details className="mt-2">
            <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-300">
              Frühere Zusammensetzung anzeigen (Momentum + Qualität − LPPL, entscheidet nicht mehr)
            </summary>
            <div className="mt-3">
              <StockScoringWidget ticker={ticker} />
            </div>
          </details>
        </div>
      </div>
    );
  }

  if (art === "qualitaet") {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
        <div className="bg-[#0f1420] border border-[#00CFC1]/30 rounded-lg max-w-md w-full p-6 relative max-h-[85vh] overflow-y-auto">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-[#00CFC1]/20 flex items-center justify-center">
              <Info className="w-5 h-5 text-[#00CFC1]" />
            </div>
            <h3 className="text-xl font-bold text-white">Qualitäts-Score</h3>
          </div>

          {/* Erklärung entspricht der Umsetzung in server/lib/dreiScores.ts
              (berechneQualitaet: Niveau 60 % + Richtung 40 %). */}
          <div className="space-y-4 text-sm text-gray-300">
            <p>
              Der <strong className="text-[#00CFC1]">Qualitäts-Score</strong> misst, wie gut das
              <strong> Unternehmen</strong> ist — nicht, ob die Aktie günstig ist und nicht, ob
              der Zeitpunkt stimmt. Dafür stehen die Kreise «Bewertung» und «Signal» daneben.
            </p>

            <p className="text-xs text-gray-400">
              Die Abgrenzung: Eine Kennzahl gehört hierher, wenn sie sich <em>nicht</em> ändert,
              sobald allein der Kurs sich bewegt. Dividendenrendite, KGV und Momentum ändern sich
              mit dem Kurs — sie stehen deshalb bei der Bewertung beziehungsweise beim Signal.
            </p>

            {dreiScores?.qualitaet.niveau.faktoren?.length ? (
              <div className="rounded-md border border-white/10 overflow-hidden">
                <p className="font-semibold text-white text-xs px-3 py-2 bg-white/5">
                  Für diesen Titel — Niveau {dreiScores.qualitaet.niveau.score !== null
                    ? Math.round(dreiScores.qualitaet.niveau.score) : "—"}/100 ·
                  F-Score {dreiScores.qualitaet.richtung.fScore}/9
                </p>
                <table className="w-full text-xs">
                  <tbody>
                    {dreiScores.qualitaet.niveau.faktoren.map((f: any) => (
                      <tr
                        key={f.name}
                        className={`border-t border-white/5 ${f.rechnung ? "cursor-pointer hover:bg-white/[0.03]" : ""}`}
                        title={f.rechnung ? "Klicken für die Herleitung" : (f.hinweis ?? "")}
                        onClick={() => f.rechnung && setFaktorRechnung(faktorRechnung === `q:${f.name}` ? null : `q:${f.name}`)}
                      >
                        <td className="px-3 py-1.5 text-gray-300">{f.name}
                          <span className="text-gray-600"> · {Math.round(f.gewicht * 100)}%</span>
                          {/* Ausgeblendete Faktoren: das «Warum» direkt zeigen —
                              ein blosser Strich liest sich wie ein Fehler. */}
                          {f.punkte === null && f.hinweis && (
                            <span className="block text-[10px] text-gray-500">{f.hinweis}</span>
                          )}
                          {/* Die Herleitung auf Klick: Anker, Formel, Zahlen. */}
                          {faktorRechnung === `q:${f.name}` && f.rechnung && (
                            <span className="block text-[10px] text-[#00CFC1]/80 font-mono mt-0.5">{f.rechnung}</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-right text-gray-400 font-mono">
                          {f.wert !== null && f.wert !== undefined ? Number(f.wert).toFixed(1) : "—"}
                        </td>
                        <td className={`px-3 py-1.5 text-right font-mono font-semibold ${
                          f.punkte === null ? "text-gray-600"
                            : f.punkte >= 65 ? "text-emerald-400"
                            : f.punkte >= 45 ? "text-yellow-400" : "text-red-400"}`}>
                          {f.punkte !== null ? `${Math.round(f.punkte)}/100` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {/* Die 60/40-Klammer ausgeschrieben: Die Faktoren oben sind nur
                    das Niveau — wer sie aufsummiert, landet neben der Kopfzahl,
                    weil die Richtung (F-Score) als zweite Säule dazukommt. Mit
                    diesem Satz lässt sich der Score exakt nachrechnen. */}
                {(dreiScores.qualitaet as any).rechnung && (
                  <p className="px-3 py-2 text-[11px] text-gray-400 border-t border-white/5 bg-white/[0.03] font-mono">
                    {(dreiScores.qualitaet as any).rechnung}
                  </p>
                )}
              </div>
            ) : null}

            <div>
              <p className="font-semibold text-white mb-1">Niveau — 60 %: Ist das Geschäft gut?</p>
              <ul className="space-y-1">
                <li className="flex items-start gap-2"><div className="w-2 h-2 rounded-full bg-[#00CFC1] mt-1.5 flex-shrink-0"></div><span><strong>Kapitalrendite ROIC (25%):</strong> Was das Unternehmen aus dem eingesetzten Kapital erwirtschaftet — der belastbarste Hinweis auf einen Wettbewerbsvorteil</span></li>
                <li className="flex items-start gap-2"><div className="w-2 h-2 rounded-full bg-[#00CFC1] mt-1.5 flex-shrink-0"></div><span><strong>Betriebsmarge (20%):</strong> Was vom Umsatz als Betriebsgewinn übrig bleibt — ein Mass für Preissetzungsmacht</span></li>
                <li className="flex items-start gap-2"><div className="w-2 h-2 rounded-full bg-[#00CFC1] mt-1.5 flex-shrink-0"></div><span><strong>Ertragsqualität (20%):</strong> Ob der ausgewiesene Gewinn durch echte Zahlungsströme gedeckt ist — der wirksamste Schutz gegen buchhalterisch erzeugte Gewinne</span></li>
                <li className="flex items-start gap-2"><div className="w-2 h-2 rounded-full bg-[#00CFC1] mt-1.5 flex-shrink-0"></div><span><strong>Gewinnstabilität (15%):</strong> Wie gleichmässig die Gewinne über die Jahre ausfallen</span></li>
                <li className="flex items-start gap-2"><div className="w-2 h-2 rounded-full bg-[#00CFC1] mt-1.5 flex-shrink-0"></div><span><strong>Verschuldung (10%):</strong> Nettoschulden im Verhältnis zum operativen Ergebnis</span></li>
                <li className="flex items-start gap-2"><div className="w-2 h-2 rounded-full bg-[#00CFC1] mt-1.5 flex-shrink-0"></div><span><strong>Bruttomarge (10%):</strong> Struktur des Geschäftsmodells</span></li>
              </ul>
            </div>

            <div>
              <p className="font-semibold text-white mb-1">Richtung — 40 %: Vorwärts oder rückwärts?</p>
              <p className="text-xs">
                Der <strong>Piotroski F-Score</strong> prüft neun Kriterien gegenüber dem Vorjahr —
                Cashflow, Kapitalrendite, Verschuldung, Liquidität, Aktienzahl, Bruttomarge und
                Kapitalumschlag. Je Kriterium ein Punkt, höchstens neun. Er zeigt, ob sich ein
                Unternehmen fundamental verbessert oder verschlechtert.
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Ohne diesen Teil sähe ein Unternehmen mit erstklassigen, aber seit Jahren
                erodierenden Kennzahlen tadellos aus.
              </p>
            </div>

            <p className="text-xs text-gray-500">
              Fehlt eine Kennzahl, tragen die übrigen entsprechend stärker. Sind weniger als
              60 % der Gewichtung belegt, zeigt der Kreis «—» statt einer Note — eine Lücke ist
              ehrlicher als eine Zahl, die nur die Datenlage abbildet.
            </p>

            <div className="pt-3 border-t border-white/10">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#00CFC1]">≥75: Ausgezeichnet</span>
                <span className="text-yellow-500">55–74: Gut</span>
                <span className="text-orange-400">35–54: Mittel</span>
                <span className="text-red-500">&lt;35: Schwach</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // art === "bewertung"
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-[#0f1420] border border-[#00CFC1]/30 rounded-lg max-w-md w-full p-6 relative max-h-[85vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
          aria-label="Schliessen"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-[#00CFC1]/15 flex items-center justify-center">
            <Info className="h-5 w-5 text-[#00CFC1]" />
          </div>
          <h3 className="text-lg font-semibold text-white">Bewertungs-Score</h3>
        </div>

        <div className="space-y-4 text-sm text-gray-300">
          <p>
            Der <strong className="text-[#00CFC1]">Bewertungs-Score</strong> beantwortet eine
            einzige Frage: <strong>Ist der Preis angemessen?</strong>
          </p>
          <p className="rounded-md bg-[#00CFC1]/10 border border-[#00CFC1]/30 px-3 py-2 text-xs">
            <strong>Hoch heisst günstig.</strong> Ein Wert von 85 bedeutet also preiswert,
            nicht teuer.
          </p>

          {dreiScores?.bewertung.faktoren?.length ? (
            <div>
              <p className="font-semibold text-white mb-1">Für diesen Titel</p>
              <ul className="space-y-1.5">
                {dreiScores.bewertung.faktoren.map((f: any) => (
                  <li
                    key={f.name}
                    className={`flex items-start gap-2 ${f.rechnung ? "cursor-pointer" : ""}`}
                    title={f.rechnung ? "Klicken für die Herleitung" : undefined}
                    onClick={() => f.rechnung && setFaktorRechnung(faktorRechnung === `b:${f.name}` ? null : `b:${f.name}`)}
                  >
                    <div className="w-2 h-2 rounded-full bg-[#00CFC1] mt-1.5 flex-shrink-0"></div>
                    <span>
                      <strong>{f.name}{f.gewicht > 0 ? ` (${Math.round(f.gewicht * 100)}%)` : ""}:</strong>{" "}
                      {f.hinweis}
                      {f.punkte !== null && <span className="text-gray-500"> — {Math.round(f.punkte)} Punkte</span>}
                      {faktorRechnung === `b:${f.name}` && f.rechnung && (
                        <span className="block text-[10px] text-[#00CFC1]/80 font-mono mt-0.5">{f.rechnung}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="text-xs text-gray-400">
            Bei Banken, Versicherern und Immobilien zählt der Buchwert; dort besteht das
            Vermögen aus bilanzierten Forderungen und Objekten. Bei allen übrigen trägt das
            PEG — die Bewertung im Verhältnis zum Gewinnwachstum.
          </p>
          <p className="text-xs text-gray-400">
            Ein sehr hohes KGV <strong>begrenzt</strong> den Score, auch wenn das PEG günstig
            aussieht. Ein tiefes PEG bei KGV 128 heisst nicht «günstig», sondern «günstig,
            falls das Wachstum hält» — bleibt es aus, ist die Fallhöhe gross.
          </p>

          <div className="pt-3 border-t border-white/10">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#00CFC1]">≥75: Günstig</span>
              <span className="text-yellow-500">55–74: Fair</span>
              <span className="text-orange-400">35–54: Ambitioniert</span>
              <span className="text-red-500">&lt;35: Teuer</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
