# Product completion audit

The local product uses the real Monad Testnet deployment and verified local Envio projection. Production hosting remains blocked on external configuration. No blockchain transaction was sent during this product pass.

## Completed product work

| Surface | Verified boundary |
| --- | --- |
| Discovery | Media-led Hamster, Fish and Turtle categories. Hamster has real indexed contract records; Fish/Turtle are replay rooms and local demonstrations, not onchain markets. |
| Chamber | Licensed recorded footage, published behavior/Omen, real market state, exact AUGD pools, wallet-position reads, and separate approval/prediction/settlement feedback. Footage is explicitly illustrative, not publication evidence. |
| Media | Recorded video, public HLS and browser-camera adapters with loading/error handling, native controls and fullscreen. No live source is configured; private camera footage is not stored or uploaded. |
| Motion | Route entry/exit, scroll reveals and linked viewing expansion, Omen/market transitions, pool transitions, battle introductions, reaction bursts and drawers. Reduced motion disables spatial effects and automatic replay playback. |
| Payouts | All stakes form the winning pool; winners claim pro-rata. No winners means cancellation and participant refunds. No platform fee or treasury. Approval alone does not stake tokens. |
| Creation | Creature, name, rules and media descriptors prepare content-bound offchain metadata for operator review. The deployed permissionless policy is disabled; no registration is fabricated. |
| Chronicle / Battles / Showcase | Real indexed history and exact token formatting; explicit local boundaries for virtual battle PnL and repeated three-creature simulation. |
| Persistence | Supabase schema, six RLS tables, server REST adapter, atomic social rate limits and prepared metadata. SQLite persists local product data. Vercel rejects SQLite fallback; configured database failure is explicit. |
| Proof | Real indexed commitments remain visible. Full offchain manifests are explicitly unavailable, without fixture evidence or source-honesty claims. |

## Real-data and safety checks

- Demo startup loads ignored environment configuration and selects ENVIO. It requires chain 10143 and the deployed indexed Chamber; unavailable indexing stops startup instead of selecting fixtures.
- Local health reports ALCHEMY / HEALTHY, Monad 10143, and bytecode at all six configured contracts. A final read returned block **67920415**. The existing local indexer reports block **67576769**; it is behind the chain head, not falsely presented as a fresh camera feed.
- The indexed Chamber renders BUY Omen sequence 1, resolved BUY market 1 and the subsequent open market. Elapsed lock time disables prediction controls. No fixture advancement control appears in contract mode.
- Approval signing construction and its one-DemoToken-request regression remain unchanged. Approval, prediction and settlement retain distinct feedback; logged-out, wrong-chain and unconfigured contract states cannot become local writes.
- Wallet position uses onchain read-only mappings through configured server RPC providers. No authenticated browser session or new transaction was fabricated.
- AUGD remains integer base units internally. The shared 18-decimal formatter displays the smoke volume as **10 AUGD**, not raw wei.
- Initial market clocks are hydration-stable; published timestamps use explicit UTC. No contract, oracle, indexer schema, CRE workflow or wallet signer was replaced.

## Validation

- **60 web tests in 18 files**, TypeScript typecheck, ESLint and production build pass.
- Oracle **19 tests** and vision **21 tests** pass.
- Migration and SQL assertions pass in disposable local Postgres: RLS, RPC permissions, metadata binding, chat/reaction persistence and rate limits, and camera URL constraints. Hosted Supabase has not been contacted or claimed verified.
- Browser regression covers **40 route/width combinations**: 1440px desktop, 1024px tablet, 390px and 430px mobile; discovery, indexed Chamber, Proof, Chronicle, battles, creation, Showcase, Health and both replay rooms.
- All 40 route checks return HTTP 200, with no horizontal document overflow or uncaught page/hydration errors. Native fullscreen enters and exits successfully.
- Browser checks include native replay playback, media failure without protocol-data substitution, category filtering, client navigation, payout drawer, local Showcase start/stop and reduced-motion accessibility. No transaction is submitted by the audit.
- The real Privy login dialog opens. Final-origin authentication, wallet availability and reconnect remain interactive checks; opening a dialog is not authentication.
- README screenshots and the 24-frame Showcase GIF are new captures of the running product; all 11 README asset references resolve. Media source/license credits and font licenses are included. Browser-bundle and staged credential scans and diff checks pass.

## Local demo start

Start the existing local Envio service, then:

```bash
cd web
pnpm demo:build
PORT=3010 pnpm demo:start
```

Verified local origin: `http://localhost:3010`. Indexed Chamber: `/chambers/indexed-9d6541b7a855bf7c`; partial proof appends `/proof`. Configured `ENVIO_GRAPHQL_URL` takes precedence over the non-secret localhost endpoint. This local default is not usable from Vercel.

## Production blockers and remaining manual check

The Vercel project is linked and deployment was attempted. Its configuration guard stopped the production build; **there is no working production URL**.

Required external configuration:

- Public HTTPS **`ENVIO_GRAPHQL_URL`** serving the real Monad projection.
- **`SUPABASE_URL`** and server-only **`SUPABASE_SECRET_KEY`** (or `SUPABASE_SERVICE_ROLE_KEY`), with the committed migration applied.

No hosted indexer or database was invented. See [production checklist](PRODUCTION.md) and [database setup](../supabase/README.md).

After a successful deployment, allowlist its exact origin in Privy if required. Manually verify login, existing/embedded wallet, Monad Testnet 10143, disconnect/reconnect and separate transaction controls. No production-origin authenticated verification is claimed.

CRE remains authenticated-simulation verified with deployment access pending. The local product is prepared for presentation; hosted production and its final Privy check are not yet submission-verified.
