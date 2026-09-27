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

export const creatureRegistryAbi = [
  {
    type: "function",
    name: "registerCreature",
    stateMutability: "nonpayable",
    inputs: [
      { name: "creatureId", type: "bytes32" },
      { name: "species", type: "uint8" },
      { name: "metadataHash", type: "bytes32" },
      { name: "operator", type: "address" },
    ],
    outputs: [],
  },
] as const;

export const roomRegistryAbi = [
  {
    type: "function",
    name: "permissionlessEnabled",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "allowedRuleset",
    stateMutability: "view",
    inputs: [{ name: "rulesetHash", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "registerPermissionlessRoom",
    stateMutability: "nonpayable",
    inputs: [
      { name: "chamberId", type: "bytes32" },
      { name: "creatureId", type: "bytes32" },
      { name: "configHash", type: "bytes32" },
      { name: "rulesetHash", type: "bytes32" },
      { name: "publisher", type: "address" },
      { name: "sourceMode", type: "uint8" },
    ],
    outputs: [],
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
      this.config.rpcUrl
      && this.config.expectedChainId
      && this.config.tokenAddress
      && this.config.marketAddress,
    );
  }

  get permissionlessConfigured(): boolean {
    return Boolean(
      this.config.expectedChainId
      && this.config.rpcUrl
      && this.config.creatureRegistryAddress
      && this.config.roomRegistryAddress,
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

  async registerCreature(
    wallet: ContractWallet,
    creatureId: `0x${string}`,
    species: 0 | 1 | 2,
    metadataHash: `0x${string}`,
  ): Promise<Hash> {
    if (!this.permissionlessConfigured) throw new Error("Registry contracts are not configured");
    return this.send(
      wallet,
      this.config.creatureRegistryAddress!,
      creatureRegistryAbi,
      "registerCreature",
      [creatureId, species, metadataHash, wallet.address],
    );
  }

  async validatePermissionlessPolicy(rulesetHash: `0x${string}`): Promise<void> {
    if (!this.permissionlessConfigured) throw new Error("Registry contracts are not configured");
    const client = createPublicClient({ transport: http(this.config.rpcUrl!) });
    const [enabled, rulesetAllowed] = await Promise.all([
      client.readContract({
        address: this.config.roomRegistryAddress!,
        abi: roomRegistryAbi,
        functionName: "permissionlessEnabled",
      }),
      client.readContract({
        address: this.config.roomRegistryAddress!,
        abi: roomRegistryAbi,
        functionName: "allowedRuleset",
        args: [rulesetHash],
      }),
    ]);
    if (!enabled) throw new Error("Permissionless Chamber registration is disabled onchain");
    if (!rulesetAllowed) throw new Error("This exact ruleset configuration is not allowlisted onchain");
  }

  async registerPermissionlessRoom(
    wallet: ContractWallet,
    registration: {
      chamberId: `0x${string}`;
      creatureId: `0x${string}`;
      configHash: `0x${string}`;
      rulesetHash: `0x${string}`;
    },
    sourceMode: 0 | 1 | 2,
  ): Promise<Hash> {
    if (!this.permissionlessConfigured) throw new Error("Registry contracts are not configured");
    return this.send(
      wallet,
      this.config.roomRegistryAddress!,
      roomRegistryAbi,
      "registerPermissionlessRoom",
      [
        registration.chamberId,
        registration.creatureId,
        registration.configHash,
        registration.rulesetHash,
        wallet.address,
        sourceMode,
      ],
    );
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
    const publicClient = createPublicClient({ transport: http(this.config.rpcUrl!) });
    const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 60_000 });
    if (receipt.status !== "success") throw new Error("Transaction reverted");
    return hash;
  }

  private requireConfigured(): void {
    if (!this.configured) throw new Error("Contract addresses or chain ID are not configured");
  }
}
