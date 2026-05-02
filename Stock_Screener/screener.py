# screener.py — Momentum Crossover Screening Engine for Indian Markets (NSE)

import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from collections import defaultdict

from universe import NIFTY50_TICKERS, NIFTY100_TICKERS, SECTOR_MAP, NIFTY50_INDEX, get_all_nse_tickers
from indicators import (
    compute_ma,
    find_anchor_date,
    compute_avwap,
    compute_adx,
    get_volume_ratio,
    get_relative_strength,
)

# Cache for benchmark data to avoid repeated downloads
_benchmark_cache = {}


def quick_win_rate(
    df: pd.DataFrame,
    fast_ma: "pd.Series",
    slow_ma: "pd.Series",
    hold_days: int = 63,
) -> float:
    """
    Compute a win-rate (0–100) using the already-downloaded df.
    Entry: bullish MA crossover (fast crosses above slow).
    Exit: bearish crossover (fast crosses below slow) OR hold_days trading
          bars maximum — whichever comes first.
    Returns 0.0 if fewer than 2 trades are found (not enough history).
    """
    try:
        close = df["Close"].squeeze()
        n = len(close)

        wins = 0
        total = 0
        in_trade = False
        sell_bar = -1

        for i in range(1, n - 2):
            if in_trade:
                if i >= sell_bar:
                    in_trade = False
                continue

            cf = fast_ma.iloc[i]
            cs = slow_ma.iloc[i]
            pf = fast_ma.iloc[i - 1]
            ps = slow_ma.iloc[i - 1]

            if not (pd.notna(cf) and pd.notna(cs) and pd.notna(pf) and pd.notna(ps)):
                continue

            if cf > cs and pf <= ps:
                buy_bar   = i + 1
                if buy_bar >= n:
                    break
                buy_price = float(close.iloc[buy_bar])
                max_bar   = min(buy_bar + hold_days, n - 1)

                # Look for bearish crossover before max_bar
                exit_bar = max_bar
                for j in range(buy_bar + 1, max_bar + 1):
                    jf = fast_ma.iloc[j]
                    js_ = slow_ma.iloc[j]
                    pf2 = fast_ma.iloc[j - 1]
                    ps2 = slow_ma.iloc[j - 1]
                    if (
                        pd.notna(jf) and pd.notna(js_)
                        and pd.notna(pf2) and pd.notna(ps2)
                        and jf < js_ and pf2 >= ps2
                    ):
                        exit_bar = j
                        break

                sell_price = float(close.iloc[exit_bar])
                if buy_price > 0:
                    if sell_price > buy_price:
                        wins += 1
                    total += 1
                sell_bar = exit_bar
                in_trade = True

        if total < 2:
            return 0.0
        return round(wins / total * 100, 1)
    except Exception:
        return 0.0


def _get_benchmark_data(period: str = "6mo") -> pd.DataFrame:
    """Download and cache Nifty 50 benchmark data."""
    key = period
    if key not in _benchmark_cache:
        try:
            df = yf.download(NIFTY50_INDEX, period=period, progress=False, auto_adjust=True)
            _benchmark_cache[key] = df
        except Exception:
            _benchmark_cache[key] = pd.DataFrame()
    return _benchmark_cache[key]


def detect_crossover(fast_ma: pd.Series, slow_ma: pd.Series, crossover_days: int):
    """
    Detect if a bullish crossover occurred within the last `crossover_days` trading days.
    Bullish crossover: fast_ma crosses ABOVE slow_ma (fast was below, now above).
    Returns a dict with crossover_date if found, else None.
    """
    lookback = min(crossover_days, len(fast_ma) - 2)
    for i in range(-lookback, 0):
        try:
            # Current bar: fast > slow
            curr_fast = float(fast_ma.iloc[i])
            curr_slow = float(slow_ma.iloc[i])
            # Previous bar: fast <= slow
            prev_fast = float(fast_ma.iloc[i - 1])
            prev_slow = float(slow_ma.iloc[i - 1])

            if (
                pd.notna(curr_fast) and pd.notna(curr_slow)
                and pd.notna(prev_fast) and pd.notna(prev_slow)
                and curr_fast > curr_slow
                and prev_fast <= prev_slow
            ):
                crossover_date = fast_ma.index[i]
                return {"crossover_date": crossover_date.strftime("%Y-%m-%d")}
        except (IndexError, ValueError):
            continue
    return None


def get_avwap_status(current_price: float, avwap: float) -> str:
    """
    Classify price relative to AVWAP.
    - 'above': price > AVWAP (healthy)
    - 'near': price within 3% below AVWAP (warning zone)
    - 'below': price dropped >3% below AVWAP (institutional exit signal)
    """
    if avwap <= 0:
        return "unknown"
    pct_diff = (current_price - avwap) / avwap * 100
    if pct_diff >= 0:
        return "above"
    elif pct_diff >= -3:
        return "near"
    else:
        return "below"


