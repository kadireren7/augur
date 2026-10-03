"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";

import { useSession } from "@/components/providers";
import { AugurContractClient } from "@/lib/contracts";
import { authHeaders } from "@/lib/auth-headers";
import type { ChamberView } from "@/lib/types";
import type { EIP1193Provider } from "viem";

const mappings = {
  ZONE_STANDARD: "LEFT → SELL · CENTER → HOLD · RIGHT → BUY",
  ZONE_INVERTED: "LEFT → BUY · CENTER → HOLD · RIGHT → SELL",
  DIRECTIONAL: "moving left → SELL · stationary → HOLD · moving right → BUY",
} as const;

export function CreateChamberForm({
  indexedMode = false,
  permissionlessEnabled = false,
}: {
  indexedMode?: boolean;
  permissionlessEnabled?: boolean;
}) {
  const session = useSession();
  const [template, setTemplate] =
    useState<keyof typeof mappings>("ZONE_STANDARD");
  const [sourceMode, setSourceMode] = useState("FIXTURE_REPLAY");
  const [viewingSource, setViewingSource] = useState("fixture");
  const [mediaReference, setMediaReference] = useState("fixture://custom");
  const [state, setState] = useState<
    "IDLE" | "PENDING" | "CONFIRMED" | "FAILED"
  >("IDLE");
  const [message, setMessage] = useState("");
  const [created, setCreated] = useState<ChamberView | null>(null);
  const [transactionHashes, setTransactionHashes] = useState<string[]>([]);
  const contractClient = useMemo(() => new AugurContractClient(), []);
  const owner = useMemo(
    () => session.address ?? session.sessionId,
    [session.address, session.sessionId],
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session.authenticated) {
      session.connect();
      return;
    }
    setState("PENDING");
    setMessage("Validating constrained configuration…");
    const values = new FormData(event.currentTarget);
    const input = {
      name: values.get("name"),
      species: values.get("species"),
      description: values.get("description"),
      mediaReference: values.get("mediaReference"),
      sourceMode,
      rulesetTemplate: template,
      movementThreshold: Number(values.get("movementThreshold")),
      confidenceThreshold: Number(values.get("confidenceThreshold")),
      asset: values.get("asset"),
      ownerId: owner,
      publisher: owner,
      viewingSource: {
        sourceType: viewingSource,
        sourceUrl: ["recorded_video", "live_hls"].includes(viewingSource)
          ? values.get("sourceUrl")
          : null,
      },
    };
    if (indexedMode && !permissionlessEnabled) {
      try {
        const response = await fetch("/api/chambers/prepare", {
          method: "POST",
          headers: await authHeaders(session),
          body: JSON.stringify(input),
        });
        const prepared = await response.json();
        if (!response.ok)
          throw new Error(
            prepared.message ?? "Configuration could not be saved",
          );
        setState("CONFIRMED");
        setMessage(prepared.message);
      } catch (error) {
        setState("FAILED");
        setMessage(
          error instanceof Error ? error.message : "Preparation failed",
        );
      }
      return;
    }
    if (
      session.mode === "PRIVY" &&
      permissionlessEnabled &&
      contractClient.permissionlessConfigured
    ) {
      try {
        if (
          !session.authenticated ||
          !session.address ||
          !session.getProvider
        ) {
          throw new Error("Connect and authenticate the Privy wallet first");
        }
        const preparedResponse = await fetch("/api/chambers/prepare", {
          method: "POST",
          headers: await authHeaders(session),
          body: JSON.stringify(input),
        });
        const prepared = await preparedResponse.json();
        if (!preparedResponse.ok)
          throw new Error(prepared.message ?? "Configuration rejected");
        const wallet = {
          address: session.address,
          provider: (await session.getProvider()) as EIP1193Provider,
        };
        const species = { Hamster: 0, Fish: 1, Turtle: 2 }[
          String(input.species)
        ] as 0 | 1 | 2;
        const source = { FIXTURE_REPLAY: 0, UPLOADED_CLIP: 1, LIVE_ADAPTER: 2 }[
          sourceMode
        ] as 0 | 1 | 2;
        setMessage("Checking the onchain registration policy…");
        await contractClient.validatePermissionlessPolicy(
          prepared.registration.rulesetHash,
        );
        setMessage("Registering creature…");
        const creatureHash = await contractClient.registerCreature(
          wallet,
          prepared.registration.creatureId,
          species,
          prepared.registration.metadataHash,
        );
        setMessage("Registering Chamber with the allowlisted ruleset…");
        const chamberHash = await contractClient.registerPermissionlessRoom(
          wallet,
          prepared.registration,
          source,
        );
        setTransactionHashes([creatureHash, chamberHash]);
        setState("CONFIRMED");
        setMessage(
          "Both registration transactions confirmed. Await the indexed Chamber view.",
        );
      } catch (error) {
        setState("FAILED");
        setMessage(
          error instanceof Error ? error.message : "Wallet registration failed",
        );
      }
      return;
    }
    const response = await fetch("/api/chambers", {
      method: "POST",
      headers: await authHeaders(session),
      body: JSON.stringify(input),
    });
    const body = await response.json();
    if (!response.ok) {
      setState("FAILED");
      setMessage(body.message ?? "Chamber creation failed");
      return;
    }
    setCreated(body.chamber);
    setState("CONFIRMED");
    setMessage(body.message);
  }

  async function activate() {
    if (!created) return;
    setState("PENDING");
    setMessage("Applying local validation policy…");
    const response = await fetch(`/api/chambers/${created.slug}/status`, {
      method: "POST",
      headers: await authHeaders(session),
      body: JSON.stringify({ actor: owner, status: "ACTIVE" }),
    });
    const body = await response.json();
    if (!response.ok) {
      setState("FAILED");
      setMessage(body.message ?? "Activation failed");
      return;
    }
    setCreated(body.chamber);
    setState("CONFIRMED");
    setMessage(
      "Chamber activated by its owner in local mode. No blockchain transaction was sent.",
    );
  }

  return (
    <form className="panel form-stack" onSubmit={(event) => void submit(event)}>
      <div className="panel-heading">
        <h2>Chamber configuration</h2>
        <span className="mode-badge">
          {indexedMode && !permissionlessEnabled
            ? "Operator registration"
            : session.mode === "PRIVY"
              ? "Wallet path"
              : "Local demo"}
        </span>
      </div>
      {indexedMode && !permissionlessEnabled && (
        <p className="notice">
          Permissionless registration is not enabled. Prepare an offchain
          configuration for operator review; this does not create an onchain
          Chamber or an active market.
        </p>
      )}
      <label className="field">
        Creature name
        <input maxLength={48} name="name" required />
      </label>
      <label className="field">
        Species
        <select name="species">
          <option>Hamster</option>
          <option>Fish</option>
          <option value="Turtle">Tortoise</option>
        </select>
      </label>
      <label className="field">
        Description
        <textarea maxLength={280} name="description" />
      </label>
      <label className="field">
        Viewing source
        <select
          value={viewingSource}
          onChange={(event) => {
            const value = event.target.value;
            setViewingSource(value);
            const mode = ["browser_camera", "live_hls"].includes(value)
              ? "LIVE_ADAPTER"
              : value === "recorded_video"
                ? "UPLOADED_CLIP"
                : "FIXTURE_REPLAY";
            setSourceMode(mode);
            setMediaReference(
              mode === "LIVE_ADAPTER"
                ? "webcam://browser"
                : mode === "UPLOADED_CLIP"
                  ? "upload://pending"
                  : "fixture://custom",
            );
          }}
        >
          <option value="fixture">Deterministic simulation</option>
          <option value="recorded_video">Recorded MP4 / WebM replay</option>
          <option value="live_hls">Configured public HLS stream</option>
          <option value="browser_camera">
            Browser camera · permission required
          </option>
        </select>
      </label>
      {["recorded_video", "live_hls"].includes(viewingSource) && (
        <label className="field">
          Public media URL
          <input name="sourceUrl" type="url" required pattern="https://.*" />
          <small>
            HTTPS only. Never enter a private stream, signed URL, or access
            token. The browser loads it; the server does not fetch it.
          </small>
        </label>
      )}
      {viewingSource === "browser_camera" && (
        <p className="muted">
          Camera access is requested only in the viewing room. Raw camera video
          is never stored or uploaded. Viewing does not automatically publish
          Omens.
        </p>
      )}
      <label className="field">
        Source mode
        <select
          onChange={(event) => {
            const mode = event.target.value;
            setSourceMode(mode);
            setMediaReference(
              mode === "FIXTURE_REPLAY"
                ? "fixture://custom"
                : mode === "UPLOADED_CLIP"
                  ? "upload://pending"
                  : "webcam://browser",
            );
          }}
          value={sourceMode}
        >
          <option value="FIXTURE_REPLAY">Deterministic reference</option>
          <option value="UPLOADED_CLIP">
            Controlled uploaded clip reference
          </option>
          <option value="LIVE_ADAPTER">Browser live adapter boundary</option>
        </select>
      </label>
      <label className="field">
        Safe media reference
        <input
          maxLength={160}
          name="mediaReference"
          onChange={(event) => setMediaReference(event.target.value)}
          pattern="(fixture|upload|webcam)://[A-Za-z0-9][A-Za-z0-9._-]*"
          required
          value={mediaReference}
        />
        <small>No URL is fetched by the server.</small>
      </label>
      <label className="field">
        Ruleset template
        <select
          onChange={(event) =>
            setTemplate(event.target.value as keyof typeof mappings)
          }
          value={template}
        >
          <option value="ZONE_STANDARD">Template A — standard zones</option>
          <option value="ZONE_INVERTED">Template B — inverted zones</option>
          <option value="DIRECTIONAL">Template C — direction</option>
        </select>
      </label>
      <div className="notice">
        <strong>Mapping preview:</strong> {mappings[template]}
      </div>
      <div className="two-column compact-grid">
        <label className="field">
          Movement threshold
          <input
            defaultValue="0.05"
            max="1"
            min="0.001"
            name="movementThreshold"
            required
            step="0.001"
            type="number"
          />
        </label>
        <label className="field">
          Confidence threshold
          <input
            defaultValue="0.8"
            max="1"
            min="0.5"
            name="confidenceThreshold"
            required
            step="0.01"
            type="number"
          />
        </label>
      </div>
      <label className="field">
        Market asset
        <input
          defaultValue="MON"
          maxLength={12}
          name="asset"
          pattern="[A-Z0-9]{2,12}"
          required
        />
      </label>
      <details className="technical-details">
        <summary>Registration details</summary>
        <dl className="facts">
          <div>
            <dt>Owner</dt>
            <dd className="hash">{owner}</dd>
          </div>
          <div>
            <dt>Creator stake</dt>
            <dd>No registration stake required</dd>
          </div>
        </dl>
      </details>
      {!session.authenticated && (
        <button className="button" type="button" onClick={session.connect}>
          Log in to create a Chamber
        </button>
      )}
      <button
        className="button"
        disabled={state === "PENDING" || !session.authenticated}
        type="submit"
      >
        {state === "PENDING"
          ? "Validating…"
          : indexedMode && !permissionlessEnabled
            ? "Prepare for operator review"
            : "Create Chamber"}
      </button>
      {state !== "IDLE" && (
        <p className={state === "FAILED" ? "error" : "notice"} role="status">
          {message}
        </p>
      )}
      {transactionHashes.map((hash) => (
        <code className="hash" key={hash}>
          {hash}
        </code>
      ))}
      {created && (
        <div className="button-row">
          {created.status === "DRAFT" && (
            <button
              className="button secondary"
              onClick={() => void activate()}
              type="button"
            >
              Activate Chamber
            </button>
          )}
          <Link className="button secondary" href={`/chambers/${created.slug}`}>
            Enter {created.creature.name}&apos;s Chamber
          </Link>
        </div>
      )}
    </form>
  );
}
