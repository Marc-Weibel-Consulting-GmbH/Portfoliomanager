# Entity Card — ONON.US

| Feld | Wert |
|---|---|
| Unternehmen | On Holding AG |
| Anwendungsticker | ONON.US |
| Börse | NYSE |
| Listing-Status | Börsennotierte Stammaktie |
| Handelswährung | USD |
| Berichtswährung | CHF (voraussichtlich; gegen Primärquelle zu verifizieren) |
| Geschäftsjahresende | Dezember (gegen Primärquelle zu verifizieren) |
| Branche | Sportartikel / Performance Footwear & Apparel |
| Referenzdatum | 26.09.2026 |
| Prüfzweck | Ursachenanalyse einer abweichenden PEG- und KGV-Anzeige gegenüber der vorliegenden Bloomberg-Referenz |

## Vom Nutzer vorgelegte Referenz

Bloomberg zeigt für ONON.US: P/E (TTM) **18,94**, geschätztes P/E (FY 2026) **17,63**, EPS (TTM) **1,31**, geschätztes EPS (FY 2026) **1,41** und geschätztes PEG **0,52**. Die Anwendungsansicht nannte dagegen KGV **25,2** sowie bereinigtes PEG **2,45** bei einem Vendor-PEG von **0,49** und einer eigenen Rechnung von **1,44**.

## Belegter Befund und Korrektur

- **EODHD-Rohwerte:** Trailing P/E **21,2482**, Vendor-PEG **0,4943**, Handelswährung **USD**; Rohbeleg in `ONON_US_PEG_RAW_EVIDENCE_2026-09-26.json`.
- **Ursache des alten KGV 25,2:** USD-Marktkapitalisierung wurde durch CHF-Nettogewinne geteilt. Der Wert war damit nicht dimensionsgleich.
- **Korrektur:** Die eigene KGV-Rechnung wird bei abweichenden Währungen ohne belegte FX-Umrechnung verworfen; ONON nutzt als führenden sichtbaren KGV-Wert nun EODHD Trailing P/E **21,2**.
- **PEG-Abgrenzung:** 0,49 ist das vergleichbare Standard-/Vendor-PEG (nahe Bloomberg 0,52). 2,45 ist nur noch klar als interner risiko-adjustierter Score-Faktor beschriftet und wird nicht als Standard-PEG dargestellt.
- **Timing:** Nach einer expliziten 5J-Historienladung im Devserver: Timing **52/100**, Signal **Stark · 71**. Der Klick änderte `listType` nicht (`NULL`), also keine Watchlistaufnahme.
- **KI-Briefing:** Manus-Standard-KI erfolgreich live erzeugt; kein Drittanbieter-Creditpfad.

> **Status:** Ursachenanalyse und minimaler Fix abgeschlossen; vollständige Regression und Checkpoint folgen.
