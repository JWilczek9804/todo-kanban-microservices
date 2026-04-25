from __future__ import annotations

from fastapi import Depends
from redis.asyncio import Redis

from ..redis_client import get_redis
from .task_service import TaskService


def get_task_service(r: Redis = Depends(get_redis)) -> TaskService:
    return TaskService(r)