def get_company_name(ticker: str) -> str:
    """Return a clean company name from ticker symbol."""
    name_map = {
        "ADANIENT.NS": "Adani Enterprises",
        "ADANIPORTS.NS": "Adani Ports",
        "APOLLOHOSP.NS": "Apollo Hospitals",
        "ASIANPAINT.NS": "Asian Paints",
        "AXISBANK.NS": "Axis Bank",
        "BAJAJ-AUTO.NS": "Bajaj Auto",
        "BAJFINANCE.NS": "Bajaj Finance",
        "BAJAJFINSV.NS": "Bajaj Finserv",
        "BEL.NS": "Bharat Electronics",
        "BPCL.NS": "BPCL",
        "BHARTIARTL.NS": "Bharti Airtel",
        "BRITANNIA.NS": "Britannia",
        "CIPLA.NS": "Cipla",
        "COALINDIA.NS": "Coal India",
        "DRREDDY.NS": "Dr Reddy's",
        "EICHERMOT.NS": "Eicher Motors",
        "GRASIM.NS": "Grasim",
        "HCLTECH.NS": "HCL Technologies",
        "HDFCBANK.NS": "HDFC Bank",
        "HDFCLIFE.NS": "HDFC Life",
        "HEROMOTOCO.NS": "Hero MotoCorp",
        "HINDALCO.NS": "Hindalco",
        "HINDUNILVR.NS": "Hindustan Unilever",
        "ICICIBANK.NS": "ICICI Bank",
        "ITC.NS": "ITC",
        "INDUSINDBK.NS": "IndusInd Bank",
        "INFY.NS": "Infosys",
        "JSWSTEEL.NS": "JSW Steel",
        "KOTAKBANK.NS": "Kotak Mahindra Bank",
        "LT.NS": "Larsen & Toubro",
        "LTIM.NS": "LTIMindtree",
        "M&M.NS": "Mahindra & Mahindra",
        "MARUTI.NS": "Maruti Suzuki",
        "NESTLEIND.NS": "Nestle India",
        "NTPC.NS": "NTPC",
        "ONGC.NS": "ONGC",
        "POWERGRID.NS": "Power Grid",
        "RELIANCE.NS": "Reliance Industries",
        "SBILIFE.NS": "SBI Life Insurance",
        "SHRIRAMFIN.NS": "Shriram Finance",
        "SBIN.NS": "State Bank of India",
        "SUNPHARMA.NS": "Sun Pharma",
        "TCS.NS": "Tata Consultancy",
        "TATACONSUM.NS": "Tata Consumer",
        "TATAMOTORS.NS": "Tata Motors",
        "TATASTEEL.NS": "Tata Steel",
        "TECHM.NS": "Tech Mahindra",
        "TITAN.NS": "Titan",
        "ULTRACEMCO.NS": "UltraTech Cement",
        "WIPRO.NS": "Wipro",
    }
    return name_map.get(ticker, ticker.replace(".NS", "").replace(".BO", ""))


