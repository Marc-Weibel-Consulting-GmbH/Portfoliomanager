# Financial Datasets MCP Server — Portfoliomanager-Variante.
#
# Basiert auf https://github.com/financial-datasets/mcp-server (MIT License,
# Copyright (c) Financial Datasets) — angepasst für den Betrieb als
# Railway-Service hinter dem Portfoliomanager:
#   * Transport: Streamable HTTP (statt stdio für Claude Desktop)
#   * /health-Route für Deploy-Checks
#   * Krypto-Tools entfernt (für die Zielgruppe irrelevant)
#
# WICHTIG (Abdeckung): Die Financial-Datasets-API deckt primär US-gelistete
# Titel ab. Für Schweizer/europäische Ticker liefern die Tools leere Daten —
# die aufrufende Seite muss ehrlich degradieren.
#
# Env: FINANCIAL_DATASETS_API_KEY (Pflicht), PORT (Railway, Default 8000).

import os

import httpx
from mcp.server.fastmcp import FastMCP
from starlette.requests import Request
from starlette.responses import JSONResponse

FINANCIAL_DATASETS_API_KEY = os.environ.get("FINANCIAL_DATASETS_API_KEY", "")
API_BASE = "https://api.financialdatasets.ai"

mcp = FastMCP(
    "financial-datasets",
    host="0.0.0.0",
    port=int(os.environ.get("PORT", "8000")),
)


async def _get(path: str, params: dict) -> dict:
    """GET gegen die Financial-Datasets-API; wirft bei HTTP-Fehlern."""
    if not FINANCIAL_DATASETS_API_KEY:
        return {"error": "FINANCIAL_DATASETS_API_KEY ist nicht gesetzt."}
    clean = {k: v for k, v in params.items() if v is not None}
    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.get(
            f"{API_BASE}{path}",
            params=clean,
            headers={"X-API-KEY": FINANCIAL_DATASETS_API_KEY},
        )
        res.raise_for_status()
        return res.json()


@mcp.custom_route("/health", methods=["GET"])
async def health(_request: Request) -> JSONResponse:
    return JSONResponse({"status": "ok", "service": "financial-datasets-mcp"})


@mcp.tool()
async def get_income_statements(ticker: str, period: str = "annual", limit: int = 4) -> dict:
    """Erfolgsrechnungen (Income Statements) eines US-Titels.

    Args:
        ticker: US-Ticker, z. B. AAPL
        period: annual | quarterly | ttm
        limit: Anzahl Perioden (Default 4)
    """
    return await _get("/financials/income-statements", {"ticker": ticker, "period": period, "limit": limit})


@mcp.tool()
async def get_balance_sheets(ticker: str, period: str = "annual", limit: int = 4) -> dict:
    """Bilanzen (Balance Sheets) eines US-Titels.

    Args:
        ticker: US-Ticker, z. B. AAPL
        period: annual | quarterly | ttm
        limit: Anzahl Perioden (Default 4)
    """
    return await _get("/financials/balance-sheets", {"ticker": ticker, "period": period, "limit": limit})


@mcp.tool()
async def get_cash_flow_statements(ticker: str, period: str = "annual", limit: int = 4) -> dict:
    """Kapitalflussrechnungen (Cash Flow Statements) eines US-Titels.

    Args:
        ticker: US-Ticker, z. B. AAPL
        period: annual | quarterly | ttm
        limit: Anzahl Perioden (Default 4)
    """
    return await _get("/financials/cash-flow-statements", {"ticker": ticker, "period": period, "limit": limit})


@mcp.tool()
async def get_current_stock_price(ticker: str) -> dict:
    """Aktueller Kurs-Snapshot eines US-Titels.

    Args:
        ticker: US-Ticker, z. B. AAPL
    """
    return await _get("/prices/snapshot", {"ticker": ticker})


@mcp.tool()
async def get_historical_stock_prices(
    ticker: str,
    start_date: str,
    end_date: str,
    interval: str = "day",
    interval_multiplier: int = 1,
) -> dict:
    """Historische Kurse eines US-Titels.

    Args:
        ticker: US-Ticker, z. B. AAPL
        start_date: YYYY-MM-DD
        end_date: YYYY-MM-DD
        interval: minute | day | week | month | year
        interval_multiplier: Multiplikator des Intervalls (Default 1)
    """
    return await _get(
        "/prices",
        {
            "ticker": ticker,
            "start_date": start_date,
            "end_date": end_date,
            "interval": interval,
            "interval_multiplier": interval_multiplier,
        },
    )


@mcp.tool()
async def get_company_news(ticker: str, limit: int = 10) -> dict:
    """Aktuelle Firmen-News zu einem US-Titel.

    Args:
        ticker: US-Ticker, z. B. AAPL
        limit: Anzahl Meldungen (Default 10)
    """
    return await _get("/news", {"ticker": ticker, "limit": limit})


@mcp.tool()
async def get_sec_filings(ticker: str, filing_type: str | None = None, limit: int = 10) -> dict:
    """SEC-Filings (10-K, 10-Q, 8-K, ...) eines US-Titels.

    Args:
        ticker: US-Ticker, z. B. AAPL
        filing_type: Optionaler Filter, z. B. 10-K oder 10-Q
        limit: Anzahl Filings (Default 10)
    """
    return await _get("/filings", {"ticker": ticker, "filing_type": filing_type, "limit": limit})


if __name__ == "__main__":
    mcp.run(transport="streamable-http")
