# Dashboard Handoff Package (Sub-Paket)

> **Hinweis (27.05.2026):** Dieses Paket ist der **erste, isolierte Schritt** und enthält nur das Dashboard. Es wurde in einen **größeren IA-Konsolidierungs-Plan** eingebettet — siehe **[HANDOFF.md](./HANDOFF.md)**.
>
> Wenn du Manus bist: **starte mit [HANDOFF.md](./HANDOFF.md)**, nicht hier. Dieses README beschreibt nur das Dashboard-Drop-in-Paket, das in PR 02 / 03 zum Einsatz kommt.

Drop-in replacement for `client/src/pages/Dashboard.tsx` and a stack of dashboard-only components. Designed to plug into the existing Portfoliomanager codebase (React 19 + Tailwind 4 + shadcn/Radix + tRPC + recharts + lucide-react).

---

## Was hier drin ist

```
handoff/
├── README.md                                              ← du bist hier
├── client/src/pages/Dashboard.tsx                          ← ersetzt das bestehende Dashboard.tsx
├── client/src/components/dashboard/
│   ├── DashboardHeader.tsx
│   ├── KpiRow.tsx
│   ├── PerformanceChart.tsx        ← recharts AreaChart
│   ├── RiskBubbleCard.tsx
│   ├── AllocationCard.tsx          ← recharts PieChart (Sektoren)
│   ├── RegionCard.tsx
│   ├── CopilotInsights.tsx
│   ├── PositionsView.tsx           ← Tabs: Tabelle / Heatmap / Konstellation
│   ├── PositionsTreemap.tsx        ← custom SVG (recharts hat zwar Treemap, aber nicht flexibel genug)
│   ├── PositionsConstellation.tsx  ← custom SVG (gepackte Kreise)
│   ├── Sparkline.tsx               ← custom SVG (klein, leicht)
│   ├── Gauge.tsx                   ← custom SVG (LPPL-Bubble)
│   ├── types.ts                    ← alle shared Types
│   ├── format.ts                   ← formatCHF, formatPct
│   ├── mockData.ts                 ← Demo-Daten — solange tRPC-Endpunkte fehlen
│   └── useDashboardData.ts         ← zentraler Daten-Hook, ein einziger Schnittpunkt zur Backend-Migration
└── server/routers/dashboardRouter.additions.ts            ← neue Endpunkte (Spec + Skelett)
```

---

## Migration in 4 Schritten

### Schritt 1 — Dateien kopieren

Kopiere den Inhalt von `handoff/client/` direkt in dein `client/` und `handoff/server/` in dein `server/`. Existierende Pfade:

- `client/src/pages/Dashboard.tsx` (überschreiben — die neue Datei ist self-contained und braucht den `UserDashboard.tsx`-Wrapper nicht mehr)
- `client/src/components/dashboard/` (neuer Ordner)
- `server/routers/dashboardRouter.additions.ts` (separat lassen, dann gem. Schritt 3 in `dashboardRouter.ts` mergen)

Die alte `UserDashboard.tsx` kann nach erfolgreichem Test gelöscht werden.

### Schritt 2 — Dependencies prüfen

Alle in `package.json` schon vorhanden (✓):

```
react, react-dom, @trpc/react-query, recharts, lucide-react,
@radix-ui/react-tabs, @radix-ui/react-switch
```

shadcn-Primitive die verwendet werden: `Card`, `CardContent`, `CardHeader`, `CardTitle`, `Button`, `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`, `Badge`, `Switch`, `Label` — alle bereits in `client/src/components/ui/*`.

### Schritt 3 — tRPC-Endpunkte ergänzen

Aktueller Stand des `dashboardRouter` (`server/routers/dashboardRouter.ts`):

| Endpunkt | Was liefert er | Status |
|---|---|---|
| `dashboard.getAggregatedMetrics` | totalValue, totalPerformancePercent (YTD), totalDividends, benchmarkPerformance, portfolioCount | ✅ existiert — wird direkt genutzt |
| `dashboard.getTopPortfolios` | Liste der Portfolios mit YTD-Performance | ✅ existiert — für den Scope-Selector |

