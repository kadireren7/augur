"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { AnimatePresence, motion } from "motion/react";

import { useSession } from "@/components/providers";
import { authHeaders } from "@/lib/auth-headers";
import type { ChatMessage, ReactionPulse, ReactionValue } from "@/lib/types";

const reactions: ReactionValue[] = ["BUY", "HOLD", "SELL", "HYPE", "RIP"];

export function SocialPanel({ chamberId }: { chamberId: string }) {
  const session = useSession();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pulse, setPulse] = useState<ReactionPulse | null>(null);
  const [displayName, setDisplayName] = useState("Guest");
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [readError, setReadError] = useState("");
  const [burst, setBurst] = useState<{
    id: number;
    reaction: ReactionValue;
  } | null>(null);
  const burstId = useRef(0);

  const refresh = useCallback(async () => {
    try {
      const [chatResponse, pulseResponse] = await Promise.all([
        fetch(`/api/chat?chamberId=${encodeURIComponent(chamberId)}`, {
          cache: "no-store",
          signal: AbortSignal.timeout(5000),
        }),
        fetch(`/api/reactions?chamberId=${encodeURIComponent(chamberId)}`, {
          cache: "no-store",
          signal: AbortSignal.timeout(5000),
        }),
      ]);
      if (!chatResponse.ok || !pulseResponse.ok) throw new Error();
      setMessages((await chatResponse.json()).messages);
      setPulse((await pulseResponse.json()).pulse);
      setReadError("");
    } catch {
      setReadError(
        "Offchain crowd and chat unavailable. No local data substituted.",
      );
    }
  }, [chamberId]);

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, 15_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [refresh]);

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: await authHeaders(session),
        signal: AbortSignal.timeout(10000),
        body: JSON.stringify({
          chamberId,
          displayName,
          text,
        }),
      });
      const body = await response.json();
      if (!response.ok) return setError(body.message ?? "Message rejected");
      setText("");
      await refresh();
    } catch {
      setError("Chat service unavailable. Message was not confirmed.");
    }
  }

  async function react(reaction: ReactionValue) {
    setError("");
    try {
      const response = await fetch("/api/reactions", {
        method: "POST",
        headers: await authHeaders(session),
        signal: AbortSignal.timeout(10000),
        body: JSON.stringify({
          chamberId,
          reaction,
        }),
      });
      const body = await response.json();
      if (!response.ok) return setError(body.message ?? "Reaction rejected");
      setPulse(body.pulse);
      setBurst({ id: ++burstId.current, reaction });
      window.setTimeout(() => setBurst(null), 900);
    } catch {
      setError("Reaction service unavailable. Reaction was not confirmed.");
    }
  }

  return (
    <section className="panel social-panel">
      <div className="panel-heading">
        <h2>Crowd</h2>
      </div>
      <div className="pulse" aria-label="Crowd pulse">
        <span>BUY {pulse?.percentages.BUY ?? "—"}%</span>
        <span>HOLD {pulse?.percentages.HOLD ?? "—"}%</span>
        <span>SELL {pulse?.percentages.SELL ?? "—"}%</span>
      </div>
      <div className="reaction-row">
        {reactions.map((reaction) => (
          <button
            className="button secondary compact"
            key={reaction}
            disabled={!session.authenticated}
            onClick={() => void react(reaction)}
            type="button"
          >
            {reaction}
          </button>
        ))}
      </div>
      <AnimatePresence>
        {burst && (
          <motion.span
            key={burst.id}
            className="reaction-burst"
            initial={{ opacity: 0, y: 12, scale: 0.85 }}
            animate={{ opacity: 1, y: -12, scale: 1 }}
            exit={{ opacity: 0, y: -30 }}
          >
            {burst.reaction}
          </motion.span>
        )}
      </AnimatePresence>
      <div className="chat-log" aria-live="polite">
        {messages.length === 0 && (
          <p className="empty">
            {readError
              ? "Chat unavailable."
              : pulse
                ? "No messages yet."
                : "Loading conversation…"}
          </p>
        )}
        {messages.map((message) => (
          <p key={message.id}>
            <strong>{message.displayName}</strong>{" "}
            <time>{new Date(message.createdAt).toLocaleTimeString()}</time>
            <br />
            {message.text}
          </p>
        ))}
      </div>
      <form className="chat-form" onSubmit={(event) => void sendMessage(event)}>
        <input
          aria-label="Display name"
          disabled={!session.authenticated}
          maxLength={32}
          onChange={(event) => setDisplayName(event.target.value)}
          value={displayName}
        />
        <input
          aria-label="Chat message"
          disabled={!session.authenticated}
          maxLength={280}
          onChange={(event) => setText(event.target.value)}
          placeholder="Message this Chamber"
          required
          value={text}
        />
        <button
          className="button"
          type="submit"
          disabled={!session.authenticated}
        >
          Send
        </button>
      </form>
      {!session.authenticated && (
        <button className="button secondary compact" onClick={session.connect} type="button">
          Log in to chat or react
        </button>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {readError && (
        <p className="error" role="alert">
          {readError}
        </p>
      )}
      <p className="muted">
        Social sentiment never affects Omens, oracle validation, or settlement.
      </p>
    </section>
  );
}
