"use client";

import { useEffect, useMemo, useState } from "react";

import { useSession } from "@/components/providers";
import { AugurContractClient } from "@/lib/contracts";
import { executeApprovalClick } from "@/lib/market-actions";
import type { MarketView, OmenValue, TransactionFeedback } from "@/lib/types";
import { walletError } from "@/lib/wallet-errors";
import type { EIP1193Provider } from "viem";

const outcomes: OmenValue[] = ["BUY", "HOLD", "SELL"];

function idleFeedback(mode: "LOCAL_DEMO" | "CONTRACT"): TransactionFeedback {
  return { phase: "IDLE", message: "", mode };
}

export function MarketPanel({ market, onChanged }: { market: MarketView | null; onChanged(): Promise<void> }) {
  const session = useSession();
  const client = useMemo(() => new AugurContractClient(), []);
  const [outcome, setOutcome] = useState<OmenValue>("BUY");
  const [amount, setAmount] = useState(1);
  const [approvalPreflight, setApprovalPreflight] = useState<{
    status: "IDLE" | "CHECKING" | "READY" | "FAILED";
    message: string;
  }>({ status: "IDLE", message: "" });
  const initialMode = market?.mode ?? "LOCAL_DEMO";
  const [approvalFeedback, setApprovalFeedback] = useState<TransactionFeedback>(() => idleFeedback(initialMode));
  const [predictionFeedback, setPredictionFeedback] = useState<TransactionFeedback>(() => idleFeedback(initialMode));
  const [settlementFeedback, setSettlementFeedback] = useState<TransactionFeedback>(() => idleFeedback(initialMode));
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const contractMode = market?.mode === "CONTRACT" && client.configured;
  const sessionAddress = session.address;
  const getSessionProvider = session.getProvider;
  useEffect(() => {
    if (!contractMode || !sessionAddress || !getSessionProvider) return;
    let cancelled = false;
    void Promise.resolve()
      .then(() => {
        if (!cancelled) setApprovalPreflight({ status: "CHECKING", message: "Validating DemoToken approval…" });
        return getSessionProvider();
      })
      .then((provider) => client.validateApproval(
        { address: sessionAddress, provider: provider as EIP1193Provider },
        BigInt(amount) * 10n ** 18n,
      ))
      .then((result) => {
        if (!cancelled) setApprovalPreflight({
          status: "READY",
          message: `Approval ready · estimated gas ${result.gasEstimate}`,
        });
      })
      .catch((error) => {
        if (!cancelled) setApprovalPreflight({
          status: "FAILED",
          message: error instanceof Error ? error.message : "Approval validation failed",
        });
    });
    return () => { cancelled = true; };
  }, [amount, client, contractMode, getSessionProvider, sessionAddress]);

  if (!market) return <section className="panel"><h2>Next Omen market</h2><p className="empty">No active market.</p></section>;
  const position = market.positions[session.sessionId];

  async function localAction(
    action: "approve" | "predict" | "claim" | "refund",
    setActionFeedback: (value: TransactionFeedback) => void,
  ) {
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
    setActionFeedback(result.feedback);
    await onChanged();
  }

  async function contractWallet() {
    if (!session.address || !session.getProvider) throw new Error("Connect a Privy wallet first");
    return {
      address: session.address,
      provider: (await session.getProvider()) as EIP1193Provider,
    };
  }

  async function approveContract() {
    const wallet = await contractWallet();
    const tokenAmount = BigInt(amount) * 10n ** 18n;
    const onSubmitted = (transactionHash: `0x${string}`) => setApprovalFeedback({
      phase: "PENDING",
      message: "Approval submitted; awaiting confirmation…",
      transactionHash,
      mode: "CONTRACT",
    });
    const hash = await executeApprovalClick(client, wallet, tokenAmount, onSubmitted);
    setApprovalFeedback({ phase: "CONFIRMED", message: "Approval confirmed.", transactionHash: hash, mode: "CONTRACT" });
    await onChanged();
  }

  async function predictContract() {
    const wallet = await contractWallet();
    const tokenAmount = BigInt(amount) * 10n ** 18n;
    const onSubmitted = (transactionHash: `0x${string}`) => setPredictionFeedback({
      phase: "PENDING",
      message: "Prediction submitted; awaiting confirmation…",
      transactionHash,
      mode: "CONTRACT",
    });
    const hash = await client.predict(wallet, BigInt(market!.id), outcome, tokenAmount, onSubmitted);
    setPredictionFeedback({ phase: "CONFIRMED", message: "Prediction confirmed.", transactionHash: hash, mode: "CONTRACT" });
    await onChanged();
  }

  async function settleContract(action: "claim" | "refund") {
    const wallet = await contractWallet();
    const onSubmitted = (transactionHash: `0x${string}`) => setSettlementFeedback({
      phase: "PENDING",
      message: `${action === "claim" ? "Claim" : "Refund"} submitted; awaiting confirmation…`,
      transactionHash,
      mode: "CONTRACT",
    });
    const hash = action === "claim"
      ? await client.claim(wallet, BigInt(market!.id), onSubmitted)
      : await client.refund(wallet, BigInt(market!.id), onSubmitted);
    setSettlementFeedback({ phase: "CONFIRMED", message: `${action === "claim" ? "Claim" : "Refund"} confirmed.`, transactionHash: hash, mode: "CONTRACT" });
    await onChanged();
  }

  async function runApproval() {
    const mode = contractMode ? "CONTRACT" : "LOCAL_DEMO";
    setApprovalFeedback({ phase: "PENDING", message: contractMode ? "Awaiting approval signature…" : "Updating local demo approval…", mode });
    setPredictionFeedback(idleFeedback(mode));
    try {
      if (contractMode) await approveContract();
      else await localAction("approve", setApprovalFeedback);
    } catch (error) {
      const failure = walletError(error, "Approval failed");
      setApprovalFeedback({
        phase: failure.phase,
        message: failure.message,
        mode,
      });
    }
  }

  async function runPrediction() {
    const mode = contractMode ? "CONTRACT" : "LOCAL_DEMO";
    setPredictionFeedback({ phase: "PENDING", message: contractMode ? "Awaiting prediction signature…" : "Updating local demo prediction…", mode });
    try {
      if (contractMode) await predictContract();
      else await localAction("predict", setPredictionFeedback);
    } catch (error) {
      const failure = walletError(error, "Prediction failed");
      setPredictionFeedback({ phase: failure.phase, message: failure.message, mode });
    }
  }

  async function runSettlement(action: "claim" | "refund") {
    const mode = contractMode ? "CONTRACT" : "LOCAL_DEMO";
    setSettlementFeedback({ phase: "PENDING", message: contractMode ? "Awaiting wallet and confirmation…" : "Updating local demo state…", mode });
    try {
      if (contractMode) await settleContract(action);
      else await localAction(action, setSettlementFeedback);
    } catch (error) {
      const failure = walletError(error, `${action === "claim" ? "Claim" : "Refund"} failed`);
      setSettlementFeedback({ phase: failure.phase, message: failure.message, mode });
    }
  }

  const remaining = Math.max(0, new Date(market.locksAt).getTime() - clock);
  const countdown = market.state === "OPEN"
    ? `${Math.floor(remaining / 60_000)}m ${Math.floor((remaining % 60_000) / 1_000)}s`
    : "Closed";
  const transactionPending = approvalFeedback.phase === "PENDING"
    || predictionFeedback.phase === "PENDING"
    || settlementFeedback.phase === "PENDING";

  function transactionStatus(label: string, feedback: TransactionFeedback) {
    if (feedback.phase === "IDLE") return null;
    return (
      <div className={`transaction-state ${feedback.phase.toLowerCase()}`} role="status">
        <strong>{label} · {feedback.phase}</strong> {feedback.message}
        {feedback.transactionHash && <code className="hash">{feedback.transactionHash}</code>}
      </div>
    );
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>Next Omen market</h2>
        <span className="mode-badge warning">{contractMode ? "Contract mode" : "Local demo mode"}</span>
      </div>
      <div className="market-meta">
        <span>State: <strong>{market.state}</strong></span>
        <span>Countdown: <strong>{countdown}</strong></span>
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
        <button className="button secondary" disabled={transactionPending || market.state !== "OPEN" || (contractMode && approvalPreflight.status !== "READY")} onClick={() => void runApproval()} type="button">Approve</button>
        <button className="button" disabled={transactionPending || market.state !== "OPEN"} onClick={() => void runPrediction()} type="button">Predict {outcome}</button>
        {market.state === "RESOLVED" && <button className="button" disabled={transactionPending} onClick={() => void runSettlement("claim")} type="button">Claim</button>}
        {market.state === "CANCELLED" && <button className="button" disabled={transactionPending} onClick={() => void runSettlement("refund")} type="button">Refund</button>}
      </div>
      {contractMode && approvalPreflight.status !== "IDLE" && (
        <p className={approvalPreflight.status === "FAILED" ? "error" : "notice"} role="status">
          {approvalPreflight.message}
        </p>
      )}
      {position && <p className="muted">Your position — BUY {position.BUY}, HOLD {position.HOLD}, SELL {position.SELL}; claimable {position.claimable}; refundable {position.refundable}</p>}
      {transactionStatus("APPROVAL", approvalFeedback)}
      {transactionStatus("PREDICTION", predictionFeedback)}
      {transactionStatus("SETTLEMENT", settlementFeedback)}
    </section>
  );
}
