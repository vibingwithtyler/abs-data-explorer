#!/usr/bin/env python3
"""
ABS Challenge Explorer — Data Pipeline

Fetches ABS challenge data from the MLB Stats API play-by-play feed.
Each game's /feed/live endpoint contains reviewDetails on challenged pitches
with pitch coordinates, velocity, zone data, and overturn results.

Umpire names come from Statcast CSV (which has an 'umpire' column per pitch).
"""

import json
import math
import time
import os
import sys
from datetime import datetime, timedelta
from collections import defaultdict

import requests

# ── Config ───────────────────────────────────────────────────────────────────

SEASON = 2026
OPENING_DAY = "2026-03-26"
ZONE_HALF_WIDTH = 0.708  # 17 inches / 2 in feet
BALL_RADIUS_FT = 1.45 / 12  # baseball radius in feet

MLB_API = "https://statsapi.mlb.com/api/v1"
MLB_API_LIVE = "https://statsapi.mlb.com/api/v1.1"
STATCAST_URL = "https://baseballsavant.mlb.com/statcast_search/csv"

HEADERS = {
    "User-Agent": "ABS-Challenge-Explorer/1.0 (research; github.com/abs-challenge-explorer)"
}

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "data")

TEAM_NAMES = {
    108: "LAA", 109: "ARI", 110: "BAL", 111: "BOS", 112: "CHC", 113: "CIN",
    114: "CLE", 115: "COL", 116: "DET", 117: "HOU", 118: "KC", 119: "LAD",
    120: "WSH", 121: "NYM", 133: "OAK", 134: "PIT", 135: "SD", 136: "SEA",
    137: "SF", 138: "STL", 139: "TB", 140: "TEX", 141: "TOR", 142: "MIN",
    143: "PHI", 144: "ATL", 145: "CHW", 146: "MIA", 147: "NYY", 158: "MIL",
}

TEAM_FULL_NAMES = {
    "LAA": "Angels", "ARI": "D-backs", "BAL": "Orioles", "BOS": "Red Sox",
    "CHC": "Cubs", "CIN": "Reds", "CLE": "Guardians", "COL": "Rockies",
    "DET": "Tigers", "HOU": "Astros", "KC": "Royals", "LAD": "Dodgers",
    "WSH": "Nationals", "NYM": "Mets", "OAK": "Athletics", "PIT": "Pirates",
    "SD": "Padres", "SEA": "Mariners", "SF": "Giants", "STL": "Cardinals",
    "TB": "Rays", "TEX": "Rangers", "TOR": "Blue Jays", "MIN": "Twins",
    "PHI": "Phillies", "ATL": "Braves", "CHW": "White Sox", "MIA": "Marlins",
    "NYY": "Yankees", "MIL": "Brewers",
}


# ── Helpers ──────────────────────────────────────────────────────────────────

def calc_miss_distance(px, pz, sz_top, sz_bot):
    """Distance from ball edge to nearest zone edge, in feet.

    Accounts for ball radius: a pitch is a strike if any part of the
    ball crosses any part of the zone. So the effective zone for the
    ball center extends by BALL_RADIUS_FT in every direction.
    """
    dx = max(0, abs(px) - ZONE_HALF_WIDTH - BALL_RADIUS_FT)
    if pz > sz_top + BALL_RADIUS_FT:
        dz = pz - sz_top - BALL_RADIUS_FT
    elif pz < sz_bot - BALL_RADIUS_FT:
        dz = sz_bot - BALL_RADIUS_FT - pz
    else:
        dz = 0
    return math.sqrt(dx * dx + dz * dz)


def fetch_json(url, max_retries=3):
    """Fetch JSON with exponential backoff."""
    for attempt in range(max_retries):
        try:
            resp = requests.get(url, headers=HEADERS, timeout=60)
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as e:
            if attempt < max_retries - 1:
                wait = 2 ** (attempt + 1)
                print(f"  Retry {attempt + 1}/{max_retries} after {wait}s: {e}")
                time.sleep(wait)
            else:
                print(f"  Failed after {max_retries} attempts: {e}")
                raise


