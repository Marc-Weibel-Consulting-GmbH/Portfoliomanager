"""
Fincept Analytics Microservice
================================
FastAPI microservice exposing Fincept Terminal's Python analytics
as REST endpoints for the Portfoliomanager web application.

Endpoints:
  POST /analytics/risk-metrics             - VaR, Sharpe, Sortino, Max Drawdown
  POST /analytics/dcf                      - DCF valuation per stock
  POST /analytics/optimize                 - Portfolio optimization (Efficient Frontier)
  GET  /tradingview/ta/{symbol}            - TradingView TA snapshot for a symbol
  GET  /tradingview/ta/{symbol}/multi-tf   - Multi-timeframe confluence
  GET  /health                             - Health check
"""

import sys
import os
import json
import base64
import logging
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta

import numpy as np
import pandas as pd
import yfinance as yf
from scipy import stats, optimize
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from tradingview import analyze_symbol as tv_analyze_symbol
from tradingview import multi_timeframe_analysis as tv_multi_timeframe_analysis
from tradingview.ta_provider import DEFAULT_TIMEFRAMES as TV_DEFAULT_TIMEFRAMES
from tradingview.ta_provider import INTERVAL_MAP as TV_INTERVAL_MAP

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Fincept Analytics Service",
    description="Portfolio analytics powered by Fincept Terminal",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────
TRADING_DAYS_YEAR = 252
SQRT_TRADING_DAYS = np.sqrt(TRADING_DAYS_YEAR)
DEFAULT_RISK_FREE_RATE = 0.02  # 2% annual


# ─────────────────────────────────────────────
# Request / Response Models
# ─────────────────────────────────────────────

class HoldingInput(BaseModel):
    ticker: str
    weight: float          # 0.0 – 1.0
    currency: str = "USD"

class RiskMetricsRequest(BaseModel):
    holdings: List[HoldingInput]
    benchmark: str = "SPY"
    risk_free_rate: float = DEFAULT_RISK_FREE_RATE
    confidence_level: float = 0.95
    lookback_days: int = 252

class DCFRequest(BaseModel):
    ticker: str
    risk_free_rate: float = DEFAULT_RISK_FREE_RATE
    market_risk_premium: float = 0.055
    terminal_growth_rate: float = 0.025
    projection_years: int = 5

class OptimizeRequest(BaseModel):
    tickers: List[str]
    lookback_days: int = 252
    risk_free_rate: float = DEFAULT_RISK_FREE_RATE
    method: str = "max_sharpe"   # max_sharpe | min_variance | equal_weight


class TrainSeries(BaseModel):
    dates: List[str]
    prices: List[float]


class TrainRequest(BaseModel):
    kind: str = "gb_signal"
    seriesByTicker: Dict[str, TrainSeries]
    # Optional point-in-time fundamentals per ticker: { ticker: { featureName: [per-day values] } }
    fundamentalsByTicker: Optional[Dict[str, Dict[str, List[float]]]] = None
    lookahead: int = 20          # 20-day forward return (more predictable than 30)
    minHitRate: float = 0.52
    maxOverfitRatio: float = 5.0  # Realistic for financial ML (1.6 too strict)
    minAlpha: float = 0.01        # Require at least 1% positive OOS edge


# ─────────────────────────────────────────────
# Helper: Fetch historical returns via yfinance
# ─────────────────────────────────────────────

def normalize_ticker(ticker: str) -> str:
    """
    Normalize ticker symbols for yfinance compatibility.
    - Remove .US suffix (US stocks don't need it in yfinance)
    - Keep .SW, .L, .DE, .PA etc. for non-US exchanges
    """
    if ticker.endswith('.US'):
        return ticker[:-3]  # Remove .US suffix
    return ticker


