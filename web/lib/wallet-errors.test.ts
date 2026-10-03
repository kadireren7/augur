import { describe, expect, it } from "vitest";

import { walletError } from "@/lib/wallet-errors";

describe("wallet failure states", () => {
  it.each([
    "User rejected the request",
    "User denied transaction signature",
    "Login cancelled",
  ])("reports cancellation or rejection clearly: %s", (message) => {
    expect(walletError(new Error(message))).toEqual({ phase: "REJECTED", message });
  });

  it.each([
    "Authenticated, but no wallet is available",
    "Wrong chain: expected 10143, received 1",
    "Transaction reverted",
    "RPC request failed",
  ])("reports operational failure without fake success: %s", (message) => {
    expect(walletError(new Error(message))).toEqual({ phase: "FAILED", message });
  });
});
