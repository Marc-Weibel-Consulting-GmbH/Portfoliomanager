# Neuberechnung aller bestehenden Portfolios – 5J-Risiko und Gesamtrendite

**Ausgeführt:** 27. September 2026  
**Umgebung:** Devserver / Entwicklungsdatenbank  
**Status:** abgeschlossen; drei Portfolios mit vollständiger 5J-Kennzahlenbasis, eine transparente produktseitige Inzeptionslücke

## Umfang und Schutzgrenzen

| Portfolio | ID | Positionen | Ergebnis 5J-Gate |
|---|---:|---:|---|
| Test Wachstum | 3120001 | 32 | Datenlücke – ASOL.SW vor Produktlancierung nicht vorhanden |
| Test KI | 3510001 | 28 | vollständig, inklusive Stressphase |
| Mami | 4020001 | 25 | vollständig, inklusive Stressphase |
| Test | 5160001 | 26 | vollständig, inklusive Stressphase |

Der Lauf umfasste **67 eindeutige Handelslinien**. Er schrieb ausschließlich in die hierfür vorgesehene Historienbasis:

- `historical_prices`: fehlende, kanonische **Rohkurszeilen additiv**;
- `total_return_historical_prices`: aktuelle, nachvollziehbar datierte Brutto-Gesamtrendite-Snapshots.

> **Nicht verändert:** Portfolioallokationen, Stückzahlen, Cash, Ledger, Transaktionen, Einstandswerte, Rohkurswerte an bestehenden Tagen sowie Handels-/Investmententscheidungen.

## Durchgeführte Korrektur

Die erste Portfoliokorrektur hatte zwar die getrennten Total-Return-Snapshots aller Positionen erneuert, aber bei zwölf kanonischen Rohkursreihen ältere Datenlücken entdeckt. Teilweise existierten nur historische Aliasreihen (zum Beispiel `MSFT.US`), während die aktuell im Portfolio verwendete kanonische Linie (`MSFT`) erst später begann. Das erzeugte eine unzulässige unterschiedliche Zeitbasis zwischen Kurs- und Gesamtrendite.

Der permanente Gesamtlauf plant deshalb zuerst die Rohhistorie **je kanonischem Portfolioticker** und akzeptiert keinen Alias als stillschweigend zusammengefügten Ersatz. Für die folgenden elf Linien wurde die 5J-Rohhistorie bis 20.09.2021 kontrolliert vervollständigt:

`AAPL`, `CMDY`, `FLXS`, `GOOG`, `MSFT`, `MU`, `OII`, `PG`, `REET`, `VZ`, `XOM`.

Anschließend wurden sämtliche **67** Brutto-Gesamtrendite-Snapshots für 20.09.2021–27.09.2026 erneut von der qualifizierten Quelllinie abgerufen und der Risikocache global invalidiert. Der Lauf endete ohne fehlgeschlagene Handelslinie.

## Ergebnis der geschützten Risikoabfragen

| Portfolio | Beobachtungen | Kursrendite p.a. | Brutto-Gesamtrendite p.a. | Volatilität p.a. | Sharpe | Max. Drawdown |
|---|---:|---:|---:|---:|---:|---:|
| Test Wachstum | 1’173 | – | – | – | – | – |
| Test KI | 1’293 | −1,6 % | +1,1 % | 17,3 % | 0,05 | −44,3 % |
| Mami | 1’293 | −0,2 % | +1,7 % | 10,8 % | 0,02 | −24,7 % |
| Test | 1’302 | +3,4 % | +7,5 % | 10,5 % | 0,53 | −17,3 % |

**Berechnungsbasis**

- Kursrendite: homogene Rohschlusskursreihe, ohne Ausschüttungen.
- Brutto-Gesamtrendite: adjusted-close-Snapshot bzw. bei belegter Anbieterabweichung Cash-Dividenden-/Rohkurs-Rekonstruktion, jeweils mit rechnerischer Wiederanlage, vor Steuern und Gebühren.
- Volatilität, Sharpe, VaR, Beta und Max. Drawdown: dieselbe Brutto-Gesamtrenditebasis wie die Kennzahl „Brutto-Gesamtrendite p.a.“.

## Verbleibende, korrekte Datenlücke: ASOL.SW

`ASOL.SW` (21Shares Solana Staking ETP CHF) weist als erste verfügbare EODHD-Handelszeile den **14.03.2022** auf. Der Abruf der vollständigen Zulaufreihe bestätigte das Produktinzeptionsdatum; es ist keine technische Importlücke. Daher kann «Test Wachstum» die verbindliche Fünfjahresregel (20.09.2021 bis 27.09.2026, mit Stressphase) nicht erfüllen.

Eine Rückrechnung mit einem Solana-Index vor Lancierung des ETP wäre ein **synthetischer Proxy** und würde die bisher verbindliche Regel „keine stillen Datenmischungen / keine erfundene Historie“ brechen. Die Anwendung lässt die fünf Kennzahlen daher transparent offen, statt eine scheinpräzise Zahl auszugeben.

Mögliche nächste Produktentscheidung – **nicht automatisch umgesetzt**:

1. **Strikte 5J-Regel beibehalten** (aktueller, konservativer Standard); oder
2. einen zusätzlichen, klar gekennzeichneten Modus „seit Produktinzeption, 4,5J“ anbieten; oder
3. einen explizit als synthetisch markierten Kryptomarkt-Proxy zulassen.

## Nachvollziehbarkeit und Validierung

- Vollständiger maschinenlesbarer Laufbericht: `docs/audit/workings/PORTFOLIO_TOTAL_RETURN_RECALCULATION_2026-09-27.json`.
- TDD: Backfill-Planung ohne Aliasverschmelzung sowie präziser später Historienstart; **10 fokussierte Tests bestanden**. Die breitere Risiko-/Total-Return-Regression bestand mit **32 Tests**.
- Vollständige Regression: **248 Testdateien / 1’715 Tests bestanden**, 5 / 11 bewusst übersprungen.
- TypeScript und `git diff --check`: bestanden.
- Devserver-Abfragen für alle vier Portfolios: ohne API- oder Browserfehler ausgeführt. «Test Wachstum» nennt in der Risikoansicht nun explizit `ASOL.SW (qualifizierte Handelslinie erst ab 2022-03-14)` statt einer pauschalen Datenlücke.

**Research und Analyse, keine persönliche Anlageberatung.**
