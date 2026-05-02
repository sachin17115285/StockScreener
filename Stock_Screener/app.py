# app.py — Flask REST API for Momentum Engine & Backtester (Indian Markets)

import warnings
warnings.filterwarnings("ignore")

# ── SSL fix for corporate/self-signed cert environments ─────────────────────
# yfinance 1.2+ uses curl_cffi. Patch _set_session BEFORE any singleton
# is created so that all HTTP calls skip SSL verification.
try:
    from curl_cffi import requests as cffi_requests
    import yfinance.data as _yfd

    _orig_set_session = _yfd.YfData._set_session

    def _patched_set_session(self, session):
        if session is None or isinstance(session, cffi_requests.Session):
            session = cffi_requests.Session(impersonate="chrome", verify=False)
        _orig_set_session(self, session)

    _yfd.YfData._set_session = _patched_set_session
except Exception:
    pass  # If patch fails, proceed normally — SSL may work fine without it
# ────────────────────────────────────────────────────────────────────────────

from flask import Flask, render_template, request, jsonify
from universe import NIFTY50_TICKERS, NIFTY100_TICKERS, SECTOR_MAP, get_all_nse_tickers, search_tickers
from screener import run_screen, get_chart_data
from backtester import backtest

app = Flask(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Main Page
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")


# ─────────────────────────────────────────────────────────────────────────────
# API: Get Universe Tickers
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/api/universe")
def get_universe():
    """Return available stock universe and sector mapping."""
    universe = request.args.get("universe", "nifty50")
    if universe == "nifty50":
        tickers = NIFTY50_TICKERS
    elif universe == "nifty100":
        tickers = NIFTY100_TICKERS
    else:  # all_nse
        tickers = get_all_nse_tickers()
    return jsonify({
        "tickers": tickers,
        "sector_map": SECTOR_MAP,
        "count": len(tickers),
    })


@app.route("/api/search")
def search():
    """Search NSE stocks by symbol or company name."""
    query = request.args.get("q", "").strip()
    if not query or len(query) < 1:
        return jsonify({"results": []})
    results = search_tickers(query, max_results=15)
    return jsonify({"results": results})


# ─────────────────────────────────────────────────────────────────────────────
# API: Run Momentum Screener
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/api/screen", methods=["POST"])
def screen():
    """
    Run the momentum screener across the stock universe.

    Request JSON body:
    {
        "ma_type": "EMA",          // "SMA" or "EMA"
        "fast_period": 12,
        "slow_period": 26,
        "crossover_days": 10,      // look for crossovers in last N trading days
        "rs_filter": true,         // require outperformance vs Nifty50
        "avwap_filter": true,      // require price above AVWAP
        "universe": "nifty50"      // "nifty50" or "nifty100"
    }
    """
    data = request.get_json(force=True)

    ma_type = data.get("ma_type", "EMA").upper()
    fast_period = int(data.get("fast_period", 12))
    slow_period = int(data.get("slow_period", 26))
    crossover_days = int(data.get("crossover_days", 10))
    rs_filter = bool(data.get("rs_filter", True))
    avwap_filter = bool(data.get("avwap_filter", True))
    universe = data.get("universe", "nifty50")

    # Validate
    if fast_period >= slow_period:
        return jsonify({"error": "Fast period must be less than slow period"}), 400
    if fast_period < 2 or slow_period > 500:
        return jsonify({"error": "Invalid period values"}), 400

    result = run_screen(
        ma_type=ma_type,
        fast_period=fast_period,
        slow_period=slow_period,
        crossover_days=crossover_days,
        rs_filter=rs_filter,
        avwap_filter=avwap_filter,
        universe=universe,
    )

    return jsonify(result)


# ─────────────────────────────────────────────────────────────────────────────
# API: Run Screener on Watchlist Tickers
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/api/screen/watchlist", methods=["POST"])
def screen_watchlist():
    """
    Run the momentum screener on a custom list of tickers (e.g. the watchlist).

    Request JSON body:
    {
        "tickers": ["RELIANCE.NS", "INFY.NS", ...],
        "ma_type": "EMA",
        "fast_period": 12,
        "slow_period": 26,
        "crossover_days": 10,
        "rs_filter": true,
        "avwap_filter": true
    }

    Response adds a "skipped" list of stocks that had data but didn't pass filters,
    each with a "fail_reasons" array explaining why.
    """
    data = request.get_json(force=True)

    tickers      = data.get("tickers", [])
    ma_type      = data.get("ma_type", "EMA").upper()
    fast_period  = int(data.get("fast_period", 12))
    slow_period  = int(data.get("slow_period", 26))
    crossover_days = int(data.get("crossover_days", 10))
    rs_filter    = bool(data.get("rs_filter", True))
    avwap_filter = bool(data.get("avwap_filter", True))

    if not tickers:
        return jsonify({"error": "No tickers provided"}), 400
    if fast_period >= slow_period:
        return jsonify({"error": "Fast period must be less than slow period"}), 400

    result = run_screen(
        ma_type=ma_type,
        fast_period=fast_period,
        slow_period=slow_period,
        crossover_days=crossover_days,
        rs_filter=rs_filter,
        avwap_filter=avwap_filter,
        custom_tickers=tickers,
    )
    return jsonify(result)


# ─────────────────────────────────────────────────────────────────────────────
# API: Backtest Strategy
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/api/backtest", methods=["POST"])
def run_backtest():
    """
    Run a 5-year historical backtest for a specific stock and strategy.

    Request JSON body:
    {
        "ticker": "RELIANCE.NS",
        "ma_type": "EMA",
        "fast_period": 12,
        "slow_period": 26,
        "hold_days": 180
    }
    """
    data = request.get_json(force=True)

    ticker = data.get("ticker", "").strip()
    ma_type = data.get("ma_type", "EMA").upper()
    fast_period = int(data.get("fast_period", 12))
    slow_period = int(data.get("slow_period", 26))
    hold_days = int(data.get("hold_days", 180))

    if not ticker:
        return jsonify({"error": "Ticker is required"}), 400

    result = backtest(
        ticker=ticker,
        ma_type=ma_type,
        fast_period=fast_period,
        slow_period=slow_period,
        hold_days=hold_days,
    )

    return jsonify(result)


# ─────────────────────────────────────────────────────────────────────────────
# API: Chart Data (OHLCV + MAs + AVWAP)
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/api/stock/<path:ticker>")
def stock_info(ticker):
    """
    Return current indicators for a single stock — no filter logic.
    Used by the search spotlight to show raw market data regardless of strategy.
    Query params: ma_type, fast_period, slow_period
    """
    import yfinance as yf
    from screener import get_avwap_status, get_company_name, quick_win_rate
    from indicators import (
        compute_ma, find_anchor_date, compute_avwap,
        compute_adx, get_volume_ratio, get_relative_strength,
    )
    from universe import SECTOR_MAP, NIFTY50_INDEX

    ma_type     = request.args.get("ma_type",     "EMA").upper()
    fast_period = int(request.args.get("fast_period", 12))
    slow_period = int(request.args.get("slow_period", 26))

    try:
        df = yf.download(ticker, period="1y", progress=False, auto_adjust=True)
        if df is None or df.empty:
            return jsonify({"error": "No data available"}), 404

        close = df["Close"].squeeze()
        fast_ma = compute_ma(df, ma_type, fast_period)
        slow_ma = compute_ma(df, ma_type, slow_period)

        current_price = float(close.iloc[-1])
        anchor_date   = find_anchor_date(df)
        avwap         = float(compute_avwap(df, anchor_date))
        avwap_status  = get_avwap_status(current_price, avwap)
        adx           = float(compute_adx(df))
        vol_ratio     = float(get_volume_ratio(df))
        sector        = SECTOR_MAP.get(ticker, "Other")
        win_rate      = quick_win_rate(df, fast_ma, slow_ma, hold_days=63)

        # Relative strength vs Nifty50
        rs = 0.0
        try:
            bench = yf.download(NIFTY50_INDEX, period="6mo", progress=False, auto_adjust=True)
            if not bench.empty:
                rs = float(get_relative_strength(df, bench, period=60))
        except Exception:
            pass

        return jsonify({
            "ticker":           ticker,
            "name":             get_company_name(ticker),
            "sector":           sector,
            "price":            round(current_price, 2),
            "avwap":            round(avwap, 2),
            "avwap_status":     avwap_status,
            "anchor_date":      anchor_date.strftime("%Y-%m-%d") if hasattr(anchor_date, "strftime") else str(anchor_date),
            "adx":              round(adx, 1),
            "volume_ratio":     round(vol_ratio, 2),
            "rs_vs_nifty":      round(rs, 2),
            "confidence_score": win_rate,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/chart/<path:ticker>")
def chart_data(ticker):
    """
    Return OHLCV + computed indicator data for Chart.js rendering.
    Query params: ma_type, fast_period, slow_period, period (e.g. 6mo, 1y)
    """
    ma_type = request.args.get("ma_type", "EMA").upper()
    fast_period = int(request.args.get("fast_period", 12))
    slow_period = int(request.args.get("slow_period", 26))
    period = request.args.get("period", "6mo")

    result = get_chart_data(
        ticker=ticker,
        ma_type=ma_type,
        fast_period=fast_period,
        slow_period=slow_period,
        period=period,
    )
    return jsonify(result)


# ─────────────────────────────────────────────────────────────────────────────
# Run
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 60)
    print("  Momentum Engine & Backtester — Indian Markets")
    print("  Open http://localhost:5001 in your browser")
    print("=" * 60)
    app.run(debug=True, port=5001)