def fetch_returns(tickers: List[str], lookback_days: int) -> pd.DataFrame:
    """Download adjusted close prices and compute daily returns."""
    # Normalize tickers for yfinance
    normalized_map = {t: normalize_ticker(t) for t in tickers}
    normalized_tickers = list(dict.fromkeys(normalized_map.values()))  # deduplicate, preserve order

    end = datetime.today()
    start = end - timedelta(days=int(lookback_days * 1.5))  # buffer for weekends/holidays

    try:
        raw = yf.download(
            normalized_tickers if len(normalized_tickers) > 1 else normalized_tickers[0],
            start=start.strftime("%Y-%m-%d"),
            end=end.strftime("%Y-%m-%d"),
            auto_adjust=True,
            progress=False,
            threads=True,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"yfinance error: {e}")

    if isinstance(raw.columns, pd.MultiIndex):
        prices = raw["Close"]
    elif len(normalized_tickers) == 1:
        prices = raw[["Close"]]
        prices.columns = normalized_tickers
    else:
        prices = raw[["Close"]]
        prices.columns = normalized_tickers

    # Drop columns with all NaN (tickers that returned no data)
    prices = prices.dropna(axis=1, how='all')

    if prices.empty:
        raise HTTPException(status_code=422, detail="No price data available for any of the requested tickers.")

    prices = prices.ffill().tail(lookback_days + 1)
    returns = prices.pct_change().dropna()

    if returns.empty:
        raise HTTPException(status_code=422, detail="Insufficient price data for the requested tickers.")

    # Rename columns back to original ticker names (using normalized -> original mapping)
    reverse_map = {v: k for k, v in normalized_map.items()}
    returns.columns = [reverse_map.get(c, c) for c in returns.columns]

    return returns


# ─────────────────────────────────────────────
# Core Analytics Functions (from Fincept)
# ─────────────────────────────────────────────

def calc_sharpe(returns: np.ndarray, rf: float = DEFAULT_RISK_FREE_RATE) -> float:
    excess = returns - rf / TRADING_DAYS_YEAR
    std = np.std(excess, ddof=1)
    if std == 0:
        return 0.0
    return float(np.mean(excess) / std * SQRT_TRADING_DAYS)


def calc_sortino(returns: np.ndarray, rf: float = DEFAULT_RISK_FREE_RATE) -> float:
    excess = returns - rf / TRADING_DAYS_YEAR
    downside = returns[returns < 0]
    if len(downside) == 0:
        return 0.0
    downside_dev = np.sqrt(np.mean(downside ** 2)) * SQRT_TRADING_DAYS
    if downside_dev == 0:
        return 0.0
    return float(np.mean(excess) * TRADING_DAYS_YEAR / downside_dev)


def calc_var_historical(returns: np.ndarray, confidence: float = 0.95) -> float:
    """Historical VaR (positive = loss)."""
    return float(-np.percentile(returns, (1 - confidence) * 100))


def calc_var_parametric(returns: np.ndarray, confidence: float = 0.95) -> float:
    """Parametric VaR."""
    mu = np.mean(returns)
    sigma = np.std(returns, ddof=1)
    z = stats.norm.ppf(1 - confidence)
    return float(-(mu + z * sigma))


def calc_cvar(returns: np.ndarray, confidence: float = 0.95) -> float:
    """Conditional VaR (Expected Shortfall)."""
    var = calc_var_historical(returns, confidence)
    tail = returns[returns <= -var]
    if len(tail) == 0:
        return var
    return float(-np.mean(tail))


def calc_max_drawdown(returns: np.ndarray) -> float:
    """Maximum drawdown from a returns series."""
    cumulative = np.cumprod(1 + returns)
    running_max = np.maximum.accumulate(cumulative)
    drawdown = (cumulative - running_max) / running_max
    return float(np.min(drawdown))


def calc_beta(portfolio_returns: np.ndarray, benchmark_returns: np.ndarray) -> float:
    cov = np.cov(portfolio_returns, benchmark_returns, ddof=1)[0, 1]
    var = np.var(benchmark_returns, ddof=1)
    return float(cov / var) if var != 0 else 0.0


def calc_volatility(returns: np.ndarray) -> float:
    return float(np.std(returns, ddof=1) * SQRT_TRADING_DAYS)


def calc_calmar(returns: np.ndarray) -> float:
    annual_return = float(np.mean(returns) * TRADING_DAYS_YEAR)
    max_dd = abs(calc_max_drawdown(returns))
    if max_dd == 0:
        return 0.0
    return annual_return / max_dd


# ─────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "service": "fincept-analytics", "version": "1.0.0"}


