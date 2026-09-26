# Augur Product and Protocol Specification

## Status

This document defines intended product behavior and protocol rules. The repository now contains a tested local **M1–M4 core**: controlled-fixture vision, Proof of Omen generation and validation, protocol contracts, a test-token Next Omen market, and a local oracle/E2E harness. Live media ingestion, the consumer app, the other two market implementations, sponsor services, and Monad deployment remain planned.

## Goals

- Turn observable animal behavior into a clear, replayable sequence of Observation, Behavior, and Omen records.
- Make every published Omen traceable through a Proof of Omen.
- Support fast, short-lived prediction markets with deterministic lifecycle transitions and settlement.
- Create an entertaining live experience through Chambers, The Pit, and Chronicle.
- Establish stable creature and room identities that third-party applications can eventually consume.
- Use Monad's performance for frequent market cycles and concurrent participation.
- Protect animal welfare: the system observes normal activity and must not incentivize provoking, stressing, or harming an animal.

## Non-goals

- Claiming that animals understand markets, make financial decisions, or predict asset prices.
- Storing raw video, chat messages, reactions, or computer-vision tensors onchain.
- Treating a model output as unquestionable truth.
- Supporting arbitrary species, arbitrary user-created rules, or permissionless rooms in the MVP.
- Delivering production custody, regulated wagering, or mainnet real-money markets during the initial prototype.
- Guaranteeing profit, predictive accuracy, or uninterrupted livestream availability.

## Core entities

- **Creature:** a registered animal identity with a species, display metadata reference, status, and authorized Chambers.
- **Chamber:** a live creature room that binds a creature, approved media source, active ruleset, oracle authority, and market configuration.
- **Observation:** a timestamped raw detection from video, such as position, motion, zone occupancy, or pose confidence.
- **Behavior:** a rules-based interpretation of one or more observations, such as entering a marked zone or remaining still for a threshold.
- **Omen:** a behavior mapped by a versioned ruleset into a market signal or event, initially BUY, HOLD, or SELL where applicable.
- **Proof of Omen:** the provenance manifest linking source evidence, detections, behavior interpretation, ruleset, Omen, and onchain event.
- **Market:** a time-bounded prediction instance with defined outcomes, open and lock times, resolution source, and terminal state.
- **Prediction:** a participant's onchain position in one outcome of a market.
- **Battle:** a fixed-window comparison of two creatures using the same published scoring rules.
- **Chronicle:** the indexed history and standings view derived from protocol events.

Identifiers must remain stable. Mutable display data should be referenced by content-addressed or otherwise integrity-checkable metadata where practical. Versioned rulesets must not change for an already-open market.

## Chamber behavior

A Chamber has a lifecycle of `DRAFT`, `ACTIVE`, `PAUSED`, and `CLOSED`.

- `DRAFT`: configuration exists but no observations can produce market-resolving Omens.
- `ACTIVE`: the approved feed is monitored and eligible Omens may be published.
- `PAUSED`: new markets and Omens stop; an operator may investigate feed, model, oracle, or welfare issues.
- `CLOSED`: the room is retired and cannot reopen without creating a new version or room.

The UI should show the creature, live or replay-labeled media, current market phase, latest Omen, ruleset version, oracle freshness, and a path to provenance. It must not present stale footage as live. A feed outage or stale oracle heartbeat must prevent dependent markets from continuing normally.

## Observation → Behavior → Omen pipeline

1. **Capture:** an approved feed yields a bounded source segment. The segment receives a timestamp, Chamber identifier, and integrity hash.
2. **Observe:** the vision module emits detections with model version, frame or time range, labels, and confidence values.
3. **Interpret:** a creature-specific behavior ruleset combines detections over time and emits a behavior only when thresholds and cooldowns pass.
4. **Map:** the pinned Omen ruleset deterministically maps the eligible behavior to an Omen type and value.
5. **Validate:** the oracle checks source continuity, timing, confidence, deduplication, ruleset version, and Chamber authorization.
6. **Commit and publish:** a provenance commitment is anchored onchain with the Omen payload. Large evidence remains offchain.
7. **Consume:** contracts may lock or resolve an eligible market, while indexers update Chamber history and Chronicle.

