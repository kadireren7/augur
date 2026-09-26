# Augur Architecture

## Status and principles

Augur has a tested local **M1–M4 core**. The vision/provenance and oracle modules run in Python, and the protocol/Next Omen market contracts run in Foundry. The E2E harness uses a local publication and market adapter rather than an EVM node. No contract is deployed to Monad, and no hosted sponsor integration is represented as active.

The architecture follows four principles:

1. Separate raw detection, behavior interpretation, Omen mapping, and market settlement.
2. Commit integrity-critical provenance onchain while keeping large or private content offchain.
3. Make every market transition deterministic, bounded in time, and replayable from events.
4. Treat a failed or uncertain input as a pause or cancellation condition, never permission to invent an outcome.

## High-level architecture

```text
Approved camera / stream
          |
          v
   Vision module  ----> Offchain evidence store
          |                    |
  observations + behaviors    | content hashes / URIs
          v                    |
   Oracle module <-------------+
          |
   validated Omen + provenance commitment
          v
 Monad contracts <----> External price data / workflow inputs
          |
          v
  Envio indexer ----> Query layer ----> Web app
          ^                                |
          +------ authoritative events     +-- offchain chat / reactions
```

The diagram shows the target deployed topology. Its local equivalents exist for vision, provenance, oracle validation, publication journaling, and market cycling; hosted storage, Monad submission, indexing, and the web app remain undeployed.

## End-to-end data flow

1. An approved Chamber source produces a timestamped video segment.
2. The vision module hashes the segment and emits structured observations.
3. A pinned behavior ruleset interprets a temporal set of observations.
4. A pinned Omen ruleset maps an eligible behavior to an Omen.
5. The oracle module assembles and validates a Proof of Omen manifest.
6. The manifest is stored offchain; its hash, event fields, ruleset version, and sequence number are submitted to Monad.
7. Contracts verify publisher authorization and ordering, record the Omen, and transition any eligible market.
8. Market settlement may combine the published Omen with declared price data or battle scoring inputs.
9. Envio indexes contract events into query-friendly Chamber, market, battle, and Chronicle views.
10. The web app reads indexed views for speed, checks direct contract state for critical actions, and submits user transactions through the configured wallet/RPC path.

Every submission must be idempotent. Source segment IDs, Omen sequence numbers, market IDs, and provenance hashes prevent duplicate processing across retries.

## Responsibility split

### Offchain

- Video capture, streaming, segment storage, and playback.
- Computer-vision inference and confidence calculation.
- Temporal behavior interpretation and diagnostic traces.
- Proof of Omen artifact assembly and evidence availability.
- Oracle workflow execution and transaction submission.
- Chat, reactions, moderation, presence, and rate limiting.
- Indexing, derived leaderboard views, search, and analytics.
- Private operational data, credentials, logs, and alerting.

### Onchain

- Creature and Chamber identifiers and status.
- Authorized oracle publishers and active configuration commitments.
- Ruleset/model version commitments needed for auditability.
- Omen ordering, compact Omen data, and provenance hashes.
- Market parameters, prediction positions, lifecycle, resolution, cancellation, and claims.
- Battle configuration and final result commitments.
- Immutable events for downstream consumers.

Onchain code must not pretend to verify pixels. It verifies authorization, timing, sequencing, configuration, and cryptographic commitments around an offchain computation.

## Modules

### `vision/`

The vision package currently accepts controlled JSON centroid trajectories and Chamber configuration. It produces:

- normalized segment metadata and a source hash;
- timestamped detections with labels, geometry or state, and confidence;
- temporal behavior candidates with supporting detection references;
- model and preprocessing versions; and
- diagnostics for rejected or ambiguous candidates.

The engine implements zone occupancy/entry/exit, directional movement, inactivity, confidence rejection, conflict rejection, debounce, cooldown, and monotonic Chamber sequences. Hamster, Fish, and Turtle fixtures have separate timing/movement parameters. A real video-to-centroid adapter remains planned. Creature-specific thresholds and cooldowns belong to versioned rules, not hidden UI logic. This module never publishes directly to contracts.

### `oracle/`

The oracle service is the policy and provenance boundary between perception and contracts. It currently:

