"""
TradingView Analytics Bridge — FastAPI service for Railway deployment.
Wraps the tradingview-mcp-server library and exposes REST endpoints
that the Portfolio App Node.js backend can call.

Endpoints:
  GET  /health                          — health check
  GET  /price/{symbol}                  — real-time price (Yahoo Finance)
  GET  /analysis/{symbol}               — multi-timeframe TA analysis
  GET  /combined/{symbol}               — TA + sentiment + news (power tool)
  GET  /signals/{symbol}                — coin_analysis (Bollinger + indicators)
  POST /backtest                         — backtest a strategy
  POST /compare-strategies              — compare all 9 strategies
  GET  /market-snapshot                 — global market overview
  GET  /news                            — financial news feed
  GET  /sentiment/{symbol}              — Reddit sentiment
  GET  /top-gainers                     — top gainers (exchange)
  GET  /top-losers                      — top losers (exchange)
"""
from __future__ import annotations

import os
import asyncio
from typing import Optional
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

# ── Import TradingView MCP services directly ──────────────────────────────────
from tradingview_mcp.core.services.screener_service import (
    run_multi_timeframe_analysis,
    analyze_coin,
)
from tradingview_mcp.core.services.yahoo_finance_service import (
    get_price,
    get_market_snapshot,
)
from tradingview_mcp.core.services.news_service import fetch_news_summary
from tradingview_mcp.core.services.sentiment_service import analyze_sentiment
from tradingview_mcp.core.services.backtest_service import (
    run_backtest,
    compare_strategies,
)
from tradingview_mcp.core.utils.validators import (
    normalize_yahoo_symbol,
    normalize_tradingview_symbol,
)

# ── App setup ─────────────────────────────────────────────────────────────────
app = FastAPI(
    title="TradingView Analytics Bridge",
    description="REST API wrapping tradingview-mcp-server for Portfolio App",
    version="1.0.0",
)

# CORS — allow the Portfolio App backend to call this service
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Optional API key guard (set BRIDGE_API_KEY env var on Railway to secure the service)
BRIDGE_API_KEY = os.getenv("BRIDGE_API_KEY", "")


def _check_api_key(api_key: Optional[str] = None):
    if BRIDGE_API_KEY and api_key != BRIDGE_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")


# ── Pydantic models ───────────────────────────────────────────────────────────
class BacktestRequest(BaseModel):
    symbol: str
    exchange: str = "NASDAQ"
    strategy: str = "rsi"
    timeframe: str = "1d"
    initial_capital: float = 10000.0
    include_trade_log: bool = False
    include_equity_curve: bool = False


class CompareStrategiesRequest(BaseModel):
    symbol: str
    exchange: str = "NASDAQ"
    timeframe: str = "1d"
    initial_capital: float = 10000.0


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "service": "tradingview-analytics-bridge"}


@app.get("/price/{symbol}")
def price(symbol: str, api_key: Optional[str] = Query(None)):
    """Real-time price quote via Yahoo Finance. Symbol e.g. NESN.SW, AAPL, BTC-USD"""
    _check_api_key(api_key)
    try:
        yahoo_sym = normalize_yahoo_symbol(symbol)
        result = get_price(yahoo_sym)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/analysis/{symbol}")
def multi_timeframe(
    symbol: str,
    exchange: str = Query("NASDAQ", description="Exchange: NASDAQ, NYSE, SIX, XETRA, etc."),
    api_key: Optional[str] = Query(None),
):
    """Multi-timeframe alignment analysis (Weekly → Daily → 4H → 1H → 15m)."""
    _check_api_key(api_key)
    try:
        tv_sym = normalize_tradingview_symbol(symbol, exchange)
        result = run_multi_timeframe_analysis(tv_sym, exchange)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/signals/{symbol}")
def signals(
    symbol: str,
    exchange: str = Query("NASDAQ"),
    timeframe: str = Query("1d"),
    api_key: Optional[str] = Query(None),
):
    """Detailed coin/stock analysis: Bollinger Bands, RSI, MACD, volume, trend."""
    _check_api_key(api_key)
    try:
        result = analyze_coin(symbol.upper(), exchange.upper(), timeframe)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/market-snapshot")
def market_snapshot(api_key: Optional[str] = Query(None)):
    """Global market overview: major indices, top crypto, FX rates, key ETFs."""
    _check_api_key(api_key)
    try:
        return get_market_snapshot()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/news")
def news(
    query: str = Query("market", description="Search query for news"),
    count: int = Query(10, ge=1, le=50),
    api_key: Optional[str] = Query(None),
):
    """Real-time financial news from Yahoo Finance, MarketWatch, CNBC."""
    _check_api_key(api_key)
    try:
        return fetch_news_summary(query, count)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/sentiment/{symbol}")
def sentiment(symbol: str, api_key: Optional[str] = Query(None)):
    """Real-time Reddit sentiment analysis for stocks and crypto."""
    _check_api_key(api_key)
    try:
        return analyze_sentiment(symbol.upper())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/backtest")
def backtest(req: BacktestRequest, api_key: Optional[str] = Query(None)):
    """Backtest a trading strategy with institutional-grade metrics."""
    _check_api_key(api_key)
    try:
        result = run_backtest(
            symbol=req.symbol.upper(),
            exchange=req.exchange.upper(),
            strategy=req.strategy,
            timeframe=req.timeframe,
            initial_capital=req.initial_capital,
            include_trade_log=req.include_trade_log,
            include_equity_curve=req.include_equity_curve,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/compare-strategies")
def compare(req: CompareStrategiesRequest, api_key: Optional[str] = Query(None)):
    """Run all 9 strategies and return a ranked leaderboard."""
    _check_api_key(api_key)
    try:
        result = compare_strategies(
            symbol=req.symbol.upper(),
            exchange=req.exchange.upper(),
            timeframe=req.timeframe,
            initial_capital=req.initial_capital,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/top-gainers")
def top_gainers(
    exchange: str = Query("NASDAQ"),
    timeframe: str = Query("1d"),
    limit: int = Query(20, ge=5, le=100),
    api_key: Optional[str] = Query(None),
):
    """Top gainers for an exchange and timeframe."""
    _check_api_key(api_key)
    try:
        from tradingview_mcp.core.services.screener_service import fetch_trending_analysis
        result = fetch_trending_analysis(exchange.upper(), timeframe, limit, "gainers")
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/top-losers")
def top_losers(
    exchange: str = Query("NASDAQ"),
    timeframe: str = Query("1d"),
    limit: int = Query(20, ge=5, le=100),
    api_key: Optional[str] = Query(None),
):
    """Top losers for an exchange and timeframe."""
    _check_api_key(api_key)
    try:
        from tradingview_mcp.core.services.screener_service import fetch_trending_analysis
        result = fetch_trending_analysis(exchange.upper(), timeframe, limit, "losers")
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    port = int(os.getenv("PORT", "8001"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
