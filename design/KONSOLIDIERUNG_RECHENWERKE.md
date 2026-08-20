# Konsolidierung der Rechenwerke — Inventar, Befunde, Zielbild

**Entscheidungsvorlage** · Stand 2026-08-20 · Anlass: «Wir haben so viele
Dimensionen, ich habe den Überblick verloren. Jede Funktion in EIN
konsistentes, klares, nachvollziehbares Konzept giessen und notfalls rigoros
konsolidieren.»

Grundlage: vollständige Code-Kartierung aller Score-, Signal-, Optimierungs-
und KI-Systeme (Front + Admin) vom 20.08.2026. Jede Aussage trägt einen
Datei-Beleg. Die visuelle Landkarte mit denselben Inhalten liegt als
Artefakt-Seite bei.

---

## 0. Leitsätze (der Massstab, an dem alles gemessen wird)

- **L1 — Eine Wahrheit pro Zahl.** Für jede Grösse (Titel-Signal, Qualität,
  Bewertung, Portfolio-Zustand) existiert genau EINE Rechnung. Zwei Formeln
  für dieselbe Zahl sind ein Fehler, keine Vielfalt.
- **L2 — Kundensichtbar rechnet nur die FASSUNG-Rechnung.** Alles, was ein
  Nutzer als Score/Signal/Empfehlung sieht oder was Transaktionen auslöst,
  kommt aus der dokumentierten, versionierten Drei-Score-Welt
  (`dreiScores.ts`, `rechneSignal`, FASSUNG-Änderungslog).
- **L3 — Messen ja, automatisches Übernehmen nein.** Rückwärts gemessene
  Trefferquoten dürfen berichten, aber nie selbständig Gewichte ändern
  (Regel 1 aus STRATEGIE_DREI_SCORES.md; Beleg: Der Rangtest mit Kosten
  zeigte, dass die Score-Rangliste dem gleichgewichteten kuratierten
  Universum unterliegt — Rückwärts-Optimierung prämiert Zufall).
- **L4 — Labor ist erlaubt, aber markiert und folgenlos.** Experimente
  (Engines, ML) dürfen existieren — sichtbar als «Labor», ohne Draht in
  Kundenpfade, ohne Selbst-Aktivierung.
- **L5 — Keine Kaufranglisten.** Scores sind Türsteher, Wächter und
  Beschreibung (Reform E1/E2). Jede «Top-N nach Score»-Auswahl widerspricht
  der eigenen Messung.

---

## 1. Inventar Teil A — die fünf parallelen Titel-Signalformeln