Each stage should be independently inspectable. Low-confidence or contradictory observations must result in no Omen, not a guessed Omen.

## Proof of Omen

A Proof of Omen is a structured provenance manifest. At minimum it should contain or commit to:

- protocol, schema, and ruleset versions;
- Chamber and creature identifiers;
- source identifier, capture time range, and footage or segment hash;
- vision model identifier and detection-output hash;
- interpreted behavior type, parameters, confidence, and time range;
- Omen type, value, sequence number, and deterministic mapping result;
- oracle workflow or publisher identity and validation result;
- onchain network, transaction, and event references once published; and
- a content hash or URI for retrieving permitted offchain evidence.

The onchain contract verifies authorization, sequencing, and commitments; it does not re-run video inference. A valid commitment proves consistency with the submitted artifact, not that the camera, model, or operator was honest. Those trust limits must be visible to users.

## Market types

All markets have a declared opening time, locking condition or time, outcome set, resolution rule, maximum resolution delay, and cancellation/refund path.

### 1. Next Omen

Predict whether the next valid Omen in a Chamber will be `BUY`, `HOLD`, or `SELL`. Only an Omen published after the market opens and before its expiry is eligible. Sequence numbers prevent reuse. If no eligible Omen arrives before expiry, the market cancels.

### 2. Next trade profitable

Predict `YES` or `NO` for whether the next ruleset-defined creature trade produces positive PnL. The market configuration must pin the asset or price reference, entry rule, exit rule or horizon, fee treatment, and price-data source before opening. Zero PnL and unavailable or stale price data must have an explicit deterministic treatment; the initial proposal is cancellation rather than discretionary resolution.

### 3. Creature battle

Predict which of two creatures will finish a fixed battle window with higher ruleset-defined PnL. Both competitors must use the same asset universe, starting notional, fee assumptions, price source, and battle duration. A tie or invalid data period follows the configured tie/refund rule.

The implemented Next Omen prototype uses a no-fee pari-mutuel pool: winning stake splits the full pool proportionally, with the final winning claim receiving any integer remainder. If the resolved outcome has no stake, the market cancels and all participants can refund. Payout mechanisms for profitability and battle markets remain undecided.

## Creature rules

Initial behavior vocabularies are deliberately small. The current engine exercises them with controlled centroid fixtures; they still require validation against real footage without encouraging animal interaction.

- **Hamster:** candidate behaviors include entering a labeled zone, sustained wheel activity, leaving a zone, and inactivity. Camera framing must allow reliable zone and motion detection.
- **Fish:** candidate behaviors include entering a labeled tank region, crossing a virtual boundary, directional movement, and inactivity. Rules must tolerate reflections, occlusion, schooling, and water movement.
- **Turtle:** candidate behaviors include entering a labeled region, directional movement, feeding-area presence, and sustained inactivity. Longer timing thresholds should reflect slower movement.

Zone occupancy/entry/exit, directional movement, and inactivity are implemented for deterministic fixtures with per-creature thresholds, minimum confidence, debounce duration, cooldown, and an unambiguous Omen mapping in a versioned ruleset. General video detection is not implemented. Rules must never require deprivation, startling, forced movement, fighting, or other harmful manipulation.

## Battle mechanics

- A battle pairs two eligible creatures for a declared start and end time.
- Each begins with equal virtual notional and an identical scoring configuration.
- Eligible Omens drive simulated position changes according to the pinned ruleset; animals do not custody or trade funds.
- A declared external price feed marks positions and produces deterministic PnL.
- Score updates may be displayed in real time, but the final result is accepted only after the window closes and required inputs are finalized.
- Missing Omens do not create discretionary trades.
- Stale price data, interrupted provenance, a paused Chamber, or excessive unavailable time triggers a predefined cancel or refund path.
- Exact ties use the market's declared tie outcome or refund rule; this cannot be selected after lock.

