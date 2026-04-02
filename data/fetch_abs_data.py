#!/usr/bin/env python3
"""
ABS Challenge Explorer — Data Pipeline
Fetches pitch-level ABS challenge data from Baseball Savant and MLB Stats API,
processes it, and outputs static JSON files for the frontend.
"""

import json
import math
import time
import io
import os
import sys
from datetime import datetime, timedelta
from collections import defaultdict

import pandas as pd
import requests

# ── Config ───────────────────────────────────────────────────────────────────

SEASON = 2026
OPENING_DAY = "2026-03-26"
ZONE_HALF_WIDTH = 0.708  # 17 inches / 2 in feet

STATCAST_URL = "https://baseballsavant.mlb.com/statcast_search/csv"
MLB_API_BASE = "https://statsapi.mlb.com/api/v1"

HEADERS = {
    "User-Agent": "ABS-Challenge-Explorer/1.0 (research; github.com/abs-challenge-explorer)"
}

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "data")

# Key columns to extract from Statcast CSV
STATCAST_COLS = [
    "game_date", "pitcher", "batter", "player_name", "pitch_type", "pitch_name",
    "release_speed", "plate_x", "plate_z", "sz_top", "sz_bot", "description",
    "events", "balls", "strikes", "outs_when_up", "inning", "home_team",
    "away_team", "game_pk", "at_bat_number", "pitch_number",
]


# ── Helpers ──────────────────────────────────────────────────────────────────

def calc_miss_distance(px, pz, sz_top, sz_bot):
    """Calculate shortest distance from pitch to zone edge, in feet."""
    dx = max(0, abs(px) - ZONE_HALF_WIDTH)
    if pz > sz_top:
        dz = pz - sz_top
    elif pz < sz_bot:
        dz = sz_bot - pz
    else:
        dz = 0
    return math.sqrt(dx * dx + dz * dz)


def is_in_zone(px, pz, sz_top, sz_bot):
    return abs(px) <= ZONE_HALF_WIDTH and sz_bot <= pz <= sz_top


def fetch_with_retry(url, params=None, max_retries=3):
    """Fetch URL with exponential backoff retry."""
    for attempt in range(max_retries):
        try:
            resp = requests.get(url, params=params, headers=HEADERS, timeout=60)
            resp.raise_for_status()
            return resp
        except requests.RequestException as e:
            if attempt < max_retries - 1:
                wait = 2 ** (attempt + 1)
                print(f"  Retry {attempt + 1}/{max_retries} after {wait}s: {e}")
                time.sleep(wait)
            else:
                print(f"  Failed after {max_retries} attempts: {e}")
                raise


def fetch_statcast_day(date_str):
    """Fetch Statcast data for a single day."""
    params = {
        "all": "true",
        "hfPR": "challenge|",
        "hfGT": "R|",
        "hfSea": f"{SEASON}|",
        "player_type": "pitcher",
        "game_date_gt": date_str,
        "game_date_lt": date_str,
        "min_pitches": "0",
        "min_results": "0",
        "group_by": "name",
        "sort_col": "pitches",
        "sort_order": "desc",
        "type": "details",
    }

    resp = fetch_with_retry(STATCAST_URL, params=params)
    content = resp.text.strip()

    if not content or content.startswith("<!"):
        # Fallback: fetch all called strikes and balls, filter for challenges
        params_fallback = {
            "all": "true",
            "hfPR": "",
            "hfGT": "R|",
            "hfSea": f"{SEASON}|",
            "player_type": "pitcher",
            "game_date_gt": date_str,
            "game_date_lt": date_str,
            "min_pitches": "0",
            "min_results": "0",
            "group_by": "name",
            "sort_col": "pitches",
            "sort_order": "desc",
            "type": "details",
        }
        resp = fetch_with_retry(STATCAST_URL, params=params_fallback)
        content = resp.text.strip()

    if not content or content.startswith("<!"):
        return pd.DataFrame()

    try:
        df = pd.read_csv(io.StringIO(content), low_memory=False)
    except Exception as e:
        print(f"  CSV parse error for {date_str}: {e}")
        return pd.DataFrame()

    # Log column names on first successful fetch
    if not hasattr(fetch_statcast_day, "_logged_cols"):
        print(f"  Available columns: {list(df.columns)}")
        fetch_statcast_day._logged_cols = True

    # Filter for challenge-related rows
    if "description" in df.columns:
        mask = df["description"].str.contains("challenge", case=False, na=False)
        challenge_df = df[mask]
        if len(challenge_df) > 0:
            return challenge_df

    # Check for any ABS-specific columns
    abs_cols = [c for c in df.columns if "abs" in c.lower() or "challenge" in c.lower()]
    if abs_cols:
        print(f"  Found ABS-related columns: {abs_cols}")

    return df if "challenge" in str(params.get("hfPR", "")) else pd.DataFrame()


