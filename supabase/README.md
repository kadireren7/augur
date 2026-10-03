# Offchain product persistence

Supabase Postgres stores creature profiles, Chamber metadata, media descriptors, replay records, chat, and reactions. It does not mirror markets, stakes, Omens, balances, or settlement. Those remain Monad/Envio truth.

Apply both migrations in filename order using the Supabase SQL editor or migration tooling. Product tables use RLS; public writes and identity-column updates are restricted. Required configuration: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and server-only `SUPABASE_SERVICE_ROLE_KEY`. Legacy server URL/secret-key alternatives remain supported by the adapter. Never expose the service key in a browser variable.

## Authentication and authorization

Privy authenticates the user. Each protected API verifies its ES256 bearer token against the app's public JWKS, issuer, audience and expiry. Only the verified subject is mapped to a Supabase Auth account. No user-provided wallet address, UUID, email or session ID authenticates a request.

The server creates an internal non-deliverable alias with protected Auth app metadata, then exchanges an admin-generated link for a Supabase Auth session. No email is sent. An unrelated pre-created account is rejected rather than adopted. Sessions stay server-side, are briefly cached and deduplicated, and are used as the authenticated bearer when accessing product rows. Every incoming request must still present a valid Privy token. This uses the documented [Privy access-token boundary](https://docs.privy.io/authentication/user-authentication/access-tokens) and Supabase's [admin link](https://supabase.com/docs/reference/javascript/auth-admin-generatelink) / [OTP verification](https://supabase.com/docs/reference/javascript/auth-verifyotp) APIs; native third-party JWT acceptance is not assumed.

Profiles reference `auth.users`. The server-only mapping has a unique Privy subject. Wallet fields remain null until trusted verification supplies them; profile writes cannot assign a browser-provided wallet or change identity fields. Public creatures, available Chambers and messages can be read without login. Profiles, favorites and pending owner preparations are scoped by `auth.uid()`.

Authenticated message/reaction RPCs derive identity from `auth.uid()`, not parameters. Advisory transaction locks enforce per-user rate limits atomically. Moderation and request limits remain in the web API. Legacy tables/RPCs remain service-only for compatibility; product write endpoints do not accept their arbitrary anonymous identifiers.

The second migration adds normalized profiles, creatures, Chambers, messages and favorites; media gets playback/poster aliases and metadata, and reactions get a user reference. Public seed identities are Pablo, Bubbles and Turbo (land Tortoise). This is offchain presentation data, not copied protocol state.

`/create` can save a pending operator-registration configuration. Saving it does not register a contract. Metadata is content-bound in the prepared hashes. The operator must review the source, register through the existing authorized contract flow, and mark media available before it can appear in an indexed Chamber. Change both the media `status` column and its payload status. This review is not camera attestation.

Media types: `live_hls`, `browser_camera`, `recorded_video`, `fixture`. Camera descriptors contain no URL or raw footage. Only public HTTPS sources or bundled `/media/` assets are accepted. Do not provide signed/private URLs; media descriptors are browser-visible. Viewing is separate from oracle observation capture and does not publish an Omen.

SQLite remains the local development adapter for reference records and viewing metadata. Vercel refuses SQLite product persistence. Authenticated account/social actions require the configured Auth bridge, even when the main app runs locally; they do not fall back to guest writes. Cloud failure returns an explicit error. Reference footage can remain available if optional metadata cannot be read, with an error disclosure and real indexed data unchanged.

The local showcase is a distinct simulation boundary, with process-local rounds that may reset on serverless cold starts. It sends no chain writes and is not persisted as protocol history.

Migration verification (disposable database only):

```bash
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/202610030001_product_data.sql
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/product_data.sql
# Hosted Supabase already provides auth.users and auth.uid().
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/202610040001_authenticated_product.sql
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/authenticated_product.sql
```

For a disposable plain Postgres instance only, run `tests/auth-bootstrap.sql` before either migration to model Auth roles/UID context. Never run that bootstrap in hosted Supabase. The SQL checks use sample user rows and must never run against production.

Both migrations and actual RLS checks pass in disposable Postgres. Cryptographic token verification, API gates and REST session mapping pass web tests. This is not live Supabase Auth verification: hosted connectivity and an authenticated Privy→Supabase roundtrip remain blocked until credentials and account configuration are supplied.
