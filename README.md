# Augur

Augur is a hackathon project that turns observable animal behavior into verifiable onchain events and short, real-time prediction markets on Monad. A live creature room is a **Chamber**; a detected physical action becomes a **Behavior**; and a ruleset can map that behavior into an **Omen** such as BUY, HOLD, or SELL.

Augur has a tested local **M1–M8 product**: deterministic fixture-based vision, Proof of Omen provenance, EVM-compatible protocol and market contracts, an idempotent oracle bridge, Live Chambers, persistent social features, deterministic creature battles, Chronicle, guarded Chamber creation, and a concurrent speed showcase. All six contracts are deployed and bytecode/wiring/smoke-verified on Monad testnet chain 10143, the real smoke lifecycle has been indexed through Envio and consumed by the web indexed-data adapter, and Privy authentication plus a real wallet-signed Augur contract transaction have been verified.

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
- Guarded Chamber creation with wallet ownership, exact ruleset allowlisting, bounded metadata and thresholds, safe source references, lifecycle controls, and per-owner limits.
- SQLite persistence for created Chambers, chat, and reactions; protocol and market truth remains onchain/indexed.
- A `/showcase` harness for independent repeated cycles across two Chambers, measured local timings, and bounded prediction-load tests.
- Deployment verification and the full split smoke lifecycle have passed on Monad testnet. Local Envio indexing against chain 10143 verified `CreatureRegistered`, Chamber registration and activation, `OmenPublished`, `MarketOpened`, `PredictionPlaced`, `MarketLocked`, `MarketResolved`, and `Claimed` from the real deployment.

Still pending external configuration or later work:

- Real live creature media and a production media/centroid adapter; the UI currently says `FIXTURE · NOT LIVE`.
- A hosted Envio endpoint and Chainlink CRE deployment access.
- Next-trade-profitable markets and battle-winner markets; only their extensible type definitions exist today.
- A production upload pipeline and browser camera capture; current user-created sources are safe references/adapters, not server-side arbitrary URL fetches.

## Architecture summary

Augur is separated into five modules:

- `vision/` processes deterministic trajectory fixtures into observations, behaviors, Omens, and provenance manifests. A production video adapter remains planned.
- `oracle/` validates manifests and policy, journals publication attempts, supports local publication and deterministic battle replay, and exposes configured-client boundaries for EVM and Chainlink CRE.
- `contracts/` contains Foundry-tested registries, Omen publication, a demo token, the Next Omen lifecycle, and battle result commitments.
- `indexer/` contains the Envio schema, local code-generation configuration, and typed event projections.
- `web/` contains the functional Next.js product layer and its local/contract/indexed data boundaries.

Privy's SDK path is configured and verified for authentication, embedded/connected wallet availability, Monad Testnet chain 10143, and EIP-1193 signing. The live proof was a 1 AUGD `DemoToken.approve(NextOmenMarket, 1e18)` transaction, `0x0bf842f8992228d54da917523ce075aa930bad76888148ec09b637ff17d5584a`, confirmed in block `67812342`. The server-side Alchemy Monad RPC path is verified against chain 10143 for block, bytecode, contract read, receipt, and event-log queries; health diagnostics report the active provider and fall back only to `MONAD_RPC_URL` when Alchemy is unavailable. Envio code generation and typechecking pass against the committed Monad configuration; local Envio indexed the real Monad testnet smoke data, GraphQL returned the expected entities and resolved BUY outcome, and the web indexed-data adapter consumed that live GraphQL result. No hosted indexer is running. The real CRE SDK workflow under `cre/` validates provenance-bound Omen requests and deterministically prepares the Monad `OmenPublisher.publish(...)` call; official CLI build, authenticated simulation, rejection cases, and focused tests pass. Deployment remains blocked because the CRE organization does not have deployment access.

## Milestone status

**Current: M7 and M8 are locally implemented and tested; the contract stack is deployed, smoke-verified, and locally indexed with Envio on Monad testnet.** User-created Chambers and social data persist in SQLite, contract mode uses guarded registry policy, and speed mode runs repeated independent Chamber cycles. The real Monad GraphQL-to-web indexed-data path and Privy login-to-wallet-to-contract-signing path passed. The real CRE workflow builds and simulates successfully through the authenticated official CLI, but deployment access, a hosted Envio endpoint, live media ingestion, and testnet permissionless/speed-mode exercises remain outstanding.

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

# Run the Envio service with the committed Monad testnet configuration
make dev-indexer

# Compile Python and check Solidity formatting
make lint

