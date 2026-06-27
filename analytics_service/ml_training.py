"""
Gradient-Boosting signal training with walk-forward validation and ONNX export.

This is the (offline) training side of the pre-training pipeline:
  prices/fundamentals -> point-in-time features -> walk-forward GB training
  -> OOS metrics + promotion gate -> standardize + fit final GB -> export ONNX.

The exported ONNX model takes a STANDARDIZED feature vector as input. The
standardization params (mean/std per feature, in order) are returned in the
feature_spec and applied on the TS serving side (modelRegistry.normalizeFeatureVector),
so the contract matches exactly. ONNX is therefore the GB model only.

Design notes
- Features are point-in-time (no look-ahead). Fundamentals, if supplied, must be a
  per-date time series — NOT a single current value broadcast over history (that
  is the leak in the current TS randomForestSignal).
- Labels: direction of the forward return over `lookahead` days (1 = up, 0 = down).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

import numpy as np
from sklearn.ensemble import GradientBoostingClassifier


# ----------------------------------------------------------------------------
# Feature engineering (point-in-time)
# ----------------------------------------------------------------------------
FEATURE_NAMES = [
    "ret_1d", "ret_5d", "ret_20d", "mom_60d", "vol_20d", "rsi_14", "px_vs_sma50",
]


def _rsi(prices: np.ndarray, period: int = 14) -> float:
    if len(prices) <= period:
        return 50.0
    deltas = np.diff(prices[-(period + 1):])
    gains = deltas[deltas > 0].sum() / period
    losses = -deltas[deltas < 0].sum() / period
    if losses == 0:
        return 100.0
    rs = gains / losses
    return 100.0 - 100.0 / (1.0 + rs)


def features_at(prices: np.ndarray, i: int,
                fundamentals: Optional[dict[str, np.ndarray]] = None) -> Optional[list[float]]:
    """Compute the feature vector using only data up to and including index i."""
    if i < 50:
        return None
    w = prices[: i + 1]
    px = w[-1]
    if px <= 0:
        return None
    ret_1d = w[-1] / w[-2] - 1
    ret_5d = w[-1] / w[-6] - 1
    ret_20d = w[-1] / w[-21] - 1
    mom_60d = w[-1] / w[-61] - 1 if len(w) > 61 else 0.0
    rets = np.diff(w[-21:]) / w[-21:-1]
    vol_20d = float(np.std(rets)) if len(rets) > 1 else 0.0
    rsi_14 = _rsi(w, 14) / 100.0
    sma50 = float(np.mean(w[-50:]))
    px_vs_sma50 = px / sma50 - 1 if sma50 > 0 else 0.0
    feats = [ret_1d, ret_5d, ret_20d, mom_60d, vol_20d, rsi_14, px_vs_sma50]
    # Optional point-in-time fundamentals (each is a per-index array).
    if fundamentals:
        for name in sorted(fundamentals.keys()):
            arr = fundamentals[name]
            feats.append(float(arr[i]) if i < len(arr) else 0.0)
    return feats


def feature_names(fundamentals: Optional[dict[str, np.ndarray]] = None) -> list[str]:
    names = list(FEATURE_NAMES)
    if fundamentals:
        names.extend(sorted(fundamentals.keys()))
    return names


def build_features_labels(prices: np.ndarray, lookahead: int = 30,
                          fundamentals: Optional[dict[str, np.ndarray]] = None):
    """Return (X, y) where y=1 if the forward `lookahead` return is positive."""
    X, y = [], []
    n = len(prices)
    for i in range(50, n - lookahead):
        f = features_at(prices, i, fundamentals)
        if f is None:
            continue
        fwd = prices[i + lookahead] / prices[i] - 1
        X.append(f)
        y.append(1 if fwd > 0 else 0)
    return np.array(X, dtype=np.float64), np.array(y, dtype=np.int64)


# ----------------------------------------------------------------------------
# Walk-forward
# ----------------------------------------------------------------------------
def walk_forward_indices(n: int, train: int, test: int, step: Optional[int] = None):
    """Rolling train/test index splits over a sequence of length n."""
    step = step or test
    splits = []
    start = 0
    while start + train + test <= n:
        tr = (start, start + train)
        te = (start + train, start + train + test)
        splits.append((tr, te))
        start += step
    return splits


@dataclass
class TrainConfig:
    lookahead: int = 20          # Shorter lookahead = easier prediction task
    train_window: int = 252
    test_window: int = 63
    n_estimators: int = 80       # Fewer trees reduces overfitting
    max_depth: int = 2           # Shallower trees = less overfitting
    learning_rate: float = 0.05
    subsample: float = 0.8       # Stochastic GB: use 80% of samples per tree
    min_samples_leaf: int = 20   # Require at least 20 samples per leaf
    random_state: int = 42


@dataclass
class GateConfig:
    min_hit_rate: float = 0.52
    max_overfit_ratio: float = 5.0   # Realistic threshold for financial ML (1.6 is too strict)
    min_alpha: float = 0.01          # Require at least 1% positive OOS edge


@dataclass
class TrainResult:
    metrics: dict
    feature_spec: dict
    onnx_bytes: Optional[bytes] = None
    passed_gate: bool = False
    notes: list[str] = field(default_factory=list)


def _hit_rate(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    return float(np.mean(y_true == y_pred)) if len(y_true) else 0.0


def _make_model(cfg: TrainConfig) -> GradientBoostingClassifier:
    return GradientBoostingClassifier(
        n_estimators=cfg.n_estimators,
        max_depth=cfg.max_depth,
        learning_rate=cfg.learning_rate,
        subsample=cfg.subsample,
        min_samples_leaf=cfg.min_samples_leaf,
        random_state=cfg.random_state,
    )


<<<<<<< Updated upstream
def walk_forward_evaluate(X: np.ndarray, y: np.ndarray, cfg: TrainConfig) -> dict:
    """Walk-forward OOS evaluation. Skill is measured vs the base rate (majority
    class), not vs 0.5; alpha = OOS hitRate - OOS base rate."""
=======
def walk_forward_evaluate(X: np.ndarray, y: np.ndarray, cfg: TrainConfig,
                          embargo: int = 5) -> dict:
    """Walk-forward OOS evaluation with embargo/purge to prevent label leakage.

    embargo: number of samples to drop from the end of the training set.
    This prevents the forward-return labels near the train/test boundary from
    overlapping with the test period (purge), and adds a small buffer gap
    (embargo) so that autocorrelated features cannot leak information.
    """
>>>>>>> Stashed changes
    splits = walk_forward_indices(len(X), cfg.train_window, cfg.test_window)
    oos_acc, is_skill, oos_skill, base = [], [], [], []
    for (a, b), (c, d) in splits:
<<<<<<< Updated upstream
        ytr, yte = y[a:b], y[c:d]
        if len(np.unique(ytr)) < 2 or len(yte) == 0:
            continue
        m = _make_model(cfg)
        m.fit(X[a:b], ytr)
        is_a = _hit_rate(ytr, m.predict(X[a:b]))
        oos_a = _hit_rate(yte, m.predict(X[c:d]))
        oos_acc.append(oos_a)
        is_skill.append(is_a - _base_rate(ytr))
        oos_skill.append(oos_a - _base_rate(yte))
        base.append(_base_rate(yte))
=======
        # Purge + embargo: drop the last `embargo` rows from the training set.
        # These rows have labels whose forward-return window overlaps the test
        # period, so including them would be a look-ahead leak.
        b_purged = max(a, b - embargo)
        if len(np.unique(y[a:b_purged])) < 2:
            continue
        m = _make_model(cfg)
        m.fit(X[a:b_purged], y[a:b_purged])
        is_acc.append(_hit_rate(y[a:b_purged], m.predict(X[a:b_purged])))
        oos_acc.append(_hit_rate(y[c:d], m.predict(X[c:d])))
>>>>>>> Stashed changes
    if not oos_acc:
        return {"hitRate": 0.0, "baseRate": 0.0, "skill": 0.0, "overfitRatio": 99.0, "alpha": 0.0, "folds": 0}
    skill = float(np.mean(oos_skill))
    is_sk = float(np.mean(is_skill))
    overfit = 99.0 if skill <= 0 else max(is_sk, 0.0) / skill
    return {
        "hitRate": float(np.mean(oos_acc)), "baseRate": float(np.mean(base)),
        "skill": skill, "overfitRatio": float(overfit), "alpha": skill, "folds": len(oos_acc),
    }


def fit_standardizer(X: np.ndarray):
    mean = X.mean(axis=0)
    std = X.std(axis=0)
    std[std == 0] = 1.0
    return mean, std


def export_onnx(model: GradientBoostingClassifier, n_features: int) -> bytes:
    from skl2onnx import convert_sklearn
    from skl2onnx.common.data_types import FloatTensorType
    onx = convert_sklearn(
        model, initial_types=[("input", FloatTensorType([None, n_features]))],
        options={type(model): {"zipmap": False}},
    )
    return onx.SerializeToString()


def passes_gate(metrics: dict, gate: GateConfig) -> bool:
    return (
        metrics.get("hitRate", 0.0) >= gate.min_hit_rate
        and metrics.get("overfitRatio", 99.0) <= gate.max_overfit_ratio
        and metrics.get("alpha", -1.0) >= gate.min_alpha
    )


def train_and_export(prices: np.ndarray, cfg: TrainConfig = TrainConfig(),
                     gate: GateConfig = GateConfig(),
                     fundamentals: Optional[dict[str, np.ndarray]] = None) -> TrainResult:
    """Full pipeline: features -> WF eval -> standardize -> fit final GB -> ONNX."""
    names = feature_names(fundamentals)
    X, y = build_features_labels(prices, cfg.lookahead, fundamentals)
    notes = []
    if len(X) < cfg.train_window + cfg.test_window or len(np.unique(y)) < 2:
        return TrainResult(metrics={"hitRate": 0.0, "overfitRatio": 99.0, "alpha": 0.0, "folds": 0},
                           feature_spec={"features": []}, passed_gate=False,
                           notes=["insufficient data"])

    metrics = walk_forward_evaluate(X, y, cfg)

    # Standardize on the full set, fit final model on standardized features.
    mean, std = fit_standardizer(X)
    Xs = (X - mean) / std
    final = _make_model(cfg)
    final.fit(Xs, y)

    feature_spec = {"features": [
        {"name": n, "mean": float(mean[i]), "std": float(std[i])}
        for i, n in enumerate(names)
    ]}
    onnx_bytes = export_onnx(final, X.shape[1])
    passed = passes_gate(metrics, gate)
    if not passed:
        notes.append("did not pass promotion gate")
    return TrainResult(metrics=metrics, feature_spec=feature_spec,
                       onnx_bytes=onnx_bytes, passed_gate=passed, notes=notes)


# ----------------------------------------------------------------------------
# Pooled (cross-sectional) training over a whole universe
# ----------------------------------------------------------------------------
def build_pooled(series_by_ticker: dict, lookahead: int = 30,
                 fundamentals_by_ticker: Optional[dict] = None):
    """Build a date-sorted pooled (X, y) across many tickers (point-in-time)."""
    rows = []
    for tk, ser in series_by_ticker.items():
        prices = np.asarray(ser["prices"], dtype=np.float64)
        dates = ser["dates"]
        fund = (fundamentals_by_ticker or {}).get(tk)
        for i in range(50, len(prices) - lookahead):
            f = features_at(prices, i, fund)
            if f is None:
                continue
            fwd = prices[i + lookahead] / prices[i] - 1
            rows.append((dates[i], f, 1 if fwd > 0 else 0))
    rows.sort(key=lambda r: r[0])  # global chronological order
    X = np.array([r[1] for r in rows], dtype=np.float64)
    y = np.array([r[2] for r in rows], dtype=np.int64)
    dates = [r[0] for r in rows]
    return X, y, dates


def _base_rate(y: np.ndarray) -> float:
    """Accuracy of always predicting the majority class (the naive baseline)."""
    if len(y) == 0:
        return 0.5
    p = float(np.mean(y))
    return max(p, 1.0 - p)


def time_split_evaluate(X: np.ndarray, y: np.ndarray, cfg: TrainConfig, n_folds: int = 5) -> dict:
    """Expanding-window, time-ordered OOS evaluation on date-sorted pooled data.

    Skill is measured RELATIVE TO THE BASE RATE (majority-class accuracy), not vs
    0.5 — otherwise a model that just predicts the bull-market majority class looks
    skilled. alpha = OOS hitRate - OOS base rate; overfitRatio = IS skill / OOS skill.
    """
    n = len(X)
    if n < (n_folds + 1) * 20:
        n_folds = max(1, n // 40)
    fold = n // (n_folds + 1)
    empty = {"hitRate": 0.0, "baseRate": 0.0, "skill": 0.0, "overfitRatio": 99.0, "alpha": 0.0, "folds": 0}
    if fold == 0:
        return empty
    oos, is_skill, oos_skill, base = [], [], [], []
    for k in range(1, n_folds + 1):
        tr_end = fold * k
        te_end = fold * (k + 1)
        ytr, yte = y[:tr_end], y[tr_end:te_end]
        if len(np.unique(ytr)) < 2 or len(yte) == 0:
            continue
        m = _make_model(cfg)
        m.fit(X[:tr_end], ytr)
        is_acc = _hit_rate(ytr, m.predict(X[:tr_end]))
        oos_acc = _hit_rate(yte, m.predict(X[tr_end:te_end]))
        oos.append(oos_acc)
        is_skill.append(is_acc - _base_rate(ytr))
        oos_skill.append(oos_acc - _base_rate(yte))
        base.append(_base_rate(yte))
    if not oos:
        return empty
    skill = float(np.mean(oos_skill))
    is_sk = float(np.mean(is_skill))
    overfit = 99.0 if skill <= 0 else max(is_sk, 0.0) / skill
    return {"hitRate": float(np.mean(oos)), "baseRate": float(np.mean(base)),
            "skill": skill, "overfitRatio": float(overfit), "alpha": skill, "folds": len(oos)}


def train_and_export_pooled(series_by_ticker: dict, cfg: TrainConfig = TrainConfig(),
                            gate: GateConfig = GateConfig(),
                            fundamentals_by_ticker: Optional[dict] = None) -> TrainResult:
    """Universe-wide pooled training: features -> time-split eval -> final GB -> ONNX."""
    sample_fund = next(iter(fundamentals_by_ticker.values())) if fundamentals_by_ticker else None
    names = feature_names(sample_fund)
    X, y, _dates = build_pooled(series_by_ticker, cfg.lookahead, fundamentals_by_ticker)
    if len(X) < 100 or len(np.unique(y)) < 2:
        return TrainResult(metrics={"hitRate": 0.0, "overfitRatio": 99.0, "alpha": 0.0, "folds": 0},
                           feature_spec={"features": []}, passed_gate=False, notes=["insufficient pooled data"])

    metrics = time_split_evaluate(X, y, cfg)
    mean, std = fit_standardizer(X)
    Xs = (X - mean) / std
    final = _make_model(cfg)
    final.fit(Xs, y)
    feature_spec = {"features": [{"name": n, "mean": float(mean[i]), "std": float(std[i])}
                                 for i, n in enumerate(names)]}
    onnx_bytes = export_onnx(final, X.shape[1])
    passed = passes_gate(metrics, gate)
    return TrainResult(metrics=metrics, feature_spec=feature_spec, onnx_bytes=onnx_bytes,
                       passed_gate=passed, notes=[] if passed else ["did not pass promotion gate"])
