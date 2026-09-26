"""Typed domain models shared by deterministic tracking and provenance."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from enum import Enum
from typing import Any


class CreatureType(str, Enum):
    HAMSTER = "HAMSTER"
    FISH = "FISH"
    TURTLE = "TURTLE"


class Zone(str, Enum):
    LEFT = "LEFT"
    CENTER = "CENTER"
    RIGHT = "RIGHT"


class Direction(str, Enum):
    LEFT = "LEFT"
    STATIONARY = "STATIONARY"
    RIGHT = "RIGHT"


class BehaviorType(str, Enum):
    ZONE_OCCUPANCY = "ZONE_OCCUPANCY"
    ZONE_ENTRY = "ZONE_ENTRY"
    ZONE_EXIT = "ZONE_EXIT"
    DIRECTIONAL_MOVEMENT = "DIRECTIONAL_MOVEMENT"
    INACTIVITY = "INACTIVITY"


class OmenValue(str, Enum):
    SELL = "SELL"
    HOLD = "HOLD"
    BUY = "BUY"


@dataclass(frozen=True)
class SourceSegment:
    segment_id: str
    chamber_id: str
    creature_id: str
    capture_start_ms: int
    capture_end_ms: int
    source_hash: str

    def __post_init__(self) -> None:
        if not self.segment_id or not self.chamber_id or not self.creature_id:
            raise ValueError("source identifiers must be non-empty")
        if self.capture_start_ms < 0 or self.capture_end_ms < self.capture_start_ms:
            raise ValueError("invalid capture interval")
        if len(self.source_hash) != 64:
            raise ValueError("source_hash must be a SHA-256 hex digest")


@dataclass(frozen=True)
class Detection:
    timestamp_ms: int
    x: float
    y: float
    confidence: float
    track_id: str = "primary"

    def __post_init__(self) -> None:
        if self.timestamp_ms < 0:
            raise ValueError("timestamp_ms must be non-negative")
        if not 0.0 <= self.x <= 1.0 or not 0.0 <= self.y <= 1.0:
            raise ValueError("coordinates must be normalized")
        if not 0.0 <= self.confidence <= 1.0:
            raise ValueError("confidence must be between zero and one")


@dataclass(frozen=True)
class Observation:
    timestamp_ms: int
    zone: Zone
    direction: Direction
    confidence: float
    dwell_ms: int
    detection_indices: tuple[int, ...]


@dataclass(frozen=True)
class BehaviorCandidate:
    behavior_type: BehaviorType
    timestamp_ms: int
    confidence: float
    parameters: dict[str, Any]
    accepted: bool
    rejection_reason: str | None = None


@dataclass(frozen=True)
class Behavior:
    behavior_type: BehaviorType
    timestamp_ms: int
    confidence: float
    parameters: dict[str, Any]
    ruleset_version: str


@dataclass(frozen=True)
class OmenCandidate:
    value: OmenValue
    timestamp_ms: int
    behavior: Behavior
    accepted: bool
    rejection_reason: str | None = None


@dataclass(frozen=True)
class Omen:
    chamber_id: str
    creature_id: str
    sequence: int
    value: OmenValue
    observed_at_ms: int
    behavior: Behavior
    ruleset_version: str


@dataclass(frozen=True)
class Ruleset:
    name: str
    version: str
    creature_type: CreatureType
    confidence_threshold: float
    left_boundary: float
    right_boundary: float
    debounce_samples: int
    cooldown_ms: int
    inactivity_ms: int
    movement_delta: float
    zone_to_omen: dict[str, str] = field(
        default_factory=lambda: {
            Zone.LEFT.value: OmenValue.SELL.value,
            Zone.CENTER.value: OmenValue.HOLD.value,
            Zone.RIGHT.value: OmenValue.BUY.value,
        }
    )

    def __post_init__(self) -> None:
        if not self.name or not self.version:
            raise ValueError("ruleset name and version are required")
        if not 0 <= self.left_boundary < self.right_boundary <= 1:
            raise ValueError("zone boundaries must be ordered and normalized")
        if not 0 <= self.confidence_threshold <= 1:
            raise ValueError("confidence threshold must be normalized")
        if self.debounce_samples < 1 or self.cooldown_ms < 0 or self.inactivity_ms < 0:
            raise ValueError("invalid timing configuration")
        if set(self.zone_to_omen) != {zone.value for zone in Zone}:
            raise ValueError("zone_to_omen must map LEFT, CENTER, and RIGHT")

    def as_dict(self) -> dict[str, Any]:
        value = asdict(self)
        value["creature_type"] = self.creature_type.value
        return value


@dataclass(frozen=True)
class VisionResult:
    source: SourceSegment
    detections: tuple[Detection, ...]
    observations: tuple[Observation, ...]
    behavior_candidates: tuple[BehaviorCandidate, ...]
    behaviors: tuple[Behavior, ...]
    omen_candidates: tuple[OmenCandidate, ...]
    omens: tuple[Omen, ...]

