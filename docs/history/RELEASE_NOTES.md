# Release Notes - November 16, 2025

## 🎉 Neue Features

### 1. Demo-Portfolio für neue Benutzer
- **Automatische Erstellung** beim ersten Login über Onboarding-Tutorial
- **Schweizer Blue Chips**: Nestlé, Novartis, Roche, UBS, Zurich Insurance, ABB
- **Realistische Daten**: Optimiert nach Max. Sharpe Ratio Strategie
- **Duplikat-Schutz**: `hasDemoPortfolio` Flag verhindert mehrfache Erstellung
- **Backend-Endpoints**:
  - `trpc.onboarding.createDemoPortfolio` - Erstellt Demo-Portfolio
  - `trpc.onboarding.markOnboardingSeen` - Markiert Tutorial als gesehen

### 2. Interaktives Onboarding-Tutorial
- **5-Schritt Tutorial-Modal** für neue Benutzer
  - Schritt 1: Willkommen & Plattform-Überblick
  - Schritt 2: Portfolio-Optimizer erklärt (4 Strategien)
  - Schritt 3: Live-Tracking Features
  - Schritt 4: Transaktionsverwaltung
  - Schritt 5: Demo-Portfolio Angebot
- **Automatische Anzeige** beim ersten Login (basierend auf `user.hasSeenOnboarding`)
- **Fortschrittsanzeige** mit Dots
- **Navigation**: Vor/Zurück/Überspringen Buttons
- **Demo-Portfolio-Integration**: Wird am Ende des Tutorials erstellt

### 3. Landing Page mit Screenshots
- **4 professionelle Feature-Screenshots**:
  - Portfolio-Übersicht mit Performance-Charts
  - Portfolio-Optimizer mit Efficient Frontier
  - Live-Tracking mit Transaktionshistorie
  - Dividenden-Kalender mit Zahlungsübersicht
- **Responsive Grid-Layout** (2 Spalten auf Desktop)
- **Hover-Effekte** mit Scale-Transition
- **Neue Sektion** "Sehen Sie selbst" zwischen Features und "So einfach geht's"

### 4. Memory-Optimierung & Code-Qualität
- **Router-Refactoring**: Hauptdatei von 4145 → 989 Zeilen reduziert (-76%)
- **6 neue Router-Module** erstellt:
  - `stocksRouter.ts` (1176 Zeilen)
  - `portfoliosRouter.ts` (1130 Zeilen)
  - `performanceRouter.ts` (300 Zeilen)
  - `adminRouter.ts` (236 Zeilen)
  - `weeklyOverviewRouter.ts` (172 Zeilen)
  - `portfolioComparisonRouter.ts` (136 Zeilen)
- **Import-Pfade korrigiert** für bessere Modularität
- **Build-Performance** deutlich verbessert

## 🗄️ Datenbankänderungen

### Users Tabelle - Neue Felder
```sql
ALTER TABLE users 
ADD COLUMN hasSeenOnboarding TINYINT NOT NULL DEFAULT 0,
ADD COLUMN hasDemoPortfolio TINYINT NOT NULL DEFAULT 0;
```

## 📁 Neue Dateien

### Backend
- `server/routers/stocksRouter.ts` - Aktien-Management
- `server/routers/portfoliosRouter.ts` - Portfolio-Verwaltung
- `server/routers/performanceRouter.ts` - Performance-Berechnungen
- `server/routers/adminRouter.ts` - Admin-Funktionen
- `server/routers/weeklyOverviewRouter.ts` - Wochenübersicht
- `server/routers/portfolioComparisonRouter.ts` - Portfolio-Vergleich

### Frontend
- `client/src/components/OnboardingTutorial.tsx` - Tutorial-Modal Komponente
- `client/public/screenshot-portfolio-overview.png` - Portfolio Screenshot
- `client/public/screenshot-optimizer.png` - Optimizer Screenshot
- `client/public/screenshot-live-tracking.png` - Live-Tracking Screenshot
- `client/public/screenshot-dividends.png` - Dividenden Screenshot

## 🔧 Technische Verbesserungen

- **TypeScript**: Bessere Modularität durch Router-Aufteilung
- **Performance**: Reduzierte Kompilierungszeit durch kleinere Dateien
- **Wartbarkeit**: Klare Trennung der Verantwortlichkeiten
- **UX**: Nahtloses Onboarding für neue Benutzer

## 📊 Statistiken

- **Code-Reduktion**: 3156 Zeilen aus Hauptdatei extrahiert
- **Neue Komponenten**: 1 (OnboardingTutorial)
- **Neue Router-Module**: 6
- **Neue Screenshots**: 4
- **Neue DB-Felder**: 2
- **Neue tRPC Endpoints**: 2

## 🚀 Deployment-Hinweise

1. Datenbankschema wurde aktualisiert (`hasSeenOnboarding`, `hasDemoPortfolio`)
2. Neue Screenshots sind im `client/public/` Verzeichnis
3. Router-Module sind im `server/routers/` Verzeichnis
4. Keine Breaking Changes für bestehende Benutzer

## 🔮 Geplante Features (Nächster Release)

- **KI-Chat-Bot**: Portfolio-Beratung und Finanz-Tutor
- **Tutorial-Wiederholung**: Button in Settings zum erneuten Anzeigen
- **Weitere UI-Verbesserungen**: Loading States, Skeleton Loaders

---

**Version**: 70c6e673  
**Datum**: 16. November 2025  
**Entwickler**: Manus AI Agent
