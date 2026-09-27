"""Constrained source adapters for deterministic centroid trajectories."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Protocol

from .fixtures import load_trajectory
from .models import CreatureType, Detection, SourceSegment


class SourceMode(str, Enum):
    FIXTURE = "FIXTURE"
    RECORDED_TRAJECTORY = "RECORDED_TRAJECTORY"
    BROWSER_LIVE_BOUNDARY = "BROWSER_LIVE_BOUNDARY"


Trajectory = tuple[SourceSegment, CreatureType, list[Detection], bytes]


class TrajectorySource(Protocol):
    mode: SourceMode

    def load(self, source_id: str) -> Trajectory: ...


@dataclass(frozen=True)
class DirectoryTrajectorySource:
    """Load only named JSON trajectories contained by one configured directory."""

    root: Path
    mode: SourceMode = SourceMode.RECORDED_TRAJECTORY

    def load(self, source_id: str) -> Trajectory:
        if (
            not source_id
            or len(source_id) > 128
            or not all(character.isalnum() or character in {"-", "_"} for character in source_id)
        ):
            raise ValueError("invalid trajectory source identifier")
        root = self.root.resolve(strict=True)
        candidate = (root / f"{source_id}.json").resolve(strict=True)
        if candidate.parent != root:
            raise ValueError("trajectory must remain within the configured source directory")
        return load_trajectory(candidate)


class BrowserLiveSourceBoundary:
    """Explicit boundary for browser-provided centroids; it never opens a camera server-side."""

    mode = SourceMode.BROWSER_LIVE_BOUNDARY

    def load(self, source_id: str) -> Trajectory:
        del source_id
        raise RuntimeError(
            "browser live input must submit validated centroid records through a configured ingest service"
        )
