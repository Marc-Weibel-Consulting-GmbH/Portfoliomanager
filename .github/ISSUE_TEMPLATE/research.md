<!--
Ablegen im Portfoliomanager-Repo als:
  .github/ISSUE_TEMPLATE/research.md
Damit durchlaufen auch manuell erstellte Research-Issues dieselbe Schleuse.
Von Workflow 05 erzeugte Issues folgen bereits dieser Struktur (ohne YAML-Header).
-->
---
name: Research → Implementation
about: Ein Research-Paper als Optimierungs-Kandidat für die Algorithmen
title: "[Research] "
labels: ["research", "research:new"]
---

## Quelle
- Quelle / Score / Link:

## Testbare Aussage
<!-- Die eine Hypothese, 1-2 Sätze -->

## Modul-Mapping (Portfoliomanager)
<!-- Welche Module: signals / momentum_quality / optimizer / scoring / regime / risk / ml_feature -->

## Benötigte Daten

## Kennzahl

## Caveats / Risiken

## Backtest-Plan (nächster Validierungsschritt)

---

### Definition of Done (Validierungs-Schleuse — nicht überspringen)

- [ ] **Triage:** relevant & machbar? (sonst `research:rejected` + schliessen)
- [ ] **Spike:** isolierter Prototyp im gemappten Modul, **feature-flagged, default AUS**
- [ ] **Backtest:** cost-aware, **Out-of-Sample**, über mehrere Regime; Ergebnis als Kommentar
- [ ] **Robustheit:** Sensitivität (Parameter, Kosten, Kapazität), Look-ahead ausgeschlossen
- [ ] **Menschliche Review:** Entscheidung `accepted` / `rejected`
- [ ] **Integration** (nur wenn accepted): hinter Feature-Flag, A/B, kein Eingriff in Live-Allokationspfade

> Compliance: Research-Filterung, **keine Anlageberatung**. Kein automatisches
> Deployment einer Strategie auf echte Portfolios. Human-in-the-Loop.
