"use client";
import { useEffect, useState } from "react";
import { useSession } from "./providers";
import { authHeaders } from "@/lib/auth-headers";
export function ChamberFavorite({ chamberId }: { chamberId: string }) {
  const session = useSession(),
    [result, setResult] = useState<{ owner: string; favorite: boolean } | null>(
      null,
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (!session.authenticated) return;
    let disposed = false;
    void authHeaders(session)
      .then((headers) =>
        fetch("/api/favorites", {
          headers,
          signal: AbortSignal.timeout(10000),
        }),
      )
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok)
          throw new Error(body.message ?? "Saved Chambers unavailable");
        if (!disposed)
          setResult({
            owner: session.sessionId,
            favorite: body.favorites.some(
              (value: { chamber_id: string }) => value.chamber_id === chamberId,
            ),
          });
      })
      .catch(() => {
        if (!disposed) setError("Saved Chambers unavailable.");
      });
    return () => {
      disposed = true;
    };
  }, [session, chamberId]);
  const saved =
    session.authenticated &&
    result?.owner === session.sessionId &&
    result.favorite;
  async function toggle() {
    if (!session.authenticated) {
      session.connect();
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/favorites", {
        method: "POST",
        headers: await authHeaders(session),
        body: JSON.stringify({ chamberId, favorite: !saved }),
        signal: AbortSignal.timeout(10000),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.message ?? "Chamber was not saved");
      setResult({ owner: session.sessionId, favorite: body.favorite });
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Saved Chambers unavailable",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <span className="favorite-control">
      <button
        className="button secondary compact"
        aria-pressed={Boolean(saved)}
        disabled={busy}
        type="button"
        onClick={() => void toggle()}
      >
        {busy ? "Saving…" : saved ? "★ Saved" : "☆ Save"}
      </button>
      {error && (
        <span className="error" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