def get_games_and_umpires_for_date(date_str):
    """Get list of game PKs and home plate umpires from MLB schedule API."""
    url = f"{MLB_API}/schedule?sportId=1&date={date_str}&hydrate=officials"
    data = fetch_json(url)
    games = []  # list of (game_pk, umpire_name)
    for date_entry in data.get("dates", []):
        for game in date_entry.get("games", []):
            if game.get("status", {}).get("abstractGameState") == "Final":
                gp = game["gamePk"]
                umpire = "Unknown"
                for official in game.get("officials", []):
                    if official.get("officialType") == "Home Plate":
                        umpire = official.get("official", {}).get("fullName", "Unknown")
                        break
                games.append((gp, umpire))
    return games


def extract_challenges_from_game(game_pk, game_data, umpire_name):
    """Extract ABS challenge events from a game's live feed data."""
    challenges = []

    all_plays = game_data.get("liveData", {}).get("plays", {}).get("allPlays", [])
    game_data_info = game_data.get("gameData", {})
    game_date = game_data_info.get("datetime", {}).get("officialDate", "")
    teams = game_data_info.get("teams", {})
    home_team_id = teams.get("home", {}).get("id", 0)
    away_team_id = teams.get("away", {}).get("id", 0)
    home_abbr = TEAM_NAMES.get(home_team_id, "UNK")
    away_abbr = TEAM_NAMES.get(away_team_id, "UNK")

    for play in all_plays:
        # Check if this at-bat has a review
        review = play.get("reviewDetails")
        if not review:
            continue

        # Only include ABS pitch challenges (reviewType "MJ").
        # Other types (MA=tag, MB=base touch, MC=force, MD=catch/drop,
        # MF=play at 1st, MI=HBP, NH/NI=umpire reviews) are not ABS.
        if review.get("reviewType") != "MJ":
            continue

        is_overturned = review.get("isOverturned", False)
        challenge_team_id = review.get("challengeTeamId", 0)

        about = play.get("about", {})
        inning = about.get("inning", 0)
        half = about.get("halfInning", "top")

        matchup = play.get("matchup", {})
        batter_name = matchup.get("batter", {}).get("fullName", "Unknown")
        batter_id = matchup.get("batter", {}).get("id", 0)
        pitcher_name = matchup.get("pitcher", {}).get("fullName", "Unknown")
        pitcher_id = matchup.get("pitcher", {}).get("id", 0)

        # Determine challenger type from the review
        # If challengeTeamId matches the batting team, it's a batter/catcher challenge
        batting_team_id = away_team_id if half == "top" else home_team_id
        fielding_team_id = home_team_id if half == "top" else away_team_id

        if challenge_team_id == fielding_team_id:
            challenger_type = "Fielder"
        else:
            challenger_type = "Batter"

        batting_abbr = away_abbr if half == "top" else home_abbr
        fielding_abbr = home_abbr if half == "top" else away_abbr

        # Find the challenged pitch — it's the last pitch in the play events
        # that was a called ball or called strike before the review
        play_events = play.get("playEvents", [])
        challenged_pitch = None
        for event in reversed(play_events):
            if event.get("isPitch", False):
                challenged_pitch = event
                break

        if not challenged_pitch:
            continue

        pitch_data = challenged_pitch.get("pitchData", {})
        details = challenged_pitch.get("details", {})
        post_count = challenged_pitch.get("count", {})

        # The count on the pitch event is AFTER the pitch was recorded.
        # Calculate the pre-pitch count by reversing the pitch result.
        post_balls = post_count.get("balls", 0)
        post_strikes = post_count.get("strikes", 0)

        px = pitch_data.get("coordinates", {}).get("pX", 0)
        pz = pitch_data.get("coordinates", {}).get("pZ", 0)
        sz_top = pitch_data.get("strikeZoneTop", 3.4)
        sz_bot = pitch_data.get("strikeZoneBottom", 1.55)
        velocity = pitch_data.get("startSpeed", 0)
        pitch_type_code = details.get("type", {}).get("code", "")
        pitch_type_desc = details.get("type", {}).get("description", "")

        # Determine original call from challenger type:
        # Batters challenge Called Strikes (they want a Ball)
        # Fielders challenge Balls (they want a Strike)
        # The pitch event's call description may reflect the POST-review
        # result, so we derive the original call from who challenged.
        if challenger_type == "Batter":
            original_call = "Called Strike"
        else:
            original_call = "Ball"

        # Pre-pitch count: subtract the result of the challenged pitch.
        # After an overturn, the final call is flipped. We use the original
        # call to determine what was added to the count.
        if original_call == "Called Strike":
            # Strike was added (whether it stuck or got overturned, the
            # post-count reflects the final state after the challenge)
            if is_overturned:
                # Overturned: strike→ball, so post-count has the ball added
                pre_balls = max(0, post_balls - 1)
                pre_strikes = post_strikes
            else:
                # Confirmed: strike stands
                pre_balls = post_balls
                pre_strikes = max(0, post_strikes - 1)
        else:
            # Original call was Ball
            if is_overturned:
                # Overturned: ball→strike, so post-count has the strike added
                pre_balls = post_balls
                pre_strikes = max(0, post_strikes - 1)
            else:
                # Confirmed: ball stands
                pre_balls = max(0, post_balls - 1)
                pre_strikes = post_strikes

        # Derive inZone from the ABS ruling (ground truth), not our zone math.
        # Batters challenge Called Strikes: overturn → ABS says ball (not in zone)
        # Fielders challenge Balls: overturn → ABS says strike (in zone)
        if challenger_type == "Batter":
            in_zone = not is_overturned  # confirmed = strike stands = in zone
        else:
            in_zone = is_overturned  # overturned = ABS says strike = in zone

        # Miss distance for pitches ABS ruled as balls (outside zone)
        if in_zone:
            miss_dist = 0.0
        else:
            miss_dist = calc_miss_distance(px, pz, sz_top, sz_bot)

        # Get catcher from the fielding team's lineup (position C / fielder_2)
        catcher_name = ""
        fielding_side = "home" if half == "top" else "away"
        boxscore = game_data.get("liveData", {}).get("boxscore", {})
        fielding_players = boxscore.get("teams", {}).get(fielding_side, {}).get("players", {})
        for pid, pinfo in fielding_players.items():
            pos = pinfo.get("position", {}).get("abbreviation", "")
            if pos == "C":
                catcher_name = pinfo.get("person", {}).get("fullName", "")
                break

        challenges.append({
            "date": game_date,
            "gamePk": game_pk,
            "inning": inning,
            "balls": pre_balls,
            "strikes": pre_strikes,
            "outs": post_count.get("outs", 0),
            "batter": batter_name,
            "batterId": batter_id,
            "pitcher": pitcher_name,
            "pitcherId": pitcher_id,
            "catcher": catcher_name,
            "team": batting_abbr,
            "teamName": TEAM_FULL_NAMES.get(batting_abbr, batting_abbr),
            "opponent": fielding_abbr,
            "umpire": umpire_name,
            "challengerType": challenger_type,
            "pitchType": pitch_type_code,
            "pitchName": pitch_type_desc,
            "velocity": round(velocity, 1) if velocity else 0,
            "px": round(px, 3),
            "pz": round(pz, 3),
            "zoneTop": round(sz_top, 3),
            "zoneBot": round(sz_bot, 3),
            "inZone": in_zone,
            "missDistance": round(miss_dist, 4),
            "missDistanceInches": round(miss_dist * 12, 2),
            "originalCall": original_call,
            "overturned": is_overturned,
            "result": "Overturned" if is_overturned else "Confirmed",
        })

    return challenges


