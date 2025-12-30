-- Check historical_prices table after backfill

-- 1. Overall statistics
SELECT 
  COUNT(DISTINCT ticker) as unique_tickers,
  COUNT(*) as total_prices,
  MIN(date) as earliest_date,
  MAX(date) as latest_date
FROM historical_prices;

-- 2. Top 10 tickers by price count
SELECT 
  ticker,
  MIN(date) as earliest_date,
  MAX(date) as latest_date,
  COUNT(*) as price_count,
  DATEDIFF(MAX(date), MIN(date)) as days_covered
FROM historical_prices
GROUP BY ticker
ORDER BY price_count DESC
LIMIT 10;

-- 3. Check for gaps in data (tickers with less than expected prices)
SELECT 
  ticker,
  COUNT(*) as price_count,
  MIN(date) as earliest_date,
  MAX(date) as latest_date,
  DATEDIFF(MAX(date), MIN(date)) as days_covered,
  ROUND(COUNT(*) / (DATEDIFF(MAX(date), MIN(date)) / 365.0), 0) as avg_prices_per_year
FROM historical_prices
GROUP BY ticker
HAVING price_count < 500
ORDER BY price_count ASC;

-- 4. Sample data for a specific ticker (e.g., AAPL)
SELECT * FROM historical_prices 
WHERE ticker = 'AAPL' 
ORDER BY date DESC 
LIMIT 10;
