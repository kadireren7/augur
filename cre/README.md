# Augur Chainlink CRE workflow

`augur-omen-workflow/` is an optional, real Chainlink CRE orchestration path for
Augur's oracle boundary. It receives an already deterministic Proof of Omen
request; it does not inspect video, infer behavior, invent an Omen, or replace
the oracle and contract checks.

The HTTP-triggered workflow:

1. validates the versioned request, Chamber, creature, Omen, behavior, sequence,
   provenance commitment, ruleset, Monad chain, and OmenPublisher target;
2. rejects malformed, unbound, unsupported, or replayed/regressed requests using
   the supplied previous-sequence context;
3. derives a deterministic decision ID; and
4. returns a prepared `OmenPublisher.publish(...)` call for the relay boundary.

It never signs or broadcasts a transaction. The oracle still validates the full
Proof of Omen before invoking CRE, and `OmenPublisher` remains the authoritative
publisher-authorization and sequence/replay boundary.

## Verified state

- Workflow SDK: `@chainlink/cre-sdk` 1.23.0
- CRE CLI build: v1.36.0, successful
- Authenticated CRE CLI simulation: successful
- Build artifact SHA-256:
  `d8b75277908fb0b2ae6307c0e8d1e0a8bee17ba4d0eac127a83b91c4ac9fcea8`
- Simulation config hash:
  `76a0e8bc2a784cb34f40698fead4573ec6662cdd3f4cc4efd5f29dac1fbe2581`
- Deterministic decision ID:
  `0x45bdf950dc0fdb5b6025af0dcc6e05614a6ae068ddeeb2287a7c3a976f7269b7`
- Target: Monad Testnet chain `10143`
- OmenPublisher: `0x333c7ba28b6Eec62f51d111d161fc52fd3ADAa1a`
- Fixture: the public sequence-1 BUY smoke Omen under
  `augur-omen-workflow/payloads/monad-smoke-omen.json`

The authenticated official simulator accepted the real smoke-shaped request and
returned the expected provenance, sequence, Monad target, deterministic decision,
and `publish(...)` calldata. The same simulator rejected malformed JSON, missing
provenance, unsupported Omen values, replayed sequences, the wrong chain, and the
wrong publisher target. It did not broadcast the prepared call.

Deployment access is not enabled for the authenticated CRE organization, as
reported by `cre account access`, so no workflow was deployed and no public
workflow ID exists. `CHAINLINK_CRE_WORKFLOW_ID` must contain the public deployed
workflow identifier only after a deployment actually succeeds.

## Commands

Install the pinned dependencies and run the deterministic validation suite:

```bash
cd cre/augur-omen-workflow
bun install --frozen-lockfile
bun test
bun run typecheck
```

With the official `cre` CLI installed, build from the repository root:

```bash
cre --project-root ./cre --target local-simulation workflow build \
  ./cre/augur-omen-workflow --output /tmp/augur-omen-workflow.wasm
```

After authenticating with `cre login` or setting `CRE_API_KEY` in an ignored
environment file, run the real simulator from the repository root. CRE CLI
v1.36.0 expects the JSON value directly rather than `@file` syntax:

```bash
payload="$(jq -c . cre/augur-omen-workflow/payloads/monad-smoke-omen.json)"
cre --project-root ./cre --target local-simulation --non-interactive \
  workflow simulate ./augur-omen-workflow --trigger-index 0 \
  --http-payload "$payload"
```

The smoke payload is historical. It is safe for validation and call preparation
but must not be broadcast because sequence 1 is already published onchain.
