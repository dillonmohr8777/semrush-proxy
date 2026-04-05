"""
Coinbase Advanced Trade API — JWT authentication.

Uses the ES256 (ECDSA P-256) signing method required by Coinbase for
server-side API key authentication.

Reference: https://docs.cdp.coinbase.com/advanced-trade/docs/rest-api-auth

SECURITY:
- API secrets are never printed or logged.
- Credentials are read from environment variables via config.py.
"""

import time
import secrets
from typing import Optional

import jwt  # PyJWT
from cryptography.hazmat.primitives.serialization import load_pem_private_key

from config import CoinbaseCredentials
from utils.logger import get_logger

logger = get_logger("jwt_auth")

# Coinbase Advanced Trade REST API service identifier
_SERVICE = "retail_rest_api_proxy"


def _build_jwt(
    credentials: CoinbaseCredentials,
    method: str,
    path: str,
) -> str:
    """
    Build a signed JWT for a single Coinbase REST API request.

    Args:
        credentials: API key + secret loaded from env.
        method: HTTP method (GET, POST, etc.).
        path: Request path, e.g. "/api/v3/brokerage/accounts".

    Returns:
        Encoded JWT string suitable for the Authorization header.
    """
    now = int(time.time())
    uri = f"{method.upper()} {path}"

    payload = {
        "sub": credentials.api_key,
        "iss": "coinbase-cloud",
        "aud": [_SERVICE],
        "nbf": now,
        "exp": now + 120,  # 2-minute expiry
        "uri": uri,
    }

    headers = {
        "kid": credentials.api_key,
        "nonce": secrets.token_hex(16),
        "typ": "JWT",
    }

    # The Coinbase API secret is an EC PEM private key.
    private_key = load_pem_private_key(
        credentials.api_secret.encode("utf-8"),
        password=None,
    )

    token = jwt.encode(
        payload,
        private_key,
        algorithm="ES256",
        headers=headers,
    )

    return token


def get_auth_headers(
    credentials: CoinbaseCredentials,
    method: str,
    path: str,
) -> dict[str, str]:
    """
    Return the headers dict needed for an authenticated Coinbase API call.
    """
    token = _build_jwt(credentials, method, path)
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
