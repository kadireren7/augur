from __future__ import annotations

import hashlib
import tempfile
import unittest
from dataclasses import replace
from pathlib import Path

from vision.engine import VisionEngine, default_ruleset
from vision.models import CreatureType, Detection, SourceSegment
from vision.provenance import (
    ProofOfOmen,
    SequenceVerifier,
    build_proof,
    load_proof,
    save_proof,
    verify_proof,
)


class ProvenanceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.source_bytes = b"controlled source bytes"
        self.source = SourceSegment(
            "segment-proof",
            "chamber-proof",
            "creature-proof",
            100,
            1_000,
            hashlib.sha256(self.source_bytes).hexdigest(),
        )
        self.detections = [
            Detection(100, 0.8, 0.5, 0.95),
            Detection(200, 0.8, 0.5, 0.95),
        ]
        self.ruleset = default_ruleset(CreatureType.HAMSTER)
        result = VisionEngine(self.ruleset).process(self.source, self.detections)
        self.omen = result.omens[0]

    def build(self) -> ProofOfOmen:
        return build_proof(
            self.source,
            self.detections,
            self.omen,
            self.ruleset,
            "local-oracle",
            2_000,
            "file://fixture-evidence.json",
        )

    def test_hash_is_deterministic_and_valid_manifest_verifies(self) -> None:
        first = self.build()
        second = self.build()
        self.assertEqual(first.manifest_hash, second.manifest_hash)
        verify_proof(first, self.detections, self.ruleset, self.source_bytes)

    def test_one_byte_source_modification_changes_provenance(self) -> None:
        proof = self.build()
        with self.assertRaisesRegex(ValueError, "source hash"):
            verify_proof(proof, self.detections, self.ruleset, self.source_bytes + b"!")
        changed_source = replace(
            self.source, source_hash=hashlib.sha256(self.source_bytes + b"!").hexdigest()
        )
        changed = build_proof(
            changed_source,
            self.detections,
            self.omen,
            self.ruleset,
            "local-oracle",
            2_000,
        )
        self.assertNotEqual(proof.manifest_hash, changed.manifest_hash)

    def test_ruleset_modification_changes_provenance(self) -> None:
        proof = self.build()
        changed_rules = replace(self.ruleset, cooldown_ms=self.ruleset.cooldown_ms + 1)
        changed = build_proof(
            self.source,
            self.detections,
            self.omen,
            changed_rules,
            "local-oracle",
            2_000,
        )
        self.assertNotEqual(proof.manifest_hash, changed.manifest_hash)
        with self.assertRaisesRegex(ValueError, "ruleset hash"):
            verify_proof(proof, self.detections, changed_rules, self.source_bytes)

    def test_malformed_manifest_is_rejected(self) -> None:
        value = self.build().to_dict()
        del value["creature_id"]
        with self.assertRaisesRegex(ValueError, "malformed manifest"):
            ProofOfOmen.from_dict(value)

    def test_tampered_manifest_is_rejected(self) -> None:
        value = self.build().to_dict()
        value["omen_value"] = "SELL"
        with self.assertRaisesRegex(ValueError, "manifest hash mismatch"):
            ProofOfOmen.from_dict(value)

    def test_sequence_ordering_is_enforced_per_chamber(self) -> None:
        verifier = SequenceVerifier()
        proof = self.build()
        verifier.accept(proof)
        with self.assertRaisesRegex(ValueError, "strictly increase"):
            verifier.accept(proof)
        next_proof = replace(proof, omen_sequence=2, manifest_hash="").seal()
        verifier.accept(next_proof)

    def test_local_json_round_trip(self) -> None:
        proof = self.build()
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "proof.json"
            save_proof(path, proof)
            self.assertEqual(load_proof(path), proof)


if __name__ == "__main__":
    unittest.main()
