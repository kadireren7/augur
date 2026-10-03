import {
  createPublicClient,
  decodeFunctionData,
  encodeFunctionData,
  http,
  type Address,
  type EIP1193Provider,
  type Hash,
  type Hex,
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

export type TransactionSubmitted = (hash: Hash) => void;

export interface PreparedContractTransaction {
  to: Address;
  data: Hex;
}

export interface ApprovalPreflight {
  transaction: PreparedContractTransaction;
  gasEstimate: bigint;
}

export type ConfirmTransaction = (hash: Hash) => Promise<void>;

export function buildDemoTokenApproval(
  tokenAddress: Address,
  marketAddress: Address,
  amount: bigint,
): PreparedContractTransaction {
  if (tokenAddress.toLowerCase() === marketAddress.toLowerCase()) {
    throw new Error("DemoToken and NextOmenMarket addresses must be distinct");
  }
  const data = encodeFunctionData({
    abi: demoTokenAbi,
    functionName: "approve",
    args: [marketAddress, amount],
  });
  const decoded = decodeFunctionData({ abi: demoTokenAbi, data });
  if (
    decoded.functionName !== "approve"
    || decoded.args[0].toLowerCase() !== marketAddress.toLowerCase()
    || decoded.args[1] !== amount
  ) {
    throw new Error("DemoToken approval calldata validation failed");
  }
  return { to: tokenAddress, data };
}

export async function submitPreparedContractTransaction(
  wallet: ContractWallet,
  transaction: PreparedContractTransaction,
): Promise<Hash> {
  return wallet.provider.request({
    method: "eth_sendTransaction",
    params: [{
      from: wallet.address,
      to: transaction.to,
      data: transaction.data,
    }],
  }) as Promise<Hash>;
}

export class AugurContractClient {
  private readonly config = clientPublicConfig();

  constructor(private readonly confirmTransaction?: ConfirmTransaction) {}

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

  async approve(wallet: ContractWallet, amount: bigint, onSubmitted?: TransactionSubmitted): Promise<Hash> {
    this.requireConfigured();
    const preflight = await this.validateApproval(wallet, amount);
    return this.sendPrepared(
      wallet,
      preflight.transaction,
      onSubmitted,
    );
  }

  async validateApproval(wallet: ContractWallet, amount: bigint): Promise<ApprovalPreflight> {
    this.requireConfigured();
    await this.requireExpectedChain(wallet.provider);
    const transaction = buildDemoTokenApproval(
      this.config.tokenAddress!,
      this.config.marketAddress!,
      amount,
    );
    const request = {
      from: wallet.address,
      to: transaction.to,
      data: transaction.data,
    };
    const [gasHex, result] = await Promise.all([
      wallet.provider.request({ method: "eth_estimateGas", params: [request] }) as Promise<Hex>,
      wallet.provider.request({ method: "eth_call", params: [request, "latest"] }) as Promise<Hex>,
    ]);
    if (BigInt(result) !== 1n) throw new Error("DemoToken approval simulation did not return true");
    return { transaction, gasEstimate: BigInt(gasHex) };
  }

  async predict(
    wallet: ContractWallet,
    marketId: bigint,
    outcome: OmenValue,
    amount: bigint,
    onSubmitted?: TransactionSubmitted,
  ): Promise<Hash> {
    this.requireConfigured();
    return this.send(wallet, this.config.marketAddress!, nextOmenMarketAbi, "predict", [
      marketId,
      outcomeIndex[outcome],
      amount,
    ], onSubmitted);
  }

  async claim(wallet: ContractWallet, marketId: bigint, onSubmitted?: TransactionSubmitted): Promise<Hash> {
    this.requireConfigured();
    return this.send(wallet, this.config.marketAddress!, nextOmenMarketAbi, "claim", [marketId], onSubmitted);
  }

  async refund(wallet: ContractWallet, marketId: bigint, onSubmitted?: TransactionSubmitted): Promise<Hash> {
    this.requireConfigured();
    return this.send(wallet, this.config.marketAddress!, nextOmenMarketAbi, "refund", [marketId], onSubmitted);
  }

  async registerCreature(
    wallet: ContractWallet,
    creatureId: `0x${string}`,
    species: 0 | 1 | 2,
    metadataHash: `0x${string}`,
    onSubmitted?: TransactionSubmitted,
  ): Promise<Hash> {
    if (!this.permissionlessConfigured) throw new Error("Registry contracts are not configured");
    return this.send(
      wallet,
      this.config.creatureRegistryAddress!,
      creatureRegistryAbi,
      "registerCreature",
      [creatureId, species, metadataHash, wallet.address],
      onSubmitted,
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
    onSubmitted?: TransactionSubmitted,
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
      onSubmitted,
    );
  }

  private async send(
    wallet: ContractWallet,
    to: Address,
    abi: readonly unknown[],
    functionName: string,
    args: readonly unknown[],
    onSubmitted?: TransactionSubmitted,
  ): Promise<Hash> {
    return this.sendPrepared(
      wallet,
      { to, data: encodeFunctionData({ abi, functionName, args }) },
      onSubmitted,
    );
  }

  private async sendPrepared(
    wallet: ContractWallet,
    transaction: PreparedContractTransaction,
    onSubmitted?: TransactionSubmitted,
  ): Promise<Hash> {
    await this.requireExpectedChain(wallet.provider);
    const hash = await submitPreparedContractTransaction(wallet, transaction);
    onSubmitted?.(hash);
    if (this.confirmTransaction) {
      await this.confirmTransaction(hash);
    } else {
      const publicClient = createPublicClient({ transport: http(this.config.rpcUrl!) });
      const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 60_000 });
      if (receipt.status !== "success") throw new Error("Transaction reverted");
    }
    return hash;
  }

  private async requireExpectedChain(provider: EIP1193Provider): Promise<void> {
    const chainHex = (await provider.request({ method: "eth_chainId" })) as string;
    const actualChainId = Number.parseInt(chainHex, 16);
    if (actualChainId !== this.config.expectedChainId) {
      throw new Error(`Wrong chain: expected ${this.config.expectedChainId}, received ${actualChainId}`);
    }
  }

  private requireConfigured(): void {
    if (!this.configured) throw new Error("Contract addresses or chain ID are not configured");
  }
}
