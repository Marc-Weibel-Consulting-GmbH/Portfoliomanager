# Changelog - Portfolio Analysis Website

Alle wichtigen Änderungen, Bug-Fixes und neuen Features werden in dieser Datei dokumentiert.

---

## [Version 2.1.0] - 7. November 2025

### 🐛 Kritische Bug-Fixes

#### Bug #70: Gewichtungslogik überschreibt manuelle Gewichtungen
**Problem:** Beim Hinzufügen oder Löschen von Aktien wurden alle manuellen Gewichtungen (z.B. Nestlé 5%, Kuehne+Nagel 5%) auf automatisch berechnete Werte zurückgesetzt.

**Root Cause:** Die `recalculateWeights`-Funktion wurde bei jeder Änderung ausgeführt und überschrieb alle Gewichtungen ohne Rücksicht auf manuelle Anpassungen.

**Lösung:** Gewichtungslogik komplett überarbeitet:
- Nur noch Aktien mit `portfolioWeight === "0"` werden automatisch berechnet
- Manuelle Gewichtungen bleiben erhalten
- Neue Aktien erhalten automatisch berechnete Gewichtung basierend auf verbleibendem Prozentsatz
- Validierung: Gesamtgewicht darf 100% nicht überschreiten

**Code-Änderungen:**
```typescript
// Alte Logik (überschreibt alles):
stocks.forEach(s => s.portfolioWeight = calculatedWeight);

// Neue Logik (erhält manuelle Werte):
if (parseFloat(s.portfolioWeight) === 0) {
  s.portfolioWeight = calculatedWeight.toFixed(2);
}
```

---

#### Bug #71: Logo-Loading komplett kaputt nach FMP-Änderung
**Problem:** Viele Logos fehlten plötzlich (Kuehne+Nagel, NVIDIA, Nestlé, Alphabet, etc.).

**Root Cause:** 
1. FMP als primäre Quelle funktionierte nicht für alle Aktien
2. Fehlerhafte Fallback-Bedingung: `img.src.includes('clearbit')` war nie wahr, weil primäre Quelle FMP war

**Lösung:** Rollback zur funktionierenden Clearbit-Logik:
1. **Clearbit** als primäre Quelle (mit Swiss domain mapping)
2. **Logo.dev** als Fallback
3. **Letter Avatar** als letzter Fallback

**Swiss Domain Mapping:**
```typescript
const domainMap: Record<string, string> = {
  'KNIN.SW': 'kn-portal.com',
  'GEBN.SW': 'geberit.com',
  'NESN.SW': 'nestle.com',
  // ... weitere Mappings
};
```

---

#### Bug #72: Edit-Dialog Fixes nicht implementiert (Rollback verloren)
**Problem:** 
1. Weißes Kreuz oben rechts fehlte (schwarz auf schwarz unsichtbar)
2. Kategorie-Dropdown fehlte im Edit-Dialog

**Lösung:**
1. DialogContent mit `[&>button]:text-white` für weißes X
2. Kategorie-Dropdown mit 11 Kategorien hinzugefügt:
   - Technologie, Industrie, Finanzen, Gesundheit, Konsumgüter
   - Energie, Rohstoffe, Immobilien, Telekommunikation, Versorgung, Sonstige

---

#### Bug #73: Alternative hinzufügen wirft Fehler "Marktdaten konnten nicht geladen werden"
**Problem:** Nach Hinzufügen einer Alternative (z.B. Pinterest bei Meta) erschien Fehlermeldung.

**Root Cause:** `refreshStockDataMutation.mutateAsync(alt.ticker)` schlug fehl, obwohl alle Daten bereits im `alt`-Objekt vorhanden waren.

**Lösung:** Unnötigen API-Call entfernt, da alle Marktdaten bereits in der Competitor-Analyse vorhanden sind.

---

#### Bug #74: "Alternativen" Button soll deaktiviert werden
**Problem:** Funktion ist noch in Entwicklung, sollte nicht produktiv sein.

**Lösung:** 
- Button mit `disabled={true}` deaktiviert
- Toast-Meldung: "Diese Funktion befindet sich noch in Entwicklung und ist bald verfügbar"

---

#### Bug #75: React duplicate key error "MRVL"
**Problem:** Console-Fehler "Encountered two children with the same key, MRVL".

**Root Cause:** React verwendete `key={stock.ticker}` für Portfolio-Tabelle, aber Ticker sind nicht garantiert eindeutig.

**Lösung:** Geändert zu `key={stock.id}` in beiden Stellen (Portfolio-Tabelle + Alternativen-Übersicht), da `id` garantiert eindeutig ist.

---

