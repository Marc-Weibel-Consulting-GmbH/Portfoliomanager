SELECT 
  ticker,
  MIN(date) as earliest_date,
  MAX(date) as latest_date,
  COUNT(*) as price_count
FROM historical_prices
GROUP BY ticker
ORDER BY ticker
LIMIT 20;
