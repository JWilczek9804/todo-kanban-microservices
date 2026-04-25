from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .redis_client import close_redis, get_redis
from .routers.tasks import router as tasks_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    client = get_redis()
    try:
        await client.ping()
    except Exception:
        pass
    yield
    await close_redis()


app = FastAPI(title="TaskFlow Task Service", version="1.0.0", lifespan=lifespan, redocs_url="/redocs", docs_url="/docs")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tasks_router)


@app.get("/health", tags=["health"])
async def health() -> dict[str, str]:
    return {"status": "ok"}
