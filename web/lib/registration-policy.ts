import { createPublicClient, http } from "viem";
import { getServerConfig, getServerRpcProviders } from "@/lib/server-config";
import { roomRegistryAbi } from "@/lib/contracts";

export async function readRegistrationPolicy(): Promise<{
  enabled: boolean;
  status: "VERIFIED" | "UNAVAILABLE" | "WRONG_CHAIN";
}> {
  const config = getServerConfig();
  if (!config.roomRegistryAddress)
    return { enabled: false, status: "UNAVAILABLE" };
  for (const provider of getServerRpcProviders()) {
    try {
      const client = createPublicClient({
        transport: http(provider.rpcUrl, { timeout: 5000, retryCount: 0 }),
      });
      if ((await client.getChainId()) !== 10143)
        return { enabled: false, status: "WRONG_CHAIN" };
      const enabled = await client.readContract({
        address: config.roomRegistryAddress as `0x${string}`,
        abi: roomRegistryAbi,
        functionName: "permissionlessEnabled",
      });
      return { enabled, status: "VERIFIED" };
    } catch {
      /* Only explicitly configured server RPC providers may be retried. */
    }
  }
  return { enabled: false, status: "UNAVAILABLE" };
}
