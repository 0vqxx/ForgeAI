"""
Clerk JWT middleware for FastAPI.

Verifies Clerk session JWTs from the Authorization: Bearer <token> header
using Clerk's JWKS endpoint. Stores decoded claims on request.state.user.
"""
from __future__ import annotations

import logging
import os
from typing import Any, Dict, Optional

import jwt
from fastapi import Request
from fastapi.responses import JSONResponse
from jwt import PyJWKClient

logger = logging.getLogger(__name__)

CLERK_JWKS_URL = os.environ.get("CLERK_JWKS_URL")
CLERK_ISSUER = os.environ.get("CLERK_ISSUER")

_jwks_client: Optional[PyJWKClient] = None


def _get_jwks_client() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        if not CLERK_JWKS_URL:
            raise RuntimeError("CLERK_JWKS_URL environment variable is not set")
        _jwks_client = PyJWKClient(CLERK_JWKS_URL, lifespan=3600)
    return _jwks_client


async def clerk_auth_middleware(request: Request, call_next):
    path = request.url.path
    if not path.startswith(("/api/fs", "/api/ai", "/api/terminal", "/api/git")):
        return await call_next(request)

    auth_header = request.headers.get("authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        logger.warning("Missing or malformed Authorization header for %s", path)
        return JSONResponse(
            status_code=401,
            content={"detail": "Unauthorized: missing or invalid Authorization header"},
        )

    token = auth_header[7:].strip()
    if not token:
        logger.warning("Empty token for %s", path)
        return JSONResponse(
            status_code=401,
            content={"detail": "Unauthorized: empty token"},
        )

    try:
        client = _get_jwks_client()
        signing_key = client.get_signing_key_from_jwt(token)

        claims: Dict[str, Any] = jwt.decode(
            token,
            key=signing_key.key,
            algorithms=["RS256"],
            options={"verify_aud": False},  # Clerk JWTs sometimes omit aud
            issuer=CLERK_ISSUER,
            leeway=60,
        )
    except jwt.ExpiredSignatureError:
        logger.warning("Expired JWT for %s", path)
        return JSONResponse(
            status_code=401,
            content={"detail": "Unauthorized: token expired"},
        )
    except jwt.InvalidTokenError as e:
        logger.warning("Invalid JWT for %s: %s", path, e)
        return JSONResponse(
            status_code=401,
            content={"detail": "Unauthorized: invalid token"},
        )

    sub = claims.get("sub")
    if not sub:
        logger.warning("JWT missing sub claim for %s", path)
        return JSONResponse(
            status_code=401,
            content={"detail": "Unauthorized: no user id in token"},
        )

    request.state.user_id = sub
    request.state.claims = claims
    return await call_next(request)


def get_user_id(request: Request) -> str:
    """Retrieve the authenticated Clerk user id from the request state."""
    uid = getattr(request.state, "user_id", None)
    if not uid:
        raise ValueError("No authenticated user on this request")
    return uid