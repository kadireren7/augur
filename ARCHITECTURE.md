# Augur Architecture

## Status and principles

Augur is at **M0**. This document describes a proposed architecture; none of the runtime modules or sponsor integrations are implemented yet.

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

The diagram shows intended responsibilities, not currently deployed services.

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

The planned vision service accepts an approved media segment and Chamber configuration. It should produce:

- normalized segment metadata and a source hash;
- timestamped detections with labels, geometry or state, and confidence;
- temporal behavior candidates with supporting detection references;
- model and preprocessing versions; and
- diagnostics for rejected or ambiguous candidates.

Inference must be deterministic where practical, or record enough version and environment information to explain variation. Creature-specific thresholds and cooldowns belong to versioned rules, not hidden UI logic. This module never publishes directly to contracts.

### `oracle/`

The planned oracle service is the policy and provenance boundary between perception and contracts. It should:

- validate Chamber, source, model, and ruleset authorization;
- verify timestamps, continuity, confidence, cooldowns, and deduplication;
- deterministically map behaviors to Omens;
- build and hash the Proof of Omen manifest;
- coordinate any required workflow attestations;
- simulate contract calls before submission;
- publish idempotently and monitor confirmation; and
- pause on stale, conflicting, or incomplete inputs.

Oracle signing keys must be isolated from the vision process. A compromised inference worker must not be sufficient to publish an Omen.

### `contracts/`

The proposed contracts are logically separated into:

- **Creature Registry:** stable creature IDs, metadata commitments, species, and status.
- **Room Registry:** Chamber IDs, creature binding, configuration commitment, oracle authorization, and lifecycle.
- **Omen Publisher:** ordered Omen records, provenance commitments, replay protection, and publisher permissions.
- **Market Factory / Market:** creation policy, outcome definitions, deadlines, prediction accounting, lock, resolve, cancel, refund, and claim.
- **Battle Coordinator:** fixed competitors, scoring commitment, time window, and result or cancellation.

The exact contract decomposition, upgrade policy, governance, payout design, and price-feed adapter remain design decisions for later milestones. Contract events should be sufficient to reconstruct user-visible state without reading private storage or an operator database.

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

All integrations in this section are planned and require prototype validation.

### Envio

Envio is the proposed indexing layer for registry, Omen, market, prediction, settlement, claim, and battle events. It should materialize Chamber timelines, open-market views, user histories, volume/activity summaries, and Chronicle standings. Envio is not the settlement authority; if an indexed view disagrees with finalized contract state, contract state wins.

### Chainlink CRE

Chainlink CRE is the proposed coordination layer for the oracle workflow: retrieving declared inputs, applying validation steps, binding outputs to a versioned workflow, and triggering onchain publication or market resolution. It may also coordinate external price-data inputs used by profitability and battle rules. CRE does not make a low-quality camera source truthful, so source integrity and evidence commitments remain explicit trust boundaries.

### Alchemy

Alchemy is the proposed Monad RPC and transaction-observability provider for contract deployment, oracle submissions, web reads, transaction tracking, and operational monitoring. The design should support retry and provider fallback so one RPC response is not treated as an independent oracle truth.

### Privy

Privy is the proposed authentication and wallet-onboarding layer for the consumer app. It should reduce first-use friction while preserving explicit transaction consent and clear wallet ownership. Privy identity is not oracle authority, and chat identity must remain separate from market resolution permissions.

## High-level event schemas

Exact ABI types and field packing will be decided with contract implementation. Events should include a schema version and indexed identifiers where useful.

```text
CreatureRegistered
  creatureId, species, metadataHash, status, version

ChamberConfigured
  chamberId, creatureId, configHash, rulesetHash, publisher, status, version

OmenPublished
  chamberId, creatureId, sequence, omenType, behaviorType,
  observedAt, rulesetHash, provenanceHash, publisher

MarketOpened
  marketId, chamberId, marketType, outcomesHash, opensAt, locksAt,
  resolutionDeadline, configHash

PredictionPlaced
  marketId, participant, outcome, amountOrShares

MarketLocked
  marketId, lockedAt

MarketResolved
  marketId, outcome, resolutionRef, resolvedAt

MarketCancelled
  marketId, reasonCode, cancelledAt

Claimed
  marketId, participant, amount

BattleOpened
  battleId, creatureA, creatureB, startsAt, endsAt, scoringHash

BattleResolved
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
