# Phase 1 — Befunde und Gegenproben

**Stand:** 13. August 2026  
**Status:** F1-01 und F1-03 verifiziert behoben; F1-02 wartet weiterhin auf eine separate Produktentscheidung.

## F1-01 — Sortino-Ratio verwendete zwei unterschiedliche Mindestziele — **verifiziert behoben**

| Feld | Nachweis |
|---|---|
| **Einstufung vor Fix** | **hoch** — kennzahlen- und modellselektionsrelevant; kein direkter Ausführungsbefehl. |
| **Fehlerbild** | Der Zähler verwendete Überschussrenditen gegen `rf / 252`, der Downside-Term jedoch negative Bruttorenditen relativ zu null. |
| **Verbindliche Definition** | Target-aware Sortino: Zähler und Downside-Deviation verwenden denselben täglichen Mindestzins `rf / 252`. Der Vertrag steht in `PHASE_1_REFERENCE_CONTRACT.md`. |
| **Fix** | `server/analytics/riskStats.ts` bildet den Downside-Term jetzt aus negativen Überschussrenditen. Die Division erfolgt weiterhin über alle Beobachtungen `N`. |
| **Roter Test** | 20 konstante Tagesrenditen von `0.9 × (2 % / 252)` ergaben zuvor fälschlich 0 statt der target-aware Referenz **−15.8745078664**. |
| **Produktpfad** | `server/analytics/engine.ts` übergibt den konfigurierbaren risikofreien Satz an Sharpe und Sortino. `modelSelector.ts` verwendet die korrigierte Standarddefinition in der Engine-Evaluation; der Sortino-Anteil bleibt mit 15 % gewichtet. |
| **Verifikation** | 16 zielgerichtete Risiko- und Modellselektions-Tests bestanden. Der Modellselektions-Test weist bei positivem `rf` und negativer Überschussrendite explizit einen negativen Sortino aus. |

### Verbleibende Semantik

Wenn keine Rendite unter der Mindesthürde liegt, gibt die bestehende API weiterhin `0` statt einer unendlichen Kennzahl zurück. Das ist bewusst als endlicher, neutraler Rückgabewert dokumentiert und verhindert unbeschränkte Werte in UI und Modellselektion.

## F1-02 — TTWROR kappt tatsächliche Tagesrenditen ohne Kennzeichnung

| Feld | Nachweis |
|---|---|
| **Einstufung** | **mittel** — dokumentierter Datenfehler-Schutz, aber Konflikt mit einer exakten Performancekennzahl. |
| **Codebeleg** | `server/lib/performanceEngine.ts:170–177` begrenzt jede berechnete Tagesrendite auf `[-50 %, +50 %]`, bevor sie in TTWROR und Chartserie eingeht. |
| **Reproduktion** | Bewertungsreihe CHF 100 → CHF 160 ohne Cashflow: Rohformel ergibt **+60 %**, `calculateTTWROR` liefert jedoch **+50 %** und speichert auch in der täglichen Serie +50 %. |
| **Falsch-positiv-Check** | Die Kappung ist in `performanceEngine.ts:173–175` ausdrücklich als Schutz gegen Datenfehler kommentiert. Die Modulbeschreibung nennt gleichzeitig eine „Clean-room implementation“ der Portfolio-Performance-Formel und eine exakte geometrische Verkettung. Keine Datenqualitätsmarkierung, kein Parameter und kein Audit-Event wird ausgegeben. |

### Bewertung

Dies ist noch kein unstrittiger Rechenfehler, sondern ein **offener Produktvertragskonflikt**: Ein Schutz gegen offensichtliche Kursfehler ist legitim; eine nicht markierte Kappung verändert aber eine berichtete historische Performance. Erhöhte tägliche Renditen können bei Corporate Actions, Korrekturen, illiquiden Instrumenten oder ETPs vorkommen.

### Fix-Gate

Vor einer Änderung muss entschieden werden, ob die Anwendung:

1. unveränderte TTWROR aus geprüften adjustierten Preisen zeigt und Anomalien separat markiert;
2. eine Datenqualitätsregel anwendet, die die Beobachtung verwirft statt die Rendite zu verändern; oder
3. Kappung als bewusstes Produktmodell beibehält, sie aber in Ergebnis, Audit-Trail und UI sichtbar offenlegt.

## F1-03 — Punkt-in-Zeit-Filter liess Meldungen am Entscheidungsstichtag bereits zu — **verifiziert behoben**

