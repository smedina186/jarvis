"""Authenticated control plane. Disabled until a durable external store is authorized."""

import asyncio
import threading
from collections import deque
from time import monotonic
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from config import Settings
from durable.missions import AGENT_REGISTRY, MissionService
from durable.repository import StoragePending, postgres_repository
from durable.service import MemoryInput, MemoryService


class Operation(BaseModel):
    model_config = ConfigDict(extra="forbid")
    action: Literal[
        "remember",
        "recall",
        "list",
        "update",
        "forget",
        "forget_all",
        "forget_owner",
        "export",
        "audit",
    ]
    project: str = Field(default="personal", pattern=r"^[a-zA-Z0-9_-]{1,40}$")
    id: str = Field(default="", max_length=80)
    query: str = Field(default="", max_length=1000)
    memory: MemoryInput | None = None
    confirmation: str = Field(default="", max_length=50)


class MissionOperation(BaseModel):
    model_config = ConfigDict(extra="forbid")
    action: Literal["list", "create", "approve", "pause", "resume", "run_step"]
    project: str = Field(default="personal", pattern=r"^[a-zA-Z0-9_-]{1,40}$")
    id: str = Field(default="", max_length=80)
    goal: str = Field(default="", max_length=2000)
    agent: str = Field(default="archivist", max_length=40)


class DurableRuntime:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.memory: MemoryService | None = None
        self.missions: MissionService | None = None
        self.error = ""
        self.index_clients = {}
        self.attempts: deque[float] = deque()
        self.lock = asyncio.Lock()
        self.worker_lock = threading.Lock()

    def ready(self) -> MemoryService:
        if (
            self.settings.memory_mode != "approved_external"
            or not self.settings.memory_database_url.get_secret_value()
        ):
            raise StoragePending(
                "Memoria pendiente: falta almacenamiento duradero aprobado compatible con $0."
            )
        if not self.memory:
            repository = postgres_repository(self.settings.memory_database_url.get_secret_value())
            repository.initialize()
            self.memory = MemoryService(
                repository,
                self.settings.owner_github_id,
                self.index_client
                if self.settings.memanto_mode == "approved_free_credits"
                else None,
            )
            if self.settings.memanto_mode not in {"disabled", "approved_free_credits"}:
                self.memory.index_state = "configuration_error"
            self.missions = MissionService(self.memory)
        return self.memory

    def index_client(self, project: str):
        from durable.memanto_adapter import MemantoAdapter

        key = self.settings.moorcheh_memory_key.get_secret_value()
        if not key:
            raise StoragePending("Falta credencial de Moorcheh autorizada")
        if project in self.index_clients and self.index_clients[project].deleted:
            del self.index_clients[project]
        if project not in self.index_clients:
            self.index_clients[project] = MemantoAdapter(
                self.settings.owner_github_id, project, key, approved=True
            )
        return self.index_clients[project]

    async def call(self, operation):
        now = monotonic()
        while self.attempts and now - self.attempts[0] > 60:
            self.attempts.popleft()
        if len(self.attempts) >= 30 or self.lock.locked() or self.worker_lock.locked():
            raise HTTPException(
                429, "Límite de memoria o solicitud en curso", headers={"Retry-After": "60"}
            )
        self.attempts.append(now)
        async with self.lock:
            try:
                async with asyncio.timeout(8):

                    def execute():
                        if not self.worker_lock.acquire(blocking=False):
                            raise StoragePending("Operación de memoria anterior aún en curso")
                        try:
                            return operation(self.ready())
                        finally:
                            self.worker_lock.release()

                    return await asyncio.to_thread(execute)
            except StoragePending as exc:
                raise HTTPException(503, str(exc)) from None
            except KeyError:
                raise HTTPException(
                    404, "Objeto no encontrado en el proyecto del propietario"
                ) from None
            except ValueError:
                raise HTTPException(
                    400, "Operación inválida: revisa el estado, contenido y confirmación"
                ) from None
            except HTTPException:
                raise
            except Exception:
                self.error = "No se pudo verificar o completar el almacenamiento persistente"
                raise HTTPException(503, self.error) from None

    def router(self) -> APIRouter:
        router = APIRouter()

        @router.get("/api/memory/status")
        async def status():
            if self.settings.memory_mode == "disabled":
                return {
                    "state": "pending",
                    "durable": False,
                    "memanto": "prepared_not_connected",
                    "cost": "no verificable",
                    "reason": "Pendiente de aprobación; sin envío de datos externos",
                    "missions": "blocked_storage_missing",
                }
            try:
                await self.call(lambda m: m.repository.read(m.owner, "personal", "memory"))
                return {
                    "state": "active",
                    "durable": True,
                    "memanto": self.memory.index_state,
                    "cost": "no verificable",
                    "missions": "manual_readonly_executor",
                }
            except HTTPException:
                return {
                    "state": "error",
                    "durable": False,
                    "memanto": "prepared_not_connected",
                    "cost": "no verificable",
                    "reason": self.error or "Almacenamiento no verificable",
                }

        @router.get("/api/agents/registry")
        async def registry():
            return {
                "agents": AGENT_REGISTRY,
                "external_tools": False,
                "sdk_agent_is_executor": False,
            }

        @router.post("/api/memory/operate")
        async def memory(request: Operation):
            def perform(service):
                if request.action in {"remember", "update"} and request.memory is None:
                    raise ValueError("Falta recuerdo")
                if request.action == "remember":
                    return service.remember(request.project, request.memory)
                if request.action == "update":
                    return service.update_memory(request.project, request.id, request.memory)
                if request.action == "forget":
                    return service.forget(request.project, request.id)
                if request.action == "forget_all":
                    if request.confirmation != "BORRAR_PROYECTO":
                        raise ValueError("Confirma el borrado")
                    return service.forget_all(request.project)
                if request.action == "forget_owner":
                    if request.confirmation != "BORRAR_TODO":
                        raise ValueError("Confirma el borrado global")
                    return service.forget_owner()
                if request.action == "recall":
                    return service.recall(request.project, request.query)
                if request.action == "list":
                    return service.list_memories(request.project)
                result = service.export_memories(request.project)
                return result["audit"] if request.action == "audit" else result

            return await self.call(perform)

        @router.post("/api/missions/operate")
        async def missions(request: MissionOperation):
            return await self.call(
                lambda _: self.missions.operate(
                    request.project, request.action, request.id, request.goal, request.agent
                )
            )

        return router
