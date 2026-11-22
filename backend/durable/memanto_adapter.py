"""Optional semantic sidecar using verified Memanto 0.3.0 public methods.

Not the authoritative mission database. Never invokes connect, hooks, shell, answer,
extract or paid analysis. The SDK is imported only after separate consent/configuration.
"""

from hashlib import sha256
from importlib.metadata import version


class MemantoAdapter:
    def __init__(self, owner: str, project: str, api_key: str, *, approved: bool = False):
        if not approved:
            raise PermissionError(
                "Memanto pendiente de consentimiento y verificación de cuota sin pago"
            )
        self.deleted = False
        try:
            if version("memanto") != "0.3.0":
                raise RuntimeError("Versión no validada")
            from memanto import Memanto

            namespace = "jarvis-" + sha256(f"{owner}:{project}".encode()).hexdigest()[:32]
            self.client = Memanto(agent_id=namespace, api_key=api_key, pattern="project")
        except Exception:
            raise RuntimeError(
                "Memanto no iniciado: revisa versión, autorización y cuota"
            ) from None

    def clear_project(self):
        result = self._invoke(self.client.delete_agent, delete_memories=True)
        self.deleted = True
        return result

    def _invoke(self, operation, *args, **kwargs):
        try:
            return operation(*args, **kwargs)
        except Exception:
            raise RuntimeError("Memanto no verificable; operación detenida sin reintento") from None

    def remember(self, content: str, kind: str, canonical_id: str):
        return self._invoke(
            self.client.remember,
            content,
            type=kind,
            source="jarvis-owner",
            provenance="explicit_statement",
            tags=[f"jarvis:{canonical_id}"],
        )

    def recall(self, query: str, limit: int = 5):
        return self._invoke(self.client.recall, query, limit=min(8, max(1, limit)))

    def edit(self, memory_id: str, content: str):
        return self._invoke(self.client.update_memory, memory_id, content=content)

    def forget(self, memory_id: str):
        result = self._invoke(self.client.delete_memory, memory_id)
        if result.get("status") != "deleted":
            raise RuntimeError("Memanto no confirmó el borrado")
        return result

    def bootstrap(self, query: str):
        # The top-level Python client has no bootstrap() method. Build a bounded briefing.
        return self.recall(query, 5)

    def export_okf(self, output_dir: str):
        # SDK writes an OKF directory. This is not proof of an exhaustive account backup.
        return self._invoke(
            self.client.client.export_okf_bundle, self.client.agent_id, output_dir=output_dir
        )