# ── Main Pipeline ────────────────────────────────────────────────────────────

def run_pipeline():
    today = datetime.now().strftime("%Y-%m-%d")
    start = OPENING_DAY

    print(f"ABS Challenge Explorer — Fetching data from {start} to {today}")
    print(f"Source: MLB Stats API play-by-play feed\n")

    all_challenges = []
    current = datetime.strptime(start, "%Y-%m-%d")
    end = datetime.strptime(today, "%Y-%m-%d")

    while current <= end:
        date_str = current.strftime("%Y-%m-%d")
        print(f"[{date_str}]")

        # Get games and umpires for this date
        try:
            games = get_games_and_umpires_for_date(date_str)
        except Exception as e:
            print(f"  Schedule fetch error: {e}")
            current += timedelta(days=1)
            continue

        if not games:
            print(f"  No completed games")
            current += timedelta(days=1)
            continue

        print(f"  {len(games)} games")

        # Scan each game's play-by-play for challenges
        day_challenges = 0
        for gp, umpire in games:
            try:
                url = f"{MLB_API_LIVE}/game/{gp}/feed/live"
                game_data = fetch_json(url)
                challenges = extract_challenges_from_game(gp, game_data, umpire)
                if challenges:
                    all_challenges.extend(challenges)
                    day_challenges += len(challenges)
                    print(f"    Game {gp}: {len(challenges)} challenges (umpire: {umpire})")
            except Exception as e:
                print(f"    Game {gp} error: {e}")
            time.sleep(1)  # Be respectful

        if day_challenges:
            print(f"  → {day_challenges} challenges found")
        else:
            print(f"  No challenges found")

        current += timedelta(days=1)

    print(f"\n{'='*60}")
    print(f"Total challenges found: {len(all_challenges)}")

    if not all_challenges:
        print("No challenge data found. Exiting without writing files.")
        sys.exit(0)

    # Assign sequential IDs
    for i, c in enumerate(all_challenges, 1):
        c["id"] = i

    # ── Output ──
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    output = {
        "lastUpdated": datetime.utcnow().isoformat() + "Z",
        "season": SEASON,
        "challenges": all_challenges,
    }
    challenges_path = os.path.join(OUTPUT_DIR, "abs-challenges.json")
    with open(challenges_path, "w") as f:
        json.dump(output, f)
    print(f"\nWrote {challenges_path} ({len(all_challenges)} challenges)")

    summary = build_summary(all_challenges)
    summary_path = os.path.join(OUTPUT_DIR, "abs-summary.json")
    with open(summary_path, "w") as f:
        json.dump(summary, f)
    print(f"Wrote {summary_path}")


