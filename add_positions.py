# -*- coding: utf-8 -*-
"""
add_positions.py
Adds a detailed FC26 "positions" array + "primaryPosition" to every player in
teams_full.json.

  - Matched players (estimated == False): looked up in fc26_players.csv via the
    `player_positions` column (comma-separated, e.g. "CAM, CM"). Primary first,
    de-duplicated.
  - Players with no FC26 row (estimated == True, or an FC25/FC24-only match):
    positions = [primaryPosition] where primaryPosition is a representative
    detailed code derived from the broad GK/DF/MF/FW position.

Run merge_avatars.py afterwards to regenerate app/src/data/teams.json.
"""
import csv
import json
import re
import sys
import unicodedata
from collections import defaultdict

CSV_PATH = "fc26_players.csv"
FULL_PATH = "teams_full.json"
MATCH_LOG = "match_log.json"
SECOND_PASS_LOG = "second_pass_log.json"

# broad GK/DF/MF/FW -> representative detailed code for players with no FC26 row
BROAD_DEFAULT = {"GK": "GK", "DF": "CB", "MF": "CM", "FW": "ST"}

VALID_CODES = {
    "GK", "CB", "LB", "RB", "LWB", "RWB", "CDM", "CM", "CAM",
    "LM", "RM", "LW", "RW", "CF", "ST",
}


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s or "")
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.lower()
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def parse_positions(raw: str):
    out = []
    for tok in (raw or "").split(","):
        code = tok.strip().upper()
        if code and code not in out:
            out.append(code)
    return out


def load_csv():
    rows = []
    with open(CSV_PATH, encoding="utf-8") as f:
        for r in csv.DictReader(f):
            rows.append({
                "dob": r["dob"].strip(),
                "short": r["short_name"].strip(),
                "long": r["long_name"].strip(),
                "nshort": norm(r["short_name"]),
                "nlong": norm(r["long_name"]),
                "overall": int(r["overall"]) if r["overall"].strip() else None,
                "positions": parse_positions(r["player_positions"]),
            })
    return rows


def build_indexes(rows):
    by_dob = defaultdict(list)
    by_short_dob = {}            # (nshort, dob) -> row  (high confidence, from logs)
    by_surname_overall = defaultdict(list)
    by_nlong = defaultdict(list)
    for r in rows:
        by_dob[r["dob"]].append(r)
        by_short_dob[(r["nshort"], r["dob"])] = r
        sur = r["nlong"].split()[-1] if r["nlong"] else ""
        if sur and r["overall"] is not None:
            by_surname_overall[(sur, r["overall"])].append(r)
        if r["nlong"]:
            by_nlong[r["nlong"]].append(r)
    return by_dob, by_short_dob, by_surname_overall, by_nlong


def load_log_hints():
    """(team, normalized display name) -> (fc26 short_name, fc26Dob)."""
    hints = {}
    try:
        for e in json.load(open(MATCH_LOG, encoding="utf-8")):
            if e.get("fc26") and e.get("fc26Dob"):
                hints[(e["team"], norm(e["wiki"]))] = (norm(e["fc26"]), e["fc26Dob"])
    except FileNotFoundError:
        pass
    # second pass log is FC25/FC24 (not in the FC26 csv) — ignored for FC26 lookup
    return hints


def name_score(player_tokens, row):
    if not player_tokens:
        return 0
    p_sur = player_tokens[-1]
    pset = set(player_tokens)
    lt = row["nlong"].split()
    st = row["nshort"].split()
    score = 0
    if lt and p_sur == lt[-1]:
        score += 3
    if st and p_sur == st[-1]:
        score += 3
    score += len(pset & set(lt))
    # short-name "J. Bellingham" style: initial + surname
    if st and len(st) >= 2 and st[-1] == p_sur and st[0][:1] == player_tokens[0][:1]:
        score += 2
    return score