| # | Formel | Rechnung | Landet in | Kundensichtbar | Verdikt |
|---|---|---|---|---|---|
| **F1** | **Drei-Score-Signal** `rechneSignal` (dreiScoreSignal.ts) | Qualität×Timing regimegewichtet, Bewertung als Wächter, FASSUNG-dokumentiert | `stock_scores`, `stock_signal_cache.combinedScore` (signalCacheCron.ts:537: «massgeblich») | JA — Titelseite, Positionsliste, /aktien-Zahl | **KERN — bleibt** |
| F2 | Basis-Signal `generateSignal` + `signalWeights` (baseSignal.ts, 12 Indikator-Gewichte) | gewichtete Indikator-Summe, Gewichte vom Auto-Optimizer | nur Fallback, wenn F1 fehlt (<60 Kurse); `criteria`-Liste | indirekt | **Stilllegen** (K3) |
| F3 | Alert-Score `computeWatchlistSignalScore` + `alertConfig` (watchlistSignalScore.ts) | eigene KGV/PEG/Dividende/52W-Heuristik | `stocks.signalScore/signalType` (watchlistAlertsCron alle 4 h) | JA — Badge «Kaufen/Halten» auf /aktien (Invest.tsx:498), AdminWatchlist, **Push-/WhatsApp-Alerts** | **Konsolidieren auf F1** (K2) |
| F4 | `calcSignalScore` (signalScoreRefreshScheduled.ts:26) | vierte, eigene Schwellenformel (`pe<10 → +15` …) | überschreibt **dieselben Spalten** wie F3, täglich 07:00 UTC | JA (via F3-Anzeigen) | **Stilllegen** (K2) |
| F5 | Copilot-Composite (analytics/portfolioCopilot.ts:248-278) | Momentum/Sharpe/**RF-ML 15–25 %**/Vola/MaxDD/**PE-PEG positiv** — **portfoliointern min-max-normiert** | `copilotRecommendations`; bei `autoExecute=1` **echte Trades** (scheduledRecommendations.ts:56-108) | JA — Copilot, Dashboard-Insights | **Ersetzen/entschärfen** (K5) |

**Kernproblem in einem Satz:** Auf /aktien stehen Badge (F3) und Zahl (F1)
aus zwei verschiedenen Modellen in derselben Zeile (investRouter.ts:254 vs.
:277-296); der Optimieren-Tab subtrahiert F3-Kandidaten von F1-Bestand
(analyticsRouter.ts:659/674) und nennt das «Verbesserung»; der Wizard nimmt
den F1-Score, aber den F3-Signaltyp (autoPortfolioJobs.ts:243-245).

## 2. Inventar Teil B — Selbstlern- und Optimierungsmechanismen

| Mechanismus | Was er automatisch ändert | Gate? | Wirkt auf | Verdikt |
|---|---|---|---|---|
| Regime-Priors-Lernschleife (learningCron.ts:31, So 03:15) | `regime_signal_config.engineWeights` aus `signal_history`-Alpha | **NEIN** | Engine-Auswahl (Anzeige-Widgets) | **STOPP** (K1) |
| Signal-Weight-Optimizer (learningCron.ts:45, monatlich + Admin-Knopf) | `signalWeights` (F2-Gewichte) | JA (OOS-Toleranz, optimizerWorker.ts:831) | F2 (Fallback-only) | **Cron aus, Werkzeug → Bericht** (K1) |
| Algo-Backtest-Feedback-Loop (algoBacktestEngine.ts:789-806) | `signalWeights` direkt (ytd/momentum ±0.01), `isActive:1` | **NEIN** (nur 2-Monats-Sperre) | F2 | **STOPP** (K1) |
| ML-Auto-Promotion (mlTrainingCron.ts:95, Mo 02:37) | aktives `gb_signal`-ONNX-Modell | Metrik-Gate, **keine menschliche Freigabe** | Copilot (0.25/0.15!), Prognose-Tab, Reason-Texte | **Promotion → manuell** (K1) |
| Admin-Feedback-Schleife (adminRouter.ts:2385 → autoPortfolioJobs.ts:643) | LLM-Prompt-Kontext | – | Wizard-Prompts | **defekt** (Schreib-/Leseformat inkompatibel — Kontext bleibt immer leer). Fixen oder entfernen (K4) |
| Schattenrechnungen, signalGewichteBacktest, Vorschlags-Outcome, Verbesserungs-Timeline | nichts (read-only, «ES WIRD NICHTS ÜBERNOMMEN») | – | – | **behalten — vorbildlich** |

## 3. Inventar Teil C — Mess- und Anzeige-Systeme

| System | Was es ist | Befund | Verdikt |
|---|---|---|---|
| Signal-Performance (Admin) + 4 Engines (Mean Reversion …) | Lookback-Evaluation der Engine-Signale (`signal_history`) | **Messfenster-Bug:** Rendite bis «heute» statt bis Signal-Horizont (signalEvaluationCron.ts:113); Ziel absolute Richtung statt Alpha. Mean Reversion «59 %» bei **Ø-Alpha −0.17 %**; Ensemble α −7.72 %; Krise n=69 → 4.3 %. Engines fliessen NICHT in Scores — nur 2 Anzeige-Widgets | **Labor** (K7): Fenster fixen + Banner, oder einfrieren |
| ML-Trainer (Admin) | GB-Classifier, Walk-Forward | UI-Texte falsch (20d vs. lookahead 30; 80 vs. 300 Titel); Konsum s. Teil B | **Labor**, Promotion manuell (K1/K7) |
| Signal Auto-Optimizer (Admin) | Grid-Search auf F2-Gewichte | UI verspricht «maximale Trefferquote», Code optimiert Netto-Sharpe; «Optimiert»-Badge wirkungslos, da F2 nur Fallback (AUDIT_2026-07.md SIG-4) | **Labor/Bericht** (K1/K7) |
| Portfolio-Quality-Score + Score-Konfiguration (Admin) | 0–100 je Portfolio, 5 Komponenten, appSettings-Config | Reine Anzeige (1 Kachel). ABER: eigenes Bewertungsuniversum (rohes Vendor-`stocks.pegRatio` statt bereinigter Kette), «Bewertung 25 %» im Widerspruch zu E1, Audit-Text «beeinflusst Kaufhinweise» falsch, `hhi` in UI falsch gruppiert | **Umbau + Umbenennung** (K6) |
| Namenskollision `qualityScore` | 4 verschiedene Bedeutungen (Portfolio-Snapshot, stockSignalCache, qualityMetricsService, stock_scores.qualitaet) | zwei «Quality Scores» auf derselben Portfolio-Seite, ohne Verbindung | **Umbenennen** (K8) |
| Alter Einzelscore `scoring.ts` (`stocks.score`) | Vor-Reform-Score | lebt als «bisher»-Vergleich weiter | nach Übergangsfrist stilllegen (K8) |

## 4. Inventar Teil D — KI-Werkzeuge (welches nutzt welche Daten?)

| Werkzeug | Score-/Signalquellen | LLM | Löst Handlungen aus | Konsistenz-Verdikt |
|---|---|---|---|---|
| **Vorschlags-Wizard** (autoPortfolioJobs) | F1 via Cache (48 h), sonst F3, sonst 50; **plus 5 Tilts** (Momentum/Ziel/FX/Sektor/Faktor) + Watchlist-Bonus +10; Signaltyp aus **F3**; Expansion-Titel hart 60 | ja (Text, Challenger, Synthesizer; `autoApply` hart erzwungen) | Portfolio-Erstellung | **Kaufrangliste in Reinform** — Umbau = E3 (K4) |
| **KI-Analyse-Protokoll** (Admin) | zeigt Wizard-Log; Ersatztitel-Score aus **F3** (AdminProposalAnalysis.tsx:347) | nein | Genehmigung → Portfolio | Ersatz-Score-Quelle falsch; Feedback-Schleife defekt (K4) |
| **Optimieren-Tab** + `upgradeProposals` | Bestand **F1**, Kandidaten **F3**, `scoreDelta` = F1−F3; `additionThreshold 65` | nein | **echte Transaktionen** (applyRecommendations) | härtester Einzelbefund — (K3) |
| **Optimierungs-Alert** (scheduled) | F1 mit **`qualityScore`-Fallback** an derselben 50er-Schwelle; `driftThresholdPp` geladen, nie benutzt | nein | Push an Nutzer | (K3) |
| **Portfolio-Copilot** + scheduledRecommendations | **F5** (eigene Welt), F1 nur als Aktions-Override obendrauf | ja (Erklärtext) | **autoExecute-Trades** | relativer Score mit Absolut-Optik; PE/PEG positiv (E1-Widerspruch); RF-Gewicht (K5) |
| **Einzeltitel-Briefing** | **F1 sauber** (dreiScoresStore) + Stammdaten + Earnings | ja (nur Text) | nein | **konzepttreuestes Werkzeug — Vorbild** |
| Portfolio-Deep-Dive-KI | keine Formel — rohe EODHD-Bewertungskennzahlen, Prompt verlangt «2 Handlungsempfehlungen» | ja | nein | Empfehlungen aus reinen Bewertungszahlen = E1-Widerspruch (K5) |
| generateRecommendations («KI-Empfohlen») | hartkodierte Ticker-Listen + **F3** — kein LLM, «KI» nur im Namen | nein | füllt Universum-Staging | ehrlich benennen, auf F1 umstellen (K2/K8) |
| KI-Insights/Health-Score, Chat-Copilot, Deep-Dive u. a. | LLM-frei erfundene `healthScore`-Zahl bzw. freie Texte | ja | nein | Zahlen-Erfindung durch LLM unterbinden (K8) |

---

## 5. Die zwölf Kernbefunde (Kurzform)

1. **Fünf Signalformeln** auf denselben Titeln; F1 ist führend, die anderen
   leben in Badges, Alerts, Kandidatenlisten und Copilot weiter.
2. **/aktien:** Badge aus F3 neben Zahl aus F1 in derselben Zeile.
3. **Optimieren-Tab** vergleicht F1-Bestand mit F3-Kandidaten und bucht
   darauf echte Transaktionen; Schwelle 65 = Kaufrangliste.
