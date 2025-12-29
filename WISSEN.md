# Wichtiges Projekt-Wissen

## Portfolio Builder Routen - KRITISCH!

**ACHTUNG:** Es gibt ZWEI verschiedene Portfolio Builder:

### ❌ ALTER Portfolio Builder (NICHT VERWENDEN)
- Route: `/portfolio-builder/wizard`
- Komponente: `PortfolioBuilderWizard`
- Status: **VERALTET - NICHT MEHR VERWENDEN**

### ✅ NEUER Portfolio Builder (VERWENDEN)
- Route: `/portfolio-builder/new`
- Komponente: `PortfolioBuilderNew`
- Status: **AKTUELL - IMMER DIESEN VERWENDEN**

### Zwischenseite (ÜBERSPRINGEN)
- Route: `/portfolio-builder`
- Komponente: `PortfolioBuilderLanding`
- Status: **Soll übersprungen werden - direkt zu /new**

## Regel für "Neues Portfolio" Buttons

**ALLE "Neues Portfolio" Buttons müssen direkt zu `/portfolio-builder/new` führen!**

Betroffene Dateien:
- `client/src/pages/UserDashboard.tsx`
- `client/src/pages/Portfolios.tsx`
- `client/src/components/PortfolioDashboard.tsx`
- Alle anderen Stellen mit "Neues Portfolio" Buttons

## Navigation Struktur

```
Dashboard
├── Portfolios (einklappbares Submenu)
│   ├── Portfolio 1
│   ├── Portfolio 2
│   └── ...
├── Live-Tracking
├── Analyse
└── ...
```

## Letzte Änderungen (29.12.2025)

- [x] Submenu in DashboardLayout einklappbar gemacht (ChevronDown Icon)
- [ ] Alle "Neues Portfolio" Buttons auf `/portfolio-builder/new` umstellen (IN ARBEIT)
