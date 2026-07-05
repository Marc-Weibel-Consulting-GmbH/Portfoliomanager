# Loop Run Log — Portfoliomanager

Append one entry per loop run. Prune entries older than 30 days.

## Format

```json
{
  "run_id": "2026-07-04T21:00:00Z",
  "pattern": "pr-babysitter | daily-triage | ralph",
  "duration_s": 45,
  "items_found": 4,
  "actions_taken": 1,
  "escalations": 0,
  "tokens_estimate": 52000,
  "outcome": "no-op | report-only | fix-proposed | escalated"
}
```

## Recent Runs

<!-- Loop hängt unterhalb dieser Zeile an -->
```json
{
  "run_id": "2026-07-05T06:36:00Z",
  "pattern": "daily-triage",
  "duration_s": 60,
  "items_found": 2,
  "actions_taken": 0,
  "escalations": 1,
  "tokens_estimate": 45000,
  "outcome": "report-only"
}
```