4. **Wizard** = F1-Score + fünf Tilts + F3-Signaltyp + Pauschal-60 für
   Expansion + Kurations-Bonus +10 — der Bewertungs-Wächter wird übertiltet.
5. **Drei Selbstlern-Pfade ohne menschliches Gate** (Regime-Priors,
   Algo-Feedback-Loop, ML-Promotion) — Verstoss gegen Regel 1/L3.
6. **Signal-Performance misst falsch** (Fenster bis «heute», absolute
   Richtung): Mean-Reversion-«59 %» trägt kein Alpha (−0.17 %), und genau
   aus dieser Messung lernt die Priors-Schleife wöchentlich.
7. **Copilot-Score ist portfoliorelativ** (min-max je Portfolio): im
   schwächsten Portfolio wird der am wenigsten schwache Titel automatisch
   «strong_buy» — mit `autoExecute` bis zur echten Order.
8. **Admin-Feedback-Lernschleife defekt** (Format-Mismatch) — suggeriertes
   Lernen findet nicht statt.
9. **Portfolio-Quality-Score** widerspricht E1 (Bewertung 25 %), nutzt das
   rohe Vendor-PEG an der bereinigten Kette vorbei — folgenlos, weil reine
   Anzeige, aber begrifflich irreführend («Quality», das keine Qualität im
   Sinne des Abgrenzungstests misst).
