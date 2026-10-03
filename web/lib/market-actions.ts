import type { AugurContractClient, ContractWallet, TransactionSubmitted } from "@/lib/contracts";
import type { Hash } from "viem";

export async function executeApprovalClick(
  client: Pick<AugurContractClient, "approve">,
  wallet: ContractWallet,
  amount: bigint,
  onSubmitted?: TransactionSubmitted,
): Promise<Hash> {
  return client.approve(wallet, amount, onSubmitted);
}
