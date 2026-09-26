"""Deterministic virtual-PnL battle scoring for controlled Omen and price replays."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from fractions import Fraction
from typing import Callable, Protocol

from vision.provenance import stable_hash


class BattleState(str, Enum):
    CREATED = "CREATED"
    ACTIVE = "ACTIVE"
    ENDED = "ENDED"
    RESOLVED = "RESOLVED"
    CANCELLED = "CANCELLED"


class BattleResult(str, Enum):
    CREATURE_A = "CREATURE_A"
    CREATURE_B = "CREATURE_B"
    TIE = "TIE"


@dataclass(frozen=True)
class BattleConfig:
    asset: str
    starts_at_ms: int
    ends_at_ms: int
    starting_notional_micros: int
    max_price_gap_ms: int
    version: str = "battle-scoring-1.0.0"

    def __post_init__(self) -> None:
        if not self.asset or not self.version:
            raise ValueError("asset and version are required")
        if self.starts_at_ms < 0 or self.ends_at_ms <= self.starts_at_ms:
            raise ValueError("invalid battle interval")
        if self.starting_notional_micros <= 0 or self.max_price_gap_ms <= 0:
            raise ValueError("notional and price freshness must be positive")

    @property
    def config_hash(self) -> str:
        return stable_hash(
            {
                "asset": self.asset,
                "ends_at_ms": self.ends_at_ms,
                "max_price_gap_ms": self.max_price_gap_ms,
                "starting_notional_micros": self.starting_notional_micros,
                "starts_at_ms": self.starts_at_ms,
                "version": self.version,
            }
        )


@dataclass(frozen=True)
class BattleOmen:
    creature_id: str
    chamber_id: str
    sequence: int
    observed_at_ms: int
    value: str
    scoring_config_hash: str

    def __post_init__(self) -> None:
        if self.sequence < 1 or self.value not in {"BUY", "HOLD", "SELL"}:
            raise ValueError("invalid battle Omen")


@dataclass(frozen=True)
class PricePoint:
    timestamp_ms: int
    price_micros: int

    def __post_init__(self) -> None:
        if self.timestamp_ms < 0 or self.price_micros <= 0:
            raise ValueError("invalid price point")


@dataclass(frozen=True)
class PriceSeries:
    source_id: str
    asset: str
    points: tuple[PricePoint, ...]


class PriceProvider(Protocol):
    def load(self, config: BattleConfig) -> PriceSeries: ...


@dataclass(frozen=True)
class ReplayPriceProvider:
    """Deterministic fixture/replay source; its source identifier remains visible."""

    series: PriceSeries

    def load(self, config: BattleConfig) -> PriceSeries:
        if self.series.asset != config.asset:
            raise ValueError("price replay asset mismatch")
        return self.series


class ConfiguredPriceProvider:
    """Boundary for a real timestamped provider with no fixture fallback."""

    def __init__(
        self,
        source_id: str,
        loader: Callable[[BattleConfig], tuple[PricePoint, ...]],
    ) -> None:
        if not source_id or loader is None:
            raise ValueError("configured price provider requires a source and loader")
        self.source_id = source_id
        self.loader = loader

    def load(self, config: BattleConfig) -> PriceSeries:
        return PriceSeries(self.source_id, config.asset, self.loader(config))


@dataclass
class Battle:
    battle_id: str
    creature_a: str
    creature_b: str
    chamber_a: str
    chamber_b: str
    config: BattleConfig
    state: BattleState = BattleState.CREATED
    pnl_a_micros: int | None = None
    pnl_b_micros: int | None = None
    result: BattleResult | None = None
    cancellation_reason: str | None = None
    price_source_id: str | None = None
    price_series_hash: str | None = None

    def __post_init__(self) -> None:
        if not self.battle_id or not self.creature_a or not self.creature_b:
            raise ValueError("battle identifiers are required")
        if self.creature_a == self.creature_b or self.chamber_a == self.chamber_b:
            raise ValueError("battle sides must be distinct")


class BattleEngine:
    SIGNAL = {"SELL": -1, "HOLD": 0, "BUY": 1}

    def activate(self, battle: Battle, now_ms: int) -> None:
        if battle.state is not BattleState.CREATED:
            raise ValueError("battle is not created")
        if not battle.config.starts_at_ms <= now_ms < battle.config.ends_at_ms:
            raise ValueError("battle cannot activate at this time")
        battle.state = BattleState.ACTIVE

    def end(self, battle: Battle, now_ms: int) -> None:
        if battle.state is not BattleState.ACTIVE:
            raise ValueError("battle is not active")
        if now_ms < battle.config.ends_at_ms:
            raise ValueError("battle end time has not arrived")
        battle.state = BattleState.ENDED

    def resolve(
        self,
        battle: Battle,
        omens_a: tuple[BattleOmen, ...],
        omens_b: tuple[BattleOmen, ...],
        prices: PriceSeries,
    ) -> Battle:
        if battle.state is not BattleState.ENDED:
            raise ValueError("battle must be ended before resolution")
        if prices.asset != battle.config.asset:
            return self._cancel(battle, "PRICE_ASSET_MISMATCH")
        if not self._valid_stream(battle, omens_a, side="A"):
            return self._cancel(battle, "CONFIG_OR_ID_MISMATCH_A")
        if not self._valid_stream(battle, omens_b, side="B"):
            return self._cancel(battle, "CONFIG_OR_ID_MISMATCH_B")
        if not self._valid_prices(battle.config, prices.points):
            return self._cancel(battle, "STALE_OR_INCOMPLETE_PRICE_DATA")
        if self._has_conflict(omens_a) or self._has_conflict(omens_b):
            return self._cancel(battle, "CONFLICTING_OMENS")

        pnl_a = self._score(battle.config, omens_a, prices.points)
        pnl_b = self._score(battle.config, omens_b, prices.points)
        battle.pnl_a_micros = pnl_a
        battle.pnl_b_micros = pnl_b
        battle.price_source_id = prices.source_id
        battle.price_series_hash = stable_hash(
            {
                "asset": prices.asset,
                "points": [
                    {"price_micros": point.price_micros, "timestamp_ms": point.timestamp_ms}
                    for point in prices.points
                ],
                "source_id": prices.source_id,
            }
        )
        if pnl_a > pnl_b:
            battle.result = BattleResult.CREATURE_A
        elif pnl_b > pnl_a:
            battle.result = BattleResult.CREATURE_B
        else:
            battle.result = BattleResult.TIE
        battle.state = BattleState.RESOLVED
        return battle

    def _valid_stream(
        self, battle: Battle, omens: tuple[BattleOmen, ...], *, side: str
    ) -> bool:
        creature = battle.creature_a if side == "A" else battle.creature_b
        chamber = battle.chamber_a if side == "A" else battle.chamber_b
        return all(
            omen.creature_id == creature
            and omen.chamber_id == chamber
            and omen.scoring_config_hash == battle.config.config_hash
            and battle.config.starts_at_ms <= omen.observed_at_ms <= battle.config.ends_at_ms
            for omen in omens
        )

    def _valid_prices(
        self, config: BattleConfig, points: tuple[PricePoint, ...]
    ) -> bool:
        if len(points) < 2:
            return False
        if points[0].timestamp_ms != config.starts_at_ms:
            return False
        if points[-1].timestamp_ms != config.ends_at_ms:
            return False
        return all(
            earlier.timestamp_ms < later.timestamp_ms
            and later.timestamp_ms - earlier.timestamp_ms <= config.max_price_gap_ms
            for earlier, later in zip(points, points[1:])
        )

    def _has_conflict(self, omens: tuple[BattleOmen, ...]) -> bool:
        values_by_time: dict[int, set[str]] = {}
        for omen in omens:
            values_by_time.setdefault(omen.observed_at_ms, set()).add(omen.value)
        return any(len(values) > 1 for values in values_by_time.values())

    def _score(
        self,
        config: BattleConfig,
        omens: tuple[BattleOmen, ...],
        points: tuple[PricePoint, ...],
    ) -> int:
        ordered_omens = sorted(omens, key=lambda omen: (omen.observed_at_ms, omen.sequence))
        position = 0
        omen_index = 0
        pnl = Fraction(0)
        for current, following in zip(points, points[1:]):
            while (
                omen_index < len(ordered_omens)
                and ordered_omens[omen_index].observed_at_ms <= current.timestamp_ms
            ):
                position = self.SIGNAL[ordered_omens[omen_index].value]
                omen_index += 1
            pnl += Fraction(
                config.starting_notional_micros
                * position
                * (following.price_micros - current.price_micros),
                current.price_micros,
            )
        return int(pnl)

    def _cancel(self, battle: Battle, reason: str) -> Battle:
        battle.state = BattleState.CANCELLED
        battle.cancellation_reason = reason
        return battle


@dataclass
class BattleBook:
    battles: dict[str, Battle] = field(default_factory=dict)

    def add(self, battle: Battle) -> None:
        if battle.battle_id in self.battles:
            raise ValueError("battle ID already exists")
        self.battles[battle.battle_id] = battle
