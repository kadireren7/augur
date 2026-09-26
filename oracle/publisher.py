"""Publication abstractions for local execution and configured EVM clients."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any, Callable, Protocol

from vision.provenance import ProofOfOmen


@dataclass(frozen=True)
class PublicationReceipt:
    adapter: str
    publication_id: str
    chamber_id: str
    sequence: int
    resolved_market_id: int | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class Publisher(Protocol):
    def publish(self, manifest: ProofOfOmen) -> PublicationReceipt: ...


class MarketResolver(Protocol):
    def resolve_from_omen(self, manifest: ProofOfOmen) -> int | None: ...


class LocalPublisher:
    """Record validated publications and optionally resolve a local demo market."""

    def __init__(self, market_resolver: MarketResolver | None = None) -> None:
        self.market_resolver = market_resolver
        self.publications: dict[str, ProofOfOmen] = {}

    def publish(self, manifest: ProofOfOmen) -> PublicationReceipt:
        existing = self.publications.get(manifest.manifest_hash)
        if existing is None:
            self.publications[manifest.manifest_hash] = manifest
        resolved_market_id = (
            self.market_resolver.resolve_from_omen(manifest) if self.market_resolver else None
        )
        return PublicationReceipt(
            adapter="local",
            publication_id=f"local:{manifest.manifest_hash}",
            chamber_id=manifest.chamber_id,
            sequence=manifest.omen_sequence,
            resolved_market_id=resolved_market_id,
        )


TransactionSender = Callable[[dict[str, Any]], str]


class EvmPublisher:
    """Dependency-injected boundary for a signer/provider owned by deployment code.

    The core package deliberately does not hold private keys or claim that a transaction
    was submitted. A configured caller supplies a real transaction sender and receives
    the typed OmenPublisher call intent below.
    """

    def __init__(
        self,
        chain_id: int,
        contract_address: str,
        sender: TransactionSender,
    ) -> None:
        if chain_id <= 0 or not contract_address or sender is None:
            raise ValueError("EVM publisher requires chain, contract, and sender")
        self.chain_id = chain_id
        self.contract_address = contract_address
        self.sender = sender

    def publish(self, manifest: ProofOfOmen) -> PublicationReceipt:
        intent = {
            "chain_id": self.chain_id,
            "to": self.contract_address,
            "method": "publish(bytes32,bytes32,uint64,uint8,uint8,uint64,bytes32,bytes32)",
            "arguments": {
                "chamber_id": manifest.chamber_id,
                "creature_id": manifest.creature_id,
                "sequence": manifest.omen_sequence,
                "omen_value": manifest.omen_value,
                "behavior_type": manifest.behavior_type,
                "observed_at": manifest.observed_at_ms // 1_000,
                "ruleset_hash": manifest.omen_ruleset_hash,
                "provenance_hash": manifest.manifest_hash,
            },
        }
        transaction_hash = self.sender(intent)
        if not transaction_hash:
            raise RuntimeError("transaction sender returned no hash")
        return PublicationReceipt(
            adapter="evm",
            publication_id=transaction_hash,
            chamber_id=manifest.chamber_id,
            sequence=manifest.omen_sequence,
        )
