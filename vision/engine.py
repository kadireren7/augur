"""Fixture-first deterministic signal processing for controlled animal footage."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass

from .models import (
    Behavior,
    BehaviorCandidate,
    BehaviorType,
    CreatureType,
    Detection,
    Direction,
    Observation,
    Omen,
    OmenCandidate,
    OmenValue,
    Ruleset,
    SourceSegment,
    VisionResult,
    Zone,
)


def default_ruleset(creature_type: CreatureType) -> Ruleset:
    """Return conservative deterministic parameters for a controlled fixture."""
    common = dict(
        name=f"augur-{creature_type.value.lower()}-zones",
        version="1.0.0",
        creature_type=creature_type,
        confidence_threshold=0.75,
        left_boundary=1 / 3,
        right_boundary=2 / 3,
    )
    if creature_type is CreatureType.HAMSTER:
        return Ruleset(
            **common,
            debounce_samples=2,
            cooldown_ms=1_000,
            inactivity_ms=1_500,
            movement_delta=0.08,
        )
    if creature_type is CreatureType.FISH:
        return Ruleset(
            **common,
            debounce_samples=2,
            cooldown_ms=800,
            inactivity_ms=1_200,
            movement_delta=0.12,
        )
    return Ruleset(
        **common,
        debounce_samples=3,
        cooldown_ms=2_000,
        inactivity_ms=3_000,
        movement_delta=0.04,
    )


@dataclass
class _State:
    stable_zone: Zone | None = None
    pending_zone: Zone | None = None
    pending_count: int = 0
    last_x: float | None = None
    last_move_ms: int | None = None
    last_omen_value: OmenValue | None = None
    last_omen_ms: int | None = None
    sequence: int = 0


class VisionEngine:
    """Convert ordered centroid detections into replayable observations and Omens."""

    MODULE_VERSION = "vision-fixture-1.0.0"

    def __init__(self, ruleset: Ruleset, starting_sequence: int = 0) -> None:
        if starting_sequence < 0:
            raise ValueError("starting_sequence must be non-negative")
        self.ruleset = ruleset
        self.starting_sequence = starting_sequence

    def _zone(self, x: float) -> Zone:
        if x < self.ruleset.left_boundary:
            return Zone.LEFT
        if x < self.ruleset.right_boundary:
            return Zone.CENTER
        return Zone.RIGHT

    def process(self, source: SourceSegment, detections: list[Detection]) -> VisionResult:
        if any(
            detections[i].timestamp_ms > detections[i + 1].timestamp_ms
            for i in range(len(detections) - 1)
        ):
            raise ValueError("detections must be ordered by timestamp")

        indexed: dict[int, list[tuple[int, Detection]]] = defaultdict(list)
        for index, detection in enumerate(detections):
            if not source.capture_start_ms <= detection.timestamp_ms <= source.capture_end_ms:
                raise ValueError("detection falls outside source segment")
            indexed[detection.timestamp_ms].append((index, detection))

        state = _State(sequence=self.starting_sequence)
        observations: list[Observation] = []
        candidates: list[BehaviorCandidate] = []
        behaviors: list[Behavior] = []
        omen_candidates: list[OmenCandidate] = []
        omens: list[Omen] = []

        for timestamp_ms in sorted(indexed):
            group = indexed[timestamp_ms]
            eligible = [
                (i, d)
                for i, d in group
                if d.confidence >= self.ruleset.confidence_threshold
            ]
            if not eligible:
                candidates.append(
                    BehaviorCandidate(
                        BehaviorType.ZONE_OCCUPANCY,
                        timestamp_ms,
                        max((d.confidence for _, d in group), default=0.0),
                        {},
                        False,
                        "insufficient_confidence",
                    )
                )
                continue

            zones = {self._zone(d.x) for _, d in eligible}
            if len(zones) != 1:
                candidates.append(
                    BehaviorCandidate(
                        BehaviorType.ZONE_OCCUPANCY,
                        timestamp_ms,
                        min(d.confidence for _, d in eligible),
                        {"zones": sorted(zone.value for zone in zones)},
                        False,
                        "conflicting_detections",
                    )
                )
                state.pending_zone = None
                state.pending_count = 0
                continue

            zone = next(iter(zones))
            x = sum(d.x for _, d in eligible) / len(eligible)
            confidence = min(d.confidence for _, d in eligible)
            delta = 0.0 if state.last_x is None else x - state.last_x
            if abs(delta) >= self.ruleset.movement_delta:
                direction = Direction.RIGHT if delta > 0 else Direction.LEFT
                state.last_move_ms = timestamp_ms
            else:
                direction = Direction.STATIONARY
                if state.last_move_ms is None:
                    state.last_move_ms = timestamp_ms
            dwell_ms = timestamp_ms - state.last_move_ms
            observation = Observation(
                timestamp_ms,
                zone,
                direction,
                confidence,
                dwell_ms,
                tuple(i for i, _ in eligible),
            )
            observations.append(observation)
            state.last_x = x

            if state.pending_zone == zone:
                state.pending_count += 1
            else:
                state.pending_zone = zone
                state.pending_count = 1

            if direction is not Direction.STATIONARY:
                directional = Behavior(
                    BehaviorType.DIRECTIONAL_MOVEMENT,
                    timestamp_ms,
                    confidence,
                    {"direction": direction.value, "delta": round(delta, 8)},
                    self.ruleset.version,
                )
                candidates.append(
                    BehaviorCandidate(
                        directional.behavior_type,
                        timestamp_ms,
                        confidence,
                        directional.parameters,
                        True,
                    )
                )
                behaviors.append(directional)

            if dwell_ms >= self.ruleset.inactivity_ms:
                inactive = Behavior(
                    BehaviorType.INACTIVITY,
                    timestamp_ms,
                    confidence,
                    {"zone": zone.value, "dwell_ms": dwell_ms},
                    self.ruleset.version,
                )
                candidates.append(
                    BehaviorCandidate(
                        inactive.behavior_type,
                        timestamp_ms,
                        confidence,
                        inactive.parameters,
                        True,
                    )
                )
                behaviors.append(inactive)

            if state.pending_count < self.ruleset.debounce_samples:
                candidates.append(
                    BehaviorCandidate(
                        BehaviorType.ZONE_OCCUPANCY,
                        timestamp_ms,
                        confidence,
                        {"zone": zone.value, "samples": state.pending_count},
                        False,
                        "debounce_pending",
                    )
                )
                continue

            previous_zone = state.stable_zone
            behavior_type = BehaviorType.ZONE_OCCUPANCY
            parameters: dict[str, object] = {"zone": zone.value}
            if previous_zone is not None and previous_zone != zone:
                exit_behavior = Behavior(
                    BehaviorType.ZONE_EXIT,
                    timestamp_ms,
                    confidence,
                    {"zone": previous_zone.value, "to_zone": zone.value},
                    self.ruleset.version,
                )
                behaviors.append(exit_behavior)
                candidates.append(
                    BehaviorCandidate(
                        exit_behavior.behavior_type,
                        timestamp_ms,
                        confidence,
                        exit_behavior.parameters,
                        True,
                    )
                )
                behavior_type = BehaviorType.ZONE_ENTRY
                parameters = {"zone": zone.value, "from_zone": previous_zone.value}
            state.stable_zone = zone

            behavior = Behavior(
                behavior_type,
                timestamp_ms,
                confidence,
                parameters,
                self.ruleset.version,
            )
            candidates.append(
                BehaviorCandidate(behavior_type, timestamp_ms, confidence, parameters, True)
            )
            behaviors.append(behavior)

            value = OmenValue(self.ruleset.zone_to_omen[zone.value])
            if state.last_omen_value == value:
                assert state.last_omen_ms is not None
                reason = (
                    "cooldown_active"
                    if timestamp_ms - state.last_omen_ms < self.ruleset.cooldown_ms
                    else "duplicate_omen"
                )
                omen_candidates.append(
                    OmenCandidate(value, timestamp_ms, behavior, False, reason)
                )
                continue

            candidate = OmenCandidate(value, timestamp_ms, behavior, True)
            omen_candidates.append(candidate)
            state.sequence += 1
            omen = Omen(
                source.chamber_id,
                source.creature_id,
                state.sequence,
                value,
                timestamp_ms,
                behavior,
                self.ruleset.version,
            )
            omens.append(omen)
            state.last_omen_value = value
            state.last_omen_ms = timestamp_ms

        return VisionResult(
            source,
            tuple(detections),
            tuple(observations),
            tuple(candidates),
            tuple(behaviors),
            tuple(omen_candidates),
            tuple(omens),
        )
