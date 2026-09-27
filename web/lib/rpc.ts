import { createPublicClient, http } from "viem";
import type { Address } from "viem";

import { getPublicConfig } from "@/lib/config";

export interface RpcHealth {
  configured: boolean;
  provider: "ALCHEMY" | "GENERIC" | "NONE";
  status: "HEALTHY" | "UNHEALTHY" | "UNCONFIGURED" | "CHAIN_MISMATCH";
  chainId: number | null;
  latestBlock: string | null;
  error?: string;
  contractCode: Record<string, boolean>;
}

export async function checkRpcHealth(): Promise<RpcHealth> {
  const config = getPublicConfig();
  if (!config.rpcUrl) {
    return {
      configured: false,
      provider: "NONE",
      status: "UNCONFIGURED",
      chainId: null,
      latestBlock: null,
      contractCode: {},
    };
  }
  try {
    const client = createPublicClient({ transport: http(config.rpcUrl, { timeout: 5_000 }) });
    const contracts = {
      creatureRegistry: config.creatureRegistryAddress,
      roomRegistry: config.roomRegistryAddress,
      omenPublisher: config.omenPublisherAddress,
      token: config.tokenAddress,
      nextOmenMarket: config.marketAddress,
      battleCoordinator: config.battleAddress,
    };
    const [chainId, block, code] = await Promise.all([
      client.getChainId(),
      client.getBlockNumber(),
      Promise.all(
        Object.entries(contracts).map(async ([name, contract]) => [
          name,
          contract
            ? ![undefined, "0x"].includes(await client.getCode({ address: contract as Address }))
            : false,
        ] as const),
      ),
    ]);
    const mismatch = config.expectedChainId !== undefined && chainId !== config.expectedChainId;
    return {
      configured: true,
      provider: process.env.ALCHEMY_MONAD_RPC_URL ? "ALCHEMY" : "GENERIC",
      status: mismatch ? "CHAIN_MISMATCH" : "HEALTHY",
      chainId,
      latestBlock: block.toString(),
      contractCode: Object.fromEntries(code),
      ...(mismatch ? { error: `Expected chain ${config.expectedChainId}, received ${chainId}` } : {}),
    };
  } catch {
    return {
      configured: true,
      provider: process.env.ALCHEMY_MONAD_RPC_URL ? "ALCHEMY" : "GENERIC",
      status: "UNHEALTHY",
      chainId: null,
      latestBlock: null,
      contractCode: {},
      error: "RPC health request failed",
    };
  }
}
