from __future__ import annotations
import os
from typing import Set

ALLOWED_TIMEFRAMES: Set[str] = {"5m", "15m", "1h", "4h", "1D", "1W", "1M"}
_TIMEFRAME_ALIASES = {
    "5m": "5m",
    "15m": "15m",
    "1h": "1h",
    "4h": "4h",
    "1d": "1D",
    "1w": "1W",
    "1m": "1M",
}

# Exchanges that represent stock markets (not crypto)
STOCK_EXCHANGES: Set[str] = {
    "egx", "bist", "nasdaq", "nyse",
    "amex", "nysearca", "pcx",          # NYSE Arca / AMEX (ETFs: GDX, GLD, XLE, SPY, QQQ, etc.)
    "bursa", "myx", "klse", "ace", "leap",
    "hkex", "hk", "hsi",
    "asx",
    "sse", "szse", "chn",
    "twse", "tpex",
    "tadawul", "tasi",                  # Saudi Stock Exchange (Tadawul) — All Share Index (TASI)
    # Europe / Japan — targets of the Yahoo-suffix mapping (.SW/.DE/.PA/.L/.T).
    # Missing here, every European ticker fell through to the crypto default.
    "six",                              # SIX Swiss Exchange
    "xetr", "xetra",                    # Xetra — TradingView's prefix is XETR
    "euronext",
    "lse",
    "tse",                              # Tokyo Stock Exchange
}

EXCHANGE_SCREENER = {
    "all": "crypto",
    "huobi": "crypto",
    "kucoin": "crypto",
    "coinbase": "crypto",
    "gateio": "crypto",
    "binance": "crypto",
    "bitfinex": "crypto",
    "bitget": "crypto",
    "bybit": "crypto",
    "okx": "crypto",
    "mexc": "crypto",
    "bist": "turkey",
    # Egyptian Stock Market Support
    "egx": "egypt",
    "nasdaq": "america",
    # Malaysia Stock Market Support
    "bursa": "malaysia",
    "myx": "malaysia",
    "klse": "malaysia",
    "ace": "malaysia",      # ACE Market (Access, Certainty, Efficiency)
    "leap": "malaysia",     # LEAP Market (Leading Entrepreneur Accelerator Platform)
    # Hong Kong Stock Market Support
    "hkex": "hongkong",     # Hong Kong Exchange
    "hk": "hongkong",       # Hong Kong (alternate)
    "hsi": "hongkong",      # Hang Seng Index constituents
    "nyse": "america",
    # NYSE Arca / AMEX — ETFs (GDX, GLD, XLE, SPY, QQQ …) are listed here in TradingView
    "amex": "america",      # TradingView canonical prefix for NYSE Arca ETFs
    "nysearca": "america",  # alias: NYSE Arca (official name used by issuers)
    "pcx": "america",       # alias: Pacific Exchange (historical MIC code for NYSE Arca)
    "asx": "australia",     # Australian Securities Exchange
    # China A-Share Market Support
    "sse": "china",         # Shanghai Stock Exchange (上海证券交易所)
    "szse": "china",        # Shenzhen Stock Exchange (深圳证券交易所)
    "chn": "china",         # China A-shares (combined alias)
    # Taiwan Stock Market Support
    "twse": "taiwan",       # Taiwan Stock Exchange (臺灣證券交易所)
    "tpex": "taiwan",       # Taipei Exchange (櫃買中心, OTC market)
    # Saudi Stock Market (Tadawul) — TradingView scanner uses /ksa/
    "tadawul": "ksa",
    "tasi": "ksa",          # alias: Tadawul All Share Index
    # Europe / Japan — screener slugs verified against scanner.tradingview.com.
    # Note there is no "europe" screener; each market has its own country slug.
    "six": "switzerland",   # SIX Swiss Exchange
    "xetr": "germany",      # Xetra
    "xetra": "germany",     # alias: spelling used by some callers
    "euronext": "france",
    "lse": "uk",            # London Stock Exchange
    "tse": "japan",         # Tokyo Stock Exchange
}

