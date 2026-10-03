# Submission audit

The polished production build was checked against the existing Monad Testnet
deployment, the running local Envio GraphQL service, Alchemy, and the configured
Privy provider. This audit did not send a blockchain transaction.

## Verified

- Monad chain ID is 10143. All six configured contract addresses match the
  committed deployment metadata, and all six bytecode checks pass.
- Health reports ALCHEMY and HEALTHY. An isolated diagnostic RPC returning chain
  1 produces CHAIN_MISMATCH without falling back to the generic Monad provider.
- The existing Envio service returns the real Chamber, BUY Omen sequence 1,
  resolved BUY market 1, and open market 2. Its chain metadata reported processed
  block 67850107 against head 67850108 during the audit.
- The indexed Chamber uses Contract mode and displays the real Omen and market
  history. Approval and prediction state remain separate; the existing dedicated
  approval regression test checks exactly one DemoToken send and no market send.
- A deliberately unreachable indexer returns an explicit request error. It does
  not substitute local Chambers. Fixture advancement in Envio mode returns 409.
- All eight requested routes return HTTP 200 at desktop and mobile sizes. The
  proof route explicitly explains that the full offchain manifest is unavailable.
- Privy initialization reaches Connect with Privy, and the real login form and
  wallet connection choice render. A fresh browser context has no authenticated
  wallet; this audit does not claim a new completed login or signature.
- All 18 README relative references resolve. Ten PNGs and the animated Showcase
  GIF decode successfully. The screenshots remain explicitly local-data captures.
- All 41 web tests, TypeScript, ESLint, production build, and diff checks pass.

## Remaining submission issues

The root environment currently has no `ENVIO_GRAPHQL_URL`. The audit explicitly
selected the already-running `http://localhost:8080/v1/graphql` service for its
separate production instance. Set the intended GraphQL endpoint in the actual
demo process environment before starting it; otherwise discovery uses local data.

The indexed adapter currently displays raw token base units as AUGD in Chronicle
and historical market volume. DemoToken has 18 decimals: the smoke amount
`10000000000000000000` represents **10 AUGD**, not that many whole tokens. Unit
formatting requires a focused adapter/presentation correction outside this
copy-only audit.

At 390 pixels wide, the real indexed Chamber and Chronicle overflow horizontally
because real identifiers and amounts are longer than the fixture values. The
desktop routes remain readable. The layout needs a focused responsive correction.

The indexed Chamber still presents the fixture visualization and advancement
control despite having no observation/media payload. Its API safely disables the
action, but the visible control and centered marker are inappropriate for the
indexed view. No fixture Omen replaced the indexed record during the audit.

The full offchain Proof of Omen is not loaded by the indexed adapter. The onchain
commitment exists, but the proof page cannot verify or display the complete source
manifest. Stale text claiming no Omen existed was corrected.

Perform an interactive Privy login/reconnect on the final demo origin to check the
authenticated wallet and chain badge. Previous public approval verification is
documented in the README; this audit only rechecked provider initialization and
the real login UI. Battles and Showcase remain explicitly local experiences.

The integrations are operational and the build passes, but an unconditional final
submission sign-off is withheld until the indexed amount and mobile presentation
issues are resolved and the intended indexed configuration is used. CRE remains
authenticated-simulation verified with deployment access pending.
