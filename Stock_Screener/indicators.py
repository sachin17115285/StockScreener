# indicators.py — Technical indicator calculations: MA, AVWAP, ADX, Confidence Score

import numpy as np
import pandas as pd


def compute_ma(df: pd.DataFrame, ma_type: str, period: int) -> pd.Series:
    """
    Compute Simple or Exponential Moving Average on Close prices.
    Returns a pandas Series aligned with df.index.
    """
    close = df["Close"].squeeze()
    if ma_type.upper() == "EMA":
        return close.ewm(span=period, adjust=False).mean()
    else:  # SMA
        return close.rolling(window=period).mean()


def find_anchor_date(df: pd.DataFrame) -> pd.Timestamp:
    """
    Find the most recent significant anchor point for AVWAP.
    Logic: Look for the lowest close after the most recent 10%+ correction.
    Falls back to the lowest close in the last 60 trading days.
    """
    close = df["Close"].squeeze()
    n = len(close)

    # Scan from 60 days ago to now for a correction (10% drop from rolling high)
    lookback = min(252, n)  # up to 1 year
    recent_close = close.iloc[-lookback:]

    # Rolling max to detect corrections
    rolling_max = recent_close.expanding().max()
    drawdown = (recent_close - rolling_max) / rolling_max

    # Find periods where drawdown exceeded -10%
    correction_mask = drawdown <= -0.10
    if correction_mask.any():
        # Find the lowest point AFTER the last correction started
        last_correction_start = correction_mask[correction_mask].index[-1]
        idx_start = recent_close.index.get_loc(last_correction_start)
        sub = recent_close.iloc[idx_start:]
        anchor_date = sub.idxmin()
        return anchor_date

    # Fallback: lowest close in last 60 trading days
    last_60 = close.iloc[-60:]
    return last_60.idxmin()


def compute_avwap(df: pd.DataFrame, anchor_date: pd.Timestamp) -> float:
    """
    Calculate Anchored VWAP from anchor_date to the last available date.
    AVWAP = sum(typical_price * volume) / sum(volume)
    Typical price = (High + Low + Close) / 3
    """
    try:
        mask = df.index >= anchor_date
        sub = df[mask]
        if sub.empty or len(sub) < 2:
            # Fallback: use full df
            sub = df

        high = sub["High"].squeeze()
        low = sub["Low"].squeeze()
        close = sub["Close"].squeeze()
        volume = sub["Volume"].squeeze()

        typical_price = (high + low + close) / 3.0
        vwap = (typical_price * volume).sum() / volume.sum()
        return float(vwap)
    except Exception:
        return float(df["Close"].squeeze().iloc[-1])


def compute_adx(df: pd.DataFrame, period: int = 14) -> float:
    """
    Compute the Average Directional Index (ADX) manually.
    Returns the latest ADX value (float).
    """
    try:
        high = df["High"].squeeze().values.astype(float)
        low = df["Low"].squeeze().values.astype(float)
        close = df["Close"].squeeze().values.astype(float)

        n = len(close)
        if n < period * 2 + 1:
            return 0.0

        # True Range
        tr = np.zeros(n)
        for i in range(1, n):
            hl = high[i] - low[i]
            hc = abs(high[i] - close[i - 1])
            lc = abs(low[i] - close[i - 1])
            tr[i] = max(hl, hc, lc)

        # Directional Movement
        plus_dm = np.zeros(n)
        minus_dm = np.zeros(n)
        for i in range(1, n):
            up = high[i] - high[i - 1]
            down = low[i - 1] - low[i]
            if up > down and up > 0:
                plus_dm[i] = up
            if down > up and down > 0:
                minus_dm[i] = down

        # Wilder smoothing
        def wilder_smooth(arr, p):
            result = np.zeros(len(arr))
            result[p] = arr[1:p + 1].sum()
            for i in range(p + 1, len(arr)):
                result[i] = result[i - 1] - (result[i - 1] / p) + arr[i]
            return result

        atr = wilder_smooth(tr, period)
        plus_di_smooth = wilder_smooth(plus_dm, period)
        minus_di_smooth = wilder_smooth(minus_dm, period)

        # DI lines
        with np.errstate(divide="ignore", invalid="ignore"):
            plus_di = np.where(atr > 0, 100 * plus_di_smooth / atr, 0)
            minus_di = np.where(atr > 0, 100 * minus_di_smooth / atr, 0)

        # DX
        di_sum = plus_di + minus_di
        with np.errstate(divide="ignore", invalid="ignore"):
            dx = np.where(di_sum > 0, 100 * np.abs(plus_di - minus_di) / di_sum, 0)

        # ADX = smoothed DX
        adx = wilder_smooth(dx, period)
        latest_adx = adx[-1]
        return float(np.clip(latest_adx, 0, 100))
    except Exception:
        return 0.0


