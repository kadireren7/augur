import { z } from "zod";

const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/);

const publicConfigSchema = z.object({
  rpcUrl: z.string().url().optional(),
  expectedChainId: z.coerce.number().int().positive().optional(),
  tokenAddress: address.optional(),
  marketAddress: address.optional(),
  battleAddress: address.optional(),
  privyAppId: z.string().min(1).optional(),
});

export function getPublicConfig() {
  return publicConfigSchema.parse({
    rpcUrl: process.env.ALCHEMY_MONAD_RPC_URL || process.env.MONAD_RPC_URL || undefined,
    expectedChainId: process.env.NEXT_PUBLIC_MONAD_CHAIN_ID || undefined,
    tokenAddress: process.env.NEXT_PUBLIC_DEMO_TOKEN_ADDRESS || undefined,
    marketAddress: process.env.NEXT_PUBLIC_NEXT_OMEN_MARKET_ADDRESS || undefined,
    battleAddress: process.env.NEXT_PUBLIC_BATTLE_COORDINATOR_ADDRESS || undefined,
    privyAppId: process.env.NEXT_PUBLIC_PRIVY_APP_ID || undefined,
  });
}

export function clientPublicConfig() {
  return {
    expectedChainId: process.env.NEXT_PUBLIC_MONAD_CHAIN_ID
      ? Number(process.env.NEXT_PUBLIC_MONAD_CHAIN_ID)
      : undefined,
    tokenAddress: process.env.NEXT_PUBLIC_DEMO_TOKEN_ADDRESS as `0x${string}` | undefined,
    marketAddress: process.env.NEXT_PUBLIC_NEXT_OMEN_MARKET_ADDRESS as `0x${string}` | undefined,
    battleAddress: process.env.NEXT_PUBLIC_BATTLE_COORDINATOR_ADDRESS as `0x${string}` | undefined,
    privyAppId: process.env.NEXT_PUBLIC_PRIVY_APP_ID,
  };
}
