# Loop State — Portfoliomanager

Last run: (wird vom Loop bei jedem Run gesetzt)

## High Priority (Loop handelt oder wartet auf Mensch)

- [ ] **ISIN-Watchlist bereinigen** — Admin › Watchlist → Button „ISIN bereinigen"
  einmal gegen Prod klicken (löst die ~133 ISIN-Alt-Zeilen auf, stoppt den
  `watchlistAlertsCron`-Log-Spam). *Loop-Aktion:* nur erinnern (kein Prod-DB-Zugriff).
- [ ] **Remediation-Skripte** (Dry-Run → `--apply`) gegen Prod: `recompute-ytd-baselines.ts`
  (extreme YTD-Werte), `backfill-realized-gains.ts`, `migrate-fee-semantics.ts`.
  *Human decision:* review-pflichtig, nicht als Auto-Loop.
- [ ] **`VITE_APP_TITLE=Portfoliomanager`** in der Deploy-Umgebung setzen (Code-Default ist gesetzt).
- [ ] **Alt-„APPLE"-Alarm** in Einstellungen › Preisalarme löschen (Neuerstellung ist
  code-seitig bereits blockiert).

## Watch List (beobachten, noch nicht handeln)

- Symbol-Coverage HELN.SW / ROG.SW / MONC.MI (EODHD „No data"/404) — live gegen EODHD prüfen.
- LVMUY / ABB.SW nicht in `stocks`-Tabelle → `getPortfolioCompact`-Warnungen.
- Empfehlungen kuratieren (Admin › Watchlist, Toggle „Empfehlung"; Massenbutton vorhanden).
- L-11 Portfolios-Leerraum (kosmetisch, ohne Live-Ansicht nicht zielsicher fixbar).

## Recent Noise (in diesem Run ignoriert)

- Markt-Puls-Sektoren 0.0 % am Wochenende — echtes EODHD-Verhalten (Börse zu), kein Bug.

---
Run-Log: siehe `loop-run-log.md`. Kadenz & Gates: `LOOP.md`. Regeln: `loop-constraints.md`.