Chronicle rankings should distinguish prediction performance from creature battle performance and must be reproducible from indexed events and the pinned scoring rules.

## Chat and reactions

Chat and crowd reactions are offchain, latency-sensitive social features. They may use authenticated user identifiers, moderation, rate limits, and ephemeral aggregation. They cannot resolve markets, alter Omen ordering, or serve as oracle evidence. Only aggregate reaction counts that add product value should be retained, subject to a documented privacy and retention policy.

## Permissionless room creation

Permissionless Chamber creation is a **later milestone**, not part of the MVP. It requires creator staking or anti-spam controls, media-source verification, ruleset constraints, oracle enrollment, moderation, animal-welfare review, metadata validation, and a process for suspension and disputes. Initially, rooms are allowlisted and configured by the project operator.

## Failure cases

- **Feed unavailable, replayed, or stale:** pause the Chamber; do not emit new Omens; cancel affected markets according to their preset timeout.
- **Low-confidence or conflicting detections:** emit no behavior or Omen and retain diagnostic evidence offchain.
- **Duplicate or out-of-order Omen:** reject using Chamber sequence numbers and source time ranges.
- **Oracle delayed or unavailable:** stop opening dependent markets; cancel unresolved markets after their declared deadline.
- **Oracle key compromise:** pause the authorized publisher, rotate authority through controlled governance, and preserve an audit trail.
- **Ruleset or model changes mid-market:** reject the mismatched event; changes apply only to later markets.
- **Price feed stale or unavailable:** do not calculate discretionary PnL; use the declared cancel/refund rule.
- **Indexer lag:** onchain state remains authoritative; the UI displays degraded or stale status.
- **RPC failure or chain reorganization:** retry idempotently, wait for the selected finality policy, and avoid presenting unconfirmed settlement as final.
- **Evidence unavailable:** mark provenance as unavailable or incomplete even if the commitment remains onchain; do not imply the content was independently verified.
- **Animal-welfare or moderation incident:** immediately pause the Chamber and preserve only the evidence permitted by policy.

## Trust assumptions

- Viewers trust approved camera operators not to replay or manipulate the physical scene unless stronger capture attestation is later added.
- Users trust the published model and ruleset versions to describe how observations become Omens.
- The initial oracle publisher and its key management are trusted to submit only validated artifacts; workflow verification reduces but does not eliminate source trust.
- Users trust the configured external price source for PnL markets.
- Smart contracts are trusted only to the extent that their code, administration, and tests are correct.
- Offchain evidence storage is assumed to remain available; its hash protects integrity, not availability.
- Envio-derived views, RPC responses, and the web UI may lag or fail; contract state and finalized events remain authoritative.
- Privy, Alchemy, Envio, Chainlink services, streaming infrastructure, and storage introduce external availability and service assumptions where integrated.

## MVP boundaries

The runnable M1–M4 core is limited to allowlisted Chambers, three creature fixture types, a small fixed behavior vocabulary, a local oracle path, demo assets, and the Next Omen market. Extensible market type definitions reserve Next Trade Profitable and Creature Battle Winner, but neither lifecycle is implemented. It targets local tests and a demonstration flow, not production wagering. Raw media, inference, chat, reactions, and large provenance artifacts remain offchain. Permissionless rooms, decentralized dispute resolution, arbitrary market creation, production governance, mobile applications, and guaranteed evidence availability are outside the MVP.

## M0 success criteria (completed)

M0 is complete when:

- repository boundaries exist for contracts, vision, oracle, and web work;
- README, product specification, and architecture documents use consistent terminology;
- MVP scope, non-goals, trust assumptions, and failure behavior are explicit;
- the initial market families and creature behavior candidates are defined without claiming implementation;
- sponsor integrations have proposed, bounded responsibilities;
- the M0–M8 roadmap is recorded; and
- no contract, computer-vision, oracle, indexing, or frontend capability is represented as working before evidence exists.
