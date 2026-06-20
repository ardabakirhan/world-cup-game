# -*- coding: utf-8 -*-
"""
Second-pass matching for players missing from FC 26.

1. Look them up in FC 25 (sofifa dump, June 2025), then FC 24 (stefanoleone992).
   Matching is DOB-driven (clubs have changed, so club is NOT used).
2. Matched players get real stats, "source": "FC25"/"FC24", estimated=false.
   FC24 players aged 30+ get a light physical decline (pace -3, physical -2).
3. Still-unmatched players are re-estimated from the team's (approximate) FIFA
   ranking with a caps bonus, replacing the old 87.5%-of-position-average rule.

Outputs: updated teams.json (+ app copy), unmatched_players.json (remaining),
second_pass_log.json, console report.
"""
import csv
import json
import re
import shutil
from collections import defaultdict
from datetime import date, datetime, timedelta

from rapidfuzz import fuzz

from build_dataset import NATIONALITY, norm  # same normalization as pass 1

# accepted nationality spellings per team (sofifa naming varies by year)
NAT_ALIASES = {
    "CPV": {"cabo verde", "cape verde islands", "cape verde"},
    "COD": {"congo dr", "dr congo", "congo"},
    "IRN": {"iran", "ir iran"},
    "KOR": {"korea republic", "south korea"},
    "USA": {"united states", "usa", "united states of america"},
}


def nat_ok(team_id, row_nat):
    # unknown is not a mismatch; the FC25 dump leaks the league name
    # 'Friendly International' into country_name on unscraped rows
    if not row_nat or norm(row_nat) == "friendly international":
        return True
    n = norm(row_nat)
    allowed = NAT_ALIASES.get(team_id, set()) | {norm(NATIONALITY[team_id])}
    return n in allowed

FC25_CSV = (r"C:\Users\abaki\.cache\kagglehub\datasets\aniss7"
            r"\fifa-player-data-from-sofifa-2025-06-03\versions\1"
            r"\player-data-full-2025-june.csv")
FC24_CSV = (r"C:\Users\abaki\.cache\kagglehub\datasets\stefanoleone992"
            r"\ea-sports-fc-24-complete-player-dataset\versions\4\male_players.csv")

REF_DATE = date(2026, 6, 11)

# Approximate FIFA men's ranking (late 2025/early 2026). Only used to band the
# estimation floor for players with no FC24-26 record; ±5 places is harmless.
FIFA_RANK = {
    "ARG": 1, "ESP": 2, "FRA": 3, "ENG": 4, "BRA": 5, "POR": 6, "NED": 7,
    "BEL": 8, "GER": 9, "CRO": 10, "MAR": 11, "COL": 13, "MEX": 14, "URU": 15,
    "USA": 16, "SUI": 17, "SEN": 18, "JPN": 19, "IRN": 20, "KOR": 22,
    "AUT": 23, "ECU": 24, "AUS": 26, "TUR": 27, "CAN": 28, "NOR": 29,
    "PAN": 31, "EGY": 33, "SWE": 35, "ALG": 36, "SCO": 38, "PAR": 39,
    "TUN": 41, "CIV": 42, "CZE": 44, "QAT": 50, "UZB": 55, "KSA": 58,
    "IRQ": 59, "COD": 60, "RSA": 61, "JOR": 66, "BIH": 70, "CPV": 71,
    "GHA": 74, "NZL": 86, "HAI": 88, "CUW": 90,
}

GK_KEYS = ["diving", "handling", "kicking", "reflexes", "speed", "positioning"]
CORE_KEYS = ["pace", "shooting", "passing", "dribbling", "defending", "physical"]


def to_int(v):
    try:
        return int(round(float(v)))
    except (ValueError, TypeError):
        # sofifa dumps write modifiers like '65+2' — take the base number
        if isinstance(v, str):
            m = re.match(r"\s*(-?\d+)", v)
            if m:
                return int(m.group(1))
        return None


