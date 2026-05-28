"""Resilience layer for tradingview_ta calls.

Ported from mcp-servers/tradingview/src/tradingview_mcp/core/services/screener_provider.py.
The upstream TradingView scanner endpoint occasionally returns an empty body
under load, causing tradingview_ta to raise JSONDecodeError. We absorb those
blips with:

  - retry with exponential backoff
  - 60s TTL cache on successful results
  - in-flight throttle (max concurrent calls + min spacing between starts)

Tunables (env vars):
  TRADINGVIEW_MCP_CACHE_TTL      default 60 (seconds, 0 = disabled)
  TRADINGVIEW_MCP_RETRY_DELAYS   default "0.5,1.5,4.0"
  TRADINGVIEW_MCP_MAX_INFLIGHT   default 4
  TRADINGVIEW_MCP_MIN_INTERVAL_S default 0.8
"""

from __future__ import annotations

import json
import os
import sys
import time
from threading import Lock, RLock, Semaphore
from typing import Any, Dict, Optional, Tuple


def _cache_ttl_s() -> float:
    try:
        return float(os.environ.get("TRADINGVIEW_MCP_CACHE_TTL", "60"))
    except ValueError:
        return 60.0


def _retry_delays() -> Tuple[float, ...]:
    raw = os.environ.get("TRADINGVIEW_MCP_RETRY_DELAYS", "0.5,1.5,4.0")
    try:
        return tuple(float(x) for x in raw.split(",") if x.strip())
    except ValueError:
        return (0.5, 1.5, 4.0)


def _max_inflight() -> int:
    try:
        return max(1, int(os.environ.get("TRADINGVIEW_MCP_MAX_INFLIGHT", "4")))
    except ValueError:
        return 4


def _min_interval_s() -> float:
    try:
        return max(0.0, float(os.environ.get("TRADINGVIEW_MCP_MIN_INTERVAL_S", "0.8")))
    except ValueError:
        return 0.8


_CACHE: Dict[Tuple, Tuple[float, Any]] = {}
_CACHE_LOCK = RLock()

_SEMAPHORE = Semaphore(_max_inflight())
_INTERVAL_LOCK = Lock()
_LAST_CALL_TS: float = 0.0


def _cache_get(key: Tuple) -> Optional[Any]:
    ttl = _cache_ttl_s()
    if ttl <= 0:
        return None
    with _CACHE_LOCK:
        entry = _CACHE.get(key)
        if not entry:
            return None
        ts, payload = entry
        if time.time() - ts > ttl:
            _CACHE.pop(key, None)
            return None
        return payload


def _cache_set(key: Tuple, payload: Any) -> None:
    if _cache_ttl_s() <= 0:
        return
    with _CACHE_LOCK:
        _CACHE[key] = (time.time(), payload)


def _throttle_acquire() -> None:
    global _LAST_CALL_TS
    _SEMAPHORE.acquire()
    try:
        with _INTERVAL_LOCK:
            now = time.time()
            wait = _min_interval_s() - (now - _LAST_CALL_TS)
            if wait > 0:
                time.sleep(wait)
                now = time.time()
            _LAST_CALL_TS = now
    except BaseException:
        _SEMAPHORE.release()
        raise


def _throttle_release() -> None:
    _SEMAPHORE.release()


def _is_transient(exc: BaseException) -> bool:
    if isinstance(exc, json.JSONDecodeError):
        return True
    msg = str(exc)
    return any(
        marker in msg
        for marker in (
            "Expecting value",
            "Connection reset",
            "Connection aborted",
            "Read timed out",
            "Temporary failure",
        )
    )


def call_with_resilience(cache_key: Tuple, fn, *args, **kwargs):
    """Run `fn(*args, **kwargs)` with throttle + retry + TTL cache.

    `cache_key` should uniquely identify the call inputs.
    """
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    delays = (0.0,) + _retry_delays()
    last_exc: Optional[BaseException] = None
    for attempt, delay in enumerate(delays, start=1):
        if delay > 0:
            time.sleep(delay)
        try:
            _throttle_acquire()
            try:
                result = fn(*args, **kwargs)
            finally:
                _throttle_release()
            _cache_set(cache_key, result)
            return result
        except Exception as exc:
            if not _is_transient(exc):
                raise
            last_exc = exc
            print(
                f"[tradingview] transient error (attempt {attempt}/{len(delays)}): {exc!r}",
                file=sys.stderr,
            )
            continue

    assert last_exc is not None
    raise last_exc
