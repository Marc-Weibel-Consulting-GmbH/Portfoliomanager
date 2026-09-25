# Audit: Verlust-Risiko mit Fünfjahres- und Krisenfenster

**Stand:** 25. September 2026  
**Portfolio:** Mami (ID 4020001)  
**Geltungsbereich:** Entwicklungsumgebung; ausschliesslich lesende Risikoberechnung. Der einmalige historische Preisbackfill ergänzte nur bislang fehlende EODHD-Tageszeilen und änderte keine bestehende Preiszeile, Portfolio-Position, Cashreserve, Transaktion oder Buchung.

## Ergebnis

Der sichtbare Wert **„Verlustrisiko · Max. (5J)”** wird nicht mehr aus einem einjährigen Fenster abgeleitet. Er erscheint nur noch, wenn eine vollständige, CHF-bewertete Fünfjahresreihe für alle Positionen und die benötigten Fremdwährungen vorliegt, mindestens 1’000 qualifizierte Beobachtungstage vorhanden sind und der konfigurierte Vergleichsmarkt innerhalb desselben Fensters einen objektiv messbaren Stress durchlaufen hat.

Für das Demoportfolio „Mami” wurde nach Ergänzung der fehlenden historischen US-Kurse ein qualifiziertes Fenster vom **27.09.2021 bis 24.09.2026** mit **1’292** Beobachtungen validiert. Der ausgewiesene maximale Drawdown des historischen Allokationsproxys beträgt **−28.3 %**. Der SPI-Vergleichswert beträgt **−29.3 %**. Der Krisennachweis ist ein SPI-Drawdown von **−29.3 %** zwischen dem 28.12.2021 und dem 27.10.2023. Dieser Nachweis erfüllt die explizite Schwelle von mindestens −15 %.

| Kennzahl | Wert | Einordnung |
|---|---:|---|
| Risikofenster | 5 Jahre | 27.09.2021 bis 24.09.2026 |
| Qualifizierte Beobachtungen | 1’292 | Mindestwert: 1’000 |
| Max. Drawdown, Allokationsproxy | −28.3 % | Peak-to-Trough in CHF |
| Max. Drawdown, SPI | −29.3 % | Objektiver Stressnachweis |
| Volatilität p.a., Allokationsproxy | 11.3 % | Gleiches 5J-Fenster |
| Volatilität p.a., SPI | 14.1 % | Gleiches 5J-Fenster |
| VaR 95 %, ein Tag | −0.8 % | Gleiches 5J-Fenster |
| Sharpe Ratio, Allokationsproxy | −0.15 | Gleiches 5J-Fenster |
| Beta gegenüber SPI | 0.46 | Tagesgleich gepaarte Renditen |

## Verbindliche Berechnungsmethode

Das Ziel beginnt fünf Kalenderjahre vor dem Bewertungsdatum. Ein Start- oder Endversatz von höchstens sieben Tagen ist ausschliesslich für unterschiedliche Börsenkalender zulässig. Jede gehaltene Position muss am Beginn und Ende dieses Fensters eine nachweisbare Kursreihe besitzen. Für Fremdwährungen muss zu beiden Zeitpunkten eine historische FX-Rate nach CHF vorhanden sein. Eine Lücke führt zu `insufficient_history` oder `incompatible_history`; sie wird weder mit einem Nullwert noch mit einer 1:1-CHF-Umrechnung ersetzt.

Die Risikoreihe verwendet tägliche Schlusskurse und historische FX-Raten. Kurse dürfen an Handelsfeiertagen höchstens sieben Kalendertage fortgeschrieben werden. Fehlt danach ein Kurs oder eine FX-Rate, ist der betreffende Portfoliotag nicht qualifiziert. Der Maximalverlust folgt der bestehenden Peak-to-Trough-Definition:

> **Drawdown** = (Portfoliowert am Tag − bisheriges Hoch) / bisheriges Hoch × 100.

Ein Drawdown wird erst publiziert, wenn die qualitative Prüfung `five_year_with_stress` erfüllt ist. Eine Fünfjahresreihe ohne nachweisbare Stressphase erhält den Status `five_year_without_stress`. In beiden Fällen einer Datenlücke oder eines fehlenden Stressnachweises zeigt die Anwendung einen Gedankenstrich mit Erläuterung. Sie fällt ausdrücklich nicht auf ein unlabeled Einjahresfenster zurück.

Der Stressnachweis ist regelbasiert. Die bereinigte Benchmarkreihe muss im selben Fünfjahresfenster mindestens einen Peak-to-Trough-Drawdown von **−15 %** oder tiefer aufweisen. Der Status enthält Benchmark, Peakdatum, Tiefdatum und beobachteten Drawdown. Damit wird keine Krisengeschichte narrativ erfunden; die belegte Marktbewegung ist der Nachweis.

## Charakter des Demoportfolios

