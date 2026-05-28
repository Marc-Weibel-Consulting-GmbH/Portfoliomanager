"""High-level TradingView TA helpers used by the FastAPI routes."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from .resilience import call_with_resilience

# Intervals supported by tradingview_ta + the labels we surface in the API.
INTERVAL_MAP: Dict[str, str] = {
    "1m": "1m",
    "5m": "5m",
    "15m": "15m",
    "30m": "30m",
    "1h": "1h",
    "2h": "2h",
    "4h": "4h",
    "1d": "1d",
    "1W": "1W",
    "1M": "1M",
}

# Reasonable default confluence set (intraday → swing → position).
DEFAULT_TIMEFRAMES: List[str] = ["15m", "1h", "1d", "1W"]


def _ta_interval(interval: str):
    """Resolve a string interval to the tradingview_ta Interval enum.

    Imported lazily so the dependency is only required when the route is hit.
    """
    from tradingview_ta import Interval

    mapping = {
        "1m": Interval.INTERVAL_1_MINUTE,
        "5m": Interval.INTERVAL_5_MINUTES,
        "15m": Interval.INTERVAL_15_MINUTES,
        "30m": Interval.INTERVAL_30_MINUTES,
        "1h": Interval.INTERVAL_1_HOUR,
        "2h": Interval.INTERVAL_2_HOURS,
        "4h": Interval.INTERVAL_4_HOURS,
        "1d": Interval.INTERVAL_1_DAY,
        "1W": Interval.INTERVAL_1_WEEK,
        "1M": Interval.INTERVAL_1_MONTH,
    }
    if interval not in mapping:
        raise ValueError(
            f"Unsupported interval '{interval}'. Allowed: {sorted(mapping)}"
        )
    return mapping[interval]


def _run_handler(symbol: str, exchange: str, screener: str, interval: str):
    """Execute a single TA_Handler request with the resilience layer."""
    from tradingview_ta import TA_Handler

    def _do() -> Any:
        handler = TA_Handler(
            symbol=symbol,
            exchange=exchange,
            screener=screener,
            interval=_ta_interval(interval),
        )
        return handler.get_analysis()

    cache_key = ("ta_handler_v1", screener, exchange, symbol, interval)
    return call_with_resilience(cache_key, _do)


def _summary_to_dict(summary: Optional[Dict[str, int]]) -> Dict[str, int]:
    if not summary:
        return {"BUY": 0, "SELL": 0, "NEUTRAL": 0}
    return {
        "BUY": int(summary.get("BUY", 0)),
        "SELL": int(summary.get("SELL", 0)),
        "NEUTRAL": int(summary.get("NEUTRAL", 0)),
    }


def _extract_indicators(indicators: Dict[str, Any]) -> Dict[str, Any]:
    """Pull the subset of indicators the frontend actually renders."""
    if not isinstance(indicators, dict):
        return {}

    def _val(*keys):
        for key in keys:
            if key in indicators and indicators[key] is not None:
                return indicators[key]
        return None

    return {
        "close": _val("close"),
        "open": _val("open"),
        "high": _val("high"),
        "low": _val("low"),
        "volume": _val("volume"),
        "change": _val("change"),
        "rsi": _val("RSI"),
        "rsi1": _val("RSI[1]"),
        "macd_macd": _val("MACD.macd"),
        "macd_signal": _val("MACD.signal"),
        "sma20": _val("SMA20"),
        "sma50": _val("SMA50"),
        "sma200": _val("SMA200"),
        "ema20": _val("EMA20"),
        "ema50": _val("EMA50"),
        "ema200": _val("EMA200"),
        "bb_upper": _val("BB.upper"),
        "bb_lower": _val("BB.lower"),
        "stoch_k": _val("Stoch.K"),
        "stoch_d": _val("Stoch.D"),
        "atr": _val("ATR"),
    }


def analyze_symbol(
    symbol: str,
    exchange: str,
    interval: str = "1d",
    screener: str = "america",
) -> Dict[str, Any]:
    """Return TradingView's recommendation + indicator snapshot for a symbol.

    Args:
      symbol:    e.g. "NVDA", "NESN" — the TradingView symbol code.
      exchange:  e.g. "NASDAQ", "SIX", "NYSE", "XETR".
      interval:  see INTERVAL_MAP.
      screener:  "america" (default), "switzerland", "germany", "crypto", ...
    """
    analysis = _run_handler(symbol, exchange, screener, interval)

    return {
        "symbol": symbol,
        "exchange": exchange,
        "screener": screener,
        "interval": interval,
        "recommendation": {
            "summary": getattr(analysis, "summary", {}).get("RECOMMENDATION"),
            "counts": _summary_to_dict(getattr(analysis, "summary", {})),
            "oscillators": {
                "recommendation": getattr(analysis, "oscillators", {}).get("RECOMMENDATION"),
                "counts": _summary_to_dict(getattr(analysis, "oscillators", {})),
            },
            "moving_averages": {
                "recommendation": getattr(analysis, "moving_averages", {}).get("RECOMMENDATION"),
                "counts": _summary_to_dict(getattr(analysis, "moving_averages", {})),
            },
        },
        "indicators": _extract_indicators(getattr(analysis, "indicators", {}) or {}),
    }


def multi_timeframe_analysis(
    symbol: str,
    exchange: str,
    screener: str = "america",
    intervals: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Run analyze_symbol across multiple timeframes and aggregate confluence."""
    frames = intervals or DEFAULT_TIMEFRAMES

    per_frame: List[Dict[str, Any]] = []
    confluence: Dict[str, int] = {"STRONG_BUY": 0, "BUY": 0, "NEUTRAL": 0, "SELL": 0, "STRONG_SELL": 0}

    for interval in frames:
        try:
            result = analyze_symbol(symbol, exchange, interval=interval, screener=screener)
            recommendation = (result.get("recommendation") or {}).get("summary") or "NEUTRAL"
            per_frame.append(
                {
                    "interval": interval,
                    "recommendation": recommendation,
                    "counts": result["recommendation"]["counts"],
                }
            )
            if recommendation in confluence:
                confluence[recommendation] += 1
            else:
                confluence["NEUTRAL"] += 1
        except Exception as exc:  # surface per-frame failure without killing the rest
            per_frame.append(
                {
                    "interval": interval,
                    "recommendation": None,
                    "error": str(exc),
                }
            )

    # Simple verdict: dominant non-neutral signal across frames.
    bullish = confluence["STRONG_BUY"] + confluence["BUY"]
    bearish = confluence["STRONG_SELL"] + confluence["SELL"]
    if bullish == 0 and bearish == 0:
        verdict = "NEUTRAL"
    elif bullish > bearish * 1.5:
        verdict = "BULLISH"
    elif bearish > bullish * 1.5:
        verdict = "BEARISH"
    else:
        verdict = "MIXED"

    return {
        "symbol": symbol,
        "exchange": exchange,
        "screener": screener,
        "frames": per_frame,
        "confluence": confluence,
        "verdict": verdict,
    }
