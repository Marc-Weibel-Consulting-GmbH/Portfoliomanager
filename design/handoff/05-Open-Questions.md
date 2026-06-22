# 05 · Offene Fragen — vor der Migration mit Marc klären

Diese Fragen kann/soll Manus **nicht** alleine entscheiden. Bitte sammeln und Marc beantworten lassen, **bevor** die jeweilige PR startet.

Status-Legende:
- 🔴 **blockiert** — entsprechende PR kann ohne Antwort nicht starten
- 🟡 **wünschenswert** — Antwort hilft, ist aber nicht zwingend
- 🟢 **Detail** — kann später noch entschieden werden

---

## Architektur & Routing

| Status | Frage | Kontext |
|---|---|---|
| 🔴 | Soll `Home.tsx` (210 KB) **komplett** weg, oder gibt es darin Features, die im neuen `/dashboard` fehlen würden? | PR 03. Manus macht vor dem Löschen ein File-Audit und listet hier alle nicht-redundanten Features auf. |
| 🟡 | URL-Schema für Tabs: `?tab=positionen` (Empfehlung) vs. `/positionen` als nested Route? | Empfehlung in `02-IA-Routes.md`. Marc bestätigt? |
| 🟡 | Sollen wir die Sidebar-Gruppen **flach** machen (6 Items, jeder direkt) oder **2 Gruppen** behalten (z.B. „Anlegen" / „Lernen")? | Prototyp ist flach. Falls Marc die Gruppierung mag, holen wir sie zurück — aber bitte nicht 5 Gruppen wie heute. |

## Onboarding

