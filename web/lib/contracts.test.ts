import { afterEach, describe, expect, it } from "vitest";
import type { EIP1193Provider } from "viem";

import { AugurContractClient } from "@/lib/contracts";

const variables = [
  "NEXT_PUBLIC_MONAD_CHAIN_ID",
  "NEXT_PUBLIC_MONAD_RPC_URL",
  "NEXT_PUBLIC_DEMO_TOKEN_ADDRESS",
  "NEXT_PUBLIC_NEXT_OMEN_MARKET_ADDRESS",
] as const;
const saved = Object.fromEntries(variables.map((name) => [name, process.env[name]]));

afterEach(() => {
  for (const name of variables) {
    const value = saved[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

describe("wallet chain validation", () => {
  it("rejects a transaction before signing when the wallet is on the wrong chain", async () => {
    process.env.NEXT_PUBLIC_MONAD_CHAIN_ID = "10143";
    process.env.NEXT_PUBLIC_MONAD_RPC_URL = "https://rpc.example";
    process.env.NEXT_PUBLIC_DEMO_TOKEN_ADDRESS = "0x0000000000000000000000000000000000000001";
    process.env.NEXT_PUBLIC_NEXT_OMEN_MARKET_ADDRESS =
      "0x0000000000000000000000000000000000000002";
    const provider = {
      request: async () => "0x1",
    } as unknown as EIP1193Provider;

    await expect(
      new AugurContractClient().approve(
        { address: "0x0000000000000000000000000000000000000003", provider },
        1n,
      ),
    ).rejects.toThrow("Wrong chain: expected 10143, received 1");
  });
});