10. **UI-Texte decken nicht den Code:** «maximale Trefferquote» (real:
    Netto-Sharpe), «Optimiert»-Badge (wirkungslos), «beeinflusst
    Kaufhinweise» (falsch), ML-Trainer-Parameter (falsch), «KI-Empfohlen»
    (kein KI).
11. **`qualityScore` heisst viermal etwas anderes**; `stocks.score` (alt)
    läuft als Schatten weiter.
12. **Alerts** (Push/WhatsApp) feuern auf F3; der Optimierungs-Alert auf F1
    mit Äpfel-Birnen-Fallback und totem Konfigurationsparameter.

---

## 6. Zielbild: das Vier-Schichten-Modell

```
A KERNRECHNUNG (FASSUNG, kundensichtbar, versioniert)
   Drei Scores + rechneSignal + Wächter → stock_scores / stock_signal_cache
   → Titelseite, Positionsliste, /aktien (Badge UND Zahl), Alerts,
     Kandidatenvergleiche, Wizard-Türsteher
B WÄCHTER & DATENQUALITÄT (bestehende Schicht — unangetastet)
   PEG-Kette, KGV-Gegenprobe, Dividenden-Gegenprobe, ROIC-Wächter, Dedup …
C MESSUNG (read-only, mit korrekten Fenstern)
   Punkt-in-Zeit, Screener-Protokoll, Outcome-Statistiken, Schattenrechnung,
   Verbesserungs-Timeline — berichtet, übernimmt NIE selbst
D LABOR (markiert «entscheidet nichts», kein Draht in A)
   Engines/Orchestrator, ML-Trainer, Auto-Optimizer-Werkzeug, Prognose-Tab
```

Jede Admin-Seite und jedes Frontend-Element bekommt genau eine Schicht.
Alles, was heute quer dazu liegt, wird per Paket verschoben oder stillgelegt.

## 7. Konsolidierungspakete (je Paket separates OK)

