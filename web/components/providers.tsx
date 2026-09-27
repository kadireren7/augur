"use client";

import { PrivyProvider, usePrivy, useWallets } from "@privy-io/react-auth";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Address } from "viem";

interface SessionIdentity {
  mode: "PRIVY" | "LOCAL_DEV";
  ready: boolean;
  authenticated: boolean;
  sessionId: string;
  displayName: string;
  error?: string;
  address?: Address;
  connect(): void;
  disconnect(): Promise<void> | void;
  getProvider?(): Promise<unknown>;
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
      ready: true,
      authenticated: false,
      sessionId,
      displayName: "Local guest",
      connect: () => undefined,
      disconnect: () => undefined,
    }),
    [sessionId],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

function PrivySession({ children }: { children: ReactNode }) {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { wallets } = useWallets();
  const wallet = wallets[0];
  const [error, setError] = useState("");
  const value = useMemo<SessionIdentity>(
    () => ({
      mode: "PRIVY",
      ready,
      authenticated,
      sessionId: wallet?.address ?? user?.id ?? "privy-pending-session",
      displayName: wallet?.address ? `${wallet.address.slice(0, 6)}…${wallet.address.slice(-4)}` : "Privy user",
      error: error || undefined,
      address: wallet?.address as Address | undefined,
      connect: async () => {
        setError("");
        try {
          await login();
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : "Privy login failed");
        }
      },
      disconnect: async () => {
        setError("");
        try {
          await logout();
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : "Privy logout failed");
        }
      },
      getProvider: wallet ? () => wallet.getEthereumProvider() : undefined,
    }),
    [authenticated, error, login, logout, ready, user?.id, wallet],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function AppProviders({ children }: { children: ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  if (!appId) return <LocalSession>{children}</LocalSession>;
  return (
    <PrivyProvider appId={appId} config={{ embeddedWallets: { ethereum: { createOnLogin: "users-without-wallets" } } }}>
      <PrivySession>{children}</PrivySession>
    </PrivyProvider>
  );
}

export function useSession(): SessionIdentity {
  const value = useContext(SessionContext);
  if (!value) throw new Error("Session provider is missing");
  return value;
}
