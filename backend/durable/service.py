"""Owner/project isolation, versioned semantic records and bounded mission checkpoints."""

from __future__ import annotations

import hashlib
import json
import re
from datetime import UTC, datetime
from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field, model_validator

from durable.repository import SqlRepository


def now() -> str:
    return datetime.now(UTC).isoformat()


def no_secrets(text: str) -> None:
    if re.search(
        r"AIza[\w-]{25,}|(?:sk-proj-|github_pat_|ghp_|mk_)[\w-]{18,}|"
        r"-----BEGIN .*PRIVATE KEY|Bearer\s+[\w.-]{25,}|"
        r"(?:password|contraseña|api_key|cookie|token)\s*[:=]\s*\S+",
        text,
        re.I,
    ):
        raise ValueError("No se guardan credenciales ni secretos en memoria")


class MemoryInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    content: str = Field(min_length=1, max_length=6000)
    kind: Literal["preference", "decision", "goal", "fact", "context", "learning", "error"] = (
        "context"
    )
    source: Literal["explicit", "observation", "inference", "correction"] = "explicit"
    confidence: float = Field(default=1, ge=0, le=1)
    expires_at: datetime | None = None
    topic: str = Field(default="", max_length=100)
    relations: list[str] = Field(default_factory=list, max_length=10)

    @model_validator(mode="after")
    def safe(self):
        if not self.content.strip():
            raise ValueError("Recuerdo vacío")
        no_secrets(self.content)
        if self.source == "inference" and self.confidence > 0.7:
            self.confidence = 0.7
        if self.expires_at and self.expires_at.tzinfo is None:
            raise ValueError("La caducidad requiere zona horaria")
        if self.expires_at:
            self.expires_at = self.expires_at.astimezone(UTC)
        return self


