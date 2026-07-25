"""
Erweiterte Portfolio-Optimierung und Backtesting (skfolio + bt).

Ergaenzt exact_optimizer.py (PyPortfolioOpt, klassisches MVO) um zwei Verfahren
aus den GitHub-Empfehlungen (Paket "Analytics-Erweiterung"):

- skfolio (BSD-3): Hierarchical Risk Parity (HRP), CVaR-Minimierung und
  Max-Sharpe in scikit-learn-Konvention (fit/predict) — robuster gegen
  Schaetzfehler in den Erwartungsrenditen als klassisches MVO.
- bt (MIT): historische Portfolio-Backtests inkl. Rebalancing-Simulation
  (monatlich oder Buy-and-Hold) auf Portfolioebene.

Gleiche Arbeitsteilung wie exact_optimizer.py: dieses Modul holt keine eigenen
Kursdaten. Inputs sind Renditen bzw. Preise als pandas-DataFrame — identische
Inputs produzieren reproduzierbare Outputs. Fehler werden als ValueError
gemeldet; der HTTP-Layer (main.py) uebersetzt sie in 422-Antworten.
"""

from typing import Dict, List, Optional

import numpy as np
import pandas as pd

TRADING_DAYS_YEAR = 252

_VALID_METHODS = ("hrp", "min_cvar", "max_sharpe")
_VALID_REBALANCE = ("monthly", "none")


def _validate_returns(tickers: List[str], returns: pd.DataFrame) -> pd.DataFrame:
    if len(tickers) < 2:
        raise ValueError("Mindestens 2 Titel erforderlich.")
    missing = [t for t in tickers if t not in returns.columns]
    if missing:
        raise ValueError(f"Keine Renditedaten fuer: {', '.join(missing)}")
    df = returns[tickers].dropna()
    if len(df) < 30:
        raise ValueError(
            f"Zu wenige gemeinsame Datenpunkte ({len(df)}); mindestens 30 erforderlich."
        )
    return df


def optimize_portfolio(
    tickers: List[str],
    returns: pd.DataFrame,
    method: str = "hrp",
    min_weight: float = 0.0,
    max_weight: float = 1.0,
    risk_free_rate: float = 0.02,
) -> Dict:
    """
    Portfolio-Optimierung via skfolio.

    method:
      - "hrp":        Hierarchical Risk Parity (clusterbasiert, ohne mu-Schaetzung)
      - "min_cvar":   minimiert CVaR (95 %) unter Gewichts-Bounds
      - "max_sharpe": maximiert die Sharpe Ratio unter Gewichts-Bounds

    returns: DataFrame taeglicher Renditen (Zeilen = Tage, Spalten = tickers).
    """
    # Lazy import: fehlendes skfolio darf den Service-Boot nicht verhindern.
    from skfolio import RiskMeasure
    from skfolio.optimization import HierarchicalRiskParity, MeanRisk
    from skfolio.optimization import ObjectiveFunction

    if method not in _VALID_METHODS:
        raise ValueError(
            f"Unbekannte Methode: {method}. Erlaubt: {', '.join(_VALID_METHODS)}"
        )
    if not (0.0 <= min_weight <= max_weight <= 1.0):
        raise ValueError(f"Ungueltige Gewichts-Bounds: [{min_weight}, {max_weight}].")
    if len(tickers) * max_weight < 1 - 1e-9:
        raise ValueError(
            f"Bounds unerfüllbar: {len(tickers)} x max {max_weight} < 100 %."
        )

    df = _validate_returns(tickers, returns)

    if method == "hrp":
        model = HierarchicalRiskParity()
    elif method == "min_cvar":
        model = MeanRisk(
            objective_function=ObjectiveFunction.MINIMIZE_RISK,
            risk_measure=RiskMeasure.CVAR,
            min_weights=min_weight,
            max_weights=max_weight,
        )
    else:  # max_sharpe
        model = MeanRisk(
            objective_function=ObjectiveFunction.MAXIMIZE_RATIO,
            min_weights=min_weight,
            max_weights=max_weight,
        )

    try:
        model.fit(df)
    except Exception as exc:
        raise ValueError(f"Optimierung fehlgeschlagen: {exc}") from exc

    weights = np.asarray(model.weights_, dtype=float)
    if weights.sum() <= 0 or np.any(np.isnan(weights)):
        raise ValueError("Optimierung lieferte keine verwertbaren Gewichte.")

    port_returns = df.values @ weights
    ann_return = float(np.mean(port_returns) * TRADING_DAYS_YEAR)
    ann_vol = float(np.std(port_returns, ddof=1) * np.sqrt(TRADING_DAYS_YEAR))
    var95 = float(-np.percentile(port_returns, 5))
    tail = port_returns[port_returns <= -var95]
    cvar95 = float(-np.mean(tail)) if len(tail) else var95
    sharpe = (
        (ann_return - risk_free_rate) / ann_vol if ann_vol > 0 else 0.0
    )

    return {
        "method": method,
        "weights": {t: round(float(w), 6) for t, w in zip(tickers, weights)},
        "portfolio": {
            "annualReturn": round(ann_return * 100, 2),
            "volatility": round(ann_vol * 100, 2),
            "sharpeRatio": round(float(sharpe), 3),
            "var95": round(var95 * 100, 2),
            "cvar95": round(cvar95 * 100, 2),
        },
        "dataPoints": int(len(df)),
    }


