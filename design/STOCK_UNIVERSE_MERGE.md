# Konzept: `stocks` + `watchlistStocks` → eine Tabelle

> Freigegeben: **Datenmodell wirklich vereinen.** Ziel ist eine einzige Quelle der
> Wahrheit für alle Titel — Portfolio-Stammdaten *und* kuratiertes Universum.

## Ausgangslage

Zwei überlappende, nur per Ticker-String (kein FK) verbundene Tabellen:

| | `stocks` (Stammdaten) | `watchlistStocks` (Universum) |
|---|---|---|
| Rolle | Portfolio-/Optimizer-Stammdaten (Gewichte, Moats, YTD, Factsheet, Score) | Kuratiertes Universum (max. 200), `listType`, Quelle, Signal-Score |
| Zugriffe | ~25 (Portfolios, Optimizer, Daily-Refresh, Price-Updater, Backtest, Copilot …) | ~14 (Nutzer-Seite `/aktien`, Analytics, Signale, Dashboard, Watchlist-Admin, Wikifolio-Import) |

Doppelspurigkeit: beide tragen Ticker, Name, Preis, P/E, Dividende, Sektor.

## Entscheidung: `stocks` überlebt

`stocks` hat den grossen Fussabdruck und muss ohnehin *jeden* gehaltenen Titel
enthalten. Wird `stocks` die eine Tabelle, bleiben die ~25 schweren Zugriffe
unverändert (gleiche Tabelle) — nur die ~14 Watchlist/Invest-Stellen zeigen neu
auf `stocks`. Risikoärmste Richtung.

### Vereinte Semantik (Kuratierungs-Facette auf `stocks`, alles nullable)

- `listType` enum(`empfehlung`,`watchlist`) **nullable** — `NULL` = reines
  Portfolio-Stammdatum (nicht im Universum); `empfehlung` = Nutzer-Seite
  `/aktien`; `watchlist` = Staging (inkl. Wikifolio-Importe).
- `source` enum(`manual`,`ai_recommended`,`wikifolio`) nullable.
- `signalScore` int nullable, `signalType` enum(`buy`,`sell`,`hold`) nullable.
- `aiReason` text, `rsi14`, `industry`, `country`, `notes`, `lastMetricsUpdate`.
- `isActive` tinyint default 1.

Regeln:
- `/aktien` (invest): `listType='empfehlung' AND isActive=1` — unverändert.
- Watchlist-Admin: `listType IS NOT NULL AND isActive=1`.
- Wikifolio-Import: Upsert in `stocks` mit `source='wikifolio'`, `listType='watchlist'`.

## Phasen (je eine PR, `main` bleibt deploybar)

| Phase | Inhalt | Status |
|---|---|---|
| **1** | Additive Spalten auf `stocks`; idempotente Admin-Aktion „Universum zusammenführen" (Upsert `watchlistStocks` → `stocks` per Ticker); Design-Doc. Kein Consumer umgestellt → Verhalten identisch. Braucht `pnpm db:push`. | ✅ (PR #99) |
| **2** | Alle Watchlist/Invest/Wikifolio/Analytics/Optimizer/Signal/Dashboard/Cron-Zugriffe auf `stocks` umstellen (Filter `curated()` = listType != NULL erhält das bisherige Verhalten). | vorbereitet |
| **3** | `watchlistStocks` (Tabelle + Typ + Restreferenzen) entfernen. | offen |

## Phase 2 — Umstellungsdetails

Helper `server/lib/stockUniverse.ts`: `curated()` = `isNotNull(stocks.listType)`,
`activeCurated()` = `isActive=1 AND listType != NULL`. Jede frühere
`watchlistStocks`-Abfrage (die nur kuratierte Zeilen sah) bekommt diesen Filter,
damit reine Portfolio-Stammdaten (listType = NULL) nicht ins Universum lecken.

Semantische Feinheiten im `watchlistRouter`:
- **add**: existiert der Ticker bereits als Portfolio-Stammdatum (listType = NULL),
  wird er kuratiert statt „bereits vorhanden"-Fehler; neue Titel → listType='watchlist'.
- **remove**: **kein** Hard-Delete mehr (die Zeile kann Portfolio-Stammdatum sein) —
  stattdessen `listType = NULL` (aus dem Universum nehmen).
- **generateRecommendations / Wikifolio-Import**: Dedup gegen alle `stocks`
  (Ticker ist UNIQUE); Overwrite kuratiert eine bisher reine Stammdaten-Zeile.

**Wichtig:** Phase 2 darf erst deployen, nachdem Phase 1 auf Prod migriert
(`db:push`) und „Universum zusammenführen" ausgeführt wurde — sonst ist die
Kuratierungsspalte leer und `/aktien` erschiene leer.

## Migration/Backfill (Phase 1)

Admin-Aktion `stocks.mergeWatchlistUniverse` (idempotent):
- Für jeden `watchlistStocks`-Eintrag Upsert in `stocks` per Ticker.
- Fehlende Titel werden angelegt (mit Kuratierungs-Feldern).
- Bestehende Titel: Kuratierungsspalten + fehlende Kennzahlen werden gefüllt,
  **ohne** Portfolio-Felder (`portfolioWeight`, `isManualWeight`, Moats) zu
  überschreiben.
- Läuft einmal nach `db:push`; erneutes Ausführen ist gefahrlos.