| Feld | Nachweis |
|---|---|
| **Einstufung vor Fix** | **hoch** — konnte historische Score-Optimierung und Backtests bei Meldungen nach Handelsschluss verzerren. |
| **Fehlerbild** | `filing_date <= stichtag` akzeptierte ein Filing am gleichen Kalendertag. Gleichzeitig konnte ein Monatsstichtag am Wochenende liegen, während Score und Vorwärtsrendite den Schlusskurs des vorausgehenden Freitags verwendeten. |
| **Fix** | `server/lib/punktInZeit.ts` verlangt jetzt für `filing_date`, Frist-Fallbacks und `reportDate` eine **strikt frühere** Verfügbarkeit (`<`). `server/lib/punktInZeitRekonstruktion.ts` zensiert Fundamentals gegen das Datum der tatsächlich verwendeten letzten Kurszeile, nicht gegen einen nachgelagerten Kalendermonatsletzten. |
| **Roter Test** | Vor der Änderung schlugen zwei Tests fehl: Same-Day-Filing und Same-Day-Quartalsbericht wurden jeweils fälschlich zugelassen. |
| **Verifikation** | Die neuen Tests bestätigen: gleicher Tag ausgeschlossen, Folgetag zugelassen; Wochenend-Stichtag löst korrekt auf den letzten Handelstag auf. 80 zielgerichtete Punkt-in-Zeit-/Rekonstruktions-/Backtest-Tests bestanden. |
| **Regressionscheck** | TypeScript und Produktions-Build bestanden. Die Gesamtsuite zeigt weiterhin ausschliesslich die 11 bereits in Phase 0 bekannten, unabhängigen Fehler (Schweizer Formatvertrag sowie externe TradingView-/Sornette-Integrationstests). |

### Verbleibende Annahme

Die Regel ist bewusst konservativ: Bei einem Kalenderdatum ohne verlässliche Uhrzeit wird ein Filing erst nach Ablauf dieses Tages verwendbar. Sobald ein Datenanbieter geprüfte Veröffentlichungszeitpunkte inklusive Handelsplatz-Zeitzone liefert, kann die Anwendung eine präzisere Intraday-Regel ergänzen. Ohne diese Daten bleibt die Next-Trading-Day-Zensur der sichere Standard.

## Gegenproben und abgegrenzte Nicht-Befunde

| Thema | Ergebnis | Beleg |
|---|---|---|
| Drei-Score-Abdeckung | verifiziert | Qualität 80, Bewertung `null`, Timing 60 im Bullenregime liefert Score 66.7, `BUY`, Abdeckung 0.75. Nur Timing bleibt bei 0.50 Abdeckung korrekt ohne Signal. |
| Regime-Alias | verifiziert | Zielgerichtete Tests bestätigen die Zuordnung `bull_trend → bull` und `bear_trend → bear` für drei Gewichtstabellen. |
| LPPL-Regimekonfidenz | **kein direkter Ausführungsbefund** | Ein Bullenfall mit LPPL 0.6 meldet Regimekonfidenz 1.0, obwohl der Kommentar eine Reduktion erwähnt. Der `riskOverlayEngine` dämpft jedoch separat auf 60 % und beeinflusst damit die endgültige Signalaktion. Das verbleibende Thema ist Anzeige-/Begriffsdrift, nicht eine ungedämpfte Ausführung. |
| Paralleles `tickerScoring` | aktuell kein Produktpfad | Die Helper-Funktion hat abweichende Bänder, besitzt jedoch keinen produktiven Aufrufer. Sie wird als Code-Drift-Risiko vorgemerkt, aber nicht als kundenwirksamer Befund klassifiziert. |
| Zielgerichtete Tests | bestanden | 5 Dateien, 86 Tests: Regime-Schlüssel, Risiko, Performance, Punkt-in-Zeit-Rekonstruktion und Punkt-in-Zeit-Timing. |

## Noch offene Prüfung in Phase 1

1. Optimierungs- und Gewichtssummenvertrag: HRP, Ledoit-Wolf, harte/optionale Nebenbedingungen sowie Rundungen nach der Optimierung.
2. Kosten- und Benchmarkbrücke: Kostenbasis, 70-%-Abdeckung, FX und Multi-Asset-Referenz im realen Outcome-Pfad.
3. Punkt-in-Zeit-Gegenprobe mit veröffentlichungsdatierter Fundamentals-Reihe, Split/Dividenden und FX-Lücke.
4. Numerische Grenzfälle: NaN/Infinity, leere Portfolios, negative EPS, fehlende Kursreihe und unzulässige Gewichte.
