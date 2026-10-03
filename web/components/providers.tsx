"use client";

import { PrivyProvider, usePrivy, useWallets } from "@privy-io/react-auth";
import {
  Component,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Address } from "viem";

import {
  createMonadTestnetChain,
  MONAD_TESTNET_CHAIN_ID,
  parseWalletChainId,
  PRIVY_INITIALIZATION_TIMEOUT_MS,
  resolvePrivyWalletState,
  resolvePrivyRuntime,
  type PrivyWalletState,
} from "@/lib/privy-config";

interface SessionIdentity {
  mode: "PRIVY" | "LOCAL_DEV" | "UNAVAILABLE";
  walletState: PrivyWalletState;
  ready: boolean;
  authenticated: boolean;
  sessionId: string;
  displayName: string;
  error?: string;
  address?: Address;
  chainId?: number;
  connect(): void;
  disconnect(): Promise<void> | void;
  switchToMonad?(): Promise<void>;
  getProvider?(): Promise<unknown>;
  getAccessToken?(): Promise<string | null>;
  retryInitialization(): void;
}

const SessionContext = createContext<SessionIdentity | null>(null);

function localId(): string {
  if (typeof window === "undefined") return "local-dev-session";
  const existing = window.localStorage.getItem("augur-session-id");
  if (existing) return existing;
  const created = `local-${window.crypto.randomUUID()}`;
  window.localStorage.setItem("augur-session-id", created);
  return created;
}

function LocalSession({ children }: { children: ReactNode }) {
  const [sessionId, setSessionId] = useState("local-dev-session");
  useEffect(() => {
    const timer = window.setTimeout(() => setSessionId(localId()), 0);
    return () => window.clearTimeout(timer);
  }, []);
  const value = useMemo<SessionIdentity>(
    () => ({
      mode: "LOCAL_DEV",
      walletState: "READY",
      ready: true,
      authenticated: false,
      sessionId,
      displayName: "Local guest",
      connect: () => undefined,
      disconnect: () => undefined,
      retryInitialization: () => window.location.reload(),
    }),
    [sessionId],
  );
  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

function UnavailableSession({
  children,
  error,
}: {
  children: ReactNode;
  error: string;
}) {
  const value = useMemo<SessionIdentity>(
    () => ({
      mode: "UNAVAILABLE",
      walletState: "ERROR",
      ready: true,
      authenticated: false,
      sessionId: "privy-unavailable",
      displayName: "Wallet unavailable",
      error,
      connect: () => undefined,
      disconnect: () => undefined,
      retryInitialization: () => window.location.reload(),
    }),
    [error],
  );
  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

function PrivySession({ children }: { children: ReactNode }) {
  const { ready, authenticated, user, login, logout, getAccessToken } =
    usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const wallet = wallets[0];
  const chainId = parseWalletChainId(wallet?.chainId);
  const [actionError, setActionError] = useState("");
  const [timedOut, setTimedOut] = useState(false);
  const initializing =
    !ready ||
    (authenticated &&
      (!walletsReady || wallets.length === 0 || chainId === undefined));

  useEffect(() => {
    if (!initializing) return;
    const timer = window.setTimeout(
      () => setTimedOut(true),
      PRIVY_INITIALIZATION_TIMEOUT_MS,
    );
    return () => window.clearTimeout(timer);
  }, [initializing]);

  const walletState = resolvePrivyWalletState({
    privyReady: ready,
    walletsReady,
    authenticated,
    walletCount: wallets.length,
    chainId,
    timedOut,
    hasError: Boolean(actionError),
  });
  const initializationError = timedOut
    ? ready
      ? "Privy authenticated, but wallet initialization did not complete"
      : "Privy initialization timed out"
    : "";

  useEffect(() => {
    console.info("[Augur wallet]", {
      ready: walletState !== "INITIALIZING",
      authenticated,
      walletCount: wallets.length,
      chainId: chainId ?? null,
    });
  }, [authenticated, chainId, walletState, wallets.length]);

  const value: SessionIdentity = {
    mode: "PRIVY",
    walletState,
    ready: walletState !== "INITIALIZING",
    authenticated,
    sessionId: user?.id ?? "privy-pending-session",
    displayName: wallet?.address
      ? `${wallet.address.slice(0, 6)}…${wallet.address.slice(-4)}`
      : "Privy user",
    error: actionError || initializationError || undefined,
    address: wallet?.address as Address | undefined,
    getAccessToken,
    chainId,
    connect: async () => {
      setActionError("");
      setTimedOut(false);
      try {
        await login();
      } catch (reason) {
        setActionError(
          reason instanceof Error ? reason.message : "Privy login failed",
        );
      }
    },
    disconnect: async () => {
      setActionError("");
      setTimedOut(false);
      try {
        await logout();
      } catch (reason) {
        setActionError(
          reason instanceof Error ? reason.message : "Privy logout failed",
        );
      }
    },
    switchToMonad: wallet
      ? async () => {
          setActionError("");
          try {
            await wallet.switchChain(MONAD_TESTNET_CHAIN_ID);
          } catch (reason) {
            setActionError(
              reason instanceof Error
                ? reason.message
                : "Monad Testnet switch failed",
            );
          }
        }
      : undefined,
    getProvider: wallet ? () => wallet.getEthereumProvider() : undefined,
    retryInitialization: () => window.location.reload(),
  };
  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

class PrivyErrorBoundary extends Component<
  {
    children: ReactNode;
    fallback: ReactNode;
  },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(): void {
    console.info("[Augur wallet]", {
      ready: false,
      authenticated: false,
      walletCount: 0,
      chainId: null,
    });
  }

  render() {
    if (this.state.failed) return this.props.fallback;
    return this.props.children;
  }
}

export function AppProviders({ children }: { children: ReactNode }) {
  const runtime = resolvePrivyRuntime({
    appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID,
    rpcUrl: process.env.NEXT_PUBLIC_MONAD_RPC_URL,
    explicitLocalMode: process.env.NEXT_PUBLIC_PRIVY_LOCAL_MODE === "true",
  });
  if (runtime.mode === "LOCAL_DEV")
    return <LocalSession>{children}</LocalSession>;
  if (runtime.mode === "UNAVAILABLE") {
    return (
      <UnavailableSession error={runtime.error}>{children}</UnavailableSession>
    );
  }
  const monadTestnet = createMonadTestnetChain(runtime.rpcUrl);
  return (
    <PrivyErrorBoundary
      fallback={
        <UnavailableSession error="Privy provider initialization failed">
          {children}
        </UnavailableSession>
      }
    >
      <PrivyProvider
        appId={runtime.appId}
        config={{
          defaultChain: monadTestnet,
          supportedChains: [monadTestnet],
          embeddedWallets: {
            ethereum: { createOnLogin: "users-without-wallets" },
          },
        }}
      >
        <PrivySession>{children}</PrivySession>
      </PrivyProvider>
    </PrivyErrorBoundary>
  );
}

export function useSession(): SessionIdentity {
  const value = useContext(SessionContext);
  if (!value) throw new Error("Session provider is missing");
  return value;
}
