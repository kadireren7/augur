"use client";

import { useMemo, useState } from "react";

import { useSession } from "@/components/providers";
import { AugurContractClient } from "@/lib/contracts";
import type { MarketView, OmenValue, TransactionFeedback } from "@/lib/types";
import type { EIP1193Provider } from "viem";

const outcomes: OmenValue[] = ["BUY", "HOLD", "SELL"];

export function MarketPanel({ market, onChanged }: { market: MarketView | null; onChanged(): Promise<void> }) {
  const session = useSession();
  const client = useMemo(() => new AugurContractClient(), []);
  const [outcome, setOutcome] = useState<OmenValue>("BUY");
  const [amount, setAmount] = useState(10);
  const [feedback, setFeedback] = useState<TransactionFeedback>({
    phase: "IDLE",
    message: "",
    mode: market?.mode ?? "LOCAL_DEMO",
  });

  if (!market) return <section className="panel"><h2>Next Omen market</h2><p className="empty">No active market.</p></section>;
  const position = market.positions[session.sessionId];
  const contractMode = market.mode === "CONTRACT" && client.configured;

  async function localAction(action: "approve" | "predict" | "claim" | "refund") {
    const body = action === "predict"
      ? { action, sessionId: session.sessionId, amount, outcome }
      : action === "approve"
        ? { action, sessionId: session.sessionId, amount }
        : { action, sessionId: session.sessionId };
    const response = await fetch(`/api/markets/${market!.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message ?? "Market action failed");
    setFeedback(result.feedback);
    await onChanged();
  }

  async function contractAction(action: "approve" | "predict" | "claim" | "refund") {
    if (!session.address || !session.getProvider) throw new Error("Connect a Privy wallet first");
    const wallet = {
      address: session.address,
      provider: (await session.getProvider()) as EIP1193Provider,
    };
    const tokenAmount = BigInt(amount) * 10n ** 18n;
    const hash = action === "approve"
      ? await client.approve(wallet, tokenAmount)
      : action === "predict"
        ? await client.predict(wallet, BigInt(market!.id), outcome, tokenAmount)
        : action === "claim"
          ? await client.claim(wallet, BigInt(market!.id))
          : await client.refund(wallet, BigInt(market!.id));
    setFeedback({ phase: "CONFIRMED", message: "Transaction confirmed.", transactionHash: hash, mode: "CONTRACT" });
    await onChanged();
  }

  async function act(action: "approve" | "predict" | "claim" | "refund") {
    setFeedback({ phase: "PENDING", message: contractMode ? "Awaiting wallet and confirmation…" : "Updating local demo state…", mode: contractMode ? "CONTRACT" : "LOCAL_DEMO" });
    try {
      if (contractMode) await contractAction(action);
      else await localAction(action);
    } catch (error) {
      setFeedback({ phase: "FAILED", message: error instanceof Error ? error.message : "Action failed", mode: contractMode ? "CONTRACT" : "LOCAL_DEMO" });
    }
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>Next Omen market</h2>
        <span className="mode-badge warning">{contractMode ? "Contract mode" : "Local demo mode"}</span>
      </div>
      <div className="market-meta">
        <span>State: <strong>{market.state}</strong></span>
        <span>Locks: <time>{new Date(market.locksAt).toLocaleTimeString()}</time></span>
        <span>Total: <strong>{market.totalPool} AUGD</strong></span>
      </div>
      <div className="outcome-grid">
        {outcomes.map((value) => (
          <button
            aria-pressed={outcome === value}
            className={`outcome-button ${value.toLowerCase()} ${outcome === value ? "selected" : ""}`}
            disabled={market.state !== "OPEN"}
            key={value}
            onClick={() => setOutcome(value)}
            type="button"
          >
            <strong>{value}</strong><span>{market.pools[value]} AUGD</span>
          </button>
        ))}
      </div>
      <label className="field">Amount (demo tokens)
        <input min="1" max="1000000" onChange={(event) => setAmount(Number(event.target.value))} type="number" value={amount} />
      </label>
      <div className="button-row">
        <button className="button secondary" disabled={feedback.phase === "PENDING" || market.state !== "OPEN"} onClick={() => void act("approve")} type="button">Approve</button>
        <button className="button" disabled={feedback.phase === "PENDING" || market.state !== "OPEN"} onClick={() => void act("predict")} type="button">Predict {outcome}</button>
        {market.state === "RESOLVED" && <button className="button" onClick={() => void act("claim")} type="button">Claim</button>}
        {market.state === "CANCELLED" && <button className="button" onClick={() => void act("refund")} type="button">Refund</button>}
      </div>
      {position && <p className="muted">Your position — BUY {position.BUY}, HOLD {position.HOLD}, SELL {position.SELL}; claimable {position.claimable}; refundable {position.refundable}</p>}
      {feedback.phase !== "IDLE" && (
        <div className={`transaction-state ${feedback.phase.toLowerCase()}`} role="status">
          <strong>{feedback.phase}</strong> {feedback.message}
          {feedback.transactionHash && <code className="hash">{feedback.transactionHash}</code>}
        </div>
      )}
    </section>
  );
}
