from __future__ import annotations

import unittest
from pathlib import Path

from vision.engine import VisionEngine, default_ruleset
from vision.fixtures import load_trajectory


FIXTURES = Path(__file__).parents[1] / "fixtures"


class FixtureTests(unittest.TestCase):
    def test_all_creature_fixtures_replay(self) -> None:
        expected = {
            "hamster_path.json": ["SELL", "HOLD", "BUY"],
            "fish_path.json": ["BUY", "HOLD", "SELL"],
            "turtle_path.json": ["HOLD", "BUY"],
        }
        for name, omen_values in expected.items():
            with self.subTest(name=name):
                source, creature_type, detections, _ = load_trajectory(FIXTURES / name)
                result = VisionEngine(default_ruleset(creature_type)).process(source, detections)
                self.assertEqual([omen.value.value for omen in result.omens], omen_values)


if __name__ == "__main__":
    unittest.main()