Neue Endpunkte (alle in `server/routers/dashboardRouter.additions.ts` als Skelett):

| Endpunkt | Was er liefern muss | Hinweis |
|---|---|---|
| `dashboard.getPerformanceTimeseries` | Labels + Portfolio/SMI/MSCI-Serien für gewählten Zeitraum | nutzt evtl. Logik aus `dashboardPerformanceRouter` oder `portfolioPerformanceRouter` |
| `dashboard.getAggregatedHoldings` | Flache Liste aller Positionen über alle Live-Portfolios, mit Sektor, Region, YTD%, Tagesveränderung | join `portfolios.portfolioData` × `stocks` |
| `dashboard.getSectorAllocation` | Sektoren mit gewichtetem YTD% | aus Aggregated Holdings ableiten |
| `dashboard.getRegionAllocation` | Regionen-Aufteilung | aus Aggregated Holdings ableiten |
| `dashboard.getRiskMetrics` | Volatilität, Max Drawdown, VaR95, Sharpe, Beta, Konzentration Top 3 | nutzt evtl. Logik aus `performanceCalculations.ts` |
| `dashboard.getBubbleIndicator` | LPPL-Score + 8-Wochen-Verlauf | nutzt vorhandene Logik aus `marketRegimeRouter` / `LiveLpplCheck` |
| `dashboard.getCopilotInsights` | 3-5 priorisierte Insights für Dashboard-Card | nutzt vorhandene Logik aus `copilotRouter` oder `aiInsightsRouter` |

### Schritt 4 — Mock-Fallback entfernen

Solange Endpunkte noch nicht da sind, fällt `useDashboardData.ts` für jeden fehlenden Endpunkt auf `mockData.ts` zurück. Wenn alle Endpunkte live sind:

1. `mockData.ts` löschen
2. In `useDashboardData.ts` die `?? MOCK_*`-Fallbacks entfernen
3. Loading-States feinjustieren

---

## Designentscheidungen

- **Farben:** Bleiben am bestehenden Schema (`#0a0f1a` bg, `#0f1420` card, `#00CFC1` accent). Die Tailwind-Klassen-Pattern matchen `UserDashboard.tsx` 1:1.
- **Charts:** recharts für Line/Area/Pie (deklarativ, animiert, bereits in deps). Custom SVG für Gauge, Treemap und Konstellation — recharts' Treemap ist zu unflexibel für die OKLCH-Farb-Heat und die packed-circles gibt's gar nicht.
- **State:** Scope (Aggregiert vs. Einzel-Portfolio) und Zeitraum sind lokaler State im `Dashboard.tsx`. Alles andere kommt aus tRPC-Queries.
- **Typing:** Alle API-Responses haben TS-Interfaces in `types.ts` — die Server-Endpunkte müssen exakt dieses Shape zurückgeben.
- **Performance:** Die Queries werden parallel gefeuert (React Query macht das von selbst). Skeleton-Loading via shadcn `Skeleton` an jeder Card.

---

## Testing

Wenn dein Test-Setup aus `server/__tests__/*` weiter genutzt werden soll: für jeden neuen Endpunkt eine Test-Datei `server/__tests__/dashboardRouter-extended.test.ts` anlegen, Pattern siehe `dashboardRouter`-bezogene Tests im Repo.

Browser-Smoke-Test: nach Migration `/dashboard` aufrufen, alle 6 KPI-Cards müssen Werte zeigen, der Performance-Chart muss 3 Linien rendern, der Positionen-Toggle muss alle 3 Views liefern.

---

## Fragen / Probleme

Wenn ein neuer Endpunkt komplizierter wird als gedacht (vor allem `getRiskMetrics` und `getBubbleIndicator`): zuerst die existierenden Router (`performanceRouter`, `marketRegimeRouter`, `copilotRouter`) auf wiederverwendbare Helfer durchsuchen — die Risikomathematik existiert größtenteils schon im Codebase, sie ist nur noch nicht für Dashboard-Aggregation kombiniert.
