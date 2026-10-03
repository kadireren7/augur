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
- Build artifact SHA-256:
  `d8b75277908fb0b2ae6307c0e8d1e0a8bee17ba4d0eac127a83b91c4ac9fcea8`
- Target: Monad Testnet chain `10143`
- OmenPublisher: `0x333c7ba28b6Eec62f51d111d161fc52fd3ADAa1a`
- Fixture: the public sequence-1 BUY smoke Omen under
  `augur-omen-workflow/payloads/monad-smoke-omen.json`

The official CRE CLI simulator and deployment require Chainlink CRE
authentication. In the verified environment neither an interactive login nor
`CRE_API_KEY` was present, so simulation stopped at the authentication gate and
no workflow was deployed. `CHAINLINK_CRE_WORKFLOW_ID` must contain the public
deployed workflow identifier only after a deployment actually succeeds.

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
environment file, run the real simulator:

```bash
cre --project-root ./cre --target local-simulation --non-interactive \
  workflow simulate ./cre/augur-omen-workflow --trigger-index 0 \
  --http-payload @./payloads/monad-smoke-omen.json
```

The smoke payload is historical. It is safe for validation and call preparation
but must not be broadcast because sequence 1 is already published onchain.
