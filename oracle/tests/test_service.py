from __future__ import annotations

import hashlib
import tempfile
import unittest
from dataclasses import replace
from pathlib import Path

from oracle.publisher import LocalPublisher
from oracle.service import OraclePolicy, OracleService
from oracle.store import AttemptStore
from vision.engine import VisionEngine, default_ruleset
from vision.models import CreatureType, Detection, SourceSegment
from vision.provenance import build_proof


class FailingPublisher:
    def __init__(self) -> None:
        self.calls = 0

    def publish(self, manifest):
        del manifest
        self.calls += 1
        raise RuntimeError("temporary publisher failure")


class OracleServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.source_bytes = b"oracle fixture"
        self.source = SourceSegment(
            "segment-oracle",
            "chamber-oracle",
            "creature-oracle",
            1_000,
            2_000,
            hashlib.sha256(self.source_bytes).hexdigest(),
        )
        self.detections = [
            Detection(1_000, 0.8, 0.5, 0.95),
            Detection(1_100, 0.8, 0.5, 0.95),
        ]
        self.ruleset = default_ruleset(CreatureType.HAMSTER)
        result = VisionEngine(self.ruleset).process(self.source, self.detections)
        self.manifest = build_proof(
            self.source,
            self.detections,
            result.omens[0],
            self.ruleset,
            "oracle-test",
            2_100,
        )
        self.policy = OraclePolicy({"chamber-oracle": "creature-oracle"}, 5_000)

    def test_valid_publication_and_idempotent_retry(self) -> None:
        publisher = LocalPublisher()
        store = AttemptStore()
        service = OracleService(self.policy, store, publisher)
        first = service.publish_validated(
            self.manifest,
            self.detections,
            self.ruleset,
            now_ms=2_200,
            source_bytes=self.source_bytes,
        )
        second = service.publish_validated(
            self.manifest,
            self.detections,
            self.ruleset,
            now_ms=2_300,
            source_bytes=self.source_bytes,
        )
        self.assertEqual(first, second)
        self.assertEqual(len(publisher.publications), 1)
        self.assertEqual(store.get(self.manifest.manifest_hash).attempt_count, 1)

    def test_attempts_persist_to_sqlite(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "attempts.sqlite3"
            store = AttemptStore(path)
            service = OracleService(self.policy, store, LocalPublisher())
            service.publish_validated(
                self.manifest,
                self.detections,
                self.ruleset,
                now_ms=2_200,
                source_bytes=self.source_bytes,
            )
            store.close()
            reopened = AttemptStore(path)
            self.assertEqual(
                reopened.get(self.manifest.manifest_hash).status,
                "PUBLISHED",
            )
            reopened.close()

    def test_stale_and_wrong_identity_rejected(self) -> None:
        service = OracleService(self.policy, AttemptStore(), LocalPublisher())
        with self.assertRaisesRegex(ValueError, "stale"):
            service.publish_validated(
                self.manifest,
                self.detections,
                self.ruleset,
                now_ms=10_000,
                source_bytes=self.source_bytes,
            )
        wrong_policy = OraclePolicy({"chamber-oracle": "another-creature"}, 5_000)
        with self.assertRaisesRegex(ValueError, "does not belong"):
            OracleService(wrong_policy, AttemptStore(), LocalPublisher()).publish_validated(
                self.manifest,
                self.detections,
                self.ruleset,
                now_ms=2_200,
                source_bytes=self.source_bytes,
            )

    def test_failed_attempt_is_recorded_and_retryable(self) -> None:
        store = AttemptStore()
        publisher = FailingPublisher()
        service = OracleService(self.policy, store, publisher)
        for expected_count in (1, 2):
            with self.assertRaisesRegex(RuntimeError, "temporary"):
                service.publish_validated(
                    self.manifest,
                    self.detections,
                    self.ruleset,
                    now_ms=2_200,
                    source_bytes=self.source_bytes,
                )
            attempt = store.get(self.manifest.manifest_hash)
            self.assertEqual(attempt.status, "FAILED")
            self.assertEqual(attempt.attempt_count, expected_count)

    def test_conflicting_sequence_and_regression_are_rejected(self) -> None:
        store = AttemptStore()
        service = OracleService(self.policy, store, LocalPublisher())
        sequence_two = replace(self.manifest, omen_sequence=2, manifest_hash="").seal()
        service.publish_validated(
            sequence_two,
            self.detections,
            self.ruleset,
            now_ms=2_200,
            source_bytes=self.source_bytes,
        )
        with self.assertRaisesRegex(ValueError, "regression"):
            service.publish_validated(
                self.manifest,
                self.detections,
                self.ruleset,
                now_ms=2_300,
                source_bytes=self.source_bytes,
            )

        conflicting = replace(
            sequence_two,
            evidence_uri="file://conflicting-evidence",
            manifest_hash="",
        ).seal()
        with self.assertRaisesRegex(ValueError, "conflicting manifest"):
            service.publish_validated(
                conflicting,
                self.detections,
                self.ruleset,
                now_ms=2_300,
                source_bytes=self.source_bytes,
            )


if __name__ == "__main__":
    unittest.main()
