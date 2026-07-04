---
name: loop-budget
description: >
  Check token budget and run-log spend before and after a loop run. Enforces early
  exit when over budget or when there is no actionable work. Portfoliomanager.
user_invocable: true
---

# Loop Budget Guard — Portfoliomanager

Läuft zu **Beginn** und **Ende** jeder Loop-Iteration.

## Beginn des Runs
1. `loop-budget.md` für Tages-Caps und Kill-Switch-Flags lesen.
2. Jüngste `loop-run-log.md`-Einträge (letzte 24 h) lesen.
3. `tokens_estimate` des aktiven Patterns für heute summieren.
4. ≥ 80 % des Pattern-Caps → **Report-only** (keine Sub-Agenten, kein Auto-Fix).
5. ≥ 100 % oder `loop-pause-all` gesetzt → **sofort beenden**, Ein-Zeilen-Notiz in `STATE.md`.
6. Keine aktionierbaren Items in `STATE.md`/Watch-List → **in < 5k Tokens beenden**.

## Ende des Runs
Ein JSON-Objekt an `loop-run-log.md` anhängen:

```json
{
  "run_id": "<ISO8601>",
  "pattern": "pr-babysitter | daily-triage | ralph",
  "duration_s": 0,
  "items_found": 0,
  "actions_taken": 0,
  "escalations": 0,
  "tokens_estimate": 0,
  "outcome": "no-op | report-only | fix-proposed | escalated"
}
```

## Regeln
- Nie `Max Sub-Agenten/Run` aus `loop-budget.md` überschreiten.
- Hochfrequente Patterns (PR Babysitter) MÜSSEN early-exiten, wenn nichts aktionierbar ist.
- Bei Selbst-Drosselung eine Zeile unter „Alerts This Period" in `loop-budget.md` anhängen.
