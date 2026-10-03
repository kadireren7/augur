# Offchain product persistence

Supabase Postgres stores creature profiles, Chamber metadata, media descriptors, replay records, chat, and reactions. It does not mirror markets, stakes, Omens, balances, or settlement. Those remain Monad/Envio truth.

Apply `migrations/202610030001_product_data.sql` to a new Supabase project using its SQL editor or the Supabase migration tooling. All six tables use RLS; public RPC execution is revoked. The web server alone uses `SUPABASE_URL` plus `SUPABASE_SECRET_KEY` (or the legacy `SUPABASE_SERVICE_ROLE_KEY`). Never put the server key in a browser variable.

The server REST adapter uses the service API for social data and metadata. Database RPCs enforce per-session chat/reaction rate limits atomically with advisory transaction locks. Session identifiers are anonymous offchain identities, not proof of Privy authentication; the public API also applies request limits. A malicious client can change anonymous identities, so production moderation still requires operational supervision.

`/create` can save a pending operator-registration configuration. Saving it does not register a contract. Metadata is content-bound in the prepared hashes. The operator must review the source, register through the existing authorized contract flow, and mark media available before it can appear in an indexed Chamber. Change both the media `status` column and its payload status. This review is not camera attestation.

Media types: `live_hls`, `browser_camera`, `recorded_video`, `fixture`. Camera descriptors contain no URL or raw footage. Only public HTTPS sources or bundled `/media/` assets are accepted. Do not provide signed/private URLs; media descriptors are browser-visible. Viewing is separate from oracle observation capture and does not publish an Omen.

SQLite remains the local development adapter. Vercel refuses SQLite product persistence. Cloud database failure returns an explicit 503; social data never switches to a local store. The labeled illustrative replay remains available if optional offchain media metadata cannot be read; the page discloses that error and retains the real indexed data.

The local showcase is a distinct simulation boundary, with process-local rounds that may reset on serverless cold starts. It sends no chain writes and is not persisted as protocol history.

Migration verification (disposable database only):

```bash
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/202610030001_product_data.sql
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/product_data.sql
```

The migration and SQL checks passed against a disposable local Postgres database. Hosted Supabase connectivity remains unverified until credentials are supplied.
