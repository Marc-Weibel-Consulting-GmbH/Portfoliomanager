---
name: loop-constraints
description: >
  Read loop-constraints.md at the start of every loop run and enforce every rule.
  Runs BEFORE triage or any action skill. Constraints are binding. Portfoliomanager.
user_invocable: true
---

# Loop Constraints Enforcer — Portfoliomanager

Du bist das Guardrail. Bevor irgendeine andere Arbeit beginnt, MUSST du:

1. `loop-constraints.md` aus dem Repo-Root lesen.
2. Jede Regel ins Arbeitsgedächtnis laden.
3. Prüfen, ob `loop-pause-all` aktiv ist (Label oder Flag in `STATE.md`) → sofort beenden.
4. Diese Regeln auf JEDE folgende Aktion anwenden.

## Durchsetzen
- Vor Push: Abschnitt „Push & Merge" erneut lesen. Blockiert eine Regel → stoppen und Mensch informieren. Immer Draft-PR zuerst, nie Auto-Merge auf `main`.
- Vor Datei-Edit: Abschnitt „Paths" erneut lesen. Trifft der Pfad die Denylist (Secrets/Env, Stripe/Auth, `drizzle/`-Migrationen) → eskalieren.
- Vor Fix-Vorschlag: Abschnitt „Code" — `pnpm check` grün, `pnpm test` für berührte Bereiche, eine Sache pro Run, keine Floating-Point-Geldbeträge, echte Server-Daten. Nach 3 Fehlversuchen eskalieren.
- Vor Merge: menschliche Freigabe zwingend.

## Ausgabe zu Beginn
Immer mit einer Zeile beginnen:

```
Constraints geladen aus loop-constraints.md: N Regeln aktiv.
```

Fehlt `loop-constraints.md`, das sagen und mit den Default-Regeln unten weiterarbeiten.

## Zusammenspiel
- `loop-triage` — Constraints überschreiben Triage-Priorität (z. B. „kein Push" ⇒ nicht auf CI-Fix handeln).
- `loop-budget` — Constraints können ein strengeres Budget als `loop-budget.md` erzwingen.

## Default-Constraints (falls keine Datei existiert)
- Nie `.env`, `.env.*`, Secrets/Auth/Payments (`secretsManager.ts`, `authService.ts`, `webhooks/stripe.ts`) editieren.
- Nie auf `main` auto-mergen (deployt live). Draft-PR zuerst.
- Nie Tests deaktivieren. Nach 3 fehlgeschlagenen Fixversuchen eskalieren.
- Geld als Decimal/gerundet, nie Floating-Point.
