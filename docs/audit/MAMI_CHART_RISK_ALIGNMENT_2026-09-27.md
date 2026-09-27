# Mami – Abgleich von Chart und Fünfjahres-Kursrendite

**Stichtag:** 27. September 2026  
**Portfolio:** «Mami» (ID 4020001), 25 Positionen, Demo-Portfolio  
**Status:** korrigiert, test- und livevalidiert im Devserver

## Anlass

Die angezeigte **Kursrendite p.a. (5J)** passte nicht zum «Max»-Chart. Der frühere Chart zeigte am 25. September 2026 ungefähr **+50,9 %** für die Aktienlinie, während die damalige Risikokachel aus einer abweichenden Preis-/Allokationsbasis fast keine Kursrendite meldete. Das war nicht plausibel und nicht akzeptabel.

## Belegte Ursachen

| Ursache | Auswirkung | Korrektur |
|---|---|---|
| **Unbereinigte Rohkurse bei Aktiensplits** | Die feste Stückzahlbewertung sah etwa bei Alphabet vor dem 20:1-Split einen alten Kurs, nach dem Split aber einen um den Splitfaktor reduzierten Kurs. Das ließ GOOGL fälschlich wie einen sehr großen Verlust aussehen. | Eigene, additive **splitbereinigte Kurs-Snapshotreihe**; kein Überschreiben der Rohkurse und keine Dividendeneffekte in dieser Kursreihe. |
| **Chart mit aktuellen Gewichten** | Der Chart gewichtete Gewinner rückwirkend mit den heutigen Gewichten. Die Risikokachel bewertete dagegen feste Stückzahlen und Cash. Dadurch konnten die Endwerte auch ohne Datenfehler unterschiedlich sein. | Für Positionen mit gespeicherten Stückzahlen verwendet der Chart nun dieselben **festen Stückzahlen plus feste Cashreserve** wie die Risikoanalyse. Ältere Portfolios ohne Stückzahlen behalten den expliziten Gewichts-Fallback. |
| **Historischer Cache nach Snapshot-Refresh** | Der Chart konnte bis zu 15 Minuten eine alte Rohkursreihe zeigen. | Der Chartcache ist versionsbasiert; ein Snapshot-Refresh invalidiert außerdem alle abgeleiteten Chartcaches. |

## Datenvertrag nach der Korrektur

| Darstellung | Datenbasis | Dividenden | Cash | Zweck |
|---|---|---:|---:|---|
| Chart **Aktien** | feste Stückzahlen, CHF, splitbereinigte Kurse | Nein | Nein | Entwicklung der Wertschriften allein |
| Chart **Gesamt** | feste Stückzahlen, CHF, splitbereinigte Kurse | Nein | Ja, 0 % Rendite | Direkter Vergleich zur Kachel «Kursrendite p.a. (5J)» |
| **Kursrendite p.a. (5J)** | dieselbe feste Gesamtallokation | Nein | Ja | Langfristiger Kursvergleich ohne Ausschüttungen |
| **Brutto-Gesamtrendite p.a. (5J)** / Sharpe / Vola / Drawdown | feste Gesamtallokation, Event-/adjusted-close-Gesamtrenditereihe | Ja, rechnerisch reinvestiert | Ja | Risiko- und Total-Return-Analyse |

> Die «Aktien»-Chartlinie ist bewusst höher als «Gesamt», sofern Cash vorhanden ist. Für den direkten Vergleich mit der 5J-Kursrendite muss **Gesamt** gewählt sein; die UI erklärt dies im Tooltip der Umschaltung.

## Kontrollierte Datenanreicherung

- Alle **25** Mami-Positionen wurden ausschließlich als getrennte Kurs- und Gesamtrendite-Snapshots für **15.09.2021–27.09.2026** neu abgerufen.
- Ergebnis: **25/25** aktualisierte Reihen, **31’635** splitbereinigte Kurszeilen.
- Gesamtreturn-Quellen bleiben je Handelslinie getrennt: EODHD adjusted close bzw. bei belegter Abweichung datierte EODHD-Dividendenereignisse; für DBS wird die verifizierte native SGD-Reihe verwendet.
- Unverändert blieben `historical_prices.close` (Rohkurse), Portfolioallokation, Bestand, Cash, Ledger und Transaktionen.

## Live-Abgleich am Devserver

**Datenstand:** 25.09.2026, fünfjähriges Proxyfenster 27.09.2021–25.09.2026.

| Kennzahl | Ergebnis | Abgleich |
|---|---:|---|
| Chart **Aktien**, Max | **+35,74 %** | ohne Cash; daher nicht direkt mit der Gesamtkachel vergleichen |
| Chart **Gesamt**, Max | **+31,06 %** | feste Stückzahlen + Cash; entspricht annualisiert der Kurskachel |
| Kursrendite p.a. (5J) | **+5,6 %** | geometrische Annualisierung von ca. +31,1 % über das qualifizierte Fenster |
| Brutto-Gesamtrendite p.a. (5J) | **+9,0 %** | inkl. reinvestierter Bruttodividenden |
| Volatilität p.a. (5J) | **9,5 %** | tägliche CHF-Brutto-Gesamtrenditen |
| Sharpe (5J) | **0,72** | 2 % p.a. risikofreier Satz; SPI-Benchmark 0,10 |
| Max. Drawdown (5J) | **−13,1 %** | Brutto-Gesamtrenditereihe; SPI −29,3 % |

Damit ist die frühere Differenz nicht verdeckt, sondern aufgelöst: Sie entstand aus einer nicht splitbereinigten festen Stückzahlreihe **und** einer abweichenden, rückwirkend gewichteten Chartmethodik.

## Test- und Sicherheitsnachweis

- Neue TDD-Regression `fixedShareReturnSeries.test.ts`: feste Stückzahlen, feste Cashreserve, kein rückwirkendes Rebalancing sowie kontrolliertes Forward-Fill.
- Bestehende Regressionen: Splitbereinigung, Event-Gesamtrendite, Quellenwahl und Cacheinvalidierung.
- Fokussiert: **4 Dateien / 18 Tests bestanden**.
- Vollständige Regression: **249 Testdateien / 1’719 Tests bestanden**, 5 / 11 bewusst übersprungen.
- TypeScript und `git diff --check`: vor Abschluss erneut ausgeführt.
- Keine Portfolio-, Cash-, Ledger-, Transaktions- oder Handelsaktion ausgelöst.

**Research und Analyse, keine persönliche Anlageberatung.**
