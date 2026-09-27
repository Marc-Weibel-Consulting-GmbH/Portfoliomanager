# Portfolio 5160001 («Test») – 5J-Risikoanalyse: Ursachen und Korrektur

**Stichtag:** 27.09.2026  
**Umfang:** Historische Kursbasis, Sharpe, Volatilität und Maximal-Drawdown. Keine Portfolio-, Cash-, Ledger- oder Handelsmutation.

## Ergebnis in einem Satz

Die bisher fehlenden Kennzahlen bestanden aus **zwei getrennten Datenintegritätsproblemen**: Der automatische Backfill akzeptierte bereits rund zwei Jahre Kursdaten als ausreichend, und vier Positionen besitzen nur ADR-/Auslandsproxyreihen in einer anderen Preiswährung bzw. ohne belegtes Umtauschverhältnis. Der erste Fehler ist korrigiert und für vier US-Titel additiv nachgeladen; der zweite bleibt bewusst als Datenlücke sichtbar statt eine falsche CHF-Risikokennzahl zu erzeugen.

## Beweisaufnahme

| Ticker | Befund vor Nachladung | EODHD-Nachladung | Status nach Nachladung |
|---|---:|---:|---|
| DINO | 540 Beobachtungen, 29.07.2024–22.09.2026 | 20.09.2021–27.09.2026, additive EODHD-Zeilen | **1’260** Beobachtungen, 20.09.2021–25.09.2026 |
| MO | 551 Beobachtungen, 12.07.2024–22.09.2026 | dito | **1’260**, 20.09.2021–25.09.2026 |
| PM | 551 Beobachtungen, 12.07.2024–22.09.2026 | dito | **1’260**, 20.09.2021–25.09.2026 |
| O | 551 Beobachtungen, 12.07.2024–22.09.2026 | dito | **1’260**, 20.09.2021–25.09.2026 |

Der frühere technische Grenzwert lag bei nur **100** Beobachtungen. Damit wurde eine rund zweijährige Reihe fälschlich als ausreichend behandelt, obwohl der veröffentlichte Risikovertrag mindestens fünf Kalenderjahre, mindestens 1’000 qualifizierte Beobachtungen, vollständige Start-/Endabdeckung und einen Benchmark-Stressnachweis verlangt.

### Verbleibende, bewusst gesperrte Positionen

| Position | native Handelswährung | verfügbare EODHD-Historie | Warum nicht verwendbar |
|---|---|---|---|
| 6856.T – Horiba | JPY | 01H.F, Frankfurt (EUR) | Andere Handelslinie und Währung; keine belegte Ratio zur Tokyo-Position. |
| D05.SI – DBS | SGD | DBSDY.US, US-ADR (USD) | ADR statt Singapore-Primärlinie; ohne belegte ADR-Ratio nicht vergleichbar. |
| SE0007491303.SG – Bravida | Portfoliodatensatz EUR | BRAV.ST, Stockholm (SEK) | Abweichende Börsen-/Währungsbasis gegenüber der gespeicherten Position. |
| SRG.MI – Snam | EUR | SNMRF.US, US-OTC (USD) | OTC-Linie statt italienischer Primärlinie; keine Ratio belegt. |

EODHD-Abfragen bestätigten für 6856.T/6856.TSE und D05.SI/D05.SG keine native EOD-Reihe. BRAV.ST liefert eine SEK-Reihe; S9M.F lieferte eine nicht unmittelbar zur gespeicherten SRG.MI-Basis validierbare Frankfurt-Reihe. Keiner dieser Fälle wurde geschätzt, umgerechnet oder als identische Aktie unterstellt.

## Umgesetzte Korrekturen

1. Der automatische Backfill verlangt jetzt eine **vollständige 5J-Risikobasis** (mindestens 1’000 Beobachtungen, Start-/Endabdeckung mit je sieben Kalendertagen Toleranz) statt nur 100 Datenpunkte.
2. Der Backfill nutzt jetzt den **additiven** EODHD-Importpfad. Bestehende historische Kurs- und `adjustedClose`-Werte werden nicht überschrieben.
3. Nach jedem qualifizierten Risikogate werden **Rendite p.a. (5J)** (geometrisch) und **Volatilität p.a. (5J)** veröffentlicht – exakt auf derselben CHF-Allokationsreihe wie Sharpe und Max.-Drawdown.
4. Preisbasis-Inkompatibilitäten werden getrennt von fehlenden Kursdaten sichtbar ausgewiesen.
5. Der Portfolio-Builder schliesst künftig Kandidaten mit einer nicht vergleichbaren ADR-/Auslandsproxyreihe aus, statt ein Portfolio zu erzeugen, dessen 5J-Risikokennzahlen nicht berechenbar sind.
6. Excel-/PDF-Kennzahlen enthalten die klar bezeichnete **«Rendite p.a. (5J-Proxy)»**.

## Live-Ergebnis

In der Entwicklungsvorschau ist die Ursache im Risiko-Tab nachvollziehbar: Nach der Nachladung erscheinen DINO, MO, PM und O nicht mehr als Lücken. Es bleiben nur die vier oben genannten, explizit als **Preis-/Instrumentbasis** bezeichneten Datenlücken. Daher werden für dieses bestehende Portfolio weiterhin bewusst keine Sharpe-, Volatilitäts- oder Max.-Drawdown-Werte erfunden.

> Eine vollständige Risikokennzahl für dieses konkrete Portfolio erfordert künftig entweder eine belegte native Historie/Ratio für alle vier Positionen oder einen manuell bestätigten Ersatz der betreffenden Positionen. Diese Prüfung löste keine Portfolioänderung aus.

## Validierung

- Fokussierte Regression: 31 Tests bestanden.
- Zusätzlich: Exportmodell/PDF-Kennzahlen sowie EODHD-Symboltests: 19 Tests bestanden.
- TypeScript: fehlerfrei.
- `git diff --check`: fehlerfrei.
- Dev-Livecheck: Testportfolio 5160001 im Risiko-Tab; Datenlücken und neue 5J-Kennzahlen geprüft.

**Hinweis:** Research und Analyse, keine persönliche Anlageberatung.
