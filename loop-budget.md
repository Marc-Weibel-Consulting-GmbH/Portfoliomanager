# Loop Budget — Portfoliomanager

> Token-/Run-Caps für die Loops, die dieses Repo pflegen. Der `loop-budget`-Skill liest
> diese Datei zu Beginn jeder Iteration und erzwingt Early-Exit / Report-only.

## Tageslimits

| Loop            | Max Runs/Tag | Max Tokens/Tag | Max Sub-Agenten/Run |
|-----------------|--------------|----------------|---------------------|
| PR Babysitter   | 96 (alle 10–15 m aktive Zeit) | 2M | 2 (Maker + Verifier) |
| Daily Triage    | 1            | 100k           | 0 (L1, Report-only) |
| Ralph           | nach Bedarf  | 500k           | 1                    |

**Early-Exit-Pflicht:** PR Babysitter muss bei leerer Watch-List in < 5k Tokens beenden
(keine Sub-Agenten spawnen). Hohe Kadenz ohne Early-Exit verbrennt Budget.

## Bei Cap-Überschreitung
1. Scheduler/hochfrequente Loops pausieren.
2. Ereignis in `loop-run-log.md` anhängen.
3. Maintainer informieren (Eintrag unter „Alerts This Period").

## Kill-Switch
- Label: `loop-pause-all` — oder Flag in `STATE.md`.
- Fortsetzen erst, wenn in `STATE.md` freigegeben.

## Alerts This Period
—
