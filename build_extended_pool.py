# -*- coding: utf-8 -*-
"""
build_extended_pool.py
Generates an "extendedPool" for every team in teams_full.json.

For each of the 211 FIFA member associations, finds all players in
fc26_players.csv with matching nationality_name (the fc26_nation field
from ALL_FIFA_TEAMS), filters out the 26 already in the squad (by DOB
or normalised name), then keeps the top 15-20 by overall rating.

Run AFTER build_dataset.py + add_positions.py, BEFORE merge_avatars.py.

Output: teams_full.json  (extendedPool added to every team object)
"""
import csv
import hashlib
import json
import re
import sys
import unicodedata
from collections import defaultdict

if sys.stdout.encoding and sys.stdout.encoding.lower() not in ('utf-8', 'utf8'):
    sys.stdout = open(sys.stdout.fileno(), mode='w', encoding='utf-8', buffering=1)

# ── Import shared constants from build_dataset.py ────────────────────────────
# We only need ALL_FIFA_TEAMS, to_int and the stat column lists.
# build_dataset.py gates heavy work in if __name__ == "__main__", so importing
# is safe, but it drags in requests/bs4. Fall back to inline mapping if needed.
try:
    from build_dataset import ALL_FIFA_TEAMS, to_int
except ImportError:
    def to_int(v):
        try:
            return int(float(v))
        except (ValueError, TypeError):
            return None
    ALL_FIFA_TEAMS = {}  # populated below from inline table