#### Bug #76: "Neue Aktie hinzufügen" Dialog - Sharpe Ratio und Dividendenrendite fehlen
**Problem:** 
1. Nach "Daten laden" wurden Sharpe Ratio und Dividendenrendite nicht ausgefüllt
2. "Hinzufügen"-Button funktionierte nicht (keine Validierung, keine Fehlermeldungen)

**Root Cause:**
1. Tippfehler in `routers.ts`: `SharpRatio` statt `SharpeRatio`
2. Fehlende Validierung für Pflichtfelder

**Lösung:**
1. Tippfehler korrigiert: `fundamentals.Technicals?.SharpeRatio`
2. Validierung hinzugefügt:
   - Pflichtfelder: Ticker, Company Name, Current Price, Kategorie
   - Toast-Fehlermeldungen bei fehlenden Feldern
   - Default-Werte für optionale Felder (Gewichtung: 0)

---

#### Bug #77: Kategorien-Seite zeigt keine bestehenden Kategorien
**Problem:** `/categories` zeigte "Keine Kategorien vorhanden", obwohl Aktien Kategorien hatten.

**Root Cause:** `categories`-Tabelle war leer, bestehende Kategorien waren nur in `stocks.category` gespeichert.

**Lösung:** SQL-Migration ausgeführt - 28 Kategorien aus `stocks` in `categories`-Tabelle migriert:
```sql
INSERT INTO categories (name, description) 
SELECT DISTINCT category, CONCAT('Auto-migrated from existing stocks') 
FROM stocks 
WHERE category IS NOT NULL AND category != '' 
ON DUPLICATE KEY UPDATE name = name
```

---

#### Bug #78: Kategorie-Dropdown im Add-Dialog ist leer
**Problem:** Beim Hinzufügen neuer Aktien konnte keine Kategorie ausgewählt werden.

**Root Cause:** Dropdown lud nur aus `categories`-Tabelle, die leer war.

**Lösung:** Migration (Bug #77) behebt das Problem, Dropdown lädt jetzt aus `categories`-Tabelle.

---

#### Bug #79: Sharpe Ratio und Dividendenrendite werden nicht automatisch geladen
**Problem:** Nach "Daten laden" blieben Sharpe Ratio und Dividendenrendite leer.

**Root Cause:** EODHD API gibt diese Werte nicht für alle Aktien zurück.

**Lösung:** 3-stufiger API-Fallback implementiert:
1. **EODHD** (primär): `fundamentals.Technicals.SharpeRatio` + `fundamentals.Highlights.DividendYield`
2. **Finnhub** (Fallback 1): `metric.sharpeRatio` + `metric.dividendYieldIndicatedAnnual`
3. **Yahoo Finance** (Fallback 2): `summaryDetail.dividendYield` (kein Sharpe Ratio verfügbar)

**Test-Ergebnisse:**
- **AAPL (US)**: Dividend Yield 0.38% ✅, Sharpe Ratio fehlt ❌
- **GEBN.SW (CH)**: Beide Werte fehlen in allen 3 APIs
- **Sharpe Ratio**: In keiner API verfügbar (berechneter Wert, nicht von APIs bereitgestellt)

**Finale Lösung:** Sharpe Ratio als optionales Feld markiert, Dividend Yield Fallback funktioniert korrekt.

---

### ✨ Neue Features

#### Feature 1: YTD Performance automatisch berechnen
**Beschreibung:** Beim Hinzufügen neuer Aktien wird YTD Performance automatisch aus API-Daten berechnet.

**Implementierung:**
- Backend berechnet: `ytdPerformance = (currentPrice - ytdStartPrice) / ytdStartPrice * 100`
- `ytdStartPrice` wird von EODHD Historical API geholt (31.12.2024 oder letzter Handelstag)
- Frontend setzt beide Werte automatisch beim "Daten laden"

**Code:**
```typescript
// Backend (routers.ts)
const historicalData = await fetchEODHDHistorical(ticker, '2024-12-27', '2024-12-31');
const ytdStartPrice = historicalData[historicalData.length - 1].close;
const ytdPerformance = ((currentPrice - ytdStartPrice) / ytdStartPrice) * 100;

// Frontend (Home.tsx)
setFormData(prev => ({
  ...prev,
  ytdPerformance: data.ytdPerformance?.toFixed(2) || "",
}));
```

---

#### Feature 2: Kategorie-Verwaltung im Admin-Panel
**Beschreibung:** Admin kann Kategorien hinzufügen, umbenennen und löschen über eine dedizierte UI.

**Komponenten:**
1. **Neue Tabelle**: `categories` in Datenbank
   ```sql
   CREATE TABLE categories (
     id INT AUTO_INCREMENT PRIMARY KEY,
     name VARCHAR(100) NOT NULL UNIQUE,
     description TEXT,
     color VARCHAR(50),
     createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
   )
   ```

2. **Backend-Router**: `trpc.categories` mit CRUD-Operationen
   - `list`: Alle Kategorien abrufen (öffentlich)
   - `add`: Neue Kategorie hinzufügen (nur Admin)
   - `update`: Kategorie bearbeiten (nur Admin)
   - `delete`: Kategorie löschen (nur Admin)

3. **Admin-UI**: `/categories` (nur für Admins zugänglich)
   - Übersicht aller Kategorien mit Beschreibung und Farbe
   - "Neue Kategorie" Button öffnet Dialog
   - Bearbeiten/Löschen Buttons für jede Kategorie
   - Autorisierung: `user.role === 'admin'` erforderlich

4. **Dynamische Dropdowns**: Add/Edit-Dialog lädt Kategorien aus DB
   ```typescript
   const { data: categoriesData = [] } = trpc.categories.list.useQuery();
   const categories = useMemo(() => {
     return categoriesData.map((c: any) => c.name).sort();
   }, [categoriesData]);
   ```

**Navigation:**
- Admin-Button "Kategorien" auf Hauptseite (nur für Admins sichtbar)
- Direkter Link zu `/categories`

---

### 📊 Technische Verbesserungen

#### API-Fallback-System
Robustes 3-stufiges Fallback-System für Marktdaten:

```typescript
// 1. EODHD (primär)
let dividendYield = fundamentals.Highlights?.DividendYield ? 
  fundamentals.Highlights.DividendYield * 100 : null;

// 2. Finnhub (Fallback 1)
if (dividendYield === null) {
  const finnhubData = await fetch(`https://finnhub.io/api/v1/stock/metric?...`);
  dividendYield = finnhubData.metric?.dividendYieldIndicatedAnnual;
}

