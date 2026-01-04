#!/bin/bash
# Extract database connection details from DATABASE_URL
DB_URL="${DATABASE_URL}"
# Parse the URL (format: mysql://user:pass@host:port/dbname)
DB_USER=$(echo "$DB_URL" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
DB_PASS=$(echo "$DB_URL" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
DB_HOST=$(echo "$DB_URL" | sed -n 's/.*@\([^:\/]*\).*/\1/p')
DB_NAME=$(echo "$DB_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')

mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "SELECT id, name, cashBalance, JSON_LENGTH(portfolioData, '$.stocks') as stock_count FROM savedPortfolios WHERE id = 990001;"
