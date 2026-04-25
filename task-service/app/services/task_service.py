from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from redis.asyncio import Redis

from ..schemas import Task, TaskCreate, TaskStatus, TaskUpdate


class TaskNotFoundError(Exception):
    """Raised when a task does not exist for the given user."""


class TaskService:

    def __init__(self, redis: Redis) -> None:
        self._r = redis

    @staticmethod
    def _task_key(user_id: str, task_id: str) -> str:
        return f"task:{user_id}:{task_id}"

    @staticmethod
    def _index_key(user_id: str) -> str:
        return f"tasks:{user_id}"

    @staticmethod
    def _serialize(task: Task) -> str:
        return task.model_dump_json()

    @staticmethod
    def _deserialize(raw: str) -> Task:
        return Task.model_validate_json(raw)


    async def list_for_user(
        self,
        user_id: str,
        *,
        status_filter: Optional[TaskStatus] = None,
    ) -> list[Task]:
        index_key = self._index_key(user_id)
        ids = await self._r.smembers(index_key)
        if not ids:
            return []

        keys = [self._task_key(user_id, tid) for tid in ids]
        raws = await self._r.mget(keys)

        tasks: list[Task] = []
        stale_ids: list[str] = []
        for tid, raw in zip(ids, raws):
            if raw is None:
                stale_ids.append(tid)
                continue
            try:
                task = self._deserialize(raw)
            except Exception:
                stale_ids.append(tid)
                continue
            if status_filter is None or task.status == status_filter:
                tasks.append(task)

        if stale_ids:
            await self._r.srem(index_key, *stale_ids)

        tasks.sort(key=lambda t: t.created_at, reverse=True)
        return tasks

    async def create_for_user(self, user_id: str, payload: TaskCreate) -> Task:
        now = datetime.now(tz=timezone.utc)
        task = Task(
            id=str(uuid.uuid4()),
            title=payload.title,
            description=payload.description,
            status=payload.status,
            deadline=payload.deadline,
            created_at=now,
            updated_at=now,
        )
        pipe = self._r.pipeline()
        pipe.set(self._task_key(user_id, task.id), self._serialize(task))
        pipe.sadd(self._index_key(user_id), task.id)
        await pipe.execute()
        return task

    async def get_for_user(self, user_id: str, task_id: str) -> Task:
        raw = await self._r.get(self._task_key(user_id, task_id))
        if raw is None:
            raise TaskNotFoundError(task_id)
        return self._deserialize(raw)

    async def update_for_user(
        self, user_id: str, task_id: str, payload: TaskUpdate
    ) -> Task:
        key = self._task_key(user_id, task_id)
        raw = await self._r.get(key)
        if raw is None:
            raise TaskNotFoundError(task_id)

        task = self._deserialize(raw)
        update_data = payload.model_dump(exclude_unset=True)
        updated = task.model_copy(
            update={**update_data, "updated_at": datetime.now(tz=timezone.utc)}
        )
        await self._r.set(key, self._serialize(updated))
        return updated

    async def delete_for_user(self, user_id: str, task_id: str) -> None:
        pipe = self._r.pipeline()
        pipe.delete(self._task_key(user_id, task_id))
        pipe.srem(self._index_key(user_id), task_id)
        deleted, _ = await pipe.execute()
        if not deleted:
            raise TaskNotFoundError(task_id)
