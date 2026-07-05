# Loop State — Portfoliomanager

Last run: 2026-07-05T06:36Z (loop-triage, L1 Report-only)

## High Priority (Loop handelt oder wartet auf Mensch)

- [ ] **Testsuite rot auf `main`** — `server/__tests__/wikifolioWatchlist.test.ts`, 2 Fehler in
  `mapWikifolioSearchResults`. *Ursache:* Checkpoint `9215568` stellte `searchWikifolios` auf die
  öffentliche Wikifolio-API um; das Mapping baut jetzt `wikifolioUrl` aus dem Symbol und lässt
  `traderName` leer — die Testerwartungen (`wikifolioUrl: null`, `traderName: "Max Muster"`) wurden
  nicht mitgezogen. *Warum es zählt:* verletzt das Qualitäts-Gate „`pnpm test` grün" (515 Tests: 2 rot).
  *Nächste Aktion:* minimaler Fix im isolierten Worktree — Testerwartungen an das neue, gewollte
  Mapping angleichen (kein Produktionscode ändern). *Aufwand:* ~15 Min, low-risk.
- [ ] **ISIN-Watchlist bereinigen** — Admin › Watchlist → Button „ISIN bereinigen" einmal gegen Prod
  klicken (löst die ~133 ISIN-Alt-Zeilen auf, stoppt den `watchlistAlertsCron`-Log-Spam).
  *Loop-Aktion:* nur erinnern (kein Prod-DB-Zugriff).

## Watch List (beobachten, noch nicht handeln)

- Remediation-Skripte (Dry-Run → `--apply`) gegen Prod: `recompute-ytd-baselines.ts`,
  `backfill-realized-gains.ts`, `migrate-fee-semantics.ts` (review-pflichtig).
- `VITE_APP_TITLE=Portfoliomanager` in der Deploy-Umgebung setzen (Code-Default ist gesetzt).
- Alt-„APPLE"-Alarm in Einstellungen › Preisalarme löschen (Neuerstellung ist code-seitig blockiert).
- Symbol-Coverage HELN.SW / ROG.SW / MONC.MI (EODHD „No data"/404) — live gegen EODHD prüfen.
- LVMUY / ABB.SW nicht in `stocks`-Tabelle → `getPortfolioCompact`-Warnungen.
- Empfehlungen kuratieren (Admin › Watchlist, Toggle „Empfehlung"; Massenbutton vorhanden).
- L-11 Portfolios-Leerraum (kosmetisch, ohne Live-Ansicht nicht zielsicher fixbar).

## Recent Noise (in diesem Run ignoriert)

- Keine offenen PRs/Issues auf GitHub. `pnpm check` grün.
- Markt-Puls-Sektoren 0.0 % am Wochenende — echtes EODHD-Verhalten (Börse zu), kein Bug.
- Manus-Checkpoints auf `main` (Wikifolio-Public-API, Deploy-/Build-Fixes) — informativ, keine Aktion
  ausser dem daraus resultierenden roten Test (siehe High Priority).

---
Run-Log: siehe `loop-run-log.md`. Kadenz & Gates: `LOOP.md`. Regeln: `loop-constraints.md`.
