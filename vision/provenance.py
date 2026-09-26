"""Canonical Proof of Omen manifests and verification."""

from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass, replace
from enum import Enum
from pathlib import Path
from typing import Any

from .engine import VisionEngine
from .models import Detection, Omen, Ruleset, SourceSegment


SCHEMA_VERSION = "1.0.0"


def _normalize(value: Any) -> Any:
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, dict):
        return {str(key): _normalize(item) for key, item in sorted(value.items())}
    if isinstance(value, (list, tuple)):
        return [_normalize(item) for item in value]
    return value


def canonical_json(value: Any) -> bytes:
    if hasattr(value, "to_dict"):
        value = value.to_dict()
    elif hasattr(value, "__dataclass_fields__"):
        value = asdict(value)
    return json.dumps(
        _normalize(value), sort_keys=True, separators=(",", ":"), ensure_ascii=False
    ).encode("utf-8")


def stable_hash(value: Any) -> str:
    return hashlib.sha256(canonical_json(value)).hexdigest()


def detection_hash(detections: list[Detection] | tuple[Detection, ...]) -> str:
    return stable_hash([asdict(detection) for detection in detections])


@dataclass(frozen=True)
class PublicationMetadata:
    chain_id: int
    transaction_hash: str
    event_index: int


@dataclass(frozen=True)
class ProofOfOmen:
    schema_version: str
    creature_id: str
    chamber_id: str
    source_segment_id: str
    source_hash: str
    capture_start_ms: int
    capture_end_ms: int
    vision_module_version: str
    detection_output_hash: str
    behavior_type: str
    behavior_parameters: dict[str, Any]
    behavior_confidence: float
    behavior_ruleset_version: str
    behavior_ruleset_hash: str
    omen_type: str
    omen_value: str
    omen_sequence: int
    observed_at_ms: int
    omen_ruleset_version: str
    omen_ruleset_hash: str
    oracle_publisher_id: str
    created_at_ms: int
    evidence_uri: str | None
    publication_state: str
    publication: PublicationMetadata | None = None
    manifest_hash: str = ""

    def to_dict(self, include_manifest_hash: bool = True) -> dict[str, Any]:
        value = asdict(self)
        if not include_manifest_hash:
            value.pop("manifest_hash", None)
        return value

    def compute_hash(self) -> str:
        return stable_hash(self.to_dict(include_manifest_hash=False))

    def seal(self) -> "ProofOfOmen":
        return replace(self, manifest_hash=self.compute_hash())

    def validate(self) -> None:
        required = {
            "schema_version": self.schema_version,
            "creature_id": self.creature_id,
            "chamber_id": self.chamber_id,
            "source_segment_id": self.source_segment_id,
            "source_hash": self.source_hash,
            "detection_output_hash": self.detection_output_hash,
            "behavior_type": self.behavior_type,
            "behavior_ruleset_version": self.behavior_ruleset_version,
            "behavior_ruleset_hash": self.behavior_ruleset_hash,
            "omen_type": self.omen_type,
            "omen_value": self.omen_value,
            "omen_ruleset_version": self.omen_ruleset_version,
            "omen_ruleset_hash": self.omen_ruleset_hash,
            "oracle_publisher_id": self.oracle_publisher_id,
            "publication_state": self.publication_state,
            "manifest_hash": self.manifest_hash,
        }
        missing = [name for name, value in required.items() if not value]
        if missing:
            raise ValueError(f"missing required manifest fields: {', '.join(missing)}")
        if self.schema_version != SCHEMA_VERSION:
            raise ValueError("unsupported schema version")
        if self.capture_start_ms < 0 or self.capture_end_ms < self.capture_start_ms:
            raise ValueError("invalid capture interval")
        if not self.capture_start_ms <= self.observed_at_ms <= self.capture_end_ms:
            raise ValueError("Omen observation falls outside capture interval")
        if self.omen_sequence < 1 or not 0 <= self.behavior_confidence <= 1:
            raise ValueError("invalid sequence or confidence")
        for name in (
            "source_hash",
            "detection_output_hash",
            "behavior_ruleset_hash",
            "omen_ruleset_hash",
            "manifest_hash",
        ):
            value = getattr(self, name)
            if len(value) != 64 or any(char not in "0123456789abcdef" for char in value):
                raise ValueError(f"{name} must be a SHA-256 hex digest")
        if self.publication_state not in {"PENDING", "PUBLISHED", "FAILED"}:
            raise ValueError("invalid publication state")
        if self.publication_state == "PUBLISHED" and self.publication is None:
            raise ValueError("published manifest requires chain metadata")
        if self.compute_hash() != self.manifest_hash:
            raise ValueError("manifest hash mismatch")

    @classmethod
    def from_dict(cls, value: dict[str, Any]) -> "ProofOfOmen":
        data = dict(value)
        publication = data.get("publication")
        if publication is not None:
            data["publication"] = PublicationMetadata(**publication)
        try:
            manifest = cls(**data)
        except TypeError as exc:
            raise ValueError(f"malformed manifest: {exc}") from exc
        manifest.validate()
        return manifest


