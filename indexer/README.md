# Augur Envio indexer

This is a real HyperIndex event projection for the Augur contracts. The committed `config.yaml` targets the verified Monad testnet deployment on chain 10143, starting from the first contract deployment block.

Set `ENVIO_API_TOKEN` in an untracked `.env` when required by the selected Envio runtime, then run:

```sh
pnpm install
pnpm codegen
pnpm typecheck
pnpm dev
```

`pnpm dev` also requires Docker. Local Envio indexing against the real Monad testnet deployment has been verified from start block 67,521,320. The indexed smoke lifecycle contains `CreatureRegistered`, Chamber registration and activation, `OmenPublished` sequence 1, `MarketOpened`, `PredictionPlaced`, `MarketLocked`, `MarketResolved` with BUY, and `Claimed`. GraphQL returned those real entities and the web indexed-data adapter consumed the result successfully. A hosted Envio endpoint is not claimed here.

The schema supports Chamber timelines/current Omens, active and recent markets, prediction and claim history, aggregate volume, battle history, and Chronicle standings derived by the application query layer.
