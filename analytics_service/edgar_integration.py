"""
SEC EDGAR Integration via edgartools (MIT) — Paket "Daten-Integration".

Liefert standardisierte XBRL-Fundamentaldaten (Bilanz/GuV) und Filing-Listen
direkt von der SEC — ohne API-Key und ohne Rate-Limits von Drittanbietern.
Treibstoff fuer die Moat-/Score-Analysen des Portfoliomanagers.

Vorgabe der SEC: Jeder Client muss sich mit Name + E-Mail identifizieren
(Fair-Access-Policy). Identitaet via Env-Variable EDGAR_IDENTITY setzen,
z. B. "Marc Weibel Consulting GmbH kontakt@example.com".

Fehler werden als ValueError gemeldet; der HTTP-Layer (main.py) uebersetzt
sie in 422/502-Antworten. Netzwerkfehler gegen sec.gov werden als solche
erkennbar weitergegeben.
"""

import os
from typing import Dict, List, Optional

# XBRL-Facts, die fuer Kennzahlen extrahiert werden (us-gaap, mit Fallbacks).
_REVENUE_FACTS = (
    "RevenueFromContractWithCustomerExcludingAssessedTax",
    "Revenues",
    "SalesRevenueNet",
)
_NET_INCOME_FACTS = ("NetIncomeLoss", "ProfitLoss")
_ASSETS_FACTS = ("Assets",)
_EQUITY_FACTS = (
    "StockholdersEquity",
    "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest",
)
_EPS_FACTS = ("EarningsPerShareDiluted", "EarningsPerShareBasic")
_OPERATING_CF_FACTS = ("NetCashProvidedByUsedInOperatingActivities",)


def _set_identity() -> None:
    from edgar import set_identity

    identity = os.environ.get(
        "EDGAR_IDENTITY", "Portfoliomanager analytics@localhost"
    )
    set_identity(identity)


def _latest_annual_values(facts, candidates, years: int = 5) -> List[Dict]:
    """Letzte bis zu `years` Jahreswerte des ersten vorhandenen XBRL-Concepts.

    Nutzt EntityFacts.get_annual_fact(concept, fiscal_year) — das liefert den
    kanonischen konsolidierten Wert je Geschaeftsjahr (time_series enthaelt
    zusaetzlich segmentierte/dimensionale Zeilen und ist dafuer ungeeignet).
    edgartools v5 erwartet je nach Concept die us-gaap:-Namespace-Praefixform;
    beide Varianten werden probiert. Die dabei von der Library emittierten
    UserWarnings (Concept-Suche) werden lokal unterdrueckt.
    """
    import warnings
    from datetime import date

    this_year = date.today().year
    for concept in candidates:
        for resolved in (concept, f"us-gaap:{concept}"):
            values: List[Dict] = []
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                for year in range(this_year + 1, this_year - 12, -1):
                    try:
                        fact = facts.get_annual_fact(resolved, fiscal_year=year)
                    except Exception:
                        fact = None
                    if (
                        fact is not None
                        and getattr(fact, "numeric_value", None) is not None
                    ):
                        end = getattr(fact, "period_end", None)
                        values.append(
                            {
                                "fiscalYear": year,
                                "value": float(fact.numeric_value),
                                "end": str(end.date())
                                if hasattr(end, "date")
                                else str(end),
                            }
                        )
                    if len(values) >= years:
                        break
            if values:
                return sorted(values, key=lambda v: v["fiscalYear"])
    return []


def get_company_facts(ticker: str) -> Dict:
    """
    Kern-Fundamentaldaten eines US-Unternehmens aus XBRL-Company-Facts:
    Umsatz, Nettogewinn, Bilanzsumme, Eigenkapital, EPS, operativer Cashflow —
    jeweils die letzten bis zu 5 Geschaeftsjahre.
    """
    if not ticker or len(ticker) > 12:
        raise ValueError(f"Ungueltiges Ticker-Symbol: {ticker!r}")

    # Lazy import: fehlendes edgartools darf den Service-Boot nicht verhindern.
    from edgar import Company

    _set_identity()
    try:
        company = Company(ticker.upper())
    except Exception as exc:
        raise ValueError(f"Unternehmen nicht in EDGAR gefunden: {ticker} ({exc})")

    try:
        facts = company.get_facts()
    except Exception as exc:
        raise ValueError(f"XBRL-Facts nicht abrufbar fuer {ticker}: {exc}")

    if facts is None:
        raise ValueError(f"Keine XBRL-Facts fuer {ticker} verfuegbar.")

    return {
        "ticker": ticker.upper(),
        "name": getattr(facts, "name", None) or getattr(company, "name", None),
        "cik": getattr(company, "cik", None),
        "metrics": {
            "revenue": _latest_annual_values(facts, _REVENUE_FACTS),
            "netIncome": _latest_annual_values(facts, _NET_INCOME_FACTS),
            "totalAssets": _latest_annual_values(facts, _ASSETS_FACTS),
            "equity": _latest_annual_values(facts, _EQUITY_FACTS),
            "eps": _latest_annual_values(facts, _EPS_FACTS),
            "operatingCashflow": _latest_annual_values(facts, _OPERATING_CF_FACTS),
        },
        "source": "SEC EDGAR (companyfacts, XBRL)",
    }


def get_recent_filings(
    ticker: str,
    forms: Optional[List[str]] = None,
    limit: int = 10,
) -> Dict:
    """Juengste Filings eines Unternehmens (Standard: 10-K/10-Q/8-K)."""
    if limit < 1 or limit > 40:
        raise ValueError("limit muss zwischen 1 und 40 liegen.")

    from edgar import Company

    _set_identity()
    try:
        company = Company(ticker.upper())
    except Exception as exc:
        raise ValueError(f"Unternehmen nicht in EDGAR gefunden: {ticker} ({exc})")

    form_filter = forms or ["10-K", "10-Q", "8-K"]
    try:
        filings = company.get_filings(form=form_filter)
    except Exception as exc:
        raise ValueError(f"Filings nicht abrufbar fuer {ticker}: {exc}")

    entries: List[Dict] = []
    for filing in list(filings)[:limit]:
        entries.append(
            {
                "form": getattr(filing, "form", None),
                "filingDate": str(getattr(filing, "filing_date", "")),
                "accessionNumber": getattr(filing, "accession_no", None),
                "url": getattr(filing, "url", None) or getattr(filing, "homepage_url", None),
            }
        )

    return {
        "ticker": ticker.upper(),
        "name": getattr(company, "name", None),
        "cik": getattr(company, "cik", None),
        "filings": entries,
        "source": "SEC EDGAR (full-text submissions)",
    }
