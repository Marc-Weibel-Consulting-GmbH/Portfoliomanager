# Kursrendite und Brutto-Gesamtrendite im Portfolio-Risikoproxy

**Stichtag:** 27. September 2026  
**Scope:** Portfolio «Test» (ID 5160001), 26 Positionen  
**Status:** umgesetzt, getestet und live im Devserver geprüft

## Anlass

Die frühere Beschriftung `Rendite · P.A. (5J)` sagte nicht ausdrücklich, ob Ausschüttungen enthalten sind. Gleichzeitig sind historische `adjusted_close`-Werte **nicht dauerhaft unveränderlich**: Marktanbieter rechnen bei jeder neu ausgeschütteten Dividende die gesamte zurückliegende adjusted-close-Reihe neu. Ein alter, beim Erstimport gespeicherter adjusted-close-Wert kann deshalb eine später fällige Dividende noch nicht enthalten.

Die Rohkurse dürfen nicht überschrieben werden. Es wäre daher nicht korrekt gewesen, die bestehende Rohkursreihe stillschweigend durch nachträglich adjustierte Werte zu ersetzen.

## Korrigierter Datenvertrag

| Kennzahl | Neue, sichtbare Bezeichnung | Datenbasis | Dividenden | Zweck |
|---|---|---|---|---|
| Kursrendite | `Rendite · Kurs p.a. (5J)` | Homogene native **unadjusted close**-Reihe | **Nein** | Zeigt ausschließlich die Kursentwicklung. |
| Brutto-Gesamtrendite | `Rendite · Total p.a. (5J)` | Homogene, frisch abrufbare **adjusted-close**-Snapshotreihe | **Ja, rechnerisch reinvestiert** | Vergleichbare Renditebasis für langfristige Portfolioanalyse. |
| Volatilität, Sharpe, VaR, Max. Drawdown, Beta | `Risiko … (5J)` | Dieselbe Total-Return-Reihe wie Brutto-Gesamtrendite | **Ja** | Standardkonforme risiko-adjustierte Kennzahlen; der SPI-Benchmark ist ebenfalls eine Gesamtrenditebasis. |

> **Brutto** bedeutet vor Steuern, Quellensteuer, Gebühren und individuellen Wiederanlagekosten. Die Kennzahl ist ein historischer Allokationsproxy mit heutigen Stückzahlen; sie ist keine rückwirkend ausgeführte Depot- oder Transaktionshistorie vor Portfolio-Start.

## Technische Umsetzung

1. **Rohpreise bleiben additiv und unverändert.** `historical_prices.close` ist weiterhin die Kursrenditebasis.
2. Neue Tabelle `total_return_historical_prices` speichert nur adjusted-close-Snapshots mit:
   - `ticker`, Tag und Handelswährung,
   - Quelle und Quellsymbol,
   - `retrievedAt` als nachvollziehbarem Stichtag.
3. Ein EODHD-Titel erhält ausschließlich eine aktuelle EODHD-adjusted-close-Reihe. Eine erkannte native Ausnahme erhält ausschließlich die verifizierte Yahoo-Reihe derselben Handelslinie/ISIN. Es gibt **keine** tagweise Vermischung und keine ADR- oder Fremdwährungsproxy-Reihe.
4. Beim expliziten Historienimport bzw. beim Backfill eines neuen Titels wird der Snapshot mitgeladen. Der reguläre Tagesimport aktualisiert nur gespeicherte Portfolio-Positionen, die älter als 24 Stunden sind — nicht das gesamte Screener-Universum.
5. Fehlt eine vollständige, quellen- und währungskonsistente Snapshotreihe, bleibt die Total-Return- und Risikokennzahl eine sichtbare Datenlücke. Sie wird nicht aus Dividendenrenditen geschätzt.

## Kontrollierte Anreicherung: Portfolio «Test»

| Befund | Ergebnis |
|---|---:|
| Positionen / zugrunde liegende Snapshotreihen | 26 / 26 |
| Total-Return-Snapshotzeilen | 32’800 |
| EODHD-adjusted-close-Zeilen | 27’775 |
| Verifizierte native Yahoo-adjusted-close-Zeilen | 5’025 |
| Datenfenster | 20.09.2021–25.09.2026 |
| Snapshot-Abruf | 27.09.2026, 11:05–11:06 UTC |
| Veränderte Rohkurs-, Portfolio-, Cash-, Ledger- oder Transaktionsdaten | **Keine** |

Die vier zuvor identifizierten, kontrollierten nativen Reihen bleiben getrennt und transparent: Horiba (JPY), DBS (SGD), Bravida via verifizierter Stockholm-Primärlinie (SEK, gleiche ISIN, 1:1) und SNAM (EUR).

## Live-Resultat am Testportfolio

Nach Cache-Neustart und Abschluss der Snapshotanreicherung zeigte der Devserver:

| Kennzahl | Wert | Basis |
|---|---:|---|
| Kursrendite p.a. (5J) | **+4,9 %** | ohne Ausschüttungen |
| Brutto-Gesamtrendite p.a. (5J) | **+6,4 %** | Kurs plus reinvestierte Ausschüttungen |
| Volatilität p.a. (5J) | **16,3 %** | tägliche CHF-Brutto-Gesamtrenditen |
| Sharpe (5J) | **0,33** | Brutto-Gesamtrendite, 2 % risikofreier Satz |
| SPI-Sharpe | **0,10** | Gesamtrendite-Benchmark |
| Max. Drawdown (5J) | **−26,8 %** | Brutto-Gesamtrenditereihe |
| SPI-Max.-Drawdown | **−29,3 %** | Gesamtrendite-Benchmark |

Die Gesamtrendite liegt damit erwartbar über der reinen Kursrendite. Die Risiko-Tab-Karten, Tooltips und Excel-/PDF-Export kennzeichnen beide Renditearten bzw. die Total-Return-Basis nun ausdrücklich.

## Validierung

- TDD: getrennte EODHD-/native-Serie, keine Quellenmischung, Datenlücke statt Ersatzreihe, Datumsbereinigung.
- Fokussierte Regression: **5 Dateien / 38 Tests bestanden**.
- Vollständige Regression: **246 Testdateien / 1’703 Tests bestanden**, 5 / 11 bewusst übersprungen.
- TypeScript: bestanden.
- `git diff --check`: bestanden.
- Dev-Livecheck: Portfolio-Kopf und Risiko-Tab zeigen beide Renditebasen sowie die Total-Return-Risikoformeln ohne Browserfehler.

## Grenzen

- Die Kennzahlen sind **Research und Analyse, keine persönliche Anlageberatung**.
- Eine Brutto-Gesamtrendite stellt keine nachsteuerliche oder gebührenbereinigte Investor-Rendite dar.
- Die tägliche Aktualisierung ist begrenzt auf Portfolio-Positionen; dadurch bleiben Providerabrufe auf den nutzungsrelevanten Umfang begrenzt.
