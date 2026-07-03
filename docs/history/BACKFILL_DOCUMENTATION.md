# Historical Prices Backfill Documentation

## Übersicht

Der Backfill-Prozess lädt historische Kursdaten für alle Aktien in Portfolios und Transaktionen von der EODHD API und speichert sie in der `historical_prices` Tabelle. Diese Daten sind essentiell für:

- **Performance-Charts** (Portfolio-Wert über Zeit)
- **Hypothetische Performance-Berechnungen** (vor Portfolio-Erstellung)
- **Benchmark-Vergleiche** (z.B. vs. S&P 500)
- **Historische Analysen** (YTD, 1Y, 3Y Performance)

## Test-Ergebnisse (30.12.2025)

### Erfolgreiche Ausführung

```
✅ 131 von 135 Tickers erfolgreich verarbeitet (96.3% Erfolgsquote)
✅ 96'648 historische Preise importiert (3 Jahre Daten: 2022-12-30 bis 2025-12-30)
✅ Durchschnittlich ~738 Preise pro Ticker
✅ Multi-Börsen-Support: US, Schweiz (.SW), Paris (.PA)
```

### Fehlerhafte Tickers

Nur 4 Tickers konnten nicht geladen werden (falsche Exchange-Codes):
- `EXSA.DE` (Deutschland)
- `MONC.MI` (Mailand)
- `ABB.N` (unbekannt)
- `VWRL.L` (London)

**Lösung**: Diese Tickers müssen mit korrekten Exchange-Suffixen aktualisiert werden.

## Implementierung

### 1. Ticker-Erkennung

Die Funktion `getUniqueTickers()` in `server/jobs/importHistoricalPrices.ts` sammelt Tickers aus zwei Quellen:

```typescript
// Quelle 1: Transaktionen (portfolioTransactions Tabelle)
const transactionTickers = await db
  .select({ ticker: transactions.ticker })
  .from(transactions)
  .where(sql`${transactions.ticker} IS NOT NULL`)
  .groupBy(transactions.ticker);

// Quelle 2: Portfolio-Holdings (savedPortfolios.portfolioData JSON)
const portfolios = await db
  .select({ portfolioData: savedPortfolios.portfolioData })
  .from(savedPortfolios);

// Kombiniere und dedupliziere
const allTickers = new Set([...transactionTickers, ...portfolioTickers]);
```

### 2. Daten-Abruf

Für jeden Ticker wird die EODHD API aufgerufen:

```
GET https://eodhd.com/api/eod/{ticker}?api_token={key}&fmt=json&from={fromDate}&to={toDate}
```

**Rate Limiting**: 200ms Pause zwischen Requests (max 5 Requests/Sekunde)

### 3. Daten-Speicherung

Historische Preise werden in der `historical_prices` Tabelle gespeichert:

```sql
CREATE TABLE historical_prices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ticker VARCHAR(50) NOT NULL,
  date DATE NOT NULL,
  close VARCHAR(50) NOT NULL,
  source VARCHAR(50) DEFAULT 'eodhd',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_ticker_date (ticker, date)
);
```

**Duplikat-Handling**: `ON DUPLICATE KEY UPDATE` verhindert Fehler bei erneuten Imports.

## Verwendung

### Manueller Backfill (Admin-Funktion)

Der Backfill kann über die Admin-API getriggert werden:

```typescript
// tRPC Mutation
const result = await trpc.admin.backfillPrices.mutate({
  from: '2022-01-01',
  to: '2025-12-30',
  portfolioId: 123, // Optional: nur für ein Portfolio
  tickers: ['AAPL', 'MSFT'], // Optional: nur für bestimmte Tickers
});
```

### Automatischer Täglicher Update

Der `historicalPricesCron` läuft täglich um 2:00 AM UTC und aktualisiert die letzten 7 Tage:

```typescript
// server/cron/historicalPricesCron.ts
export function initHistoricalPricesCron() {
  // Läuft täglich um 2:00 AM UTC
  // Lädt die letzten 7 Tage (um Lücken zu füllen)
}
```

### Test-Script

Ein Test-Script ist verfügbar unter `test-backfill.mjs`:

```bash
cd /home/ubuntu/portfolio_analysis_website
node --import tsx test-backfill.mjs
```

## Datenbank-Abfragen

### Gesamtstatistiken

```sql
SELECT 
  COUNT(DISTINCT ticker) as unique_tickers,
  COUNT(*) as total_prices,
  MIN(date) as earliest_date,
  MAX(date) as latest_date
FROM historical_prices;
```

### Ticker mit den meisten Daten

```sql
SELECT 
  ticker,
  MIN(date) as earliest_date,
  MAX(date) as latest_date,
  COUNT(*) as price_count
FROM historical_prices
GROUP BY ticker
ORDER BY price_count DESC
LIMIT 20;
```

### Lücken-Analyse

```sql
SELECT 
  ticker,
  COUNT(*) as price_count,
  DATEDIFF(MAX(date), MIN(date)) as days_covered
FROM historical_prices
GROUP BY ticker
HAVING price_count < 500
ORDER BY price_count ASC;
```

## Performance-Optimierung

### Indexierung

Die Tabelle hat einen UNIQUE INDEX auf `(ticker, date)` für schnelle Abfragen:

```sql
CREATE UNIQUE INDEX unique_ticker_date ON historical_prices(ticker, date);
```

### Batch-Insert

Der Import verwendet Batch-Inserts für bessere Performance:

```typescript
await db.insert(historicalPrices).values(insertData).onDuplicateKeyUpdate({
  set: { close: sql`VALUES(close)`, updatedAt: sql`CURRENT_TIMESTAMP` },
});
```

## Troubleshooting

### Problem: Keine Daten für einen Ticker

**Ursache**: Falscher Exchange-Code oder Ticker existiert nicht bei EODHD

**Lösung**: 
1. Prüfe den Ticker-Namen auf der EODHD-Website
2. Verwende den korrekten Exchange-Suffix (z.B. `.US`, `.SW`, `.PA`)
3. Aktualisiere den Ticker in der Datenbank

### Problem: Lücken in historischen Daten

**Ursache**: Handelsfreie Tage (Wochenenden, Feiertage) oder API-Fehler

**Lösung**:
1. Führe den Backfill erneut aus mit `forceRefresh: true`
2. Prüfe die EODHD API-Limits und Verfügbarkeit

### Problem: Langsamer Import

**Ursache**: Rate Limiting (200ms pro Request)

**Lösung**:
- Der Import ist absichtlich gedrosselt, um API-Limits einzuhalten
- Für 135 Tickers dauert der Import ca. 27 Minuten (135 * 200ms = 27 Sekunden pro Batch)
- Kann nicht beschleunigt werden ohne EODHD Premium-Plan

## Nächste Schritte

- [ ] Implementiere automatische Fehler-Benachrichtigung bei fehlgeschlagenen Imports
- [ ] Füge Monitoring für Daten-Lücken hinzu
- [ ] Erstelle Admin-Dashboard für Backfill-Status
- [ ] Implementiere inkrementelle Updates (nur neue Daten laden)
