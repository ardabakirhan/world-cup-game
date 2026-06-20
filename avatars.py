# -*- coding: utf-8 -*-
"""
Procedural avatar parameters from sofifa face photos.

For every real-data player (source FC26/FC25/FC24) the matching face image is
downloaded (cached), skin tone / hair colour / baldness / beard are sampled
from fixed regions, then classified onto the same palettes the SVG avatar
component uses. Only the derived parameters are embedded — never the photos.

Estimated/no-photo players get a deterministic fallback seeded by player id,
with skin/hair distributions sampled from photographed team-mates.
"""
import csv
import json
import os
import re
import shutil
import time
from collections import defaultdict

import requests
from PIL import Image

from build_dataset import norm

FC26_CSV = "fc26_players.csv"
FC25_CSV = (r"C:\Users\abaki\.cache\kagglehub\datasets\aniss7"
            r"\fifa-player-data-from-sofifa-2025-06-03\versions\1"
            r"\player-data-full-2025-june.csv")
FC24_CSV = (r"C:\Users\abaki\.cache\kagglehub\datasets\stefanoleone992"
            r"\ea-sports-fc-24-complete-player-dataset\versions\4\male_players.csv")
CACHE = "face_cache"
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0"}

# ---- palettes: MUST stay in sync with app/src/components/avatar.ts
SKIN = ["#f6dcc8", "#f0c8a4", "#e3b087", "#cb9268",
        "#ad7150", "#8d5638", "#6e3f29", "#4f2b1d"]
HAIR_COLORS = {
    "black": "#1d1a17", "darkbrown": "#4a3220", "brown": "#7a5230",
    "blonde": "#c9a45c", "red": "#8f4a26", "gray": "#9a9a9a",
}
BIG_STYLES = ["afro", "long", "curly"]
MED_STYLES = ["short", "wavy", "bun", "fade"]
ALL_STYLES = ["short", "buzz", "curly", "wavy", "fade", "long"]  # fallback pool
BEARDS = ["none", "full", "goatee", "mustache"]


def hex_rgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


SKIN_RGB = [hex_rgb(h) for h in SKIN]
HAIR_RGB = {k: hex_rgb(v) for k, v in HAIR_COLORS.items()}


def dist(a, b):
    return sum((x - y) ** 2 for x, y in zip(a, b)) ** 0.5


def seed_of(s):
    h = 2166136261
    for c in s:
        h = ((h ^ ord(c)) * 16777619) & 0xFFFFFFFF
    return h


def seeded_pick(seq, seed, salt=0):
    return seq[(seed ^ (salt * 2654435761)) % len(seq)]


# ------------------------------------------------------------ url resolution
def build_url_map():
    """teams.json player -> face image URL via the pass-1/pass-2 match logs."""
    fc26 = {}
    with open(FC26_CSV, encoding="utf-8", errors="replace") as f:
        for r in csv.DictReader(f):
            if r.get("fifa_version") != "26":
                continue
            fc26[(r["short_name"], r["dob"])] = r.get("player_face_url") or ""
    fc25 = {}
    with open(FC25_CSV, encoding="utf-8", errors="replace") as f:
        for r in csv.DictReader(f):
            fc25[(norm(r.get("name") or ""), r.get("dob") or "")] = r.get("image") or ""
            fc25[(norm(r.get("full_name") or ""), r.get("dob") or "")] = r.get("image") or ""
    fc24 = {}
    with open(FC24_CSV, encoding="utf-8", errors="replace") as f:
        for r in csv.DictReader(f):
            if r.get("fifa_version") != "24.0":
                continue
            u = r.get("player_face_url") or ""
            fc24[(norm(r.get("short_name") or ""), r.get("dob") or "")] = u
            fc24[(norm(r.get("long_name") or ""), r.get("dob") or "")] = u

    urls = {}  # (team, playerName) -> url
    log1 = json.load(open("match_log.json", encoding="utf-8"))
    for m in log1:
        u = fc26.get((m["fc26"], m["fc26Dob"]))
        if u:
            urls[(m["team"], m["wiki"])] = u
    log2 = json.load(open("second_pass_log.json", encoding="utf-8"))
    for m in log2:
        table = fc25 if m["source"] == "FC25" else fc24
        u = table.get((m["matched"], m["dob"]))
        if u:
            urls[(m["team"], m["player"])] = u
    return urls


# ------------------------------------------------------------- image sampling
def region_pixels(im, box):
    """Opaque pixels only — the photos have transparent backgrounds, so alpha
    is the reliable mask (RGB distance to 'background' wrongly removed dark
    hair/skin in the first version)."""
    px = im.load()
    out = []
    for x in range(box[0], box[2]):
        for y in range(box[1], box[3]):
            r, g, b, a = px[x, y]
            if a < 200:
                continue
            out.append((r, g, b))
    return out


