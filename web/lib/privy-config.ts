import { defineChain } from "viem";

export const MONAD_TESTNET_CHAIN_ID = 10_143;
export const PRIVY_INITIALIZATION_TIMEOUT_MS = 12_000;

export type PrivyWalletState = "INITIALIZING" | "LOGIN_REQUIRED" | "READY" | "ERROR";

export type PrivyRuntime =
  | { mode: "LOCAL_DEV" }
  | { mode: "UNAVAILABLE"; error: string }
  | { mode: "PRIVY"; appId: string; rpcUrl: string };

export function resolvePrivyRuntime(input: {
  appId?: string;
  rpcUrl?: string;
  explicitLocalMode: boolean;
}): PrivyRuntime {
  if (input.explicitLocalMode) return { mode: "LOCAL_DEV" };
  if (!input.appId) return { mode: "UNAVAILABLE", error: "NEXT_PUBLIC_PRIVY_APP_ID is not configured" };
  if (!input.rpcUrl) return { mode: "UNAVAILABLE", error: "NEXT_PUBLIC_MONAD_RPC_URL is not configured" };
  return { mode: "PRIVY", appId: input.appId, rpcUrl: input.rpcUrl };
}

export function createMonadTestnetChain(rpcUrl: string) {
  return defineChain({
    id: MONAD_TESTNET_CHAIN_ID,
    name: "Monad Testnet",
    nativeCurrency: { name: "Testnet MON Token", symbol: "MON", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
    blockExplorers: {
      default: { name: "Monad Testnet Explorer", url: "https://testnet.monadexplorer.com" },
    },
    testnet: true,
  });
}

export function parseWalletChainId(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const raw = value.includes(":") ? value.slice(value.lastIndexOf(":") + 1) : value;
  const radix = raw.startsWith("0x") ? 16 : 10;
  const parsed = Number.parseInt(raw, radix);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function resolvePrivyWalletState(input: {
  privyReady: boolean;
  walletsReady: boolean;
  authenticated: boolean;
  walletCount: number;
  chainId?: number;
  timedOut: boolean;
  hasError: boolean;
}): PrivyWalletState {
  if (input.hasError) return "ERROR";
  if (!input.privyReady) return input.timedOut ? "ERROR" : "INITIALIZING";
  if (!input.authenticated) return "LOGIN_REQUIRED";
  if (!input.walletsReady || input.walletCount === 0 || input.chainId === undefined) {
    return input.timedOut ? "ERROR" : "INITIALIZING";
  }
  return "READY";
}
