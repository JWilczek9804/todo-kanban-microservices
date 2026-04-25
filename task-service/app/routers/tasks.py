from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from ..schemas import Task, TaskCreate, TaskStatus, TaskUpdate
from ..security import get_current_user
from ..services.dependencies import get_task_service
from ..services.task_service import TaskNotFoundError, TaskService

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("", response_model=list[Task])
async def list_tasks(
    status_filter: Optional[TaskStatus] = Query(default=None, alias="status"),
    user=Depends(get_current_user),
    service: TaskService = Depends(get_task_service),
) -> list[Task]:
    return await service.list_for_user(user["user_id"], status_filter=status_filter)


@router.post("", response_model=Task, status_code=status.HTTP_201_CREATED)
async def create_task(
    payload: TaskCreate,
    user=Depends(get_current_user),
    service: TaskService = Depends(get_task_service),
) -> Task:
    return await service.create_for_user(user["user_id"], payload)


@router.get("/{task_id}", response_model=Task)
async def get_task(
    task_id: str,
    user=Depends(get_current_user),
    service: TaskService = Depends(get_task_service),
) -> Task:
    try:
        return await service.get_for_user(user["user_id"], task_id)
    except TaskNotFoundError:
        raise HTTPException(status_code=404, detail="Task not found")


@router.patch("/{task_id}", response_model=Task)
async def update_task(
    task_id: str,
    payload: TaskUpdate,
    user=Depends(get_current_user),
    service: TaskService = Depends(get_task_service),
) -> Task:
    try:
        return await service.update_for_user(user["user_id"], task_id, payload)
    except TaskNotFoundError:
        raise HTTPException(status_code=404, detail="Task not found")


@router.delete(
    "/{task_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
async def delete_task(
    task_id: str,
    user=Depends(get_current_user),
    service: TaskService = Depends(get_task_service),
) -> Response:
    try:
        await service.delete_for_user(user["user_id"], task_id)
    except TaskNotFoundError:
        raise HTTPException(status_code=404, detail="Task not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
