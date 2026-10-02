import { afterEach, describe, expect, it } from "vitest";

import { checkRpcHealth, type RpcClientFactory } from "@/lib/rpc";

const saved = {
  alchemy: process.env.ALCHEMY_MONAD_RPC_URL,
  generic: process.env.MONAD_RPC_URL,
  chainId: process.env.NEXT_PUBLIC_MONAD_CHAIN_ID,
};

afterEach(() => {
  for (const [name, value] of [
    ["ALCHEMY_MONAD_RPC_URL", saved.alchemy],
    ["MONAD_RPC_URL", saved.generic],
    ["NEXT_PUBLIC_MONAD_CHAIN_ID", saved.chainId],
  ] as const) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

const healthyClient = (chainId = 10143) => ({
  async getChainId() { return chainId; },
  async getBlockNumber() { return 123n; },
  async getCode() { return "0x6000" as const; },
});

describe("RPC health provider selection", () => {
  it("uses Alchemy when it is healthy", async () => {
    process.env.ALCHEMY_MONAD_RPC_URL = "https://alchemy.example/rpc";
    process.env.MONAD_RPC_URL = "https://generic.example/rpc";
    process.env.NEXT_PUBLIC_MONAD_CHAIN_ID = "10143";

    const health = await checkRpcHealth(() => healthyClient());
    expect(health).toMatchObject({ provider: "ALCHEMY", status: "HEALTHY", chainId: 10143 });
  });

  it("falls back from unavailable Alchemy only to the configured Monad RPC", async () => {
    process.env.ALCHEMY_MONAD_RPC_URL = "https://alchemy.example/rpc";
    process.env.MONAD_RPC_URL = "https://generic.example/rpc";
    process.env.NEXT_PUBLIC_MONAD_CHAIN_ID = "10143";
    const attempted: string[] = [];
    const factory: RpcClientFactory = (url) => {
      attempted.push(url);
      if (url.includes("alchemy")) throw new Error("unavailable");
      return healthyClient();
    };

    const health = await checkRpcHealth(factory);
    expect(attempted).toEqual(["https://alchemy.example/rpc", "https://generic.example/rpc"]);
    expect(health).toMatchObject({ provider: "MONAD_RPC", status: "HEALTHY" });
  });

  it("reports a wrong chain without hiding it behind fallback", async () => {
    process.env.ALCHEMY_MONAD_RPC_URL = "https://alchemy.example/rpc";
    process.env.MONAD_RPC_URL = "https://generic.example/rpc";
    process.env.NEXT_PUBLIC_MONAD_CHAIN_ID = "10143";

    const health = await checkRpcHealth(() => healthyClient(1));
    expect(health).toMatchObject({ provider: "ALCHEMY", status: "CHAIN_MISMATCH", chainId: 1 });
  });

  it("uses LOCAL only when no RPC provider is configured", async () => {
    delete process.env.ALCHEMY_MONAD_RPC_URL;
    delete process.env.MONAD_RPC_URL;

    const health = await checkRpcHealth(() => healthyClient());
    expect(health).toMatchObject({ provider: "LOCAL", status: "UNCONFIGURED", configured: false });
  });
});
