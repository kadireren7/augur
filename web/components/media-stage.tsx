"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { StateReveal } from "@/components/motion-system";
import { mediaLabel, type MediaSource } from "@/lib/media";
import type { OmenView } from "@/lib/types";

export function MediaStage({
  source,
  name,
  omen,
  behavior,
  compact = false,
  ambient = false,
}: {
  source: MediaSource;
  name: string;
  omen?: OmenView | null;
  behavior?: string;
  compact?: boolean;
  ambient?: boolean;
}) {
  const reduced = useReducedMotion();
  const video = useRef<HTMLVideoElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("LOADING");
  const [error, setError] = useState("");
  const [time, setTime] = useState(0);
  const [muted, setMuted] = useState(true);
  const [zones, setZones] = useState(false);
  const [cameraStarted, setCameraStarted] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    if (
      (compact && !ambient) ||
      source.status !== "available" ||
      source.sourceType === "fixture" ||
      (source.sourceType === "browser_camera" && !cameraStarted) ||
      status !== "LOADING"
    )
      return;
    const timer = window.setTimeout(
      () =>
        setError(
          "Source is taking too long to load. Check the stream or reload the source.",
        ),
      15_000,
    );
    return () => window.clearTimeout(timer);
  }, [
    ambient,
    cameraStarted,
    compact,
    source.sourceType,
    source.status,
    status,
    reload,
  ]);
  useEffect(() => {
    const element = video.current;
    if (
      !element ||
      source.sourceType !== "live_hls" ||
      !source.sourceUrl ||
      source.status !== "available"
    )
      return;
    let cleanup = () => {};
    let disposed = false;
    if (element.canPlayType("application/vnd.apple.mpegurl"))
      element.src = source.sourceUrl;
    else
      void import("hls.js")
        .then(({ default: Hls }) => {
          if (disposed) return;
          if (!Hls.isSupported()) {
            setError("This browser cannot play this live stream.");
            return;
          }
          const hls = new Hls();
          hls.loadSource(source.sourceUrl!);
          hls.attachMedia(element);
          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (data.fatal)
              setError("Live stream unavailable. No replay substituted.");
          });
          cleanup = () => hls.destroy();
        })
        .catch(() => setError("Live stream player could not initialize."));
    return () => {
      disposed = true;
      cleanup();
    };
  }, [source, reload]);
  useEffect(() => {
    const element = video.current;
    return () => {
      const stream = element?.srcObject as MediaStream | null;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);
  async function camera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      if (!video.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      video.current.srcObject = stream;
      await video.current.play();
      setCameraStarted(true);
    } catch {
      setError(
        "Camera unavailable or permission declined. Nothing was recorded or uploaded.",
      );
    }
  }
  const live =
    source.sourceType === "live_hls" || source.sourceType === "browser_camera";
  return (
    <div className={`media-stage ${compact ? "compact" : ""}`} ref={stage}>
      {source.sourceType !== "fixture" ? (
        <video
          ref={video}
          autoPlay={!reduced && (!compact || ambient)}
          playsInline
          muted={muted}
          loop={!live}
          controls={!compact}
          preload={compact && !ambient ? "none" : "metadata"}
          poster={source.poster ?? undefined}
          src={
            source.sourceType === "recorded_video" &&
            source.status === "available"
              ? (source.sourceUrl ?? undefined)
              : undefined
          }
          onLoadedData={() => setStatus("READY")}
          onPlaying={() => setStatus("PLAYING")}
          onMouseEnter={() => {
            if (compact && !reduced) void video.current?.play().catch(() => {});
          }}
          onMouseLeave={() => {
            if (compact && !ambient) video.current?.pause();
          }}
          onTimeUpdate={() => setTime(video.current?.currentTime ?? 0)}
          onError={() =>
            setError("Video unavailable. Indexed market data is unaffected.")
          }
        />
      ) : (
        <div className="simulation-surface">
          <span>Deterministic observation simulation</span>
        </div>
      )}
      <div className="media-top">
        <span
          className={`media-badge ${live && status === "PLAYING" ? "live" : ""}`}
        >
          <i />
          {mediaLabel(source)}
          {live && status !== "PLAYING" ? " · NOT CONNECTED" : ""}
        </span>
        <span className="media-clock">
          {String(Math.floor(time / 60)).padStart(2, "0")}:
          {String(Math.floor(time % 60)).padStart(2, "0")}
        </span>
      </div>
      {!compact && (
        <div className="media-caption">
          <div>
            <span className="eyebrow">{behavior ?? "Observation feed"}</span>
            <h2>{name}</h2>
            <p>
              {source.evidence === "illustrative"
                ? "Illustrative replay · not the source of the indexed Omen"
                : "Configured source · not independently attested"}
            </p>
          </div>
          {omen && (
            <StateReveal
              identity={omen.sequence}
              className={`media-omen ${omen.value.toLowerCase()}`}
            >
              <span>INDEXED OMEN #{omen.sequence}</span>
              <strong>{omen.value}</strong>
            </StateReveal>
          )}
        </div>
      )}
      {zones && (
        <div
          className="cv-zones"
          aria-label="Reference zones, not live computer vision"
        >
          <span>SELL</span>
          <span>HOLD</span>
          <span>BUY</span>
        </div>
      )}
      {status === "LOADING" &&
        source.status === "available" &&
        source.sourceType === "recorded_video" &&
        !compact &&
        !error && (
          <span className="media-loading" role="status">
            Loading replay…
          </span>
        )}
      {(error || source.status === "unavailable") && (
        <div className="media-error" role="alert">
          {source.status === "unavailable"
            ? "Configured source unavailable. No replay substituted."
            : error}
          <button
            className="button secondary compact"
            onClick={() => {
              setError("");
              setStatus("LOADING");
              setReload((value) => value + 1);
              video.current?.load();
            }}
            type="button"
          >
            Reload source
          </button>
        </div>
      )}
      {!compact && (
        <div className="media-tools">
          {source.sourceType === "browser_camera" && !cameraStarted && (
            <button
              disabled={source.status !== "available"}
              onClick={() => void camera()}
              type="button"
            >
              Enable camera
            </button>
          )}
          <button
            aria-pressed={!muted}
            onClick={() => setMuted(!muted)}
            type="button"
          >
            {muted ? "Sound off" : "Sound on"}
          </button>
          <button
            aria-pressed={zones}
            onClick={() => setZones(!zones)}
            type="button"
          >
            Reference zones
          </button>
          <button
            onClick={() =>
              void stage.current
                ?.requestFullscreen()
                .catch(() =>
                  setError("Fullscreen is unavailable in this browser."),
                )
            }
            type="button"
          >
            Fullscreen ↗
          </button>
          <a href="/media/CREDITS.md" className="media-credit">
            {source.attribution}
          </a>
        </div>
      )}
    </div>
  );
}
