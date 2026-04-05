"""
Retry logic with exponential backoff for API calls.
"""

import time
import functools
from typing import Callable, Any
from utils.logger import get_logger

logger = get_logger("retry")


class RetryExhausted(Exception):
    pass


def retry(
    max_attempts: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 30.0,
    retryable_status_codes: tuple[int, ...] = (429, 500, 502, 503, 504),
) -> Callable:
    """
    Decorator that retries a function on requests-level HTTP errors.
    Uses exponential backoff with jitter.
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            last_exception = None
            for attempt in range(1, max_attempts + 1):
                try:
                    result = func(*args, **kwargs)
                    # If result is a requests.Response, check status
                    if hasattr(result, "status_code"):
                        if result.status_code in retryable_status_codes:
                            if attempt < max_attempts:
                                delay = min(base_delay * (2 ** (attempt - 1)), max_delay)
                                logger.warning(
                                    "Retryable status %d from %s (attempt %d/%d), "
                                    "retrying in %.1fs",
                                    result.status_code, func.__name__,
                                    attempt, max_attempts, delay,
                                )
                                time.sleep(delay)
                                continue
                            else:
                                result.raise_for_status()
                    return result
                except Exception as exc:
                    last_exception = exc
                    if attempt < max_attempts:
                        delay = min(base_delay * (2 ** (attempt - 1)), max_delay)
                        logger.warning(
                            "Exception in %s (attempt %d/%d): %s — retrying in %.1fs",
                            func.__name__, attempt, max_attempts, exc, delay,
                        )
                        time.sleep(delay)
                    else:
                        logger.error(
                            "All %d attempts exhausted for %s: %s",
                            max_attempts, func.__name__, exc,
                        )
                        raise RetryExhausted(
                            f"{func.__name__} failed after {max_attempts} attempts"
                        ) from last_exception
        return wrapper
    return decorator
