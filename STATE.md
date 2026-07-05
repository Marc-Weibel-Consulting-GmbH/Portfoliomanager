# Loop State — Portfoliomanager

Last run: 2026-07-05T06:48Z (loop-triage + minimal-fix)

## Erledigt in diesem Lauf (Code, PR #55)
- ✅ **Testsuite wieder grün** — `wikifolioWatchlist.test.ts` an das neue
  `mapWikifolioSearchResults` angeglichen (515 Tests, 0 rot).
- ✅ **Symbol-Coverage (EODHD)** — Ticker-Alias in `server/lib/eodhdSymbol.ts` zentralisiert;
  Realtime + Dividendenkalender wenden ihn jetzt an → MONC.MI→MONRY, HELN.SW→HELNF statt 404.
  *Offen:* nach Deploy live gegen EODHD verifizieren; `signalEvalCron` nutzt Yahoo (separates
  Symbol-Thema, HELN.SW ggf. auf Yahoo delisted).
- ✅ **App-Name** — E-Mail-Fallback „Portfolio BIG" → „Portfoliomanager".

## High Priority (wartet auf Mensch — Prod-DB / Deploy-Umgebung, aus Session nicht ausführbar)

- [ ] **ISIN-Watchlist bereinigen** — Admin › Watchlist → Button „ISIN bereinigen" einmal gegen Prod.
- [ ] **Remediation-Skripte** (Dry-Run → `--apply`): `recompute-ytd-baselines.ts`,
  `backfill-realized-gains.ts`, `migrate-fee-semantics.ts` (kein `DATABASE_URL` in der Session).
- [ ] **`VITE_APP_TITLE=Portfoliomanager`** in der Deploy-Umgebung setzen (Code-Default + `.env.example` gesetzt).
- [ ] **Alt-„APPLE"-Alarm** in Einstellungen › Preisalarme löschen (Neuerstellung ist blockiert).
- [ ] **LVMUY / ABB.SW in `stocks`** — Admin-Kuratierung mit echten Daten (LVMUY = US-ADR vs. Seed
  `MC.PA`; ABB fehlt ganz). Bewusst keine erfundenen Kennzahlen in den Seed.
- [ ] **Empfehlungen kuratieren** — Admin › Watchlist, Toggle „Empfehlung" (Massenbutton vorhanden).

## Watch List
- L-11 Portfolios-Leerraum (kosmetisch, ohne Live-Ansicht nicht zielsicher fixbar).

## Recent Noise (in diesem Run ignoriert)
- Keine offenen PRs/Issues auf GitHub. `pnpm check` grün.
- Markt-Puls-Sektoren 0.0 % am Wochenende — echtes EODHD-Verhalten (Börse zu), kein Bug.

---
Run-Log: siehe `loop-run-log.md`. Kadenz & Gates: `LOOP.md`. Regeln: `loop-constraints.md`.
