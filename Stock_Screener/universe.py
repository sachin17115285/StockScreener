# universe.py — Nifty 50 + Nifty 100 tickers and sector mapping for NSE

NIFTY50_TICKERS = [
    "ADANIENT.NS", "ADANIPORTS.NS", "APOLLOHOSP.NS", "ASIANPAINT.NS",
    "AXISBANK.NS", "BAJAJ-AUTO.NS", "BAJFINANCE.NS", "BAJAJFINSV.NS",
    "BEL.NS", "BPCL.NS", "BHARTIARTL.NS", "BRITANNIA.NS",
    "CIPLA.NS", "COALINDIA.NS", "DRREDDY.NS", "EICHERMOT.NS",
    "GRASIM.NS", "HCLTECH.NS", "HDFCBANK.NS", "HDFCLIFE.NS",
    "HEROMOTOCO.NS", "HINDALCO.NS", "HINDUNILVR.NS", "ICICIBANK.NS",
    "ITC.NS", "INDUSINDBK.NS", "INFY.NS", "JSWSTEEL.NS",
    "KOTAKBANK.NS", "LT.NS", "LTIM.NS", "M&M.NS",
    "MARUTI.NS", "NESTLEIND.NS", "NTPC.NS", "ONGC.NS",
    "POWERGRID.NS", "RELIANCE.NS", "SBILIFE.NS", "SHRIRAMFIN.NS",
    "SBIN.NS", "SUNPHARMA.NS", "TCS.NS", "TATACONSUM.NS",
    "TATAMOTORS.NS", "TATASTEEL.NS", "TECHM.NS", "TITAN.NS",
    "ULTRACEMCO.NS", "WIPRO.NS"
]

NIFTY100_EXTRA_TICKERS = [
    "ABB.NS", "ADANIGREEN.NS", "ADANITRANS.NS", "AMBUJACEM.NS",
    "AUROPHARMA.NS", "BANDHANBNK.NS", "BANKBARODA.NS", "BERGEPAINT.NS",
    "BOSCHLTD.NS", "CANBK.NS", "CHOLAFIN.NS", "COLPAL.NS",
    "CONCOR.NS", "DABUR.NS", "DIVISLAB.NS", "DLF.NS",
    "DMART.NS", "FEDERALBNK.NS", "GAIL.NS", "GODREJCP.NS",
    "GODREJPROP.NS", "HAVELLS.NS", "HAL.NS", "ICICIGI.NS",
    "ICICIPRULI.NS", "IDFCFIRSTB.NS", "INDUSTOWER.NS", "IRCTC.NS",
    "JINDALSTEL.NS", "JUBLFOOD.NS", "LTF.NS", "LICI.NS",
    "LUPIN.NS", "MCDOWELL-N.NS", "MFSL.NS", "MOTHERSON.NS",
    "MPHASIS.NS", "MRF.NS", "NAUKRI.NS", "NHPC.NS",
    "NMDC.NS", "OFSS.NS", "PAGEIND.NS", "PAYTM.NS",
    "PEL.NS", "PERSISTENT.NS", "PETRONET.NS", "PFC.NS",
    "PIDILITIND.NS", "PNB.NS"
]

NIFTY100_TICKERS = NIFTY50_TICKERS + NIFTY100_EXTRA_TICKERS

