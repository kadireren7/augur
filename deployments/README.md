# Deployment metadata

No Monad deployment has been performed from this repository.

After a real deployment, add a non-secret JSON file named for the network and deployment block. Record only the chain ID, deployer address, block number, transaction hashes, contract addresses, source revision, and verification result. Never store a private key, seed phrase, RPC credential, or API token here.

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
