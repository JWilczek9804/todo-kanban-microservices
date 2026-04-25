from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from jose import JWTError
from redis.asyncio import Redis

from ..redis_client import get_redis
from ..schemas import (
    AccessToken,
    LogoutRequest,
    RefreshRequest,
    TokenPair,
    UserCreate,
    UserOut,
    VerifyRequest,
    VerifyResponse,
)
from ..security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)

router = APIRouter(tags=["auth"])


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _user_key(email: str) -> str:
    return f"user:{_normalize_email(email)}"


def _refresh_key(jti: str) -> str:
    return f"refresh:{jti}"


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(payload: UserCreate, r: Redis = Depends(get_redis)) -> UserOut:
    email = _normalize_email(payload.email)
    key = f"user:{email}"
    if await r.exists(key):
        raise HTTPException(status_code=409, detail="Email already registered")

    user_id = str(uuid.uuid4())
    created_at = datetime.now(tz=timezone.utc).isoformat()
    await r.hset(
        key,
        mapping={
            "id": user_id,
            "email": email,
            "first_name": payload.first_name,
            "last_name": payload.last_name,
            "hashed_pw": hash_password(payload.password),
            "created_at": created_at,
        },
    )
    return UserOut(
        id=user_id,
        email=email,
        first_name=payload.first_name,
        last_name=payload.last_name,
        created_at=datetime.fromisoformat(created_at),
    )


@router.post("/token", response_model=TokenPair)
async def login(
    form: OAuth2PasswordRequestForm = Depends(),
    r: Redis = Depends(get_redis),
) -> TokenPair:
    key = _user_key(form.username)
    data = await r.hgetall(key)
    if not data or not verify_password(form.password, data.get("hashed_pw", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = data["id"]
    email = data["email"]
    first_name = data.get("first_name", "")
    last_name = data.get("last_name", "")

    access = create_access_token(
        user_id=user_id,
        email=email,
        first_name=first_name,
        last_name=last_name,
    )
    refresh, jti, expire = create_refresh_token(user_id=user_id, email=email)

    ttl = max(int((expire - datetime.now(tz=timezone.utc)).total_seconds()), 1)
    await r.set(_refresh_key(jti), email, ex=ttl)

    return TokenPair(access_token=access, refresh_token=refresh)


@router.post("/verify", response_model=VerifyResponse)
async def verify(payload: VerifyRequest) -> VerifyResponse:
    try:
        data = decode_token(payload.token, expected_type="access")
    except JWTError:
        return VerifyResponse(valid=False)
    return VerifyResponse(
        valid=True,
        user_id=data.get("sub"),
        email=data.get("email"),
        first_name=data.get("first_name"),
        last_name=data.get("last_name"),
    )


@router.post("/refresh", response_model=AccessToken)
async def refresh(payload: RefreshRequest, r: Redis = Depends(get_redis)) -> AccessToken:
    try:
        data = decode_token(payload.refresh_token, expected_type="refresh")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    jti = data.get("jti")
    if not jti or not await r.exists(_refresh_key(jti)):
        raise HTTPException(status_code=401, detail="Refresh token revoked")

    email = data.get("email") or ""
    user = await r.hgetall(f"user:{_normalize_email(email)}") if email else {}
    first_name = user.get("first_name", "")
    last_name = user.get("last_name", "")

    access = create_access_token(
        user_id=data["sub"],
        email=email,
        first_name=first_name,
        last_name=last_name,
    )
    return AccessToken(access_token=access)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def logout(payload: LogoutRequest, r: Redis = Depends(get_redis)) -> Response:
    try:
        data = decode_token(payload.refresh_token, expected_type="refresh")
    except JWTError:
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    jti = data.get("jti")
    if jti:
        await r.delete(_refresh_key(jti))
    return Response(status_code=status.HTTP_204_NO_CONTENT)
