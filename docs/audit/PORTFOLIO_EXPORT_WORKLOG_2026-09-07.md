# Portfolioexport — Excel und PDF

**Stand:** 07.09.2026 · **Status:** Verifiziert, bereit für Release-Checkpoint

## Datenvertrag

Der Export übernimmt den sichtbaren Portfolio-Gesamtwert unverändert. Die Liquidität wird als separater Informationswert aufgeführt, aber niemals zum Gesamtwert addiert, da sie bereits darin enthalten ist. Positionen mit fehlenden Kurs- oder Wechselkursdaten werden als Datenlücke ausgegeben und nicht als CHF 0 dargestellt.

Der Excel-Export enthält die Arbeitsblätter **Übersicht**, **Titelliste** und **Depotentwicklung**. Der PDF-Report enthält Kennzahlkacheln, Sektorallokation, eine Entwicklungsgrafik, Datenqualitäts-/Methodikhinweise und die vollständige Titelliste.

## Visuelle Live-Prüfung

Am Portfolio **Test KI** wurde der Excel-Export erfolgreich heruntergeladen. Die Arbeitsblattnamen und zentralen Beschriftungen wurden direkt aus der erzeugten XLSX-Datei geprüft.

Die erste PDF-Prüfung zeigte bei einem Demo-Portfolio eine leere Entwicklungsgrafik, weil keine reale transaktionsbasierte CHF-Wertreihe existiert. Der Export nutzt nun als klar markierten Fallback den bereits sichtbaren gewichteten Chartverlauf. Die zweite PDF-Prüfung bestätigte eine sichtbare Grafik mit der expliziten Kennzeichnung **«Indexierter TTWROR-Verlauf – keine vollständige CHF-Wertreihe»**. Der Methodikhinweis erläutert, dass dies keine rückwirkend ausgeführte Transaktionshistorie ist.

## Verifikation

| Prüfung | Ergebnis |
|---|---|
| Reiner Exportdatenvertrag | Vier Regressionen bestanden: Gesamtwert enthält Cash exakt einmal; Titelliste und CHF-Wertreihe bleiben erhalten; Datenlücken werden nicht als Nullwerte dargestellt; der Demo-Chart bleibt klar als indexiert gekennzeichnet. |
| TypeScript | `pnpm check` ohne Fehler. |
| Vollständige Regression | 184 Testdateien bestanden, fünf bewusst übersprungen; 1'478 Tests bestanden, 11 bewusst übersprungen. |
| Excel-Download | Live für **Test KI** ausgelöst. Die resultierende XLSX-Datei enthält **Übersicht**, **Titelliste** und **Depotentwicklung**; die Zeitreihenseite enthält die transparente Kennzeichnung des indexierten Verlaufs. |
| PDF-Download | Live für **Test KI** ausgelöst und als zweiseitiges A4-PDF geprüft. Seite 1 enthält Kennzahlen, Entwicklungsgrafik, Allokation sowie Methodikhinweis; Seite 2 enthält die Titelliste. |
| UI / Navigation | Excel und PDF sind in der Kopfaktionsleiste sichtbar und auslösbar. Der Performance-Tab kennzeichnet den bestehenden QuantStats-Auslöser jetzt eindeutig als **Analysebericht (HTML)**, sodass keine Verwechslung mit dem PDF-Report besteht. |

Die automatisierte Mobilaufnahme blieb während des Portfolio-Ladevorgangs in einem Ladezustand; die Aktionsleiste ist dennoch mit `flex-wrap` und textreduzierten Mobil-Labels umgesetzt. Die Desktop-Liveprüfung, reale Downloads und Dateiinhalte wurden vollständig bestätigt.

## Grenzen

Für Live-Portfolios verwendet der Report die historische CHF-Wertreihe des Performance-Ledgers. Bei Demo-Portfolios ohne echte Transaktionshistorie nutzt er ausschliesslich den bereits im Interface sichtbaren gewichteten Verlauf und benennt ihn explizit als indexiert/hypothetisch. Es werden keine Positionen, Transaktionen, Signale, Scores oder Trackingdaten durch einen Export verändert.
