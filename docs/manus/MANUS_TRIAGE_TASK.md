# Manus-Loop-Task: „Research Triage" — fertige Übergabe

Dieses Dokument ist der **einsatzfertige Task** für den Manus-/Loop-Agenten im
`Marc-Weibel-Consulting-GmbH/Portfoliomanager`-Repo. Ziel: aus `[Research]`-Issues
(von Workflow 05) **validierte, feature-flagged Optimierungs-Kandidaten** machen —
**ohne** automatisches Deployment, mit menschlichem Gate.

## Vorbereitung (einmalig, im Portfoliomanager)

1. **Labels anlegen:** `docs/manus/create-research-labels.sh` (aus dem
   Observatory-Repo) mit einem `GITHUB_TOKEN` (repo/issues) ausführen.
2. **Issue-Template** ablegen: Inhalt aus `docs/manus/research-issue-template.md`
   nach `.github/ISSUE_TEMPLATE/research.md` kopieren.
3. **Optional:** GitHub-**Project-Board** „Research" mit Spalten =
   new → triage → spike → review → accepted/rejected.

## Der wiederkehrende Task (wöchentlich, nach dem 05-Lauf)

> Als Loop-Eintrag (z. B. via `create_trigger` / in `LOOP.md`) mit folgendem Prompt:

```
Task: Research Triage (max. 2 Issues pro Lauf)

1. Finde offene Issues mit Titel-Präfix "[Research]", die KEIN Label
   research:spike / research:review / research:accepted / research:rejected haben.
   Sortiere nach Konfidenz (im Body) und Editorial-Score, nimm die Top 2.

2. Für jedes Issue:
   a. Setze Label research:spike. Lege Branch research/<signal_id> an.
   b. Lies aus dem Issue: Modul-Mapping, Backtest-Plan, benötigte Daten, Caveats.
   c. Baue einen MINIMALEN, ISOLIERTEN Prototyp der Hypothese im gemappten Modul
      (z. B. neue Engine im ensembleSignalEngine, Tilt im qualityMomentumEngine,
      Parameter im hrpOptimizer …). HINTER EINEM FEATURE-FLAG, default AUS.
      Keine Änderung an Live-Allokations-/Order-Pfaden.
   d. Fahre einen cost-aware Out-of-Sample-Backtest über die VORHANDENE Engine —
      keine neue bauen. Andockpunkte:
        - server/lib/algoBacktestEngine.ts  (Backtest-Engine)
        - server/routers/backtestRouter.ts  (Ausfuehrung/Parameter)
        - server/analytics/optimizerGate.ts + __characterization__/ct-tearsheet (Gates/Kennzahlen)
        - server/lib/performanceEngine.ts / weightedReturnSeries.ts (Return-Serien, EODHD-Daten)
      Verlange: netto Transaktionskosten, mehrere Regime, Kapazitätshinweis.
   e. Poste die Ergebnisse als Issue-Kommentar: Sharpe/Sortino netto, OOS,
      Per-Regime, Max-Drawdown, Kapazität; plus 2-3 Sätze Einordnung vs. Claim
      und ob ein Look-ahead-/Overfitting-Risiko besteht.
   f. Öffne einen DRAFT-PR (Label experimental), verlinke das Issue.
      Setze Issue-Label auf research:review.

3. Merge NICHTS nach main. Aktiviere KEIN Feature-Flag. Das entscheidet ein Mensch.

Verifikation vor "fertig": pnpm check grün, pnpm test grün, Backtest-Kommentar
gepostet, Draft-PR offen, Issue auf research:review.
```

## Harte Leitplanken (immer)

- Kein Merge nach `main` durch den Loop; kein Eingriff in Live-Allokations-/Order-Pfade.
- Alles feature-flagged, **default aus**; Aktivierung nur nach menschlicher Freigabe.
  (Falls kein zentrales Flag-System existiert: schlanke Konvention nutzen, z. B. Env/Config-Toggle im Admin-Bereich — nicht in Live-Pfade verdrahten.)
- Backtest ≠ Beweis. Keine automatisierte Anlageberatung.
- `loop-constraints.md` / `LOOP.md` respektieren; Änderungen chirurgisch halten (CLAUDE.md §3).

## Dein menschlicher Schritt (bei `research:review`)

- Backtest-Kommentar + Draft-PR prüfen.
- Robust & überzeugend → `research:accepted`, feature-flagged mergen, als A/B beobachten.
- Fragil / overfit / nicht realisierbar → `research:rejected`, Issue schliessen mit
  einer Zeile Begründung (baut Wissen auf, verhindert Wiederholung).

## Feedback-Schleife (optional, später)

`research:rejected`-Begründungen können in den Prefilter (Workflow 01) oder den
Editorial-/Analyst-Prompt zurückfliessen, damit ähnliche Non-Starter künftig
niedriger bewertet werden — so lernt das Observatory aus den Backtest-Ergebnissen.
