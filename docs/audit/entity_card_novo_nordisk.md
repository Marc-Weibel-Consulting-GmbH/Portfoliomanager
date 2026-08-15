# Entity Card — Novo Nordisk A/S

**Untersuchungszweck:** Diagnose einer im Screener angezeigten Dividendenrendite von 25 %.

| Feld | Arbeitswert | Verifikationsstatus |
|---|---|---|
| Rechtlicher Name | Novo Nordisk A/S | verifiziert |
| Primärlisting | Nasdaq Copenhagen, `NOVO-B.CO` | verifiziert |
| ADR | NYSE, `NVO` | verifiziert; 1:1-Verhältnis zur B-Aktie laut Gesellschaft |
| Listing-Status | börsenkotiert | verifiziert |
| Geschäftsjahresende | 31. Dezember | verifiziert |
| Berichtswährung | DKK | verifiziert |
| Sektor | Pharma / Gesundheitswesen | verifiziert |
| Mögliche Fehlerquellen | ADR-Verhältnis, DKK/USD-Umrechnung, Sonderdividende, Split, annualisierte versus trailing Ausschüttung, Dezimal-/Prozentumrechnung | offen |

> Die konkrete im Screener verwendete Wertpapierkennung wird zuerst aus der Datenbank ermittelt. Bis zur Verifikation wird kein externer Wert als Berechnungsgrundlage übernommen.

## Quellen- und Einheitengegenprobe — 15. August 2026

| Quelle | Wert | Einordnung |
|---|---:|---|
| Screener-Stammdaten und Signal-Cache | 3.92 % bei DKK 294.70 | Beide aktuellen Datenpfade stimmen überein. |
| Frischer EODHD-Rohdatenabruf | 3.92 % | Identische Prozentkonvention zum Cache. |
| Novo Nordisk, offizielle Dividendenseite | DKK 3.75 Interimsdividende 2026; Auszahlung August 2026 | Primärquelle; bestätigt Ausschüttung in DKK und 1:1-ADR-Verhältnis. |
| Investing.com, NOVOb | Rendite 3.91 %, annualisierte Ausschüttung DKK 11.70 bei Kurs DKK 299.50 | Unabhängige Sekundärquelle; bestätigt Grössenordnung deutlich unter 25 %. |

Die Sekundärquelle listet für 2026 DKK 7.95 Schlussdividende und DKK 3.75 Interimsdividende. DKK 11.70 / DKK 299.50 ergibt 3.9065 %, gerundet 3.91 %. Damit ist der aktuelle Screenerwert 3.92 % plausibel.

**Quellen:** [Novo Nordisk — Dividende](https://www.novonordisk.com/investors/stock-information/dividend.html); [Investing.com — NOVOb Dividenden](https://www.investing.com/equities/novo-nordisk-dividends).
