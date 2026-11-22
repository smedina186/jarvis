"""Atomic durable state, injected independently from semantic memory indexing."""

from __future__ import annotations

import copy
import json
from collections.abc import Callable
from contextlib import contextmanager
from typing import Any


class StoragePending(RuntimeError):
    pass


class SqlRepository:
    """PostgreSQL in production; SQLite connector is only used by explicit test fixtures."""

    def __init__(self, connect: Callable, *, dialect: str = "postgres") -> None:
        self.connect = connect
        self.dialect = dialect

    @contextmanager
    def session(self):
        connection = self.connect()
        try:
            if self.dialect == "sqlite":
                connection.execute("BEGIN IMMEDIATE")
            yield connection
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()

    def initialize(self) -> None:
        with self.session() as conn:
            conn.execute(
                "CREATE TABLE IF NOT EXISTS jarvis_state (owner TEXT NOT NULL, "
                "project TEXT NOT NULL, collection TEXT NOT NULL, revision INTEGER NOT NULL, "
                "payload TEXT NOT NULL, PRIMARY KEY(owner, project, collection))"
            )

    def change(self, owner: str, project: str, collection: str, operation: Callable) -> Any:
        p = "?" if self.dialect == "sqlite" else "%s"
        scope = (owner, project, collection)
        with self.session() as conn:
            conn.execute(
                f"INSERT INTO jarvis_state VALUES ({p},{p},{p},0,{p}) "
                "ON CONFLICT(owner,project,collection) DO NOTHING",
                (*scope, '{"items":{},"audit":[]}'),
            )
            suffix = "" if self.dialect == "sqlite" else " FOR UPDATE"
            row = conn.execute(
                f"SELECT revision,payload FROM jarvis_state WHERE owner={p} "
                f"AND project={p} AND collection={p}" + suffix,
                scope,
            ).fetchone()
            revision, payload = row
            state = json.loads(payload)
            result = operation(state)
            state["audit"] = state.get("audit", [])[-200:]
            data = json.dumps(state, ensure_ascii=False)
            if len(data.encode()) > 2_000_000:
                raise ValueError("Límite de almacenamiento del proyecto alcanzado")
            changed = conn.execute(
                f"UPDATE jarvis_state SET revision=revision+1,payload={p} "
                f"WHERE owner={p} AND project={p} AND collection={p} "
                f"AND revision={p}",
                (data, *scope, revision),
            )
            if changed.rowcount != 1:
                raise ValueError("Cambio concurrente; vuelve a cargar")
            return copy.deepcopy(result)

    def read(self, owner: str, project: str, collection: str) -> dict:
        p = "?" if self.dialect == "sqlite" else "%s"
        with self.session() as conn:
            row = conn.execute(
                f"SELECT payload FROM jarvis_state WHERE owner={p} AND "
                f"project={p} AND collection={p}",
                (owner, project, collection),
            ).fetchone()
            return json.loads(row[0]) if row else {"items": {}, "audit": []}

    def projects(self, owner: str) -> list[str]:
        p = "?" if self.dialect == "sqlite" else "%s"
        with self.session() as conn:
            return [
                row[0]
                for row in conn.execute(
                    f"SELECT project FROM jarvis_state WHERE owner={p} AND collection={p}",
                    (owner, "memory"),
                ).fetchall()
            ]

    def purge_owner_memory(self, owner: str) -> dict:
        p = "?" if self.dialect == "sqlite" else "%s"
        with self.session() as conn:
            result = conn.execute(
                f"DELETE FROM jarvis_state WHERE owner={p} AND collection={p}", (owner, "memory")
            )
            return {"deleted_projects": result.rowcount, "deleted": True}


def postgres_repository(url: str) -> SqlRepository:
    if not url.startswith(("postgresql://", "postgres://")):
        raise StoragePending(
            "Se requiere PostgreSQL externo persistente; no se acepta disco de Render"
        )
    try:
        import psycopg
    except ImportError:
        raise StoragePending("Falta instalar el extra de persistencia aprobado") from None

    def connect():
        return psycopg.connect(
            url,
            sslmode="verify-full",
            sslrootcert="system",
            connect_timeout=5,
            options="-c statement_timeout=4000 -c lock_timeout=2000",
        )

    return SqlRepository(connect)
