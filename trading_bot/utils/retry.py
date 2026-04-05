"""
Retry logic for network calls with exponential backoff.
"""
import time
import functools
from typing import TypeVar, Callable

T = TypeVar("T")


def retry(max_attempts: int = 3, base_delay: float = 1.0,
          max_delay: float = 16.0, exceptions: tuple = (Exception,)):
    """Decorator: retry with exponential backoff."""
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @functools.wraps(func)
        def wrapper(*args, **kwargs) -> T:
            last_exc = None
            for attempt in range(max_attempts):
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    last_exc = e
                    if attempt < max_attempts - 1:
                        delay = min(base_delay * (2 ** attempt), max_delay)
                        time.sleep(delay)
            raise last_exc
        return wrapper
    return decorator
