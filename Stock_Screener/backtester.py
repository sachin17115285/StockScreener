# backtester.py — 5-Year Historical Backtest Engine

import yfinance as yf
import pandas as pd
import numpy as np

from indicators import compute_ma


def backtest(
    ticker: str,
    ma_type: str = "EMA",
    fast_period: int = 12,
    slow_period: int = 26,
    hold_days: int = 180,
) -> dict:
    """
    Simulate a crossover-based trading strategy on 5 years of historical data.

    Strategy:
    - Buy signal: fast MA crosses above slow MA (bullish crossover)
    - Sell: after exactly `hold_days` calendar days (or at end of data)
    - No overlapping trades (one trade at a time)

    Returns:
        dict with win_rate, avg_return, max_drawdown, total_trades, equity_curve
    """
    try:
        # Download 5 years of data
        df = yf.download(ticker, period="5y", progress=False, auto_adjust=True)

        if df is None or df.empty or len(df) < slow_period + hold_days + 10:
            return {
                "error": "Not enough historical data for backtesting",
                "win_rate": 0,
                "avg_return": 0,
                "max_drawdown": 0,
                "total_trades": 0,
                "equity_curve": [],
            }

        close = df["Close"].squeeze()
        fast_ma = compute_ma(df, ma_type, fast_period)
        slow_ma = compute_ma(df, ma_type, slow_period)

        trades = []
        in_trade = False
        sell_idx = -1

        # Scan for all bullish crossovers
        for i in range(slow_period + 1, len(df) - 1):
            if in_trade:
                if i >= sell_idx:
                    in_trade = False
                continue

            curr_fast = fast_ma.iloc[i]
            curr_slow = slow_ma.iloc[i]
            prev_fast = fast_ma.iloc[i - 1]
            prev_slow = slow_ma.iloc[i - 1]

            if (
                pd.notna(curr_fast) and pd.notna(curr_slow)
                and pd.notna(prev_fast) and pd.notna(prev_slow)
                and curr_fast > curr_slow
                and prev_fast <= prev_slow
            ):
                # Buy at next day's open (approximate with next close)
                buy_idx = i + 1
                if buy_idx >= len(df):
                    break

                buy_price = float(close.iloc[buy_idx])
                buy_date = df.index[buy_idx]

                # Maximum hold limit in calendar days
                max_sell_date = buy_date + pd.Timedelta(days=hold_days)
                max_sell_candidates = df.index[buy_idx + 1:]
                max_sell_candidates = max_sell_candidates[max_sell_candidates >= max_sell_date]
                max_sell_bar = (
                    df.index.get_loc(max_sell_candidates[0])
                    if len(max_sell_candidates) > 0
                    else len(df) - 1
                )

                # Exit early on bearish crossover (fast crosses below slow),
                # but no later than the max hold limit
                sell_idx_pos = max_sell_bar
                for j in range(buy_idx + 1, max_sell_bar + 1):
                    jf = fast_ma.iloc[j]
                    js = slow_ma.iloc[j]
                    pf = fast_ma.iloc[j - 1]
                    ps = slow_ma.iloc[j - 1]
                    if (
                        pd.notna(jf) and pd.notna(js)
                        and pd.notna(pf) and pd.notna(ps)
                        and jf < js and pf >= ps
                    ):
                        sell_idx_pos = j  # exit on bearish crossover bar
                        break

                sell_price = float(close.iloc[sell_idx_pos])
                sell_date_actual = df.index[sell_idx_pos]
                ret = (sell_price - buy_price) / buy_price * 100

                trades.append({
                    "buy_date": buy_date.strftime("%Y-%m-%d"),
                    "buy_price": round(buy_price, 2),
                    "sell_date": sell_date_actual.strftime("%Y-%m-%d"),
                    "sell_price": round(sell_price, 2),
                    "return_pct": round(ret, 2),
                    "profit": ret > 0,
                })

                sell_idx = sell_idx_pos
                in_trade = True

        if not trades:
            return {
                "error": "No crossover signals found in 5-year history",
                "win_rate": 0,
                "avg_return": 0,
                "max_drawdown": 0,
                "total_trades": 0,
                "equity_curve": [],
            }

        # ── Statistics ─────────────────────────────────────────────────────
        returns = [t["return_pct"] for t in trades]
        wins = [r for r in returns if r > 0]

        win_rate = round(len(wins) / len(trades) * 100, 1)
        avg_return = round(np.mean(returns), 2)
        best_trade = round(max(returns), 2)
        worst_trade = round(min(returns), 2)

        # Max Drawdown: simulate equity curve starting at 100
        equity = 100.0
        peak = equity
        max_dd = 0.0
        equity_curve = []

        for t in trades:
            # Add entry point
            equity_curve.append({"date": t["buy_date"], "value": round(equity, 2)})
            # Apply return
            equity = equity * (1 + t["return_pct"] / 100)
            equity_curve.append({"date": t["sell_date"], "value": round(equity, 2)})
            # Track max drawdown
            if equity > peak:
                peak = equity
            dd = (equity - peak) / peak * 100
            if dd < max_dd:
                max_dd = dd

        return {
            "win_rate": win_rate,
            "avg_return": avg_return,
            "max_drawdown": round(max_dd, 2),
            "total_trades": len(trades),
            "best_trade": best_trade,
            "worst_trade": worst_trade,
            "final_equity": round(equity, 2),
            "total_return": round((equity - 100) / 100 * 100, 2),
            "equity_curve": equity_curve,
            "trades": trades,  # all trades
        }

    except Exception as e:
        return {
            "error": f"Backtest failed: {str(e)}",
            "win_rate": 0,
            "avg_return": 0,
            "max_drawdown": 0,
            "total_trades": 0,
            "equity_curve": [],
        }
