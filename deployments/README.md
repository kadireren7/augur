# Deployment metadata

The Augur contract stack is deployed on Monad testnet chain 10143. `monad-testnet-10143-67521320.json` records only public addresses, deployment blocks, and deployment/smoke transaction hashes. `VerifyDeployment.s.sol` and the complete setup-to-claim smoke flow passed against this deployment.

For future deployments, add a non-secret JSON file named for the network and first deployment block. Record only public chain IDs, addresses, block numbers, and transaction hashes. Never store a private key, seed phrase, RPC credential, or API token here.

Required runtime variables:

```text
MONAD_RPC_URL
DEPLOYER_PRIVATE_KEY
EXPECTED_CHAIN_ID
EXPECTED_DEPLOYER
CREATURE_REGISTRY_ADDRESS
ROOM_REGISTRY_ADDRESS
OMEN_PUBLISHER_ADDRESS
DEMO_TOKEN_ADDRESS
NEXT_OMEN_MARKET_ADDRESS
BATTLE_COORDINATOR_ADDRESS
```

For a local Anvil RPC only, omit `DEPLOYER_PRIVATE_KEY`, set `DEPLOYER_ADDRESS` to an unlocked test account, and add `--unlocked --sender "$DEPLOYER_ADDRESS"` to broadcast commands. Never use unlocked mode for a public network.

Deployment and verification:

```sh
cd contracts
forge script script/Deploy.s.sol:DeployAugur --rpc-url "$MONAD_RPC_URL" --broadcast
forge script script/VerifyDeployment.s.sol:VerifyDeployment --rpc-url "$MONAD_RPC_URL"
```

The two smoke scripts split market setup and resolution because a real network must pass the declared lock time between them. Their additional required variables are visible in the scripts and must come from the setup receipt; they are never guessed.

Permissionless creation remains disabled immediately after deployment. Review a ruleset commitment produced by `/api/chambers/prepare`, then enable that exact commitment with a bounded per-owner limit:

```sh
ROOM_REGISTRY_ADDRESS=... RULESET_HASH=... MAX_ROOMS_PER_OWNER=10 \
  forge script script/ConfigurePermissionless.s.sol:ConfigurePermissionless \
  --rpc-url "$MONAD_RPC_URL" --broadcast
```

This administrative preflight prevents arbitrary executable rules. Add each approved configuration commitment explicitly; never accept a hash without reviewing the decoded rules shown by the preparation endpoint.
