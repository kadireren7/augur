"""Workflow validation boundary with an executable local fallback."""

from __future__ import annotations

from dataclasses import dataclass
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeout
from typing import Any, Protocol

from vision.provenance import ProofOfOmen


MONAD_TESTNET_CHAIN_ID = 10143
MONAD_TESTNET_OMEN_PUBLISHER = "0x333c7ba28b6Eec62f51d111d161fc52fd3ADAa1a"


def _bytes32(value: str, field: str) -> str:
    normalized = value[2:] if value.startswith("0x") else value
    if len(normalized) != 64 or any(char not in "0123456789abcdefABCDEF" for char in normalized):
        raise ValueError(f"CRE {field} must be a bytes32 hex value")
    return f"0x{normalized.lower()}"


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
    previous_sequence: int
    provenance_hash: str
    publication_state: str
    schema_version: str
    omen_value: str
    behavior_type: str
    observed_at: int
    ruleset_version: str
    ruleset_hash: str
    chain_id: int
    omen_publisher: str

    @classmethod
    def from_manifest(
        cls,
        manifest: ProofOfOmen,
        workflow_version: str,
        previous_sequence: int,
        chain_id: int,
        omen_publisher: str,
    ) -> "CREValidationRequest":
        return cls(
            workflow_version=workflow_version,
            manifest_hash=_bytes32(manifest.manifest_hash, "manifest hash"),
            chamber_id=_bytes32(manifest.chamber_id, "Chamber ID"),
            creature_id=_bytes32(manifest.creature_id, "creature ID"),
            sequence=manifest.omen_sequence,
            previous_sequence=previous_sequence,
            provenance_hash=_bytes32(manifest.manifest_hash, "provenance hash"),
            publication_state=manifest.publication_state,
            schema_version=manifest.schema_version,
            omen_value=manifest.omen_value,
            behavior_type=manifest.behavior_type,
            observed_at=manifest.observed_at_ms // 1_000,
            ruleset_version=manifest.omen_ruleset_version,
            ruleset_hash=_bytes32(manifest.omen_ruleset_hash, "ruleset hash"),
            chain_id=chain_id,
            omen_publisher=omen_publisher,
        )


class ChainlinkCREWorkflowAdapter:
    """Validated CRE request/response boundary.

    The adapter binds a workflow response to one manifest, Chamber, creature,
    sequence, provenance commitment, chain, and publication target.
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
        chain_id: int = MONAD_TESTNET_CHAIN_ID,
        omen_publisher: str = MONAD_TESTNET_OMEN_PUBLISHER,
    ) -> None:
        if timeout_seconds <= 0 or not workflow_version or chain_id <= 0:
            raise ValueError("CRE workflow version, chain, and positive timeout are required")
        self.workflow_id = workflow_id
        self.client = client
        self.workflow_version = workflow_version
        self.timeout_seconds = timeout_seconds
        self.chain_id = chain_id
        self.omen_publisher = omen_publisher
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
        request = CREValidationRequest.from_manifest(
            manifest,
            self.workflow_version,
            previous[0] if previous else 0,
            self.chain_id,
            self.omen_publisher,
        )
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
        if response.get("creature_id") != request.creature_id:
            raise ValueError("CRE creature binding mismatch")
        if response.get("sequence") != request.sequence:
            raise ValueError("CRE sequence binding mismatch")
        if response.get("provenance_hash") != request.provenance_hash:
            raise ValueError("CRE provenance binding mismatch")
        if response.get("workflow_version") != request.workflow_version:
            raise ValueError("CRE workflow version mismatch")
        publication = response.get("publication")
        if not isinstance(publication, dict):
            raise ValueError("CRE publication request missing")
        if publication.get("chain_id") != request.chain_id:
            raise ValueError("CRE publication chain mismatch")
        target = publication.get("to")
        if not isinstance(target, str) or target.lower() != request.omen_publisher.lower():
            raise ValueError("CRE publication target mismatch")
        execution_id = response.get("execution_id")
        if not isinstance(execution_id, str) or not execution_id:
            raise ValueError("CRE execution identity missing")
        if response.get("accepted") is not True:
            return False
        self._accepted[manifest.manifest_hash] = execution_id
        self._sequences[manifest.chamber_id] = (manifest.omen_sequence, manifest.manifest_hash)
        return True