@app.post("/analytics/risk-metrics")
def risk_metrics(req: RiskMetricsRequest):
    """
    Calculate comprehensive risk metrics for a portfolio:
    VaR, CVaR, Sharpe, Sortino, Calmar, Beta, Max Drawdown, Volatility
    """
    tickers = [h.ticker for h in req.holdings]
    weights = np.array([h.weight for h in req.holdings])

    # Normalise weights
    total_w = weights.sum()
    if total_w > 0:
        weights = weights / total_w

    # Fetch returns
    all_tickers = list(set(tickers + [req.benchmark]))
    returns_df = fetch_returns(all_tickers, req.lookback_days)

    # Align tickers that exist in the data
    available = [t for t in tickers if t in returns_df.columns]
    if not available:
        raise HTTPException(status_code=422, detail="None of the provided tickers returned data.")

    # Recompute weights for available tickers only
    avail_idx = [tickers.index(t) for t in available]
    weights_avail = weights[avail_idx]
    if weights_avail.sum() > 0:
        weights_avail = weights_avail / weights_avail.sum()

    asset_returns = returns_df[available].values
    portfolio_returns = asset_returns @ weights_avail

    benchmark_returns = (
        returns_df[req.benchmark].values
        if req.benchmark in returns_df.columns
        else None
    )

    # ── Core metrics ──
    sharpe = calc_sharpe(portfolio_returns, req.risk_free_rate)
    sortino = calc_sortino(portfolio_returns, req.risk_free_rate)
    var_hist = calc_var_historical(portfolio_returns, req.confidence_level)
    var_param = calc_var_parametric(portfolio_returns, req.confidence_level)
    cvar = calc_cvar(portfolio_returns, req.confidence_level)
    max_dd = calc_max_drawdown(portfolio_returns)
    volatility = calc_volatility(portfolio_returns)
    calmar = calc_calmar(portfolio_returns)
    annual_return = float(np.mean(portfolio_returns) * TRADING_DAYS_YEAR)

    beta = None
    treynor = None
    information_ratio = None
    if benchmark_returns is not None:
        beta = calc_beta(portfolio_returns, benchmark_returns)
        excess_rf = annual_return - req.risk_free_rate
        treynor = excess_rf / beta if beta != 0 else None
        excess_bench = portfolio_returns - benchmark_returns
        te = np.std(excess_bench, ddof=1) * SQRT_TRADING_DAYS
        information_ratio = float(np.mean(excess_bench) * TRADING_DAYS_YEAR / te) if te != 0 else 0.0

    # ── Per-asset metrics ──
    asset_metrics = []
    for i, ticker in enumerate(available):
        ar = returns_df[ticker].values
        asset_metrics.append({
            "ticker": ticker,
            "weight": float(weights_avail[i]),
            "annualReturn": float(np.mean(ar) * TRADING_DAYS_YEAR * 100),
            "volatility": float(calc_volatility(ar) * 100),
            "sharpe": float(calc_sharpe(ar, req.risk_free_rate)),
            "beta": float(calc_beta(ar, benchmark_returns)) if benchmark_returns is not None else None,
            "var95": float(calc_var_historical(ar, 0.95) * 100),
            "maxDrawdown": float(calc_max_drawdown(ar) * 100),
        })

    return {
        "portfolio": {
            "annualReturn": round(annual_return * 100, 2),
            "volatility": round(volatility * 100, 2),
            "sharpeRatio": round(sharpe, 3),
            "sortinoRatio": round(sortino, 3),
            "calmarRatio": round(calmar, 3),
            "beta": round(beta, 3) if beta is not None else None,
            "treynorRatio": round(treynor, 3) if treynor is not None else None,
            "informationRatio": round(information_ratio, 3) if information_ratio is not None else None,
            "varHistorical95": round(var_hist * 100, 2),
            "varParametric95": round(var_param * 100, 2),
            "cvar95": round(cvar * 100, 2),
            "maxDrawdown": round(max_dd * 100, 2),
            "dataPoints": len(portfolio_returns),
            "benchmark": req.benchmark,
        },
        "assets": asset_metrics,
    }