# Map validated exchange identifiers to their canonical TradingView symbol prefix.
# TradingView uses "AMEX" as the prefix for all NYSE Arca / ETF listings; passing
# "NYSE:GDX" returns no data even though GDX trades on NYSE Arca.
_EXCHANGE_TV_PREFIX: dict = {
    "amex": "AMEX",
    "nysearca": "AMEX",
    "pcx": "AMEX",
    "nasdaq": "NASDAQ",
    "nyse": "NYSE",
    "egx": "EGX",
    "bist": "BIST",
    "bursa": "MYX",
    "myx": "MYX",
    "klse": "MYX",
    "ace": "MYX",
    "leap": "MYX",
    "hkex": "HKEX",
    "hk": "HKEX",
    "hsi": "HSI",
    "asx": "ASX",
    "sse": "SSE",
    "szse": "SZSE",
    "chn": "SSE",
    "twse": "TWSE",
    "tpex": "TPEX",
    "tadawul": "TADAWUL",
    "tasi": "TADAWUL",
    "six": "SIX",
    "xetr": "XETR",
    "xetra": "XETR",        # callers saying "XETRA" still resolve to the real prefix
    "euronext": "EURONEXT",
    "lse": "LSE",
    "tse": "TSE",
}

_YAHOO_SYMBOL_ALIASES: dict = {
    "TAIEX": "^TWII",
    "TAIEX.TW": "^TWII",
    "^TWII": "^TWII",
    "TWSE:TAIEX": "^TWII",
    "TWSE:IX0001": "^TWII",
}

_TRADINGVIEW_SYMBOL_ALIASES: dict = {
    "TAIEX": "TWSE:IX0001",
    "TAIEX.TW": "TWSE:IX0001",
    "^TWII": "TWSE:IX0001",
    "IX0001": "TWSE:IX0001",
    "TWSE:TAIEX": "TWSE:IX0001",
    "TWSE:IX0001": "TWSE:IX0001",
}


def get_tv_exchange_prefix(exchange: str) -> str:
    """Return the TradingView symbol prefix for *exchange* (e.g. ``AMEX`` for ``nysearca``).

    Falls back to ``exchange.upper()`` for exchanges not in the explicit map so
    that crypto exchanges (KUCOIN, BINANCE, …) still work as before.
    """
    return _EXCHANGE_TV_PREFIX.get(exchange.strip().lower(), exchange.upper())


def normalize_yahoo_symbol(symbol: str) -> str:
    """Return a provider-specific Yahoo Finance symbol for common user aliases."""
    raw = (symbol or "").strip().upper()
    return _YAHOO_SYMBOL_ALIASES.get(raw, raw)


def normalize_tradingview_symbol(symbol: str, exchange: str) -> str:
    """Return a fully-qualified TradingView symbol, resolving common index aliases."""
    raw = (symbol or "").strip().upper()
    if raw in _TRADINGVIEW_SYMBOL_ALIASES:
        return _TRADINGVIEW_SYMBOL_ALIASES[raw]
    if ":" in raw:
        return raw
    return f"{get_tv_exchange_prefix(exchange)}:{raw}"

# Get absolute path to coinlist directory relative to this module
# This file is at: src/tradingview_mcp/core/utils/validators.py
# We want: src/tradingview_mcp/coinlist/
_this_file = __file__
_utils_dir = os.path.dirname(_this_file)  # core/utils
_core_dir = os.path.dirname(_utils_dir)   # core  
_package_dir = os.path.dirname(_core_dir) # tradingview_mcp
COINLIST_DIR = os.path.join(_package_dir, 'coinlist')


def sanitize_timeframe(tf: str, default: str = "5m") -> str:
    if not tf:
        return default
    normalized = tf.strip().lower()
    return _TIMEFRAME_ALIASES.get(normalized, default)


def sanitize_exchange(ex: str, default: str = "kucoin") -> str:
    """Validate *ex*, falling back to *default* only when nothing was requested.

    An exchange that was explicitly asked for but is unknown is an error, not an
    invitation to substitute something else. The previous behaviour returned the
    default — usually a crypto venue — so a request for the Swiss blue chip
    ``SIX:NESN`` came back as "No data found for NESN on KUCOIN". That message
    describes the wrong market and hides the real cause, which is a missing
    entry in ``EXCHANGE_SCREENER``.
    """
    if not ex:
        return default
    exs = ex.strip().lower()
    if exs in EXCHANGE_SCREENER:
        return exs
    raise ValueError(
        f"Unknown exchange '{ex}'. Known exchanges: {', '.join(sorted(EXCHANGE_SCREENER))}"
    )


def is_stock_exchange(exchange: str) -> bool:
    """Return True if the exchange is a stock market (not crypto)."""
    return exchange.strip().lower() in STOCK_EXCHANGES


def get_market_type(exchange: str) -> str:
    """Return the TradingView market type for screener queries."""
    return EXCHANGE_SCREENER.get(exchange.strip().lower(), "crypto")
