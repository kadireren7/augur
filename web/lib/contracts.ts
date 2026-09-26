import {
  createPublicClient,
  createWalletClient,
  custom,
  encodeFunctionData,
  http,
  type Address,
  type EIP1193Provider,
  type Hash,
} from "viem";

import { clientPublicConfig } from "@/lib/config";
import type { OmenValue } from "@/lib/types";

export const demoTokenAbi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export const nextOmenMarketAbi = [
  {
    type: "function",
    name: "predict",
    stateMutability: "nonpayable",
    inputs: [
      { name: "marketId", type: "uint256" },
      { name: "outcomeValue", type: "uint8" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [{ name: "marketId", type: "uint256" }],
    outputs: [{ name: "payout", type: "uint256" }],
  },
  {
    type: "function",
    name: "refund",
    stateMutability: "nonpayable",
    inputs: [{ name: "marketId", type: "uint256" }],
    outputs: [{ name: "amount", type: "uint256" }],
  },
] as const;

const outcomeIndex: Record<OmenValue, number> = { SELL: 0, HOLD: 1, BUY: 2 };

export interface ContractWallet {
  address: Address;
  provider: EIP1193Provider;
}

export class AugurContractClient {
  private readonly config = clientPublicConfig();

  get configured(): boolean {
    return Boolean(
      this.config.expectedChainId && this.config.tokenAddress && this.config.marketAddress,
    );
  }

  async approve(wallet: ContractWallet, amount: bigint): Promise<Hash> {
    this.requireConfigured();
    return this.send(wallet, this.config.tokenAddress!, demoTokenAbi, "approve", [
      this.config.marketAddress!,
      amount,
    ]);
  }

  async predict(
    wallet: ContractWallet,
    marketId: bigint,
    outcome: OmenValue,
    amount: bigint,
  ): Promise<Hash> {
    this.requireConfigured();
    return this.send(wallet, this.config.marketAddress!, nextOmenMarketAbi, "predict", [
      marketId,
      outcomeIndex[outcome],
      amount,
    ]);
  }

  async claim(wallet: ContractWallet, marketId: bigint): Promise<Hash> {
    this.requireConfigured();
    return this.send(wallet, this.config.marketAddress!, nextOmenMarketAbi, "claim", [marketId]);
  }

  async refund(wallet: ContractWallet, marketId: bigint): Promise<Hash> {
    this.requireConfigured();
    return this.send(wallet, this.config.marketAddress!, nextOmenMarketAbi, "refund", [marketId]);
  }

  private async send(
    wallet: ContractWallet,
    to: Address,
    abi: readonly unknown[],
    functionName: string,
    args: readonly unknown[],
  ): Promise<Hash> {
    const chainHex = (await wallet.provider.request({ method: "eth_chainId" })) as string;
    const actualChainId = Number.parseInt(chainHex, 16);
    if (actualChainId !== this.config.expectedChainId) {
      throw new Error(`Wrong chain: expected ${this.config.expectedChainId}, received ${actualChainId}`);
    }
    const walletClient = createWalletClient({ transport: custom(wallet.provider) });
    const data = encodeFunctionData({ abi, functionName, args });
    const hash = await walletClient.sendTransaction({ account: wallet.address, chain: null, to, data });
    const rpcUrl = process.env.NEXT_PUBLIC_MONAD_RPC_URL;
    if (rpcUrl) {
      const publicClient = createPublicClient({ transport: http(rpcUrl) });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("Transaction reverted");
    }
    return hash;
  }

  private requireConfigured(): void {
    if (!this.configured) throw new Error("Contract addresses or chain ID are not configured");
  }
}
