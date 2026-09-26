# Augur

Augur is a hackathon project that turns observable animal behavior into verifiable onchain events and short, real-time prediction markets on Monad. A live creature room is a **Chamber**; a detected physical action becomes a **Behavior**; and a ruleset can map that behavior into an **Omen** such as BUY, HOLD, or SELL.

Augur has a tested local **M1–M6 product**: deterministic fixture-based vision, Proof of Omen provenance, EVM-compatible protocol and market contracts, an idempotent oracle bridge, functional Live Chambers, offchain social features, deterministic creature battles, and Chronicle views. Nothing is deployed to Monad, and hosted sponsor services remain unconfigured.

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
- A responsive Next.js application with Chamber discovery, fixture playback, provenance inspection, market actions, transaction feedback, chat, reactions, The Pit, Chronicle, and a health view.
- A deterministic battle engine and compact onchain `BattleCoordinator` result commitment.
- A real Privy SDK path with an explicit unauthenticated local fallback, typed viem contract writes, RPC health and wrong-chain checks, and environment-driven Alchemy-compatible RPC configuration.
- An Envio HyperIndex project whose code generation and typed handlers cover registry, Chamber, Omen, market, claim/refund, and battle events.

Planned for M7 and later, or still pending external configuration:

- Real live creature media and a production media/centroid adapter; the UI currently says `FIXTURE · NOT LIVE`.
- Monad deployment, real contract addresses, a hosted Envio endpoint, Privy credentials, and execution through a configured Chainlink CRE transport.
- Next-trade-profitable markets and battle-winner markets; only their extensible type definitions exist today.
- Guarded permissionless Chamber creation and third-party event consumption.

## Architecture summary

Augur is separated into five modules:

- `vision/` processes deterministic trajectory fixtures into observations, behaviors, Omens, and provenance manifests. A production video adapter remains planned.
- `oracle/` validates manifests and policy, journals publication attempts, supports local publication and deterministic battle replay, and exposes configured-client boundaries for EVM and Chainlink CRE.
- `contracts/` contains Foundry-tested registries, Omen publication, a demo token, the Next Omen lifecycle, and battle result commitments.
- `indexer/` contains the Envio schema, local code-generation configuration, and typed event projections.
- `web/` contains the functional Next.js product layer and its local/contract/indexed data boundaries.

Privy's SDK path and typed transaction signing boundary are implemented, but no app ID has been configured. Alchemy-compatible RPC configuration needs only an endpoint; no RPC was supplied during verification. Envio code generation and handler type-checking work locally, but the committed addresses are local placeholders and no hosted indexer is running. The CRE request/response binding is implemented with a local validator fallback, but no real CRE client or workflow execution is claimed.

## Milestone status

**Current: M5 and M6 complete as a functional local product layer.** The Chamber and social flows run in the web application, while battles and Chronicle are reproducible from declared fixture and scoring inputs. Contract-mode writes, indexed reads, and Privy onboarding are wired but activate only when their real configuration exists. Monad deployment, hosted indexing, real CRE execution, and live media ingestion remain outstanding.

## Developer workflow

Prerequisites are Python 3.11+, Foundry with Solidity 0.8.28, Node.js 22+, and pnpm. Docker and an Envio API token are needed only to run the local HyperIndex service.

```bash
# Install Python, web, and indexer dependencies
make install

# Run everything
make test

# Run individual suites
make test-vision
make test-oracle
make test-contracts
make test-web
make test-indexer

# Run the fixture-to-market local demo
make demo

# Run the functional web app at http://localhost:3000
make dev-web

# Compile Python and check Solidity formatting
make lint

# Produce the production web build
make build-web
```

With no environment variables, the web app uses clearly labeled in-memory fixture/local-demo state. Copy `web/.env.example` to `web/.env.local` to enable optional runtime boundaries. `NEXT_PUBLIC_PRIVY_APP_ID` enables the real Privy provider. RPC and contract variables enable typed wallet writes only for markets reported as contract-backed; local mode never emits a transaction hash. `ENVIO_GRAPHQL_URL` selects indexed reads and does not silently fall back on request failure.

The Envio project is in `indexer/`. Its committed chain and addresses are local code-generation placeholders. After a deployment, replace them in `indexer/config.yaml`, put `ENVIO_API_TOKEN` in the ignored `indexer/.env`, and run `pnpm dev` from that directory. Docker is required for the local database and GraphQL service.

For an environment-driven deployment, copy `.env.example`, provide a Monad-compatible RPC URL and deployer key, then run:

```bash
cd contracts
forge script script/Deploy.s.sol:DeployAugur --rpc-url "$MONAD_RPC_URL" --broadcast
```

The deployment command has not been run against Monad. `DemoToken` has permissionless minting and is strictly for tests and demonstrations.

## Current limitations

- Vision consumes controlled JSON centroid trajectories; it does not yet extract centroids from arbitrary video.
- The executable E2E uses the local publisher and local market model. The same lifecycle is contract-tested, but the Python harness is not yet wired to a local EVM node.
- Privy requires a real app ID; no authenticated session was exercised. Alchemy requires a Monad RPC endpoint; no external RPC health check was exercised.
- Envio handlers are generated and type-checked, but no deployed addresses, API token, Docker-backed local service, or hosted endpoint was available.
- The CRE adapter validates response binding, but no real CRE SDK transport or workflow execution was available.
- Only Next Omen is implemented as a market. Profitability and battle markets remain planned.
- Battle scoring runs deterministically offchain and commits final results through `BattleCoordinator`; its publisher remains a trust boundary. A battle-winner prediction market is not implemented.
- Web local state, chat, and reactions are in memory and reset when the server restarts.
- Contracts have not received an external security review and must not hold production funds.

## Development roadmap

- **M0 — Foundation (complete):** product specification, terminology, architecture, and repository structure.
- **M1 — Vision Engine (local core complete):** deterministic controlled-fixture tracking with a small behavior vocabulary and zone/motion detection.
- **M2 — Proof of Omen (local core complete):** provenance linking source hash, detections, behavior, ruleset version, Omen, and verification artifacts.
- **M3 — Monad Protocol (contracts complete; deployment pending):** Creature Registry, allowlisted Room Registry, Omen publication, authorization, sequencing, replay protection, and core events.
- **M4 — Real-time Market Engine (local core complete):** test-token Next Omen markets, oracle validation, local repeated-cycle demo, and an unconfigured CRE boundary. Monad deployment remains pending.
- **M5 — Live Chambers (functional local product complete):** Chamber discovery/detail/provenance, fixture media, local and configured contract market actions, Privy/viem/RPC boundaries, chat, reactions, health diagnostics, and explicit mode/error states.
- **M6 — Battles & Chronicle (functional local product complete):** deterministic virtual PnL replay, onchain result commitments, The Pit, event-derived standings/history, and a generated/type-checked Envio indexing project. Hosted indexing remains pending deployment.
- **M7 — Permissionless Chambers:** prototype guarded user-created creature rooms with constrained rulesets, source verification, anti-spam controls, and registration flows.
- **M8 — Monad Showcase / Speed Mode:** create the hackathon demo mode with rapid repeated market cycles, concurrent predictions, Omen publication, settlement, and visible transaction/event activity to demonstrate why Monad matters.

Roadmap items may change after prototype testing, sponsor integration validation, animal-welfare review, and security review.
