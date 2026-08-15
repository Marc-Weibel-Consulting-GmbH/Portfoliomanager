# Phase 1 — Fachliche und quantitative Korrektheit

**Projekt:** Portfoliomanager  
**Audit-Branch:** `audit/phase-0-baseline`  
**Datum:** 13. August 2026  
**Status:** F1-01, F1-02 und F1-03 verifiziert behoben

> **Scope:** Phase 1 prüft die zentralen, finanzmathematisch wirksamen Kernpfade mit deterministischen Referenzfällen und vorhandenen Tests. Sie ist kein Ersatz für die folgenden Sicherheits-, End-to-End-, Betriebs-, Last- und Compliance-Phasen. Es wurden keine Signale, Berechnungen, Datenbankdaten oder Produktionsparameter verändert.

## Management-Zusammenfassung

Die geprüften Kernpfade sind **nicht pauschal fehlerhaft**. Die drei priorisierten Befunde zu Punkt-in-Zeit-Zensur, Sortino-Ratio und TTWROR-Transparenz sind nach Freigabe isoliert behoben und durch Regressionstests abgesichert.

| Priorität | Befund | Konsequenz | Freigabe vor Fix nötig |
|---:|---|---|---|
| Behoben | **F1-03** — gleiche Meldetage galten als Punkt-in-Zeit-verfügbar | konservative Next-Trading-Day-Zensur ist implementiert und verifiziert | Nein; bei Zeitstempeldaten später optional präzisieren. |
| Behoben | **F1-01** — Sortino-Mindestziel war inkonsistent | Target-aware Definition ist verbindlich umgesetzt und in der Modellselektion verifiziert | Nein; endlicher Rückgabewert 0 bei fehlender Downside bleibt dokumentierter Vertrag. |
| Behoben | **F1-02** — TTWROR-Tageskappung | Tatsächliche Rendite wird ausgewiesen; Ausreisser sind als Datenqualitätsbefund markiert | Nein; Corporate-Action- und Quellenprüfung bleibt der Folgeprozess. |

## Prüfgegenstand und Evidenz

| Prüffeld | Ergebnis | Evidenz |
|---|---|---|
| Einheitenvertrag | abgeschlossen | Dezimal-/Prozent-, Tages-/Jahres-, Brutto-/Netto- und CHF/FX-Verträge gegen Quellcode und Referenzfälle abgeglichen. |
| Score-, Signal- und Regime-Pipeline | verifiziert mit Vorbehalt | Drei-Score-Abdeckung, Regime-Aliase, Bandgrenzen und LPPL-Risk-Overlay geprüft. 43 zielgerichtete Tests bestanden. |
| Risiko und Performance | verifiziert | Target-aware Sortino und transparente TTWROR-Ausweisung sind mit Referenzfällen geprüft. |
| Optimierung und Kosten | verifiziert im geprüften Umfang | HRP-Gewichtssumme, Nichtnegativität, Bandgrenzen, Multi-Asset-Sleeve, Benchmark-Composite und Kostenmodell. 48 Optimierungs-/Kosten- und 27 Benchmark-/Outcome-Tests bestanden. |
| Punkt-in-Zeit | verifiziert | Kurszukunft und gleiche Meldetage sind konservativ ausgeschlossen; effektiver Handelstag wird berücksichtigt. |
| Gesamte zielgerichtete Evidenz | bestanden | 16 neue Zieltests für F1-01 bestanden. Die Gesamtsuite mit erhöhtem Timeout zeigt 1'244 bestandene Tests und die 11 bekannten externen/Format-Testfehler. |

## Reproduzierte Referenzfälle

| Fall | Soll-Referenz | Ist-Ausgabe | Bewertung |
|---|---:|---:|---|
| 20 Tagesrenditen bei 90 % der täglichen 2-%-Mindesthürde | Sortino < 0; Referenz −15.8745 | `calcSortino` = −15.8745 | F1-01 verifiziert behoben. |
| CHF 100 auf CHF 160 ohne Cashflow | TTWROR +60 % | TTWROR +60 %, Datenqualitätswarnung | F1-02 verifiziert behoben. |
| Filing am 1. Mai, Stichtag 1. Mai | ohne Uhrzeit konservativ noch nicht verwendbar | `abschlussVerfuegbarAm` = `true` | F1-03 bestätigt. |
| Qualität 80, Bewertung fehlt, Timing 60 im Bullenregime | Score 66.7, BUY, Abdeckung 75 % | identisch | verifiziert. |
| LPPL 0.6 im Bullenregime | Warnung plus Risikodämpfung | Regime-Konfidenz 1.0, aber Risk Overlay 60 % | kein direkter Ausführungsbefund; Anzeige-/Begriffsdrift bleibt notiert. |

