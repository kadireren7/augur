import { describe, expect, it } from "vitest";

import {
  createMonadTestnetChain,
  MONAD_TESTNET_CHAIN_ID,
  parseWalletChainId,
  resolvePrivyWalletState,
  resolvePrivyRuntime,
} from "@/lib/privy-config";

describe("Privy Monad configuration", () => {
  it("builds Monad Testnet with only the configured public browser RPC", () => {
    const chain = createMonadTestnetChain("https://public-rpc.example");
    expect(chain.id).toBe(MONAD_TESTNET_CHAIN_ID);
    expect(chain.testnet).toBe(true);
    expect(chain.rpcUrls.default.http).toEqual(["https://public-rpc.example"]);
  });

  it("parses Privy CAIP, decimal, and hexadecimal wallet chain IDs", () => {
    expect(parseWalletChainId("eip155:10143")).toBe(10143);
    expect(parseWalletChainId("10143")).toBe(10143);
    expect(parseWalletChainId("0x279f")).toBe(10143);
    expect(parseWalletChainId(undefined)).toBeUndefined();
  });

  it("uses local fallback only when it is explicitly enabled", () => {
    expect(resolvePrivyRuntime({ explicitLocalMode: true })).toEqual({ mode: "LOCAL_DEV" });
    expect(resolvePrivyRuntime({ explicitLocalMode: false })).toEqual({
      mode: "UNAVAILABLE",
      error: "NEXT_PUBLIC_PRIVY_APP_ID is not configured",
    });
  });

  it("requires a browser RPC for configured Privy mode", () => {
    expect(resolvePrivyRuntime({ appId: "public-app-id", explicitLocalMode: false })).toEqual({
      mode: "UNAVAILABLE",
      error: "NEXT_PUBLIC_MONAD_RPC_URL is not configured",
    });
    expect(resolvePrivyRuntime({
      appId: "public-app-id",
      rpcUrl: "https://public-rpc.example",
      explicitLocalMode: false,
    })).toEqual({
      mode: "PRIVY",
      appId: "public-app-id",
      rpcUrl: "https://public-rpc.example",
    });
  });

  it("resolves explicit initialization, login, ready, and timeout states", () => {
    const base = {
      privyReady: false,
      walletsReady: false,
      authenticated: false,
      walletCount: 0,
      chainId: undefined,
      timedOut: false,
      hasError: false,
    };

    expect(resolvePrivyWalletState(base)).toBe("INITIALIZING");
    expect(resolvePrivyWalletState({ ...base, timedOut: true })).toBe("ERROR");
    expect(resolvePrivyWalletState({ ...base, privyReady: true })).toBe("LOGIN_REQUIRED");
    expect(resolvePrivyWalletState({
      ...base,
      privyReady: true,
      walletsReady: true,
      authenticated: true,
      walletCount: 1,
      chainId: 10143,
    })).toBe("READY");
  });

  it("does not report an authenticated wallet ready until wallets and chain resolve", () => {
    const authenticated = {
      privyReady: true,
      walletsReady: false,
      authenticated: true,
      walletCount: 0,
      chainId: undefined,
      timedOut: false,
      hasError: false,
    };
    expect(resolvePrivyWalletState(authenticated)).toBe("INITIALIZING");
    expect(resolvePrivyWalletState({ ...authenticated, walletsReady: true })).toBe("INITIALIZING");
    expect(resolvePrivyWalletState({
      ...authenticated,
      walletsReady: true,
      walletCount: 1,
    })).toBe("INITIALIZING");
    expect(resolvePrivyWalletState({ ...authenticated, timedOut: true })).toBe("ERROR");
  });
});
