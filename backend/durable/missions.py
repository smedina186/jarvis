"""Explicitly approved, durable, single-step read-only execution. No scheduler."""

import hashlib
import json
from uuid import uuid4

from durable.service import MemoryService, no_secrets, now

AGENT_REGISTRY = {
    name: {
        "name": name,
        "version": "1.0.0",
        "purpose": purpose,
        "skills": ["memory.recall@1.0.0"],
        "tools": ["memory.recall"],
        "data": "owner/project only",
        "max_steps": 8,
        "automatic_budget_usd": 0,
        "approval": "owner approves immutable plan; external tools disabled",
    }
    for name, purpose in {
        "research": "Fuentes aportadas y síntesis, sin navegación web conectada",
        "coding": "Propuestas y pruebas, sin acceso de ejecución al repositorio",
        "documents": "Documentos autorizados",
        "organization": "Planificación",
        "analysis": "Comparación de datos",
        "automation": "Solo procedimientos implementados",
        "archivist": "Recuperación de recuerdos pertinentes",
    }.items()
}


def plan_digest(plan: list[dict]) -> str:
    immutable = [{"tool": step["tool"], "query": step["query"], "state": "queued"} for step in plan]
    return hashlib.sha256(json.dumps(immutable, sort_keys=True).encode()).hexdigest()


class MissionService:
    def __init__(self, memory: MemoryService):
        self.memory, self.repo, self.owner = memory, memory.repository, memory.owner
        self.active: set[str] = set()

    def operate(
        self,
        project: str,
        action: str,
        identifier: str = "",
        goal: str = "",
        agent: str = "archivist",
    ):
        if action == "list":

            def recover(state):
                for m in state["items"].values():
                    if m["state"] == "working" and m.get("run_id") not in self.active:
                        m["state"] = "paused"
                        m["reason"] = "Executor no activo; requiere reanudar"
                        m["audit"].append({"action": "executor_lost", "at": now()})
                return list(state["items"].values())

            return self.repo.change(self.owner, project, "missions", recover)
        if action == "create":
            no_secrets(goal)
            if not goal.strip() or len(goal) > 2000 or agent not in AGENT_REGISTRY:
                raise ValueError("Meta o agente inválido")
            plan = [{"tool": "memory.recall", "query": goal, "state": "queued"}]
            digest = plan_digest(plan)

            def create(state):
                if len(state["items"]) >= 32:
                    raise ValueError("Límite de misiones del proyecto alcanzado")
                m = {
                    "id": str(uuid4()),
                    "owner": self.owner,
                    "project": project,
                    "goal": goal,
                    "agent": agent,
                    "state": "pending_approval",
                    "plan": plan,
                    "plan_hash": digest,
                    "approval": None,
                    "cursor": 0,
                    "checkpoints": [],
                    "created_at": now(),
                    "audit": [],
                }
                state["items"][m["id"]] = m
                return m

            return self.repo.change(self.owner, project, "missions", create)
        if action == "run_step":
            return self.run_step(project, identifier)

        def transition(state):
            m = state["items"].get(identifier)
            if not m:
                raise KeyError("Misión no encontrada")
            if action == "approve":
                if m["state"] != "pending_approval":
                    raise ValueError("No hay una aprobación pendiente")
                m["approval"] = {"actor": self.owner, "at": now(), "plan_hash": m["plan_hash"]}
                m["state"] = "queued"
            elif action == "pause" and m["state"] in {"queued", "working"}:
                m["state"] = "paused"
            elif action == "resume" and m["state"] == "paused" and m["approval"]:
                m["state"] = "queued"
            else:
                raise ValueError("Transición no permitida")
            m["audit"].append({"action": action, "actor": self.owner, "at": now()})
            return m

        return self.repo.change(self.owner, project, "missions", transition)

    def run_step(self, project: str, identifier: str):
        run_id = str(uuid4())

        def claim(state):
            m = state["items"].get(identifier)
            if not m:
                raise KeyError("Misión no encontrada")
            if (
                m["state"] != "queued"
                or not m["approval"]
                or m["approval"]["plan_hash"] != m["plan_hash"]
            ):
                raise ValueError("La misión necesita aprobación o está pausada/bloqueada")
            step = m["plan"][m["cursor"]]
            if (
                step["tool"] not in AGENT_REGISTRY[m["agent"]]["tools"]
                or step["tool"] != "memory.recall"
            ):
                m["state"] = "blocked"
                m["reason"] = "Herramienta no implementada o no permitida"
                return m
            if plan_digest(m["plan"]) != m["approval"]["plan_hash"]:
                m["state"] = "blocked"
                m["reason"] = "El plan cambió; necesita otra aprobación"
                return m
            m["state"] = "working"
            m["run_id"] = run_id
            return m

        # Register before persistent claim, so concurrent status reads do not mark it abandoned.
        self.active.add(run_id)
        try:
            mission = self.repo.change(self.owner, project, "missions", claim)
            if mission["state"] == "blocked":
                return mission
            results = self.memory.recall(project, mission["plan"][mission["cursor"]]["query"])
            evidence = {
                "source_ids": [m["id"] for m in results],
                "count": len(results),
                "at": now(),
            }

            def finish(state):
                m = state["items"][identifier]
                if m.get("run_id") != run_id or m["state"] != "working":
                    return m
                m["checkpoints"].append({"step": m["cursor"], "evidence": evidence})
                m["plan"][m["cursor"]]["state"] = "completed"
                m["cursor"] += 1
                m["state"] = "completed" if m["cursor"] == len(m["plan"]) else "queued"
                return m

            return self.repo.change(self.owner, project, "missions", finish)
        finally:
            self.active.discard(run_id)
