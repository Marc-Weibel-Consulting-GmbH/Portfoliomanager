# AKRBP.OL – Ursachenanalyse und Korrektur der Dividendenrendite

**Referenzzeit:** 26.09.2026, Datenabruf 09:35:18 UTC  
**Instrument:** Aker BP ASA, `AKRBP.OL`, Oslo Børs, ISIN `NO0010345853`, Handelswährung **NOK**  
**Umfang:** Instrumentstammdaten und Anzeige-Transparenz. Keine Portfolio-, Cash-, Ledger-, Transaktions-, Preis- oder Handelsänderung.

## Kurzfazit

Die Anwendung hat die Zahlungsfrequenz bisher **nicht** selbst aus einzelnen Ausschüttungen zur Jahresdividende hergeleitet. Der Fundamentaldatenpfad übernahm pauschal `Highlights.DividendYield` von EODHD.

Für Aker BP war dieses Feld `0,0072` (= **0,72 %**) und damit materiell unplausibel. Derselbe EODHD-Rohdatensatz enthält jedoch sowohl eine **Forward/indicated-Rendite von 7,13 %** als auch vier reguläre, quartalsweise **NOK**-Ausschüttungen. Die Korrektur verwendet daher bevorzugt eine klar bezeichnete **TTM-Brutto-Dividendenrendite** aus den vier datierten NOK-Ereignissen.

| Kennzahl | Wert |
|---|---:|
| Lokaler Kurs zur Berechnung | NOK 348,60 |
| Reguläre TTM-Ausschüttungen | 4 |
| TTM-Bruttodividende je Aktie | NOK 25,180520 |
| Berechnung | NOK 25,180520 ÷ NOK 348,60 × 100 |
| Korrigierte Kennzahl | **7,2233 % TTM-Brutto** |
| Anzeige (2 Dezimalstellen) | **7,22 %** |
| EODHD Forward/indicated, getrennt | 7,13 % |
| EODHD Highlights (nicht als TTM verwendet) | 0,72 % |

## Belegte Ereignisbasis

| Ex-Tag | Zahlungstag | Regulär gemeldeter Betrag je Aktie | Währung | Periode |
|---|---|---:|---|---|
| 27.10.2025 | 04.11.2025 | 6,331940 | NOK | Quartalsweise |
| 16.02.2026 | 24.02.2026 | 6,294170 | NOK | Quartalsweise |
| 12.05.2026 | 21.05.2026 | 6,128530 | NOK | Quartalsweise |
| 20.07.2026 | 28.07.2026 | 6,425880 | NOK | Quartalsweise |
| **Summe** |  | **25,180520** | **NOK** | **TTM** |

Die Einzelevents, die Rohfelder und der Abrufzeitpunkt sind unverändert im [Rohdatenbeleg](workings/AKRBP_OL_RAW_EVIDENCE_2026-09-26.json) abgelegt.

## Ursache und Datenfluss

```text
EODHD Fundamentals
  Highlights.DividendYield = 0,0072
      ↓ (bisher blind × 100)
  stocks.dividendYield = 0,72 %  ← potenzieller Fehlerwert
      ↓
  portfolios.getWithCurrency → Positionstabelle / Aktiendetails
```

Der korrigierte Pfad lautet:

```text
EODHD /api/div/AKRBP.OL (datierte Cash-Ereignisse in NOK)
  → Ereignisprüfung (letzte 365 Tage, regulär, keine Sonderdividende)
  → Währungsprüfung (NOK-Ereignis ↔ NOK-Handelslinie)
  → Summe / lokaler Kurs
  → stocks.dividendYield = TTM-Brutto
  → Positionstabelle, Aktiendetails und Watchlist mit Basis, Jahresbetrag, Ereignisanzahl,
    Währung, Stichtag und Quelle im Tooltip
```

**Sicherheitsregel:** Wenn die Ereigniswährung nicht mit der Handelswährung übereinstimmt (z. B. USD je Aktie gegen NOK-Kurs), wird keine Rendite erfunden. Der Pfad weist eine Datenlücke aus und verwendet gegebenenfalls nur die klar deklarierte Forward-/Anbieterbasis.

## Implementierte Regeln

