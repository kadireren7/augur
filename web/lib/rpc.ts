import { createPublicClient, http } from "viem";
import type { Address } from "viem";

import { getServerConfig, getServerRpcProviders, type RpcProviderSource } from "@/lib/server-config";

interface RpcClient {
  getChainId(): Promise<number>;
  getBlockNumber(): Promise<bigint>;
  getCode(parameters: { address: Address }): Promise<`0x${string}` | undefined>;
}

export type RpcClientFactory = (url: string) => RpcClient;

const defaultRpcClientFactory: RpcClientFactory = (url) =>
  createPublicClient({ transport: http(url, { timeout: 5_000 }) });

export interface RpcHealth {
  configured: boolean;
  provider: RpcProviderSource | "LOCAL";
  status: "HEALTHY" | "UNHEALTHY" | "UNCONFIGURED" | "CHAIN_MISMATCH";
  chainId: number | null;
  latestBlock: string | null;
  error?: string;
  contractCode: Record<string, boolean>;
}

export async function checkRpcHealth(
  createClient: RpcClientFactory = defaultRpcClientFactory,
): Promise<RpcHealth> {
  const config = getServerConfig();
  const providers = getServerRpcProviders();
  if (providers.length === 0) {
    return {
      configured: false,
      provider: "LOCAL",
      status: "UNCONFIGURED",
      chainId: null,
      latestBlock: null,
      contractCode: {},
    };
  }
  const contracts = {
    creatureRegistry: config.creatureRegistryAddress,
    roomRegistry: config.roomRegistryAddress,
    omenPublisher: config.omenPublisherAddress,
    token: config.tokenAddress,
    nextOmenMarket: config.marketAddress,
    battleCoordinator: config.battleAddress,
  };

  for (const candidate of providers) {
    try {
      const client = createClient(candidate.rpcUrl);
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
        provider: candidate.provider,
        status: mismatch ? "CHAIN_MISMATCH" : "HEALTHY",
        chainId,
        latestBlock: block.toString(),
        contractCode: Object.fromEntries(code),
        ...(mismatch ? { error: `Expected chain ${config.expectedChainId}, received ${chainId}` } : {}),
      };
    } catch {
      // Try only the next explicitly configured Monad RPC provider.
    }
  }

  return {
    configured: true,
    provider: providers.at(-1)!.provider,
    status: "UNHEALTHY",
    chainId: null,
    latestBlock: null,
    contractCode: {},
    error: "Configured RPC providers are unavailable",
  };
}
