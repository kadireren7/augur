import { createPublicClient, http, parseAbi } from "viem";
import { getServerConfig, getServerRpcProviders } from "@/lib/server-config";

export const positionAbi = parseAbi([
  "function exposure(uint256 marketId,address account,uint8 outcome) view returns (uint256)",
  "function userTotal(uint256 marketId,address account) view returns (uint256)",
  "function claimed(uint256 marketId,address account) view returns (bool)",
]);
export async function readMarketPosition(
  marketId: bigint,
  account: `0x${string}`,
) {
  const config = getServerConfig();
  if (!config.marketAddress)
    throw new Error("Market contract is not configured");
  for (const provider of getServerRpcProviders()) {
    try {
      const client = createPublicClient({
        transport: http(provider.rpcUrl, { timeout: 5000, retryCount: 0 }),
      });
      if ((await client.getChainId()) !== 10143) throw new WrongPositionChain();
      const address = config.marketAddress as `0x${string}`;
      const [SELL, HOLD, BUY, total, claimed] = await Promise.all([
        ...([0, 1, 2] as const).map((outcome) =>
          client.readContract({
            address,
            abi: positionAbi,
            functionName: "exposure",
            args: [marketId, account, outcome],
          }),
        ),
        client.readContract({
          address,
          abi: positionAbi,
          functionName: "userTotal",
          args: [marketId, account],
        }),
        client.readContract({
          address,
          abi: positionAbi,
          functionName: "claimed",
          args: [marketId, account],
        }),
      ]);
      return {
        SELL: String(SELL),
        HOLD: String(HOLD),
        BUY: String(BUY),
        total: String(total),
        claimed: Boolean(claimed),
        chainId: 10143,
      };
    } catch (error) {
      if (error instanceof WrongPositionChain) throw error;
    }
  }
  throw new Error("Monad RPC unavailable; wallet position could not be read");
}
class WrongPositionChain extends Error {
  constructor() {
    super("RPC chain mismatch; position read stopped");
  }
}
