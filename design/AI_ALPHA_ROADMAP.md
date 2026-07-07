# KI, Signale & Optimierung — Roadmap zu echtem, ehrlichem Alpha

> Arbeitsdokument. Ziel: den KI-/Signal-/Optimierungs-Bereich so weiterentwickeln,
> dass er **nachweisbaren, ehrlich gemessenen Mehrwert** für Kunden (Privatanleger 50+, CH)
> liefert — statt Scheingenauigkeit.

## Leitprinzipien

1. **Erst ehrlich messen, dann optimieren.** Alpha aus einem geleakten Backtest ist kein Alpha.
2. **Eigene Signale mit Gedächtnis sind der Kern.** Das System muss aus seinem eigenen
   Track-Record lernen und sich über die Zeit verbessern. Fremdquellen (Wikifolio) sind
   *zusätzliche, gleichberechtigt eingespeiste* Signale — **niemals das Fundament**.
3. **Quellen-agnostische Architektur.** Jedes Signal (eigene Engine, Wikifolio-Konsens,
   künftige Quellen) ist eine gewichtete Komponente in einem gemeinsamen Aggregat. Die
   Gewichte werden aus gemessenem Alpha gelernt, nicht handgesetzt.
4. **Keine Performance-Versprechen.** Signale werden als historisch evaluierte Einschätzung
   mit sichtbarem Track-Record dargestellt (FIDLEG/FINMA-konform).

## Ehrliche Standortbestimmung (Stand heute)

| Bereich | Reife | Kernbefund |
|---|---|---|
| Signale (live) | niedrig–mittel | additive if/else-Heuristik; Endsignal von Momentum+Quality−LPPL überschrieben |
| ML RandomForest (live) | **niedrig** | pro Request neu trainiert, Fundamentals-Look-Ahead-Leck, „Confidence" = In-Sample-Accuracy |
| ML Gradient-Boosting (Python) | hoch (Design) / **inaktiv** | sauber (PIT-Features, Walk-Forward+Embargo, Promotion-Gate, ONNX), aber nur aktiv bei `ANALYTICS_SERVICE_URL`+Promotion; nur Test-Fixture-`.onnx` vorhanden |
| Portfolio-Optimizer | mittel | echtes Mean-Variance, aber naive μ (Rauschen) + 5000× Random-Search statt Solver |
| Signal-Weight-Optimizer | mittel | 200er Zufalls-Grid, aber echte 80/20-Walk-Forward-Validierung |
| DCF / QualityMetrics | mittel–hoch | fundiert; Quality wird aber im Signalpfad nicht genutzt (auf `null`) |
| Regime | mittel | regelbasiert, transparent; ADX/ATR nur aus Close approximiert |
| Backtest (UI) | niedrig–mittel | keine Kosten/Slippage, Fundamentals-Look-Ahead |
| Signal-History/Alpha | mittel (echt) | **einziger echter Forward-Test** (SMI-Alpha je Signal), aber ohne Rückkopplung in die Gewichte |

**Die drei kritischsten Punkte:**
1. Look-Ahead-Leck bei Fundamentaldaten (RF + UI-Backtest) → gemeldete Genauigkeiten zu optimistisch.
2. Die gute ML-Pipeline ist im Betrieb vermutlich inaktiv; Kunden sehen den geleakten RF-Fallback.
3. Random-Search + naive Erwartungsrenditen im Optimizer.

## Zwei parallele Tracks

### Track A — Eigene Signale mit Gedächtnis (KERN)

Das Substrat existiert schon: `signal_history` (`drizzle/schema.ts:781`) speichert je Signal
`engineScores` (JSON), `alphaPct`, `actualReturnPct`, `directionCorrect`, `selectedEngine`,
`regime`. `signalEvaluationCron.ts` füllt Alpha vs. SMI nach Ablauf der Haltefrist. **Was fehlt,
ist die Schleife**, die dieses akkumulierte Alpha zurück in die Gewichte spielt.

- **A1 — Look-Ahead-Lecks schließen.** `mlEngine.ts:437` (RF-Fundamentals), `backtestRouter.ts:372`.
  „Confidence" ehrlich machen oder RF abschalten (`mlEngine.ts:495`).
- **A2 — Gedächtnis-Schleife (self-improving).** Neuer Job liest `signal_history`-Alpha je
  `selectedEngine`×`regime` (rollierendes Fenster, nur ausgewertete Zeilen) und leitet daraus
  **regime-abhängige Engine-Gewichte** ab (mehr Gewicht für Engines mit nachweislich positivem
  Out-of-Sample-Alpha). Mit Shrinkage zu Gleichgewicht bei dünner Datenlage; Mindest-Stichprobe
  pro Engine/Regime, sonst Default. Ergebnis wird versioniert persistiert (analog `signalWeights`).