@app.post("/analytics/dcf")
def dcf_valuation(req: DCFRequest):
    """
    Simple DCF valuation using yfinance fundamentals.
    Returns intrinsic value estimate and upside/downside vs current price.
    """
    try:
        ticker_obj = yf.Ticker(req.ticker)
        info = ticker_obj.info
        cashflow = ticker_obj.cashflow
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"yfinance error: {e}")

    current_price = info.get("currentPrice") or info.get("regularMarketPrice")
    if not current_price:
        raise HTTPException(status_code=422, detail="Current price not available.")

    # Free Cash Flow
    fcf = None
    if cashflow is not None and not cashflow.empty:
        for row_name in ["Free Cash Flow", "FreeCashFlow"]:
            if row_name in cashflow.index:
                fcf_series = cashflow.loc[row_name].dropna()
                if not fcf_series.empty:
                    fcf = float(fcf_series.iloc[0])
                    break

    if fcf is None:
        # Fallback: use operating cash flow - capex
        op_cf = info.get("operatingCashflow")
        capex = info.get("capitalExpenditures")
        if op_cf and capex:
            fcf = op_cf - abs(capex)

    if fcf is None or fcf <= 0:
        raise HTTPException(
            status_code=422,
            detail="Insufficient free cash flow data for DCF valuation."
        )

    shares = info.get("sharesOutstanding") or info.get("impliedSharesOutstanding")
    if not shares or shares <= 0:
        raise HTTPException(status_code=422, detail="Shares outstanding not available.")

    # Revenue growth estimate
    revenue_growth = info.get("revenueGrowth") or 0.05
    revenue_growth = max(min(revenue_growth, 0.30), -0.10)  # cap at ±30%

    # WACC estimate
    beta_val = info.get("beta") or 1.0
    cost_of_equity = req.risk_free_rate + beta_val * req.market_risk_premium
    debt_ratio = 0.3  # simplified assumption
    cost_of_debt = 0.04
    tax_rate = 0.21
    wacc = cost_of_equity * (1 - debt_ratio) + cost_of_debt * (1 - tax_rate) * debt_ratio

    # Project FCF for N years
    projected_fcf = []
    for year in range(1, req.projection_years + 1):
        growth = revenue_growth * max(0.5, 1 - year * 0.1)  # declining growth
        projected_fcf.append(fcf * (1 + growth) ** year)

    # Terminal value
    terminal_fcf = projected_fcf[-1] * (1 + req.terminal_growth_rate)
    terminal_value = terminal_fcf / (wacc - req.terminal_growth_rate) if wacc > req.terminal_growth_rate else 0

    # Discount to present value
    pv_fcf = sum(cf / (1 + wacc) ** (i + 1) for i, cf in enumerate(projected_fcf))
    pv_terminal = terminal_value / (1 + wacc) ** req.projection_years

    intrinsic_value_total = pv_fcf + pv_terminal
    intrinsic_value_per_share = intrinsic_value_total / shares

    upside_pct = ((intrinsic_value_per_share - current_price) / current_price) * 100

    return {
        "ticker": req.ticker,
        "currentPrice": round(current_price, 2),
        "intrinsicValue": round(intrinsic_value_per_share, 2),
        "upsideDownside": round(upside_pct, 1),
        "wacc": round(wacc * 100, 2),
        "terminalGrowthRate": round(req.terminal_growth_rate * 100, 2),
        "projectionYears": req.projection_years,
        "freeCashFlow": round(fcf, 0),
        "sharesOutstanding": shares,
        "beta": round(beta_val, 2),
        "revenueGrowthEstimate": round(revenue_growth * 100, 1),
        "projectedFCF": [round(v, 0) for v in projected_fcf],
        "pvFCF": round(pv_fcf, 0),
        "pvTerminalValue": round(pv_terminal, 0),
        "currency": info.get("currency", "USD"),
        "companyName": info.get("longName") or req.ticker,
    }


