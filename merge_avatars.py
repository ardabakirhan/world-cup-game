# -*- coding: utf-8 -*-
"""
merge_avatars.py
Merges avatar data from the existing 48-team app/src/data/teams.json
into teams_full.json (211 teams), generating deterministic fallbacks
for all players that don't have a photo-derived avatar.
Output: app/src/data/teams.json (overwritten with full 211-team dataset)
"""
import json, os, hashlib, random as _random, shutil

FULL     = "teams_full.json"
APP_DATA = r"app\src\data\teams.json"
OUT      = r"app\src\data\teams.json"

ALL_STYLES  = ["short", "buzz", "curly", "wavy", "fade", "long", "bald", "afro"]
ALL_BEARDS  = ["none", "none", "none", "stubble", "full", "goatee", "mustache"]
HAIR_COLORS = ["black", "darkbrown", "brown", "blonde", "red", "gray"]

# Confederation → skin tone weight distribution (index 0..7, lightest..darkest)
CONF_SKIN = {
    "UEFA":     [4, 5, 3, 2, 1, 0, 0, 0],   # mostly light
    "CONMEBOL": [1, 2, 3, 3, 2, 1, 0, 0],
    "CONCACAF": [1, 2, 2, 2, 2, 2, 1, 0],
    "AFC":      [1, 2, 3, 3, 2, 1, 0, 0],
    "CAF":      [0, 0, 1, 2, 3, 3, 3, 2],   # mostly dark
    "OFC":      [0, 1, 2, 3, 3, 2, 1, 0],
}
CONF_HAIR = {
    "UEFA":     ["black", "darkbrown", "brown", "blonde", "red", "gray"],
    "CONMEBOL": ["black", "black", "darkbrown", "brown", "brown", "blonde"],
    "CONCACAF": ["black", "black", "darkbrown", "brown", "brown", "blonde"],
    "AFC":      ["black", "black", "black", "darkbrown", "brown", "brown"],
    "CAF":      ["black", "black", "black", "black", "darkbrown", "brown"],
    "OFC":      ["black", "black", "darkbrown", "brown", "blonde", "gray"],
}


def seed_of(s: str) -> int:
    h = int(hashlib.md5(s.encode()).hexdigest()[:8], 16)
    return h


def weighted_pick(weights, rng):
    total = sum(weights)
    r = rng.randint(0, total - 1)
    for i, w in enumerate(weights):
        r -= w
        if r < 0:
            return i
    return len(weights) - 1


def make_fallback(player_id: str, confederation: str, team_skins: list, team_hairs: list):
    rng = _random.Random(seed_of(player_id))
    if team_skins:
        skin = team_skins[seed_of(player_id + "s") % len(team_skins)]
    else:
        weights = CONF_SKIN.get(confederation, CONF_SKIN["UEFA"])
        skin = weighted_pick(weights, rng)
    if team_hairs:
        color = team_hairs[seed_of(player_id + "h") % len(team_hairs)]
    else:
        pool = CONF_HAIR.get(confederation, CONF_HAIR["UEFA"])
        color = pool[rng.randint(0, len(pool) - 1)]
    style = ALL_STYLES[seed_of(player_id + "st") % len(ALL_STYLES)]
    beard = ALL_BEARDS[seed_of(player_id + "b") % len(ALL_BEARDS)]
    return {"skinTone": skin, "hairStyle": style, "hairColor": color, "beard": beard, "fromPhoto": False}


def main():
    with open(FULL, encoding="utf-8") as f:
        full = json.load(f)["teams"]

    # Build avatar lookup from existing app data (WC teams, has photo avatars)
    avatar_by_id: dict[str, dict] = {}
    if os.path.exists(APP_DATA):
        with open(APP_DATA, encoding="utf-8") as f:
            app_teams = json.load(f)["teams"]
        for t in app_teams:
            for p in t["players"] + t.get("extendedPool", []):
                if "avatar" in p:
                    avatar_by_id[p["id"]] = p["avatar"]
    print(f"Photo avatars loaded: {len(avatar_by_id)}")

    n_photo = n_fallback = 0
    for t in full:
        conf = t.get("confederation", "UEFA")

        # Collect team skin/hair from already-classified team-mates for fallback coherence
        team_skins = []
        team_hairs = []
        for p in t["players"] + t.get("extendedPool", []):
            av = avatar_by_id.get(p["id"])
            if av:
                team_skins.append(av["skinTone"])
                team_hairs.append(av.get("hairColor", "black"))

        for p in t["players"] + t.get("extendedPool", []):
            av = avatar_by_id.get(p["id"])
            if av:
                p["avatar"] = av
                n_photo += 1
            else:
                p["avatar"] = make_fallback(p["id"], conf, team_skins, team_hairs)
                n_fallback += 1

    print(f"Photo avatars applied: {n_photo}")
    print(f"Fallback avatars generated: {n_fallback}")
    print(f"Total players: {n_photo + n_fallback}")
    print(f"Total teams: {len(full)}")

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump({"teams": full}, f, ensure_ascii=False, indent=2)
    print(f"Written: {OUT}")


if __name__ == "__main__":
    main()