class MemoryService:
    def __init__(self, repository: SqlRepository, owner: str, index_factory=None):
        self.repository, self.owner = repository, owner
        self.index_factory = index_factory
        self.index_state = "prepared_not_connected"

    def list_memories(self, project: str) -> list[dict]:
        records = self.repository.read(self.owner, project, "memory")["items"]
        result = []
        for item in records.values():
            item = dict(item)
            if item["expires_at"] and item["expires_at"] < now() and item["state"] == "active":
                item["state"] = "expired"
            result.append(item)
        return result

    def remember(self, project: str, request: MemoryInput) -> dict:
        digest = hashlib.sha256(" ".join(request.content.lower().split()).encode()).hexdigest()

        def apply(state):
            for item in state["items"].values():
                if (
                    item["digest"] == digest
                    and item["state"] == "active"
                    and (not item["expires_at"] or item["expires_at"] > now())
                ):
                    return {**item, "deduplicated": True}
            if len(state["items"]) >= 200:
                raise ValueError(
                    "Máximo 200 recuerdos por proyecto; exporta y revisa antes de continuar"
                )
            conflicts = [
                m["id"]
                for m in state["items"].values()
                if request.topic and m["topic"] == request.topic and m["state"] == "active"
            ]
            stamp, identifier = now(), str(uuid4())
            item = {
                **request.model_dump(mode="json"),
                "id": identifier,
                "owner": self.owner,
                "project": project,
                "digest": digest,
                "created_at": stamp,
                "updated_at": stamp,
                "state": "review" if request.source == "inference" or conflicts else "active",
                "conflicts": conflicts,
                "versions": [],
            }
            state["items"][identifier] = item
            state["audit"].append(
                {"action": "remember", "id": identifier, "actor": self.owner, "at": stamp}
            )
            return item

        result = self.repository.change(self.owner, project, "memory", apply)
        if self.index_factory and not result.get("deduplicated"):
            self.index_record(project, result)
        return result

    def update_memory(self, project: str, identifier: str, request: MemoryInput) -> dict:
        def apply(state):
            item = state["items"].get(identifier)
            if not item:
                raise KeyError("Recuerdo no encontrado en este proyecto")
            old = {k: v for k, v in item.items() if k != "versions"}
            item["versions"] = (item["versions"] + [old])[-20:]
            item.update(request.model_dump(mode="json"))
            item.update(
                updated_at=now(),
                state="review" if request.source == "inference" else "active",
                digest=hashlib.sha256(
                    " ".join(request.content.lower().split()).encode()
                ).hexdigest(),
            )
            for other_id in item["conflicts"]:
                if other_id in state["items"]:
                    state["items"][other_id]["state"] = "superseded"
                    state["items"][other_id]["relations"].append(identifier)
                    state["audit"].append(
                        {
                            "action": "supersede",
                            "id": other_id,
                            "replacement": identifier,
                            "actor": self.owner,
                            "at": now(),
                        }
                    )
            for other in state["items"].values():
                if (
                    other["id"] != identifier
                    and other["digest"] == item["digest"]
                    and other["state"] == "active"
                ):
                    item["state"] = "superseded"
                    item["relations"].append(other["id"])
            item["conflicts"] = []
            state["audit"].append(
                {"action": "correct", "id": identifier, "actor": self.owner, "at": now()}
            )
            return item

        result = self.repository.change(self.owner, project, "memory", apply)
        if self.index_factory:
            self.index_record(project, result)
        return result

    def index_record(self, project: str, record: dict) -> None:
        def note(state, **fields):
            if record["id"] in state["items"]:
                state["items"][record["id"]].update(fields)

        try:
            client = self.index_factory(project)
            content = json.dumps(
                {
                    "canonical_id": record["id"],
                    "content": record["content"][:2000],
                    "owner": self.owner,
                    "project": project,
                },
                ensure_ascii=False,
            )
            if record.get("memanto_id"):
                client.edit(record["memanto_id"], content)
            else:
                # Persist ambiguity before the remote write. Never retry an unknown write.
                self.repository.change(
                    self.owner, project, "memory", lambda state: note(state, index_pending=True)
                )
                response = client.remember(content, record["kind"], record["id"])
                remote_id = response.get("memory_id")
                if not isinstance(remote_id, str) or not remote_id:
                    raise ValueError("Memanto no confirmó un ID")
                self.repository.change(
                    self.owner,
                    project,
                    "memory",
                    lambda state: note(state, memanto_id=remote_id, index_pending=False),
                )
            self.index_state = "write_acknowledged_not_read_verified"
        except Exception:
            self.index_state = "error_primary_record_preserved"

    def forget(self, project: str, identifier: str) -> dict:
        record = next((m for m in self.list_memories(project) if m["id"] == identifier), None)
        if record and (record.get("memanto_id") or record.get("index_pending")):
            if not self.index_factory or not record.get("memanto_id"):
                raise ValueError(
                    "No se puede confirmar borrado del índice; requiere limpieza del proyecto"
                )
            self.index_factory(project).forget(record["memanto_id"])

        def apply(state):
            if identifier not in state["items"]:
                raise KeyError("Recuerdo no encontrado")
            del state["items"][identifier]  # Purge content and versions, keep content-free event.
            state["audit"].append(
                {"action": "forget", "id": identifier, "actor": self.owner, "at": now()}
            )
            return {"deleted": True, "id": identifier}

        return self.repository.change(self.owner, project, "memory", apply)

    def forget_all(self, project: str) -> dict:
        records = self.list_memories(project)
        if any(m.get("memanto_id") or m.get("index_pending") for m in records):
            if not self.index_factory:
                raise ValueError("Falta autorización del índice para confirmar borrado")
            self.index_factory(project).clear_project()

        def apply(state):
            count = len(state["items"])
            state["items"] = {}
            state["audit"].append(
                {"action": "forget_project", "count": count, "actor": self.owner, "at": now()}
            )
            return {"deleted": count, "project": project}

        return self.repository.change(self.owner, project, "memory", apply)

    def forget_owner(self) -> dict:
        projects = self.repository.projects(self.owner)
        if not self.index_factory:
            if any(
                m.get("memanto_id") or m.get("index_pending")
                for p in projects
                for m in self.list_memories(p)
            ):
                raise ValueError("Falta acceso al índice para confirmar el borrado global")
            return self.repository.purge_owner_memory(self.owner)
        # Stop on any unconfirmed remote deletion; never claim a complete purge.
        for project in self.repository.projects(self.owner):
            self.forget_all(project)
        return self.repository.purge_owner_memory(self.owner)

    def recall(self, project: str, query: str, limit: int = 5) -> list[dict]:
        words = set(re.findall(r"\w{3,}", query.lower()))
        candidates = [m for m in self.list_memories(project) if m["state"] == "active"]
        candidates.sort(
            key=lambda m: len(words & set(re.findall(r"\w{3,}", m["content"].lower()))),
            reverse=True,
        )
        if self.index_factory:
            try:
                result = self.index_factory(project).recall(query, min(limit, 8))
                ordered = []
                by_id = {m["id"]: m for m in candidates}
                for hit in result.get("memories", []):
                    try:
                        canonical = json.loads(hit.get("content", "{}"))
                    except (ValueError, TypeError):
                        continue
                    if canonical.get("owner") != self.owner or canonical.get("project") != project:
                        continue
                    record = by_id.get(canonical.get("canonical_id"))
                    if record and record not in ordered:
                        ordered.append(record)
                self.index_state = "read_verified"
                candidates = ordered + [m for m in candidates if m not in ordered]
            except Exception:
                self.index_state = "error_lexical_fallback"
        return candidates[: max(1, min(limit, 8))]

    def export_memories(self, project: str) -> dict:
        return {
            "format": "jarvis-memory-v1",
            "owner": self.owner,
            "project": project,
            "exported_at": now(),
            "memories": self.list_memories(project),
            "audit": self.repository.read(self.owner, project, "memory")["audit"],
        }