@app.post("/analytics/optimize")
def optimize_portfolio(req: OptimizeRequest):
    """
    Portfolio optimization using Modern Portfolio Theory.
    Returns optimal weights for max Sharpe, min variance, or equal weight.
    Also returns efficient frontier points.
    """
    if len(req.tickers) < 2:
        raise HTTPException(status_code=422, detail="At least 2 tickers required for optimization.")

    returns_df = fetch_returns(req.tickers, req.lookback_days)
    available = [t for t in req.tickers if t in returns_df.columns]

    if len(available) < 2:
        raise HTTPException(status_code=422, detail="Insufficient data for optimization.")

    returns_data = returns_df[available]
    mu = returns_data.mean().values * TRADING_DAYS_YEAR          # annualised expected returns
    cov = returns_data.cov().values * TRADING_DAYS_YEAR           # annualised covariance
    n = len(available)

    def portfolio_stats(w):
        ret = np.dot(w, mu)
        vol = np.sqrt(np.dot(w.T, np.dot(cov, w)))
        sharpe = (ret - req.risk_free_rate) / vol if vol > 0 else 0
        return ret, vol, sharpe

    bounds = [(0.0, 1.0)] * n
    constraints = [{"type": "eq", "fun": lambda w: np.sum(w) - 1.0}]
    x0 = np.ones(n) / n

    # ── Optimal portfolio ──
    if req.method == "max_sharpe":
        def neg_sharpe(w):
            r, v, s = portfolio_stats(w)
            return -s
        res = optimize.minimize(neg_sharpe, x0, method="SLSQP", bounds=bounds, constraints=constraints)
        optimal_weights = res.x
    elif req.method == "min_variance":
        def portfolio_vol(w):
            return np.sqrt(np.dot(w.T, np.dot(cov, w)))
        res = optimize.minimize(portfolio_vol, x0, method="SLSQP", bounds=bounds, constraints=constraints)
        optimal_weights = res.x
    else:  # equal_weight
        optimal_weights = np.ones(n) / n

    opt_ret, opt_vol, opt_sharpe = portfolio_stats(optimal_weights)

    # ── Efficient Frontier (50 points) ──
    min_ret = float(np.min(mu))
    max_ret = float(np.max(mu))
    target_returns = np.linspace(min_ret, max_ret, 50)

    frontier = []
    for target in target_returns:
        cons = constraints + [{"type": "eq", "fun": lambda w, t=target: np.dot(w, mu) - t}]
        try:
            r = optimize.minimize(
                lambda w: np.dot(w.T, np.dot(cov, w)),
                x0, method="SLSQP", bounds=bounds, constraints=cons,
                options={"maxiter": 500, "ftol": 1e-9}
            )
            if r.success:
                _, vol, _ = portfolio_stats(r.x)
                frontier.append({"return": round(target * 100, 2), "volatility": round(vol * 100, 2), "sharpe": round((target - req.risk_free_rate) / vol, 3) if vol > 0 else 0})
        except Exception:
            pass

    # ── Per-asset stats ──
    asset_stats = []
    for i, ticker in enumerate(available):
        ar = returns_data[ticker].values
        asset_stats.append({
            "ticker": ticker,
            "currentWeight": round(1.0 / n * 100, 1),
            "optimalWeight": round(float(optimal_weights[i]) * 100, 1),
            "annualReturn": round(float(mu[i]) * 100, 2),
            "volatility": round(float(np.sqrt(cov[i, i])) * 100, 2),
            "sharpe": round(calc_sharpe(ar, req.risk_free_rate), 3),
        })

    # Calculate current portfolio stats (equal weight as baseline)
    current_weights = np.ones(n) / n
    curr_ret, curr_vol, curr_sharpe = portfolio_stats(current_weights)

    return {
        "method": req.method,
        "optimalPortfolio": {
            "expectedReturn": round(opt_ret, 4),   # decimal (e.g. 0.5921 = 59.21%)
            "volatility": round(opt_vol, 4),        # decimal (e.g. 0.1434 = 14.34%)
            "sharpe": round(opt_sharpe, 3),
            # Legacy fields for backward compat
            "annualReturn": round(opt_ret * 100, 2),
            "sharpeRatio": round(opt_sharpe, 3),
        },
        "currentPortfolio": {
            "expectedReturn": round(curr_ret, 4),
            "volatility": round(curr_vol, 4),
            "sharpe": round(curr_sharpe, 3),
        },
        "weights": {ticker: round(float(w), 4) for ticker, w in zip(available, optimal_weights)},
        "assets": asset_stats,
        "efficientFrontier": [
            {
                "expectedReturn": round(p["return"] / 100, 4),  # convert % to decimal
                "volatility": round(p["volatility"] / 100, 4),  # convert % to decimal
                "sharpe": round((p["return"] / 100 - req.risk_free_rate) / (p["volatility"] / 100), 3) if p["volatility"] > 0 else 0,
                # Legacy fields
                "return": p["return"],
            }
            for p in frontier
        ],
        "tickers": available,
    }


