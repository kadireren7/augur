# Submission audit

All code and configuration blockers from the presentation audit are resolved.
The production demo was verified against real Monad Testnet, local Envio indexing,
Alchemy, and the configured Privy provider. No blockchain transaction was sent
during this pass. The final authenticated Privy session check remains manual.

## Resolved blockers

| Blocker | Resolution and evidence |
| --- | --- |
| Demo startup selects local data unless manually overridden | `pnpm demo:build` and `pnpm demo:start` load ignored environment files, select the configured Envio endpoint or the existing local endpoint, and require chain 10143 plus the real indexed Chamber before launching. The actual demo process reports ENVIO. An unreachable endpoint stops startup with exit 1. |
| Raw token amounts displayed as AUGD | Indexed amounts remain exact base-unit strings. Prediction and backing totals use BigInt; the shared formatter uses all 18 decimals. The real smoke volume `10000000000000000000` renders as `10 AUGD`. Single-wei and large-number regression tests pass. Local fixtures retain whole-token amounts. |
| Mobile document overflow | Long identifiers and panel content wrap; the Chronicle table scrolls within its panel. All eight routes have no horizontal document overflow at 1440, 390 and 430 pixels. |
| Fixture controls on indexed Chamber | ENVIO/Contract views omit the fixture stage, synthetic centroid and advance button. They explain that media is unavailable. Explicit local mode retains its fixture controls; backend validation is unchanged. |
| Missing full provenance manifest | Chamber and Proof views display the real Omen, sequence, timestamp, Chamber/creature IDs, ruleset and provenance commitments. The unavailable full manifest is stated explicitly, with no source/detection integrity claim or fabricated evidence. |

## Integration checks

- Runtime health reports ENVIO, ALCHEMY / HEALTHY, Monad chain 10143, and bytecode
  at all six configured contracts. Addresses match committed deployment metadata.
- Envio serves the real Chamber, BUY Omen sequence 1, resolved BUY market 1 and
  open market 2. The indexed API preserves raw token amounts as JSON strings.
- Approval and prediction state remain separate. The existing approval regression
  test still requires exactly one DemoToken transaction and no market transaction.
- An unreachable configured indexer displays an explicit data-unavailable view.
  Fixture data is never substituted. An unavailable endpoint prevents demo startup.
- The earlier isolated wrong-chain RPC audit returned CHAIN_MISMATCH without
  hiding the mismatch behind fallback; the existing regression test still passes.
- No contract, wallet signer, oracle, Envio schema or CRE workflow logic changed.
  Battles and Showcase retain their explicit local-data boundaries.

## Validation

- All 45 web tests pass, including exact amount formatting, indexed aggregation,
  serialization and explicit indexer-failure regressions.
- TypeScript typecheck and ESLint pass.
- The production build passes through `pnpm demo:build` after real Envio preflight.
- Browser checks cover discovery, indexed Chamber, Chronicle, Proof, Health,
  creation, Showcase and battles at desktop, 390px and 430px.
- The real Privy login form and wallet-choice control render at all three widths.
  No uncaught page errors were observed in the successful real-data browser pass.
- Existing README screenshots and Showcase GIF remain actual app captures;
  relative asset references resolve. Server credentials are absent from browser
  bundles and staged changes. Diff checks pass.

## Final demo start

Start the existing Envio service first, then:

```bash
cd web
pnpm demo:build
PORT=3007 pnpm demo:start
```

The verified origin is `http://localhost:3007`. Shell environment values take
precedence, followed by web production-local configuration and the ignored root
environment. `ENVIO_GRAPHQL_URL` can point to a configured HTTPS endpoint. The
local default is `http://localhost:8080/v1/graphql`; it contains no credentials
and is required to pass a real deployment/chain preflight. Ordinary `pnpm start`
keeps standard Next.js environment behavior; use the demo command for submission.

The live indexed route is `/chambers/indexed-9d6541b7a855bf7c` and the partial proof
route appends `/proof`. Source mode is separate from data mode: the Chamber's
indexed configuration can say FIXTURE while its Omen and markets are real records.

## Manual verification remaining

On `http://localhost:3007`, use Connect with Privy to authenticate. Confirm an
existing or embedded wallet, the visible address, Monad Testnet chain 10143,
disconnect/reconnect, and separate approval/prediction controls on the real indexed
Chamber. Do not interpret opening the login dialog as authenticated verification.

If Privy rejects the origin, add the exact origin to the application's allowed
origins in its dashboard. That account setting is not inspectable from this
repository. A deployment on a different final origin requires the same check and
appropriate origin configuration. No new transaction is required by this audit.

The code and real-data demo are ready for that final interactive check. Full
offchain evidence remains unavailable rather than fabricated, and CRE remains
authenticated-simulation verified with deployment access pending.
