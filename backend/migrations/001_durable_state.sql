-- Additive/idempotent migration. No existing rows are changed or removed.
-- Matches durable.repository.SqlRepository.initialize; use a direct PG connection.
CREATE TABLE IF NOT EXISTS jarvis_state (
    owner TEXT NOT NULL,
    project TEXT NOT NULL,
    collection TEXT NOT NULL,
    revision INTEGER NOT NULL,
    payload TEXT NOT NULL,
    PRIMARY KEY (owner, project, collection)
);
