# Momentum-Monitor – Implementierungs- und Datenqualitätsaudit

**Stand:** 10.10.2026  
**Umfang:** rein analytisches, lesendes Monitoring für das bestehende Aktienuniversum  
**Keine Anlageberatung:** Die Ergebnisse sind Research-Kontext, kein Kauf-, Verkaufs- oder Umschichtungsauftrag.

## Ergebnis

Der aus dem beigefügten Beitrag abgeleitete **Momentum-Monitor** ist als eigenständige, nachvollziehbare Ebene implementiert. Er ergänzt die bestehenden Qualitäts-, Bewertungs- und Timinginformationen, ersetzt sie aber nicht und verändert keinerlei bestehende Signale.

| Baustein | Umsetzung |
|---|---|
| Preisbasis | Ausschließlich die getrennte EODHD-`split_adjusted_historical_prices`-Reihe der direkten Handelslinie. Es handelt sich um **Kursrendite ohne Cashdividenden**. Rohkurse und Brutto-Gesamtrendite werden nicht überschrieben oder vermischt. |
| Momentum | 6 Monate = 126 Handelstage; 12 Monate = 252 Handelstage; Composite = arithmetischer Mittelwert beider Kursrenditen. |
| Ränge | Perzentil im qualifizierten Gesamtuniversum und im qualifizierten Sektor. ETFs werden in Version 1 transparent ausgeschlossen, nicht still mit Aktien vermischt. |
| Relative Stärke | 6M/12M gegen SPI-ETF (Schweiz), SPY (USA) oder ACWI (sonstige Regionen). Nur bei gleichem letzten Handelstag und kompatibler, splitbereinigter Preisbasis. |
| Trendzustand | Beschreibend: intakt, Konsolidierung, überhitzt oder Trendbruch – über 200-Handelstage-Trendfilter, Trendneigung und relative Stärke. Kein BUY/SELL-Mapping. |
| Risikogate | Ein rein informativer Momentum-Crash-Hinweis nach Drawdown + hoher 20T-Volatilität + Rebound + nachlassender relativer Stärke. Nie ein Trade-Auslöser. |
| Datenqualität | Mindestens 253 eindeutige Handelstage, maximal sieben Kalendertage Datenrückstand und keine bestehende `prüfen`-/`datenlücke`-Sperre. Fehlende oder ungeklärte Reihen erscheinen als Datenlücke statt im Ranking. |
| Historisierung | Versionierte Tages-Snapshots sowie idempotente Tageslaufprotokolle in `momentum_monitor_snapshots` und `momentum_monitor_runs`. |

## Erster kontrollierter Snapshot

**Snapshotdatum:** 10.10.2026  
**Tatsächlicher Schlusskursstichtag der qualifizierten Titel:** 09.10.2026  

| Kennzahl | Ergebnis |
|---|---:|
| Aktive Instrumente geprüft | 313 |
| Qualifizierte Aktien im Ranking | 54 |
| Transparente Datenlücken | 222 |
| Ausgeschlossene ETFs | 37 |
| Aktive Momentum-Crash-Gates | 0 |

Die verbleibenden Datenlücken sind erwartbar und werden nicht durch Ersatzreihen kaschiert: Für den überwiegenden Teil fehlt derzeit eine direkt kompatible, separate EODHD-splitbereinigte Preisreihe mit mindestens 253 Handelstagen.

## WILC-Schutz – gefundene Integritätslücke und Behebung

Beim ersten internen Probelauf war **WILC** aufgrund des bereits bekannten EODHD-Extremwerts (nicht durch eine Kapitalmaßnahme belegt) fälschlich als starke Momentumreihe sichtbar. Das war ein Fehler im *neuen Verbraucherpfad*, nicht eine Rücknahme der bestehenden WILC-Sperre.

Die Ursache wurde vor der UI-Freigabe korrigiert:

1. Der Momentumjob übernimmt jetzt verbindlich vorhandene `prüfen`-/`datenlücke`-Status aus den Aktien-Stammdaten.
2. WILC wird als **Datenlücke** persistiert; Composite, Rang und Trend bleiben leer.
3. Es wurden keine Rohkurse, splitbereinigten Snapshots, Preisstammdaten, Portfolios, Cash-, Ledger-, Transaktions- oder Handelsdaten geändert.

Damit gelten bestehende Corporate-Action- und Vendor-Ausreißersperren für jeden neuen Analyseverbraucher, nicht nur für das bisherige Timing-/Signalmodul.

## Nutzeroberfläche

- Neue Seite **Momentum** (`/momentum`) mit stärksten qualifizierten Reihen, relativer Stärke, Trendzustand, Sektorbreite und klaren Methodikgrenzen.
- Neuer Link aus **Aktien** zum Momentum-Monitor.
- Neue Momentumkarte in jeder qualifizierten **Aktien-Detailansicht**; bei Datenlücken wird ein begründeter Sperrhinweis gezeigt.
- Der Monitor zeigt kein Kauf-/Verkaufssignal, keine Ziele, keine Transaktionsvorschläge und löst keine automatischen Handlungen aus.

## Tägliche Automatisierung

Ein cron-authentisierter Handler ist vorbereitet: `POST /api/scheduled/momentumMonitor`. Er aktualisiert nur die drei abgeleiteten Referenz-Snapshots (CHSPI.SW, SPY.US, ACWI.US) und schreibt die analytischen Momentum-Snapshots. Rohhistorien, Stammdatenpreise und Portfolioobjekte bleiben unverändert.

Der Scheduler wird **erst nach einem Deployment** aktiviert – entsprechend der Dev-only-Vorgabe. Vorgeschlagene Taktung: täglich um **04:45 UTC** (6-Feld-Cron: `0 45 4 * * *`), nach den bestehenden Kurs-/Historienjobs.

## Validierung

- Kernlogik: 6 Tests zu Momentumfenstern, Perzentilen, Trendklassifikation und Crash-Gate.
- Joblogik: 4 Tests zu Assetumfang, konservativer Referenzregion, Datenqualitätssperre und UTC-Stichtag.
- Zeitplan-Sicherheit: 5 Tests; der neue Endpunkt akzeptiert nur authentisierte Scheduler-Aufrufe.
- Integrierter Fokuslauf: **15 Tests bestanden**; TypeScript und `git diff --check` fehlerfrei.
- Vollständige Regression: **262 Testdateien bestanden**, 5 übersprungen; **1'769 Tests bestanden**, 11 übersprungen.
- Browsernavigation auf `/momentum` wurde geprüft; die Dev-Route leitet ohne gültige Sitzung erwartungsgemäß zum Login weiter. Eine vollauthentisierte UI-Prüfung erfolgt nach einem verfügbaren Dev-Login.

## Bewusste Nicht-Umsetzungen in Version 1

1. **Keine Signalgewichtung:** Erst ein zeitlich sauberer Walk-forward-Backtest inklusive Turnover und Kosten darf entscheiden, ob Momentum irgendein vorhandenes Signal beeinflusst.
2. **Keine automatische Umschichtung:** Auch Überhitzung und Crash-Gate bleiben kontextuelle Hinweise.
3. **Keine Sektorindex-Proxy-Mischung:** Der Sektorrang ist ein direkter Peer-Rang; Sektorbenchmarks werden erst ergänzt, wenn jede Referenzreihe gleich streng qualifiziert ist.
4. **Keine ETF-Ränge:** ETFs werden erst nach einer gesonderten Peer- und Indexlinien-Methodik ergänzt.

## Quellen

- Projektanalyse zum beigefügten Beitrag: [Momentum-Monitoring-Erkenntnisse](../research/MOMENTUM_MONITORING_INSIGHTS_2026-10-10.md)
- Chan, Jegadeesh, Lakonishok (1996): *Momentum Strategies*.
- Daniel, Moskowitz: *Momentum Crashes*.
- Vorheriges Datenqualitätsprotokoll: `docs/audit/workings/WILC_VENDOR_OUTLIER_CORRECTION_2026-10-09.json`.