SECTOR_MAP = {
    # Nifty 50
    "ADANIENT.NS": "Industrials",
    "ADANIPORTS.NS": "Industrials",
    "APOLLOHOSP.NS": "Healthcare",
    "ASIANPAINT.NS": "Consumer Staples",
    "AXISBANK.NS": "Banking",
    "BAJAJ-AUTO.NS": "Automobiles",
    "BAJFINANCE.NS": "Financial Services",
    "BAJAJFINSV.NS": "Financial Services",
    "BEL.NS": "Defence",
    "BPCL.NS": "Energy",
    "BHARTIARTL.NS": "Telecom",
    "BRITANNIA.NS": "FMCG",
    "CIPLA.NS": "Pharma",
    "COALINDIA.NS": "Energy",
    "DRREDDY.NS": "Pharma",
    "EICHERMOT.NS": "Automobiles",
    "GRASIM.NS": "Cement",
    "HCLTECH.NS": "IT",
    "HDFCBANK.NS": "Banking",
    "HDFCLIFE.NS": "Insurance",
    "HEROMOTOCO.NS": "Automobiles",
    "HINDALCO.NS": "Metals",
    "HINDUNILVR.NS": "FMCG",
    "ICICIBANK.NS": "Banking",
    "ITC.NS": "FMCG",
    "INDUSINDBK.NS": "Banking",
    "INFY.NS": "IT",
    "JSWSTEEL.NS": "Metals",
    "KOTAKBANK.NS": "Banking",
    "LT.NS": "Industrials",
    "LTIM.NS": "IT",
    "M&M.NS": "Automobiles",
    "MARUTI.NS": "Automobiles",
    "NESTLEIND.NS": "FMCG",
    "NTPC.NS": "Energy",
    "ONGC.NS": "Energy",
    "POWERGRID.NS": "Energy",
    "RELIANCE.NS": "Energy",
    "SBILIFE.NS": "Insurance",
    "SHRIRAMFIN.NS": "Financial Services",
    "SBIN.NS": "Banking",
    "SUNPHARMA.NS": "Pharma",
    "TCS.NS": "IT",
    "TATACONSUM.NS": "FMCG",
    "TATAMOTORS.NS": "Automobiles",
    "TATASTEEL.NS": "Metals",
    "TECHM.NS": "IT",
    "TITAN.NS": "Consumer Discretionary",
    "ULTRACEMCO.NS": "Cement",
    "WIPRO.NS": "IT",
    # Nifty 100 extra
    "ABB.NS": "Industrials",
    "ADANIGREEN.NS": "Energy",
    "ADANITRANS.NS": "Energy",
    "AMBUJACEM.NS": "Cement",
    "AUROPHARMA.NS": "Pharma",
    "BANDHANBNK.NS": "Banking",
    "BANKBARODA.NS": "Banking",
    "BERGEPAINT.NS": "Consumer Staples",
    "BOSCHLTD.NS": "Automobiles",
    "CANBK.NS": "Banking",
    "CHOLAFIN.NS": "Financial Services",
    "COLPAL.NS": "FMCG",
    "CONCOR.NS": "Industrials",
    "DABUR.NS": "FMCG",
    "DIVISLAB.NS": "Pharma",
    "DLF.NS": "Real Estate",
    "DMART.NS": "Retail",
    "FEDERALBNK.NS": "Banking",
    "GAIL.NS": "Energy",
    "GODREJCP.NS": "FMCG",
    "GODREJPROP.NS": "Real Estate",
    "HAVELLS.NS": "Consumer Discretionary",
    "HAL.NS": "Defence",
    "ICICIGI.NS": "Insurance",
    "ICICIPRULI.NS": "Insurance",
    "IDFCFIRSTB.NS": "Banking",
    "INDUSTOWER.NS": "Telecom",
    "IRCTC.NS": "Industrials",
    "JINDALSTEL.NS": "Metals",
    "JUBLFOOD.NS": "Consumer Discretionary",
    "LTF.NS": "Financial Services",
    "LICI.NS": "Insurance",
    "LUPIN.NS": "Pharma",
    "MCDOWELL-N.NS": "Consumer Discretionary",
    "MFSL.NS": "Insurance",
    "MOTHERSON.NS": "Automobiles",
    "MPHASIS.NS": "IT",
    "MRF.NS": "Automobiles",
    "NAUKRI.NS": "IT",
    "NHPC.NS": "Energy",
    "NMDC.NS": "Metals",
    "OFSS.NS": "IT",
    "PAGEIND.NS": "Consumer Discretionary",
    "PAYTM.NS": "Financial Services",
    "PEL.NS": "Financial Services",
    "PERSISTENT.NS": "IT",
    "PETRONET.NS": "Energy",
    "PFC.NS": "Financial Services",
    "PIDILITIND.NS": "Consumer Staples",
    "PNB.NS": "Banking",
}

