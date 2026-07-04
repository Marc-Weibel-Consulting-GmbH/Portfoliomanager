---
name: loop-triage
description: >
  Triage recent changes, CI failures, open PRs/issues and produce a concise,
  prioritized report written to STATE.md. Report-only (L1) — proposes, never acts.
user_invocable: true
---

# Loop Triage — Portfoliomanager (L1, Report-only)

Erzeuge eine saubere, priorisierte Liste dessen, was ein Loop erwägen sollte zu tun.
Zuerst den `loop-constraints`-Skill respektieren. **Keine Aktion, nur Signal.**

## Inputs (sammle vor dem Report)
- Letzte CI-/`pnpm check`-/`pnpm test`-Fehler (soweit sichtbar).
- Offene PRs/Issues (GitHub MCP), letzte `main`-Commits (24–48 h).
- Aktueller `STATE.md` (was der Loop schon weiss).
- Live-Hinweise: Konsolenfehler auf manus.space nach dem letzten Deploy.

## Report (nach `STATE.md` schreiben)
### 1. High-Priority (heute handeln)
- Ein-Zeilen-Beschreibung · Warum es zählt (Impact/Risiko/Kundenschmerz)
- Vorgeschlagene nächste Aktion (z. B. „minimalen Fix im isolierten Worktree")
- Grober Aufwand
### 2. Watch (beobachten, noch nicht handeln)
### 3. Noise/Ignore (angeschaut, nicht handeln)
### 4. State-Updates (Fakten für den nächsten Run)

## Regeln
- Brutal knapp. Nur „High-Priority", wenn ein vernünftiger Engineer es heute wissen wollte.
- Im Zweifel Watch/Noise statt Arbeit erzeugen.
- Keine Architektur-Umbauten in der Triage — dieser Skill ist Signal, nicht Erfindung.
- Projekt-Konventionen aus `CLAUDE.md` respektieren (CHF-Decimal, revDSG, Deploy-from-`main`).
