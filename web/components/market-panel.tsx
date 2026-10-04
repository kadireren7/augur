"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { StateReveal } from "@/components/motion-system";
import { PayoutGuide } from "@/components/payout-guide";

import { formatAugd, poolPercentage } from "@/lib/token-amount";
import { useSession } from "@/components/providers";
import { AugurContractClient } from "@/lib/contracts";
import { executeApprovalClick } from "@/lib/market-actions";
import type { MarketView, OmenValue, TransactionFeedback } from "@/lib/types";
import { walletError } from "@/lib/wallet-errors";
import { estimatePayout } from "@/lib/payout-estimate";
import { authHeaders } from "@/lib/auth-headers";
import { AnimatedAmount } from "@/components/animated-amount";
import type { EIP1193Provider } from "viem";

const outcomes: OmenValue[] = ["BUY", "HOLD", "SELL"];

function idleFeedback(mode: "LOCAL_DEMO" | "CONTRACT"): TransactionFeedback {
  return { phase: "IDLE", message: "", mode };
}

export function MarketPanel({
  market,
  onChanged,
}: {
  market: MarketView | null;
  onChanged(): Promise<void>;
}) {
  const session = useSession();
  const client = useMemo(() => new AugurContractClient(), []);
  const [outcome, setOutcome] = useState<OmenValue>("BUY");
  const [amount, setAmount] = useState(1);
  const [approvalPreflight, setApprovalPreflight] = useState<{
    status: "IDLE" | "CHECKING" | "READY" | "FAILED";
    message: string;
  }>({ status: "IDLE", message: "" });
  const initialMode = market?.mode ?? "LOCAL_DEMO";
  const [approvalFeedback, setApprovalFeedback] = useState<TransactionFeedback>(
    () => idleFeedback(initialMode),
  );
  const [predictionFeedback, setPredictionFeedback] =
    useState<TransactionFeedback>(() => idleFeedback(initialMode));
  const [settlementFeedback, setSettlementFeedback] =
    useState<TransactionFeedback>(() => idleFeedback(initialMode));
  // Server and first browser render must agree, including near a second boundary.
  const [clock, setClock] = useState<number | null>(null);
  const [chainPosition, setChainPosition] = useState<{
    BUY: string;
    HOLD: string;
    SELL: string;
    total: string;
    claimed: boolean;
    account: string;
    marketId: number;
  } | null>(null);
  const [positionError, setPositionError] = useState("");
  useEffect(() => {
    if (
      market?.mode !== "CONTRACT" ||
      !session.authenticated ||
      !session.address
    )
      return;
    let disposed = false;
    void fetch(`/api/markets/${market.id}/position?wallet=${session.address}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.message);
        if (!disposed) {
          setChainPosition({
            ...body.position,
            account: session.address!,
            marketId: market.id,
          });
          setPositionError("");
        }
      })
      .catch((error) => {
        if (!disposed) {
          setChainPosition(null);
          setPositionError(
            error instanceof Error ? error.message : "Position unavailable",
          );
        }
      });
    return () => {
      disposed = true;
    };
  }, [
    market?.id,
    market?.mode,
    session.address,
    session.authenticated,
    predictionFeedback.phase,
    settlementFeedback.phase,
  ]);
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const contractMode = market?.mode === "CONTRACT";
  const contractUnavailable = contractMode && !client.configured;
  const sessionAddress = session.address;
  const getSessionProvider = session.getProvider;
  useEffect(() => {
    if (
      !contractMode ||
      !client.configured ||
      !sessionAddress ||
      !getSessionProvider
    )
      return;
    let cancelled = false;
    void Promise.resolve()
      .then(() => {
        if (!cancelled)
          setApprovalPreflight({
            status: "CHECKING",
            message: "Validating DemoToken approval…",
          });
        return getSessionProvider();
      })
      .then((provider) =>
        client.validateApproval(
          { address: sessionAddress, provider: provider as EIP1193Provider },
          BigInt(amount) * 10n ** 18n,
        ),
      )
      .then((result) => {
        if (!cancelled)
          setApprovalPreflight({
            status: "READY",
            message: `Approval ready · estimated gas ${result.gasEstimate}`,
          });
      })
      .catch((error) => {
        if (!cancelled)
          setApprovalPreflight({
            status: "FAILED",
            message:
              error instanceof Error
                ? error.message
                : "Approval validation failed",
          });
      });
    return () => {
      cancelled = true;
    };
  }, [amount, client, contractMode, getSessionProvider, sessionAddress]);

  if (!market)
    return (
      <section className="panel">
        <h2>Next Omen market</h2>
        <p className="empty">No active market.</p>
      </section>
    );
  const position = session.authenticated
    ? market.positions[session.sessionId]
    : undefined;

  async function localAction(
    action: "approve" | "predict" | "claim" | "refund",
    setActionFeedback: (value: TransactionFeedback) => void,
  ) {
    const body =
      action === "predict"
        ? { action, sessionId: session.sessionId, amount, outcome }
        : action === "approve"
          ? { action, sessionId: session.sessionId, amount }
          : { action, sessionId: session.sessionId };
    const response = await fetch(`/api/markets/${market!.id}`, {
      method: "POST",
      headers: await authHeaders(session),
      body: JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message ?? "Market action failed");
    setActionFeedback(result.feedback);
    await onChanged();
  }

  async function contractWallet() {
    if (!session.address || !session.getProvider)
      throw new Error("Connect a Privy wallet first");
    return {
      address: session.address,
      provider: (await session.getProvider()) as EIP1193Provider,
    };
  }

  async function approveContract() {
    const wallet = await contractWallet();
    const tokenAmount = BigInt(amount) * 10n ** 18n;
    const onSubmitted = (transactionHash: `0x${string}`) =>
      setApprovalFeedback({
        phase: "PENDING",
        message: "Approval submitted; awaiting confirmation…",
        transactionHash,
        mode: "CONTRACT",
      });
    const hash = await executeApprovalClick(
      client,
      wallet,
      tokenAmount,
      onSubmitted,
    );
    setApprovalFeedback({
      phase: "CONFIRMED",
      message: "Approval confirmed.",
      transactionHash: hash,
      mode: "CONTRACT",
    });
    await onChanged();
  }

  async function predictContract() {
    const wallet = await contractWallet();
    const tokenAmount = BigInt(amount) * 10n ** 18n;
    const onSubmitted = (transactionHash: `0x${string}`) =>
      setPredictionFeedback({
        phase: "PENDING",
        message: "Prediction submitted; awaiting confirmation…",
        transactionHash,
        mode: "CONTRACT",
      });
    const hash = await client.predict(
      wallet,
      BigInt(market!.id),
      outcome,
      tokenAmount,
      onSubmitted,
    );
    setPredictionFeedback({
      phase: "CONFIRMED",
      message: "Prediction confirmed.",
      transactionHash: hash,
      mode: "CONTRACT",
    });
    await onChanged();
  }

  async function settleContract(action: "claim" | "refund") {
    const wallet = await contractWallet();
    const onSubmitted = (transactionHash: `0x${string}`) =>
      setSettlementFeedback({
        phase: "PENDING",
        message: `${action === "claim" ? "Claim" : "Refund"} submitted; awaiting confirmation…`,
        transactionHash,
        mode: "CONTRACT",
      });
    const hash =
      action === "claim"
        ? await client.claim(wallet, BigInt(market!.id), onSubmitted)
        : await client.refund(wallet, BigInt(market!.id), onSubmitted);
    setSettlementFeedback({
      phase: "CONFIRMED",
      message: `${action === "claim" ? "Claim" : "Refund"} confirmed.`,
      transactionHash: hash,
      mode: "CONTRACT",
    });
    await onChanged();
  }

  async function runApproval() {
    const mode = contractMode ? "CONTRACT" : "LOCAL_DEMO";
    setApprovalFeedback({
      phase: "PENDING",
      message: contractMode
        ? "Awaiting approval signature…"
        : "Updating local demo approval…",
      mode,
    });
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
    setPredictionFeedback({
      phase: "PENDING",
      message: contractMode
        ? "Awaiting prediction signature…"
        : "Updating local demo prediction…",
      mode,
    });
    try {
      if (contractMode) await predictContract();
      else await localAction("predict", setPredictionFeedback);
    } catch (error) {
      const failure = walletError(error, "Prediction failed");
      setPredictionFeedback({
        phase: failure.phase,
        message: failure.message,
        mode,
      });
    }
  }

  async function runSettlement(action: "claim" | "refund") {
    const mode = contractMode ? "CONTRACT" : "LOCAL_DEMO";
    setSettlementFeedback({
      phase: "PENDING",
      message: contractMode
        ? "Awaiting wallet and confirmation…"
        : "Updating local demo state…",
      mode,
    });
    try {
      if (contractMode) await settleContract(action);
      else await localAction(action, setSettlementFeedback);
    } catch (error) {
      const failure = walletError(
        error,
        `${action === "claim" ? "Claim" : "Refund"} failed`,
      );
      setSettlementFeedback({
        phase: failure.phase,
        message: failure.message,
        mode,
      });
    }
  }

  const remaining =
    clock === null
      ? 0
      : Math.max(0, new Date(market.locksAt).getTime() - clock);
  const validAmount =
    Number.isSafeInteger(amount) && amount >= 1 && amount <= 1_000_000;
  const predictionOpen = market.state === "OPEN" && remaining > 0;
  const walletUnavailable =
    !session.authenticated ||
    (contractMode && (!session.address || session.chainId !== 10143));
  const estimate = estimatePayout(market, outcome, amount);
  const countdown =
    market.state === "OPEN"
      ? clock === null
        ? "Synchronizing…"
        : remaining === 0
          ? "Lock time reached"
          : `${Math.floor(remaining / 60_000)}m ${Math.floor((remaining % 60_000) / 1_000)}s`
      : "Closed";
  const transactionPending =
    approvalFeedback.phase === "PENDING" ||
    predictionFeedback.phase === "PENDING" ||
    settlementFeedback.phase === "PENDING";

  function transactionStatus(label: string, feedback: TransactionFeedback) {
    if (feedback.phase === "IDLE") return null;
    return (
      <StateReveal identity={`${label}-${feedback.phase}`}>
        <div
          className={`transaction-state ${feedback.phase.toLowerCase()}`}
          role="status"
        >
          <strong>
            {label} · {feedback.phase}
          </strong>{" "}
          {feedback.message}
          {feedback.transactionHash && (
            <code className="hash">{feedback.transactionHash}</code>
          )}
        </div>
      </StateReveal>
    );
  }

  return (
    <section
      className="panel market-terminal"
      data-contract-mode={contractMode}
    >
      <div className="panel-heading">
        <h2>Next Omen market</h2>
        <StateReveal identity={market.state}>
          <span className={`mode-badge ${market.state.toLowerCase()}`}>
            {market.state}
          </span>
        </StateReveal>
      </div>
      <div className="market-meta">
        <span
          className={
            market.state === "OPEN" && remaining > 0 && remaining < 30000
              ? "countdown-urgent"
              : ""
          }
        >
          Countdown: <strong>{countdown}</strong>
        </span>
        <span>
          Total pool:{" "}
          <strong>
            <AnimatedAmount value={market.totalPool} /> AUGD
          </strong>
        </span>
      </div>
      <div className="outcome-grid">
        {outcomes.map((value) => (
          <motion.button
            whileTap={{ scale: 0.97 }}
            aria-pressed={outcome === value}
            className={`outcome-button ${value.toLowerCase()} ${outcome === value ? "selected" : ""}`}
            key={value}
            onClick={() => setOutcome(value)}
            type="button"
          >
            <strong>{value}</strong>
            <span>
              <AnimatedAmount value={market.pools[value]} /> AUGD
            </span>
            <small>
              {poolPercentage(market.pools[value], market.totalPool)}% of pool
            </small>
            <motion.i
              className="pool-bar"
              initial={false}
              animate={{
                width: `${poolPercentage(market.pools[value], market.totalPool)}%`,
              }}
              transition={{ duration: 0.55 }}
            />
          </motion.button>
        ))}
      </div>
      <label className="field">
        Your stake · AUGD
        <input
          min="1"
          max="1000000"
          onChange={(event) => setAmount(Number(event.target.value))}
          type="number"
          value={amount}
        />
        {!validAmount && (
          <small className="error">
            Use a whole AUGD amount from 1 to 1,000,000.
          </small>
        )}
      </label>
      <div className="payout-estimate" aria-live="polite">
        <span>
          {predictionOpen
            ? `If ${outcome} wins`
            : `Hypothetical ${outcome} stake`}
        </span>
        <StateReveal identity={`${outcome}-${amount}-${market.totalPool}`}>
          <strong
            title={estimate ? `${formatAugd(estimate.payout)} AUGD` : undefined}
          >
            {estimate
              ? formatAugd(estimate.payout).replace(/(\.\d{4})\d+$/, "$1")
              : "—"}{" "}
            AUGD
          </strong>
        </StateReveal>
        <small>
          {estimate
            ? `${Number(estimate.shareBasisPoints) / 100}% of resulting winning pool`
            : "Enter a valid stake"}{" "}
          · includes your new stake; not a guaranteed payout.
        </small>
      </div>
      {!session.authenticated && (
        <button
          className="button login-market"
          type="button"
          onClick={session.connect}
        >
          Log in to take a position
        </button>
      )}
      {contractMode && (
        <p className="stake-permission">
          If your stake needs permission, approve AUGD first. Predict places your position; approval alone does not.
        </p>
      )}
      <div className="button-row">
        <button
          className="button secondary"
          disabled={
            transactionPending ||
            !predictionOpen ||
            !validAmount ||
            contractUnavailable ||
            walletUnavailable ||
            (contractMode && approvalPreflight.status !== "READY")
          }
          onClick={() => void runApproval()}
          type="button"
        >
          Approve
        </button>
        <button
          className="button"
          disabled={
            transactionPending ||
            !predictionOpen ||
            !validAmount ||
            contractUnavailable ||
            walletUnavailable
          }
          onClick={() => void runPrediction()}
          type="button"
        >
          Predict {outcome}
        </button>
        {market.state === "RESOLVED" && (
          <button
            className="button"
            disabled={
              transactionPending || contractUnavailable || walletUnavailable
            }
            onClick={() => void runSettlement("claim")}
            type="button"
          >
            Claim
          </button>
        )}
        {market.state === "CANCELLED" && (
          <button
            className="button"
            disabled={
              transactionPending || contractUnavailable || walletUnavailable
            }
            onClick={() => void runSettlement("refund")}
            type="button"
          >
            Refund
          </button>
        )}
      </div>
      {contractMode && approvalPreflight.status !== "IDLE" && (
        <div
          className={approvalPreflight.status === "FAILED" ? "error" : "notice"}
          role="status"
        >
          {approvalPreflight.status === "FAILED" ? approvalPreflight.message : (
            <>
              {approvalPreflight.status === "READY" ? "Your stake is ready for approval." : "Checking stake approval…"}
              <details className="approval-details"><summary>Approval details</summary>{approvalPreflight.message}</details>
            </>
          )}
        </div>
      )}
      {position && (
        <p className="muted">
          Your position — BUY {position.BUY}, HOLD {position.HOLD}, SELL{" "}
          {position.SELL}; claimable {position.claimable}; refundable{" "}
          {position.refundable}
        </p>
      )}
      {contractUnavailable && (
        <p className="error" role="alert">
          Contract RPC configuration unavailable. No local transaction
          substituted.
        </p>
      )}
      {!contractUnavailable && walletUnavailable && (
        <p className="muted">
          {session.authenticated
            ? "Switch your wallet to Monad Testnet 10143."
            : "Public market data remains available without login."}
        </p>
      )}
      {contractMode && session.authenticated && session.address && (
        <div className="wallet-position">
          <p className="eyebrow">Your onchain position</p>
          {chainPosition?.account === session.address &&
          chainPosition.marketId === market.id ? (
            <p>
              BUY {formatAugd(chainPosition.BUY)} · HOLD{" "}
              {formatAugd(chainPosition.HOLD)} · SELL{" "}
              {formatAugd(chainPosition.SELL)} AUGD
              <br />
              <small>
                {chainPosition.claimed
                  ? "Already claimed / refunded"
                  : "Not yet claimed"}
              </small>
            </p>
          ) : (
            <p className="muted">{positionError || "Reading your position…"}</p>
          )}
        </div>
      )}
      {transactionStatus("APPROVAL", approvalFeedback)}
      {transactionStatus("PREDICTION", predictionFeedback)}
      {transactionStatus("SETTLEMENT", settlementFeedback)}
      <PayoutGuide />
      <details className="technical-details">
        <summary>Market details</summary>
        <p>
          Market #{market.id} · {contractMode ? "Contract mode" : "Simulation"}.
          Lock: {new Date(market.locksAt).toISOString()}. Pool share describes
          stake distribution, not a calibrated probability.
        </p>
      </details>
    </section>
  );
}
