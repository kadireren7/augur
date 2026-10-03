# Production checklist

## Prepared project

- Vercel project: `augur`; root directory: `web`.
- Next.js, Node 24, pnpm 11.2.2, frozen lockfile.
- `web/vercel.json` runs the production configuration guard before the build.
- `.vercel`, `.env` and local database files are ignored and excluded from upload.
- Public Privy/Monad contract configuration and server Alchemy/generic RPC values were configured in the linked production environment. No secret is printed or stored in tracked configuration.

The attempted production build failed at its configuration guard. There is no working production deployment or verified production origin.

## Required external configuration

1. A publicly reachable HTTPS `ENVIO_GRAPHQL_URL` serving the verified Monad Testnet projection. The current `http://localhost:8080/v1/graphql` works only for the local demo; it cannot serve Vercel. Do not replace it with a fabricated hosted endpoint.
2. A Supabase project with `supabase/migrations/202610030001_product_data.sql` applied.
3. Server-only `SUPABASE_URL` and `SUPABASE_SECRET_KEY` (legacy alternative: `SUPABASE_SERVICE_ROLE_KEY`). No browser database key is needed.

Keep the existing production variables:

```text
NEXT_PUBLIC_PRIVY_APP_ID
NEXT_PUBLIC_MONAD_CHAIN_ID=10143
NEXT_PUBLIC_MONAD_RPC_URL
NEXT_PUBLIC_CREATURE_REGISTRY_ADDRESS
NEXT_PUBLIC_ROOM_REGISTRY_ADDRESS
NEXT_PUBLIC_OMEN_PUBLISHER_ADDRESS
NEXT_PUBLIC_DEMO_TOKEN_ADDRESS
NEXT_PUBLIC_NEXT_OMEN_MARKET_ADDRESS
NEXT_PUBLIC_BATTLE_COORDINATOR_ADDRESS
ALCHEMY_MONAD_RPC_URL
MONAD_RPC_URL
```

Disable `NEXT_PUBLIC_PRIVY_LOCAL_MODE`. Leave `CHAINLINK_CRE_WORKFLOW_ID` unset until an actual CRE deployment exists. Media descriptors contain only public sources; never persist a signed/private stream URL.

## Deploy only when the services can work

Configure variables through Vercel's dashboard or secret-safe CLI input. Do not put credentials on a command line or in chat. Then:

```bash
cd web
pnpm production:check
vercel deploy --prod
```

The configuration guard verifies presence and rejects localhost endpoints; it does not assert runtime connectivity. A successful build must be followed by real checks:

- `/api/health`: ENVIO, Alchemy HEALTHY, chain 10143, all six deployed bytecodes, Supabase HEALTHY.
- `/`: indexed Hamster plus honestly labeled Fish/Turtle replay rooms.
- `/chambers/indexed-9d6541b7a855bf7c`: real Omen, real market, contract controls, no fixture advancement, distinct approval/prediction/settlement state.
- `/chronicle`: exact 18-decimal AUGD formatting and real indexed history.
- Chamber `/proof`: real commitments and an explicit unavailable full manifest.
- Chat/reactions persist across server instances and return an explicit failure when the database is unavailable.
- 1440, 1024, 390 and 430px: no document overflow or hydration/page errors; reduced-motion and media controls remain accessible.

The local Showcase is intentionally separate simulation state; cold starts can reset it. Do not describe those rounds as persisted protocol history.

## Privy final-origin interaction

After a successful deployment, add the exact returned HTTPS origin to the Privy app's allowed origins if required. Do not use a failed deployment URL as proof of readiness.

Interactively verify login, existing/embedded wallet, address, Monad Testnet 10143, disconnect/reconnect, and enabled contract controls. Opening the login dialog does not prove authentication. Any new contract write requires the user's wallet approval and testnet assets; none is required or claimed by this local product pass.

## Current status

Local product build, real Envio/Alchemy/Monad read path, database migration and prepared adapter are verified. Hosted Supabase, public Envio hosting, working Vercel deployment and production-origin Privy authentication remain externally blocked. They are not substituted with fixtures or invented results.
