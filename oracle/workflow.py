"""Workflow validation boundary with an executable local fallback."""

from __future__ import annotations

from dataclasses import dataclass
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeout
from typing import Any, Protocol

from vision.provenance import ProofOfOmen


class WorkflowValidator(Protocol):
    def validate(self, manifest: ProofOfOmen) -> bool: ...


class LocalWorkflowValidator:
    """Local deterministic fallback used by tests and the developer demo."""

    def validate(self, manifest: ProofOfOmen) -> bool:
        manifest.validate()
        return True


class CREClient(Protocol):
    """Transport supplied by a configured CRE runtime or gateway."""

    def execute(self, workflow_id: str, request: dict[str, Any]) -> dict[str, Any]: ...


@dataclass(frozen=True)
class CREValidationRequest:
    workflow_version: str
    manifest_hash: str
    chamber_id: str
    creature_id: str
    sequence: int
    provenance_hash: str
    publication_state: str

    @classmethod
    def from_manifest(
        cls, manifest: ProofOfOmen, workflow_version: str
    ) -> "CREValidationRequest":
        return cls(
            workflow_version=workflow_version,
            manifest_hash=manifest.manifest_hash,
            chamber_id=manifest.chamber_id,
            creature_id=manifest.creature_id,
            sequence=manifest.omen_sequence,
            provenance_hash=manifest.manifest_hash,
            publication_state=manifest.publication_state,
        )


class ChainlinkCREWorkflowAdapter:
    """Validated CRE request/response boundary.

    The adapter binds a workflow response to one manifest, Chamber, and sequence.
    A real CRE transport must be injected by deployment code; local tests never
    pretend that the workflow ran.
    """

    def __init__(
        self,
        workflow_id: str | None = None,
        client: CREClient | None = None,
        *,
        workflow_version: str = "1.0.0",
        timeout_seconds: float = 10.0,
    ) -> None:
        if timeout_seconds <= 0 or not workflow_version:
            raise ValueError("CRE workflow version and positive timeout are required")
        self.workflow_id = workflow_id
        self.client = client
        self.workflow_version = workflow_version
        self.timeout_seconds = timeout_seconds
        self._accepted: dict[str, str] = {}
        self._sequences: dict[str, tuple[int, str]] = {}

    def validate(self, manifest: ProofOfOmen) -> bool:
        if not self.workflow_id or self.client is None:
            raise RuntimeError(
                "Chainlink CRE adapter is not configured; use LocalWorkflowValidator locally"
            )
        manifest.validate()
        if manifest.manifest_hash in self._accepted:
            return True
        previous = self._sequences.get(manifest.chamber_id)
        if previous and manifest.omen_sequence <= previous[0]:
            raise ValueError("CRE sequence replay or regression")
        request = CREValidationRequest.from_manifest(manifest, self.workflow_version)
        executor = ThreadPoolExecutor(max_workers=1)
        future = executor.submit(self.client.execute, self.workflow_id, request.__dict__)
        try:
            response = future.result(timeout=self.timeout_seconds)
        except FutureTimeout as exc:
            future.cancel()
            raise TimeoutError("CRE workflow timed out") from exc
        finally:
            executor.shutdown(wait=False, cancel_futures=True)
        if response.get("workflow_id") != self.workflow_id:
            raise ValueError("CRE workflow identity mismatch")
        if response.get("manifest_hash") != request.manifest_hash:
            raise ValueError("CRE manifest binding mismatch")
        if response.get("chamber_id") != request.chamber_id:
            raise ValueError("CRE Chamber binding mismatch")
        if response.get("sequence") != request.sequence:
            raise ValueError("CRE sequence binding mismatch")
        if response.get("workflow_version") != request.workflow_version:
            raise ValueError("CRE workflow version mismatch")
        execution_id = response.get("execution_id")
        if not isinstance(execution_id, str) or not execution_id:
            raise ValueError("CRE execution identity missing")
        if response.get("accepted") is not True:
            return False
        self._accepted[manifest.manifest_hash] = execution_id
        self._sequences[manifest.chamber_id] = (manifest.omen_sequence, manifest.manifest_hash)
        return True
