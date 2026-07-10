"""
QuantStats Tear-Sheet-Generierung.

Nimmt eine Renditereihe (und optional eine Benchmark) und liefert einen
self-contained HTML-Report (eingebettete SVG-Charts + ~40 Kennzahlen).
Reine Funktion — keine Netzwerk-/DB-Zugriffe; die Renditen kommen vom
Node-Backend (aus den historicalPrices der Portfolio-Wertreihe).
"""

import os
import tempfile
from typing import List, Optional

import matplotlib

matplotlib.use("Agg")  # headless: kein Display auf dem Server
# python:3.11-slim hat kein Arial (QuantStats-Default) → DejaVu Sans ist mit
# matplotlib immer vorhanden und vermeidet «findfont»-Rauschen/Fallbacks.
matplotlib.rcParams["font.family"] = "DejaVu Sans"

import pandas as pd  # noqa: E402
import quantstats as qs  # noqa: E402


def _series(values: List[float], dates: List[str], name: str) -> pd.Series:
    s = pd.Series(values, index=pd.to_datetime(dates), name=name).sort_index()
    # doppelte Tage (letzter gewinnt) entfernen — QuantStats braucht einen sauberen Index
    return s[~s.index.duplicated(keep="last")]


def build_tearsheet_html(
    returns: List[float],
    dates: List[str],
    title: str = "Portfolio Tearsheet",
    rf: float = 0.0,
    benchmark: Optional[List[float]] = None,
    benchmark_dates: Optional[List[str]] = None,
    benchmark_title: str = "Benchmark",
) -> str:
    """Erzeugt den HTML-Tearsheet-Report als String."""
    ret = _series(returns, dates, title)
    bench = None
    if benchmark and benchmark_dates and len(benchmark) == len(benchmark_dates):
        bench = _series(benchmark, benchmark_dates, benchmark_title)

    tmp = tempfile.NamedTemporaryFile(suffix=".html", delete=False)
    tmp.close()
    try:
        qs.reports.html(
            ret,
            benchmark=bench,
            rf=rf,
            title=title,
            output=tmp.name,
            download_filename="tearsheet.html",
            figfmt="svg",
        )
        with open(tmp.name, "r", encoding="utf-8") as fh:
            return fh.read()
    finally:
        if os.path.exists(tmp.name):
            os.unlink(tmp.name)
