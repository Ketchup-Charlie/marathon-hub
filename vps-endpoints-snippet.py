# ─────────────────────────────────────────────────────────────────────────────
# PASTE THESE TWO ENDPOINTS INTO ~/api/main.py ON THE VPS
# Add them alongside the other @app.get("/metrics/...") routes.
# ─────────────────────────────────────────────────────────────────────────────


@app.get("/metrics/sleep-trend")
async def get_sleep_trend(api_key: str = Depends(verify_api_key)):
    """Last 84 days from sleep_performance, ordered chronologically."""
    result = (
        supabase.table("sleep_performance")
        .select(
            "sleep_date, total_sleep_minutes, rem_sleep_minutes, "
            "deep_sleep_minutes, avg_overnight_hrv, sleep_score"
        )
        .order("sleep_date", desc=True)
        .limit(84)
        .execute()
    )
    rows = list(reversed(result.data or []))
    return {"sleep_trend": rows}


@app.get("/metrics/readiness-trend")
async def get_readiness_trend(api_key: str = Depends(verify_api_key)):
    """Last 84 days from readiness, ordered chronologically."""
    result = (
        supabase.table("readiness")
        .select(
            "date, readiness_score, level, "
            "hrv_factor_feedback, sleep_score_factor_feedback"
        )
        .order("date", desc=True)
        .limit(84)
        .execute()
    )
    rows = list(reversed(result.data or []))
    return {"readiness_trend": rows}
