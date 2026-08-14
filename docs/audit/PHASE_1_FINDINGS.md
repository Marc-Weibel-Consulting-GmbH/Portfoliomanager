# Phase 1 — Befunde und Gegenproben

**Stand:** 13. August 2026  
**Status:** F1-03 verifiziert behoben; F1-01 und F1-02 warten weiterhin auf eine separate Produktentscheidung.

## F1-01 — Sortino-Ratio verwendet zwei unterschiedliche Mindestziele

| Feld | Nachweis |
|---|---|
| **Einstufung** | **hoch** — kennzahlen- und modellselektionsrelevant; kein direkter Ausführungsbefehl. |
| **Codebeleg** | `server/analytics/riskStats.ts:51–64` bildet im Zähler Tagesrenditen gegen `rf / 252` ab, bildet den Downside-Term aber aus negativen **Brutto**renditen (`r < 0`) relativ zu null. |
| **Produktpfad** | `server/analytics/engine.ts:649–650` übergibt einen konfigurierbaren risikofreien Satz an Sharpe und Sortino. `server/lib/signals/modelSelector.ts:197–199` verwendet den Standardwert in der Engine-Selektion; der normierte Sortino-Anteil hat Gewicht 15 % (`235–243`). |
| **Reproduktion** | 20 konstante Tagesrenditen von `0.9 × (2 % / 252)`: Beobachtete `calcSortino`-Rückgabe **0**. Bei identischem Mindestziel von 2 % p.a. beträgt die target-aware Referenz **−15.8745078664**. |
| **Folge im Selektor** | Der beobachtete Sortino-Beitrag ist **0.05625**, die target-aware Referenz wird auf **0** normiert. Die Differenz kann damit die Reihenfolge naher Engine-Kandidaten verändern. |
| **Falsch-positiv-Check** | Die vorhandenen Tests in `riskStats.test.ts:14–37` setzen den risikofreien Satz in ihren Formeltests auf null. Es gibt keinen Test für einen positiven Mindestzins; keine gefundene Produktdefinition verlangt ausdrücklich einen Downside-Term relativ zu null bei gleichzeitigem Überschussrendite-Zähler. |

### Ursachenhypothese

Die Implementierung kombiniert zwei gebräuchliche Varianten des Sortino, ohne sich für eine zu entscheiden: Überschussrendite im Zähler und Nullschwelle im Downside-Term. Bei `rf = 0` stimmen beide Varianten überein; deshalb decken die aktuellen Tests den Fehler nicht auf.

### Fix-Gate

Vor einem Fix wird ein isolierter roter Test ergänzt, der einen positiven `rf` und Renditen knapp darunter verwendet. Danach ist eine explizite Produktentscheidung erforderlich:

1. **Target-aware Sortino:** Zähler und Downside-Abweichung beide relativ zu `rf / 252`; oder
2. **Zero-target Sortino:** Zähler und Downside-Abweichung beide relativ zu null.

Für die bestehende API, die bereits einen risikofreien Satz entgegennimmt, ist Option 1 die konsistentere Hypothese. Sie wird jedoch nicht ohne Freigabe implementiert.

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