def compute_confidence_score(
    df: pd.DataFrame,
    fast_ma: pd.Series,
    slow_ma: pd.Series,
    adx: float,
    volume_ratio: float,
) -> int:
    """
    Proprietary 0-100 confidence score based on:
    - Distance from 200-day SMA         → up to 30 pts
    - Volume ratio on crossover day     → up to 30 pts
    - ADX strength                      → up to 40 pts
    Returns an integer score between 0 and 100.
    """
    score = 0
    close = df["Close"].squeeze()
    current_price = float(close.iloc[-1])

    # ── 1. Distance from 200-day SMA (0-30 pts) ──────────────────────────────
    sma200 = close.rolling(200).mean().iloc[-1]
    if pd.notna(sma200) and sma200 > 0:
        distance_pct = (current_price - sma200) / sma200 * 100
        if 3 <= distance_pct <= 15:
            score += 30           # Sweet spot
        elif 15 < distance_pct <= 30:
            score += 20           # Extended but ok
        elif 0 <= distance_pct < 3:
            score += 10           # Too close — weak trend
        elif distance_pct > 30:
            score += 5            # Overextended — risky
        # Negative distance (below 200 SMA) → 0 pts

    # ── 2. Volume ratio (0-30 pts) ────────────────────────────────────────────
    if volume_ratio >= 2.0:
        score += 30
    elif volume_ratio >= 1.5:
        score += 22
    elif volume_ratio >= 1.2:
        score += 15
    elif volume_ratio >= 1.0:
        score += 8
    # Below average volume → 0 pts

    # ── 3. ADX strength (0-40 pts) ────────────────────────────────────────────
    if adx >= 30:
        score += 40
    elif adx >= 25:
        score += 30
    elif adx >= 20:
        score += 18
    elif adx >= 15:
        score += 8
    # ADX < 15 → no trend → 0 pts

    return int(np.clip(score, 0, 100))


def get_volume_ratio(df: pd.DataFrame, window: int = 20) -> float:
    """
    Returns today's volume divided by the 20-day average volume.
    A ratio > 1 means above-average volume (bullish crossover confirmation).
    """
    try:
        volume = df["Volume"].squeeze()
        avg_vol = volume.iloc[-window - 1:-1].mean()
        today_vol = float(volume.iloc[-1])
        if avg_vol > 0:
            return round(today_vol / avg_vol, 2)
        return 1.0
    except Exception:
        return 1.0


def get_relative_strength(
    stock_df: pd.DataFrame, benchmark_df: pd.DataFrame, period: int = 60
) -> float:
    """
    Computes relative strength of stock vs benchmark over `period` trading days.
    Returns % outperformance (positive = stock outperformed benchmark).
    """
    try:
        stock_close = stock_df["Close"].squeeze()
        bench_close = benchmark_df["Close"].squeeze()

        # Align on common dates
        common_idx = stock_close.index.intersection(bench_close.index)
        if len(common_idx) < period + 1:
            return 0.0

        stock_aligned = stock_close.loc[common_idx]
        bench_aligned = bench_close.loc[common_idx]
        stock_ret = (float(stock_aligned.iloc[-1]) / float(stock_aligned.iloc[-period]) - 1) * 100
        bench_ret = (float(bench_aligned.iloc[-1]) / float(bench_aligned.iloc[-period]) - 1) * 100
        return round(float(stock_ret - bench_ret), 2)
    except Exception:
        return 0.0
