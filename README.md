# Augur

Augur is a hackathon project that turns observable animal behavior into verifiable onchain events and short, real-time prediction markets on Monad. A live creature room is a **Chamber**; a detected physical action becomes a **Behavior**; and a ruleset can map that behavior into an **Omen** such as BUY, HOLD, or SELL.

Augur is currently at **M0: project definition and architecture**. The repository contains planning documents and module boundaries only. Contracts, computer vision, oracle publication, indexing, and the consumer application are not implemented yet.

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

## Main features

The following are product goals and are **planned unless explicitly marked otherwise**:

- Live animal Chambers for hamster, fish, and turtle streams.
- A visible Observation → Behavior → Omen provenance trail.
- Short markets for the next Omen, next-trade profitability, and creature battles.
- **The Pit**, where creatures compete on deterministic PnL over a fixed round.
- Offchain live chat and crowd reactions.
- **Chronicle**, a history and leaderboard experience derived from indexed events.
- Creature and Room registries for stable identities and configuration references.
- Third-party consumption of published creature events.
- Permissionless Chamber creation in a later milestone, after safety and anti-spam controls exist.

## Architecture summary

Augur is separated into four modules:

- `vision/` will ingest approved video sources and produce timestamped observations and interpreted behaviors.
- `oracle/` will validate evidence, apply a versioned mapping ruleset, assemble Proofs of Omen, and submit publish or resolve transactions.
- `contracts/` will contain registries, event commitments, market lifecycle logic, and settlement rules on Monad.
- `web/` will provide Chambers, prediction interactions, The Pit, Chronicle, wallet access, chat, and reactions.

Planned integrations are Envio for indexed onchain state, Chainlink CRE for verifiable workflow coordination, Alchemy for Monad RPC and transaction infrastructure, and Privy for user authentication and wallet onboarding. Their exact APIs and deployment configuration will be validated during implementation.

## Milestone status

**Current: M0 — Foundation.** The project structure, terminology, product scope, and proposed architecture are being defined. No runtime component is represented as complete.

## Development roadmap

- **M0 — Foundation (current):** product specification, terminology, architecture, and repository structure.
- **M1 — Vision Engine:** implement deterministic creature tracking from recorded video, starting with a small behavior vocabulary and zone/motion detection.
- **M2 — Proof of Omen:** build the provenance pipeline linking source segment hash, detections, behavior, ruleset version, Omen, and verification artifacts.
- **M3 — Monad Protocol:** implement and test Creature Registry, Room Registry, Omen publication, authorization, sequencing, replay protection, and core event schemas on Monad.
- **M4 — Real-time Market Engine:** implement short-lived test-token prediction markets with open, lock, resolve, cancel/refund, and claim flows. Integrate the first oracle-to-market path and prototype Chainlink CRE where appropriate.
- **M5 — Live Chambers:** build the consumer experience: Chamber views, creature stream/video, current Omen, market interaction, Privy wallet onboarding, Alchemy infrastructure, and offchain live chat/reactions.
- **M6 — Battles & Chronicle:** implement creature-vs-creature battles, deterministic virtual PnL scoring, standings/history, and Envio indexing/query views.
- **M7 — Permissionless Chambers:** prototype guarded user-created creature rooms with constrained rulesets, source verification, anti-spam controls, and registration flows.
- **M8 — Monad Showcase / Speed Mode:** create the hackathon demo mode with rapid repeated market cycles, concurrent predictions, Omen publication, settlement, and visible transaction/event activity to demonstrate why Monad matters.

Roadmap items may change after prototype testing, sponsor integration validation, animal-welfare review, and security review.
