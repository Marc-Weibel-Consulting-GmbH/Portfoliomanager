"""
Exakter Mean-Variance-Optimierer auf Basis von PyPortfolioOpt.

Bewusste Arbeitsteilung mit der TypeScript-Engine (server/analytics/engine.ts):
die Engine liefert μ (Black-Litterman-Posterior) und die Ledoit-Wolf-geschrumpfte
Kovarianzmatrix aus CHF-konvertierten, datums-alignierten Renditen — dieses Modul
löst NUR das Optimierungsproblem, dafür aber exakt (konvexe Optimierung statt
Zufallssuche) und mit optional harten Sektor-Caps. Es holt keine eigenen Kursdaten
(kein yfinance): identische Inputs → identische, reproduzierbare Outputs.

Fehler werden als ValueError gemeldet; der HTTP-Layer (main.py) übersetzt sie in
422-Antworten, die TS-Bridge (server/analytics/exactOptimizer.ts) fällt dann
non-fatal auf die bisherige Zufallssuche zurück.
"""

from typing import Dict, List, Optional

import numpy as np
import pandas as pd


def solve_exact(
    tickers: List[str],
    mu: List[float],
    cov: List[List[float]],
    risk_free_rate: float = 0.02,
    min_weight: float = 0.01,
    max_weight: float = 0.10,
    method: str = "max_sharpe",
    sector_by_ticker: Optional[Dict[str, str]] = None,
    max_sector_weight_pct: Optional[float] = None,
) -> Dict:
    """Exakte Optimierung. mu/cov sind annualisiert (Dezimalwerte), Reihenfolge = tickers."""
    # Lazy import: ein fehlendes pyportfolioopt darf den Service-Boot nicht verhindern.
    from pypfopt.efficient_frontier import EfficientFrontier

    n = len(tickers)
    if n < 2:
        raise ValueError("Mindestens 2 Titel erforderlich.")
    if len(mu) != n:
        raise ValueError(f"mu hat {len(mu)} Einträge, erwartet {n}.")
    if len(cov) != n or any(len(row) != n for row in cov):
        raise ValueError(f"cov muss eine {n}x{n}-Matrix sein.")
    if method not in ("max_sharpe", "min_variance"):
        raise ValueError(f"Unbekannte Methode: {method}")
    if not (0 <= min_weight <= max_weight <= 1):
        raise ValueError(f"Ungültige Gewichts-Bounds: [{min_weight}, {max_weight}].")
    if n * max_weight < 1 - 1e-9:
        raise ValueError(f"Bounds unerfüllbar: {n} × max {max_weight} < 100 %.")
    if n * min_weight > 1 + 1e-9:
        raise ValueError(f"Bounds unerfüllbar: {n} × min {min_weight} > 100 %.")

    mu_arr = np.asarray(mu, dtype=float)
    cov_arr = np.asarray(cov, dtype=float)
    if not np.all(np.isfinite(mu_arr)) or not np.all(np.isfinite(cov_arr)):
        raise ValueError("mu/cov enthalten nicht-finite Werte.")

    mu_series = pd.Series(mu_arr, index=tickers)
    cov_df = pd.DataFrame(cov_arr, index=tickers, columns=tickers)

    ef = EfficientFrontier(mu_series, cov_df, weight_bounds=(min_weight, max_weight))

    # Harte Sektor-Caps — nur wenn erfüllbar; sonst ehrlich OHNE Cap optimieren
    # und das im Ergebnis kennzeichnen (der Aufrufer entscheidet, was er anzeigt).
    sector_constraint_applied = False
    if sector_by_ticker and max_sector_weight_pct is not None and 0 < max_sector_weight_pct < 100:
        cap = max_sector_weight_pct / 100.0
        sector_mapper = {t: sector_by_ticker.get(t, "Andere") for t in tickers}
        sectors = set(sector_mapper.values())
        counts = {s: sum(1 for t in tickers if sector_mapper[t] == s) for s in sectors}
        # Erfüllbarkeit: die Summe der pro Sektor maximal erreichbaren Gewichte
        # (begrenzt durch Cap UND Titelzahl × max_weight) muss 100 % erlauben,
        # und jeder Sektor muss seine Mindestgewichte (Titelzahl × min_weight)
        # unter dem Cap unterbringen können.
        reachable = sum(min(cap, counts[s] * max_weight) for s in sectors)
        min_required_ok = all(counts[s] * min_weight <= cap + 1e-9 for s in sectors)
        if len(sectors) > 1 and reachable >= 1 - 1e-9 and min_required_ok:
            ef.add_sector_constraints(
                sector_mapper,
                sector_lower={},
                sector_upper={s: cap for s in sectors},
            )
            sector_constraint_applied = True

    if method == "max_sharpe":
        if float(np.max(mu_arr)) <= risk_free_rate:
            raise ValueError(
                "Max-Sharpe nicht lösbar: keine erwartete Rendite über dem risikofreien Zins."
            )
        ef.max_sharpe(risk_free_rate=risk_free_rate)
    else:
        ef.min_volatility()

    weights = ef.clean_weights(cutoff=1e-4, rounding=6)
    exp_ret, vol, sharpe = ef.portfolio_performance(risk_free_rate=risk_free_rate)

    return {
        "engine": "pyportfolioopt",
        "method": method,
        "weights": {t: float(w) for t, w in weights.items()},
        "expectedReturn": round(float(exp_ret), 6),
        "volatility": round(float(vol), 6),
        "sharpe": round(float(sharpe), 4),
        "sectorConstraintApplied": sector_constraint_applied,
    }
