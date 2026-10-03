from __future__ import annotations

import hashlib
import time
import unittest
from dataclasses import replace

from oracle.workflow import ChainlinkCREWorkflowAdapter
from vision.engine import VisionEngine, default_ruleset
from vision.models import CreatureType, Detection, SourceSegment
from vision.provenance import build_proof


class StubCREClient:
    def __init__(self, response: dict) -> None:
        self.response = response
        self.request: dict | None = None

    def execute(self, workflow_id: str, request: dict) -> dict:
        self.request = {"workflow_id": workflow_id, **request}
        return self.response


class WorkflowBoundaryTests(unittest.TestCase):
    @staticmethod
    def bytes32(value: str) -> str:
        normalized = value[2:] if value.startswith("0x") else value
        return f"0x{normalized}"

    def manifest(self):
        source_bytes = b"cre workflow fixture"
        source = SourceSegment(
            "cre-segment",
            f"0x{hashlib.sha256(b'cre-chamber').hexdigest()}",
            f"0x{hashlib.sha256(b'cre-creature').hexdigest()}",
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
        return build_proof(source, detections, omen, ruleset, "cre-test", 2_100)

    def test_unconfigured_cre_adapter_fails_explicitly(self) -> None:
        adapter = ChainlinkCREWorkflowAdapter()
        with self.assertRaisesRegex(RuntimeError, "not configured"):
            adapter.validate(None)

    def test_configured_cre_response_is_bound_to_manifest_and_sequence(self) -> None:
        manifest = self.manifest()
        client = StubCREClient(
            {
                "workflow_id": "augur-omen-validation-v1",
                "workflow_version": "1.0.0",
                "execution_id": "execution-1",
                "manifest_hash": self.bytes32(manifest.manifest_hash),
                "chamber_id": manifest.chamber_id,
                "creature_id": manifest.creature_id,
                "sequence": manifest.omen_sequence,
                "provenance_hash": self.bytes32(manifest.manifest_hash),
                "publication": {
                    "chain_id": 10143,
                    "to": "0x333c7ba28b6Eec62f51d111d161fc52fd3ADAa1a",
                },
                "accepted": True,
            }
        )
        adapter = ChainlinkCREWorkflowAdapter("augur-omen-validation-v1", client)
        self.assertTrue(adapter.validate(manifest))
        self.assertEqual(client.request["provenance_hash"], self.bytes32(manifest.manifest_hash))
        self.assertEqual(client.request["chain_id"], 10143)
        self.assertEqual(
            client.request["omen_publisher"],
            "0x333c7ba28b6Eec62f51d111d161fc52fd3ADAa1a",
        )
        self.assertEqual(client.request["omen_value"], manifest.omen_value)

    def test_configured_cre_rejects_unbound_response(self) -> None:
        manifest = self.manifest()
        client = StubCREClient(
            {
                "workflow_id": "augur-omen-validation-v1",
                "workflow_version": "1.0.0",
                "execution_id": "execution-2",
                "manifest_hash": f"0x{'0' * 64}",
                "chamber_id": manifest.chamber_id,
                "creature_id": manifest.creature_id,
                "sequence": manifest.omen_sequence,
                "provenance_hash": self.bytes32(manifest.manifest_hash),
                "publication": {
                    "chain_id": 10143,
                    "to": "0x333c7ba28b6Eec62f51d111d161fc52fd3ADAa1a",
                },
                "accepted": True,
            }
        )
        adapter = ChainlinkCREWorkflowAdapter("augur-omen-validation-v1", client)
        with self.assertRaisesRegex(ValueError, "manifest binding"):
            adapter.validate(manifest)

    def test_cre_adapter_is_idempotent_and_rejects_sequence_replay(self) -> None:
        manifest = self.manifest()
        client = StubCREClient(
            {
                "workflow_id": "workflow",
                "workflow_version": "1.0.0",
                "execution_id": "execution-1",
                "manifest_hash": self.bytes32(manifest.manifest_hash),
                "chamber_id": manifest.chamber_id,
                "creature_id": manifest.creature_id,
                "sequence": manifest.omen_sequence,
                "provenance_hash": self.bytes32(manifest.manifest_hash),
                "publication": {
                    "chain_id": 10143,
                    "to": "0x333c7ba28b6Eec62f51d111d161fc52fd3ADAa1a",
                },
                "accepted": True,
            }
        )
        adapter = ChainlinkCREWorkflowAdapter("workflow", client)
        self.assertTrue(adapter.validate(manifest))
        self.assertTrue(adapter.validate(manifest))
        conflicting = replace(manifest, evidence_uri="fixture://different", manifest_hash="").seal()
        with self.assertRaisesRegex(ValueError, "replay or regression"):
            adapter.validate(conflicting)

    def test_cre_timeout_fails_explicitly(self) -> None:
        manifest = self.manifest()

        class SlowClient:
            def execute(self, workflow_id: str, request: dict) -> dict:
                del workflow_id, request
                time.sleep(0.05)
                return {}

        adapter = ChainlinkCREWorkflowAdapter(
            "workflow", SlowClient(), timeout_seconds=0.001
        )
        with self.assertRaisesRegex(TimeoutError, "timed out"):
            adapter.validate(manifest)


if __name__ == "__main__":
    unittest.main()