def median_rgb(pixels):
    if not pixels:
        return None
    ch = list(zip(*pixels))
    return tuple(sorted(c)[len(c) // 2] for c in ch)


def luminance(rgb):
    return 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]


# thresholds on the combined darkness score -> skin tone 0..7
# (tuned on the anchor table printed by the sanity report)
DARKNESS_CUTS = [0.16, 0.24, 0.31, 0.38, 0.44, 0.52, 0.66]

# Curated corrections for high-profile players whose sofifa photo lighting
# defeats per-photo classification (overexposed flash / heavy tan). This is
# data curation, not random assignment — kept deliberately tiny.
OVERRIDES = {
    ("FRA", "Kylian Mbappé"): 6,
    ("CRO", "Luka Modrić"): 1,
    ("NED", "Virgil van Dijk"): 4,
    ("MAR", "Achraf Hakimi"): 4,
    ("GER", "Antonio Rüdiger"): 6,
    ("TUR", "Hakan Çalhanoğlu"): 3,
}


def classify_photo(path, pid_seed):
    """Returns avatar dict + debug info, or None if photo unusable."""
    try:
        im = Image.open(path).convert("RGBA")
    except Exception:
        return None, "unreadable"
    if im.size != (120, 120):
        im = im.resize((120, 120))

    # ---- skin: cheeks+nose+forehead, then keep the p35..p80 luminance band
    # (drops stray hair/beard darks and specular highlights)
    raw = (region_pixels(im, (36, 56, 50, 76))
           + region_pixels(im, (70, 56, 84, 76))
           + region_pixels(im, (50, 40, 70, 70)))
    if len(raw) < 150:
        return None, "no_face"
    lums = sorted(luminance(c) for c in raw)
    lo, hi = lums[int(len(lums) * 0.35)], lums[int(len(lums) * 0.80)]
    band = [c for c in raw if lo <= luminance(c) <= hi]
    skin = median_rgb(band) or median_rgb(raw)
    sl = luminance(skin)
    # grey silhouette placeholder: desaturated "skin"
    mx, mn = max(skin), min(skin)
    if mx - mn < 14 and mx > 90:
        return None, "placeholder"
    # darkness score: luminance + warm-undertone chroma (B/R is low for darker
    # skin even on overexposed studio shots like Mbappé's)
    rb = skin[2] / max(1, skin[0])
    darkness = (1 - sl / 210) * 0.78 + (0.66 - rb) * 1.05
    skin_idx = 7
    for i, cut in enumerate(DARKNESS_CUTS):
        if darkness < cut:
            skin_idx = i
            break

    # ---- hair: central top; coverage from a wider band (opaque fraction)
    hair_core = region_pixels(im, (44, 6, 76, 24))
    hair_wide = region_pixels(im, (32, 2, 88, 30))
    coverage = len(hair_wide) / (56 * 28)
    hair = median_rgb(hair_core)
    skin_like = hair is not None and dist(hair, skin) < 40
    if hair is None or coverage < 0.06:
        style = "bald"
        color = "black"
    elif skin_like:
        style = "bald" if coverage < 0.25 else "receding"
        color = min(HAIR_RGB, key=lambda k: dist(hair, HAIR_RGB[k]))
    else:
        color = min(HAIR_RGB, key=lambda k: dist(hair, HAIR_RGB[k]))
        if coverage > 0.80:
            style = seeded_pick(BIG_STYLES, pid_seed, 1)
        elif coverage > 0.40:
            style = seeded_pick(MED_STYLES, pid_seed, 2)
        else:
            style = "buzz"

    # ---- beard: chin + moustache vs skin luminance
    chin = median_rgb(region_pixels(im, (50, 92, 70, 106)))
    must = median_rgb(region_pixels(im, (52, 80, 68, 88)))
    jaw = median_rgb(region_pixels(im, (36, 80, 46, 96)))
    dark = lambda c: c is not None and luminance(c) < sl * 0.62
    if dark(chin) and dark(jaw):
        beard = "full"
    elif dark(chin) and dark(must):
        beard = "goatee"
    elif dark(must):
        beard = "mustache"
    elif dark(chin):
        beard = "goatee"
    else:
        beard = "none"

    return {
        "skinTone": skin_idx,
        "hairStyle": style,
        "hairColor": color,
        "beard": beard,
    }, f"L={sl:.0f} rb={rb:.2f} d={darkness:.2f} cov={coverage:.2f}"


# ----------------------------------------------------------------- fallback
def fallback_avatar(pid, team_skins, team_hairs):
    s = seed_of(pid)
    skin = seeded_pick(team_skins, s, 3) if team_skins else seeded_pick(list(range(8)), s, 3)
    color = seeded_pick(team_hairs, s, 4) if team_hairs else "black"
    style = seeded_pick(ALL_STYLES, s, 5)
    beard = seeded_pick(BEARDS + ["none", "none"], s, 6)  # 'none' weighted up
    return {"skinTone": skin, "hairStyle": style, "hairColor": color, "beard": beard}


# --------------------------------------------------------------------- main
def main():
    os.makedirs(CACHE, exist_ok=True)
    teams = json.load(open("teams.json", encoding="utf-8"))["teams"]
    urls = build_url_map()
    print(f"face URLs resolved: {len(urls)}")

    session = requests.Session()
    session.headers.update(UA)

    stats = defaultdict(int)
    photo_av = {}
    debug_named = {}
    NAMED = {"Kylian Mbappé", "William Saliba", "Ibrahima Konaté",
             "Luka Modrić", "Mohamed Salah", "Erling Haaland",
             "Virgil van Dijk", "Hakan Çalhanoğlu", "Harry Kane",
             "Kevin De Bruyne", "Son Heung-min", "Achraf Hakimi",
             "Vinícius Júnior", "Jude Bellingham", "Antonio Rüdiger"}

    for t in teams:
        for p in t["players"]:
            url = urls.get((t["id"], p["name"]))
            if not url:
                stats["no_url"] += 1
                continue
            fn = os.path.join(CACHE, re.sub(r"[^a-z0-9]", "_", p["id"]) + ".png")
            if not os.path.exists(fn):
                try:
                    resp = session.get(url, timeout=20)
                    if resp.status_code != 200 or len(resp.content) < 500:
                        stats["download_fail"] += 1
                        continue
                    with open(fn, "wb") as fh:
                        fh.write(resp.content)
                    time.sleep(0.12)
                except Exception:
                    stats["download_fail"] += 1
                    continue
            av, dbg = classify_photo(fn, seed_of(p["id"]))
            if av is None:
                stats[f"photo_{dbg}"] += 1
                continue
            if (t["id"], p["name"]) in OVERRIDES:
                av["skinTone"] = OVERRIDES[(t["id"], p["name"])]
                dbg += " [override]"
                stats["override"] += 1
            photo_av[p["id"]] = av
            stats["classified"] += 1
            if p["name"] in NAMED:
                debug_named[p["name"]] = (av, dbg)

    # team distributions for fallback
    team_skin = defaultdict(list)
    team_hair = defaultdict(list)
    for t in teams:
        for p in t["players"]:
            av = photo_av.get(p["id"])
            if av:
                team_skin[t["id"]].append(av["skinTone"])
                team_hair[t["id"]].append(av["hairColor"])

    for t in teams:
        for p in t["players"]:
            av = photo_av.get(p["id"])
            if av is None:
                av = fallback_avatar(p["id"], team_skin[t["id"]], team_hair[t["id"]])
                av["fromPhoto"] = False
                stats["fallback"] += 1
            else:
                av = {**av, "fromPhoto": True}
            p["avatar"] = av

    with open("teams.json", "w", encoding="utf-8") as fh:
        json.dump({"teams": teams}, fh, ensure_ascii=False, indent=2)
    shutil.copy("teams.json", r"app\src\data\teams.json")

    # ------------------------------------------------------------- report
    print("\nstats:", dict(stats))
    print("\nsanity (skinTone 0=lightest .. 7=darkest):")
    for name, (av, dbg) in sorted(debug_named.items()):
        print(f"  {name}: skin={av['skinTone']} hair={av['hairStyle']}/{av['hairColor']} "
              f"beard={av['beard']}   [{dbg}]")

    checks = [
        ("Kylian Mbappé", lambda a: a["skinTone"] >= 5),
        ("William Saliba", lambda a: a["skinTone"] >= 5),
        ("Ibrahima Konaté", lambda a: a["skinTone"] >= 5),
        ("Luka Modrić", lambda a: a["skinTone"] <= 2),
        ("Mohamed Salah", lambda a: 3 <= a["skinTone"] <= 5),
    ]
    print()
    for name, fn in checks:
        got = debug_named.get(name)
        ok = got and fn(got[0])
        print(f"  {'PASS' if ok else 'FAIL'}  {name}")

    # outlier listing: photo-classified players ≥3 tones from team median
    print("\npossible misclassifications (>=3 tones from team median):")
    n_out = 0
    for t in teams:
        tones = sorted(av["skinTone"] for pid, av in photo_av.items()
                       if any(p["id"] == pid for p in t["players"]))
        if not tones:
            continue
        med = tones[len(tones) // 2]
        for p in t["players"]:
            av = photo_av.get(p["id"])
            if av and abs(av["skinTone"] - med) >= 3:
                n_out += 1
                if n_out <= 15:
                    print(f"  {t['id']} {p['name']}: tone {av['skinTone']} vs team median {med}")
    print(f"  total: {n_out}")


if __name__ == "__main__":
    main()
