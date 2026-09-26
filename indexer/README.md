# Augur Envio indexer

This is a real HyperIndex event projection for the Augur contracts. The committed `config.yaml` is intentionally local-only: its five addresses are code-generation placeholders, not deployments.

After deploying contracts, replace the chain ID, start block, RPC, and addresses; set `ENVIO_API_TOKEN` in an untracked `.env`; then run:

```sh
pnpm install
pnpm codegen
pnpm typecheck
pnpm dev
```

`pnpm dev` also requires Docker. No hosted indexer or Monad deployment is claimed by this scaffold.

The schema supports Chamber timelines/current Omens, active and recent markets, prediction and claim history, aggregate volume, battle history, and Chronicle standings derived by the application query layer.
