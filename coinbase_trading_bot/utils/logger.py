"""
Logging configuration for the trading bot.
SECURITY: Never logs API secrets, keys, or sensitive credential data.
"""

import logging
import sys
from pathlib import Path

_INITIALIZED = False


def setup_logger(level: str = "INFO") -> logging.Logger:
    global _INITIALIZED

    logger = logging.getLogger("coinbase_bot")

    if _INITIALIZED:
        return logger

    logger.setLevel(getattr(logging, level.upper(), logging.INFO))

    # Console handler — human-readable
    console = logging.StreamHandler(sys.stdout)
    console.setLevel(logging.DEBUG)
    console_fmt = logging.Formatter(
        "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    console.setFormatter(console_fmt)
    logger.addHandler(console)

    # File handler — persistent log
    log_dir = Path(__file__).resolve().parent.parent / "output"
    log_dir.mkdir(exist_ok=True)
    file_handler = logging.FileHandler(log_dir / "bot.log")
    file_handler.setLevel(logging.DEBUG)
    file_fmt = logging.Formatter(
        "%(asctime)s | %(levelname)-8s | %(name)s | %(funcName)s:%(lineno)d | %(message)s",
    )
    file_handler.setFormatter(file_fmt)
    logger.addHandler(file_handler)

    logger.propagate = False
    _INITIALIZED = True
    return logger


def get_logger(name: str | None = None) -> logging.Logger:
    base = logging.getLogger("coinbase_bot")
    if name:
        return base.getChild(name)
    return base
