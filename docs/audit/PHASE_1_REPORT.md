# Phase 1 — Fachliche und quantitative Korrektheit

**Projekt:** Portfoliomanager  
**Audit-Branch:** `audit/phase-0-baseline`  
**Datum:** 13. August 2026  
**Status:** Befunde dokumentiert — Fixes warten auf separate Freigabe

> **Scope:** Phase 1 prüft die zentralen, finanzmathematisch wirksamen Kernpfade mit deterministischen Referenzfällen und vorhandenen Tests. Sie ist kein Ersatz für die folgenden Sicherheits-, End-to-End-, Betriebs-, Last- und Compliance-Phasen. Es wurden keine Signale, Berechnungen, Datenbankdaten oder Produktionsparameter verändert.

## Management-Zusammenfassung

Die geprüften Kernpfade sind **nicht pauschal fehlerhaft**, aber drei Themen müssen vor einer belastbaren Nutzung für datengetriebene Optimierung beziehungsweise Performancekommunikation entschieden und nach Freigabe bereinigt werden. Die höchste Priorität hat die Punkt-in-Zeit-Zensur: Ein Filing am gleichen Kalendertag wie der Bewertungsstichtag kann heute in den Backtest einfliessen, obwohl der Veröffentlichungszeitpunkt nicht bekannt ist. Dies widerspricht dem Audit-Grundsatz, Look-Ahead-Bias explizit auszuschliessen.

Der zweite bestätigte Befund betrifft die Sortino-Ratio. Bei einem positiven risikofreien Satz benutzt die Implementierung den Satz im Zähler, aber nicht im Downside-Term. Dadurch kann die Modellselektion negative Überschussrenditen zu günstig bewerten. Der dritte Befund ist ein offener Produktvertragskonflikt: Die TTWROR-Kennzahl kappt Tagesrenditen ohne sichtbare Kennzeichnung.

| Priorität | Befund | Konsequenz | Freigabe vor Fix nötig |
|---:|---|---|---|
| Hoch | **F1-03** — gleiche Meldetage gelten als Punkt-in-Zeit-verfügbar | potenzieller Look-Ahead in historischer Score-Reihe und Gewichtssuche | Ja: konservativer Stichtagsvertrag „nächster Handelstag“ bestätigen. |
| Hoch | **F1-01** — Sortino-Mindestziel inkonsistent | Risiko- und Model-Selection-Score kann nahe Kandidaten falsch reihen | Ja: target-aware oder zero-target Definition verbindlich festlegen. |
| Mittel | **F1-02** — TTWROR-Tageskappung | gemeldete historische Performance kann von den Eingangsdaten abweichen | Ja: Datenqualitäts- statt Renditekappungsmodell entscheiden. |

## Prüfgegenstand und Evidenz

| Prüffeld | Ergebnis | Evidenz |
|---|---|---|
| Einheitenvertrag | abgeschlossen | Dezimal-/Prozent-, Tages-/Jahres-, Brutto-/Netto- und CHF/FX-Verträge gegen Quellcode und Referenzfälle abgeglichen. |
| Score-, Signal- und Regime-Pipeline | verifiziert mit Vorbehalt | Drei-Score-Abdeckung, Regime-Aliase, Bandgrenzen und LPPL-Risk-Overlay geprüft. 43 zielgerichtete Tests bestanden. |
| Risiko und Performance | zwei Befunde | Risikostatistik, TTWROR, Benchmark- und Outcome-Pfade geprüft. F1-01 und F1-02 reproduziert. |
| Optimierung und Kosten | verifiziert im geprüften Umfang | HRP-Gewichtssumme, Nichtnegativität, Bandgrenzen, Multi-Asset-Sleeve, Benchmark-Composite und Kostenmodell. 48 Optimierungs-/Kosten- und 27 Benchmark-/Outcome-Tests bestanden. |
| Punkt-in-Zeit | ein Befund | Kurszukunft wird korrekt ausgeschlossen; gleicher Meldetag wird derzeit zugelassen. 86 Punkt-in-Zeit-/Risiko-/Performance-Tests bestanden. |
| Gesamte zielgerichtete Evidenz | bestanden | **204** zielgerichtete Tests in den dokumentierten Prüfpaketen bestanden. Die bereits in Phase 0 bekannte Gesamtsuite bleibt mit 11 externen/Format-Testfehlern nicht vollständig grün. |

