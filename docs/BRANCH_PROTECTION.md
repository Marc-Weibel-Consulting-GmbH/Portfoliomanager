# Branch-Schutz für `main`

Anlass: Am 26.07.2026 landete Commit `2d0eb39` direkt auf `main` und machte den
Typecheck kaputt (`CollapsibleVerdictBlock` verwendet, aber nie definiert).
Da die App von `main` auto-deployt, war damit auch der Produktionsbuild
betroffen; zusätzlich wurde jeder offene Pull Request rot, weil die CI beim
`pull_request`-Event den **Merge mit `main`** prüft, nicht den Branch-Head allein.

Die CI lief dabei korrekt und meldete den Fehler auch beim Push auf `main`
(`.github/workflows/ci.yml` triggert auf `push: branches: [main]`). Sie
**blockiert** einen direkten Push aber nicht — erforderliche Statuschecks
greifen bei GitHub nur beim Mergen über einen Pull Request.

## Der Zielkonflikt

Auf `main` schreibt nicht nur dieses Repo-Team. Commit `2d0eb39` stammt vom
Autor **«Manus»** — der Hosting-Plattform, die den Checkpoint-Stand automatisch
zurückschreibt. Ein harter Schutz («Require a pull request before merging»)
blockiert genau diese Pushes und legt damit den Manus-Workflow lahm.

Vor dem Aktivieren ist deshalb zu klären, ob Manus weiterhin direkt schreiben
können muss.

## Optionen

### A — Voller Schutz, Manus auf PR umstellen

`Settings › Branches › Add branch protection rule` für `main`:

- ☑ Require a pull request before merging
- ☑ Require status checks to pass before merging
  - erforderlich: `check-and-test`, `lint`
- ☑ Require branches to be up to date before merging
- ☑ Do not allow bypassing the above settings

Konsequenz: Niemand schreibt mehr direkt auf `main`, auch Manus nicht. Sauberste
Variante, erfordert aber, dass der Manus-Stand künftig über Pull Requests
zurückfliesst — sonst gehen dessen Änderungen verloren.

### B — Schutz mit Ausnahme für Manus

Wie A, aber unter `Bypass list` den Manus-App/-Account eintragen.

Konsequenz: Menschen und Agenten sind gegated, Manus nicht. Der konkrete Vorfall
vom 26.07. **wäre damit nicht verhindert worden** — er kam von Manus. Schützt
also nur gegen die Hälfte der Fälle.

### C — Kein Schutz, dafür Alarm bei rotem `main`

Statt zu blockieren, den bestehenden `push`-Trigger nutzen und bei Fehlschlag
aktiv benachrichtigen (GitHub-Watch auf Actions-Fehler, oder ein Notify-Step im
Workflow). Verhindert nichts, verkürzt aber die Zeit bis zur Entdeckung —
im aktuellen Fall lag der rote Stand mehrere Stunden unbemerkt.

## Empfehlung

**A**, sofern der Manus-Rückfluss auf Pull Requests umgestellt werden kann —
nur dann ist `main` wirklich geschützt. Andernfalls **C**, weil B den
tatsächlich aufgetretenen Fehlerfall nicht abdeckt und dafür die eigenen
Änderungswege verkompliziert.

Die Einstellung selbst erfordert Admin-Rechte am Repository und lässt sich
nicht aus einer Agenten-Session heraus setzen.
