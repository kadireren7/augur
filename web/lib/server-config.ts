import { z } from "zod";

const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const rpcUrl = z.string().url();

export type RpcProviderSource = "ALCHEMY" | "MONAD_RPC";

export interface ServerRpcProvider {
  provider: RpcProviderSource;
  rpcUrl: string;
}

const serverConfigSchema = z.object({
  rpcUrl: rpcUrl.optional(),
  expectedChainId: z.coerce.number().int().positive().optional(),
  tokenAddress: address.optional(),
  creatureRegistryAddress: address.optional(),
  roomRegistryAddress: address.optional(),
  omenPublisherAddress: address.optional(),
  marketAddress: address.optional(),
  battleAddress: address.optional(),
  privyAppId: z.string().min(1).optional(),
});

export function getServerConfig() {
  const [preferredRpc] = getServerRpcProviders();
  return serverConfigSchema.parse({
    rpcUrl: preferredRpc?.rpcUrl,
    expectedChainId: process.env.NEXT_PUBLIC_MONAD_CHAIN_ID || undefined,
    tokenAddress: process.env.NEXT_PUBLIC_DEMO_TOKEN_ADDRESS || undefined,
    creatureRegistryAddress: process.env.NEXT_PUBLIC_CREATURE_REGISTRY_ADDRESS || undefined,
    roomRegistryAddress: process.env.NEXT_PUBLIC_ROOM_REGISTRY_ADDRESS || undefined,
    omenPublisherAddress: process.env.NEXT_PUBLIC_OMEN_PUBLISHER_ADDRESS || undefined,
    marketAddress: process.env.NEXT_PUBLIC_NEXT_OMEN_MARKET_ADDRESS || undefined,
    battleAddress: process.env.NEXT_PUBLIC_BATTLE_COORDINATOR_ADDRESS || undefined,
    privyAppId: process.env.NEXT_PUBLIC_PRIVY_APP_ID || undefined,
  });
}

export function getServerRpcProviders(): ServerRpcProvider[] {
  const configured = [
    process.env.ALCHEMY_MONAD_RPC_URL
      ? { provider: "ALCHEMY" as const, rpcUrl: process.env.ALCHEMY_MONAD_RPC_URL }
      : undefined,
    process.env.MONAD_RPC_URL
      ? { provider: "MONAD_RPC" as const, rpcUrl: process.env.MONAD_RPC_URL }
      : undefined,
  ].filter((value): value is ServerRpcProvider => value !== undefined);

  return configured.map((value) => ({ ...value, rpcUrl: rpcUrl.parse(value.rpcUrl) }));
}
