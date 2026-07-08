# Konzept — Konsolidierter Bereich «Optimierung & Empfehlungen»

> **Status:** Entwurf zur Abstimmung (kein Code). Umsetzung erst nach Freigabe, in Stufen (F1–F4).
> **Kontext:** Auftraggeber-Vorgabe (Punkt 7). Setzt auf der bestehenden KI-Alpha-Architektur auf
> (siehe `design/AI_ALPHA_ROADMAP.md`).

## 1. Ziel

Die zwei getrennten Portfolio-Subtabs **«Optimieren KI»** und **«Empfehlungen KI»** werden zu **einem**
Bereich **«Optimierung & Empfehlungen»** zusammengeführt. Dieser berücksichtigt durchgängig:

- die **Scores** (Qualität + Signal, bereits vorhanden),
- **Diversifikationsregeln** (neu **admin-konfigurierbar** statt hartkodiert),
- das **Risikoprofil** und die **Anlageziele** des Nutzers (neu, in Einstellungen gepflegt).

Zusätzlich wird die **automatische Portfolio-Erstellung aus Empfehlungen** (bei Neuerstellung)
reaktiviert — **nur freigeschaltet, wenn Risikoprofil + Anlageziele gesetzt sind**.

## 2. Ausgangslage (bestehender Code)

| Baustein | Ort | Rolle heute |
|---|---|---|
| `OptimierenTab` | `client/src/components/portfolio/OptimierenTab.tsx` | Subtab «Optimieren»: ruft `optimizePortfolio`, zeigt **hartkodierte** `checkDiversificationRules(...)` |
| `EmpfehlungenTab` | `client/src/pages/PortfolioDetailsPage.tsx` | Subtab «Empfehlungen»: Kadenz (Track D) + Copilot-Analyse |
| `optimizePortfolio` | `server/analytics/engine.ts` | Mean-Variance mit Ledoit-Wolf-Kovarianz + Black-Litterman-µ, Bounds/Mindestgrösse |
| `blendCombinedScore` | `server/lib/signalBlend.ts` | Regime-Blend Qualität↔Signal |
| `getScoringWatchlist` | `server/routers/dashboardRouter.ts` | Empfehlungsliste (Kaufsignale) Momentum+Qualität+LPPL |
| `copilot.applyRebalancing` | `server/routers/copilotRouter.ts` | Zielgewichte → echte Transaktionen (Stückzahlen serverseitig) |
| `riskProfiles` | `client/src/pages/PortfolioBuilderWizard.tsx` | Risikoprofil-Vorlagen (nur im Builder, **nicht** persistiert) |
| `investmentGoal` | `drizzle/schema.ts` (users/onboarding) | Enum `dividends \| growth \| balanced` (teilweise vorhanden) |

**Lücken:** Diversifikationsregeln sind hartkodiert; Risikoprofil/Anlageziele werden nicht dauerhaft
gespeichert/gepflegt; Optimierung und Empfehlungen sind zwei getrennte Flächen; die Auto-Erstellung
aus Empfehlungen fehlt.

## 3. Anlageprofil (neuer Einstellungen-Tab + Persistenz)

### 3.1 Datenmodell — neue Tabelle `user_investment_profile`
Ein Datensatz pro Nutzer (1:1). Felder (Vorschlag):

- **Risikoprofil**
  - `riskProfile`: `konservativ | ausgewogen | wachstum | aggressiv`
  - `investmentHorizonYears`: int (z. B. 1–30)
  - `maxDrawdownTolerancePct`: int (z. B. 10/20/30/40)
- **Anlageziele**
  - `investmentGoal`: `dividends | growth | balanced` (bestehendes Enum wiederverwenden)
  - `targetReturnPct`: decimal, optional
  - `liquidityNeedPct`: int (Cash-Quote-Bedarf), optional
  - `excludedSectors`: json (Liste, z. B. `["Tobacco","Defense"]`)
  - `esgOnly`: bool
- `createdAt` / `updatedAt`

> Alternative: Felder an `users` anhängen. Empfehlung: **eigene Tabelle** (klar getrennt, erweiterbar,
> kein Aufblähen der Auth-Tabelle). `investmentGoal` bleibt kompatibel.

### 3.2 UI — neuer Tab «Anlageprofil» unter Einstellungen
- Formular mit den obigen Feldern, klare 50+-taugliche Beschriftungen + Kurzerklärungen.
- Speichern/Ändern jederzeit möglich.
- tRPC: `investmentProfile.get` / `investmentProfile.set` (protectedProcedure, ownership-sicher).

## 4. Diversifikationsregeln → Admin

Die heute in `OptimierenTab.checkDiversificationRules` hartkodierten Schwellen werden **admin-konfigurierbar**:

- Neue Tabelle `diversification_rules` (global, ein aktiver Regelsatz) bzw. Erweiterung des bestehenden
  Admin-Konfig-Musters (analog `regime_signal_config`). Parameter (Vorschlag):
  - `maxPositionWeightPct` (Einzelposition-Cap)
  - `maxSectorWeightPct` (Sektor-Cap)
  - `minPositions` / `maxPositions`
  - `minPositionChf` (Mindest-Positionsgrösse — heute CHF 3'000 in `optimizePortfolio`)
  - `maxCurrencyWeightPct`, optional
- Admin-UI: neuer Abschnitt (analog «Signal-Gewichtung»), mit fehlertoleranter Lese-/Schreiblogik
  (wie in #74 etabliert: bei fehlender Tabelle sauberes Fallback auf Defaults).
- **Nutzer:** `OptimierenTab` zeigt die Regeln weiterhin an, aber liest sie aus der Admin-Konfig
  (nicht mehr hartkodiert). Optimizer + Auto-Erstellung verwenden **denselben** Regelsatz.

## 5. Konsolidierter Bereich «Optimierung & Empfehlungen»

Ersetzt die zwei Subtabs durch **einen** Subtab mit zwei Modi:

1. **Empfehlungsliste (laufend)** — die wiederkehrenden Transaktions-Empfehlungen (Track D, Kadenz)
   + Ad-hoc-Analyse. Einzeln/gesamt übernehmbar (bestehend), optional Auto-Ausführung (bestehend).
2. **Vollständige (Neu-)Optimierung** — die heutige `optimizePortfolio`-Fläche für eine Rundum-Neuausrichtung.

**Gemeinsame Eingaben (der Kern des Konzepts):**

```
Zielgewichte / Empfehlungen = f(
    Scores        : blendCombinedScore(Qualität, Signal, Regime),
    Optimizer     : optimizePortfolio (Ledoit-Wolf + Black-Litterman),
    Constraints   : diversification_rules (Admin),
    Profil        : user_investment_profile (Risikoprofil + Ziele)
)
```

**Wie das Profil einfliesst (Vorschlag):**
- **Risikoprofil** → Zielvolatilität/Risikoaversion δ des Optimizers + Cash-Quote:
  konservativ → tiefere Zielvola, höhere Cash-Quote; aggressiv → umgekehrt.
- **Anlagehorizont** → Gewicht von Momentum/Signal vs. Qualität (kurz → mehr Signal, lang → mehr Qualität).
- **max. Drawdown-Toleranz** → härtere/lockerere Positions- und Sektor-Caps, LPPL-Malus-Sensitivität.
- **Anlageziel** `dividends|growth|balanced` → Titel-Präferenz (Dividendenrendite vs. Wachstum);
  knüpft an die bestehende `max_dividend`-Methode bzw. Score-Gewichtung an.
- **excludedSectors / esgOnly** → harte Ausschlussfilter vor der Optimierung.
- **liquidityNeed** → Mindest-Cash-Quote.

## 6. Automatische Portfolio-Erstellung aus Empfehlungen (Builder)

Im **Portfolio-Builder** neben «manuelle Auswahl» wieder die Option **«Automatisch durch KI erstellen»**:

- **Gating:** nur aktiv, wenn `user_investment_profile` (Risikoprofil **und** Anlageziele) gesetzt ist —
  sonst Hinweis + Link zum Anlageprofil-Tab.
- **Kandidaten:** aus der **Empfehlungsliste** (Kaufsignale / `getScoringWatchlist`, ggf. erweitert um
  Wikifolio-Konsens als eine Quelle — nicht alleinige Basis, gem. Vorgabe).
- **Zusammenstellung:** Kandidaten nach Scores ranken → unter Beachtung der **Diversifikationsregeln**
  (Admin) und des **Risikoprofils/Ziele** gewichten (via `optimizePortfolio`) → Zielportfolio.
- **Ergebnis:** Vorschlag mit Begründung; Nutzer bestätigt → Portfolio wird angelegt (Demo oder Live).

## 7. Umsetzung in Stufen (je eigener PR)

| Stufe | Inhalt | Abhängigkeit |
|---|---|---|
| **F1** | Tabelle `user_investment_profile` + tRPC `investmentProfile.get/set` + Einstellungen-Tab «Anlageprofil» | — |
| **F2** | Diversifikationsregeln → Admin (Tabelle + Admin-UI + fehlertolerante Lese-Logik); `OptimierenTab`/Optimizer lesen daraus | — |
| **F3** | Konsolidierter Subtab «Optimierung & Empfehlungen» (ersetzt beide Tabs); Profil + Regeln fliessen in Optimizer/Empfehlungen ein | F1, F2 |
| **F4** | Auto-Portfolio im Builder (gated auf Profil), Zusammenstellung aus Empfehlungen + Regeln + Profil | F1, F2, F3 |

Jede Stufe: `pnpm check` grün, Tests grün, Draft-PR, danach live prüfen.

## 8. Offene Entscheidungen (bitte bestätigen)

1. **Persistenz:** eigene Tabelle `user_investment_profile` (empfohlen) vs. Felder an `users`.
2. **Risikoprofil-Skala:** `konservativ/ausgewogen/wachstum/aggressiv` (4 Stufen) ok? Passend zu den
   bestehenden Builder-`riskProfiles`?
3. **Diversifikations-Parameter:** ist die Parameterliste (Abschnitt 4) vollständig, oder fehlen Regeln
   (z. B. Länder-/Währungs-Caps, Klumpenrisiko-Kennzahl)?
4. **Wikifolio** als eine Kandidatenquelle für die Auto-Erstellung mitnehmen — ja/nein?
5. **Reihenfolge:** F1 → F2 → F3 → F4 wie oben, oder andere Priorität?
