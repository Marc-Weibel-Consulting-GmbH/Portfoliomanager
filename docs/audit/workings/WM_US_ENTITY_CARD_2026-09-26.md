# Entity Card — WM.US

| Feld | Wert |
|---|---|
| Unternehmensname | Waste Management, Inc. |
| Anwendungsticker | WM.US |
| Börse | NYSE (USA) |
| Listing-Status | Börsennotiert |
| Berichtswährung | USD |
| Industrie | Environmental & Facilities Services / Waste Management |
| Geschäftsjahresende | Zu verifizieren (WM.US-Fundamentaldaten) |
| Referenzdatum | 26.09.2026 |
| Prüfzweck | Datenintegrität der Dividendenrendite, Marktkapitalisierung, Historie und Kennzahlen vor einer möglichen Watchlist-/Portfolioaufnahme |

> **Status:** Rohquelle, lokaler Import- und Anzeigepfad werden getrennt geprüft. Keine Watchlist-, Portfolio-, Cash-, Ledger- oder Handelsmutation durch diese Prüfung.

## Befund und Korrektur

| Prüffeld | Befund vor Korrektur | Korrigierter EODHD-Pfad |
|---|---|---|
| Dividendenrendite | **170,0 %** – offenkundig falsch | **1,70 %**: EODHD liefert bereits Prozentwerte; eine zweite Multiplikation mit 100 wurde entfernt. |
| Marktkapitalisierung | **USD 83** – fehlende Einheit | **USD 82,7 Mrd.**: EODHD liefert den absoluten Betrag; die Umrechnung in Milliarden erfolgt nur in der Anzeige. |
| PEG, Volatilität, Sharpe | Nicht verfügbar | PEG bleibt eine **Lieferanten-Datenlücke**. Volatilität und Sharpe werden erst nach einem expliziten, homogenen 5J-Historienimport ausgewiesen. |
| Kursreihe | Nur bisherige lokale Abdeckung | Nutzeraktion **«Historische Daten laden (5J)»** lädt EODHD-Kurse additiv; bestehende historische Datumszeilen werden nicht überschrieben. |

## Sicherheits- und Datenregel

Der Datenladebutton aktualisiert ausschliesslich den lokalen Stammdatensatz und die historische EODHD-Kursreihe. Er erstellt **keine** Watchlistzeile, Position, Cash-Bewegung, Ledgerbuchung oder Order. Die separate Aktion **«Zur Watchlist»** lädt zuerst dieselbe Datenbasis und nimmt den Titel danach ausdrücklich in die Watchlist auf. Die bestehende Portfolioaktion bleibt separat und erzeugt erst nach ihrer eigenen Eingabe/Bestätigung eine Transaktion.
