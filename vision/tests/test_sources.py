from __future__ import annotations

import unittest
from pathlib import Path

from vision.sources import BrowserLiveSourceBoundary, DirectoryTrajectorySource


class SourceAdapterTests(unittest.TestCase):
    def test_named_recorded_trajectory_replays(self) -> None:
        source = DirectoryTrajectorySource(Path("vision/fixtures"))
        segment, creature, detections, source_bytes = source.load("hamster_path")
        self.assertEqual(segment.chamber_id, "chamber-hamster")
        self.assertEqual(creature.value, "HAMSTER")
        self.assertGreater(len(detections), 0)
        self.assertGreater(len(source_bytes), 0)

    def test_path_and_url_inputs_are_rejected(self) -> None:
        source = DirectoryTrajectorySource(Path("vision/fixtures"))
        for unsafe in ("../secret", "/etc/passwd", "https://example.test/file", "fish_path.json"):
            with self.subTest(unsafe=unsafe), self.assertRaises(ValueError):
                source.load(unsafe)

    def test_browser_boundary_never_claims_server_side_live_capture(self) -> None:
        with self.assertRaisesRegex(RuntimeError, "browser live input"):
            BrowserLiveSourceBoundary().load("camera")


if __name__ == "__main__":
    unittest.main()
