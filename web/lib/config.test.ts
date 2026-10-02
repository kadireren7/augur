import { afterEach, describe, expect, it } from "vitest";

import { getServerConfig, getServerRpcProviders } from "@/lib/server-config";

const savedAlchemy = process.env.ALCHEMY_MONAD_RPC_URL;
const savedGeneric = process.env.MONAD_RPC_URL;

afterEach(() => {
  if (savedAlchemy === undefined) delete process.env.ALCHEMY_MONAD_RPC_URL;
  else process.env.ALCHEMY_MONAD_RPC_URL = savedAlchemy;
  if (savedGeneric === undefined) delete process.env.MONAD_RPC_URL;
  else process.env.MONAD_RPC_URL = savedGeneric;
});

describe("server RPC configuration", () => {
  it("prefers an Alchemy Monad URL over the generic URL", () => {
    process.env.ALCHEMY_MONAD_RPC_URL = "https://alchemy.example/rpc";
    process.env.MONAD_RPC_URL = "https://generic.example/rpc";
    expect(getServerConfig().rpcUrl).toBe("https://alchemy.example/rpc");
    expect(getServerRpcProviders().map(({ provider }) => provider)).toEqual(["ALCHEMY", "MONAD_RPC"]);
  });

  it("uses the generic URL when Alchemy is not configured", () => {
    delete process.env.ALCHEMY_MONAD_RPC_URL;
    process.env.MONAD_RPC_URL = "https://generic.example/rpc";
    expect(getServerConfig().rpcUrl).toBe("https://generic.example/rpc");
    expect(getServerRpcProviders()[0]?.provider).toBe("MONAD_RPC");
  });
});