def run_screen(
    ma_type: str = "EMA",
    fast_period: int = 12,
    slow_period: int = 26,
    crossover_days: int = 10,
    rs_filter: bool = True,
    avwap_filter: bool = True,
    universe: str = "nifty50",
    custom_tickers: list = None,
) -> dict:
    """
    Main screening function. Scans the stock universe for bullish MA crossovers
    with optional AVWAP and Relative Strength filters.

    If custom_tickers is provided, it is used as the universe instead of
    the standard Nifty50/100/AllNSE lists (used for watchlist screening).

    Returns a dict with:
      - stocks: list of matching stock dicts
      - skipped: list of tickers that had data but didn't pass filters (watchlist mode)
      - sector_heatmap: dict of sector → count
      - screened: number of stocks scanned
      - matched: number of stocks matching criteria
    """
    if custom_tickers is not None:
        tickers = custom_tickers
    elif universe == "nifty50":
        tickers = NIFTY50_TICKERS
    elif universe == "nifty100":
        tickers = NIFTY100_TICKERS
    else:  # "all_nse"
        tickers = get_all_nse_tickers()
    benchmark_df = _get_benchmark_data("6mo")

    results = []
    skipped = []  # tickers that had data but didn't pass one or more filters
    sector_counts = defaultdict(int)
    screened = 0
    data_period = "1y" if fast_period <= 50 else "2y"  # need enough history for slow MA

    for ticker in tickers:
        try:
            df = yf.download(ticker, period=data_period, progress=False, auto_adjust=True)

            if df is None or df.empty or len(df) < slow_period + crossover_days + 5:
                continue

            screened += 1

            # ── Compute MAs ─────────────────────────────────────────────────
            fast_ma = compute_ma(df, ma_type, fast_period)
            slow_ma = compute_ma(df, ma_type, slow_period)

            # ── Current price & basic indicators (always compute for skipped info) ──
            current_price = float(df["Close"].squeeze().iloc[-1])
            anchor_date   = find_anchor_date(df)
            avwap         = float(compute_avwap(df, anchor_date))
            avwap_status  = get_avwap_status(current_price, avwap)
            vol_ratio     = float(get_volume_ratio(df))
            adx           = float(compute_adx(df))
            sector        = SECTOR_MAP.get(ticker, "Other")
            rs = 0.0
            if not benchmark_df.empty:
                rs = float(get_relative_strength(df, benchmark_df, period=60))

            # ── Crossover detection ──────────────────────────────────────────
            crossover = detect_crossover(fast_ma, slow_ma, crossover_days)

            # Determine which filters failed (used for skipped detail)
            fail_reasons = []
            if not crossover:
                fail_reasons.append("no crossover")
            if avwap_filter and avwap_status == "below":
                fail_reasons.append("below AVWAP")
            if rs_filter and rs <= 0:
                fail_reasons.append("RS negative")

            # ── Win Rate (computed on available data, no extra download) ────
            win_rate = quick_win_rate(df, fast_ma, slow_ma, hold_days=63)

            if fail_reasons:
                skipped.append({
                    "ticker":           ticker,
                    "name":             get_company_name(ticker),
                    "sector":           sector,
                    "price":            round(current_price, 2),
                    "avwap":            round(avwap, 2),
                    "avwap_status":     avwap_status,
                    "rs_vs_nifty":      round(rs, 2),
                    "volume_ratio":     round(vol_ratio, 2),
                    "adx":              round(adx, 1),
                    "confidence_score": win_rate,
                    "fail_reasons":     fail_reasons,
                })
                continue

            sector_counts[sector] += 1

            results.append({
                "ticker":           ticker,
                "name":             get_company_name(ticker),
                "sector":           sector,
                "price":            round(current_price, 2),
                "crossover_date":   crossover["crossover_date"],
                "confidence_score": win_rate,
                "avwap":            round(avwap, 2),
                "avwap_status":     avwap_status,
                "rs_vs_nifty":      round(rs, 2),
                "volume_ratio":     round(vol_ratio, 2),
                "adx":              round(adx, 1),
                "anchor_date":      anchor_date.strftime("%Y-%m-%d") if hasattr(anchor_date, "strftime") else str(anchor_date),
            })

        except Exception:
            # Skip tickers with download or calculation errors silently
            continue

    # Sort by confidence score descending
    results.sort(key=lambda x: x["confidence_score"], reverse=True)

    return {
        "stocks": results,
        "skipped": skipped,
        "sector_heatmap": dict(sorted(sector_counts.items(), key=lambda x: x[1], reverse=True)),
        "screened": screened,
        "matched": len(results),
    }


def get_chart_data(
    ticker: str,
    ma_type: str = "EMA",
    fast_period: int = 12,
    slow_period: int = 26,
    period: str = "6mo",
) -> dict:
    """
    Return OHLCV data + MA lines + AVWAP line for Chart.js rendering.
    """
    try:
        df = yf.download(ticker, period=period, progress=False, auto_adjust=True)
        if df is None or df.empty:
            return {"error": "No data available"}

        close = df["Close"].squeeze()
        dates = [d.strftime("%Y-%m-%d") for d in df.index]

        fast_ma = compute_ma(df, ma_type, fast_period)
        slow_ma = compute_ma(df, ma_type, slow_period)
        anchor_date = find_anchor_date(df)
        avwap_val = compute_avwap(df, anchor_date)

        def safe_list(series):
            return [round(float(v), 2) if pd.notna(v) else None for v in series]

        # AVWAP as a constant line from anchor to end
        avwap_line = []
        for d in df.index:
            if d >= anchor_date:
                avwap_line.append(round(avwap_val, 2))
            else:
                avwap_line.append(None)

        return {
            "dates": dates,
            "close": safe_list(close),
            "fast_ma": safe_list(fast_ma),
            "slow_ma": safe_list(slow_ma),
            "avwap": avwap_line,
            "fast_label": f"{ma_type} {fast_period}",
            "slow_label": f"{ma_type} {slow_period}",
            "anchor_date": anchor_date.strftime("%Y-%m-%d") if hasattr(anchor_date, "strftime") else str(anchor_date),
        }
    except Exception as e:
        return {"error": str(e)}
