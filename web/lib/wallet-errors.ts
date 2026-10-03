import type { TransactionPhase } from "@/lib/types";

export function walletError(error: unknown, fallback = "Wallet action failed"): {
  phase: Extract<TransactionPhase, "FAILED" | "REJECTED">;
  message: string;
} {
  const message = error instanceof Error ? error.message : fallback;
  const normalized = message.toLowerCase();
  const rejected = normalized.includes("user rejected")
    || normalized.includes("user denied")
    || normalized.includes("login cancelled")
    || normalized.includes("login canceled");
  return { phase: rejected ? "REJECTED" : "FAILED", message };
}
