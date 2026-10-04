"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useReducedMotion } from "motion/react";
import { StateReveal } from "@/components/motion-system";
import { mediaLabel, type MediaSource } from "@/lib/media";
import type { OmenView } from "@/lib/types";
import { mediaComposition } from "@/lib/media-presentation";
import { streamRetryDelay } from "@/lib/media-playback";

export function MediaStage({
  source,
  name,
  omen,
  behavior,
  compact = false,
  ambient = false,
  wall = false,
}: {
  source: MediaSource;
  name: string;
  omen?: OmenView | null;
  behavior?: string;
  compact?: boolean;
  ambient?: boolean;
  wall?: boolean;
}) {
  const reduced = useReducedMotion();
  const video = useRef<HTMLVideoElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("LOADING");
  const [error, setError] = useState("");
  const [time, setTime] = useState(0);
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(true);
  const [duration, setDuration] = useState(0);
  const [zones, setZones] = useState(false);
  const [cameraStarted, setCameraStarted] = useState(false);
  const [cameraBusy, setCameraBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const [playingSource, setPlayingSource] = useState("");
  const [liveSource, setLiveSource] = useState("");
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const sourceKey = `${source.id}:${source.sourceUrl ?? "camera"}`;
  const composition = mediaComposition(name);
  useEffect(() => {
    const element = video.current;
    if (!element || reduced || (compact && !ambient && !wall) ||
      source.sourceType === "browser_camera" || source.status !== "available") return;
    const start = () => {
      if (element.paused) void element.play().catch(() => setAutoplayBlocked(true));
    };
    // play() loads a metadata-preloaded replay; waiting for canplay can deadlock
    // when the browser has not yet requested the first decoded frame.
    if (source.sourceType === "recorded_video" || element.readyState >= 2) start();
    else element.addEventListener("canplay", start, { once: true });
    return () => element.removeEventListener("canplay", start);
  }, [sourceKey, source.sourceType, source.status, reduced, compact, ambient, wall, reload]);
  useEffect(() => {
    // Cached media can load before hydration; derive controls from the element.
    const frame = requestAnimationFrame(() => {
      const element = video.current;
      if (!element || element.readyState < 1) return;
      setDuration(Number.isFinite(element.duration) ? element.duration : 0);
      setTime(element.currentTime);
      setPaused(element.paused);
      if (element.readyState >= 2) {
        setStatus(element.paused ? "READY" : "PLAYING");
        if (!element.paused) setPlayingSource(sourceKey);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [sourceKey]);
  useEffect(() => {
    if (
      (compact && !ambient) ||
      source.status !== "available" ||
      source.sourceType === "fixture" ||
      (source.sourceType === "browser_camera" && !cameraStarted) ||
      (!["LOADING", "RECONNECTING"].includes(status) &&
        !(source.sourceType === "live_hls" && liveSource !== sourceKey))
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
    liveSource,
    sourceKey,
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
    if (element.canPlayType("application/vnd.apple.mpegurl")) {
      element.src = source.sourceUrl;
      let attempts = 0;
      let retry: ReturnType<typeof setTimeout> | undefined;
      const recover = () => {
        clearTimeout(retry);
        attempts = Math.min(attempts + 1, 6);
        setLiveSource("");
        setStatus(attempts > 3 ? "OFFLINE" : "RECONNECTING");
        if (attempts > 3) setError("Stream offline. Reconnecting automatically…");
        retry = setTimeout(() => element.load(), streamRetryDelay(attempts));
      };
      const resumed = () => { attempts = 0; clearTimeout(retry); };
      element.addEventListener("error", recover);
      element.addEventListener("playing", resumed);
      window.addEventListener("online", recover);
      cleanup = () => {
        clearTimeout(retry);
        element.removeEventListener("error", recover);
        element.removeEventListener("playing", resumed);
        window.removeEventListener("online", recover);
      };
    } else
      void import("hls.js")
        .then(({ default: Hls }) => {
          if (disposed) return;
          if (!Hls.isSupported()) {
            setError("This browser cannot play this live stream.");
            return;
          }
          const hls = new Hls();
          let retries = 0;
          let retry: ReturnType<typeof setTimeout> | undefined;
          hls.loadSource(source.sourceUrl!);
          hls.attachMedia(element);
          hls.on(Hls.Events.LEVEL_LOADED, (_event, data) => {
            if (data.details.live) {
              retries = 0;
              clearTimeout(retry);
              setLiveSource(`${source.id}:${source.sourceUrl}`);
              setError("");
            } else
              setError(
                "This playlist is recorded, not a live stream. Configure it as a replay.",
              );
          });
          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (!data.fatal) return;
            clearTimeout(retry);
            setLiveSource("");
            retries = Math.min(retries + 1, 6);
            setStatus(retries > 3 ? "OFFLINE" : "RECONNECTING");
            if (retries > 3) setError("Stream offline. Reconnecting automatically…");
            retry = setTimeout(() => {
              if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
              else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
              else setError("Stream unavailable. Reload the source.");
            }, streamRetryDelay(retries));
          });
          const online = () => hls.startLoad();
          window.addEventListener("online", online);
          cleanup = () => {
            clearTimeout(retry);
            window.removeEventListener("online", online);
            hls.destroy();
          };
        })
        .catch(() => setError("Live stream player could not initialize."));
    return () => {
      disposed = true;
      cleanup();
    };
  }, [source.id, source.sourceType, source.sourceUrl, source.status, reload]);
  useEffect(() => {
    const element = video.current;
    return () => {
      const stream = element?.srcObject as MediaStream | null;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);
  async function camera() {
    if (cameraBusy) return;
    setCameraBusy(true);
    let expired = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const request = navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      const stream = await Promise.race([
        request.then((value) => {
          if (expired) {
            value.getTracks().forEach((track) => track.stop());
            throw new Error();
          }
          return value;
        }),
        new Promise<MediaStream>((_resolve, reject) => {
          timeout = setTimeout(() => {
            expired = true;
            reject(new Error());
          }, 15000);
        }),
      ]);
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
    } finally {
      clearTimeout(timeout);
      setCameraBusy(false);
    }
  }
  const live =
    source.sourceType === "live_hls" || source.sourceType === "browser_camera";
  return (
    <div
      className={`media-stage ${compact ? "compact" : ""} ${wall ? "wall-player" : ""}`}
      ref={stage}
      style={{
        "--media-fit": composition.fit,
        "--media-position": composition.position,
        "--media-hero-position": composition.heroPosition,
        "--media-wall-position": composition.wallPosition,
      } as CSSProperties}
      aria-label={`${name} viewing player`}
    >
      <div className="media-screen">
      {source.sourceType !== "fixture" ? (
        <video
          ref={video}
          autoPlay={!reduced && (!compact || ambient)}
          playsInline
          muted={muted}
          loop={!live}
          controls={false}
          preload={compact && !ambient ? "none" : "metadata"}
          poster={source.poster ?? undefined}
          src={
            source.sourceType === "recorded_video" &&
            source.status === "available"
              ? (source.sourceUrl ?? undefined)
              : undefined
          }
          onLoadStart={() => {
            setStatus("LOADING");
            setTime(0);
            setDuration(0);
            setPaused(true);
          }}
          onLoadedData={() => setStatus("READY")}
          onLoadedMetadata={() => {
            const value = video.current?.duration ?? 0;
            setDuration(Number.isFinite(value) ? value : 0);
          }}
          onCanPlay={() => {
            const element = video.current;
            if (!element || source.sourceType !== "recorded_video") return;
            setPaused(element.paused);
            setStatus(element.paused ? "READY" : "PLAYING");
            setError("");
            if (!element.paused) setPlayingSource(sourceKey);
          }}
          onDurationChange={() => {
            if (
              source.sourceType === "live_hls" &&
              video.current?.duration === Infinity
            )
              setLiveSource(sourceKey);
          }}
          onPlaying={() => {
            setAutoplayBlocked(false);
            setPaused(false);
            setStatus("PLAYING");
            setPlayingSource(sourceKey);
            if (source.sourceType !== "live_hls" || liveSource === sourceKey || video.current?.duration === Infinity) setError("");
            if (
              source.sourceType === "browser_camera" &&
              video.current?.srcObject
            )
              setLiveSource(sourceKey);
          }}
          onPause={() => setPaused(true)}
          onWaiting={() => live && setStatus("RECONNECTING")}
          onMouseEnter={() => {
            if (compact && !reduced) void video.current?.play().catch(() => {});
          }}
          onMouseLeave={() => {
            if (compact && !ambient) video.current?.pause();
          }}
          onTimeUpdate={() => setTime(video.current?.currentTime ?? 0)}
          onError={() =>
            setError(live ? "Stream offline. Reconnecting automatically…" : "Video unavailable. Indexed market data is unaffected.")
          }
        />
      ) : (
        <div className="simulation-surface">
          <span>Deterministic observation simulation</span>
        </div>
      )}
      <div className="media-top">
        <span
          className={`media-badge ${live && status === "PLAYING" && playingSource === sourceKey && liveSource === sourceKey ? "live" : ""}`}
        >
          <i />
          {source.sourceType === "browser_camera" && !cameraStarted
            ? cameraBusy
              ? "Connecting camera"
              : "Camera off"
            : live
              ? error || source.status === "unavailable"
                ? "Offline"
                : status === "PLAYING" &&
                    playingSource === sourceKey &&
                    liveSource === sourceKey
                  ? "LIVE"
                  : status === "RECONNECTING"
                    ? "Reconnecting"
                    : "Connecting"
              : mediaLabel(source)}
        </span>
        <span className="media-clock">
          {String(Math.floor(time / 60)).padStart(2, "0")}:
          {String(Math.floor(time % 60)).padStart(2, "0")}
        </span>
      </div>
      {!compact && !wall && (
        <div className="media-caption">
          <div>
            <span className="eyebrow">{behavior ?? "Observation feed"}</span>
          </div>
          {omen && (
            <StateReveal
              identity={omen.sequence}
              className={`media-omen ${omen.value.toLowerCase()}`}
            >
              <span>Omen #{omen.sequence}</span>
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
      {["LOADING", "RECONNECTING"].includes(status) &&
        source.status === "available" &&
        !compact &&
        !error && (
          <span className="media-loading" role="status">
            {live ? "Connecting to stream…" : "Loading video…"}
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
      </div>
      {!compact && (
        <>
        <div className="media-tools">
          {source.sourceType === "recorded_video" && (
            <>
              <button
                className="playback-button"
                aria-label={paused ? "Play replay" : "Pause replay"}
                disabled={Boolean(error) || source.status !== "available"}
                onClick={() => {
                  const element = video.current;
                  if (!element) return;
                  if (element.paused)
                    void element.play().catch(() => setError("Playback unavailable. Try reloading the source."));
                  else element.pause();
                }}
                type="button"
              >
                <span aria-hidden="true">{paused ? "▶" : "Ⅱ"}</span>
              </button>
              {!wall && <label className="replay-timeline">
                <span className="sr-only">Replay timeline</span>
                <input
                  type="range"
                  min="0"
                  max={duration || 1}
                  step="0.1"
                  value={Math.min(time, duration || 1)}
                  style={{ "--played": `${duration ? (time / duration) * 100 : 0}%` } as CSSProperties}
                  disabled={!duration || Boolean(error)}
                  aria-label="Replay timeline"
                  aria-valuetext={`${Math.floor(time)} of ${Math.floor(duration)} seconds`}
                  onChange={(event) => {
                    const nextTime = Number(event.target.value);
                    setTime(nextTime);
                    if (video.current) video.current.currentTime = nextTime;
                  }}
                />
              </label>}
            </>
          )}
          {source.sourceType === "browser_camera" && !cameraStarted && (
            <button
              disabled={source.status !== "available" || cameraBusy}
              onClick={() => void camera()}
              type="button"
            >
              {cameraBusy ? "Connecting…" : "Enable camera"}
            </button>
          )}
          <button
            aria-pressed={!muted}
            onClick={() => setMuted(!muted)}
            type="button"
          >
            {muted ? "Sound off" : "Sound on"}
          </button>
          {!wall && <button
            aria-pressed={zones}
            onClick={() => setZones(!zones)}
            type="button"
          >
            Reference zones
          </button>}
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
        </div>
        {autoplayBlocked && !error && (
          <button className="autoplay-affordance" type="button" onClick={() =>
            void video.current?.play().catch(() => setError("Playback unavailable. Reload the source."))
          }>Play {source.sourceType === "recorded_video" ? "replay" : "stream"} ▶</button>
        )}
        {!wall && <div className="media-footnote">
          <span>{source.evidence === "illustrative"
            ? "Reference footage · not publication evidence"
            : "Configured source · not independently attested"}</span>
          <a href="/media/CREDITS.md" className="media-credit">{source.attribution}</a>
        </div>}
        </>
      )}
    </div>
  );
}
