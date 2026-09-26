# Augur

Augur is a hackathon project that turns observable animal behavior into verifiable onchain events and short, real-time prediction markets on Monad. A live creature room is a **Chamber**; a detected physical action becomes a **Behavior**; and a ruleset can map that behavior into an **Omen** such as BUY, HOLD, or SELL.

Augur has a tested local **M1–M4 core**: deterministic fixture-based vision, Proof of Omen provenance, EVM-compatible protocol contracts, a test-token Next Omen market, an idempotent oracle bridge, and a repeated-cycle developer demo. Nothing is deployed to Monad, and the consumer application and hosted sponsor integrations are not implemented yet.

## Problem and concept

Livestream interactions are usually passive, while onchain prediction products often depend on slow or infrequent external events. Augur combines an entertaining live feed with a transparent event pipeline so viewers can follow how a physical observation becomes a market-resolving fact.

The central integrity artifact is the **Proof of Omen**: a provenance chain connecting a source clip or hash, a model detection, an interpreted behavior, a versioned ruleset, an Omen, and its onchain publication. It is designed to make an outcome auditable without putting video or chat data onchain.

## Why Monad

Augur is designed around repeated, time-sensitive interactions rather than treating Monad as a passive deployment destination. Chambers may run many short-lived markets at once, with frequent prediction transactions and rapid open, lock, and resolve cycles. Monad's high-throughput, low-latency execution model is a fit for:

- frequent market creation and settlement;
- many concurrent prediction actions across Chambers;
- rapid publication of Omen commitments and resolutions;
- low-friction, repeated participation during a live session; and
- responsive indexing of the resulting event stream.

## Current capabilities

Implemented and tested locally:

- Synthetic Hamster, Fish, and Turtle trajectories with deterministic zone, movement, dwell, debounce, cooldown, confidence, and conflict handling.
- Canonical Proof of Omen manifests with stable hashing, JSON round trips, and source/detection/ruleset verification.
- Creature Registry, allowlisted Room Registry, and ordered Omen publication contracts.
- Test-token Next Omen markets with open, lock, resolve, cancel/refund, claim, replay protection, and pari-mutuel payouts.
- SQLite-backed oracle publication attempts, idempotent retries, local publication, and an EVM transaction-intent boundary.
- A local harness that resolves repeated markets and independent Chambers without external services.

Planned for M5 and later:

- Live creature media, Chamber UI, Privy onboarding, and offchain chat/reactions.
- **The Pit** creature battles and virtual PnL scoring.
- **Chronicle** history and standings backed by Envio indexing.
- Next-trade-profitable markets and battle-winner markets; only their extensible type definitions exist today.
- Guarded permissionless Chamber creation and third-party event consumption.

## Architecture summary

Augur is separated into four modules:

- `vision/` processes deterministic trajectory fixtures into observations, behaviors, Omens, and provenance manifests. A production video adapter remains planned.
- `oracle/` validates manifests and policy, journals publication attempts, supports local publication, and exposes configuration boundaries for EVM and Chainlink CRE clients.
- `contracts/` contains Foundry-tested registries, Omen publication, a demo token, and the Next Omen market lifecycle.
- `web/` is reserved for the M5 consumer application and currently contains no implementation.

Envio, Chainlink CRE, Alchemy, and Privy remain planned integrations. The repository currently provides indexer-friendly events, an explicit CRE adapter boundary with a local fallback, environment-driven RPC/deployment configuration, and a documented future wallet boundary. No hosted sponsor integration is claimed as complete.

## Milestone status

**Current: M4 core complete locally.** M1–M4 behavior is implemented and covered by deterministic Python and Foundry tests. The local demo does not submit an EVM transaction; Solidity behavior is proven separately in Foundry. Monad deployment, hosted workflow execution, indexing, and the polished consumer experience remain outstanding.

## Developer workflow

Prerequisites are Python 3.11+ and Foundry with Solidity 0.8.28 available. The Python core has no runtime package dependency.

```bash
# Optional editable Python package install; no runtime dependencies are downloaded
python3 -m pip install -e .

# Fetch/compile the configured Solidity compiler if it is not already available
cd contracts && forge build && cd ..

# Run everything
make test

# Run individual suites
make test-vision
make test-oracle
make test-contracts

# Run the fixture-to-market local demo
make demo

# Compile Python and check Solidity formatting
make lint
```

For an environment-driven deployment, copy `.env.example`, provide a Monad-compatible RPC URL and deployer key, then run:

```bash
cd contracts
forge script script/Deploy.s.sol:DeployAugur --rpc-url "$MONAD_RPC_URL" --broadcast
```

The deployment command has not been run against Monad. `DemoToken` has permissionless minting and is strictly for tests and demonstrations.

## Current limitations

- Vision consumes controlled JSON centroid trajectories; it does not yet extract centroids from arbitrary video.
- The executable E2E uses the local publisher and local market model. The same lifecycle is contract-tested, but the Python harness is not yet wired to a local EVM node.
- Chainlink CRE has an explicit adapter boundary only; Envio, Alchemy, and Privy are not connected.
- Only Next Omen is implemented as a market. Profitability and battle markets remain planned.
- Contracts have not received an external security review and must not hold production funds.

## Development roadmap

- **M0 — Foundation (complete):** product specification, terminology, architecture, and repository structure.
- **M1 — Vision Engine (local core complete):** deterministic controlled-fixture tracking with a small behavior vocabulary and zone/motion detection.
- **M2 — Proof of Omen (local core complete):** provenance linking source hash, detections, behavior, ruleset version, Omen, and verification artifacts.
- **M3 — Monad Protocol (contracts complete; deployment pending):** Creature Registry, allowlisted Room Registry, Omen publication, authorization, sequencing, replay protection, and core events.
- **M4 — Real-time Market Engine (local core complete):** test-token Next Omen markets, oracle validation, local repeated-cycle demo, and an unconfigured CRE boundary. Monad deployment remains pending.
- **M5 — Live Chambers:** build the consumer experience: Chamber views, creature stream/video, current Omen, market interaction, Privy wallet onboarding, Alchemy infrastructure, and offchain live chat/reactions.
- **M6 — Battles & Chronicle:** implement creature-vs-creature battles, deterministic virtual PnL scoring, standings/history, and Envio indexing/query views.
- **M7 — Permissionless Chambers:** prototype guarded user-created creature rooms with constrained rulesets, source verification, anti-spam controls, and registration flows.
- **M8 — Monad Showcase / Speed Mode:** create the hackathon demo mode with rapid repeated market cycles, concurrent predictions, Omen publication, settlement, and visible transaction/event activity to demonstrate why Monad matters.

Roadmap items may change after prototype testing, sponsor integration validation, animal-welfare review, and security review.
