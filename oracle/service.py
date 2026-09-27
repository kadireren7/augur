"""Validation and publication orchestration; this module never creates an Omen."""

from __future__ import annotations

from dataclasses import dataclass

from vision.models import Detection, Ruleset
from vision.provenance import ProofOfOmen, verify_proof

from .publisher import PublicationReceipt, Publisher
from .store import AttemptStore
from .workflow import LocalWorkflowValidator, WorkflowValidator


@dataclass(frozen=True)
class OraclePolicy:
    chamber_creatures: dict[str, str]
    max_staleness_ms: int = 60_000

    def validate_ids(self, chamber_id: str, creature_id: str) -> None:
        expected = self.chamber_creatures.get(chamber_id)
        if expected is None:
            raise ValueError("unknown Chamber")
        if creature_id != expected:
            raise ValueError("creature does not belong to Chamber")


class OracleService:
    def __init__(
        self,
        policy: OraclePolicy,
        store: AttemptStore,
        publisher: Publisher,
        workflow: WorkflowValidator | None = None,
    ) -> None:
        self.policy = policy
        self.store = store
        self.publisher = publisher
        self.workflow = workflow or LocalWorkflowValidator()

    def publish_validated(
        self,
        manifest: ProofOfOmen,
        detections: list[Detection] | tuple[Detection, ...],
        ruleset: Ruleset,
        *,
        now_ms: int,
        source_bytes: bytes | None = None,
    ) -> PublicationReceipt:
        verify_proof(manifest, detections, ruleset, source_bytes)
        self.policy.validate_ids(manifest.chamber_id, manifest.creature_id)
        if manifest.capture_end_ms > now_ms:
            raise ValueError("future source segment")
        if now_ms - manifest.capture_end_ms > self.policy.max_staleness_ms:
            raise ValueError("stale source segment")
        existing = self.store.get(manifest.manifest_hash)
        if existing and existing.status == "PUBLISHED":
            assert existing.receipt is not None
            return PublicationReceipt(**existing.receipt)

        if not self.workflow.validate(manifest):
            raise ValueError("workflow validation rejected manifest")

        owner = self.store.sequence_owner(manifest.chamber_id, manifest.omen_sequence)
        if owner is not None and owner != manifest.manifest_hash:
            raise ValueError("conflicting manifest for Chamber sequence")
        last_sequence = self.store.last_published_sequence(manifest.chamber_id)
        if manifest.omen_sequence <= last_sequence:
            raise ValueError("Omen sequence regression")

        self.store.begin(
            manifest.manifest_hash, manifest.chamber_id, manifest.omen_sequence
        )
        try:
            receipt = self.publisher.publish(manifest)
        except Exception as exc:
            self.store.mark_failed(manifest.manifest_hash, str(exc))
            raise
        self.store.mark_published(manifest.manifest_hash, receipt.to_dict())
        return receipt
