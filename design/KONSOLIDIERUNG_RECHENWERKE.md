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

## 7. Soll-Ablauf: vom kuratierten Universum zum überwachten Portfolio

*(Ergänzt am 20.08. auf Marcs Auftrag: sauberer Ablauf Watchlist → Wizard →
Kundenportfolio, internes Meldewesen an den Projektleiter, laufendes Lernen
auf Rendite UND Risiko, einfache Steuerung, nichts überladen.)*

```
S1 KURATIEREN      S2 DATENQUALITÄT     S3 RECHNEN         S4 BAUEN            S5 AUSWEISEN         S6 ÜBERWACHEN
eigene Auswahl     Mindest-Historie     drei Scores        Wizard: Türsteher   Portfolio-Historie   Alerts aus F1:
Wikifolio       →  Daten aktuell     →  + EIN Signal    →  + Rahmenregeln   →  ab Tag 1 + Kenn-  →  Kauf / Verkauf /
Screener           Titel-Ampel          (FASSUNG)          (Grössen, Sektor)   zahlen in 3 Kat.     Aufstocken / Reduzieren
      │                  │                                                            │
      └──────────────────┴───────────── PROJEKTLEITER-COCKPIT ◄──────────────────────┘
                          Meldungen: Datenlücken · Inkonsistenzen · Ausreisser ·
                          Lern-Vorschläge (Lernwerkstatt) — Übernahme NUR mit Freigabe
```

**Die sechs Stationen (jede Funktion der App muss genau einer Station oder
dem Cockpit zuordenbar sein — was keiner dient, wird nicht gebaut):**

