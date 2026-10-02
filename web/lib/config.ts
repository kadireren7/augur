export function clientPublicConfig() {
  return {
    rpcUrl: process.env.NEXT_PUBLIC_MONAD_RPC_URL,
    expectedChainId: process.env.NEXT_PUBLIC_MONAD_CHAIN_ID
      ? Number(process.env.NEXT_PUBLIC_MONAD_CHAIN_ID)
      : undefined,
    tokenAddress: process.env.NEXT_PUBLIC_DEMO_TOKEN_ADDRESS as `0x${string}` | undefined,
    creatureRegistryAddress: process.env.NEXT_PUBLIC_CREATURE_REGISTRY_ADDRESS as `0x${string}` | undefined,
    roomRegistryAddress: process.env.NEXT_PUBLIC_ROOM_REGISTRY_ADDRESS as `0x${string}` | undefined,
    omenPublisherAddress: process.env.NEXT_PUBLIC_OMEN_PUBLISHER_ADDRESS as `0x${string}` | undefined,
    marketAddress: process.env.NEXT_PUBLIC_NEXT_OMEN_MARKET_ADDRESS as `0x${string}` | undefined,
    battleAddress: process.env.NEXT_PUBLIC_BATTLE_COORDINATOR_ADDRESS as `0x${string}` | undefined,
    privyAppId: process.env.NEXT_PUBLIC_PRIVY_APP_ID,
  };
}