# ─────────────────────────────────────────────
# ML pre-training: Gradient-Boosting + walk-forward + ONNX export
# ─────────────────────────────────────────────


@app.post("/analytics/train")
def train_signal_model(req: TrainRequest):
    """Pooled GB training over the supplied universe; returns ONNX (base64) +
    feature_spec + OOS metrics + promotion-gate verdict. The TS caller persists
    the artifact and promotes it if passedGate is true."""
    import ml_training as mt

    series = {tk: {"dates": s.dates, "prices": s.prices}
              for tk, s in req.seriesByTicker.items()}
    fundamentals = None
    if req.fundamentalsByTicker:
        fundamentals = {
            tk: {k: np.asarray(v, dtype=float) for k, v in d.items()}
            for tk, d in req.fundamentalsByTicker.items()
        }
    cfg = mt.TrainConfig(lookahead=req.lookahead)
    gate = mt.GateConfig(min_hit_rate=req.minHitRate,
                         max_overfit_ratio=req.maxOverfitRatio,
                         min_alpha=req.minAlpha)
    try:
        res = mt.train_and_export_pooled(series, cfg, gate, fundamentals)
    except Exception as exc:
        logger.exception("train_signal_model failed")
        raise HTTPException(status_code=500, detail=f"training error: {exc}")

    return {
        "kind": req.kind,
        "metrics": res.metrics,
        "featureSpec": res.feature_spec,
        "passedGate": res.passed_gate,
        "onnxBase64": base64.b64encode(res.onnx_bytes).decode() if res.onnx_bytes else None,
        "notes": res.notes,
    }


# ─────────────────────────────────────────────
# TradingView Technical Analysis Endpoints
# ─────────────────────────────────────────────


@app.get("/tradingview/ta/{symbol}")
def tradingview_ta(
    symbol: str,
    exchange: str = Query(..., description="TradingView exchange code, e.g. NASDAQ, NYSE, SIX, XETR"),
    interval: str = Query("1d", description=f"One of: {', '.join(TV_INTERVAL_MAP)}"),
    screener: str = Query("america", description="TradingView screener: america, switzerland, germany, crypto, ..."),
):
    """Return TradingView recommendation + indicator snapshot for a single symbol."""
    if interval not in TV_INTERVAL_MAP:
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported interval '{interval}'. Allowed: {sorted(TV_INTERVAL_MAP)}",
        )
    try:
        return tv_analyze_symbol(symbol=symbol, exchange=exchange, interval=interval, screener=screener)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        logger.exception("tradingview_ta failed for %s/%s", exchange, symbol)
        raise HTTPException(status_code=502, detail=f"TradingView error: {exc}")


@app.get("/tradingview/ta/{symbol}/multi-tf")
def tradingview_multi_tf(
    symbol: str,
    exchange: str = Query(..., description="TradingView exchange code"),
    screener: str = Query("america"),
    intervals: Optional[str] = Query(
        None,
        description=f"Comma-separated intervals. Default: {','.join(TV_DEFAULT_TIMEFRAMES)}",
    ),
):
    """Run TA across multiple timeframes and aggregate a confluence verdict."""
    frames = [i.strip() for i in intervals.split(",")] if intervals else None
    if frames:
        for f in frames:
            if f not in TV_INTERVAL_MAP:
                raise HTTPException(
                    status_code=422,
                    detail=f"Unsupported interval '{f}'. Allowed: {sorted(TV_INTERVAL_MAP)}",
                )
    try:
        return tv_multi_timeframe_analysis(
            symbol=symbol,
            exchange=exchange,
            screener=screener,
            intervals=frames,
        )
    except Exception as exc:
        logger.exception("tradingview_multi_tf failed for %s/%s", exchange, symbol)
        raise HTTPException(status_code=502, detail=f"TradingView error: {exc}")


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("ANALYTICS_PORT", 8001))
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
