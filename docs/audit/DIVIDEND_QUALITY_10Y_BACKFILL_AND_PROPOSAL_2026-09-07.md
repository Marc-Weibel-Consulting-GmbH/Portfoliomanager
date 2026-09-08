# Audit: Dividenden-Qualitätsentwurf mit zehnjähriger Preisbasis

**Stand:** 7. September 2026  
**Geltungsbereich:** Prüfvorschau und anschliessend ausdrücklich freigegebener, rein interner Demo-Portfolioeintrag über CHF 600'000.
**Nicht-Handelsgrenze:** Es wurde keine Börsenorder, Zahlung oder Geldtransfer ausgelöst. Live-Tracking blieb deaktiviert; die Ledger-Tabelle enthält für den Eintrag keine Transaktion.

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

## Ausdrückliche Freigabe zur rein internen Übernahme

Nach Abschluss dieser Vorschau hat der Nutzer am 8. September 2026 die Übernahme ausdrücklich bestätigt. Der Wizard wurde infolge eines Seitenreloads erneut bis zum bereits gewählten Dividenden- und konservativen Profilweg geöffnet, damit die sichtbare Übernahmeaktion mit einer frischen Vorschau ausgeführt werden kann. Diese Freigabe umfasst ausschliesslich das Anlegen eines internen Portfolioeintrags. Sie umfasst ausdrücklich keine Börsenorder, keine Zahlung, keinen Geldtransfer und keine automatische Ausführung.

Beim anschliessenden Übergang auf die abschliessende Erstellseite wurde vor dem finalen Erstellen ein weiterer Integritätsfehler sichtbar: Die Positionstabelle summierte die investierten Positionen korrekt auf rund CHF 540'362, erklärte die Differenz zu CHF 600'000 aber fälschlich allein mit Stückzahlrundungen und zeigte die rund CHF 60'000 Cash-Reserve nicht als eigene Zeile. Der finale Button wurde deshalb **nicht** ausgelöst. Vor der Anlage eines Portfolioeintrags muss diese Abschlussansicht Cash explizit ausweisen und die Summe aus Wertpapieren, Cash und Startkapital konsistent darstellen.

Der Fix löste im Entwicklungsmodus einen Komponentenreload aus; der Wizard startet danach erwartungsgemäss wieder auf seiner Einstiegsseite. Der Dividenden- und konservative Parameterpfad wurde deshalb erneut geöffnet. Dieser Reload hat weder einen Portfolioeintrag noch eine Transaktion erzeugt und ist von der fachlichen Cash-Prüfung getrennt.

Die Ursache ist nun isoliert: Die Abschlussansicht berechnete `totalValue` und die prozentualen Gewichte ausschliesslich aus den Wertpapieren. Der serverseitige Create-Pfad erhielt die Cashquote zwar, aber die Abschlussansicht zeigte die daraus abzuleitende Restliquidität nicht. Ein gemeinsamer, reiner Kapitalbasisvertrag berechnet nun Wertpapierwert, Ziel-Cash, residuale Cash-Reserve, Gesamtwert und eine Überallokationsmarkierung. Die neue Regression prüft den konkret beobachteten Fall mit CHF 540'361.51 Wertpapierwert und stellt sicher, dass daraus CHF 59'638.49 Cash sowie exakt CHF 600'000 Gesamtkapital resultieren. Ein über das Startkapital gehender Stückzahlplan wird serverseitig bereits vor dem Insert abgewiesen.

## Portfolioanlage und neuer Wertprüfbefund

Nach der korrigierten Abschlussansicht wurde der Portfolioeintrag auf ausdrückliche Nutzerfreigabe erstellt. Er trägt die ID `3960001`, umfasst 31 Wertpapierpositionen und ist **nicht** für Live-Tracking aktiviert. Die Aktivitätsansicht zeigte unmittelbar nach der Erstellung keine Transaktionen.

Im ersten geladenen Portfoliodashboard betrug der sichtbare Gesamtwert jedoch CHF 587'629 bei einem Einstand von CHF 600'000; zugleich wurde „Rendite seit Kauf“ mit -2,1 % angezeigt. Diese unmittelbare Abweichung ist für einen gerade angelegten Demo-Portfolioeintrag eine kritische Kapitalbasisverletzung. Sie kann nicht als normale Marktbewegung oder als reine Stückzahlrundung eingeordnet werden. Vor Abschluss dieses Audits wird sie bis zur Preis-, FX-, Cash- und Wertberechnungsquelle nachverfolgt; es werden bis dahin keine Einzahlungen, Aktivierungen, Optimierungen oder Transaktionen ausgelöst.

Die Untersuchung belegt zwei zusammenhängende Ursachen im Vorschlagspfad. Erstens wurde ein CHF-notierter Obligationen-ETF anhand seiner **Anlageklasse** fälschlich als nominalwertbasierte Einzelanleihe gespeichert, obwohl sein Instrumenttyp ETF war. Zweitens verliessen Fremdwährungs-Sleeves den Multi-Asset-Resolver ohne ihre bereits in `stocks` vorhandene CHF-Rate; der Vorschlagsjob setzte sie danach explizit auf Faktor 1. Dadurch wurden USD-Kurse im Abschluss als CHF-Einstand angezeigt und die Stückzahl zu klein berechnet. Für CMDY und REET lag die belegte gespeicherte USDCHF-Rate bei 0.8092, wurde jedoch im initialen Eintrag nicht verwendet.