def build_summary(challenges):
    total = len(challenges)
    overturned = sum(1 for c in challenges if c["overturned"])

    batter_ch = [c for c in challenges if c["challengerType"] == "Batter"]
    fielder_ch = [c for c in challenges if c["challengerType"] == "Fielder"]

    by_team = defaultdict(lambda: {"total": 0, "overturned": 0})
    for c in challenges:
        by_team[c["team"]]["total"] += 1
        if c["overturned"]:
            by_team[c["team"]]["overturned"] += 1
    team_board = [{"team": t, **d, "overturnRate": round(d["overturned"] / d["total"] * 100, 1) if d["total"] else 0}
                  for t, d in sorted(by_team.items(), key=lambda x: -x[1]["total"])]

    by_player = defaultdict(lambda: {"total": 0, "overturned": 0})
    for c in challenges:
        by_player[c["batter"]]["total"] += 1
        if c["overturned"]:
            by_player[c["batter"]]["overturned"] += 1
    player_board = [{"player": p, **d, "overturnRate": round(d["overturned"] / d["total"] * 100, 1) if d["total"] else 0}
                    for p, d in sorted(by_player.items(), key=lambda x: -x[1]["total"])][:50]

    by_umpire = defaultdict(lambda: {"total": 0, "overturned": 0})
    for c in challenges:
        by_umpire[c["umpire"]]["total"] += 1
        if c["overturned"]:
            by_umpire[c["umpire"]]["overturned"] += 1
    umpire_board = [{"umpire": u, **d, "overturnRate": round(d["overturned"] / d["total"] * 100, 1) if d["total"] else 0}
                    for u, d in sorted(by_umpire.items(), key=lambda x: -x[1]["total"])]

    by_day = defaultdict(lambda: {"total": 0, "overturned": 0})
    for c in challenges:
        by_day[c["date"]]["total"] += 1
        if c["overturned"]:
            by_day[c["date"]]["overturned"] += 1
    daily = [{"date": d, **v} for d, v in sorted(by_day.items())]

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
    }


if __name__ == "__main__":
    run_pipeline()