def build_proof(
    source: SourceSegment,
    detections: list[Detection] | tuple[Detection, ...],
    omen: Omen,
    ruleset: Ruleset,
    publisher_id: str,
    created_at_ms: int,
    evidence_uri: str | None = None,
) -> ProofOfOmen:
    if omen.chamber_id != source.chamber_id or omen.creature_id != source.creature_id:
        raise ValueError("Omen does not belong to source segment")
    ruleset_hash = stable_hash(ruleset.as_dict())
    return ProofOfOmen(
        schema_version=SCHEMA_VERSION,
        creature_id=omen.creature_id,
        chamber_id=omen.chamber_id,
        source_segment_id=source.segment_id,
        source_hash=source.source_hash,
        capture_start_ms=source.capture_start_ms,
        capture_end_ms=source.capture_end_ms,
        vision_module_version=VisionEngine.MODULE_VERSION,
        detection_output_hash=detection_hash(detections),
        behavior_type=omen.behavior.behavior_type.value,
        behavior_parameters=omen.behavior.parameters,
        behavior_confidence=omen.behavior.confidence,
        behavior_ruleset_version=omen.behavior.ruleset_version,
        behavior_ruleset_hash=ruleset_hash,
        omen_type="ZONE_SIGNAL",
        omen_value=omen.value.value,
        omen_sequence=omen.sequence,
        observed_at_ms=omen.observed_at_ms,
        omen_ruleset_version=omen.ruleset_version,
        omen_ruleset_hash=ruleset_hash,
        oracle_publisher_id=publisher_id,
        created_at_ms=created_at_ms,
        evidence_uri=evidence_uri,
        publication_state="PENDING",
    ).seal()


def verify_proof(
    manifest: ProofOfOmen,
    detections: list[Detection] | tuple[Detection, ...],
    ruleset: Ruleset,
    source_bytes: bytes | None = None,
) -> None:
    manifest.validate()
    if (
        source_bytes is not None
        and hashlib.sha256(source_bytes).hexdigest() != manifest.source_hash
    ):
        raise ValueError("source hash mismatch")
    if detection_hash(detections) != manifest.detection_output_hash:
        raise ValueError("detection hash mismatch")
    expected_ruleset_hash = stable_hash(ruleset.as_dict())
    if expected_ruleset_hash not in {
        manifest.behavior_ruleset_hash,
        manifest.omen_ruleset_hash,
    } or manifest.behavior_ruleset_hash != manifest.omen_ruleset_hash:
        raise ValueError("ruleset hash mismatch")
    if ruleset.version not in {
        manifest.behavior_ruleset_version,
        manifest.omen_ruleset_version,
    } or manifest.behavior_ruleset_version != manifest.omen_ruleset_version:
        raise ValueError("ruleset version mismatch")


def save_proof(path: str | Path, manifest: ProofOfOmen) -> None:
    manifest.validate()
    Path(path).write_bytes(canonical_json(manifest) + b"\n")


def load_proof(path: str | Path) -> ProofOfOmen:
    try:
        value = json.loads(Path(path).read_bytes())
    except (json.JSONDecodeError, OSError) as exc:
        raise ValueError(f"unable to load Proof of Omen: {exc}") from exc
    if not isinstance(value, dict):
        raise ValueError("Proof of Omen JSON must be an object")
    return ProofOfOmen.from_dict(value)


class SequenceVerifier:
    """Reject regressions and duplicates per Chamber without assuming global ordering."""

    def __init__(self) -> None:
        self._last_sequence: dict[str, int] = {}

    def accept(self, manifest: ProofOfOmen) -> None:
        last = self._last_sequence.get(manifest.chamber_id, 0)
        if manifest.omen_sequence <= last:
            raise ValueError("Omen sequence must strictly increase per Chamber")
        self._last_sequence[manifest.chamber_id] = manifest.omen_sequence