„Mami” wurde am 08.09.2026 angelegt. Die vor diesem Datum berechnete Reihe ist deshalb **keine echte Depot-, Kauf- oder Transaktionshistorie**. Sie bewertet die heutige Allokation mit festen Stückzahlen über historische Kurse in CHF. Die aktuelle Cashreserve wird als konstante CHF-Komponente einbezogen. Die UI, der Excel-Export und der PDF-Report bezeichnen diese Darstellung einheitlich als **historischen Allokations-/Risikoproxy**.

Der Proxy beantwortet die engere Frage, wie diese heutige Allokation unter historischen Markt- und Wechselkursbedingungen reagiert hätte. Er beantwortet nicht, welche reale Performance das Depot vor seinem Erstellungsdatum erzielt hätte.

## Historienabdeckung und additiver Backfill

Vor der Umstellung fehlten in der lokalen Preisablage historische Startdaten für sieben US-Positionen. Die Risikologik stellte deshalb zunächst korrekterweise `insufficient_history` fest und zeigte keinen falschen Maximalverlust.

| Ticker | Vorhandene Reihe ab | Ergänzte EODHD-Zeilen | Ergebnis |
|---|---:|---:|---|
| GOOGL | 30.12.2022 | 324 | Fünfjahresstart abgedeckt |
| ISRG | 12.07.2024 | 707 | Fünfjahresstart abgedeckt |
| JNJ | 30.12.2022 | 324 | Fünfjahresstart abgedeckt |
| NVDA | 30.12.2022 | 324 | Fünfjahresstart abgedeckt |
| PLTR | 30.12.2022 | 324 | Fünfjahresstart abgedeckt |
| TSLA | 30.12.2022 | 324 | Fünfjahresstart abgedeckt |
| TSM | 30.12.2022 | 324 | Fünfjahresstart abgedeckt |
| **Total** |  | **2’651** | Nur fehlende `(ticker, date)`-Zeilen eingefügt |

Der Backfill fragte EODHD für den Zeitraum 18.09.2021 bis 25.09.2026 ab. Jede Antwort wurde gegen den eindeutigen Schlüssel `(ticker, date)` der Tabelle `historical_prices` gefiltert. Es wurde **kein Upsert und keine Preisüberschreibung** verwendet. Die sieben Reihen enthalten nach der Ergänzung jeweils 1’259 EODHD-Beobachtungen im abgefragten Zeitraum.

## Benchmark-Datenintegrität

Die Liveprüfung deckte einen separaten Altbestand in `benchmarkData` auf: Für den Datenbankschlüssel `SMI` lagen unter anderem Feiertagszeilen im alten Indexmassstab von rund 11’500 neben der tatsächlich verwendeten SPI-ETF-Reihe von rund 124 CHF. Die rohe, additive Tabelle bleibt aus Auditgründen unverändert. Ohne Schutz hätte der Einzelwert vom 01.01.2024 einen falschen SPI-Drawdown von −98.9 % und eine unplausible annualisierte Volatilität von 4’096 % erzeugt.

Die Risikohilfe schliesst deshalb nur **isolierte Massstabsbrüche** aus. Ein Punkt wird verworfen, wenn er gegenüber beiden unmittelbaren Nachbarn um mehr als Faktor drei abweicht, während seine Nachbarn selbst innerhalb Faktor 1.5 liegen. Das Verfahren füllt keine Daten auf, repariert keine Quelle und verändert keine Datenbankzeile. Es entfernt im geprüften Fenster genau einen solchen Punkt. Die UI, Excel und PDF weisen diesen Ausschluss als Audit-Hinweis aus.

## Anzeige und Exporte

Die Detailkopfzeile und der Risiko-Tab tragen die Beschriftung „Verlustrisiko · Max. (5J)”. Der Risiko-Tab nennt Zeitraum, qualifizierte Beobachtungen, Proxy-Charakter und Krisennachweis. Bei Datenlücken nennt er die betroffenen Kurs- oder FX-Reihen. Der Excel-Tab „Verlustrisiko” enthält zusätzlich Zielperiode, Abdeckung, Gate-Status, Peak, Tief, Formel und den vollständigen Tagespfad. Der PDF-Report übernimmt denselben Status in „Datenqualität & Methodik”.

## Validierung

Die reine Risiko-Hilfslogik wird mit sechs Tests geprüft. Sie decken die qualifizierte Fünfjahresreihe, fehlenden Stress, fehlende Kursabdeckung, fehlende FX-Abdeckung, zu wenige Beobachtungen und den ausgeschlossenen Benchmark-Massstabsbruch ab. Weitere Tests prüfen die Peak-to-Trough-Engine und das Exportmodell. Der Browser-Livecheck am Entwicklungsportfolio zeigte nach Backfill die Werte dieser Prüfung, die klare Proxy-Kennzeichnung und den Audit-Hinweis zum einen ausgeschlossenen Benchmarkpunkt. Es wurden im Livecheck keine Portfolio-, Cash-, Ledger- oder Handelsaktionen ausgelöst.

## References

[1]: https://eodhd.com/financial-apis/eod-historical-data-api/ "EOD Historical Data API"
