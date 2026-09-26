"""Small deterministic market model used only by the cross-module local harness."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum

from vision.provenance import ProofOfOmen


class LocalMarketState(str, Enum):
    OPEN = "OPEN"
    LOCKED = "LOCKED"
    RESOLVED = "RESOLVED"
    CANCELLED = "CANCELLED"


@dataclass
class LocalMarket:
    market_id: int
    chamber_id: str
    opens_at_ms: int
    locks_at_ms: int
    deadline_ms: int
    min_sequence: int
    state: LocalMarketState = LocalMarketState.OPEN
    stakes: dict[str, dict[str, int]] = field(default_factory=dict)
    winner: str | None = None
    resolving_sequence: int | None = None

    def predict(self, user: str, outcome: str, amount: int, now_ms: int) -> None:
        if self.state is not LocalMarketState.OPEN or not (
            self.opens_at_ms <= now_ms < self.locks_at_ms
        ):
            raise ValueError("prediction window closed")
        if outcome not in {"SELL", "HOLD", "BUY"} or amount <= 0:
            raise ValueError("invalid prediction")
        self.stakes.setdefault(user, {}).setdefault(outcome, 0)
        self.stakes[user][outcome] += amount

    def resolve(self, manifest: ProofOfOmen) -> None:
        if self.state not in {LocalMarketState.OPEN, LocalMarketState.LOCKED}:
            raise ValueError("market is terminal")
        if manifest.chamber_id != self.chamber_id:
            raise ValueError("wrong Chamber")
        if manifest.omen_sequence < self.min_sequence:
            raise ValueError("ineligible Omen sequence")
        observed_at = manifest.observed_at_ms
        if not self.locks_at_ms <= observed_at <= self.deadline_ms:
            raise ValueError("Omen outside resolution window")
        self.state = LocalMarketState.LOCKED
        winner_pool = sum(
            outcomes.get(manifest.omen_value, 0) for outcomes in self.stakes.values()
        )
        if winner_pool == 0:
            self.state = LocalMarketState.CANCELLED
            return
        self.winner = manifest.omen_value
        self.resolving_sequence = manifest.omen_sequence
        self.state = LocalMarketState.RESOLVED


class LocalMarketEngine:
    def __init__(self) -> None:
        self.markets: dict[int, LocalMarket] = {}
        self.active_by_chamber: dict[str, int] = {}
        self.consumed: set[tuple[str, int]] = set()
        self.next_market_id = 1

    def create_market(
        self,
        chamber_id: str,
        opens_at_ms: int,
        locks_at_ms: int,
        deadline_ms: int,
        min_sequence: int,
    ) -> LocalMarket:
        if not chamber_id or not (opens_at_ms <= locks_at_ms < deadline_ms):
            raise ValueError("invalid market interval")
        market = LocalMarket(
            self.next_market_id,
            chamber_id,
            opens_at_ms,
            locks_at_ms,
            deadline_ms,
            min_sequence,
        )
        self.next_market_id += 1
        self.markets[market.market_id] = market
        self.active_by_chamber[chamber_id] = market.market_id
        return market

    def resolve_from_omen(self, manifest: ProofOfOmen) -> int | None:
        key = (manifest.chamber_id, manifest.omen_sequence)
        if key in self.consumed:
            raise ValueError("Omen sequence already consumed")
        market_id = self.active_by_chamber.get(manifest.chamber_id)
        if market_id is None:
            return None
        market = self.markets[market_id]
        market.resolve(manifest)
        self.consumed.add(key)
        self.active_by_chamber.pop(manifest.chamber_id, None)
        return market_id
