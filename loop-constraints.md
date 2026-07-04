# Loop Constraints — Portfoliomanager

> Binding rules for every autonomous loop run in this repo. The `loop-constraints`
> skill reads this file at the **start of every run** and enforces every rule verbatim.
> Adapted from the loop-engineering reference (cobusgreyling/loop-engineering, MIT) and
> merged with this project's `CLAUDE.md`.

## Push & Merge
- Entwickle nur auf dem zugewiesenen Feature-Branch; niemals direkt auf `main`.
- Immer zuerst einen **Draft-PR** öffnen; erst nach menschlichem Review auf „ready".
- **Kein Auto-Merge** nach `main` ohne ausdrückliche menschliche Freigabe
  (`main` deployt automatisch auf manus.space / portfolio.mw).
- Vor jedem Push kurz sagen, was gepusht wird.

## Paths (Denylist — nie ohne Freigabe anfassen)
- `.env`, `.env.*`, `server/_core/secretsManager.ts`, `server/_core/env.ts`
- Zahlungs-/Auth-Pfade: `server/webhooks/stripe.ts`, `server/_core/authService.ts`,
  `server/routers.ts` (Stripe-Checkout-Block)
- `drizzle/` Schema-Migrationen ohne Review (Datenverlust-Risiko)
- Infrastruktur/Deploy-Configs

## Code (Qualitäts-Gates aus CLAUDE.md)
- **`pnpm check` muss grün sein** vor jedem Commit (TypeScript).
- **`pnpm test`** (Vitest) für berührte Bereiche laufen lassen; niemals Tests
  deaktivieren, um CI grün zu bekommen.
- Geld immer als Decimal/gerundet behandeln — kein Floating-Point für CHF-Beträge.
- Chirurgische Änderungen: eine Sache pro Run, keinen fremden Code „mitverbessern".
- Echte Server-Daten bevorzugen — keine Platzhalter/Mock-Werte in der UI.
- Deutschsprachige UI; revDSG statt DSGVO; Swiss-Formatierung (`1'234.56`).
- **Max 3 Fix-Versuche pro Item**, danach an den Menschen eskalieren.

## Verification (kein Selbst-„fertig")
- Der umsetzende (Sub-)Agent markiert seine Arbeit nie selbst als „done".
- „Done" heisst live verifiziert (nach Merge die betroffenen Seiten auf der Live-URL
  ohne Konsolenfehler prüfen — Deploy-Lag 8–28 Min), nicht nur gemergt.

## Communication
- Vor risikoreichen/aussenwirksamen Aktionen erst fragen (AskUserQuestion).
- Nie einen Issue oder PR ohne Freigabe schliessen.
- PR-Kommentare klar signieren: „🤖 Loop Engineering — <Pattern>".

## Budget
- Bei 80 % des Tages-Token-Caps → auf Report-only umschalten.
- Ist `loop-pause-all` aktiv (Label oder Flag in `STATE.md`) → sofort beenden.

---
<!-- Eigene Regeln unten in einfacher Sprache ergänzen. Der Loop liest sie wörtlich. -->