Der Quellfix trennt jetzt klar zwischen Anlageklasse und Instrumenttyp, überträgt für jeden Sleeve Handelswährung, lokalen Kurs und validierte CHF-Rate durch Resolver, Vorschlagsjob und Wizard-Serialisierung und behält die CHF-Einstandsbasis separat. Reine Regressionen decken den Bond-ETF-Fall, die Fremdwährungsrate sowie die Kapitalbasis ab; alle 20 gezielten Tests und der TypeScript-Check sind grün. Der bestehende Eintrag #3960001 wird bis zur erneuten Live-Vorschau und einer expliziten Entscheidung über eine inhaltliche Korrektur nicht verändert.

Die anschliessende isolierte Kontrollvorschau bestätigt den Quellfix mit realen Daten: `CSBGC0.SW` bleibt ein CHF-ETF bei 45,0 %, `CMDY` und `REET` bleiben USD-ETFs mit lokalem Kurs 63,96 bzw. 27,40 und erhalten beide die vorhandene USDCHF-Rate 0,8092. Die finale Vorschlagsnutzlast weist exakt 90,0 % Wertpapiergewicht und 10,0 % Cash-Reserve aus; der drei Tranchen umfassende Plan enthält weiterhin exakt CHF 600'000 und nur `not_released`-Status.

Für den bereits angelegten Eintrag #3960001 wurde dagegen in der alten Client-Serialisierung die globale Portfolioreferenzwährung CHF auf sämtliche Positionen geschrieben. Seine Rohdaten enthielten dadurch bei CMDY und REET CHF statt USD sowie die vor FX berechneten, zu geringen Stückzahlen; analoge Fremdwährungseffekte bestanden auch bei einzelnen Aktienpositionen. Die Detailbewertung rechnete diese Daten anhand aktueller Stammdaten in CHF zurück und wies deshalb CHF 527'317.07 Wertpapierwert statt des im Datensatz gespeicherten CHF 540'338.14 aus. Zusammen mit der Cash-Reserve von CHF 59'661.86 ergab sich die sichtbare Tag-0-Abweichung.

## Bestätigte technische Rekonstruktion und Endabnahme

Nach ausdrücklicher Nutzerfreigabe wurde #3960001 über eine neue, eng begrenzte und authentifizierte Reparaturmutation rekonstruiert. Sie akzeptiert nur Eigentümer-Datensätze vom Typ `demo` aus `ai_wizard`, verweigert live aktivierte Portfolios sowie Einträge mit vorhandenen Ledgerbuchungen und liest ausschliesslich kanonische Kurs-, Währungs- und FX-Felder aus der vorhandenen Stammdatenbasis. Bei fehlendem Kurs oder fehlender Fremdwährungsrate bricht sie ab; ein CHF- oder Faktor-1-Fallback für Fremdwährungen ist ausgeschlossen.

Die Reparatur war idempotent. Ihr Ergebnis lautet CHF 540'263.38 Wertpapiere plus CHF 59'736.62 residuale Cash-Reserve gleich CHF 600'000.00. Die minimale Differenz zur anfänglichen Zielreserve von CHF 60'000 folgt ausschliesslich aus handelbaren Ganzstückzahlen. Der erste Korrekturlauf schrieb keine Ledgerzeilen und änderte keine Live-Einstellung; der zweite, ebenfalls erfolgreiche Lauf verwarf zusätzlich den benutzerspezifischen Redis-Detailcache. Damit wurde die zuvor veraltete Bewertung nicht mehr angezeigt.

Die anschliessende Live-Abnahme der Detailseite bestätigt **WERT CHF 600'000**, **Einstand CHF 600'000**, **Rendite seit Kauf +0.0 %** und **31 Positionen**. Die sichtbare Aktivität lautet weiterhin „Keine Transaktionen vorhanden“; der Datenbanknachweis bestätigt `portfolioType = demo`, `isLive = 0`, `creationSource = ai_wizard` und null Ledgerzeilen. Die UI zeigt weiterhin lediglich die manuelle Schaltfläche „Aktivieren“; sie wurde nicht betätigt.

| Abschlussprüfung | Ergebnis |
|---|---:|
| Re-konstruierte Wertpapiere | CHF 540'263.38 |
| Residuale Cash-Reserve | CHF 59'736.62 |
| Kapitalbasis | CHF 600'000.00 |
| Sichtbarer Depotwert / Einstand | CHF 600'000 / CHF 600'000 |
| Rendite seit Kauf | +0.0 % |
| Live-Tracking | Deaktiviert |
| Ledger-/Transaktionseinträge | 0 |
| Gezielte Verträge | 23 bestanden |
| Vollständige Testsuite | 1'516 bestanden, 11 bewusst übersprungen |
| TypeScript | Fehlerfrei |