# ── Inline fallback for ALL_FIFA_TEAMS (used if import fails) ────────────────
# This is a condensed version: only the fc26_nation column is needed here.
INLINE_FC26_NATION = {
    "ALB": "Albania", "AND": "Andorra", "ARM": "Armenia", "AUT": "Austria",
    "AZE": "Azerbaijan", "BEL": "Belgium", "BIH": "Bosnia Herzegovina",
    "BLR": "Belarus", "BUL": "Bulgaria", "CRO": "Croatia", "CYP": "Cyprus",
    "CZE": "Czechia", "DEN": "Denmark", "ENG": "England", "EST": "Estonia",
    "FRO": "Faroe Islands", "FIN": "Finland", "FRA": "France", "GEO": "Georgia",
    "GER": "Germany", "GIB": "Gibraltar", "GRE": "Greece", "HUN": "Hungary",
    "ISL": "Iceland", "IRL": "Republic of Ireland", "ISR": "Israel",
    "ITA": "Italy", "KAZ": "Kazakhstan", "KOS": "Kosovo", "LVA": "Latvia",
    "LIE": "Liechtenstein", "LTU": "Lithuania", "LUX": "Luxembourg",
    "MLT": "Malta", "MDA": "Moldova", "MNE": "Montenegro",
    "MKD": "North Macedonia", "NED": "Netherlands", "NIR": "Northern Ireland",
    "NOR": "Norway", "POL": "Poland", "POR": "Portugal", "ROU": "Romania",
    "RUS": "Russia", "SMR": "San Marino", "SCO": "Scotland", "SRB": "Serbia",
    "SVK": "Slovakia", "SVN": "Slovenia", "ESP": "Spain", "SWE": "Sweden",
    "SUI": "Switzerland", "TUR": "Türkiye", "UKR": "Ukraine", "WAL": "Wales",
    "AFG": "Afghanistan", "AUS": "Australia", "BHR": "Bahrain",
    "BAN": "Bangladesh", "BHU": "Bhutan", "BRU": "Brunei", "CAM": "Cambodia",
    "CHN": "China PR", "TPE": "Chinese Taipei", "GUM": "Guam",
    "HKG": "Hong Kong", "IND": "India", "IDN": "Indonesia", "IRN": "Iran",
    "IRQ": "Iraq", "JPN": "Japan", "JOR": "Jordan",
    "KGZ": "Kyrgyz Republic", "PRK": "Korea DPR", "KOR": "Korea Republic",
    "KUW": "Kuwait", "LAO": "Laos", "LIB": "Lebanon", "MAC": "Macau",
    "MAS": "Malaysia", "MDV": "Maldives", "MNG": "Mongolia", "MYA": "Myanmar",
    "NEP": "Nepal", "OMA": "Oman", "PAK": "Pakistan", "PLE": "Palestine",
    "PHI": "Philippines", "QAT": "Qatar", "KSA": "Saudi Arabia",
    "SGP": "Singapore", "SRI": "Sri Lanka", "SYR": "Syria",
    "TJK": "Tajikistan", "THA": "Thailand", "TLS": "Timor-Leste",
    "TKM": "Turkmenistan", "UAE": "United Arab Emirates", "UZB": "Uzbekistan",
    "VIE": "Vietnam", "YEM": "Yemen",
    "ALG": "Algeria", "ANG": "Angola", "BEN": "Benin", "BOT": "Botswana",
    "BFA": "Burkina Faso", "BDI": "Burundi", "CMR": "Cameroon",
    "CPV": "Cape Verde", "CTA": "Central African Rep.", "CHA": "Chad",
    "COM": "Comoros", "CGO": "Congo", "COD": "Congo DR",
    "CIV": "Côte d'Ivoire", "DJI": "Djibouti", "EGY": "Egypt",
    "EQG": "Equatorial Guinea", "ERI": "Eritrea", "ETH": "Ethiopia",
    "SWZ": "Eswatini", "GAB": "Gabon", "GAM": "Gambia", "GHA": "Ghana",
    "GUI": "Guinea", "GNB": "Guinea-Bissau", "KEN": "Kenya",
    "LES": "Lesotho", "LBR": "Liberia", "LBA": "Libya",
    "MAD": "Madagascar", "MAW": "Malawi", "MLI": "Mali",
    "MTN": "Mauritania", "MRI": "Mauritius", "MAR": "Morocco",
    "MOZ": "Mozambique", "NAM": "Namibia", "NIG": "Niger", "NGA": "Nigeria",
    "RWA": "Rwanda", "STP": "São Tomé e Príncipe", "SEN": "Senegal",
    "SEY": "Seychelles", "SLE": "Sierra Leone", "SOM": "Somalia",
    "RSA": "South Africa", "SSD": "South Sudan", "SDN": "Sudan",
    "TAN": "Tanzania", "TOG": "Togo", "TUN": "Tunisia", "UGA": "Uganda",
    "ZAM": "Zambia", "ZIM": "Zimbabwe",
    "AIA": "Anguilla", "ATG": "Antigua & Barbuda", "ARU": "Aruba",
    "BAH": "Bahamas", "BRB": "Barbados", "BLZ": "Belize", "BER": "Bermuda",
    "VGB": "British Virgin Islands", "CAN": "Canada", "CAY": "Cayman Islands",
    "CRC": "Costa Rica", "CUB": "Cuba", "CUW": "Curacao", "DMA": "Dominica",
    "DOM": "Dominican Republic", "SLV": "El Salvador", "GRN": "Grenada",
    "GUA": "Guatemala", "GUY": "Guyana", "HAI": "Haiti", "HON": "Honduras",
    "JAM": "Jamaica", "MEX": "Mexico", "MSR": "Montserrat",
    "NCA": "Nicaragua", "PAN": "Panama", "PUR": "Puerto Rico",
    "SKN": "Saint Kitts And Nevis", "LCA": "Saint Lucia",
    "VIN": "Saint Vincent", "SUR": "Suriname", "TRI": "Trinidad & Tobago",
    "TCA": "Turks And Caicos Islands", "USA": "United States",
    "VIR": "US Virgin Islands",
    "ARG": "Argentina", "BOL": "Bolivia", "BRA": "Brazil", "CHI": "Chile",
    "COL": "Colombia", "ECU": "Ecuador", "PAR": "Paraguay", "PER": "Peru",
    "URU": "Uruguay", "VEN": "Venezuela",
    "ASA": "American Samoa", "COK": "Cook Islands", "FIJ": "Fiji",
    "NCL": "New Caledonia", "NZL": "New Zealand", "PNG": "Papua New Guinea",
    "SAM": "Samoa", "SOL": "Solomon Islands", "TAH": "Tahiti",
    "TGA": "Tonga", "VAN": "Vanuatu",
}


def fc26_nation_for(code: str) -> str | None:
    if ALL_FIFA_TEAMS:
        info = ALL_FIFA_TEAMS.get(code)
        return info.get("fc26_nation") if info else None
    return INLINE_FC26_NATION.get(code)


