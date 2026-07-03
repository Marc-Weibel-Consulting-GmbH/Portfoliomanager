-- Check SPY data in historicalPrices
SELECT ticker, MAX(date) as latest_date, MIN(date) as earliest_date 
FROM historicalPrices 
WHERE ticker = 'SPY' 
GROUP BY ticker;

-- Check SPY in stocks table
SELECT * FROM stocks WHERE ticker = 'SPY';

-- Check latest SPY prices
SELECT ticker, date, close 
FROM historicalPrices 
WHERE ticker = 'SPY' 
ORDER BY date DESC 
LIMIT 10;
