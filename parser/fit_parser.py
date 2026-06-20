#!/usr/bin/env python3
"""
Parse a Garmin .fit file and write a JSON summary to stdout.

Usage: python fit_parser.py <path/to/activity.fit> [--debug]
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lib'))
import json
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from fitparse import FitFile

_AEST = ZoneInfo("Australia/Sydney")

# ---------------------------------------------------------------------------
# Field name variants
# ---------------------------------------------------------------------------

_GCT_FIELDS = [
    "avg_stance_time",
    "stance_time",
    "avg_ground_contact_time",
    "ground_contact_time",
]

_STRIDE_FIELDS = [
    "avg_stride_length",
    "stride_length",
    "avg_step_length",   # Garmin 965 / HRM-Pro: per-step value in mm
]


def _first(d: dict, keys: list):
    """Return the first non-None value found in d for any key in keys."""
    for k in keys:
        v = d.get(k)
        if v is not None:
            return (v, k)
    return (None, None)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _seconds_to_interval(seconds):
    """Convert float seconds → 'HH:MM:SS' string (PostgreSQL interval-compatible)."""
    if seconds is None:
        return None
    total = int(round(seconds))
    h = total // 3600
    m = (total % 3600) // 60
    s = total % 60
    return f"{h:02d}:{m:02d}:{s:02d}"


def _pace_str(distance_m, time_s):
    """Return 'M:SS /km' pace string, or None if inputs are missing/zero."""
    if not distance_m or not time_s or distance_m == 0:
        return None
    sec_per_km = (time_s / distance_m) * 1000
    m = int(sec_per_km // 60)
    s = int(sec_per_km % 60)
    return f"{m}:{s:02d}"


def _msg_to_dict(msg):
    """Flatten a fitparse message into a plain dict, skipping None values."""
    return {f.name: f.value for f in msg if f.value is not None}


# ---------------------------------------------------------------------------
# Lap intent detection
# ---------------------------------------------------------------------------

_WARMUP_KEYWORDS = {"warm", "warmup", "warm up", "wu"}
_RECOVERY_KEYWORDS = {"cool", "cooldown", "cool down", "recovery", "recover", "rest", "cd"}
_INTERVAL_KEYWORDS = {"interval", "hard", "fast", "rep", "repetition"}

# Garmin FIT intensity field is an integer enum; map to canonical label.
# 0=active, 1=rest, 2=warmup, 3=cooldown, 4=interval (some devices differ)
# From debug: value 5 observed on 965 auto-laps — treat as plain run.
_INTENSITY_INT_MAP = {
    0: "active",
    1: "rest",
    2: "warmup",
    3: "active",    # 3 = 'active' in standard FIT spec
    4: "cooldown",
    5: "run",       # observed on Garmin 965 auto-laps
}


def _detect_intent(lap: dict) -> str:
    """
    Determine lap intent from 'wkt_step_name' first, then 'intensity', then 'Run'.
    intensity may arrive as a string (named enum) or integer (raw value).
    """
    step_name = str(lap.get("wkt_step_name", "")).lower().strip()

    if step_name:
        if any(k in step_name for k in _WARMUP_KEYWORDS):
            return "Warm Up"
        if any(k in step_name for k in _RECOVERY_KEYWORDS):
            return "Recovery"
        if any(k in step_name for k in _INTERVAL_KEYWORDS):
            return "Interval"

    raw_intensity = lap.get("intensity")
    if raw_intensity is not None:
        if isinstance(raw_intensity, int):
            intensity = _INTENSITY_INT_MAP.get(raw_intensity, "")
        else:
            intensity = str(raw_intensity).lower().strip()

        if intensity == "warmup":
            return "Warm Up"
        if intensity in ("cooldown", "rest", "recovery"):
            return "Recovery"
        if intensity == "interval":
            return "Interval"

    return "Run"


# ---------------------------------------------------------------------------
# Session parsing
# ---------------------------------------------------------------------------

def parse_session(session_msgs: list) -> dict:
    session = session_msgs[0] if session_msgs else {}

    distance_m = session.get("total_distance")
    time_s = session.get("total_timer_time") or session.get("total_elapsed_time")
    start_time = session.get("start_time")

    # Cadence: Garmin running cadence is per-foot (strides/min).
    # Multiply by 2 for total steps/min (standard display cadence).
    raw_cadence = session.get("avg_running_cadence") or session.get("avg_cadence")
    avg_cadence = int(raw_cadence * 2) if raw_cadence is not None else None

    # unknown_110 carries the activity name on Garmin 965 firmware
    title = session.get("unknown_110") or None

    return {
        "date": (
            (start_time if start_time.tzinfo else start_time.replace(tzinfo=ZoneInfo("UTC")))
            .astimezone(_AEST)
            .strftime("%Y-%m-%d")
        ) if isinstance(start_time, datetime) else None,
        "title": title,
        "total_distance": round(distance_m / 1000, 3) if distance_m else None,
        "total_time": _seconds_to_interval(time_s),
        "avg_pace": _pace_str(distance_m, time_s),
        "avg_hr": session.get("avg_heart_rate"),
        "max_hr": session.get("max_heart_rate"),
        "avg_cadence": avg_cadence,
        "avg_gct": _first(session, _GCT_FIELDS)[0],
        "avg_vertical_oscillation": (
            round(session.get("avg_vertical_oscillation") / 10, 2)
            if session.get("avg_vertical_oscillation") is not None
            else None
        ),
    }


# ---------------------------------------------------------------------------
# Timeseries parsing
# ---------------------------------------------------------------------------

_SEMICIRCLE_TO_DEG = 180.0 / (2 ** 31)


def parse_timeseries(record_msgs: list, t0, interval: int = 10) -> list:
    points = []
    for i, rec in enumerate(record_msgs):
        if i % interval != 0:
            continue

        ts = rec.get("timestamp")
        if ts is None:
            continue
        if t0 is None:
            t0 = ts

        try:
            elapsed = int((ts - t0).total_seconds())
        except Exception:
            continue

        speed = rec.get("enhanced_speed") or rec.get("speed")  # m/s
        pace = round(1000 / speed) if speed and speed > 0 else None

        raw_lat = rec.get("position_lat")
        raw_lon = rec.get("position_long")
        lat = round(raw_lat * _SEMICIRCLE_TO_DEG, 6) if raw_lat is not None else None
        lon = round(raw_lon * _SEMICIRCLE_TO_DEG, 6) if raw_lon is not None else None

        raw_cadence = rec.get("cadence")
        cadence = int(raw_cadence * 2) if raw_cadence is not None else None

        distance = rec.get("distance")  # metres
        distance_km = round(distance / 1000, 3) if distance is not None else None

        altitude = rec.get("enhanced_altitude") or rec.get("altitude")
        elevation_m = round(altitude, 1) if altitude is not None else None

        points.append({
            "seconds_elapsed": elapsed,
            "distance_km": distance_km,
            "pace_sec_per_km": pace,
            "hr": rec.get("heart_rate"),
            "cadence": cadence,
            "elevation_m": elevation_m,
            "lat": lat,
            "lon": lon,
        })

    return points


# ---------------------------------------------------------------------------
# Lap parsing
# ---------------------------------------------------------------------------

def parse_laps(lap_msgs: list) -> list:
    laps = []
    for i, lap in enumerate(lap_msgs, start=1):
        distance_m = lap.get("total_distance")
        time_s = lap.get("total_timer_time") or lap.get("total_elapsed_time")

        raw_cadence = lap.get("avg_running_cadence") or lap.get("avg_cadence")
        avg_cadence = int(raw_cadence * 2) if raw_cadence is not None else None

        stride_raw, stride_key = _first(lap, _STRIDE_FIELDS)
        if stride_raw is not None:
            avg_stride_m = round(stride_raw / 1000, 3)
        elif distance_m and lap.get("total_strides"):
            avg_stride_m = round(distance_m / lap["total_strides"], 3)
        else:
            avg_stride_m = None

        laps.append({
            "lap_number": i,
            "lap_intent": _detect_intent(lap),
            "distance": round(distance_m / 1000, 3) if distance_m else None,
            "time": _seconds_to_interval(time_s),
            "avg_pace": _pace_str(distance_m, time_s),
            "avg_hr": lap.get("avg_heart_rate"),
            "max_hr": lap.get("max_heart_rate"),
            "avg_cadence": avg_cadence,
            "avg_gct": _first(lap, _GCT_FIELDS)[0],
            "avg_stride_length": avg_stride_m,
            "avg_vertical_oscillation": (
                round(lap.get("avg_vertical_oscillation") / 10, 2)
                if lap.get("avg_vertical_oscillation") is not None
                else None
            ),
        })

    return laps


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    debug = "--debug" in sys.argv

    if not args:
        print(json.dumps({"error": "Usage: fit_parser.py <path/to/activity.fit> [--debug]"}))
        sys.exit(1)

    fit_path = args[0]

    try:
        fitfile = FitFile(fit_path)
    except Exception as e:
        print(json.dumps({"error": f"Failed to open FIT file: {e}"}))
        sys.exit(1)

    # Single pass: bucket all messages by type into plain dicts
    session_msgs: list = []
    lap_msgs: list = []
    record_msgs: list = []
    for msg in fitfile.get_messages():
        name = msg.name
        if name == 'session':
            session_msgs.append(_msg_to_dict(msg))
        elif name == 'lap':
            lap_msgs.append(_msg_to_dict(msg))
        elif name == 'record':
            record_msgs.append(_msg_to_dict(msg))

    if debug:
        for label, msgs in [("SESSION", session_msgs[:1]), ("LAP 1", lap_msgs[:1]), ("RECORD 1", record_msgs[:1])]:
            print(f"\n=== {label} fields ===", file=sys.stderr)
            for d in msgs:
                for k, v in d.items():
                    print(f"  {k!r:45s} = {v!r}", file=sys.stderr)

    t0 = session_msgs[0].get("start_time") if session_msgs else None

    result = parse_session(session_msgs)
    laps = parse_laps(lap_msgs)
    timeseries = parse_timeseries(record_msgs, t0)

    intents = {lap["lap_intent"] for lap in laps}
    result["single_intent"] = len(laps) <= 1 or len(intents) == 1
    result["laps"] = laps
    result["timeseries"] = timeseries

    print(json.dumps(result, default=str))


if __name__ == "__main__":
    main()
