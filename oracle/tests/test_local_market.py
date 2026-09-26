from __future__ import annotations

import unittest

from oracle.demo import run_demo
from oracle.local_market import LocalMarketState


class LocalEndToEndTests(unittest.TestCase):
    def test_repeated_market_cycles(self) -> None:
        result = run_demo()
        self.assertEqual(result["detected_omens"], ["SELL", "HOLD", "BUY"])
        self.assertEqual(
            [market["state"] for market in result["markets"]],
            [LocalMarketState.RESOLVED.value] * 3,
        )
        self.assertEqual(
            [market["winner"] for market in result["markets"]],
            ["SELL", "HOLD", "BUY"],
        )
        self.assertEqual([market["sequence"] for market in result["markets"]], [1, 2, 1])


if __name__ == "__main__":
    unittest.main()
