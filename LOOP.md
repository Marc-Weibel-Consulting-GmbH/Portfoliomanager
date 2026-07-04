# LOOP.md — Loop Engineering für Portfoliomanager

Dieses Repo wird mit **Loop-Engineering-Mustern** betrieben: wiederkehrende, guardrail-
gesicherte Agenten-Loops (Claude Code) mit klaren Kadenzen, Budgets und menschlichen
Gates. Muster & Tooling stammen aus der Referenz
[cobusgreyling/loop-engineering](https://github.com/cobusgreyling/loop-engineering) (MIT)
und sind auf dieses Projekt (TypeScript-Monorepo, pnpm, Deploy-from-`main`) zugeschnitten.

Operative Dateien im Repo-Root:
- **`STATE.md`** — Live-Zustand der Loops (Prioritäten, Watch-List, Noise).
- **`loop-constraints.md`** — bindende Regeln (Gates aus `CLAUDE.md`).
- **`loop-budget.md`** — Token-/Run-Caps pro Loop + Kill-Switch.
- **`loop-run-log.md`** — Append-only Run-Historie.

Skills unter `.claude/skills/`: `loop-constraints` (Guardrail), `loop-triage` (L1-Report),
`loop-budget` (Budget-Guard). Ergänzen die bestehenden `/ralph`- und `/loop`-Skills.

## Aktive Loops

### PR Babysitter (L2 — assistiert, manueller/Event-Trigger) — **primär**
- **Zweck:** offene PRs durch Review, CI, Rebase und Merge begleiten; Mensch entscheidet.
- **Trigger:** `subscribe_pr_activity` weckt die Session bei CI-/Review-Events; zusätzlich
  `/loop 10m /pr-babysit` oder ein Selbst-Check-in (`send_later`, ~1 h) für nicht
  webhook-gelieferte Übergänge (CI-Erfolg, neue Pushes, Merge-Konflikte).
- **Ablauf:** triagieren → bei rotem CI/aktionierbarem Review-Kommentar minimalen Fix
  (in isoliertem git-Worktree) → Verifier bestätigt → Draft-PR/Ping. **Kein Auto-Merge.**
- **Gate:** Sicherheits-/Zahlungs-/Auth-/Schema-Änderungen und >3 Fixversuche am selben
  PR → an den Menschen. State: `STATE.md`.

### Daily Triage (L1 — Report-only)
- **Zweck:** neue CI-Fehler, offene Issues/PRs, letzte `main`-Commits sichten und einen
  knappen, priorisierten Report in `STATE.md` schreiben. **Nur Report, keine Aktion.**
- **Kadenz:** 1×/Werktag (manuell via `/loop-triage` oder späterer GitHub Action).
- **Handoff:** Design-Entscheide, grosse Refactorings, neue Muster.

### Ralph (bestehend) — zielgetriebene Umsetzung gegen Mockups
- Der vorhandene `/ralph`-Loop (`.claude/commands/ralph.md`, `design/RALPH_LOOP.md`) bleibt
  die zielgetriebene „eine-Iteration"-Schleife: nächste offene Aufgabe gegen das Mockup
  umsetzen, live verifizieren, committen. Loop-Constraints/Budget gelten auch hier.

## Multi-Loop-Koordination
Priorität bei Konflikt: **PR Babysitter → Daily Triage (Report) → Ralph (off-peak)**.
Nie zwei fix-fähige Loops gleichzeitig auf denselben Branch/PR.

## Worktrees
Jeder unbeaufsichtigte Code-Change-Versuch läuft in einem **isolierten git-Worktree**
(ein Worktree pro Fix; nach Verifier-REJECT oder Eskalation verwerfen).

## Safety & Gates
- Kein Auto-Merge auf `main` (deployt live). Draft-PR zuerst.
- Denylist siehe `loop-constraints.md` (Secrets/Env, Stripe/Auth, Schema-Migrationen).
- Qualitäts-Gate: `pnpm check` grün + `pnpm test` für berührte Bereiche, bevor ein Fix
  vorgeschlagen wird. Kein Deaktivieren von Tests.
- Kill-Switch: `loop-pause-all` (Label oder Flag in `STATE.md`).

## Budget & Observability
- Caps: `loop-budget.md`. Historie: `loop-run-log.md`. Der `loop-budget`-Skill läuft zu
  Beginn und Ende jeder Iteration und erzwingt Early-Exit bei fehlender Arbeit / Cap.

## Lokal ausführen
```bash
# L1-Report erzeugen (schreibt STATE.md, keine Aktionen)
/loop-triage
# PR-Babysitter-Iteration
/loop 10m /pr-babysit
# Readiness/Kosten der Referenz-Tools (nach npm-Publish von @cobusgreyling/*):
npx @cobusgreyling/loop-audit . --suggest
npx @cobusgreyling/loop-cost --pattern pr-babysitter --cadence 10m --level L1
```

---
*Diese Datei ist zugleich Dokumentation und Seed für die Loops, die das Projekt pflegen.*
