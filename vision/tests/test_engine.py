from __future__ import annotations

import hashlib
import unittest
from dataclasses import replace

from vision.engine import VisionEngine, default_ruleset
from vision.models import CreatureType, Detection, OmenValue, SourceSegment


def source(end: int = 10_000) -> SourceSegment:
    return SourceSegment(
        "segment-1",
        "chamber-1",
        "creature-1",
        0,
        end,
        hashlib.sha256(b"fixture").hexdigest(),
    )


def points(*values: tuple[int, float, float]) -> list[Detection]:
    return [Detection(timestamp, x, 0.5, confidence) for timestamp, x, confidence in values]


class VisionEngineTests(unittest.TestCase):
    def setUp(self) -> None:
        self.rules = default_ruleset(CreatureType.HAMSTER)

    def test_left_center_right_mapping(self) -> None:
        detections = points(
            (0, 0.1, 0.95),
            (100, 0.1, 0.95),
            (1_200, 0.5, 0.95),
            (1_300, 0.5, 0.95),
            (2_400, 0.9, 0.95),
            (2_500, 0.9, 0.95),
        )
        result = VisionEngine(self.rules).process(source(), detections)
        self.assertEqual(
            [omen.value for omen in result.omens],
            [OmenValue.SELL, OmenValue.HOLD, OmenValue.BUY],
        )
        self.assertEqual([omen.sequence for omen in result.omens], [1, 2, 3])

    def test_insufficient_confidence_produces_no_behavior(self) -> None:
        result = VisionEngine(self.rules).process(
            source(), points((0, 0.1, 0.2), (100, 0.1, 0.3))
        )
        self.assertFalse(result.behaviors)
        self.assertFalse(result.omens)
        self.assertEqual(result.behavior_candidates[-1].rejection_reason, "insufficient_confidence")

    def test_debounce_requires_configured_samples(self) -> None:
        result = VisionEngine(self.rules).process(source(), points((0, 0.9, 0.9)))
        self.assertFalse(result.omens)
        self.assertEqual(result.behavior_candidates[-1].rejection_reason, "debounce_pending")

    def test_cooldown_and_duplicate_suppression(self) -> None:
        result = VisionEngine(self.rules).process(
            source(),
            points(
                (0, 0.1, 0.9),
                (100, 0.1, 0.9),
                (200, 0.1, 0.9),
                (1_500, 0.1, 0.9),
            ),
        )
        self.assertEqual(len(result.omens), 1)
        rejected = [candidate for candidate in result.omen_candidates if not candidate.accepted]
        self.assertEqual(rejected[0].rejection_reason, "cooldown_active")
        self.assertEqual(rejected[-1].rejection_reason, "duplicate_omen")

    def test_conflicting_observations_produce_no_omen(self) -> None:
        detections = [
            Detection(0, 0.1, 0.5, 0.95, "a"),
            Detection(0, 0.9, 0.5, 0.95, "b"),
            Detection(100, 0.1, 0.5, 0.95, "a"),
            Detection(100, 0.9, 0.5, 0.95, "b"),
        ]
        result = VisionEngine(self.rules).process(source(), detections)
        self.assertFalse(result.omens)
        self.assertEqual(
            {candidate.rejection_reason for candidate in result.behavior_candidates},
            {"conflicting_detections"},
        )

    def test_turtle_uses_slower_debounce_and_dwell(self) -> None:
        turtle = default_ruleset(CreatureType.TURTLE)
        self.assertGreater(turtle.debounce_samples, self.rules.debounce_samples)
        self.assertGreater(turtle.inactivity_ms, self.rules.inactivity_ms)

    def test_deterministic_replay(self) -> None:
        detections = points(
            (0, 0.1, 0.95),
            (100, 0.1, 0.95),
            (1_500, 0.5, 0.95),
            (1_600, 0.5, 0.95),
        )
        first = VisionEngine(self.rules).process(source(), detections)
        second = VisionEngine(self.rules).process(source(), list(detections))
        self.assertEqual(first, second)

    def test_invalid_detection_order_is_rejected(self) -> None:
        with self.assertRaisesRegex(ValueError, "ordered"):
            VisionEngine(self.rules).process(
                source(), points((200, 0.1, 0.9), (100, 0.1, 0.9))
            )

    def test_custom_starting_sequence_is_monotonic(self) -> None:
        result = VisionEngine(self.rules, starting_sequence=41).process(
            source(), points((0, 0.9, 0.9), (100, 0.9, 0.9))
        )
        self.assertEqual(result.omens[0].sequence, 42)

    def test_ruleset_validates_zone_mapping(self) -> None:
        with self.assertRaisesRegex(ValueError, "zone_to_omen"):
            replace(self.rules, zone_to_omen={"LEFT": "SELL"})


if __name__ == "__main__":
    unittest.main()

