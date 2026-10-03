# Product correction audit

The local product uses the real Monad Testnet deployment and verified local Envio projection. Production hosting remains blocked on external configuration. No blockchain transaction was sent during this product pass.

## Completed product work

| Surface | Verified boundary |
| --- | --- |
| Discovery | Pablo (Hamster), Bubbles (Fish) and Turbo (land Tortoise) have readable identities, cards and rooms. Pablo shows real indexed contract records; Bubbles/Turbo have no funded onchain market. Display names are curated aliases, not changes to contract metadata. |
| Chamber | Feed left, prediction exchange right: outcome pool shares, total pool, lock countdown, stake and estimated payout. Published behavior/Omen, wallet-position reads and separate approval/prediction/settlement feedback remain. Licensed footage is illustrative, not publication evidence. Technical fields are collapsed. |
| Media | Recorded video, public HLS and browser-camera adapters with bounded loading, reconnect/offline handling, mute and fullscreen. Replay has a timeline; live sources do not. HLS must report a live playlist before showing LIVE. No live source is configured; private camera footage is not stored or uploaded. Turbo's footage shows land tortoises, not sea turtles. |
| Typography / motion | Readable sans-serif product hierarchy replaces italic display typography. Exact integer pool interpolation, selected outcomes, payout updates, Omen/market transitions, countdown urgency, route transitions, reaction bursts and drawers reinforce state changes. Reduced motion remains supported. |
| Payouts | All stakes form the winning pool; winners claim pro-rata. No winners means cancellation and participant refunds. No platform fee or treasury. Approval alone does not stake tokens. |
| Creation | Creature, name, rules and media descriptors prepare content-bound offchain metadata for operator review. The deployed permissionless policy is disabled; no registration is fabricated. |
| Chronicle / Battles / Showcase | Real indexed history and exact token formatting; explicit local boundaries for virtual battle PnL and repeated three-creature simulation. |
| Persistence / identity | Supabase Auth-backed profiles, creatures, chambers, media, messages, reactions and favorites extend the existing schema. Privy JWT signatures/audience/issuer/expiry are verified server-side. A protected subject mapping obtains a server-held Supabase Auth session; private writes run under per-user RLS, not arbitrary browser wallet addresses. SQLite retains local metadata/reference data. Vercel rejects SQLite fallback. |
| Authorization | Public discovery, media, market state, history and proof do not require login. Approve/predict/claim, chat, reactions, favorites and creation require verified identity. Supabase-dependent actions fail explicitly when its configuration is absent. Wallet signing remains Privy-controlled. |
| Loading | Immediate loading shells, parallel health/history reads, bounded request timeouts and deduplicated short-lived Envio snapshots. Media and wallet initialization do not block market rendering; indexing errors never select fixtures. |
| Proof | Real indexed commitments remain visible. Full offchain manifests are explicitly unavailable, without fixture evidence or source-honesty claims. |

## Real-data and safety checks

- Demo startup loads ignored environment configuration and selects ENVIO. It requires chain 10143 and the deployed indexed Chamber; unavailable indexing stops startup instead of selecting fixtures.
- Local health reports ALCHEMY / HEALTHY, Monad 10143, and bytecode at all six configured contracts. A read returned block **67940650**. The existing local indexer reports block **67576769**; it is behind the chain head, not falsely presented as a fresh camera feed. Health sequence diagnostics now come from the selected indexed source rather than local reference records.
- The indexed Chamber renders BUY Omen sequence 1, resolved BUY market 1 and the subsequent open market. Elapsed lock time disables prediction controls. No fixture advancement control appears in contract mode.
- Approval signing construction and its one-DemoToken-request regression remain unchanged. Approval, prediction and settlement retain distinct feedback; logged-out, wrong-chain and unconfigured contract states cannot become local writes.
- Wallet position uses onchain read-only mappings through configured server RPC providers. No authenticated browser session or new transaction was fabricated.
- AUGD remains integer base units internally. The shared 18-decimal formatter displays the smoke volume as **10 AUGD**, not raw wei.
- Initial market clocks are hydration-stable; published timestamps use explicit UTC. No contract, oracle, indexer schema, CRE workflow or wallet signer was replaced.

## Validation

- **68 web tests in 22 files**, TypeScript typecheck, ESLint and production build pass.
- Oracle **19 tests** and vision **21 tests** pass.
- Both migrations and SQL assertions pass in disposable local Postgres: public reads, private profile/favorites boundaries, cross-user rejection, restricted wallet/profile columns, RPC permissions, chat/reaction persistence and per-user rate limits. Local cryptographic tests reject invalid Privy tokens and browser identity spoofing; mocked Auth exchanges test protected subject mapping and concurrent request deduplication. These are not hosted Supabase Auth verification. Hosted Supabase has not been contacted or claimed verified.
- Browser regression covers **40 route/width combinations**: 1440px desktop, 1024px tablet, 390px and 430px mobile; discovery, indexed Chamber, Proof, Chronicle, battles, creation, Showcase, Health and both replay rooms.
- All 40 route checks return HTTP 200, with no horizontal document overflow, console errors or uncaught page/hydration errors. Native fullscreen enters and exits successfully. Turbo's portrait footage retains its full frame rather than cropping the tortoise out of the wide player.
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
- **`NEXT_PUBLIC_SUPABASE_URL`**, **`NEXT_PUBLIC_SUPABASE_ANON_KEY`** and server-only **`SUPABASE_SERVICE_ROLE_KEY`**, with both migrations applied and Supabase Auth email provider enabled for the server-held session exchange. Legacy server aliases are described in the database setup guide.
- Publicly reachable media URLs. Bundled replay assets work locally; live broadcasting requires an actual public HLS URL through `LIVE_STREAM_URL` or an approved media record, not an invented stream.

No hosted indexer or database was invented. See [production checklist](PRODUCTION.md) and [database setup](../supabase/README.md).

After a successful deployment, allowlist its exact origin in Privy if required. Manually verify login, existing/embedded wallet, Monad Testnet 10143, disconnect/reconnect and separate transaction controls. No production-origin authenticated verification is claimed.

The existing indexed market's lock time has elapsed. It is shown as such and cannot accept predictions from this UI; a new active round requires the existing operator lifecycle, not a fabricated local market.

CRE remains authenticated-simulation verified with deployment access pending. Local product checks do not establish hosted production readiness or final user design approval. Hosted services and the final Privy-origin check remain unverified.
