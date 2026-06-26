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
    lookahead: int = 30
    train_window: int = 252
    test_window: int = 63
    n_estimators: int = 150
    max_depth: int = 3
    learning_rate: float = 0.05
    random_state: int = 42


@dataclass
class GateConfig:
    min_hit_rate: float = 0.52
    max_overfit_ratio: float = 1.6
    min_alpha: float = 0.0


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
        n_estimators=cfg.n_estimators, max_depth=cfg.max_depth,
        learning_rate=cfg.learning_rate, random_state=cfg.random_state,
    )


def walk_forward_evaluate(X: np.ndarray, y: np.ndarray, cfg: TrainConfig) -> dict:
    """Walk-forward OOS evaluation; returns hitRate, overfitRatio, alpha."""
    splits = walk_forward_indices(len(X), cfg.train_window, cfg.test_window)
    oos_acc, is_acc = [], []
    for (a, b), (c, d) in splits:
        if len(np.unique(y[a:b])) < 2:
            continue
        m = _make_model(cfg)
        m.fit(X[a:b], y[a:b])
        is_acc.append(_hit_rate(y[a:b], m.predict(X[a:b])))
        oos_acc.append(_hit_rate(y[c:d], m.predict(X[c:d])))
    if not oos_acc:
        return {"hitRate": 0.0, "overfitRatio": 99.0, "alpha": 0.0, "folds": 0}
    oos = float(np.mean(oos_acc))
    is_ = float(np.mean(is_acc))
    # overfitRatio: in-sample edge over OOS edge (edge = accuracy - 0.5).
    oos_edge = max(oos - 0.5, 1e-6)
    is_edge = max(is_ - 0.5, 0.0)
    overfit = is_edge / oos_edge
    return {
        "hitRate": oos, "overfitRatio": float(overfit),
        "alpha": float(oos - 0.5), "folds": len(oos_acc),
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
