"""Workflow validation boundary with an executable local fallback."""

from __future__ import annotations

from dataclasses import dataclass
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
    manifest_hash: str
    chamber_id: str
    creature_id: str
    sequence: int
    provenance_hash: str
    publication_state: str

    @classmethod
    def from_manifest(cls, manifest: ProofOfOmen) -> "CREValidationRequest":
        return cls(
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
        self, workflow_id: str | None = None, client: CREClient | None = None
    ) -> None:
        self.workflow_id = workflow_id
        self.client = client

    def validate(self, manifest: ProofOfOmen) -> bool:
        if not self.workflow_id or self.client is None:
            raise RuntimeError(
                "Chainlink CRE adapter is not configured; use LocalWorkflowValidator locally"
            )
        manifest.validate()
        request = CREValidationRequest.from_manifest(manifest)
        response = self.client.execute(self.workflow_id, request.__dict__)
        if response.get("workflow_id") != self.workflow_id:
            raise ValueError("CRE workflow identity mismatch")
        if response.get("manifest_hash") != request.manifest_hash:
            raise ValueError("CRE manifest binding mismatch")
        if response.get("chamber_id") != request.chamber_id:
            raise ValueError("CRE Chamber binding mismatch")
        if response.get("sequence") != request.sequence:
            raise ValueError("CRE sequence binding mismatch")
        return response.get("accepted") is True
