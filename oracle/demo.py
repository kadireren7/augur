"""Run the local M1→M4 path twice to demonstrate immediate market cycling."""

from __future__ import annotations

import json
from pathlib import Path

from vision.engine import VisionEngine, default_ruleset
from vision.fixtures import load_trajectory
from vision.provenance import build_proof

from .local_market import LocalMarketEngine
from .publisher import LocalPublisher
from .service import OraclePolicy, OracleService
from .store import AttemptStore


def run_demo() -> dict[str, object]:
    fixture_directory = Path(__file__).parents[1] / "vision" / "fixtures"
    fixture = fixture_directory / "hamster_path.json"
    source, creature_type, detections, source_bytes = load_trajectory(fixture)
    ruleset = default_ruleset(creature_type)
    result = VisionEngine(ruleset).process(source, detections)

    market_engine = LocalMarketEngine()
    publisher = LocalPublisher(market_engine)
    fish_source, fish_type, fish_detections, fish_source_bytes = load_trajectory(
        fixture_directory / "fish_path.json"
    )
    fish_ruleset = default_ruleset(fish_type)
    fish_result = VisionEngine(fish_ruleset).process(fish_source, fish_detections)

    service = OracleService(
        OraclePolicy(
            {
                source.chamber_id: source.creature_id,
                fish_source.chamber_id: fish_source.creature_id,
            },
            max_staleness_ms=10_000,
        ),
        AttemptStore(),
        publisher,
    )

    first_market = market_engine.create_market(source.chamber_id, 1_000, 1_400, 2_500, 1)
    first_market.predict("alice", "SELL", 100, 1_100)
    first_market.predict("bob", "BUY", 200, 1_200)
    first_proof = build_proof(
        source,
        detections,
        result.omens[0],
        ruleset,
        "local-oracle",
        1_600,
        "file://vision/fixtures/hamster_path.json",
    )
    first_receipt = service.publish_validated(
        first_proof,
        detections,
        ruleset,
        now_ms=8_000,
        source_bytes=source_bytes,
    )

    second_market = market_engine.create_market(source.chamber_id, 2_500, 3_000, 4_500, 2)
    second_market.predict("alice", "HOLD", 100, 2_600)
    second_market.predict("bob", "BUY", 100, 2_700)
    second_proof = build_proof(
        source,
        detections,
        result.omens[1],
        ruleset,
        "local-oracle",
        3_600,
        "file://vision/fixtures/hamster_path.json",
    )
    second_receipt = service.publish_validated(
        second_proof,
        detections,
        ruleset,
        now_ms=8_100,
        source_bytes=source_bytes,
    )

    fish_market = market_engine.create_market(fish_source.chamber_id, 1_000, 1_300, 2_000, 1)
    fish_market.predict("alice", "BUY", 100, 1_100)
    fish_market.predict("carol", "SELL", 100, 1_200)
    fish_proof = build_proof(
        fish_source,
        fish_detections,
        fish_result.omens[0],
        fish_ruleset,
        "local-oracle",
        7_700,
        "file://vision/fixtures/fish_path.json",
    )
    fish_receipt = service.publish_validated(
        fish_proof,
        fish_detections,
        fish_ruleset,
        now_ms=8_200,
        source_bytes=fish_source_bytes,
    )

    return {
        "pipeline": "fixture -> observation -> behavior -> omen -> proof -> oracle -> market",
        "detected_omens": [omen.value.value for omen in result.omens],
        "markets": [
            {
                "market_id": first_market.market_id,
                "state": first_market.state.value,
                "winner": first_market.winner,
                "sequence": first_market.resolving_sequence,
            },
            {
                "market_id": second_market.market_id,
                "state": second_market.state.value,
                "winner": second_market.winner,
                "sequence": second_market.resolving_sequence,
            },
            {
                "market_id": fish_market.market_id,
                "chamber_id": fish_market.chamber_id,
                "state": fish_market.state.value,
                "winner": fish_market.winner,
                "sequence": fish_market.resolving_sequence,
            },
        ],
        "publication_ids": [
            first_receipt.publication_id,
            second_receipt.publication_id,
            fish_receipt.publication_id,
        ],
    }


def main() -> None:
    print(json.dumps(run_demo(), indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
