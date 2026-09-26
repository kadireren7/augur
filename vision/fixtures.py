"""JSON fixture loader and a minimal recorded-trajectory adapter."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from .models import CreatureType, Detection, SourceSegment


def load_trajectory(path: str | Path) -> tuple[SourceSegment, CreatureType, list[Detection], bytes]:
    fixture_path = Path(path)
    raw = fixture_path.read_bytes()
    payload = json.loads(raw)
    media_bytes = payload["source_payload"].encode("utf-8")
    detections = [Detection(**item) for item in payload["detections"]]
    source = SourceSegment(
        segment_id=payload["segment_id"],
        chamber_id=payload["chamber_id"],
        creature_id=payload["creature_id"],
        capture_start_ms=payload["capture_start_ms"],
        capture_end_ms=payload["capture_end_ms"],
        source_hash=hashlib.sha256(media_bytes).hexdigest(),
    )
    return source, CreatureType(payload["creature_type"]), detections, media_bytes

