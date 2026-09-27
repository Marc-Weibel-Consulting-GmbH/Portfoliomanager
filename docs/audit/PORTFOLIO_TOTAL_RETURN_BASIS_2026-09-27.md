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
| Brutto-Gesamtrendite | `Rendite · Total p.a. (5J)` | Homogene, frisch abrufbare **adjusted-close**-Snapshotreihe; bei belegter materieller Providerabweichung Cash-Event-Rekonstruktion | **Ja, rechnerisch reinvestiert** | Vergleichbare Renditebasis für langfristige Portfolioanalyse. |
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

### Ergänzte Plausibilitätskorrektur: M&G / LSE-Quote (27.09.2026, 12:49 UTC)

Die Nachfrage zur ungewöhnlich kleinen Differenz zwischen aktueller Portfolio-Dividendenrendite (3,60 %) und der zuerst gezeigten historischen Differenz von rund 1,5 Prozentpunkten war berechtigt. Die Ursachenanalyse hat zwei voneinander unabhängige Fehler im selben historischen Datenpfad belegt:

1. **LSE-Quoteinheit:** `MNG.L` handelt wirtschaftlich in GBP, aber EODHD liefert den historischen Schlusskurs in **GBp (Pence)**. Der Risk-/Total-Return-Pfad hatte die Auswahlwährung in einem Schritt zu `GBP` großgeschrieben und rechnete die Pence-Reihe somit mit dem GBPCHF-Kurs statt mit `GBPCHF / 100` um.
2. **Provider-Adjusted-Close:** Für `MNG.LSE` waren die gelieferten `adjusted_close`-Werte vom 20.09.2021 bis 25.09.2026 identisch zum Rohschlusskurs (199,4 → 326,7 GBp), obwohl EODHD zehn datierte GBP-Dividendenereignisse meldet. Die Reihe enthielt damit bei diesem Titel keine Dividendeneffekte.

Die Anwendung bewahrt die LSE-Quoteinheit nun bis zur historischen FX-Konvertierung. Sie vergleicht außerdem für EODHD-Portfoliozeilen die Provider-Gesamtrendite mit einer aus **datier­ten Cash-Dividenden und Rohschlüssen** rekonstruierten Brutto-Gesamtrenditereihe. Nur bei einer Abweichung von mindestens 50 Basispunkten ersetzt die Rekonstruktion den Provider-Snapshot. Für `MNG.L` wurde eine getrennte, additive Eventreihe gespeichert: 1’267 Zeilen, `eodhd_events_total_return`, `GBp`, Abruf 27.09.2026 12:38 UTC. Rohkurse, Portfoliobestand, Cash, Ledger und Transaktionen blieben unverändert.

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
| Kursrendite p.a. (5J) | **+3,4 %** | ohne Ausschüttungen |
| Brutto-Gesamtrendite p.a. (5J) | **+7,4 %** | Kurs plus reinvestierte Ausschüttungen |
| Volatilität p.a. (5J) | **10,4 %** | tägliche CHF-Brutto-Gesamtrenditen |
| Sharpe (5J) | **0,52** | Brutto-Gesamtrendite, 2 % risikofreier Satz |
| SPI-Sharpe | **0,10** | Gesamtrendite-Benchmark |
| Max. Drawdown (5J) | **−17,1 %** | Brutto-Gesamtrenditereihe |
| SPI-Max.-Drawdown | **−29,3 %** | Gesamtrendite-Benchmark |

Die Gesamtrendite liegt damit erwartbar über der reinen Kursrendite. Die Risiko-Tab-Karten, Tooltips und Excel-/PDF-Export kennzeichnen beide Renditearten bzw. die Total-Return-Basis nun ausdrücklich.

## Validierung

- TDD: getrennte EODHD-/native-Serie, keine Quellenmischung, Datenlücke statt Ersatzreihe, Datumsbereinigung, GBp-Quoteinheit, Cash-Event-Rekonstruktion, Materialitätsgrenze und Cacheinvalidierung.
- Fokussierte Regression nach Plausibilitätskorrektur: **5 Dateien / 28 Tests bestanden**.
- Vollständige Regression nach Plausibilitätskorrektur: **247 Testdateien / 1’712 Tests bestanden**, 5 / 11 bewusst übersprungen.
- TypeScript: bestanden.
- `git diff --check`: bestanden.
- Dev-Livecheck: Portfolio-Kopf und Risiko-Tab zeigen beide Renditebasen sowie die Total-Return-Risikoformeln ohne Browserfehler.

## Grenzen

- Die Kennzahlen sind **Research und Analyse, keine persönliche Anlageberatung**.
- Eine Brutto-Gesamtrendite stellt keine nachsteuerliche oder gebührenbereinigte Investor-Rendite dar.
- Die tägliche Aktualisierung ist begrenzt auf Portfolio-Positionen; dadurch bleiben Providerabrufe auf den nutzungsrelevanten Umfang begrenzt.