def fetch_umpire(game_pk):
    """Fetch home plate umpire for a game from MLB Stats API."""
    try:
        url = f"{MLB_API_BASE}/game/{game_pk}/boxscore"
        resp = fetch_with_retry(url)
        data = resp.json()
        officials = data.get("officials", [])
        for official in officials:
            if official.get("officialType") == "Home Plate":
                return official.get("official", {}).get("fullName", "Unknown")
    except Exception as e:
        print(f"  Umpire fetch error for game {game_pk}: {e}")
    return "Unknown"


# ── Main Pipeline ────────────────────────────────────────────────────────────

def run_pipeline():
    today = datetime.now().strftime("%Y-%m-%d")
    start = OPENING_DAY

    print(f"Fetching ABS challenge data from {start} to {today}")

    all_dfs = []
    current = datetime.strptime(start, "%Y-%m-%d")
    end = datetime.strptime(today, "%Y-%m-%d")

    while current <= end:
        date_str = current.strftime("%Y-%m-%d")
        print(f"  Fetching {date_str}...")
        try:
            df = fetch_statcast_day(date_str)
            if len(df) > 0:
                all_dfs.append(df)
                print(f"    Found {len(df)} rows")
            else:
                print(f"    No data")
        except Exception as e:
            print(f"    Error: {e}")
        current += timedelta(days=1)
        time.sleep(3)  # Be respectful

    if not all_dfs:
        print("No challenge data found. Exiting.")
        sys.exit(0)

    df = pd.concat(all_dfs, ignore_index=True)
    print(f"\nTotal rows: {len(df)}")

    # ── Fetch umpires per game ──
    game_pks = df["game_pk"].dropna().unique()
    umpire_cache = {}
    print(f"\nFetching umpire data for {len(game_pks)} games...")
    for gp in game_pks:
        if gp not in umpire_cache:
            umpire_cache[int(gp)] = fetch_umpire(int(gp))
            time.sleep(0.5)

    # ── Process into challenge records ──
    challenges = []
    for idx, row in df.iterrows():
        try:
            px = float(row.get("plate_x", 0) or 0)
            pz = float(row.get("plate_z", 0) or 0)
            sz_top = float(row.get("sz_top", 3.4) or 3.4)
            sz_bot = float(row.get("sz_bot", 1.55) or 1.55)

            miss_dist = calc_miss_distance(px, pz, sz_top, sz_bot)
            in_zone = is_in_zone(px, pz, sz_top, sz_bot)

            desc = str(row.get("description", "")).lower()
            overturned = "overturned" in desc or "reversed" in desc
            challenger_type = "Batter" if "batter" in desc else "Fielder"
            original_call = "Called Strike" if not in_zone else "Ball"

            game_pk = int(row.get("game_pk", 0))
            umpire = umpire_cache.get(game_pk, "Unknown")

            challenges.append({
                "id": len(challenges) + 1,
                "date": str(row.get("game_date", ""))[:10],
                "gamePk": game_pk,
                "inning": int(row.get("inning", 0) or 0),
                "balls": int(row.get("balls", 0) or 0),
                "strikes": int(row.get("strikes", 0) or 0),
                "outs": int(row.get("outs_when_up", 0) or 0),
                "batter": str(row.get("player_name", row.get("batter", "Unknown"))),
                "batterId": int(row.get("batter", 0) or 0),
                "pitcher": str(row.get("pitcher", "Unknown")),
                "pitcherId": int(row.get("pitcher", 0) or 0) if str(row.get("pitcher", "")).isdigit() else 0,
                "catcher": "",
                "team": str(row.get("home_team", "")),
                "teamName": str(row.get("home_team", "")),
                "opponent": str(row.get("away_team", "")),
                "umpire": umpire,
                "challengerType": challenger_type,
                "pitchType": str(row.get("pitch_type", "")),
                "pitchName": str(row.get("pitch_name", "")),
                "velocity": round(float(row.get("release_speed", 0) or 0), 1),
                "px": round(px, 3),
                "pz": round(pz, 3),
                "zoneTop": round(sz_top, 3),
                "zoneBot": round(sz_bot, 3),
                "inZone": in_zone,
                "missDistance": round(miss_dist, 4),
                "missDistanceInches": round(miss_dist * 12, 2),
                "originalCall": original_call,
                "overturned": overturned,
                "result": "Overturned" if overturned else "Confirmed",
            })
        except Exception as e:
            print(f"  Row {idx} processing error: {e}")

    print(f"\nProcessed {len(challenges)} challenge records")

    # ── Output ──
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Main challenges JSON
    output = {
        "lastUpdated": datetime.utcnow().isoformat() + "Z",
        "season": SEASON,
        "challenges": challenges,
    }
    challenges_path = os.path.join(OUTPUT_DIR, "abs-challenges.json")
    with open(challenges_path, "w") as f:
        json.dump(output, f, indent=2)
    print(f"Wrote {challenges_path}")

    # ── Summary JSON ──
    summary = build_summary(challenges)
    summary_path = os.path.join(OUTPUT_DIR, "abs-summary.json")
    with open(summary_path, "w") as f:
        json.dump(summary, f, indent=2)
    print(f"Wrote {summary_path}")