NIFTY50_INDEX = "^NSEI"
SENSEX_INDEX = "^BSESN"

# ── Dynamic full NSE universe (fetched from NSE archives) ──────────────────

import requests as _req
import io as _io
import warnings as _warn

_NSE_ALL_CACHE = None   # cache after first load

def get_all_nse_tickers(series_filter="EQ"):
    """
    Fetch all NSE EQ-series tickers from NSE's official equity list CSV.
    Returns list of ticker strings in Yahoo Finance format (SYMBOL.NS).
    Results are cached in memory for the session lifetime.
    """
    global _NSE_ALL_CACHE
    if _NSE_ALL_CACHE is not None:
        return _NSE_ALL_CACHE

    try:
        _warn.filterwarnings("ignore")
        r = _req.get(
            "https://archives.nseindia.com/content/equities/EQUITY_L.csv",
            timeout=15,
            verify=False,
        )
        r.raise_for_status()
        import pandas as _pd
        df = _pd.read_csv(_io.StringIO(r.text))
        df.columns = [c.strip() for c in df.columns]
        # Keep only EQ series (main board equities, not SME/BE etc.)
        if series_filter and "SERIES" in df.columns:
            df = df[df["SERIES"].str.strip() == series_filter]
        symbols = df["SYMBOL"].dropna().str.strip().tolist()
        _NSE_ALL_CACHE = [f"{s}.NS" for s in symbols if s]
        return _NSE_ALL_CACHE
    except Exception as e:
        # Fallback: use Nifty 100 if fetch fails
        _NSE_ALL_CACHE = NIFTY100_TICKERS
        return _NSE_ALL_CACHE


def get_all_nse_name_map():
    """
    Returns a dict {SYMBOL.NS: 'Company Name'} for the full NSE universe.
    """
    try:
        _warn.filterwarnings("ignore")
        r = _req.get(
            "https://archives.nseindia.com/content/equities/EQUITY_L.csv",
            timeout=15,
            verify=False,
        )
        r.raise_for_status()
        import pandas as _pd
        df = _pd.read_csv(_io.StringIO(r.text))
        df.columns = [c.strip() for c in df.columns]
        if "SERIES" in df.columns:
            df = df[df["SERIES"].str.strip() == "EQ"]
        result = {}
        for _, row in df.iterrows():
            sym = str(row.get("SYMBOL", "")).strip()
            name = str(row.get("NAME OF COMPANY", "")).strip()
            if sym:
                result[f"{sym}.NS"] = name
        return result
    except Exception:
        return {}


def search_tickers(query: str, max_results: int = 20):
    """
    Search NSE tickers by symbol or company name prefix.
    Returns list of {ticker, name} dicts.
    """
    query = query.strip().upper()
    if not query:
        return []
    try:
        _warn.filterwarnings("ignore")
        r = _req.get(
            "https://archives.nseindia.com/content/equities/EQUITY_L.csv",
            timeout=15,
            verify=False,
        )
        r.raise_for_status()
        import pandas as _pd
        df = _pd.read_csv(_io.StringIO(r.text))
        df.columns = [c.strip() for c in df.columns]
        if "SERIES" in df.columns:
            df = df[df["SERIES"].str.strip() == "EQ"]

        mask = (
            df["SYMBOL"].str.upper().str.startswith(query) |
            df["NAME OF COMPANY"].str.upper().str.contains(query, na=False)
        )
        matches = df[mask].head(max_results)
        return [
            {"ticker": f"{row['SYMBOL'].strip()}.NS", "name": row["NAME OF COMPANY"].strip()}
            for _, row in matches.iterrows()
        ]
    except Exception:
        return []