- **A3 — GB-Pipeline live schalten.** `ANALYTICS_SERVICE_URL` deployen, erstes Modell durchs
  Promotion-Gate (`modelRegistry.passesPromotionGate`), ONNX-Serving aktiv.
- **A4 — Realistischer Backtest.** Transaktionskosten + Slippage + Next-Open-Ausführung +
  korrekte MaxDrawdown-Definition; PIT-Fundamentals.

**„Gedächtnis" konkret:** jede Empfehlung wird gespeichert, nach Haltefrist gegen Benchmark
ausgewertet, und das Ergebnis verschiebt die Gewichte für die *nächste* Empfehlung. Das ist der
disziplinierte, Out-of-Sample-validierte „self-improving loop" — im Gegensatz zu einem Schwarm,
der nachts 100 Hypothesen testet und vor allem Überanpassung produziert (Multiple-Testing).

### Track B — Wikifolio als zusätzliche Signalquelle

Reale Entscheidungen erfolgreicher, real investierter Trader als *eine* Komponente — mit
sichtbarem Herkunfts-Hinweis. **Nicht das Fundament**, sondern ein Input in das Aggregat aus Track A.

- **B1 — Kennzahlen durchreichen.** `mapWikifolioSearchResults` (`wikifolioService.ts:312`) setzt
  Sharpe/Perf/AUM/maxDD heute hart auf `null` → Basis für Erfolgs-Ranking reparieren.
- **B2 — Persistenz.** Neue Tabellen `wikifolios` + `wikifolio_trades` (Trade-Modell existiert im
  gevendorten Client, `vendor/wikifolio/.../Trade.d.ts`).
- **B3 — Trade-Abruf.** `getWikifolioTrades(symbol)` über `api/wikifolio/{id}/tradehistory`
  (analog zum bestehenden handgeschriebenen `getWikifolioPortfolio`).
- **B4 — Täglicher Job.** Top-N erfolgreiche Wikifolios (Sharpe/AUM-Schwelle, real-money) →
  neue Trades seit letztem Lauf → persistieren → ISIN→Ticker (`isinResolver.ts`).
- **B5 — Konsens-Signal.** „N erfolgreiche Wikifolios kauften Titel X in den letzten M Tagen"
  als **strukturierte Score-Komponente** (nicht Freitext), mit Herkunfts-Badge. Fließt als *eine*
  gewichtete Quelle in das Aggregat aus Track A.
- **B6 — Robustheit & Recht.** Rate-Limit/Backoff/Caching/Alerting; **ToS-Prüfung** (Zugriff via
  persönlichem Login-Scraping ist fragil und rechtlich zu klären).

## Track C — Portfolio-Optimierung professionalisieren (später)

- Ledoit-Wolf-Shrinkage für die Kovarianz (`engine.ts:291`).
- Black-Litterman: Signal-/Wikifolio-Views als „Views" statt roher historischer μ (`engine.ts:1084`).
- Echter QP-Solver statt 5000× Random-Search (`engine.ts:420`).

## PR-Reihenfolge (Vorschlag)

1. **PR-1 (Track B, Datenschicht):** Schema `wikifolios`/`wikifolio_trades`, `getWikifolioTrades`,
   `mapWikifolioSearchResults`-Fix, reine Konsens-Aggregation + Unit-Tests. *(verifizierbar ohne
   Live-API bis auf Feldnamen/`id`-Auflösung — die brauchen die Live-Credentials/-Umgebung.)*
2. **PR-2 (Track A, Kern):** Gedächtnis-Schleife A2 — Engine-Gewichte aus `signal_history`-Alpha.
3. **PR-3 (Track A):** Look-Ahead-Lecks A1 + ehrliche Confidence.
4. **PR-4 (Track B):** täglicher Cron B4 + Konsens-Signal B5 als gewichtete Quelle im Aggregat.
5. **PR-5 (Track A):** GB-Pipeline live (A3) + realistischer Backtest (A4).
6. **PR-6 (Track C):** Optimizer-Upgrade.

## Offene Punkte / brauchen Eingaben

- **Wikifolio Live-API:** exakte Feldnamen der Such-API-Kennzahlen und die `id`-Auflösung
  (Symbol→GUID) sind nur mit gültigen Credentials gegen die Live-API verifizierbar.
- **ToS-/Rechtsfrage** zum Login-basierten Scraping.
- **`ANALYTICS_SERVICE_URL`**: läuft der Python-Analytics-Service in der Deploy-Umgebung?