## Reproduzierte Referenzfälle

| Fall | Soll-Referenz | Ist-Ausgabe | Bewertung |
|---|---:|---:|---|
| 20 Tagesrenditen bei 90 % der täglichen 2-%-Mindesthürde | Sortino < 0; Referenz −15.8745 | `calcSortino` = 0 | F1-01 bestätigt. |
| CHF 100 auf CHF 160 ohne Cashflow | TTWROR +60 % | TTWROR +50 % | F1-02 bestätigt. |
| Filing am 1. Mai, Stichtag 1. Mai | ohne Uhrzeit konservativ noch nicht verwendbar | `abschlussVerfuegbarAm` = `true` | F1-03 bestätigt. |
| Qualität 80, Bewertung fehlt, Timing 60 im Bullenregime | Score 66.7, BUY, Abdeckung 75 % | identisch | verifiziert. |
| LPPL 0.6 im Bullenregime | Warnung plus Risikodämpfung | Regime-Konfidenz 1.0, aber Risk Overlay 60 % | kein direkter Ausführungsbefund; Anzeige-/Begriffsdrift bleibt notiert. |

## Nicht als Befund klassifizierte Punkte

Die Prüfung hat mehrere scheinbare Inkonsistenzen abgegrenzt, die **nicht** als unmittelbarer Produktionsfehler eingestuft werden. Die Multi-Asset-Benchmark renormiert bei ausreichender Abdeckung bewusst und weist die Abdeckung transparent aus. Das Kostenmodell berechnet im Vorschlags-Outcome einen einmaligen Portfolioaufbau; es behauptet keine vollständige Umschichtungsabrechnung. Der parallele `tickerScoring`-Helper ist nach der Aufrufanalyse derzeit kein kundenwirksamer Pfad. Das LPPL-Risiko wird nicht über die Regimekonfidenz, sondern über das nachgelagerte Risk Overlay handlungswirksam gedämpft.

## Freigabevorschlag für punktuelle Remediations

Jeder Fix bleibt isoliert, beginnt mit einem roten Test und wird nur auf einem separaten Branch umgesetzt. Nach jedem Fix folgen zielgerichtete Tests, die Gesamtsuite, TypeScript, Build und — falls sichtbar betroffen — eine Prüfung in der laufenden Anwendung.

| Reihenfolge | Freigabeobjekt | Geplantes Vorgehen | Abnahmekriterium |
|---:|---|---|---|
| 1 | F1-03 Punkt-in-Zeit | Roten Same-Day-Filing-Test anlegen; Fundamentals ohne Zeitstempel erst ab folgendem Handelstag zulassen. | Same-Day-Filing beeinflusst weder Score noch Folgerendite; vergangene Kurse bleiben unverändert. |
| 2 | F1-01 Sortino | Roten Test mit positivem risikofreiem Satz ergänzen; nach deiner Definitionsentscheidung Zähler und Downside-Term auf dasselbe Mindestziel stellen. | Target-aware und zero-target Testfälle sind explizit, Modellselektion bleibt deterministisch. |
| 3 | F1-02 TTWROR | Datenqualitäts- und Reportingvertrag entscheiden; Kappung entweder entfernen, verwerfen/markieren oder offen ausweisen. | Jede Abweichung zwischen Rohdaten und berichteter Rendite ist nachvollziehbar und auditierbar. |

## Entscheidungspunkt

Bitte bestätige für den nächsten Schritt entweder die **Remediation-Reihenfolge 1–3**, passe die Reihenfolge an oder lehne einzelne Punkte als bewusste Produktentscheidung ab. Ohne diese Freigabe bleibt der Branch ein Audit-Nachweis; es erfolgen keine Code- oder Datenänderungen.