1. **TTM-Brutto hat Vorrang:** Summe aller regulären, datierten Ausschüttungen der vergangenen 365 Tage geteilt durch den Kurs derselben Handelslinie.
2. **Keine Frequenz-Vermutung:** Jahres-, Halbjahres- und Quartalsreihen werden aus tatsächlichen Ereignissen summiert; es gibt keinen pauschalen Quartalsmultiplikator.
3. **Sonderdividenden getrennt:** Als `Special`, `Extraordinary` oder `Capital Return` gekennzeichnete Ereignisse fliessen nicht unmarkiert in die reguläre TTM-Rendite ein.
4. **Fallback explizit beschriftet:** Falls keine vollständige Ereignisbasis vorhanden ist, kann `Forward/indicated` aus `SplitsDividends.ForwardAnnualDividendYield` verwendet werden; erst danach folgt die allgemeine EODHD-Anbieterkennzahl.
5. **Keine doppelte Prozent-Skalierung:** Alle gespeicherten Renditen sind Prozentwerte; die EODHD-Bruchzahl wird exakt einmal umgerechnet.

## Kontrollierte Datenaktualisierung

| Feld | Vorher | Nachher |
|---|---:|---:|
| `dividendYield` | 7,13 % (unbeschriftete Anbieterbasis) | 7,2233 % |
| `dividendYieldBasis` | leer | `ttm_gross` |
| `dividendAnnualAmount` | leer | 25,180520 |
| `dividendCurrency` | leer | NOK |
| `dividendEventCount` | leer | 4 |
| `dividendAsOfDate` | leer | 2026-09-26 |
| `dividendYieldSource` | leer | `EODHD /api/div` |

Die Aktualisierung betraf **nur** die eine `stocks`-Zeile `AKRBP.OL`. Historische Preise, Portfoliozusammensetzung, Cash, Ledger, Transaktionen und Orders blieben unverändert.

## Validierung

- Roter Test vor Implementierung: fehlendes TTM-Modul verursachte erwartungsgemäss einen Importfehler.
- Fokussierte Tests nach Implementierung: 15 Tests in 3 Dateien bestanden.
- Enthaltene Regressionen: vier Quartalszahlungen, jährliche/halbjährliche Reihen, Sonderdividende, USD/NOK-Währungsgrenze und EODHD-Forward-Feld gegenüber widersprüchlichem Highlights-Feld.
- TypeScript-Kompilierung und `git diff --check` bestanden.
- Dev-Livecheck in Portfolio **Mami**: AKRBP.OL zeigt **7,22 %**; Tooltip zeigt `TTM-Brutto: 4 reguläre Ereignisse, 25.180520 NOK je Aktie, Stichtag 2026-09-26, Sonderdividenden ausgeschlossen, Quelle EODHD /api/div`.
- Dev-Livecheck in Aktiendetails: Kennzahl ist als **Div.-Rendite (TTM)** mit derselben Herleitung sichtbar.
- Der Watchlist-Import und die Watchlist-Anreicherung verwenden denselben Resolver; neue bzw. aktualisierte Watchlistzeilen zeigen zusätzlich die sichtbare Basiskennzeichnung `TTM`, `Forward` oder `Anbieter` mit identischem Tooltip.

## Quellen und Vertrauen

1. **Primärquelle:** [Aker BP – Share / Investor Relations](https://akerbp.com/en/investor/share/) – quartalsweise Ausschüttung und die NOK-Beträge gegengeprüft.
2. **Börsenreferenz:** [Euronext Oslo – Aker BP ASA](https://live.euronext.com/en/product/equities/NO0010345853-XOSL).
3. **Operative Datenquelle:** EODHD `fundamentals/AKRBP.OL` und `div/AKRBP.OL`, Rohdatenstand im oben verlinkten Beleg.

**Vertrauen:** Hoch für die TTM-Herleitung, weil die auf derselben NOK-Handelslinie bezogenen, vier datierten Ausschüttungen sowohl über EODHD als auch gegen die Aker-BP-IR-Referenz geprüft wurden. Der exakte Prozentwert bewegt sich künftig mit dem jeweils gespeicherten NOK-Kurs; TTM-Zahlungssumme und Datenbasis bleiben sichtbar.

> **Basis:** TTM-Brutto, reguläre Ausschüttungen der letzten 365 Tage. **Zeit:** 26.09.2026; Kursbasis NOK 348,60. **Annahmen:** Keine FX-Schätzung, keine Frequenzannualisierung, keine Aufnahme von Sonderdividenden. **Compliance:** Research und Analyse, keine persönliche Anlageberatung.
