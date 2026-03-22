"""
Structured logging setup.
Logs to both stdout (Rich formatter) and rotating file.
"""
import logging
import logging.handlers
import os
from datetime import datetime

from config.settings import LOG_LEVEL, LOG_DIR, LOG_TO_FILE


def setup_logging(name: str = "trader") -> logging.Logger:
    """Configure and return the root logger."""
    os.makedirs(LOG_DIR, exist_ok=True)

    level = getattr(logging, LOG_LEVEL.upper(), logging.INFO)
    root  = logging.getLogger()
    root.setLevel(level)

    fmt = logging.Formatter(
        "%(asctime)s [%(levelname)-8s] %(name)-20s %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )

    # Console handler
    ch = logging.StreamHandler()
    ch.setLevel(level)
    ch.setFormatter(fmt)
    root.addHandler(ch)

    # File handler (rotating, 10 MB × 5 backups)
    if LOG_TO_FILE:
        date_str  = datetime.utcnow().strftime("%Y%m%d")
        log_file  = os.path.join(LOG_DIR, f"trader_{date_str}.log")
        fh = logging.handlers.RotatingFileHandler(
            log_file, maxBytes=10 * 1024 * 1024, backupCount=5
        )
        fh.setLevel(level)
        fh.setFormatter(fmt)
        root.addHandler(fh)

    # Quiet noisy libraries
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("websockets").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("telegram").setLevel(logging.WARNING)

    return logging.getLogger(name)
