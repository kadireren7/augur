import { createPublicClient, http } from "viem";

import { getPublicConfig } from "@/lib/config";

export interface RpcHealth {
  configured: boolean;
  provider: "ALCHEMY_OR_CUSTOM" | "NONE";
  status: "HEALTHY" | "UNHEALTHY" | "UNCONFIGURED" | "CHAIN_MISMATCH";
  chainId: number | null;
  latestBlock: string | null;
  error?: string;
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
    };
  }
  try {
    const client = createPublicClient({ transport: http(config.rpcUrl, { timeout: 5_000 }) });
    const [chainId, block] = await Promise.all([client.getChainId(), client.getBlockNumber()]);
    const mismatch = config.expectedChainId !== undefined && chainId !== config.expectedChainId;
    return {
      configured: true,
      provider: "ALCHEMY_OR_CUSTOM",
      status: mismatch ? "CHAIN_MISMATCH" : "HEALTHY",
      chainId,
      latestBlock: block.toString(),
      ...(mismatch ? { error: `Expected chain ${config.expectedChainId}, received ${chainId}` } : {}),
    };
  } catch {
    return {
      configured: true,
      provider: "ALCHEMY_OR_CUSTOM",
      status: "UNHEALTHY",
      chainId: null,
      latestBlock: null,
      error: "RPC health request failed",
    };
  }
}
