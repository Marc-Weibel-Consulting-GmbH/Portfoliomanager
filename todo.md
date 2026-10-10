

## Universumsweite Split- und Kapitalmaßnahmenprüfung (2026-10-09)
- [x] 313 aktive Instrumente (267 kuratiert) gegen EODHD-Splits, direkte Handelslinie/Währung, Rohsprünge sowie YTD-/52W-Preisanker inventarisiert.
- [x] 24 bestätigte Kapitalmaßnahmen (23 Vorwärts-, 1 Reverse-Split) separat geprüft; abgeleitete Split-/Total-Return-Snapshots für 23 direkt verfügbare Quellen kontrolliert erneuert, 8015.T als Datenlücke belassen.
- [x] Zentrale Marktkennzahlen auf eine homogene, direkte splitbereinigte Preisbasis gestellt: vor allem SQN.SW 1:10 (YTD −92,48 % → −29,96 %), KLAC 1:10 (−84,56 % → +53,45 %), CRWD 1:4 und NOBL 1:2 korrigiert; YTD-/52W-Basismismatches im direkt verifizierten Universum von 4/3 auf 0 reduziert.
- [x] Sekundärquote-/Rohhistorienrückschreiben abgesichert; tägliche und Watchlist-Refreshes synchronisieren Quote, YTD und 52W nun über dieselbe Splitbasis. Direkte Fremdlisting-/ADR-/Währungsproxies bleiben für Marktstammdaten gesperrt.
- [x] WILC-Anbieterausreißer ohne Splitbeleg bewusst gesperrt (keine geschätzte Kapitalmaßnahme); Preis, YTD und 52W bleiben leer bis zur verifizierten Handelslinie.
- [x] Signalcache für 267 aktive Titel auf der korrigierten Preisbasis neu aufgebaut (0 Fehler). Keine Rohhistorie, Portfolioallokation, Cash-, Ledger-, Transaktions- oder Handelsdaten verändert.
- [x] Audit: `docs/audit/UNIVERSE_WIDE_SPLIT_AND_CORPORATE_ACTION_AUDIT_2026-10-09.md`; volle Regression 257 Testdateien / 1'753 Tests bestanden, 5 / 11 übersprungen; TypeScript und Diffcheck fehlerfrei.

## Splitbereinigte Dividendenrenditen (2026-10-09)
- [x] Swissquote-Dividendenrendite reproduziert und gegen Swissquote-Primärmitteilung sowie EODHD `/div` geprüft: CHF 7.40 war die pre-split-Dividende; nach 1:10 gilt CHF 0.74 pro heutiger Aktie.
- [x] Zentraler EODHD-Selektor priorisiert `value` (heutige splitbereinigte Aktie) vor `unadjustedValue` und schützt damit TTM-Dividendenrendite sowie ereignisrekonstruierte Brutto-Gesamtrendite.
- [x] Alle 24 aktiven Titel mit verifizierter Kapitalmaßnahme kontrolliert: 3 materiell betroffen und korrigiert – SQN.SW 21.2400% → 2.1240%, KLAC 3.2178% → 0.4295%, NOBL 3.1965% → 2.1301%.
- [x] Abgeleitete 5J-Split-/Gesamtrendite-Snapshots für die drei Titel kontrolliert aktualisiert; keine Rohhistorie, Portfolio-, Cash-, Ledger-, Transaktions- oder Handelsmutation.
- [x] Signalcache für 267 aktive Titel erfolgreich aktualisiert. Vollsuite: 259 Testdateien / 1'756 Tests bestanden, 5 / 11 übersprungen; TypeScript und Diffcheck fehlerfrei. Audit: `docs/audit/SPLIT_ADJUSTED_DIVIDEND_YIELD_AUDIT_2026-10-09.md`.

## Monatlicher Corporate-Action-Audit und Dividendenexport (2026-10-10)
- [x] Wiederverwendbare, rein lesende EODHD-/Datenbankinventur implementiert; sie prüft je aktiver Handelslinie Splits/Reverse-Splits, mechanische Rohkurssprünge, direkte Handelslinien-/Währungskompatibilität sowie YTD- und 52W-Basis.
- [x] Idempotentes Monatsprotokoll `corporate_action_audit_runs` und cron-authentisierter Heartbeat-Endpunkt `/api/scheduled/corporateActionAudit` erstellt. Der Probelauf über 313 aktive Instrumente lief in rund 63 Sekunden: 24 bestätigte Kapitalmaßnahmen, 0 YTD- und 0 52W-Basisfehler; 204 fehlende Split-Snapshots bleiben explizite Datenlücken.
- [ ] Heartbeat-Task nach Deployment aktivieren (geplant: erster Kalendertag, 04:15 UTC, 6-Feld-Cron `0 15 4 1 * *`). Gemäss Dev-only-Vorgabe noch **kein** produktiver Scheduler erstellt.
- [x] Excel-Export um Blatt «Dividendenbasis» ergänzt: Renditebasis (TTM/Forward/Vendor), splitbereinigter Jahresbetrag je Aktie, Ereigniszahl, Stichtag, Quelle und methodische Erläuterung je Position.
- [x] PDF-Export um eigene Seite «Dividendenbasis» ergänzt. TTM-Brutto, Forward/indicated und Anbieterfallback sind explizit getrennt; Sonderdividenden sind als ausgeschlossen dokumentiert.
- [x] Analyse des beigefügten Momentum-Beitrags mit einer umsetzbaren Roadmap und akademischem Gegencheck dokumentiert: `docs/research/MOMENTUM_MONITORING_INSIGHTS_2026-10-10.md`.
- [x] Regression: 260 Testdateien bestanden, 5 übersprungen; 1'758 Tests bestanden, 11 übersprungen. TypeScript und `git diff --check` fehlerfrei. Browserroute im Devserver geprüft; Exportaktion ist durch vorhandenen Login geschützt, daher ohne Nutzerlogin nicht ausgelöst.
