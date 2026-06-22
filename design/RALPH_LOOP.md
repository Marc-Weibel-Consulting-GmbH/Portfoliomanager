# Ralph-Loop für den Portfoliomanager

Ein "Ralph-Loop" ist ein autonomer Agent, der **dieselbe Aufgabe in einer Schleife** immer wieder
abarbeitet, bis sie fertig ist — hier: die App Schritt für Schritt an die Mockups angleichen, jede
Seite funktionsfähig machen und jede Berechnung verifizieren. Statt eines fragilen Mega-Prompts wird
der Fortschritt in einer Datei festgehalten; jeder Durchlauf nimmt sich die nächste offene Aufgabe.

## Bestandteile

| Datei | Rolle |
|---|---|
| `design/RALPH_PROGRESS.md` | **Backlog & Gedächtnis** des Loops. Reihenfolge, Akzeptanzkriterien, Iterations-Log. |
| `design/mockups/` | **Visuelle Ground-Truth** (`page-01..20.jpg`, `INDEX.md`, Quell-PDF). |
| `design/handoff/` | **Detail-Specs**: Audit, IA/Routen, Per-Screen-Spec, 8-PR-Migrationsplan, offene Fragen, Dashboard-Drop-in-Code. |
| `.claude/commands/ralph.md` | **Eine Iteration** des Loops (Slash-Command `/ralph`). |
| `scripts/ralph-verify.sh` | Helfer: `check` (tsc+tests), `serve`/`stop` (Dev-Server für Playwright). |

## Eine Iteration (`/ralph`) macht

1. Nächste offene Aufgabe aus `RALPH_PROGRESS.md` wählen (Reihenfolge 01→02→03→05→06→04→07→08).
2. Mockup-Bild + Spec + betroffenen Code lesen.
3. Umsetzen (bestehende Logik wiederverwenden, keine Mock-Daten zurücklassen).
4. **Verifizieren:** `pnpm check` + `pnpm test`, Dev-Server starten, mit **Playwright** die Route öffnen,
   Screenshot gegen Mockup vergleichen, Buttons/Tabs klicken, Konsole prüfen, Zahlen plausibilisieren.
5. Kriterien in `RALPH_PROGRESS.md` abhaken + Log-Eintrag.
6. Commit + Push auf `claude/festive-newton-49pqw4`; Draft-PR anlegen, falls noch keiner existiert.

## Loop starten

**Manuell, ein Schritt:**
```
/ralph
```

**Automatisch wiederkehrend** (über die `loop`-Skill — alle 15 Min eine Iteration):
```
/loop 15m /ralph
```
Der Loop läuft, bis alle Aufgaben in `RALPH_PROGRESS.md` `[x]` sind oder du ihn stoppst.

## Voraussetzungen für die Live-Verifikation
- `node_modules` (das Script macht bei Bedarf `pnpm install`).
- Eine `.env` mit `DATABASE_URL`, `JWT_SECRET` etc. (Vorlage: `.env.example`). **Ohne Backend** kann der
  Loop nur statisch verifizieren (tsc/tests + Code-Review gegen Mockup) und markiert die
  Live-Verifikation als „ausstehend" — er täuscht keinen grünen Haken vor.
- Playwright-MCP aktiv (für Browser-Verifikation).

## Leitplanken
- **Eine Teilaufgabe pro Lauf**, klein und vollständig.
- **Kein Marken-Redesign, keine neuen Features** — nur Konsolidierung gemäß Mockup (siehe „Nicht-Ziele" in `handoff/HANDOFF.md`).
- **🔴-Fragen** aus `handoff/05-Open-Questions.md` werden mit Marc geklärt, nicht geraten.
- **`/dashboard` bleibt nach jedem Lauf lauffähig.**
