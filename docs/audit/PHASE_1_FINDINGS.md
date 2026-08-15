# Phase 1 — Befunde und Gegenproben

**Stand:** 13. August 2026  
**Status:** F1-01, F1-02 und F1-03 sind verifiziert behoben.

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

## F1-02 — TTWROR kappte tatsächliche Tagesrenditen ohne Kennzeichnung — **verifiziert behoben**

| Prüfaspekt | Vertrag |
|---|---|
| Reportingwert | Die TTWROR weist die tatsächliche mathematisch berechnete Tagesrendite aus; es gibt keine stille Kappung bei ±50 %. |
| Datenqualität | Tagesrenditen mit einem Betrag über 50 % erzeugen einen strukturierten Datenqualitätsbefund mit Datum, Rohwert und Schwelle. |
| Anzeige | Die Portfolioansicht markiert den Befund sichtbar, verändert aber weder die Performancekurve noch die Renditezahl. |
| Folgeprozess | Ein Befund ist ein Prüfauftrag für Corporate Actions, Kurse oder Buchungen; er löst keine automatische Datenmutation aus. |

Der rote Referenzfall CHF 100'000 auf CHF 160'000 ergab vor dem Fix fälschlich +50 %. Nach dem Fix wird die tatsächliche Rendite **+60 %** ausgewiesen und als `extreme_daily_return` markiert. Damit bleiben reale extreme Ereignisse sowie Datenfehler unterscheidbar und auditierbar.

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
