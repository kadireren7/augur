"use client";

import { useSession } from "@/components/providers";
import { MONAD_TESTNET_CHAIN_ID } from "@/lib/privy-config";

export function WalletStatus() {
  const session = useSession();
  if (session.walletState === "INITIALIZING") {
    return <span className="mode-badge">Privy initializing</span>;
  }
  if (session.walletState === "ERROR") {
    return (
      <div className="wallet-row">
        <span className="mode-badge warning">Wallet error</span>
        <span className="error" role="alert">{session.error ?? "Wallet initialization failed"}</span>
        {!session.authenticated && session.mode === "PRIVY" && (
          <button className="button compact" onClick={session.connect} type="button">Connect with Privy</button>
        )}
        <button className="button secondary compact" onClick={session.retryInitialization} type="button">Retry wallet</button>
      </div>
    );
  }
  if (session.mode === "UNAVAILABLE") {
    return <span className="error" role="alert">{session.error}</span>;
  }
  if (session.mode === "LOCAL_DEV") {
    return <span className="mode-badge warning">Local dev session · not authenticated</span>;
  }
  if (session.walletState === "LOGIN_REQUIRED") {
    return (
      <div className="wallet-row"><button className="button compact" onClick={session.connect} type="button">Connect with Privy</button>{session.error && <span className="error" role="alert">{session.error}</span>}</div>
    );
  }
  const wrongChain = session.chainId !== MONAD_TESTNET_CHAIN_ID;
  return (
    <div className="wallet-row">
      <span className="mode-badge success">{session.displayName}</span>
      <span className={`mode-badge ${wrongChain ? "warning" : "success"}`}>
        {wrongChain ? `Wrong chain · ${session.chainId}` : "Monad Testnet · 10143"}
      </span>
      {wrongChain && session.switchToMonad && (
        <button className="button compact" onClick={() => void session.switchToMonad?.()} type="button">
          Switch network
        </button>
      )}
      <button className="button secondary compact" onClick={() => void session.disconnect()} type="button">
        Disconnect
      </button>
      {session.error && <span className="error" role="alert">{session.error}</span>}
    </div>
  );
}
