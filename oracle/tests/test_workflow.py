from __future__ import annotations

import unittest
import hashlib

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
    def manifest(self):
        source_bytes = b"cre workflow fixture"
        source = SourceSegment(
            "cre-segment",
            "cre-chamber",
            "cre-creature",
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
                "manifest_hash": manifest.manifest_hash,
                "chamber_id": manifest.chamber_id,
                "sequence": manifest.omen_sequence,
                "accepted": True,
            }
        )
        adapter = ChainlinkCREWorkflowAdapter("augur-omen-validation-v1", client)
        self.assertTrue(adapter.validate(manifest))
        self.assertEqual(client.request["provenance_hash"], manifest.manifest_hash)

    def test_configured_cre_rejects_unbound_response(self) -> None:
        manifest = self.manifest()
        client = StubCREClient(
            {
                "workflow_id": "augur-omen-validation-v1",
                "manifest_hash": "0" * 64,
                "chamber_id": manifest.chamber_id,
                "sequence": manifest.omen_sequence,
                "accepted": True,
            }
        )
        adapter = ChainlinkCREWorkflowAdapter("augur-omen-validation-v1", client)
        with self.assertRaisesRegex(ValueError, "manifest binding"):
            adapter.validate(manifest)


if __name__ == "__main__":
    unittest.main()
