"use client";

import { useSession } from "@/components/providers";

export function WalletStatus() {
  const session = useSession();
  if (!session.ready) return <span className="mode-badge">Wallet loading</span>;
  if (session.mode === "LOCAL_DEV") {
    return <span className="mode-badge warning">Local dev session · not authenticated</span>;
  }
  if (!session.authenticated) {
    return (
      <button className="button compact" onClick={session.connect} type="button">
        Connect with Privy
      </button>
    );
  }
  return (
    <div className="wallet-row">
      <span className="mode-badge success">{session.displayName}</span>
      <button className="button secondary compact" onClick={() => void session.disconnect()} type="button">
        Disconnect
      </button>
    </div>
  );
}