# ── Stat column mappings (same as build_dataset.py) ──────────────────────────
GK_COLS = ["goalkeeping_diving", "goalkeeping_handling", "goalkeeping_kicking",
           "goalkeeping_reflexes", "goalkeeping_speed", "goalkeeping_positioning"]
GK_KEYS = ["diving", "handling", "kicking", "reflexes", "speed", "positioning"]
CORE_COLS = ["pace", "shooting", "passing", "dribbling", "defending", "physic"]
CORE_KEYS = ["pace", "shooting", "passing", "dribbling", "defending", "physical"]

# ── FC26 position code → broad position ──────────────────────────────────────
FC26_TO_BROAD = {
    "GK": "GK",
    "CB": "DF", "LB": "DF", "RB": "DF", "LWB": "DF", "RWB": "DF",
    "CDM": "MF", "CM": "MF", "CAM": "MF", "LM": "MF", "RM": "MF",
    "LCM": "MF", "RCM": "MF", "LAM": "MF", "RAM": "MF",
    "LDM": "MF", "RDM": "MF",
    "LW": "FW", "RW": "FW", "ST": "FW", "CF": "FW",
    "LS": "FW", "RS": "FW", "LF": "FW", "RF": "FW",
}

VALID_DETAILED = {
    "GK", "CB", "LB", "RB", "LWB", "RWB", "CDM", "CM", "CAM",
    "LM", "RM", "LW", "RW", "CF", "ST",
}
BROAD_DEFAULT_FROM_POS = {"GK": "GK", "DF": "CB", "MF": "CM", "FW": "ST"}

MAX_POOL = 20
MIN_POOL = 5


def norm(s: str) -> str:
    s = (s or "").replace("ı", "i").replace("İ", "I").replace("ø", "o")
    s = s.replace("ð", "d").replace("ß", "ss").replace("Ł", "L").replace("ł", "l")
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.encode("ascii", "ignore").decode()
    s = re.sub(r"[-''.]", " ", s.lower())
    return re.sub(r"\s+", " ", s).strip()


def stable_caps(player_id: str) -> int:
    """Deterministic 0-5 cap count seeded on FC26 player_id."""
    h = int(hashlib.md5(player_id.encode()).hexdigest()[:4], 16)
    return h % 6  # 0..5


def parse_positions(raw: str):
    out = []
    for tok in (raw or "").split(","):
        code = tok.strip().upper()
        if code and code not in out:
            out.append(code)
    return out


def broad_from_positions(pos_list):
    for p in pos_list:
        b = FC26_TO_BROAD.get(p)
        if b:
            return b
    return "MF"


def stats_from_row(row, is_gk: bool):
    stats = {
        "overall":   to_int(row["overall"]),
        "potential": to_int(row.get("potential")),
    }
    for k, c in zip(CORE_KEYS, CORE_COLS):
        stats[k] = to_int(row.get(c))
    gk = None
    if is_gk:
        gk = {k: to_int(row.get(c)) for k, c in zip(GK_KEYS, GK_COLS)}
    return stats, gk


def load_fc26():
    """Load FC26 CSV — best update per player, index by nationality."""
    best = {}
    with open("fc26_players.csv", encoding="utf-8", errors="replace") as f:
        for row in csv.DictReader(f):
            if row.get("fifa_version") != "26":
                continue
            if row.get("league_name") == "Série A":
                continue
            pid = row["player_id"]
            upd = to_int(row.get("fifa_update")) or 0
            if pid not in best or upd > best[pid][0]:
                best[pid] = (upd, row)

    by_nation: dict[str, list] = defaultdict(list)
    for _, row in best.values():
        nat = row.get("nationality_name", "")
        if nat:
            by_nation[nat].append(row)
    return by_nation