| Status | Frage | Kontext |
|---|---|---|
| 🔴 | Soll der `InvestorTypeTest` **Pflicht** im Onboarding sein oder optional? | PR 08. Pflicht = einfacher Personalisierung-Logik, könnte aber Conversion senken. |
| 🟡 | Wann tritt der `PremiumWizard` in Aktion? Vorschlag: nach dem 1. Insight im Copilot („Mehr KI-Analysen? Premium freischalten"). Marc OK damit? | Heute ist `/premium-wizard` eine eigene Route im Onboarding-Flow — das ist Anti-Konversion. |
| 🟢 | App-Tour: nach Onboarding-Done **automatisch** anbieten oder nur „Tour starten"-Button in Settings? | Prototyp zeigt es als optionalen Step. |

## Portfolio-Builder

| Status | Frage | Kontext |
|---|---|---|
| 🔴 | Sollen die 3 Pfade (Vorlage / Manuell / Import) **alle Day-1** funktionieren, oder darf z.B. „Import" auf einen Follow-up verschoben werden? | PR 07. Wenn ja: Step 0 zeigt „Import (Bald verfügbar)" Karte. |
| 🟡 | Risiko-Profil aus Onboarding ↔ Vorlagen-Auswahl im Builder: soll das verknüpft sein (Risiko-Profil → vorgefilterte Vorlagen)? | UX-Idee, kein Muss. |
| 🟢 | Builder-Wizard: nach Bestätigen direkt zur Detail-Page (`/portfolios/:id`) oder zurück zur Übersicht? | Vorschlag: Detail-Page mit `?onboarding=success`-Toast „Portfolio erstellt 🎉". |

## Aktien-Detail

| Status | Frage | Kontext |
|---|---|---|
| 🔴 | Welcher der zwei Detail-Pages ist die „bessere" — `StockDetail.tsx` oder `InvestDetail.tsx` (23 KB)? Manus soll vor dem Konsolidieren beide vergleichen und Marc empfehlen. | PR 04. Falls beide Inhalte einzigartig sind: in Tab Übersicht beide kombinieren. |
| 🟡 | Tab „News" pro Aktie — kommt News aus `newsRouter.byTicker` (eigene Endpoint) oder filtern wir die globale News-Liste client-seitig nach Ticker? | Performance-Trade-off, Marc oder Backend-Owner entscheiden. |
| 🟢 | „Kaufen"-Button im Aktien-Detail — soll der Modal **immer** Portfolio-Picker zeigen, oder bei nur einem Portfolio automatisch dieses wählen? | Vorschlag: Picker nur wenn ≥ 2 Live-Portfolios existieren. |

## Markt-Hub

| Status | Frage | Kontext |
|---|---|---|
| 🟡 | `Newsroom.tsx` (Public, SEO) bleibt als eigene Route. Im `/markt`-Tab „News" konsumieren wir dieselben Endpoints — ist das DRY genug oder soll der News-Inhalt extrahiert werden in eine geteilte Komponente? | PR 05. Vorschlag: gleicher `NewsList.tsx` in `components/news/`, wird von beiden Pages benutzt. |
| 🟢 | Dividenden-Tab: nur eigene Positionen (Vorschlag) oder optional alle SMI/DAX-Werte mit Toggle? | Mehrwert für Marc als Kunden ist klar bei „eigene Positionen". |

## Copilot

| Status | Frage | Kontext |
|---|---|---|
| 🔴 | Es existieren **2 Router** für KI-Interaktion: `copilotRouter.ts` (37 KB!) und `chatRouter.ts` (10 KB). Ist einer der beiden veraltet, oder haben sie unterschiedliche Verantwortlichkeiten? | PR 06. Manus untersucht und schreibt hier Antwort rein. Falls beide aktiv: gemeinsame Schnittstelle definieren. |
| 🟡 | Floating-Chat-Button soll überall sichtbar sein (`/dashboard`, `/portfolios/:id`, etc.) — auch im Onboarding-Wizard? | Heute: ja, überall. Vorschlag: im Onboarding-Wizard ausblenden (Fokus). |
| 🟢 | Insights-Tab: Sortier-Reihenfolge (heute: nach Severity, dann Zeit) — Marc OK? | Alternativ: nach Severity, dann „Letztes mal angeschaut" filtern. |

## Admin / Dev-Routen

| Status | Frage | Kontext |
|---|---|---|
| 🟡 | `Admin.tsx` (8 KB) vs. `AdminDashboard.tsx` (3 KB) — beide sind „Admin-Hub". Welche bleibt? | PR-irrelevant (Audit), aber für die Reihenfolge des Löschens wichtig. |
| 🟡 | `AdminSecrets.tsx` (10 KB) vs. `AdminSecretsManagement.tsx` (2 KB, Wrapper) — auch hier doppelt. Welche? | Vermutlich Wrapper behalten, Inhalt aus dem großen File extrahieren. |
| 🟢 | `ComponentShowcase.tsx` (56 KB) — wirklich nur in dev-build? Oder Marc nutzt es als Style-Guide? | Falls ja: dann eigene `/style-guide`-Route mit Login-Gate. |

## Datenfluss / Backend

| Status | Frage | Kontext |
|---|---|---|
| 🔴 | Die neuen Endpoints im ersten Dashboard-Handoff (siehe `handoff/README.md` Schritt 3, z.B. `dashboard.getAggregatedHoldings`) — wer baut die? Manus oder ein anderer Agent / Marc selbst? | Blocking für Dashboard-Funktionsfähigkeit ohne Mocks. |
| 🟡 | tRPC-Queries: Wenn Marc beim Tab-Wechsel ein leeres Loading-State sieht, ist das ok? Oder sollen wir vor dem ersten Klick auf Tab schon prefetchen? | Performance vs. „instant feel". React Query handhabt das ggf. mit `staleTime`. |
| 🟢 | Soll `dashboard.getCopilotInsights` echte Calls an Claude/OpenAI machen oder cached aus der DB lesen? | Cost-Frage, Marc / Backend-Owner. |

## Design / Visuals

| Status | Frage | Kontext |
|---|---|---|
| 🟡 | Akzentfarbe `#00CFC1` (Teal) bleibt? Oder gibt's einen Brand-Refresh in Planung? | Wenn Refresh kommt: lieber **nach** der IA-Konsolidierung. |
| 🟢 | Donut, Heatmap, Konstellation — alle drei sollen erhalten bleiben? Konstellation ist explorativ; falls niemand sie nutzt, kann sie weg. | Analytics-Check (welche Toggle-Option wird wie oft geklickt) hilft hier. |
| 🟢 | Mobile (< 768 px): Tab-Switcher als horizontaler Scroll oder als Dropdown? | Tabs ≥ 6 brauchen auf 375 px Scrolling. Dropdown wäre kompakter, aber weniger sichtbar. |

---

## Wie Manus die Antworten reinholt

Vor dem Start jeder PR:
1. Diese Datei auf relevante 🔴-Fragen prüfen
2. Falls offen: kurze Slack/Mail-Nachricht an Marc mit der Frage in einem Satz
3. Antwort hier reintragen unter „Antwort: …"
4. Erst dann PR starten

Beispiel-Format für eine geklärte Frage:

> ~🔴 Soll `Home.tsx` (210 KB) komplett weg…~
>
> **Antwort (Marc, 28.05.):** Ja, komplett weg. Falls darin Features sind, die im Dashboard fehlen → in `05-Open-Questions.md` als Feature-Request notieren, separat priorisieren. Migration nicht blockieren.
