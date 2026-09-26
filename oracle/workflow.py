"""Workflow validation boundary with an executable local fallback."""

from __future__ import annotations

from typing import Protocol

from vision.provenance import ProofOfOmen


class WorkflowValidator(Protocol):
    def validate(self, manifest: ProofOfOmen) -> bool: ...


class LocalWorkflowValidator:
    """Local deterministic fallback used by tests and the developer demo."""

    def validate(self, manifest: ProofOfOmen) -> bool:
        manifest.validate()
        return True


class ChainlinkCREWorkflowAdapter:
    """Boundary for a future real CRE workflow client.

    No CRE SDK or credentials are bundled. Calling this adapter is intentionally an
    error until a deployment supplies a client that retrieves and verifies a real
    workflow result.
    """

    def __init__(self, workflow_id: str | None = None) -> None:
        self.workflow_id = workflow_id

    def validate(self, manifest: ProofOfOmen) -> bool:
        del manifest
        raise RuntimeError(
            "Chainlink CRE adapter is not configured; use LocalWorkflowValidator locally"
        )