## Nicht als Befund klassifizierte Punkte

Die Prüfung hat mehrere scheinbare Inkonsistenzen abgegrenzt, die **nicht** als unmittelbarer Produktionsfehler eingestuft werden. Die Multi-Asset-Benchmark renormiert bei ausreichender Abdeckung bewusst und weist die Abdeckung transparent aus. Das Kostenmodell berechnet im Vorschlags-Outcome einen einmaligen Portfolioaufbau; es behauptet keine vollständige Umschichtungsabrechnung. Der parallele `tickerScoring`-Helper ist nach der Aufrufanalyse derzeit kein kundenwirksamer Pfad. Das LPPL-Risiko wird nicht über die Regimekonfidenz, sondern über das nachgelagerte Risk Overlay handlungswirksam gedämpft.

## Aktualisierung: F1-03-Remediation

Die Freigabe für F1-03 wurde umgesetzt. Datumsgenaue Filings, Frist-Fallbacks und Quartalsberichte mit unbekannter Uhrzeit werden erst **nach** ihrem Kalenderdatum zugelassen. Zusätzlich verwendet die Rekonstruktion den tatsächlichen letzten Handelstag als Zensurstichtag, wenn ein Monatsletzter auf ein Wochenende oder einen Feiertag fällt. Dadurch können Filings nach Handelsschluss am letzten Handelstag nicht mehr in die gleiche Score-/Renditezeile einfliessen.

## Aktualisierung: F1-01-Remediation

Die Anwendung nutzt verbindlich die target-aware Sortino-Ratio: Zähler und Downside-Deviation beziehen sich auf dieselbe tägliche Mindesthürde `rf / 252`. Dies betrifft Portfolio-Risiko, Benchmarkvergleich, Rollfenster und die 15-%-Sortino-Komponente der Modellselektion. Die positive-RF-Gegenprobe sowie ein Modellselektionsfall sind automatisiert abgesichert.

## Aktualisierung: F1-02-Remediation

Die TTWROR kappt tatsächliche Tagesrenditen nicht mehr. Tageswerte über ±50 % fliessen unverändert in Rendite, Kurve und Annualisierung ein und werden gleichzeitig mit Datum, Rohwert und Schwelle als Datenqualitätswarnung ausgegeben. Die Portfolioansicht macht diese Warnung sichtbar; sie verändert keine Daten und trifft keine automatische Corporate-Action-Annahme.

## Freigabevorschlag für punktuelle Remediations

Jeder Fix bleibt isoliert, beginnt mit einem roten Test und wird nur auf einem separaten Branch umgesetzt. Nach jedem Fix folgen zielgerichtete Tests, die Gesamtsuite, TypeScript, Build und — falls sichtbar betroffen — eine Prüfung in der laufenden Anwendung.

| Reihenfolge | Freigabeobjekt | Geplantes Vorgehen | Abnahmekriterium |
|---:|---|---|---|
| 1 | F1-03 Punkt-in-Zeit | umgesetzt und verifiziert | Same-Day-Filing beeinflusst weder Score noch Folgerendite; vergangene Kurse bleiben unverändert. |
| 2 | F1-01 Sortino | umgesetzt und verifiziert | Target-aware Mindesthürde ist in Risikostatistik und Modellselektion konsistent. |
| 3 | F1-02 TTWROR | umgesetzt und verifiziert | Tatsächliche Rendite wird ausgewiesen; Ausreisser sind transparent markiert. |

## Nächster Auditabschnitt

Phase 2 (Security & Governance) prüft als Nächstes Berechtigungen, Mandantentrennung, Secrets, Abhängigkeiten und Datenschutz.
