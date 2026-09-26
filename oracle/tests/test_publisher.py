from __future__ import annotations

import hashlib
import unittest

from oracle.publisher import EvmPublisher
from vision.engine import VisionEngine, default_ruleset
from vision.models import CreatureType, Detection, SourceSegment
from vision.provenance import build_proof


class EvmPublisherBoundaryTests(unittest.TestCase):
    def test_emits_typed_transaction_intent(self) -> None:
        source_bytes = b"publisher fixture"
        source = SourceSegment(
            "segment-publisher",
            "chamber-publisher",
            "creature-publisher",
            1_000,
            2_000,
            hashlib.sha256(source_bytes).hexdigest(),
        )
        detections = [
            Detection(1_000, 0.8, 0.5, 0.95),
            Detection(1_100, 0.8, 0.5, 0.95),
        ]
        ruleset = default_ruleset(CreatureType.HAMSTER)
        omen = VisionEngine(ruleset).process(source, detections).omens[0]
        manifest = build_proof(
            source, detections, omen, ruleset, "publisher-test", 2_100
        )
        captured = []

        def sender(intent):
            captured.append(intent)
            return "0xtransaction"

        receipt = EvmPublisher(31_337, "0xcontract", sender).publish(manifest)
        self.assertEqual(receipt.publication_id, "0xtransaction")
        self.assertEqual(captured[0]["arguments"]["sequence"], 1)
        self.assertEqual(captured[0]["arguments"]["provenance_hash"], manifest.manifest_hash)


if __name__ == "__main__":
    unittest.main()
