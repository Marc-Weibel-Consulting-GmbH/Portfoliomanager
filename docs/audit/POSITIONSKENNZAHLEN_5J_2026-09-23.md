# Positionsliste: Dividendenrendite und Volatilität 5J – 23. September 2026

## Umfang

Die Positionsliste in der detaillierten Portfolioansicht enthält zwei zusätzliche, sortierbare Spalten: **Div. Rendite** und **Vol. 5J**. Beide Werte stammen aus den bereits vorliegenden Instrument- und Preisreihen; es wurden keine Preise, Stammdaten, Positionen, Cash-Bestände oder Transaktionen geändert.

## Datenvertrag

| Spalte | Definition | Anzeige bei fehlender Grundlage |
|---|---|---|
| Div. Rendite | Brutto-Dividendenrendite aus dem aktuellen Instrumentdatensatz | `—` statt künstlicher 0 % |
| Vol. 5J | Annualisierte Standardabweichung täglicher Renditen über ein vollständiges, aktuelles Fünfjahresfenster; `adjustedClose` wird vor `close` verwendet, 252 Handelstage p.a., Stichprobenvarianz | `—` mit Tooltip für unvollständige Historie oder inkompatible Proxy-Preisgrundlage |

Für die Volatilität sind mindestens 1'000 tägliche Renditebeobachtungen und eine zeitliche Abdeckung bis maximal zehn Kalendertage vor dem Stichtag erforderlich. Diese Grenze verhindert, dass eine kurze oder veraltete Teilreihe als „5 Jahre“ ausgegeben wird. Reihen mit abweichender historischer ADR-/Proxywährung werden analog zur bestehenden DBS-Datenlückenregel nicht verwendet.

## Live-Leseprüfung am Portfolio «Mami»

Die Portfolioanreicherung lieferte für 35 Positionen Dividendenrenditen für 28 und belastbare Fünfjahresvolatilitäten für 33 Positionen. Beispiele aus der getesteten Antwort waren Nestlé (`4,02 %`, `18,4 %` Vol. 5J), Orell Füssli (`4,13 %`, `21,3 %`) und Swisscom (`3,99 %`, `15,1 %`). Die beiden übrigen Positionen werden ausdrücklich als Datenlücke behandelt.

## Tests

Der neue Unit-Test deckt die Berechnung mit vollständiger Historie, die Datenlücke bei unvollständiger Historie sowie die Vorrangregel für splitbereinigte Schlusskurse ab. Die anschliessende Portfolio-Leseprüfung bestätigte die neuen Felder an realen Daten.
