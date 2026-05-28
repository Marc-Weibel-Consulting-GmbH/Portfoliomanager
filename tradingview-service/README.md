# TradingView Analytics Bridge

FastAPI microservice wrapping [tradingview-mcp-server](https://github.com/atilaahmettaner/tradingview-mcp) for the Portfolio App.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/price/{symbol}` | Real-time price (Yahoo Finance) |
| GET | `/analysis/{symbol}?exchange=SIX` | Multi-timeframe TA (Weekly→Daily→4H→1H→15m) |
| GET | `/signals/{symbol}?exchange=SIX&timeframe=1d` | Bollinger, RSI, MACD, volume |
| GET | `/market-snapshot` | Global indices, crypto, FX |
| GET | `/news?query=Nestlé&count=10` | Financial news |
| GET | `/sentiment/{symbol}` | Reddit sentiment |
| POST | `/backtest` | Backtest a strategy |
| POST | `/compare-strategies` | Compare all 9 strategies |
| GET | `/top-gainers?exchange=SIX` | Top gainers |
| GET | `/top-losers?exchange=SIX` | Top losers |

## Railway Deployment

### 1. Create a new Railway service

In your Railway project, add a new service from GitHub:
- Select the `tradingview-service/` subdirectory (or push it as a separate repo)
- Railway auto-detects the `Dockerfile`

### 2. Set environment variables on Railway

| Variable | Description |
|----------|-------------|
| `BRIDGE_API_KEY` | Secret key to secure the API (any random string) |
| `ALLOWED_ORIGINS` | Comma-separated allowed origins (optional, defaults to `*`) |

### 3. Note the Railway URL

After deploy, Railway gives you a URL like:
`https://tradingview-bridge-production.up.railway.app`

### 4. Configure the Portfolio App

Add these secrets to the Portfolio App (Manus WebDev → Settings → Secrets):
- `TRADINGVIEW_BRIDGE_URL` = `https://tradingview-bridge-production.up.railway.app`
- `TRADINGVIEW_BRIDGE_API_KEY` = same value as `BRIDGE_API_KEY` above

## Local Development

```bash
cd tradingview-service
uv pip install -r pyproject.toml
uvicorn main:app --reload --port 8001
```

API docs available at: `http://localhost:8001/docs`

## Symbol Formats

| Exchange | Example |
|----------|---------|
| Swiss Exchange (SIX) | `NESN.SW` → exchange: `SIX` |
| NASDAQ | `AAPL` → exchange: `NASDAQ` |
| NYSE | `JPM` → exchange: `NYSE` |
| Xetra | `SAP.DE` → exchange: `XETRA` |
| Crypto (Binance) | `BTC` → exchange: `BINANCE` |
