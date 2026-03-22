"""
Technical indicators computed on OHLCV DataFrames.
All functions accept a pd.DataFrame and return a pd.Series or scalar.
"""
import numpy as np
import pandas as pd


def rsi(close: pd.Series, period: int = 14) -> pd.Series:
    delta = close.diff()
    gain  = delta.clip(lower=0).ewm(com=period - 1, adjust=False).mean()
    loss  = (-delta.clip(upper=0)).ewm(com=period - 1, adjust=False).mean()
    rs    = gain / loss.replace(0, np.nan)
    return 100 - 100 / (1 + rs)


def macd(close: pd.Series, fast: int = 12, slow: int = 26,
         signal: int = 9) -> pd.DataFrame:
    ema_fast   = close.ewm(span=fast,   adjust=False).mean()
    ema_slow   = close.ewm(span=slow,   adjust=False).mean()
    macd_line  = ema_fast - ema_slow
    signal_line= macd_line.ewm(span=signal, adjust=False).mean()
    histogram  = macd_line - signal_line
    return pd.DataFrame({
        "macd":      macd_line,
        "signal":    signal_line,
        "histogram": histogram,
    })


def bollinger_bands(close: pd.Series, period: int = 20,
                    stddev: float = 2.0) -> pd.DataFrame:
    mid   = close.rolling(period).mean()
    sigma = close.rolling(period).std()
    return pd.DataFrame({
        "upper": mid + stddev * sigma,
        "mid":   mid,
        "lower": mid - stddev * sigma,
        "pct_b": (close - (mid - stddev * sigma)) / (2 * stddev * sigma),
    })


def ema(close: pd.Series, span: int) -> pd.Series:
    return close.ewm(span=span, adjust=False).mean()


def atr(high: pd.Series, low: pd.Series, close: pd.Series,
        period: int = 14) -> pd.Series:
    tr = pd.concat([
        high - low,
        (high - close.shift()).abs(),
        (low  - close.shift()).abs(),
    ], axis=1).max(axis=1)
    return tr.ewm(com=period - 1, adjust=False).mean()


def volume_ratio(volume: pd.Series, period: int = 20) -> pd.Series:
    """Current volume / rolling mean volume."""
    return volume / volume.rolling(period).mean()


def stochastic(high: pd.Series, low: pd.Series, close: pd.Series,
               k_period: int = 14, d_period: int = 3) -> pd.DataFrame:
    lowest  = low.rolling(k_period).min()
    highest = high.rolling(k_period).max()
    k = 100 * (close - lowest) / (highest - lowest + 1e-10)
    d = k.rolling(d_period).mean()
    return pd.DataFrame({"k": k, "d": d})


def vwap(high: pd.Series, low: pd.Series, close: pd.Series,
         volume: pd.Series) -> pd.Series:
    typical   = (high + low + close) / 3
    cum_tp_vol = (typical * volume).cumsum()
    cum_vol    = volume.cumsum()
    return cum_tp_vol / cum_vol.replace(0, np.nan)


def adx(high: pd.Series, low: pd.Series, close: pd.Series,
        period: int = 14) -> pd.Series:
    """Average Directional Index — measures trend strength."""
    up_move   = high.diff()
    down_move = -low.diff()
    plus_dm   = pd.Series(np.where((up_move > down_move) & (up_move > 0), up_move, 0.0),
                          index=close.index)
    minus_dm  = pd.Series(np.where((down_move > up_move) & (down_move > 0), down_move, 0.0),
                          index=close.index)
    atr_val   = atr(high, low, close, period)
    plus_di   = 100 * plus_dm.ewm(com=period-1, adjust=False).mean() / atr_val
    minus_di  = 100 * minus_dm.ewm(com=period-1, adjust=False).mean() / atr_val
    dx        = 100 * (plus_di - minus_di).abs() / (plus_di + minus_di + 1e-10)
    return dx.ewm(com=period-1, adjust=False).mean()


def compute_all(df: pd.DataFrame,
                rsi_period: int = 14,
                macd_fast: int = 12, macd_slow: int = 26, macd_signal: int = 9,
                bb_period: int = 20, bb_stddev: float = 2.0,
                ema_short: int = 9, ema_long: int = 21,
                atr_period: int = 14,
                volume_ma_period: int = 20) -> pd.DataFrame:
    """
    Add all indicator columns to df in-place.
    Returns the enriched DataFrame.
    """
    c, h, l, v = df["close"], df["high"], df["low"], df["volume"]

    df["rsi"]         = rsi(c, rsi_period)
    macd_df           = macd(c, macd_fast, macd_slow, macd_signal)
    df["macd"]        = macd_df["macd"]
    df["macd_signal"] = macd_df["signal"]
    df["macd_hist"]   = macd_df["histogram"]
    bb_df             = bollinger_bands(c, bb_period, bb_stddev)
    df["bb_upper"]    = bb_df["upper"]
    df["bb_mid"]      = bb_df["mid"]
    df["bb_lower"]    = bb_df["lower"]
    df["bb_pct_b"]    = bb_df["pct_b"]
    df["ema_short"]   = ema(c, ema_short)
    df["ema_long"]    = ema(c, ema_long)
    df["atr"]         = atr(h, l, c, atr_period)
    df["vol_ratio"]   = volume_ratio(v, volume_ma_period)
    stoch             = stochastic(h, l, c)
    df["stoch_k"]     = stoch["k"]
    df["stoch_d"]     = stoch["d"]
    df["vwap"]        = vwap(h, l, c, v)
    df["adx"]         = adx(h, l, c)
    return df
