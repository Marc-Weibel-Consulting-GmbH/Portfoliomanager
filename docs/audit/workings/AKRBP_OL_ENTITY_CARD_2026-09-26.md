# Entity Card — AKRBP.OL

| Feld | Wert |
|---|---|
| Unternehmen | Aker BP ASA |
| Anwendungsticker | AKRBP.OL |
| Börse | Oslo Børs (Norwegen) |
| ISIN | NO0010345853 |
| Listing-Status | Börsennotiert, gewöhnliche Aktie |
| Handelswährung | NOK |
| Referenzdatum | 26.09.2026 |
| Prüfzweck | Herleitung der jährlichen Dividende und Dividendenrendite in Portfolio, Positionsansicht und EODHD-Datenpfad |

## Gesicherte Rohbefunde

- **EODHD Fundamentals** am 26.09.2026 09:35:18 UTC: `Highlights.DividendYield = 0.0072` und `Highlights.DividendShare = 2.583`, während `SplitsDividends.ForwardAnnualDividendRate = 25.7` und `SplitsDividends.ForwardAnnualDividendYield = 0.0713` liefert.
- **EODHD Dividend endpoint** lieferte vier reguläre, quartalsweise Ereignisse in **NOK** innerhalb des trailing-12-month-Fensters: 27.10.2025 `6.33194`, 16.02.2026 `6.29417`, 12.05.2026 `6.12853`, 20.07.2026 `6.42588`.
- **Primärquelle Aker BP** bestätigt quartalsweise Dividenden und dieselben vier NOK-Beträge.
- Die derzeitige Implementierung normalisiert ausschliesslich `Highlights.DividendYield × 100` und führt keine eigene TTM-Herleitung aus den Zahlungsereignissen durch.

## Ergebnis der Korrektur

- Der zentrale Pfad berechnet nun **TTM-Brutto** aus regulären, datierten Ereignissen in der Handelswährung; Forward/indicated und generische Anbieterfelder sind nur noch klar gelabelte Fallbacks.
- Für AKRBP.OL: vier NOK-Ereignisse, NOK `25.180520` TTM je Aktie, lokaler Kurs NOK `348.60`, somit `7.2233 %`; die Dev-Ansichten zeigen gerundet **7.22 %**.
- Die Einzelzeile im Instrumentstamm wurde kontrolliert samt Basis, Jahresbetrag, Währung, Ereignisanzahl, Stichtag und Quelle aktualisiert. Historische Preise, Portfolio-, Cash-, Ledger-, Transaktions- und Handelsdaten blieben unverändert.

> **Status:** Korrektur implementiert und im Devserver validiert. Vollständiger Nachweis: `docs/audit/AKRBP_OL_DIVIDEND_YIELD_CORRECTION_2026-09-26.md`.