def build_summary(challenges):
    total = len(challenges)
    overturned = sum(1 for c in challenges if c["overturned"])

    batter_ch = [c for c in challenges if c["challengerType"] == "Batter"]
    fielder_ch = [c for c in challenges if c["challengerType"] == "Fielder"]

    # Team leaderboard
    by_team = defaultdict(lambda: {"total": 0, "overturned": 0})
    for c in challenges:
        by_team[c["team"]]["total"] += 1
        if c["overturned"]:
            by_team[c["team"]]["overturned"] += 1
    team_board = [{"team": t, **d, "overturnRate": round(d["overturned"] / d["total"] * 100, 1) if d["total"] else 0}
                  for t, d in sorted(by_team.items(), key=lambda x: -x[1]["total"])]

    # Player leaderboard (top 50)
    by_player = defaultdict(lambda: {"total": 0, "overturned": 0})
    for c in challenges:
        by_player[c["batter"]]["total"] += 1
        if c["overturned"]:
            by_player[c["batter"]]["overturned"] += 1
    player_board = [{"player": p, **d, "overturnRate": round(d["overturned"] / d["total"] * 100, 1) if d["total"] else 0}
                    for p, d in sorted(by_player.items(), key=lambda x: -x[1]["total"])][:50]

    # Umpire leaderboard
    by_umpire = defaultdict(lambda: {"total": 0, "overturned": 0})
    for c in challenges:
        by_umpire[c["umpire"]]["total"] += 1
        if c["overturned"]:
            by_umpire[c["umpire"]]["overturned"] += 1
    umpire_board = [{"umpire": u, **d, "overturnRate": round(d["overturned"] / d["total"] * 100, 1) if d["total"] else 0}
                    for u, d in sorted(by_umpire.items(), key=lambda x: -x[1]["total"])]

    # Daily totals
    by_day = defaultdict(lambda: {"total": 0, "overturned": 0})
    for c in challenges:
        by_day[c["date"]]["total"] += 1
        if c["overturned"]:
            by_day[c["date"]]["overturned"] += 1
    daily = [{"date": d, **v} for d, v in sorted(by_day.items())]

    # Miss distance buckets
    buckets = {"inZone": 0, "0-0.5": 0, "0.5-1": 0, "1-2": 0, "2-3": 0, "3-5": 0, "5+": 0}
    bucket_ot = {k: 0 for k in buckets}
    for c in challenges:
        inches = c["missDistanceInches"]
        if c["inZone"]:
            buckets["inZone"] += 1
            if c["overturned"]:
                bucket_ot["inZone"] += 1
        elif inches < 0.5:
            buckets["0-0.5"] += 1
            if c["overturned"]:
                bucket_ot["0-0.5"] += 1
        elif inches < 1:
            buckets["0.5-1"] += 1
            if c["overturned"]:
                bucket_ot["0.5-1"] += 1
        elif inches < 2:
            buckets["1-2"] += 1
            if c["overturned"]:
                bucket_ot["1-2"] += 1
        elif inches < 3:
            buckets["2-3"] += 1
            if c["overturned"]:
                bucket_ot["2-3"] += 1
        elif inches < 5:
            buckets["3-5"] += 1
            if c["overturned"]:
                bucket_ot["3-5"] += 1
        else:
            buckets["5+"] += 1
            if c["overturned"]:
                bucket_ot["5+"] += 1

    return {
        "lastUpdated": datetime.utcnow().isoformat() + "Z",
        "totals": {
            "challenges": total,
            "overturned": overturned,
            "overturnRate": round(overturned / total * 100, 1) if total else 0,
            "batterChallenges": len(batter_ch),
            "batterOverturned": sum(1 for c in batter_ch if c["overturned"]),
            "fielderChallenges": len(fielder_ch),
            "fielderOverturned": sum(1 for c in fielder_ch if c["overturned"]),
        },
        "teamLeaderboard": team_board,
        "playerLeaderboard": player_board,
        "umpireLeaderboard": umpire_board,
        "dailyTotals": daily,
        "missDistanceBuckets": {k: {"total": buckets[k], "overturned": bucket_ot[k]} for k in buckets},
    }


if __name__ == "__main__":
    run_pipeline()
