# Test-Portfolio – Korrektur des 5J-Snapshotfensters

**Stichtag:** 28. September 2026  
**Portfolio:** `5160001` («Test»)  
**Umfang:** abgeleitete Kursrendite-/Gesamtrendite-Snapshots und deren 5J-Risikoauswertung. Keine Bestands-, Cash-, Ledger-, Transaktions- oder Handelsdaten wurden geändert.

## Befund

Nach einem regulären Tagespreisimport waren die 5J-Kennzahlen im Testportfolio leer, obwohl für die meisten Positionen eine vollständige Historie vorhanden war.

Die Ursache war ein Fehler im abgeleiteten Snapshot-Refresh:

1. Der Tagesimport übergab ein kurzes aktuelles Fenster (zum Beispiel **21.–25.09.2026**).
2. Wechselte für einen Titel die valide bevorzugte Total-Return-Quelle – insbesondere auf die EODHD-Ereignisrekonstruktion –, ersetzte der Refresh die bestehende 5J-Snapshotreihe durch genau dieses kurze Fenster.
3. Frische wurde bisher nur am Abrufzeitstempel gemessen. Eine fünf Tage lange Reihe galt deshalb fälschlich als «aktuell».
4. Die strenge Risiko-Gate-Logik erkannte korrekt die fehlende Abdeckung und unterdrückte folgerichtig Kursrendite, Gesamtrendite, Volatilität, Sharpe und Drawdown.

Betroffen waren konkret `KAP.IL`, `OFN.SW`, `BRKN.SW` und `MNG.L`; ihre Total-Return-Snapshots enthielten nur vier bzw. fünf aktuelle Handelstage.

## Korrektur

- Die Snapshot-Frischeprüfung verlangt nun **beides**: einen frischen Abrufzeitstempel **und** eine tatsächlich ausreichende historische Abdeckung.
- Jeder Portfolio-Snapshotrefresh erweitert ein vom Tagesimport kommendes Kurzfenster automatisch mindestens auf das vollständige **Fünfjahresfenster**.
- Dies verhindert künftig, dass eine kurze Tagesreihe eine vorhandene lange Renditebasis ersetzt.
- Die vier betroffenen Total-Return- und splitbereinigten Kursreihen wurden kontrolliert für **25.09.2021–25.09.2026** wiederhergestellt:

| Ticker | Validierte Quelle | Zeilen |
|---|---|---:|
| KAP.IL | EODHD-Event-basierte Brutto-Gesamtrendite | 1’261 |
| OFN.SW | EODHD-Event-basierte Brutto-Gesamtrendite | 1’257 |
| BRKN.SW | EODHD-Event-basierte Brutto-Gesamtrendite | 1’257 |
| MNG.L | EODHD-Event-basierte Brutto-Gesamtrendite (GBp-Quotierung) | 1’262 |

## Verifikation

Dev-Livecheck nach Cache-Invalidierung, Portfolio «Test»:

| Kennzahl | Ergebnis |
|---|---:|
| Kursrendite p.a. (5J), splitbereinigt, ohne Dividenden | **+3,9 %** |
| Brutto-Gesamtrendite p.a. (5J), inklusive Dividenden | **+7,9 %** |
| Volatilität p.a. (5J) | **10,5 %** |
| Sharpe (5J) | **0,57** (Benchmark 0,13) |
| Maximaler Drawdown (5J) | **−17,3 %** (Benchmark −29,3 %) |

## Testabdeckung

Die neue Regression testet insbesondere:

- einen frischen, aber unvollständigen 5J-Snapshot;
- die Ausweitung eines Tagesfensters auf den analytischen 5J-Zeitraum;
- getrennte Frischeprüfung für Total-Return- und splitbereinigte Kursreihen.

> Research und Analyse, keine persönliche Anlageberatung.
