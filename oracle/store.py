"""SQLite attempt journal used for idempotency, retries, and sequence checks."""

from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class Attempt:
    manifest_hash: str
    chamber_id: str
    sequence: int
    status: str
    attempt_count: int
    last_error: str | None
    receipt: dict[str, Any] | None


class AttemptStore:
    def __init__(self, path: str | Path = ":memory:") -> None:
        self.connection = sqlite3.connect(str(path))
        self.connection.execute("PRAGMA foreign_keys = ON")
        self.connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS attempts (
                manifest_hash TEXT PRIMARY KEY,
                chamber_id TEXT NOT NULL,
                sequence INTEGER NOT NULL,
                status TEXT NOT NULL,
                attempt_count INTEGER NOT NULL DEFAULT 0,
                last_error TEXT,
                receipt_json TEXT
            );
            CREATE UNIQUE INDEX IF NOT EXISTS sequence_claim
                ON attempts(chamber_id, sequence);
            """
        )
        self.connection.commit()

    def get(self, manifest_hash: str) -> Attempt | None:
        row = self.connection.execute(
            """SELECT manifest_hash, chamber_id, sequence, status, attempt_count,
                      last_error, receipt_json
                 FROM attempts WHERE manifest_hash = ?""",
            (manifest_hash,),
        ).fetchone()
        if row is None:
            return None
        return Attempt(*row[:6], json.loads(row[6]) if row[6] else None)

    def sequence_owner(self, chamber_id: str, sequence: int) -> str | None:
        row = self.connection.execute(
            "SELECT manifest_hash FROM attempts WHERE chamber_id = ? AND sequence = ?",
            (chamber_id, sequence),
        ).fetchone()
        return row[0] if row else None

    def last_published_sequence(self, chamber_id: str) -> int:
        row = self.connection.execute(
            "SELECT COALESCE(MAX(sequence), 0) FROM attempts WHERE chamber_id = ? AND status = 'PUBLISHED'",
            (chamber_id,),
        ).fetchone()
        return int(row[0])

    def begin(self, manifest_hash: str, chamber_id: str, sequence: int) -> None:
        try:
            self.connection.execute(
                """INSERT INTO attempts(manifest_hash, chamber_id, sequence, status, attempt_count)
                   VALUES (?, ?, ?, 'PENDING', 1)
                   ON CONFLICT(manifest_hash) DO UPDATE SET
                       status = 'PENDING',
                       attempt_count = attempt_count + 1,
                       last_error = NULL""",
                (manifest_hash, chamber_id, sequence),
            )
            self.connection.commit()
        except sqlite3.IntegrityError as exc:
            raise ValueError("sequence already belongs to a different manifest") from exc

    def mark_published(self, manifest_hash: str, receipt: dict[str, Any]) -> None:
        self.connection.execute(
            "UPDATE attempts SET status = 'PUBLISHED', receipt_json = ? WHERE manifest_hash = ?",
            (json.dumps(receipt, sort_keys=True, separators=(",", ":")), manifest_hash),
        )
        self.connection.commit()

    def mark_failed(self, manifest_hash: str, error: str) -> None:
        self.connection.execute(
            "UPDATE attempts SET status = 'FAILED', last_error = ? WHERE manifest_hash = ?",
            (error, manifest_hash),
        )
        self.connection.commit()

    def close(self) -> None:
        self.connection.close()