def player_from_row(row, code: str, seq: int) -> dict:
    """Convert a FC26 CSV row to a pool player dict (same schema as teams.json players)."""
    positions = [c for c in parse_positions(row.get("player_positions", ""))
                 if c in VALID_DETAILED]
    # also keep any codes we don't validate strictly (just de-dupe)
    if not positions:
        positions = [p for p in parse_positions(row.get("player_positions", ""))]

    broad = broad_from_positions(positions)
    is_gk = broad == "GK"
    stats, gk_stats = stats_from_row(row, is_gk)
    pid = row["player_id"]

    # Deterministic low caps (0-5 — fringe international)
    caps = stable_caps(pid)

    # Jersey number from nation team, fall back to seq
    nat_jersey = to_int(row.get("nation_jersey_number"))
    jersey = nat_jersey if nat_jersey and nat_jersey > 0 else (100 + seq)

    return {
        "id":            f"{code.lower()}_ep_{pid}",
        "name":          row.get("long_name") or row.get("short_name") or f"Player {seq}",
        "number":        jersey,
        "position":      broad,
        "positions":     positions if positions else [BROAD_DEFAULT_FROM_POS.get(broad, "CM")],
        "primaryPosition": positions[0] if positions else BROAD_DEFAULT_FROM_POS.get(broad, "CM"),
        "birthDate":     row.get("dob", ""),
        "club":          row.get("club_name") or "",
        "caps":          caps,
        "goals":         0,
        "stats":         stats,
        "gkStats":       gk_stats,
        "skillMoves":    to_int(row.get("skill_moves")) or (1 if is_gk else 2),
        "weakFoot":      to_int(row.get("weak_foot")) or 3,
        "preferredFoot": row.get("preferred_foot") or "Right",
        "estimated":     False,
        "poolPlayer":    True,
    }


def main():
    print("Loading teams_full.json …")
    with open("teams_full.json", encoding="utf-8") as f:
        data = json.load(f)
    teams = data["teams"]

    print("Loading fc26_players.csv …")
    by_nation = load_fc26()
    print(f"  Nationalities found: {len(by_nation)}")

    total_pool = 0
    empty_teams = 0

    for team in teams:
        code = team["id"]
        fc26_nat = fc26_nation_for(code)
        if not fc26_nat:
            team["extendedPool"] = []
            continue

        nation_players = by_nation.get(fc26_nat, [])
        if not nation_players:
            team["extendedPool"] = []
            empty_teams += 1
            continue

        # Build exclusion sets from existing 26-man squad
        squad_dobs = {p["birthDate"] for p in team["players"] if p.get("birthDate")}
        squad_names_norm = {norm(p["name"]) for p in team["players"] if p.get("name")}

        # Filter candidates
        candidates = []
        for row in nation_players:
            dob = row.get("dob", "")
            # Exclude by DOB (same player already in squad)
            if dob and dob in squad_dobs:
                continue
            # Exclude by normalised name match
            long_n = norm(row.get("long_name", ""))
            short_n = norm(row.get("short_name", ""))
            if long_n in squad_names_norm or (short_n and short_n in squad_names_norm):
                continue
            ovr = to_int(row.get("overall")) or 0
            if ovr < 50:  # skip very low-rated players
                continue
            candidates.append((ovr, row))

        # Sort by overall descending, take top 15-20
        candidates.sort(key=lambda x: -x[0])
        take = min(MAX_POOL, max(MIN_POOL, len(candidates)))
        chosen = candidates[:take]

        pool_players = []
        for seq, (_, row) in enumerate(chosen):
            pool_players.append(player_from_row(row, code, seq + 1))

        team["extendedPool"] = pool_players
        total_pool += len(pool_players)

    print(f"Extended pool built: {total_pool} players across {len(teams)} teams")
    print(f"  Teams with empty pool (no FC26 nation match): {empty_teams}")

    # Spot check
    for check_id in ("TUR", "JAM", "ENG", "ARG"):
        t = next((x for x in teams if x["id"] == check_id), None)
        if t:
            ep = t.get("extendedPool", [])
            ovrs = [p["stats"]["overall"] for p in ep]
            print(f"  {check_id}: {len(ep)} pool players, OVR range {min(ovrs) if ovrs else '-'}–{max(ovrs) if ovrs else '-'}")

    print("Writing teams_full.json …")
    with open("teams_full.json", "w", encoding="utf-8") as f:
        json.dump({"teams": teams}, f, ensure_ascii=False, indent=2)
    print("Done.")


if __name__ == "__main__":
    main()