// 3. Yahoo Finance (Fallback 2)
if (dividendYield === null) {
  const yahooData = await fetch(`https://query2.finance.yahoo.com/...`);
  dividendYield = yahooData.quoteSummary?.result?.[0]?.summaryDetail?.dividendYield?.raw * 100;
}
```

**Vorteile:**
- Höhere Datenqualität durch mehrere Quellen
- Logging für Debugging (`console.log` bei jedem Fallback)
- Graceful degradation (null bei fehlenden Daten)

---

#### React Key Optimization
Wechsel von `key={stock.ticker}` zu `key={stock.id}` verhindert:
- Duplicate key Fehler bei mehrfachen Einträgen
- Unnötige Re-Renders bei Ticker-Änderungen
- Bessere Performance bei großen Listen

---

### 🔧 Wartung & Dokumentation

#### Dokumentation aktualisiert
- `todo.md`: Alle Bugs und Features dokumentiert mit Root Cause und Lösung
- `CHANGELOG.md`: Vollständige Änderungshistorie (diese Datei)
- Test-Ergebnisse für API-Fallback dokumentiert

#### Code-Qualität
- Validierung für alle User-Inputs
- Fehlerbehandlung mit aussagekräftigen Toast-Meldungen
- Logging für Debugging (API-Fallbacks, Gewichtungsberechnung)
- TypeScript-Typen für alle neuen Funktionen

---

### 🚀 Nächste Schritte (TODO)

#### Feature 3: Bulk-Edit-Funktion (geplant)
- Checkboxen in Portfolio-Tabelle für Mehrfachauswahl
- Bulk-Actions-Bar bei Auswahl:
  - Kategorie ändern für mehrere Aktien
  - Löschen mehrerer Aktien
  - Gewichtung anpassen
- Backend-Mutations für Bulk-Operationen

#### Verbesserungen
- **Sharpe Ratio berechnen**: Aus historischen Daten (Rendite / Volatilität)
- **Kategorie-Farben nutzen**: In Portfolio-Tabelle Kategorien farblich hervorheben
- **Standard-Kategorien**: Über `/categories` vordefinierte Kategorien anlegen

---

## Entwickler-Notizen

### API-Endpoints verwendet
- **EODHD**: Fundamentals, Real-time Quotes, Historical Data
- **Finnhub**: Stock Metrics (Sharpe Ratio, Dividend Yield)
- **Yahoo Finance**: Quote Summary (Dividend Yield Fallback)

### Datenbank-Schema-Änderungen
- Neue Tabelle: `categories` (id, name, description, color, timestamps)
- Migration: 28 Kategorien aus `stocks.category` migriert

### Berechtigungs-System
- Admin-Rolle: `user.role === 'admin'`
- Admin-Funktionen: Kategorie-Verwaltung, Bulk-Edit (geplant)
- Owner wird automatisch als Admin markiert (`OWNER_OPEN_ID`)

---

**Autor:** Manus AI  
**Datum:** 7. November 2025  
**Version:** 2.1.0
