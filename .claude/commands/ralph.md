---
description: Ralph-Loop — eine Iteration: nächste offene Aufgabe gegen das Mockup umsetzen, live verifizieren, committen
allowed-tools: Read, Edit, Write, Glob, Grep, Bash, mcp__playwright__browser_navigate, mcp__playwright__browser_snapshot, mcp__playwright__browser_take_screenshot, mcp__playwright__browser_click, mcp__playwright__browser_type, mcp__playwright__browser_console_messages, mcp__playwright__browser_wait_for, AskUserQuestion
---

# Ralph-Loop — eine Iteration

Du bist eine Iteration eines autonomen "Ralph"-Loops, der den Portfoliomanager so umbaut, dass er
**pixel- und funktionsgenau** den Mockups entspricht: jede Seite sieht aus wie im Design, **alle
Buttons/Tabs/Filter funktionieren**, und **alle Zahlen/Berechnungen sind inhaltlich und logisch
korrekt** und kommen aus echten Endpoints (keine Mock-Daten).

Arbeite **genau eine Teilaufgabe** pro Lauf ab — klein, vollständig, verifiziert, grün. Lieber ein
sauber abgeschlossener Schritt als drei halbe.

## Referenzen (immer zuerst lesen)
- `design/RALPH_PROGRESS.md` — der Backlog & die Reihenfolge. **Hier steht, was als Nächstes dran ist.**
- `design/mockups/INDEX.md` + die Seite `design/mockups/page-NN.jpg` zur aktuellen Aufgabe (visuelle Ground-Truth).
- `design/handoff/03-Screens.md` — Per-Screen-Spec (Tabs, tRPC-Endpoints, Akzeptanzkriterien).
- `design/handoff/02-IA-Routes.md` — Routen-Mapping & Redirects.
- `design/handoff/04-Migration-Plan.md` — Scope & Test-Schritte je PR.
- `design/handoff/05-Open-Questions.md` — 🔴-Blocker: **nicht raten**, bei Marc nachfragen.

## Ablauf

1. **Aufgabe wählen.** Lies `design/RALPH_PROGRESS.md`. Nimm die **erste nicht abgehakte Checkbox von
   oben** (Reihenfolge 01 → 02 → 03 → 05 → 06 → 04 → 07 → 08). Hängt an ihr eine 🔴-Open-Question, die
   noch offen ist → **stop**: stelle Marc die Frage via `AskUserQuestion`, trage die Antwort in
   `05-Open-Questions.md` ein und beende den Lauf (keine Code-Änderung ohne Antwort). Markiere die
   gewählte Aufgabe im Backlog als `[~]`.

2. **Verstehen.** Lies das zugehörige Mockup-Bild und den Spec-Abschnitt. Lies die betroffenen
   Quellcode-Dateien. Halte dich an die Markenvorgaben: BG `#0a0f1a`, Card `#0f1420`, Akzent `#00CFC1`,
   Tailwind + shadcn/Radix + recharts + lucide-react. **Kein Marken-Redesign, keine neuen Features** —
   nur Konsolidierung/Umsetzung gemäß Mockup.

3. **Umsetzen.** Bestehende Logik wiederverwenden statt neu erfinden — die Berechnungen existieren meist
   schon (`server/.../performanceCalculations.ts`, `marketRegimeRouter`, `copilotRouter`, …). Wenn ein
   tRPC-Endpoint fehlt, baue ihn (Shape exakt wie in `handoff/.../types.ts`) statt Mock-Daten zu lassen.

4. **Verifizieren — alle Gates müssen grün sein (Definition of Done in `RALPH_PROGRESS.md`):**
   - **Build:** `bash scripts/ralph-verify.sh check` (führt bei Bedarf `pnpm install` aus, dann
     `pnpm check` (tsc) und `pnpm test`). Keine neuen Fehler.
   - **Live/Optik/Funktion:** Dev-Server starten via `bash scripts/ralph-verify.sh serve` (startet
     `pnpm dev` im Hintergrund, default Port aus `.env`/`PORT`, meist `http://localhost:3000`). Dann mit
     Playwright die Ziel-Route öffnen (`mcp__playwright__browser_navigate`), `browser_snapshot` +
     `browser_take_screenshot` machen und **Seite-an-Seite mit dem Mockup** vergleichen. Jeden
     Button/Tab/Filter aus dem Mockup **anklicken** und prüfen, dass etwas Sinnvolles passiert.
     `browser_console_messages` prüfen → **keine** Errors.
   - **Korrektheit:** Zahlen gegen die Server-Logik/Referenz prüfen (z. B. YTD, Sharpe, DCF). Wenn unklar,
     wie eine Kennzahl berechnet wird, lies den Router/Helper und rechne 1 Beispiel nach.
   - Läuft der Dev-Server in dieser Umgebung nicht (fehlende `DATABASE_URL`/Secrets), notiere das im Log,
     verifiziere so weit wie möglich statisch (tsc/test + Code-Review gegen Mockup) und markiere die
     Live-Verifikation als „ausstehend (kein Backend)" — **nicht** als erledigt vortäuschen.

5. **Abhaken & loggen.** Setze in `design/RALPH_PROGRESS.md` die erfüllten Checkboxen auf `[x]` (oder
   `[!]` mit Grund). Trage oben im **Iterations-Log** einen Eintrag ein: Datum/Zeit, PR + Teilaufgabe,
   was gemacht, Verifikations-Befund (tsc/test + Playwright + welcher Screenshot), und offene Punkte.

6. **Committen & pushen.** Auf den aktuellen Feature-Branch. Commit-Message aussagekräftig, z. B.
   `ralph: PR01 Sidebar auf 6 Top-Level-Einträge (Mockup S.01)`. Dann
   `git push -u origin <branch>` (bei Netzwerkfehler bis zu 4× mit Backoff). Existiert
   noch kein PR für den Branch, lege einen **Draft-PR** an.

7. **Deploy + Live-Nachtest.** PR auf `main` **mergen** (`mcp__github__merge_pull_request`), dann den
   manus.space-Deploy **pollen**, bis der neue Stand live ist (z. B. ein neu gebauter Endpoint liefert 200
   statt 404, oder eine korrigierte KPI zeigt den echten Wert) — per Playwright/`context.request`.
   Anschliessend die umgesetzte Route **live** öffnen, Screenshot gegen das Mockup, Buttons/Tabs klicken,
   Konsole prüfen, Zahlen plausibilisieren. Erst dann ist die Live-Verifikation erbracht.
   - ⚠️ Repo hat **keine** Deploy-Pipeline (kein `.github/workflows`). Ob ein `main`-Merge den Live-Deploy
     auslöst, **empirisch nach dem Merge prüfen**. Übernimmt der Deploy nicht automatisch → externer
     (Manus-)Deploy nötig; im Log vermerken und **keinen** Live-Haken vortäuschen.

## Regeln
- **Eine Teilaufgabe pro Lauf.** Nach dem Commit ist der Lauf fertig — der Loop ruft dich erneut auf.
- **Niemals einen grünen Haken setzen, der nicht wirklich verifiziert ist.** Im Zweifel `[!]` + Grund.
- **Bei Mehrdeutigkeit oder 🔴-Frage:** `AskUserQuestion`, nicht raten.
- **`/dashboard` muss nach jedem Lauf lauffähig bleiben** (globaler Smoke-Test).
- Wenn **alle** Aufgaben im Backlog `[x]` sind: melde „Ralph-Loop fertig — alle PRs umgesetzt & verifiziert"
  und schlage einen finalen Gesamt-Smoke-Test vor.
