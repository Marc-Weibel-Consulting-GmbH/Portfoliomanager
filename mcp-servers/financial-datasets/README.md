# Financial Datasets MCP Server (Portfoliomanager)

MCP-Server für die [Financial Datasets](https://www.financialdatasets.ai/)-API —
Erfolgsrechnungen, Bilanzen, Cashflow-Statements, Kurse, Firmen-News und
SEC-Filings. Basiert auf
[financial-datasets/mcp-server](https://github.com/financial-datasets/mcp-server)
(MIT License), angepasst für den Betrieb als HTTP-Service hinter dem
Portfoliomanager (analog `mcp-servers/tradingview`):

- **Streamable-HTTP-Transport** statt stdio (Claude Desktop)
- **`/health`-Route** für Deploy-Checks
- **Krypto-Tools entfernt**

## ⚠️ Abdeckung

Die API deckt primär **US-gelistete Titel** ab. Für Schweizer/europäische
Ticker (`.SW`, `.DE`, …) liefern die Tools keine Daten — die App-Seite
(`server/lib/financialDatasets.ts`) filtert deshalb auf US-Ticker und
degradiert ehrlich.

## Deployment (Railway)

1. Neuen Railway-Service auf dieses Verzeichnis zeigen lassen
   (`mcp-servers/financial-datasets`, Dockerfile-Build).
2. Env-Variablen setzen:
   - `FINANCIAL_DATASETS_API_KEY` — API-Key von financialdatasets.ai
3. Im Portfoliomanager-Backend setzen:
   - `FINANCIAL_DATASETS_MCP_URL` — die öffentliche Railway-URL des Service

Ohne `FINANCIAL_DATASETS_MCP_URL` ist die Integration in der App komplett
inaktiv (kein Fehler, keine Anreicherung).

## Lokal testen

```bash
pip install "mcp>=1.9.0" "httpx>=0.27.0"
FINANCIAL_DATASETS_API_KEY=... PORT=8000 python server.py
curl http://localhost:8000/health
```

## Tools

| Tool | Inhalt |
|---|---|
| `get_income_statements` | Erfolgsrechnungen (annual/quarterly/ttm) |
| `get_balance_sheets` | Bilanzen |
| `get_cash_flow_statements` | Kapitalflussrechnungen (inkl. Free Cash Flow) |
| `get_current_stock_price` | Kurs-Snapshot |
| `get_historical_stock_prices` | Historische Kurse |
| `get_company_news` | Firmen-News |
| `get_sec_filings` | SEC-Filings (10-K/10-Q/8-K …) |