| Station | Verbindliche Regel | Stand heute | Paket |
|---|---|---|---|
| **S1 Kuratieren** | Aufnahme ins Universum aus drei Quellen (eigene Auswahl, Wikifolio, Screener), jede mit Herkunfts-Badge und Aufnahme-Check | Quellen-Badges und Screener-Protokoll vorhanden (#321); Aufnahme-Check uneinheitlich | K9 |
| **S2 Datenqualität** | Jeder Titel trägt einen Gesamtstatus (vollständig / lückenhaft / veraltet) aus Historienlänge, Datenaktualität und Score-Basis. Ohne «vollständig» kein Signal-Ausweis, nur ehrliches «—» | Wächter je Kennzahl vorhanden, aber kein Titel-Gesamtstatus — z. B. laufen 3 Watchlist-Titel ohne Datenreihe unbemerkt mit | K9 |
| **S3 Rechnen** | Kundensichtbar rechnet nur die FASSUNG (drei Scores + EIN Signal) — L1/L2 | fünf Parallelformeln (Teil A) | K2/K3 |
| **S4 Bauen** | Wizard wählt über Türsteher + Mindeststandards + Lücken-Logik; Rahmenbedingungen (Positionsgrössen min/max, Sektor-/Regionen-Deckel, Cash) stehen in EINER deklarierten Regeltabelle, die Wizard UND Optimieren-Tab benutzen | Score-Rangliste + Tilts (Befund 4); Regeln verstreut und teils nur im Wizard | K4 + K10 |
| **S5 Ausweisen** | Jedes Portfolio (auch automatisch erstellte) hat ab Tag 1 eine lückenlose Historie und Kennzahlen in drei kundenklaren Kategorien: **Rendite** (Wertentwicklung, vs. Benchmark), **Risiko** (Schwankung, Sharpe), **Verlustrisiko** (max. Drawdown, Verlust-Ratio). Eine Definition je Kennzahl, überall gleich (L1) | Kennzahlen vorhanden, aber uneinheitlich definiert und nicht kategorisiert; Portfolio-Quality-Score als zweites Universum (Befund 9) | K6 + K10 |
| **S6 Überwachen** | Alerts (Kauf, Verkauf, Aufstocken, Reduzieren) kommen aus der Kernrechnung + Wächter-/Lücken-Logik — dieselbe Zahl, die der Kunde sieht | Alerts feuern auf F3/F4 (Befund 12) | K2/K3 |

**Befund zur Stations-Konsistenz (Marc, 20.08.): «Nur Aktien» geht auf dem
Weg zum KI-Protokoll verloren.** Die Wahl «Nur Aktien vs. Multi-Asset gemäss
Profil» ist heute KEIN Merkmal des gespeicherten Anlegerprofils, sondern ein
flüchtiger Parameter des einzelnen Wizard-Aufrufs
(PortfolioBuilderWizard.tsx:179/556 → `input?.stocksOnly ?? false`,
autoPortfolioJobs.ts:85). Jeder Vorschlagsweg, der diesen Parameter nicht
mitbringt, fällt still auf Multi-Asset zurück — u. a. der Alt-Pfad
`buildProposal` (autoPortfolioRouter.ts:737) mit eigenem Default und eigener,
leicht abweichender Sleeve-Zumischung (autoPortfolioRouter.ts:741 ohne
`assetClassTolerancePct` vs. autoPortfolioJobs.ts:477 — ein Formel-Duplikat
im Sinne von L1). So erklärt sich, dass das KI-Analyse-Protokoll ein
Multi-Asset-Portfolio zeigen kann, obwohl im Wizard bewusst «nur Aktien»
gewählt wurde. **Konsequenz (K4/K10):** Die Anlageklassen-Wahl wird Teil des
gespeicherten Anlegerprofils (eine Wahrheit), ALLE Vorschlagswege lesen sie
von dort; der Alt-Pfad fällt (war in K4 ohnehin vorgesehen); das
KI-Protokoll weist die Wahl sichtbar aus.

**Projektleiter-Cockpit (Steuerung muss so einfach sein wie die Kunden-App):**
EINE Admin-Übersichtsseite, nach Schichten gruppiert: Datenqualitäts-Ampeln
(S2), Konsistenz-Status der Rechenwerke, Lauf-Status der Crons, offene
Lern-Vorschläge. Dazu ein aktives Meldewesen — der KI-Helfer meldet intern
(nicht kundensichtbar), wenn: Datenlücken oder veraltete Titel auftreten,
Kennzahlen-Ausreisser vorkommen (z. B. ROIC-Artefakte), Anzeigen sich
widersprechen, oder die Lernwerkstatt eine Verbesserung gefunden hat.

**Lernwerkstatt (ersetzt «Selbstlernen» — Leitsatz-Abgleich):** Marcs
Anforderung «das System muss laufend lernen» wird bewusst NICHT als
Selbst-Übernahme gebaut (das wäre ein L3-Verstoss und exakt der Fehler der
heutigen Schleifen, Befund 5/6). Stattdessen: Die Messung (Schicht C) misst
**laufend und korrekt** — fixes Horizont-Fenster, Mehrertrag gegen einen je
Portfolio definierten **Benchmark**, immer Rendite UND Risiko zusammen
(Alpha bei gleichzeitigem Blick auf Vola/Drawdown). Findet sie eine
Verbesserung (Universum, Titelmix, Gewichtung, Alert-Schwellen), formuliert
sie einen konkreten Vorschlag mit Out-of-Sample-Beleg («Gewicht X→Y:
Alpha +0.4 %, Drawdown −1.1 pp») und meldet ihn ans Cockpit. Übernommen
wird ausschliesslich nach Marcs Freigabe — dann regulär mit Änderungslog
und FASSUNG-Disziplin. Ziel bleibt Marcs Formel: höhere Rendite als der
Benchmark bei idealerweise tieferem Risiko.

## 8. Konsolidierungspakete (je Paket separates OK)

- **K1 — Selbstlern-Stopp** ✅ *(umgesetzt 20.08., PR #324)*: Regime-Priors-Cron
  und Algo-Feedback-Loop deaktivieren; ML-Promotion und Optimizer-Aktivierung
  auf manuellen Admin-Entscheid umstellen (Werkzeuge bleiben, schreiben
  Berichte). Setzt L3 durch.
- **K2 — EIN Signal für Badges & Alerts** ✅ *(umgesetzt 20.08., PR #325)*:
  `stocks.signalScore/signalType` aus F1 speisen (watchlistAlertsCron liest
  `stock_scores`), F4-Scheduled stilllegen, F3/alertConfig ausser Betrieb,
  «KI-Empfohlen»-Generator auf F1 + ehrlichen Namen. Danach: Badge = Zahl.
- **K3 — Optimieren-Tab & Alerts konsistent** ✅ *(umgesetzt 20.08., PR #326)*: Kandidaten und Bestand aus F1;
  `scoreDelta` nur noch innerhalb einer Formel; Schwellen als
  Wächter-/Lücken-Logik statt 65er-Rangliste; `qualityScore`-Fallback und
  toten `driftThresholdPp` entfernen; F2/`signalWeights` aus dem Kundenpfad
  (Titel ohne F1-Basis zeigen ehrlich «—»).
- **K4 — Wizard-Umbau (= E3)** *(Vorab-Schnitt umgesetzt 20.08.: toter
  buildProposal-Zweitpfad gelöscht, Feedback-Format-Bug gefixt,
  +10-Kurations-Bonus entfernt. Offen: Auswahl über Wächter+Lücken statt
  Score+Tilts, Pauschal-60, autoApply, Anlageklassen-Wahl im Profil)*: Auswahl = Wächter + Mindeststandards +
  Lücken-Logik statt Score+Tilts; Signaltyp aus F1; Pauschal-Scores und
  +10-Bonus raus (oder als deklarierte Kurationsregel); LLM-Rollen bleiben
  (Text/Kritik), `autoApply`-Zwang überdenken; Feedback-Format-Bug fixen
  oder Schleife entfernen; toten `buildProposal`-Altpfad löschen.
- **K5 — Copilot entschärfen** ✅ *(umgesetzt 20.08., PR #332)*: Composite auf F1-Basis umstellen oder als
  «relativ, beschreibend» deklarieren; RF- und PE/PEG-Anteile raus;
  `autoExecute`-Trades auf F5-Basis stoppen; Deep-Dive-Prompt von
  «Handlungsempfehlungen» auf Beschreibung.
- **K6 — Portfolio-Score ehrlich machen** ✅ *(umgesetzt 20.08., PR #329)*: Umbenennen («Portfolio-Zustand»),
  Bewertungs-Komponente auf die bereinigte Kette bzw. als Wächter-Ausweis,
  Audit-/UI-Texte und hhi-Gruppierung fixen; bleibt reine Anzeige.
- **K7 — Labor kennzeichnen** ✅ *(umgesetzt 20.08., PR #333 — Messfenster fixiert, Banner)*: Engines/Signal-Performance: Messfenster auf
  Horizont fixen + Alpha statt Richtung, Banner «Labor — entscheidet
  nichts»; oder einfrieren. Engine-Widgets und Prognose-Tab markieren oder
  entfernen. Optimizer-/ML-Trainer-UI-Texte korrigieren.
- **K8 — Sprach- und Namensordnung** ◐ *(20.08., PR #330: Admin-Nav nach Schichten, healthScore-Router entfernt. Offen: qualityScore-Spalten-Renames, stocks.score-Stilllegung)*: `qualityScore`-Vierdeutigkeit
  auflösen, `stocks.score` nach Übergangsfrist stilllegen, LLM-erfundene
  Zahlen (healthScore) unterbinden, Admin-Navigation nach Schichten
  gruppieren, alle unter Befund 10 gelisteten Falschtexte korrigieren.

- **K9 — Titel-Datenqualität & Kuratierungs-Ablauf** ✅ *(umgesetzt 20.08., PR #328)* *(Soll-Ablauf S1/S2)*:
  Pro Titel ein Gesamtstatus (vollständig / lückenhaft / veraltet) aus
  Historienlänge, Datenaktualität und Score-Basis; sichtbar in Watchlist und
  Universum; ohne «vollständig» kein Signal-Ausweis. Einheitlicher
  Aufnahme-Check für alle drei Quellen; Status-Verschlechterungen erscheinen
  als Cockpit-Meldung.
- **K10 — Rahmenregeln & Portfolio-Ausweis** ✅ *(umgesetzt 20.08., PR #331 — Regeltabelle war bereits zentral)* *(Soll-Ablauf S4/S5)*: EINE
  deklarierte Regeltabelle (Positionsgrössen min/max, Sektor-/Regionen-
  Deckel, Cash-Quote) für Wizard und Optimieren-Tab; einheitlich definierte
  Portfolio-Kennzahlen in drei Kategorien (Rendite / Risiko / Verlustrisiko)
  inkl. Benchmark-Vergleich; lückenlose Historie ab Portfolio-Erstellung.
- **K11 — Projektleiter-Cockpit & Lernwerkstatt** ✅ *(umgesetzt 20.08., PR #334)* *(Soll-Ablauf, letzter
  Baustein)*: eine Admin-Übersichtsseite nach Schichten + internes
  Meldewesen (Datenlücken, Inkonsistenzen, Ausreisser, Lern-Vorschläge);
  Lernwerkstatt misst laufend Alpha UND Risiko gegen den Benchmark
  (setzt das K7-Messfenster voraus) und stellt Out-of-Sample-geprüfte
  Vorschläge zur Freigabe — nie zur Selbst-Übernahme.
- **K12 — Frontend entschlacken** ◐ *(20.08., PR #327: Signale-Tab + /aktien/signale entfernt. Offen: Rückbau der vier wirkungslosen Konfigseiten)*: redundante oder
  konzeptwidrige Kundenansichten entfernen bzw. zusammenlegen. Erster
  benannter Kandidat (Marc, 20.08.): der Tab **«Signale» im
  Portfolio-Detail** fliegt raus — er zeigt pro Position Labor-Signale
  (`rfSignal` = ML, `regimeSignal` = Engine, PortfolioSignalsTab.tsx:137/394)
  im Kundenpfad (L2/L4-Verstoss) und ist redundant: die Positionsliste trägt
  seit #316/#320 die Score-Spalten samt Klick-Dialogen, Handlungsvorschläge
  wohnen im Optimierungs-Tab. Gleiche Komponente prüfen unter
  `/aktien/signale`. Weitere Kandidaten je Sichtung: doppelte Routen-Altpfade
  (`/stock/:ticker`, `/stocks/:ticker`, `/portfolio-builder/old|new`),
  Dashboard-Insights vs. Copilot-Hub-Doppelung. Jede Entfernung einzeln
  aufgelistet, nichts still gelöscht.

**Empfohlene Reihenfolge:** K1 → K2 → K3 → K12 → K9 → K6/K8 → K10 → K5 →
K7 → K11 → K4 (E3). K1–K3 beseitigen die kundenwirksamen Widersprüche,
K12 ist der schnelle Aufräum-Gewinn im Frontend, K9 sichert die Datenbasis,
K10 liefert die Rahmenregeln, auf denen der Wizard-Umbau K4 aufsetzt;
K11 kommt zuletzt, weil das Cockpit den konsolidierten Zustand überwachen
soll, nicht den heutigen Wildwuchs.

### Admin-Bereich: von 24 Kacheln zu fünf Gruppen (Marc, 20.08.)

Der Admin-Bereich zählt heute **24 eigenständige Seiten** (App.tsx:171-197)
— historisch gewachsen, ohne Ordnung nach dem Zielbild. Ziel: **fünf
Gruppen**, jede Seite gehört genau in eine; was in keine passt oder nach
den Paketen funktionslos wird, fliegt raus. Zuordnungsvorschlag (finale
Sichtung je Seite im jeweiligen Paket):

| Gruppe (Zielbild-Schicht) | Seiten | Verdikt |
|---|---|---|
| **1 · Cockpit** (Einstieg) | `/admin` (Dashboard) | wird zur K11-Übersichtsseite: Datenampeln, Konsistenz, Läufe, offene Vorschläge |
| **2 · Universum & Daten** (S1/S2, Schicht B) | `watchlist`, `wikifolio`, `data-import`, `categories`, `sectors` | bleiben; `watchlist-candidates` in die Screener-Karte des Dashboards integrieren (Doppelung); `categories`+`sectors` zu einer Stammdaten-Seite zusammenlegen; `gap-filling` ist durch den Screener ersetzt → stilllegen |
| **3 · Rechnung & Transparenz** (Schicht A) | `berechnungen`, `kpis`, `screenshots` | `berechnungen` bleibt (Rechenbuch); `kpis`/`screenshots` sichten: zusammenlegen oder in Doku überführen |
| **4 · Messung** (Schicht C, read-only) | `improvement-timeline`, `proposal-analysis`, `feedback-dashboard` | Timeline bleibt; `proposal-analysis` bleibt (K4 fixt die Ersatz-Score-Quelle); `feedback-dashboard` zeigt die defekte Schleife → nach K4-Entscheid stilllegen oder in proposal-analysis aufgehen lassen |
| **5 · Labor** (Schicht D, Banner) | `signal-performance`, `ml-trainer`, `optimizer`, `algo-backtest` | bleiben markiert als Labor (K1/K7) |
| **Betrieb** (keine Rechenwerke) | `settings`, `secrets`, `logs`, `research` | bleiben als Werkzeuge; `research` sichten |
| **Nach Konsolidierung funktionslos** | `signal-config` (F2-Gewichte), `alert-config` (F3-Schwellen), `score-config` (Portfolio-Quality-Gewichte) | nach K1/K2/K6 stilllegen — Konfigurationsseiten für Formeln, die es dann nicht mehr gibt |

Damit schrumpft der Admin-Bereich von 24 Kacheln auf **rund 14 Seiten in
fünf klar beschrifteten Gruppen** plus Betrieb — die Navigation folgt dem
Zielbild statt der Entstehungsgeschichte. Umsetzung verteilt auf K8
(Navigation/Gruppierung), K11 (Cockpit) und K12 (Stilllegungen).

## 9. Was ausdrücklich NICHT geändert wird

- Keine Löschung von Mess-Historien (`signal_history`, Outcome-Tabellen,
  Schatten-Tabellen) — Messreihen sind wertvoll, auch wenn ihre Erzeuger
  ins Labor wandern.
- Keine Änderung an der Drei-Score-Rechnung selbst durch diese Vorlage —
  Rechnungsänderungen laufen weiter einzeln über Regel 1 + Änderungslog.
- Kein neuer Daten-Vendor, keine Gewichts-Feinoptimierung per Backtest
  (unverändert aus REFORM_BEWERTUNG_SIGNAL.md §3).

---

*Merge dieser Vorlage = Zielbild, Soll-Ablauf und Paketschnitt sind
angenommen. Die Umsetzung jedes Pakets K1–K12 braucht ein separates OK und
läuft als eigener PR mit Tests und Änderungslog.*