- validates Chamber and creature authorization, freshness, and sequence monotonicity;
- verifies source, detection, ruleset, and manifest hashes rather than remapping or generating Omens;
- rejects stale, conflicting, malformed, or incomplete inputs;
- uses an executable local workflow validator and an explicit, unconfigured Chainlink CRE boundary;
- exposes a dependency-injected EVM transaction-intent publisher without holding signing keys;
- publishes idempotently through a SQLite attempt journal; and
- records failed attempts for safe retry.

Oracle signing keys must be isolated from the vision process. A compromised inference worker must not be sufficient to publish an Omen.

### `contracts/`

The implemented contracts are logically separated into:

- **Creature Registry:** stable creature IDs, metadata commitments, species, and status.
- **Room Registry:** Chamber IDs, creature binding, configuration commitment, oracle authorization, and lifecycle.
- **Omen Publisher:** ordered Omen records, provenance commitments, replay protection, and publisher permissions.
- **Market Factory / Market:** creation policy, outcome definitions, deadlines, prediction accounting, lock, resolve, cancel, refund, and claim.
- **Demo Token:** a permissionlessly mintable local/test token that must not be treated as a production asset.
- **Next Omen Market:** operator-created BUY/HOLD/SELL markets with time locks, canonical Omen resolution, cancellation/refund, pari-mutuel claims, and consumed-sequence protection.
- **Battle Coordinator (planned):** fixed competitors, scoring commitment, time window, and result or cancellation.

Next Omen uses a no-fee pari-mutuel payout. Upgrade policy, production governance, profitability/battle payouts, and a price-feed adapter remain later design decisions. Contract events are designed to reconstruct user-visible state without reading private storage or an operator database.

### `web/`

The planned web application contains:

- Chamber discovery and live Chamber views;
- clear live, delayed, replay, paused, and stale indicators;
- Omen and provenance timelines;
- market state, prediction submission, settlement, refund, and claim flows;
- The Pit battle view and Chronicle histories/standings;
- wallet onboarding and transaction status;
- offchain chat, reactions, moderation, and presence; and
- operator diagnostics separated from public views.

The UI may use indexed data for responsiveness but must not label a transaction or result final until the selected confirmation policy is met.

## Sponsor integration roles

No hosted sponsor integration is active. Current preparation and remaining work are explicit below.

### Envio

Envio remains **planned**. Registry, Omen, market, prediction, settlement, claim, refund, and lifecycle events are indexer-friendly. A later Envio project should materialize Chamber timelines, open-market views, user histories, activity summaries, and Chronicle standings. No indexer config or running indexer is included. Envio is not the settlement authority; if an indexed view disagrees with finalized contract state, contract state wins.

### Chainlink CRE

Chainlink CRE remains **unconfigured**. `oracle/workflow.py` defines its validation boundary and fails explicitly when the CRE adapter is selected without a real client; local tests use the deterministic fallback. A later real workflow may retrieve declared inputs, bind validation to a workflow version, and trigger publication or resolution. CRE does not make a low-quality camera source truthful, so source integrity and evidence commitments remain explicit trust boundaries.

### Alchemy

Alchemy remains **unconfigured**. Deployment and oracle RPC values come from environment variables, and the Python EVM publisher accepts a caller-supplied provider/signer function. This boundary can use an Alchemy Monad endpoint later without changing domain validation. Local tests make no RPC calls.

### Privy

Privy remains **planned for M5**; no SDK or UI wiring is present. Its boundary is the future web wallet/auth layer and must preserve explicit transaction consent and clear wallet ownership. Privy identity is not oracle authority, and chat identity must remain separate from market resolution permissions.

## High-level event schemas

The deployed contract address/release identifies the current schema version; indexed identifiers are used for common query paths. The implemented high-level payloads are:

```text
CreatureRegistered
  creatureId, species, metadataHash, owner, operator

ChamberRegistered
  chamberId, creatureId, configHash, rulesetHash, publisher

ChamberStatusChanged / ChamberConfigurationChanged
  chamberId, previousStatus/newStatus or configHash/rulesetHash/publisher

OmenPublished
  chamberId, creatureId, sequence, omenType, behaviorType,
  observedAt, rulesetHash, provenanceHash, publisher

MarketOpened
  marketId, chamberId, marketType, opensAt, locksAt,
  resolutionDeadline, minOmenSequence, maxOmenSequence

PredictionPlaced
  marketId, participant, outcome, amountOrShares

MarketLocked
  marketId, lockedAt

MarketResolved
  marketId, outcome, resolutionRef, resolvedAt

MarketCancelled
  marketId, reasonCode, cancelledAt

Claimed / Refunded
  marketId, participant, amount

BattleOpened (planned)
  battleId, creatureA, creatureB, startsAt, endsAt, scoringHash

BattleResolved (planned)
  battleId, result, pnlA, pnlB, resolutionRef
```

Sensitive data, long strings, and large arrays should not appear in events. Stable reason codes and hashes are preferable to mutable prose.

## Security boundaries

- **Physical source boundary:** cameras and operators can be manipulated. Approved sources, timestamps, segment hashes, liveness checks, and audit evidence reduce but do not eliminate this risk.
- **Inference boundary:** models can misclassify. Version pinning, confidence thresholds, test corpora, rejection states, and recorded outputs make errors visible.
- **Oracle boundary:** the publisher can submit privileged facts. Key isolation, least-privilege authorization, workflow validation, sequence checks, rate limits, pause controls, and later decentralization constrain damage.
- **Contract boundary:** contracts control funds and final lifecycle state. Access control, checks-effects-interactions, bounded inputs, replay protection, invariant tests, pause/cancel design, and independent review are required.
- **Price-data boundary:** stale or incorrect prices corrupt PnL. Markets pin their price source and freshness rules and cancel when inputs are invalid.
- **Indexing/RPC boundary:** derived data can lag or be wrong. The UI exposes freshness and verifies critical state against contracts.
- **Identity/social boundary:** account compromise or chat abuse must not affect oracle or settlement roles. Authentication, moderation, and protocol permissions remain separated.
- **Evidence-storage boundary:** a hash ensures integrity but not availability or public access. Retention and access policies must be explicit.
- **Administrative boundary:** any pause, publisher rotation, upgrade, or treasury capability must be narrow, visible, and documented.

## Provenance flow

```text
source segment bytes
  -> segment hash + capture metadata
  -> detection records + model version
  -> detection-output hash
  -> interpreted behavior + behavior ruleset version
  -> Omen + Omen ruleset version + Chamber sequence
  -> Proof of Omen manifest hash
  -> onchain OmenPublished event
  -> optional market resolution reference
```

The manifest links each arrow and records rejected checks as well as accepted results. A verifier should be able to retrieve permitted evidence, recompute hashes, confirm the pinned mapping, and match the publication transaction. If evidence is private or unavailable, the interface must say so; the commitment alone is not proof that the underlying behavior occurred.

## How Monad performance is used

Augur's workload is a repeating state machine rather than a single settlement transaction:

```text
OPEN -> many concurrent predictions -> LOCK -> publish eligible event -> RESOLVE -> CLAIM
  \_____________________________________________________________________________/
                         repeated across many Chambers
```

The proposed design uses Monad for frequent short-duration markets, concurrent user predictions, ordered Omen publication, rapid locks and resolutions, and continuously updated battle state. Low-latency confirmations improve the live experience; high throughput allows multiple Chambers to cycle independently without batching every user action into an offchain operator ledger. Contracts and clients must still handle nonce management, retries, reorganization risk, finality policy, and load spikes. Performance claims will be measured during later milestones rather than assumed at M0.

## Intentionally not stored onchain

- Raw video, audio, thumbnails, or full source segments.
- Frames, bounding boxes, embeddings, tensors, and verbose inference logs.
- Full Proof of Omen manifests; only compact fields and integrity commitments belong onchain.
- Chat messages, reactions, presence, moderation queues, and notification state.
- Personally identifiable information, Privy account details, IP addresses, or session tokens.
- API keys, oracle private keys, operational logs, alert payloads, or internal configuration secrets.
- Large creature metadata and media; contracts retain hashes or content references where needed.
- Derived feeds, search results, cached leaderboards, and analytics that can be reconstructed from events.

Keeping this data offchain limits cost, privacy exposure, and permanent storage. Anything required for settlement must still be represented by deterministic parameters, an authenticated input, or an immutable commitment onchain.
