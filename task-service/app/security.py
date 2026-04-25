from __future__ import annotations

import httpx
from fastapi import Depends, Header, HTTPException, status

from .models import get_settings


async def verify_token_with_auth(token: str) -> dict:
    settings = get_settings()
    url = f"{settings.AUTH_SERVICE_URL.rstrip('/')}/verify"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(url, json={"token": token})
    except httpx.HTTPError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Auth service unavailable",
        )

    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid token")
    data = resp.json()
    if not data.get("valid"):
        raise HTTPException(
            status_code=401,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return data


async def get_current_user(authorization: str | None = Header(default=None)) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=401,
            detail="Missing bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = authorization.split(" ", 1)[1].strip()
    data = await verify_token_with_auth(token)
    return {
        "user_id": data["user_id"],
        "email": data.get("email"),
        "first_name": data.get("first_name"),
        "last_name": data.get("last_name"),
    }