- **K1 — Selbstlern-Stopp** *(klein, risikoarm, zuerst)*: Regime-Priors-Cron
  und Algo-Feedback-Loop deaktivieren; ML-Promotion und Optimizer-Aktivierung
  auf manuellen Admin-Entscheid umstellen (Werkzeuge bleiben, schreiben
  Berichte). Setzt L3 durch.
- **K2 — EIN Signal für Badges & Alerts** *(kundenwirksam)*:
  `stocks.signalScore/signalType` aus F1 speisen (watchlistAlertsCron liest
  `stock_scores`), F4-Scheduled stilllegen, F3/alertConfig ausser Betrieb,
  «KI-Empfohlen»-Generator auf F1 + ehrlichen Namen. Danach: Badge = Zahl.
- **K3 — Optimieren-Tab & Alerts konsistent**: Kandidaten und Bestand aus F1;
  `scoreDelta` nur noch innerhalb einer Formel; Schwellen als
  Wächter-/Lücken-Logik statt 65er-Rangliste; `qualityScore`-Fallback und
  toten `driftThresholdPp` entfernen; F2/`signalWeights` aus dem Kundenpfad
  (Titel ohne F1-Basis zeigen ehrlich «—»).
- **K4 — Wizard-Umbau (= E3)**: Auswahl = Wächter + Mindeststandards +
  Lücken-Logik statt Score+Tilts; Signaltyp aus F1; Pauschal-Scores und
  +10-Bonus raus (oder als deklarierte Kurationsregel); LLM-Rollen bleiben
  (Text/Kritik), `autoApply`-Zwang überdenken; Feedback-Format-Bug fixen
  oder Schleife entfernen; toten `buildProposal`-Altpfad löschen.
- **K5 — Copilot entschärfen**: Composite auf F1-Basis umstellen oder als
  «relativ, beschreibend» deklarieren; RF- und PE/PEG-Anteile raus;
  `autoExecute`-Trades auf F5-Basis stoppen; Deep-Dive-Prompt von
  «Handlungsempfehlungen» auf Beschreibung.
- **K6 — Portfolio-Score ehrlich machen**: Umbenennen («Portfolio-Zustand»),
  Bewertungs-Komponente auf die bereinigte Kette bzw. als Wächter-Ausweis,
  Audit-/UI-Texte und hhi-Gruppierung fixen; bleibt reine Anzeige.
- **K7 — Labor kennzeichnen**: Engines/Signal-Performance: Messfenster auf
  Horizont fixen + Alpha statt Richtung, Banner «Labor — entscheidet
  nichts»; oder einfrieren. Engine-Widgets und Prognose-Tab markieren oder
  entfernen. Optimizer-/ML-Trainer-UI-Texte korrigieren.
- **K8 — Sprach- und Namensordnung**: `qualityScore`-Vierdeutigkeit
  auflösen, `stocks.score` nach Übergangsfrist stilllegen, LLM-erfundene
  Zahlen (healthScore) unterbinden, Admin-Navigation nach Schichten
  gruppieren, alle unter Befund 10 gelisteten Falschtexte korrigieren.

**Empfohlene Reihenfolge:** K1 → K2 → K3 → K6/K8 → K5 → K7 → K4 (E3).
K1–K3 zusammen beseitigen die kundenwirksamen Widersprüche; K4 ist das
grösste Stück und war ohnehin als E3 vorgemerkt.

## 8. Was ausdrücklich NICHT geändert wird

- Keine Löschung von Mess-Historien (`signal_history`, Outcome-Tabellen,
  Schatten-Tabellen) — Messreihen sind wertvoll, auch wenn ihre Erzeuger
  ins Labor wandern.
- Keine Änderung an der Drei-Score-Rechnung selbst durch diese Vorlage —
  Rechnungsänderungen laufen weiter einzeln über Regel 1 + Änderungslog.
- Kein neuer Daten-Vendor, keine Gewichts-Feinoptimierung per Backtest
  (unverändert aus REFORM_BEWERTUNG_SIGNAL.md §3).

---

*Merge dieser Vorlage = Zielbild und Paketschnitt sind angenommen. Die
Umsetzung jedes Pakets K1–K8 braucht ein separates OK und läuft als eigener
PR mit Tests und Änderungslog.*
