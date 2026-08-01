"""Exchange validation: European venues resolve, unknown ones raise.

Before this, ``sanitize_exchange`` returned the *default* for any unrecognised
exchange. Since most tools default to a crypto venue, asking for the Swiss blue
chip ``SIX:NESN`` silently became a KuCoin query and surfaced as
"No data found for NESN on KUCOIN" — a message about the wrong market entirely.

The screener slugs asserted here were verified against scanner.tradingview.com.
"""
import pytest

from tradingview_mcp.core.utils.validators import (
    EXCHANGE_SCREENER,
    get_market_type,
    get_tv_exchange_prefix,
    is_stock_exchange,
    normalize_tradingview_symbol,
    sanitize_exchange,
)


@pytest.mark.parametrize(
    "exchange,screener",
    [
        ("SIX", "switzerland"),
        ("XETR", "germany"),
        ("XETRA", "germany"),
        ("EURONEXT", "france"),
        ("LSE", "uk"),
        ("TSE", "japan"),
    ],
)
def test_european_and_japanese_exchanges_map_to_their_country_screener(exchange, screener):
    assert sanitize_exchange(exchange, "kucoin") == exchange.lower()
    assert get_market_type(exchange) == screener
    assert is_stock_exchange(exchange), f"{exchange} must count as a stock exchange"


def test_swiss_ticker_is_not_routed_to_a_crypto_venue():
    """The exact case that failed in production."""
    exchange = sanitize_exchange("SIX", "KUCOIN")
    assert exchange == "six"
    assert get_market_type(exchange) != "crypto"
    assert normalize_tradingview_symbol("NESN", exchange) == "SIX:NESN"


def test_xetra_spelling_resolves_to_the_real_tradingview_prefix():
    # TradingView lists Xetra as XETR; a query on "XETRA" returns nothing.
    assert get_tv_exchange_prefix("xetra") == "XETR"
    assert normalize_tradingview_symbol("SAP", sanitize_exchange("XETRA")) == "XETR:SAP"


def test_missing_exchange_still_falls_back_to_the_default():
    # No exchange requested -> the caller's default is the right answer.
    assert sanitize_exchange("", "kucoin") == "kucoin"
    assert sanitize_exchange(None, "nasdaq") == "nasdaq"  # type: ignore[arg-type]


def test_unknown_exchange_raises_instead_of_silently_substituting():
    with pytest.raises(ValueError) as err:
        sanitize_exchange("NOT_A_REAL_EXCHANGE", "kucoin")
    assert "NOT_A_REAL_EXCHANGE" in str(err.value)


def test_crypto_defaults_are_untouched():
    assert sanitize_exchange("KUCOIN") == "kucoin"
    assert get_market_type("kucoin") == "crypto"
    assert not is_stock_exchange("kucoin")


def test_every_stock_exchange_has_a_screener():
    from tradingview_mcp.core.utils.validators import STOCK_EXCHANGES

    missing = sorted(ex for ex in STOCK_EXCHANGES if ex not in EXCHANGE_SCREENER)
    assert not missing, f"stock exchanges without a screener entry: {missing}"
