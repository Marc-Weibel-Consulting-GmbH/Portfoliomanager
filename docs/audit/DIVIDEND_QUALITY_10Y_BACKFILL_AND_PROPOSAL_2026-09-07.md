# Audit: Dividenden-Qualitätsentwurf mit zehnjähriger Preisbasis

**Stand:** 7. September 2026  
**Geltungsbereich:** Unverbindlicher, nicht übernommener Wizard-Entwurf über CHF 600'000.  
**Nicht-Handelsgrenze:** Es wurde weder ein Portfolio angelegt noch eine Börsenorder, Zahlung oder ein Geldtransfer ausgelöst.

## Live-Prüfung des korrigierten Entwurfs

Der Wizard wurde mit **Dividenden & Ertrag**, **konservativ**, **exakt 15 Jahre**, **Multi-Asset-Mix**, **Dividende + Qualität (10 Jahre)** und **drei manuellen Tranchen** neu durchlaufen. Die optionale KI-Verfeinerung lief nicht erfolgreich durch, erreichte aber nach Ablauf des gemeinsamen Zeitbudgets einen kontrollierten Abschluss. Der deterministische Vorschlag blieb sichtbar und der Wizard zeigte keinen blockierenden Endlos-Spinner.

Der Serverlog bestätigt für diesen Lauf den Abschluss des Vorschlagsjobs nach 120 Sekunden: Beide Challenger wurden kontrolliert beendet, die Synthese wurde nicht mehr gestartet und der Job wurde anschliessend als abgeschlossen protokolliert. Providerfehler, darunter nicht erreichbare beziehungsweise nicht verfügbare optionale Modelle, blieben somit strikt nachgelagert und verhinderten den deterministischen Vorschlag nicht.

| Prüffeld | Befund aus der finalen Vorschlagsnutzlast |
|---|---:|
| Status | Finaler, manuell prüfbarer deterministischer Vorschlag; optionale KI-Verfeinerung zeitbegrenzt nicht verfügbar |
| Investierter Positionsanteil | 90,00 % |
| Cash-Reserve | 10,00 % |
| Kapitalbasis | CHF 540'000 investiert + CHF 60'000 Cash = CHF 600'000 |
| Anlageklassen nach Cash-Abzug | Aktien 26,98 %, Obligationen 45,02 %, Rohstoffe 3,60 %, Gold 7,20 %, Immobilien 7,20 % |
| Ungültige oder nichtpositive sichtbare Kurse | Keine |
| Kennzahlengeltungsbereich | Ausschliesslich Aktienkomponente, nicht Gesamtportfolio |
| Zehnjahres-Gate | 112 von 124 geeigneten Titeln mit Beobachtung am oder vor 7. September 2016 |
| FX-Grenze | 50,0 % nach Reduktion; CHF-Obligationen-Alternative eingesetzt |
| Fremdwährungspositionsdaten | 15 Positionen mit 24,26 % Gewicht; keine fehlende, null- oder negative Wechselkursrate |
| Tranchierung | 3 × CHF 200'000; alle Status `not_released`; separate manuelle Freigabe erforderlich |

## Kapitalbasis-Fix

Die Multi-Asset-Matrix wurde bisher als Brutto-Mischung vor Cash ausgewiesen. Die finale Darstellung leitete ihre Klassenquoten aber nicht aus den bereits um die Liquiditätsreserve gekürzten Positionsgewichten her. Der neue reine Helfer `applyCashReserveToMultiAssetSleeve` skaliert die fertigen Positionen deshalb auf den investierbaren Anteil, aggregiert die Klassenquoten aus diesen finalen Positionen und leitet Cash als Differenz zu 100 % ab. Ein Rundungsausgleich auf der grössten Position verhindert eine Drift, etwa 89,99 % investiert plus 10,01 % Cash.

Die Live-Prüfung bestätigt die Invariante: **finale Anlageklassenmischung plus Cash-Reserve ergeben exakt 100,00 %**. Die Wizard-Oberfläche bezeichnet die Werte nun als „Gesamte Mischung“ und führt Liquidität darin sichtbar mit.

Auch die spätere, separat auszulösende Wizard-Übernahme verwendet jetzt vorrangig die finale `cashReservePct` des Vorschlags. Sie normiert die Positionen damit auf den tatsächlich investierbaren Anteil und nicht auf 100 %. Eine tatsächliche Portfolioanlage wurde in diesem Audit bewusst nicht ausgelöst und bleibt von einer weiteren ausdrücklichen Nutzerfreigabe abhängig.

## Testnachweis bis zu diesem Stand

| Prüfung | Ergebnis |
|---|---|
| Fokusregressionen für Cash, Zehnjahres-Gate, Tranchierung, Kennzahlenscope, Analysecopy und Backfill | 38 bestanden |
| Multi-Asset-Cash-Regressionen inkl. 99,94-%-Rundungsfall | 14 bestanden |
| TypeScript | Fehlerfrei |
| Vollständige Testsuite | 1'508 bestanden, 11 bewusst übersprungen |

Die vollständige Suite enthielt zunächst 11 unabhängige Fehlermeldungen aus zwei Optimierer-/Backtest-Testharnesses. Ursache war die inzwischen kanonische DB-Ticker-Normalisierung auf `.US`, während deren synthetische Testreihen noch unnormalisierte Schlüssel verwendeten. Nur diese Testfakes wurden auf die bestehenden kanonischen Schlüssel umgestellt; die Produktionslogik blieb unverändert. Danach war die Suite vollständig grün.

## Verbleibende Grenzen

Die ausgewiesenen historischen Rendite-, Schwankungs-, Sharpe- und Drawdownwerte bleiben Kennzahlen des optimierten Aktienanteils. Für die nachträglich zugefügten Sleeves liegt keine validierte gemeinsame zehnjährige Kurs- und FX-Reihe vor; deshalb werden keine Gesamtportfolio-Kennzahlen behauptet. Der vorgeschlagene Entwurf ist keine Prognose, Anlageberatung oder Ausführungsauftrag und braucht vor jeder Portfolioübernahme eine ausdrückliche menschliche Prüfung und Freigabe.