def run_backtest(
    tickers: List[str],
    prices: pd.DataFrame,
    weights: List[float],
    rebalance: str = "monthly",
    initial_capital: float = 100_000.0,
) -> Dict:
    """
    Historischer Portfolio-Backtest via bt.

    prices: DataFrame von Preisen (Zeilen = Tage aufsteigend, Spalten = tickers).
    weights: Zielgewichte (Reihenfolge = tickers), Summe muss > 0 sein.
    rebalance: "monthly" (monatliches Rebalancing auf Zielgewichte) oder
               "none" (Buy-and-Hold nach einmaliger Allokation).
    """
    # Lazy import analog zu den Optimierern.
    import bt

    if rebalance not in _VALID_REBALANCE:
        raise ValueError(
            f"Unbekannter Rebalancing-Modus: {rebalance}. "
            f"Erlaubt: {', '.join(_VALID_REBALANCE)}"
        )
    if len(tickers) < 1:
        raise ValueError("Mindestens 1 Titel erforderlich.")
    if len(weights) != len(tickers):
        raise ValueError(
            f"weights hat {len(weights)} Eintraege, erwartet {len(tickers)}."
        )
    w = np.asarray(weights, dtype=float)
    if w.sum() <= 0:
        raise ValueError("Summe der Gewichte muss groesser als 0 sein.")
    w = w / w.sum()

    df = prices[tickers].dropna()
    if len(df) < 30:
        raise ValueError(
            f"Zu wenige gemeinsame Datenpunkte ({len(df)}); mindestens 30 erforderlich."
        )

    target = pd.DataFrame(
        np.tile(w, (len(df), 1)), index=df.index, columns=tickers
    )

    if rebalance == "monthly":
        algos = [
            bt.algos.RunMonthly(),
            bt.algos.SelectAll(),
            bt.algos.WeighTarget(target),
            bt.algos.Rebalance(),
        ]
    else:
        algos = [
            bt.algos.RunOnce(),
            bt.algos.SelectAll(),
            bt.algos.WeighTarget(target),
            bt.algos.Rebalance(),
        ]

    strategy = bt.Strategy("portfolio", algos)
    backtest = bt.Backtest(
        strategy, df, initial_capital=initial_capital, integer_positions=False
    )
    result = bt.run(backtest)

    equity = result.prices["portfolio"].dropna()
    if equity.empty:
        raise ValueError("Backtest lieferte keine Equity-Kurve.")

    stats = result.stats
    row = stats["portfolio"] if "portfolio" in stats.columns else stats.iloc[:, 0]

    def _stat(*names: str) -> Optional[float]:
        """Ersten verfuegbaren, nicht-NaN Statistikwert liefern (ffn-Versionen
        unterscheiden sich in den Key-Namen/Verfuegbarkeit)."""
        for name in names:
            try:
                value = row[name]
            except KeyError:
                continue
            if value is not None and not pd.isna(value):
                return float(value)
        return None

    # Equity-Kurve auf Monatswerte verdichten (Response-Groesse begrenzen).
    monthly = equity.resample("ME").last()
    if len(monthly) < 2:
        monthly = equity

    return {
        "rebalance": rebalance,
        "initialCapital": initial_capital,
        "weights": {t: round(float(wi), 6) for t, wi in zip(tickers, w)},
        "stats": {
            "totalReturnPct": round((_stat("total_return") or 0.0) * 100, 2),
            "cagrPct": round((_stat("cagr") or 0.0) * 100, 2),
            "annualVolPct": round((_stat("daily_vol", "yearly_vol") or 0.0) * 100, 2),
            "sharpe": round(_stat("daily_sharpe") or 0.0, 3),
            "sortino": round(_stat("daily_sortino") or 0.0, 3),
            "maxDrawdownPct": round((_stat("max_drawdown") or 0.0) * 100, 2),
            "calmar": round(_stat("calmar") or 0.0, 3),
        },
        "equityCurve": [
            {"date": idx.strftime("%Y-%m-%d"), "value": round(float(val), 2)}
            for idx, val in monthly.items()
        ],
        "dataPoints": int(len(df)),
    }
