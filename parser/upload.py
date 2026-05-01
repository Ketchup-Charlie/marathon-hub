#!/usr/bin/env python3
"""
Upload parsed run JSON (from fit_parser.py) to Supabase.

Usage:
    python fit_parser.py activity.fit | python upload.py \
        --user-id <uuid> \
        [--shoe-id <uuid>] \
        [--compliance green|yellow|red] \
        [--run-type-tag "Long Run"]

Requires SUPABASE_SERVICE_ROLE_KEY (bypasses RLS) and
NEXT_PUBLIC_SUPABASE_URL in environment or .env.local.
"""

import sys
import json
import os
import argparse
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env.local"))


COMPLIANCE_MAP = {
    "green": "Green",
    "yellow": "Yellow",
    "red": "Red",
}


def upload(run: dict, user_id: str, shoe_id: str | None, compliance: str | None, run_type_tag: str | None):
    url = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    sb = create_client(url, key)

    laps = run.pop("laps", [])
    timeseries = run.pop("timeseries", [])

    run_row = {
        "user_id": user_id,
        "date": run.get("date"),
        "title": run.get("title"),
        "run_type_tag": run_type_tag,
        "total_distance": run.get("total_distance"),
        "total_time": run.get("total_time"),
        "avg_pace": run.get("avg_pace"),
        "avg_hr": run.get("avg_hr"),
        "max_hr": run.get("max_hr"),
        "avg_cadence": run.get("avg_cadence"),
        "avg_gct": run.get("avg_gct"),
        "avg_vertical_oscillation": run.get("avg_vertical_oscillation"),
        "compliance_score": COMPLIANCE_MAP.get((compliance or "").lower()),
        "shoe_id": shoe_id,
    }
    # Remove None values so Supabase uses column defaults
    run_row = {k: v for k, v in run_row.items() if v is not None}

    result = sb.table("completed_runs").insert(run_row).execute()
    run_id = result.data[0]["id"]

    if laps:
        lap_rows = [
            {
                "run_id": run_id,
                "lap_number": lap["lap_number"],
                "lap_intent": lap.get("lap_intent"),
                "distance": lap.get("distance"),
                "time": lap.get("time"),
                "avg_pace": lap.get("avg_pace"),
                "avg_hr": lap.get("avg_hr"),
                "max_hr": lap.get("max_hr"),
                "avg_cadence": lap.get("avg_cadence"),
                "avg_gct": lap.get("avg_gct"),
                "avg_stride_length": lap.get("avg_stride_length"),
                "avg_vertical_oscillation": lap.get("avg_vertical_oscillation"),
            }
            for lap in laps
        ]
        lap_rows = [{k: v for k, v in row.items() if v is not None} for row in lap_rows]
        sb.table("run_laps").insert(lap_rows).execute()

    if timeseries:
        ts_rows = [
            {
                "run_id": run_id,
                "seconds_elapsed": pt["seconds_elapsed"],
                "distance_km": pt.get("distance_km"),
                "pace_sec_per_km": pt.get("pace_sec_per_km"),
                "hr": pt.get("hr"),
                "cadence": pt.get("cadence"),
                "elevation_m": pt.get("elevation_m"),
                "lat": pt.get("lat"),
                "lon": pt.get("lon"),
            }
            for pt in timeseries
        ]
        ts_rows = [{k: v for k, v in row.items() if v is not None} for row in ts_rows]
        sb.table("run_timeseries").insert(ts_rows).execute()

    return run_id


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--user-id", required=True)
    parser.add_argument("--shoe-id", default=None)
    parser.add_argument("--compliance", default=None, choices=["green", "yellow", "red"])
    parser.add_argument("--run-type-tag", default=None)
    args = parser.parse_args()

    raw = sys.stdin.read()
    try:
        run = json.loads(raw)
    except json.JSONDecodeError as e:
        print(json.dumps({"error": f"Invalid JSON input: {e}"}))
        sys.exit(1)

    if "error" in run:
        print(json.dumps({"error": run["error"]}))
        sys.exit(1)

    try:
        run_id = upload(run, args.user_id, args.shoe_id, args.compliance, args.run_type_tag)
        print(json.dumps({"success": True, "run_id": run_id}))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
