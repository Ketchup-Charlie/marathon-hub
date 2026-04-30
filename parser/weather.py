#!/usr/bin/env python3
"""
Fetch historical weather for a given date/time and location.

Usage:
    python weather.py <YYYY-MM-DD> <HH:MM> <lat> <lon>

Returns JSON: { "temp": float, "humidity": float }
Uses OpenWeatherMap One Call API 3.0 (timemachine endpoint).
Requires OPENWEATHERMAP_API_KEY in environment or .env.local.
"""

import sys
import json
import os
from datetime import datetime, timezone
import requests
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env.local"))


def fetch_weather(date_str: str, time_str: str, lat: float, lon: float) -> dict:
    api_key = os.environ.get("OPENWEATHERMAP_API_KEY")
    if not api_key:
        return {"error": "OPENWEATHERMAP_API_KEY not set"}

    dt = datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M")
    dt_utc = dt.replace(tzinfo=timezone.utc)
    unix_ts = int(dt_utc.timestamp())

    url = (
        f"https://api.openweathermap.org/data/3.0/onecall/timemachine"
        f"?lat={lat}&lon={lon}&dt={unix_ts}&appid={api_key}&units=metric"
    )

    try:
        resp = requests.get(url, timeout=10)
        resp.raise_for_status()
        data = resp.json()
    except requests.RequestException as e:
        return {"error": str(e)}

    # One Call 3.0 timemachine returns data.data[0] for the hourly observation
    hourly = data.get("data", [{}])[0]
    return {
        "temp": hourly.get("temp"),
        "humidity": hourly.get("humidity"),
    }


def main():
    if len(sys.argv) < 5:
        print(json.dumps({"error": "Usage: weather.py <YYYY-MM-DD> <HH:MM> <lat> <lon>"}))
        sys.exit(1)

    _, date_str, time_str, lat, lon = sys.argv
    result = fetch_weather(date_str, time_str, float(lat), float(lon))
    print(json.dumps(result))


if __name__ == "__main__":
    main()