def match_row(player, team_id, idx, hints):
    by_dob, by_short_dob, by_surname_overall, by_nlong = idx
    name = player["name"]
    dob = player.get("birthDate", "")
    overall = player.get("stats", {}).get("overall")
    ntokens = norm(name).split()

    # Tier 1: authoritative log hint -> exact CSV row
    hint = hints.get((team_id, norm(name)))
    if hint and hint in by_short_dob:
        return by_short_dob[hint], "log_hint"

    # Tier 2: same DOB, disambiguate by surname (+ exact overall bonus)
    cands = by_dob.get(dob, [])
    if cands:
        best, best_score = None, -1
        for r in cands:
            sc = name_score(ntokens, r)
            if overall is not None and r["overall"] == overall:
                sc += 5
            if sc > best_score:
                best, best_score = r, sc
        # require a surname/name agreement (>=3) OR a unique dob+overall hit
        if best_score >= 3:
            return best, "dob+name"
        if overall is not None:
            ov = [r for r in cands if r["overall"] == overall]
            if len(ov) == 1:
                return ov[0], "dob+overall"

    # Tier 3: surname + exact overall, globally unique
    if ntokens and overall is not None:
        cand = by_surname_overall.get((ntokens[-1], overall), [])
        if len(cand) == 1:
            return cand[0], "surname+overall"

    # Tier 4: exact full normalized name, globally unique
    cand = by_nlong.get(norm(name), [])
    if len(cand) == 1:
        return cand[0], "exact_name"

    return None, "unmatched"


def main():
    rows = load_csv()
    idx = build_indexes(rows)
    hints = load_log_hints()

    full = json.load(open(FULL_PATH, encoding="utf-8"))["teams"]

    n_matched_fc26 = 0
    n_estimated = 0
    n_generated = 0
    n_matched_no_fc26 = 0   # real (non-generated) player not found in FC26 csv (FC25/FC24 etc.)
    multi = 0
    methods = defaultdict(int)
    unmatched_samples = []

    for t in full:
        for p in t["players"]:
            broad = p.get("position", "MF")
            default = BROAD_DEFAULT.get(broad, "CM")
            # A player is an FC26 candidate only if it is a real (non-generated)
            # matched player. Generated/procedural players carry estimated:false
            # too, but they are fake and must never match a real FC26 row.
            is_fc26_candidate = (not p.get("estimated", True)) and (not p.get("generated", False))
            if is_fc26_candidate:
                row, method = match_row(p, t["id"], idx, hints)
                methods[method] += 1
                if row and row["positions"]:
                    positions = []
                    for c in row["positions"]:
                        c = c if c in VALID_CODES else c
                        if c not in positions:
                            positions.append(c)
                    p["positions"] = positions
                    p["primaryPosition"] = positions[0]
                    n_matched_fc26 += 1
                    if len(positions) > 1:
                        multi += 1
                else:
                    p["positions"] = [default]
                    p["primaryPosition"] = default
                    n_matched_no_fc26 += 1
                    if len(unmatched_samples) < 15:
                        unmatched_samples.append(f"{t['id']} {p['name']} ({broad}/{p.get('stats',{}).get('overall')})")
            else:
                p["positions"] = [default]
                p["primaryPosition"] = default
                if p.get("generated", False):
                    n_generated += 1
                else:
                    n_estimated += 1

    json.dump({"teams": full}, open(FULL_PATH, "w", encoding="utf-8"),
              ensure_ascii=False, indent=2)

    real_candidates = n_matched_fc26 + n_matched_no_fc26
    print("=== add_positions.py ===")
    print(f"real FC26-matched (positions from CSV)     : {n_matched_fc26}")
    print(f"real, no FC26 row (FC25/FC24 -> default)    : {n_matched_no_fc26}")
    print(f"estimated:true players (-> default)         : {n_estimated}")
    print(f"generated/procedural players (-> default)   : {n_generated}")
    print(f"match methods: {dict(methods)}")
    if real_candidates:
        print(f"FC26 coverage of REAL matched players       : {n_matched_fc26}/{real_candidates} = {100*n_matched_fc26/real_candidates:.1f}%")
    if n_matched_fc26:
        print(f"multi-position (>1) among FC26-matched      : {multi}/{n_matched_fc26} = {100*multi/n_matched_fc26:.1f}%")
    if unmatched_samples:
        print("sample real-but-not-in-csv:", file=sys.stderr)
        for s in unmatched_samples:
            print("   ", s, file=sys.stderr)
    print(f"written: {FULL_PATH}")


if __name__ == "__main__":
    main()
