from __future__ import annotations

import copy
import unittest

from oracle.battle import (
    Battle,
    BattleConfig,
    BattleEngine,
    BattleOmen,
    BattleResult,
    BattleState,
    PricePoint,
    PriceSeries,
)


class BattleEngineTests(unittest.TestCase):
    def setUp(self) -> None:
        self.config = BattleConfig("MON", 1_000, 4_000, 1_000_000, 1_000)
        self.battle = Battle(
            "battle-1",
            "hamster-ada",
            "fish-byte",
            "chamber-hamster",
            "chamber-fish",
            self.config,
        )
        self.prices = PriceSeries(
            "fixture:mon-001",
            "MON",
            (
                PricePoint(1_000, 1_000_000),
                PricePoint(2_000, 1_100_000),
                PricePoint(3_000, 1_000_000),
                PricePoint(4_000, 1_200_000),
            ),
        )

    def omen(self, side: str, sequence: int, timestamp: int, value: str) -> BattleOmen:
        return BattleOmen(
            "hamster-ada" if side == "A" else "fish-byte",
            "chamber-hamster" if side == "A" else "chamber-fish",
            sequence,
            timestamp,
            value,
            self.config.config_hash,
        )

    def ready(self, battle: Battle | None = None) -> Battle:
        target = battle or self.battle
        BattleEngine().activate(target, 1_000)
        BattleEngine().end(target, 4_000)
        return target

    def test_normal_battle_is_deterministic(self) -> None:
        omens_a = (self.omen("A", 1, 1_000, "BUY"),)
        omens_b = (self.omen("B", 1, 1_000, "SELL"),)
        first = BattleEngine().resolve(self.ready(), omens_a, omens_b, self.prices)
        replay = BattleEngine().resolve(
            self.ready(copy.deepcopy(Battle(
                "battle-2",
                "hamster-ada",
                "fish-byte",
                "chamber-hamster",
                "chamber-fish",
                self.config,
            ))),
            omens_a,
            omens_b,
            self.prices,
        )
        self.assertEqual(first.state, BattleState.RESOLVED)
        self.assertEqual(first.result, BattleResult.CREATURE_A)
        self.assertEqual((first.pnl_a_micros, first.pnl_b_micros), (209_090, -209_090))
        self.assertEqual(first.pnl_a_micros, replay.pnl_a_micros)
        self.assertEqual(first.price_series_hash, replay.price_series_hash)

    def test_tie(self) -> None:
        omens = (self.omen("A", 1, 1_000, "HOLD"),)
        other = (self.omen("B", 1, 1_000, "HOLD"),)
        result = BattleEngine().resolve(self.ready(), omens, other, self.prices)
        self.assertEqual(result.result, BattleResult.TIE)
        self.assertEqual(result.pnl_a_micros, 0)

    def test_one_creature_with_no_omen_remains_flat(self) -> None:
        result = BattleEngine().resolve(
            self.ready(), (self.omen("A", 1, 1_000, "BUY"),), (), self.prices
        )
        self.assertEqual(result.pnl_b_micros, 0)
        self.assertEqual(result.result, BattleResult.CREATURE_A)

    def test_stale_price_data_cancels(self) -> None:
        stale = PriceSeries(
            "fixture:stale",
            "MON",
            (PricePoint(1_000, 1_000_000), PricePoint(4_000, 1_200_000)),
        )
        result = BattleEngine().resolve(self.ready(), (), (), stale)
        self.assertEqual(result.state, BattleState.CANCELLED)
        self.assertEqual(result.cancellation_reason, "STALE_OR_INCOMPLETE_PRICE_DATA")

    def test_invalid_config_mismatch_cancels(self) -> None:
        bad = BattleOmen(
            "hamster-ada",
            "chamber-hamster",
            1,
            1_000,
            "BUY",
            "0" * 64,
        )
        result = BattleEngine().resolve(self.ready(), (bad,), (), self.prices)
        self.assertEqual(result.state, BattleState.CANCELLED)
        self.assertEqual(result.cancellation_reason, "CONFIG_OR_ID_MISMATCH_A")

    def test_conflicting_omens_cancel(self) -> None:
        result = BattleEngine().resolve(
            self.ready(),
            (
                self.omen("A", 1, 1_000, "BUY"),
                self.omen("A", 2, 1_000, "SELL"),
            ),
            (),
            self.prices,
        )
        self.assertEqual(result.state, BattleState.CANCELLED)
        self.assertEqual(result.cancellation_reason, "CONFLICTING_OMENS")


if __name__ == "__main__":
    unittest.main()
