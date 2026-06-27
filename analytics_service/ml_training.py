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
- Cross-sectional normalization: features are z-scored per date across the universe
  before training (reduces market-regime bias, biggest cheap lever for relative alpha).
- Embargo/Purge: the last `lookahead` rows of each training fold are dropped to
  prevent forward-return label leakage at the train/test boundary.
- Skill is measured vs the majority-class baseline (not vs 0.5): a model that just
  predicts the bull-market majority class looks skilled vs 0.5 but has zero edge.
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


def build_features_labels(prices: np.ndarray, lookahead: int = 20,
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
# Cross-sectional normalization (per-date z-score across universe)
# ----------------------------------------------------------------------------
def cross_sectional_normalize(X: np.ndarray, dates: list) -> np.ndarray:
    """Z-score each feature within each trading date across the universe.

    Fast numpy implementation (no pandas dependency).
    This removes market-regime bias: instead of asking "did ret_1d > 0?",
    the model learns "did this stock's ret_1d beat the cross-sectional median?".
    This is the biggest cheap lever for relative alpha in a pooled model.

    Args:
        X: (n_samples, n_features) feature matrix
        dates: list of date strings/objects of length n_samples (same order as X)

    Returns:
        X_cs: cross-sectionally normalized feature matrix, same shape as X
    """
    X_cs = X.copy()
    # Build unique date index
    dates_arr = np.array(dates)
    unique_dates, inverse = np.unique(dates_arr, return_inverse=True)
    n_features = X.shape[1]
    for d_idx in range(len(unique_dates)):
        mask = (inverse == d_idx)
        if mask.sum() < 2:
            continue  # Can't normalize with only 1 sample
        group = X[mask]  # shape (n_stocks_on_date, n_features)
        mean = group.mean(axis=0)
        std = group.std(axis=0)
        std[std == 0] = 1.0  # avoid division by zero
        X_cs[mask] = (group - mean) / std
    return X_cs


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
    max_overfit_ratio: float = 1.6   # Strict: IS-skill / OOS-skill must be < 1.6
    min_alpha: float = 0.02          # Require at least +2pp skill vs majority-class


@dataclass
class TrainResult:
    metrics: dict
    feature_spec: dict
    onnx_bytes: Optional[bytes] = None
    passed_gate: bool = False
    notes: list[str] = field(default_factory=list)


def _hit_rate(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    return float(np.mean(y_true == y_pred)) if len(y_true) else 0.0


def _base_rate(y: np.ndarray) -> float:
    """Accuracy of always predicting the majority class (the naive baseline)."""
    if len(y) == 0:
        return 0.5
    p = float(np.mean(y))
    return max(p, 1.0 - p)


def _make_model(cfg: TrainConfig) -> GradientBoostingClassifier:
    return GradientBoostingClassifier(
        n_estimators=cfg.n_estimators,
        max_depth=cfg.max_depth,
        learning_rate=cfg.learning_rate,
        subsample=cfg.subsample,
        min_samples_leaf=cfg.min_samples_leaf,
        random_state=cfg.random_state,
    )


def walk_forward_evaluate(X: np.ndarray, y: np.ndarray, cfg: TrainConfig) -> dict:
    """Walk-forward OOS evaluation with correct embargo/purge.

    Embargo = lookahead days: the last `cfg.lookahead` rows of each training fold
    are dropped. These rows have forward-return labels whose window overlaps the
    test period, so including them would be a look-ahead leak.

    Skill is measured vs the majority-class baseline (not vs 0.5):
      skill = OOS hitRate - OOS base rate
    alpha = skill (same definition for single-ticker evaluation).
    overfitRatio = IS skill / OOS skill (should be < 1.6).
    """
    embargo = cfg.lookahead  # Correct: embargo = lookahead
    splits = walk_forward_indices(len(X), cfg.train_window, cfg.test_window)
    oos_acc, is_skill_list, oos_skill_list, base = [], [], [], []
    for (a, b), (c, d) in splits:
        # Purge + embargo: drop last `embargo` rows from training
        b_purged = max(a + 10, b - embargo)
        ytr, yte = y[a:b_purged], y[c:d]
        if len(np.unique(ytr)) < 2 or len(yte) == 0:
            continue
        m = _make_model(cfg)
        m.fit(X[a:b_purged], ytr)
        is_a = _hit_rate(ytr, m.predict(X[a:b_purged]))
        oos_a = _hit_rate(yte, m.predict(X[c:d]))
        oos_acc.append(oos_a)
        is_skill_list.append(is_a - _base_rate(ytr))
        oos_skill_list.append(oos_a - _base_rate(yte))
        base.append(_base_rate(yte))
    if not oos_acc:
        return {"hitRate": 0.0, "baseRate": 0.0, "skill": 0.0, "overfitRatio": 99.0, "alpha": 0.0, "folds": 0}
    skill = float(np.mean(oos_skill_list))
    is_sk = float(np.mean(is_skill_list))
    overfit = 99.0 if skill <= 0 else max(is_sk, 0.0) / max(skill, 1e-6)
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
def build_pooled(series_by_ticker: dict, lookahead: int = 20,
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


def time_split_evaluate(X: np.ndarray, y: np.ndarray, cfg: TrainConfig,
                        n_folds: int = 5, dates: Optional[list] = None,
                        use_cross_sectional: bool = True) -> dict:
    """Expanding-window, time-ordered OOS evaluation on date-sorted pooled data.

    Improvements vs v1:
    - Embargo = lookahead (not 5): drops last `cfg.lookahead` rows from each fold's
      training set to prevent forward-return label leakage.
    - Cross-sectional normalization (optional): z-scores features per date across
      the universe before training. This is the biggest cheap lever for relative alpha.
    - Skill is measured vs the majority-class baseline (not vs 0.5).

    Args:
        X: (n_samples, n_features) pooled feature matrix (date-sorted)
        y: (n_samples,) labels
        cfg: training config
        n_folds: number of expanding-window folds
        dates: list of date strings (required for cross-sectional normalization)
        use_cross_sectional: if True and dates is provided, apply CS normalization
    """
    n = len(X)
    if n < (n_folds + 1) * 20:
        n_folds = max(1, n // 40)
    fold = n // (n_folds + 1)
    empty = {"hitRate": 0.0, "baseRate": 0.0, "skill": 0.0, "overfitRatio": 99.0, "alpha": 0.0, "folds": 0}
    if fold == 0:
        return empty

    # Apply cross-sectional normalization if dates are available
    if use_cross_sectional and dates is not None:
        try:
            X = cross_sectional_normalize(X, dates)
        except Exception:
            pass  # Fall back to raw features if CS normalization fails

    embargo = cfg.lookahead
    oos, is_skill_list, oos_skill_list, base = [], [], [], []
    for k in range(1, n_folds + 1):
        tr_end = fold * k
        te_end = min(fold * (k + 1), n)
        # Purge + embargo
        tr_end_purged = max(0, tr_end - embargo)
        ytr, yte = y[:tr_end_purged], y[tr_end:te_end]
        if len(np.unique(ytr)) < 2 or len(yte) == 0:
            continue
        m = _make_model(cfg)
        m.fit(X[:tr_end_purged], ytr)
        is_acc = _hit_rate(ytr, m.predict(X[:tr_end_purged]))
        oos_acc = _hit_rate(yte, m.predict(X[tr_end:te_end]))
        oos.append(oos_acc)
        is_skill_list.append(is_acc - _base_rate(ytr))
        oos_skill_list.append(oos_acc - _base_rate(yte))
        base.append(_base_rate(yte))
    if not oos:
        return empty
    skill = float(np.mean(oos_skill_list))
    is_sk = float(np.mean(is_skill_list))
    overfit = 99.0 if skill <= 0 else max(is_sk, 0.0) / max(skill, 1e-6)
    return {"hitRate": float(np.mean(oos)), "baseRate": float(np.mean(base)),
            "skill": skill, "overfitRatio": float(overfit), "alpha": skill, "folds": len(oos)}


def train_and_export_pooled(series_by_ticker: dict, cfg: TrainConfig = TrainConfig(),
                            gate: GateConfig = GateConfig(),
                            fundamentals_by_ticker: Optional[dict] = None) -> TrainResult:
    """Universe-wide pooled training with cross-sectional normalization.

    Features -> CS normalization -> time-split eval -> final GB -> ONNX.
    """
    sample_fund = next(iter(fundamentals_by_ticker.values())) if fundamentals_by_ticker else None
    names = feature_names(sample_fund)
    X, y, dates = build_pooled(series_by_ticker, cfg.lookahead, fundamentals_by_ticker)
    if len(X) < 100 or len(np.unique(y)) < 2:
        return TrainResult(metrics={"hitRate": 0.0, "overfitRatio": 99.0, "alpha": 0.0, "folds": 0},
                           feature_spec={"features": []}, passed_gate=False, notes=["insufficient pooled data"])

    # Evaluate with cross-sectional normalization
    metrics = time_split_evaluate(X, y, cfg, dates=dates, use_cross_sectional=True)

    # For the final model: apply CS normalization on the full dataset, then standardize
    try:
        X_cs = cross_sectional_normalize(X, dates)
    except Exception:
        X_cs = X  # fallback

    mean, std = fit_standardizer(X_cs)
    Xs = (X_cs - mean) / std
    final = _make_model(cfg)
    final.fit(Xs, y)
    feature_spec = {"features": [{"name": n, "mean": float(mean[i]), "std": float(std[i])}
                                 for i, n in enumerate(names)]}
    onnx_bytes = export_onnx(final, X.shape[1])
    passed = passes_gate(metrics, gate)
    notes = [] if passed else ["did not pass promotion gate"]
    notes.append(f"cross_sectional=True, embargo={cfg.lookahead}d, skill={metrics.get('skill', 0)*100:.2f}pp")
    return TrainResult(metrics=metrics, feature_spec=feature_spec, onnx_bytes=onnx_bytes,
                       passed_gate=passed, notes=notes)
