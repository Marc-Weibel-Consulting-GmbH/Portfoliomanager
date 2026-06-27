"""Tests for the GB walk-forward training + ONNX export pipeline."""
import numpy as np
import onnxruntime as ort

import ml_training as mt


def _regime_prices(n=1600, seed=42):
    """Prices with long up/down regimes so momentum is genuinely predictive."""
    rng = np.random.default_rng(seed)
    rets = np.zeros(n)
    regime_len = 180
    drift = 0.0015
    for start in range(0, n, regime_len):
        sign = 1 if (start // regime_len) % 2 == 0 else -1
        end = min(start + regime_len, n)
        rets[start:end] = sign * drift + rng.normal(0, 0.006, end - start)
    return 100 * np.cumprod(1 + rets)


def test_walk_forward_indices():
    splits = mt.walk_forward_indices(n=100, train=40, test=20, step=20)
    assert splits[0] == ((0, 40), (40, 60))
    assert splits[1] == ((20, 60), (60, 80))
    # No split may exceed n.
    assert all(te[1] <= 100 for _, te in splits)


def test_build_features_labels_shapes():
    prices = _regime_prices()
    X, y = mt.build_features_labels(prices, lookahead=30)
    assert X.shape[0] == y.shape[0]
    assert X.shape[1] == len(mt.feature_names())
    assert set(np.unique(y)).issubset({0, 1})


def test_walk_forward_learns_predictive_signal():
    prices = _regime_prices()
    X, y = mt.build_features_labels(prices, lookahead=30)
    cfg = mt.TrainConfig(train_window=300, test_window=80)
    metrics = mt.walk_forward_evaluate(X, y, cfg)
    assert metrics["folds"] > 0
    # Regime momentum is predictive -> OOS accuracy clearly above chance.
    assert metrics["hitRate"] > 0.55


def test_fundamentals_are_point_in_time_not_broadcast():
    prices = _regime_prices()
    # A per-index fundamental series (point-in-time), not a single current value.
    fund = {"pe": np.linspace(10, 30, len(prices))}
    names = mt.feature_names(fund)
    assert "pe" in names
    X, y = mt.build_features_labels(prices, lookahead=30, fundamentals=fund)
    assert X.shape[1] == len(names)


def test_train_and_export_produces_onnx_and_spec():
    prices = _regime_prices()
    res = mt.train_and_export(prices, mt.TrainConfig(train_window=300, test_window=80))
    assert res.onnx_bytes is not None and len(res.onnx_bytes) > 0
    spec = res.feature_spec["features"]
    assert [f["name"] for f in spec] == mt.feature_names()
    assert all("mean" in f and "std" in f for f in spec)
    assert res.metrics["folds"] > 0


def test_onnx_roundtrip_matches_sklearn():
    """ONNX inference on standardized features must match the sklearn model."""
    prices = _regime_prices()
    X, y = mt.build_features_labels(prices, lookahead=30)
    mean, std = mt.fit_standardizer(X)
    Xs = (X - mean) / std
    model = mt._make_model(mt.TrainConfig())
    model.fit(Xs, y)
    onnx_bytes = mt.export_onnx(model, X.shape[1])

    sess = ort.InferenceSession(onnx_bytes, providers=["CPUExecutionProvider"])
    sample = Xs[-50:].astype(np.float32)
    onnx_labels = sess.run(None, {"input": sample})[0].ravel().astype(int)
    sk_labels = model.predict(Xs[-50:]).astype(int)
    match = np.mean(onnx_labels == sk_labels)
    assert match >= 0.99


def test_promotion_gate():
    gate = mt.GateConfig(min_hit_rate=0.55, max_overfit_ratio=1.6, min_alpha=0.0)
    assert mt.passes_gate({"hitRate": 0.6, "overfitRatio": 1.2, "alpha": 0.1}, gate)
    assert not mt.passes_gate({"hitRate": 0.5, "overfitRatio": 1.2, "alpha": 0.1}, gate)
    assert not mt.passes_gate({"hitRate": 0.6, "overfitRatio": 3.0, "alpha": 0.1}, gate)


def _regime_series_with_dates(n=1200, seed=1, start_day=0):
    prices = _regime_prices(n=n, seed=seed)
    # synthetic ISO dates, daily
    import datetime as dt
    base = dt.date(2020, 1, 1) + dt.timedelta(days=start_day)
    dates = [(base + dt.timedelta(days=i)).isoformat() for i in range(n)]
    return {"prices": prices.tolist(), "dates": dates}


def test_build_pooled_is_date_sorted_across_tickers():
    s = {
        "AAA": _regime_series_with_dates(seed=1, start_day=0),
        "BBB": _regime_series_with_dates(seed=2, start_day=0),
    }
    X, y, dates = mt.build_pooled(s, lookahead=30)
    assert len(X) == len(y) == len(dates)
    assert dates == sorted(dates)  # globally chronological
    assert X.shape[1] == len(mt.feature_names())


def test_train_and_export_pooled_learns_and_exports():
    s = {f"T{i}": _regime_series_with_dates(seed=i + 1) for i in range(4)}
    # 'absolute' tests that the directional momentum signal is learnable.
    res = mt.train_and_export_pooled(s, mt.TrainConfig(label_mode="absolute"))
    assert res.onnx_bytes is not None and len(res.onnx_bytes) > 0
    assert res.metrics["folds"] > 0
    assert res.metrics["hitRate"] > 0.55  # pooled regime signal is learnable
    assert [f["name"] for f in res.feature_spec["features"]] == mt.feature_names()


def test_cross_sectional_labels_are_balanced():
    # With many independent tickers, the 'beats the median' label is ~50/50.
    s = {f"T{i}": _regime_series_with_dates(seed=i + 1, start_day=i) for i in range(10)}
    X, y, _ = mt.build_pooled(s, lookahead=30, label_mode="cross_sectional")
    rate = float(np.mean(y))
    assert 0.4 < rate < 0.6  # balanced, unlike the bull-biased absolute label


def test_pooled_onnx_roundtrip():
    s = {f"T{i}": _regime_series_with_dates(seed=i + 1) for i in range(4)}
    X, y, _ = mt.build_pooled(s, lookahead=30)
    mean, std = mt.fit_standardizer(X)
    Xs = (X - mean) / std
    model = mt._make_model(mt.TrainConfig())
    model.fit(Xs, y)
    onnx_bytes = mt.export_onnx(model, X.shape[1])
    sess = ort.InferenceSession(onnx_bytes, providers=["CPUExecutionProvider"])
    sample = Xs[-40:].astype(np.float32)
    onnx_labels = sess.run(None, {"input": sample})[0].ravel().astype(int)
    assert np.mean(onnx_labels == model.predict(Xs[-40:]).astype(int)) >= 0.99


def test_skill_is_measured_vs_base_rate():
    """A no-skill model on imbalanced (bull-market-like) labels must score ~0 skill
    and fail the gate — not look good just because the majority class is 'up'."""
    rng = np.random.default_rng(3)
    X = rng.normal(size=(800, 7))           # pure noise features
    y = (rng.random(800) < 0.8).astype(int)  # 80% 'up' (imbalanced)
    m = mt.time_split_evaluate(X, y, mt.TrainConfig())
    assert m["baseRate"] > 0.7               # base rate reflects the imbalance
    assert m["skill"] <= 0.03                # no genuine edge over the baseline
    assert not mt.passes_gate(m, mt.GateConfig())