def age_on(dob, ref=REF_DATE):
    try:
        b = datetime.strptime(dob, "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return None
    return ref.year - b.year - ((ref.month, ref.day) < (b.month, b.day))


# ------------------------------------------------------------- load legacy
def load_fc25():
    rows = []
    with open(FC25_CSV, encoding="utf-8", errors="replace") as f:
        for r in csv.DictReader(f):
            # FC25's Brazilian league is a fake-name roster (all DOBs are Feb 29)
            if r.get("club_league_name") == "Série A":
                continue
            r["_names"] = [norm(r.get("name") or ""), norm(r.get("full_name") or "")]
            rows.append(r)
    return rows


def load_fc24():
    best = {}
    with open(FC24_CSV, encoding="utf-8", errors="replace") as f:
        for r in csv.DictReader(f):
            if to_int(r.get("fifa_version")) != 24:
                continue
            if r.get("league_name") == "Série A":  # fake Brazilian roster
                continue
            pid = r["player_id"]
            upd = to_int(r.get("fifa_update")) or 0
            if pid not in best or upd > best[pid][0]:
                best[pid] = (upd, r)
    rows = []
    for _, r in best.values():
        r["_names"] = [norm(r.get("short_name") or ""), norm(r.get("long_name") or "")]
        rows.append(r)
    return rows


def index_rows(rows):
    by_dob = defaultdict(list)
    by_name = defaultdict(list)
    for r in rows:
        by_dob[r.get("dob") or ""].append(r)
        for n in set(r["_names"]):
            if n:
                by_name[n].append(r)
    return {"dob": by_dob, "name": by_name}


def name_score(wname, row):
    s = 0
    for cand in row["_names"]:
        if not cand:
            continue
        s = max(s,
                fuzz.token_sort_ratio(wname, cand),
                fuzz.partial_token_sort_ratio(wname, cand),
                fuzz.token_set_ratio(wname, cand) - 2)
    return s


def near_dates(dob, days=5):
    try:
        d = datetime.strptime(dob, "%Y-%m-%d")
    except (ValueError, TypeError):
        return []
    return [(d + timedelta(n)).strftime("%Y-%m-%d")
            for n in range(-days, days + 1) if n != 0]


def match_legacy(wp, idx, team_id, nat_field):
    """DOB-driven matching; club intentionally ignored (transfers happened).
    Nationality must match the national team, except for near-perfect name
    hits (dual nationals are sometimes listed under their other country)."""
    wname = norm(wp["name"])

    def strict_score(row):
        # full-name agreement only — token_set inflates subset overlaps
        # ('Brian Rodríguez' vs 'Rodrigo Sánchez Rodríguez')
        return max((fuzz.token_sort_ratio(wname, c) for c in row["_names"] if c),
                   default=0)

    def accept(row, _score):
        return nat_ok(team_id, row.get(nat_field)) or strict_score(row) >= 93

    # a) exact normalized name + exact/near DOB
    for r in idx["name"].get(wname, []):
        if (r.get("dob") == wp["birthDate"] or r.get("dob") in near_dates(wp["birthDate"])) \
                and accept(r, 100):
            return r, "exact_name+dob"
    # b) exact DOB + fuzzy name
    best, best_s = None, 0
    for r in idx["dob"].get(wp["birthDate"], []):
        s = name_score(wname, r)
        if s > best_s:
            best, best_s = r, s
    if best is not None and best_s >= 72 and accept(best, best_s):
        return best, f"dob+fuzzy({best_s:.0f})"
    # c) DOB within ±5 days + strong fuzzy name
    for d in near_dates(wp["birthDate"]):
        for r in idx["dob"].get(d, []):
            s = name_score(wname, r)
            if s >= 85 and accept(r, s):
                return r, "neardob+fuzzy"
    return None, None


# --------------------------------------------------- stats from legacy rows
def f(row, key):
    return to_int(row.get(key))


def stats_from_fc25(row, is_gk):
    def w(parts):
        tot, ws = 0.0, 0.0
        for key, weight in parts:
            v = f(row, key)
            if v is not None:
                tot += v * weight
                ws += weight
        return int(round(tot / ws)) if ws else None

    stats = {
        "overall": f(row, "overall_rating"),
        "potential": f(row, "potential"),
        "pace": w([("acceleration", .45), ("sprint_speed", .55)]),
        "shooting": w([("finishing", .45), ("shot_power", .2), ("long_shots", .2),
                       ("positioning", .05), ("penalties", .05), ("volleys", .05)]),
        "passing": w([("short_passing", .35), ("vision", .2), ("crossing", .2),
                      ("long_passing", .15), ("curve", .05), ("fk_accuracy", .05)]),
        "dribbling": w([("ball_control", .35), ("dribbling", .3), ("agility", .1),
                        ("balance", .05), ("reactions", .1), ("composure", .1)]),
        "defending": w([("defensive_awareness", .3), ("standing_tackle", .3),
                        ("sliding_tackle", .1), ("interceptions", .2),
                        ("heading_accuracy", .1)]),
        "physical": w([("strength", .5), ("stamina", .25), ("aggression", .2),
                       ("jumping", .05)]),
    }
    gk = None
    if is_gk:
        gk = {
            "diving": f(row, "gk_diving"), "handling": f(row, "gk_handling"),
            "kicking": f(row, "gk_kicking"), "reflexes": f(row, "gk_reflexes"),
            "speed": w([("acceleration", .45), ("sprint_speed", .55)]),
            "positioning": f(row, "gk_positioning"),
        }
        for k in CORE_KEYS:
            stats[k] = None
    extras = {
        "skillMoves": to_int(row.get("skill_moves")) or 0,
        "weakFoot": to_int(row.get("weak_foot")) or 0,
        "preferredFoot": row.get("preferred_foot") or "Right",
    }
    return stats, gk, extras


def stats_from_fc24(row, is_gk):
    stats = {
        "overall": f(row, "overall"), "potential": f(row, "potential"),
        "pace": f(row, "pace"), "shooting": f(row, "shooting"),
        "passing": f(row, "passing"), "dribbling": f(row, "dribbling"),
        "defending": f(row, "defending"), "physical": f(row, "physic"),
    }
    gk = None
    if is_gk:
        gk = {
            "diving": f(row, "goalkeeping_diving"), "handling": f(row, "goalkeeping_handling"),
            "kicking": f(row, "goalkeeping_kicking"), "reflexes": f(row, "goalkeeping_reflexes"),
            "speed": f(row, "goalkeeping_speed"), "positioning": f(row, "goalkeeping_positioning"),
        }
        for k in CORE_KEYS:
            stats[k] = None
    extras = {
        "skillMoves": to_int(row.get("skill_moves")) or 0,
        "weakFoot": to_int(row.get("weak_foot")) or 0,
        "preferredFoot": row.get("preferred_foot") or "Right",
    }
    return stats, gk, extras


def fill_stat_gaps(stats, gk, position):
    """Some FC25 rows carry only overall/potential (detail page not scraped).
    Anchor the missing per-stat values on the real overall via the position
    shape so the engine never sees nulls."""
    ov = stats.get("overall")
    if ov is None:
        return
    if position != "GK":
        shape = SHAPE[position]
        for k in CORE_KEYS:
            if stats.get(k) is None:
                stats[k] = max(30, min(90, ov + shape[k]))
    if gk is not None:
        tmpl = {"diving": ov, "handling": ov - 2, "kicking": ov - 8,
                "reflexes": ov + 1, "speed": 45, "positioning": ov - 1}
        for k in GK_KEYS:
            if gk.get(k) is None:
                gk[k] = tmpl[k]
    if stats.get("potential") is None:
        stats["potential"] = ov


def apply_aging(stats, source, dob):
    """FC24 data is two seasons old; trim pace/physical for 30+ players."""
    if source != "FC24":
        return
    a = age_on(dob)
    if a is None or a < 30:
        return
    if stats.get("pace"):
        stats["pace"] = max(30, stats["pace"] - 3)
    if stats.get("physical"):
        stats["physical"] = max(30, stats["physical"] - 2)


# ------------------------------------------------- ranking-based estimation
def caps_bonus(caps):
    if caps >= 100:
        return 5.0
    if caps >= 50:
        return 3.0
    if caps >= 25:
        return 1.5
    if caps >= 10:
        return 0.5
    return 0.0


def jitter(player_id):
    h = 0
    for c in player_id:
        h = (h * 31 + ord(c)) & 0xFFFFFFFF
    return (h % 300) / 100.0 - 1.5  # -1.5 .. +1.5


SHAPE = {  # core-stat offsets from overall, per position
    "DF": {"pace": -2, "shooting": -24, "passing": -8, "dribbling": -10, "defending": 2, "physical": 3},
    "MF": {"pace": -3, "shooting": -8, "passing": 2, "dribbling": 1, "defending": -8, "physical": -4},
    "FW": {"pace": 3, "shooting": 2, "passing": -8, "dribbling": 1, "defending": -28, "physical": -6},
}


def estimate_player(team_id, pl):
    rank = FIFA_RANK.get(team_id, 75)
    base = max(62.0, 79.0 - 0.22 * rank)
    ov = int(round(min(82, base + caps_bonus(pl["caps"]) + jitter(pl["id"]))))
    a = age_on(pl["birthDate"]) or 27
    pot = min(ov + 8, max(ov, ov + (26 - a)))
    stats = {"overall": ov, "potential": pot}
    if pl["position"] == "GK":
        for k in CORE_KEYS:
            stats[k] = None
        gk = {"diving": ov, "handling": ov - 2, "kicking": ov - 8,
              "reflexes": ov + 1, "speed": 45, "positioning": ov - 1}
    else:
        shape = SHAPE[pl["position"]]
        for k in CORE_KEYS:
            stats[k] = max(30, min(90, ov + shape[k]))
        gk = None
    return stats, gk


# -------------------------------------------------------------------- main
def main():
    teams = json.load(open("teams.json", encoding="utf-8"))["teams"]
    # rebuild the worklist from teams.json so re-runs are idempotent:
    # everything that did not come straight from FC26 is reprocessed
    unmatched = [
        {"team": t["id"], "name": p["name"], "number": p["number"],
         "position": p["position"], "birthDate": p["birthDate"], "club": p["club"]}
        for t in teams for p in t["players"]
        if p.get("source", "estimate" if p["estimated"] else "FC26") != "FC26"
    ]
    print(f"second pass over {len(unmatched)} non-FC26 players")

    print("loading FC25...", end=" ")
    fc25 = index_rows(load_fc25())
    print("ok | loading FC24...", end=" ")
    fc24 = index_rows(load_fc24())
    print("ok")

    by_team = {t["id"]: t for t in teams}
    log, still_unmatched = [], []
    counts = defaultdict(int)

    for u in unmatched:
        team = by_team[u["team"]]
        pl = next(p for p in team["players"] if p["number"] == u["number"])
        is_gk = pl["position"] == "GK"

        row, method = match_legacy(u, fc25, u["team"], "country_name")
        source = "FC25" if row else None
        if row is None:
            row, method = match_legacy(u, fc24, u["team"], "nationality_name")
            source = "FC24" if row else None

        if row is not None:
            if source == "FC25":
                stats, gk, extras = stats_from_fc25(row, is_gk)
            else:
                stats, gk, extras = stats_from_fc24(row, is_gk)
            fill_stat_gaps(stats, gk, pl["position"])
            apply_aging(stats, source, pl["birthDate"])
            pl["stats"] = stats
            pl["gkStats"] = gk
            pl["estimated"] = False
            pl["source"] = source
            pl.update(extras)
            counts[source] += 1
            log.append({
                "team": u["team"], "player": u["name"], "source": source,
                "matched": row["_names"][0], "dob": row.get("dob"),
                "club_then": row.get("club_name"), "overall": stats["overall"],
                "method": method,
            })
        else:
            # re-estimate with ranking + caps rule
            stats, gk = estimate_player(u["team"], pl)
            pl["stats"] = stats
            pl["gkStats"] = gk
            pl["estimated"] = True
            pl["source"] = "estimate"
            counts["estimate"] += 1
            still_unmatched.append(u)

    # tag the original FC26 matches for consistency
    for t in teams:
        for p in t["players"]:
            if "source" not in p:
                p["source"] = "estimate" if p["estimated"] else "FC26"

    with open("teams.json", "w", encoding="utf-8") as fh:
        json.dump({"teams": teams}, fh, ensure_ascii=False, indent=2)
    shutil.copy("teams.json", r"app\src\data\teams.json")
    with open("unmatched_players.json", "w", encoding="utf-8") as fh:
        json.dump(still_unmatched, fh, ensure_ascii=False, indent=2)
    with open("second_pass_log.json", "w", encoding="utf-8") as fh:
        json.dump(log, fh, ensure_ascii=False, indent=2)

    # ------------------------------------------------------------- report
    total = sum(len(t["players"]) for t in teams)
    src_counts = defaultdict(int)
    for t in teams:
        for p in t["players"]:
            src_counts[p["source"]] += 1
    print(f"\nsecond-pass matches: FC25={counts['FC25']}  FC24={counts['FC24']}  "
          f"still estimated={counts['estimate']}")
    print("final sources:", dict(src_counts), f"(total {total})")
    real = total - src_counts["estimate"]
    print(f"real data ratio: {real}/{total} = {real/total*100:.1f}%")

    # sanity: Neymar
    bra = by_team["BRA"]
    ney = next((p for p in bra["players"] if "Neymar" in p["name"]), None)
    if ney:
        print(f"\nNeymar: source={ney.get('source')} overall={ney['stats']['overall']} "
              f"pace={ney['stats']['pace']} shooting={ney['stats']['shooting']} "
              f"dribbling={ney['stats']['dribbling']} estimated={ney['estimated']}")

    # sanity: Mexico average
    mex = by_team["MEX"]
    mex_avg = sum(p["stats"]["overall"] for p in mex["players"]) / 26
    mex_real = sum(1 for p in mex["players"] if not p["estimated"])
    print(f"Mexico: avg overall={mex_avg:.1f} (target 75-80), real-data players={mex_real}/26")

    # sanity: high-caps estimated players got a sensible floor
    est_caps = [(p["caps"], p["stats"]["overall"], p["name"], t["id"])
                for t in teams for p in t["players"]
                if p["estimated"] and p["caps"] >= 50]
    est_caps.sort(reverse=True)
    print(f"\nestimated players with 50+ caps ({len(est_caps)}):")
    for caps, ov, name, tid in est_caps[:12]:
        print(f"  {tid} {name}: {caps} caps -> OVR {ov}")


if __name__ == "__main__":
    main()