# Produce the production web build
make build-web
```

With no environment variables, the web app uses clearly labeled fixture/local-demo state and a local SQLite database at `web/.augur/augur.sqlite3`. Copy `web/.env.example` to `web/.env.local` to enable optional runtime boundaries. `NEXT_PUBLIC_PRIVY_APP_ID` enables the real Privy provider. RPC and contract variables enable typed wallet writes only for contract-backed operations; local mode never emits a transaction hash. Server RPC selection prefers `ALCHEMY_MONAD_RPC_URL`, then `MONAD_RPC_URL`; the browser uses the deliberately public `NEXT_PUBLIC_MONAD_RPC_URL`. `ENVIO_GRAPHQL_URL` selects indexed reads and does not silently fall back on request failure.

The Envio project is in `indexer/`. Its committed chain, start block, public RPC, and addresses target the verified Monad testnet deployment. Code generation and typechecking pass with this configuration. Put any required Envio token in the ignored `indexer/.env` and run `pnpm dev`; Docker is required for the local database and GraphQL service.

For an environment-driven deployment, copy `.env.example`, provide a Monad-compatible RPC URL and deployer key, then run:

```bash
cd contracts
forge script script/Deploy.s.sol:DeployAugur --rpc-url "$MONAD_RPC_URL" --broadcast
```

The deployment and verification commands have completed successfully on Monad testnet chain 10143. `DemoToken` has permissionless minting and is strictly for tests and demonstrations. Public deployment blocks and transaction hashes are recorded under `deployments/`.
Use `VerifyDeployment.s.sol` to recheck deployment wiring, then use `SmokeSetup.s.sol` and `SmokeResolve.s.sol` as documented in `deployments/README.md`. Permissionless registration is disabled by default and must be enabled only after exact ruleset commitments are reviewed and allowlisted.

## Current limitations

- Vision consumes controlled JSON centroid trajectories; it does not yet extract centroids from arbitrary video.
- Python E2E uses the local publisher and market model; Monad smoke verification covers the real Solidity registry-to-claim lifecycle, while the indexed web read path has been exercised locally.
- Privy authentication, embedded/connected wallet availability, Monad Testnet chain detection, reconnect, and a real 1 AUGD DemoToken approval were exercised. The configured server-only Alchemy Monad RPC and generic Monad fallback health paths were exercised without exposing either endpoint to the browser bundle.
- Envio was exercised locally with Docker and Anvil, and its Monad configuration passes code generation/typechecking; no hosted endpoint is running.
- The CRE SDK workflow builds and authenticated official simulation deterministically validates/prepares Omen publication requests. Deployment access is not enabled for the CRE organization, so no live workflow ID is claimed.
- Only Next Omen is implemented as a market. Profitability and battle markets remain planned.
- Battle scoring runs deterministically offchain and commits final results through `BattleCoordinator`; its publisher remains a trust boundary. A battle-winner prediction market is not implemented.
- Created Chambers, chat, and reactions persist in local SQLite. Seed fixture markets/showcase counters remain process-local, and production deployment needs a managed database adapter.
- Uploaded clips and webcam capture are adapter boundaries only; the server rejects arbitrary paths and URLs and does not yet extract centroids from video.
- Contracts have not received an external security review and must not hold production funds.

## Development roadmap

- **M0 — Foundation (complete):** product specification, terminology, architecture, and repository structure.
- **M1 — Vision Engine (local core complete):** deterministic controlled-fixture tracking with a small behavior vocabulary and zone/motion detection.
- **M2 — Proof of Omen (local core complete):** provenance linking source hash, detections, behavior, ruleset version, Omen, and verification artifacts.
- **M3 — Monad Protocol (contracts deployed and verified):** Creature Registry, allowlisted Room Registry, Omen publication, authorization, sequencing, replay protection, and core events are live on Monad testnet chain 10143.
- **M4 — Real-time Market Engine (testnet smoke verified):** the DemoToken Next Omen lifecycle passed mint, approve, open, predict, Omen publication, resolve, and claim on Monad testnet; the optional CRE workflow build and authenticated deterministic simulation are verified, while deployment access remains pending.
- **M5 — Live Chambers (functional local product complete):** Chamber discovery/detail/provenance, fixture media, local and configured contract market actions, Privy/viem/RPC boundaries, chat, reactions, health diagnostics, and explicit mode/error states.
- **M6 — Battles & Chronicle (functional local product complete):** deterministic virtual PnL replay, onchain result commitments, The Pit, event-derived standings/history, and a generated/type-checked Envio indexing project. Hosted indexing remains pending deployment.
- **M7 — Permissionless Chambers (local and contract code complete; testnet pending):** constrained rulesets and source references, owner lifecycle, exact onchain ruleset allowlisting, per-owner limits, SQLite persistence, and local/Privy transaction paths.
- **M8 — Monad Showcase / Speed Mode (local complete; testnet measurements pending):** configurable repeated cycles, two independent Chambers, concurrent prediction operations, event stream, and measured timings explicitly labeled local.

Roadmap items may change after prototype testing, sponsor integration validation, animal-welfare review, and security review.
