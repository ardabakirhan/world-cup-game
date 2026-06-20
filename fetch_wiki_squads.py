# -*- coding: utf-8 -*-
"""
fetch_wiki_squads.py
Upgrades 163 generated (Layer 3) teams to real squads (Layer 2) using Wikipedia.

Sources:
  UEFA Euro 2024 → 24 UEFA teams (12 non-WC)
  AFCON 2023      → 24 CAF teams
  AFCON 2025      → 24 CAF teams
  AFC Asian Cup 2023 → 24 AFC teams (15+ non-WC)
  CONCACAF Gold Cup 2023 → 16 teams
  CONCACAF Gold Cup 2025 → 16 teams
  Copa América 2024 → 16 teams (4 CONMEBOL + CONCACAF)
  OFC Nations Cup 2024 → 10 OFC teams
"""
import sys
if sys.stdout.encoding and sys.stdout.encoding.lower() not in ("utf-8", "utf8"):
    sys.stdout = open(sys.stdout.fileno(), mode="w", encoding="utf-8", buffering=1)

import json, re, os, hashlib, random as _random, time
from collections import defaultdict
from datetime import datetime

import requests
from bs4 import BeautifulSoup

# Import shared infrastructure from build_dataset
from build_dataset import (
    norm, name_score, club_score, near_dates, dob_close,
    match_player, stats_from_row, _estimate_unmatched,
    generate_procedural_team, pts_to_ovr_range, stable_rng,
    _make_gk_stats, load_fc26, load_isim_seeds, to_int,
    SQUAD_POSITIONS, POS_STAT_MULT, CORE_KEYS, GK_KEYS,
    ALL_FIFA_TEAMS, get_team_tournaments,
)

UA = {"User-Agent": "WorldCupGameDataBot/1.0 (educational game research; ardabakirhan38@gmail.com)"}
FETCH_DELAY = 4  # seconds between Wikipedia requests
RETIRE_BEFORE = 1989  # born < 1989 → age > 37 by June 2026, retire

POS_MAP = {
    "GK": "GK", "G":   "GK",
    "DF": "DF", "D":   "DF", "DEF": "DF", "CB": "DF", "LB": "DF", "RB": "DF",
    "MF": "MF", "M":   "MF", "MID": "MF", "CM": "MF", "CAM": "MF", "CDM": "MF",
    "FW": "FW", "F":   "FW", "ATT": "FW", "ST": "FW", "RW": "FW", "LW": "FW",
}

# ── Wikipedia sources ──────────────────────────────────────────────────────────
WIKI_SOURCES = [
    {
        "key": "euro2024", "year": 2024,
        "url": "https://en.wikipedia.org/wiki/UEFA_Euro_2024_squads",
        "cache": "cache/wiki_euro2024.html",
        "name_map": {
            "Germany": "GER", "Scotland": "SCO", "Hungary": "HUN",
            "Switzerland": "SUI", "Spain": "ESP", "Croatia": "CRO",
            "Italy": "ITA", "Albania": "ALB", "Slovenia": "SVN",
            "Denmark": "DEN", "Serbia": "SRB", "England": "ENG",
            "Netherlands": "NED", "France": "FRA", "Poland": "POL",
            "Austria": "AUT", "Belgium": "BEL", "Slovakia": "SVK",
            "Romania": "ROU", "Ukraine": "UKR", "Turkey": "TUR",
            "Georgia": "GEO", "Portugal": "POR", "Czech Republic": "CZE",
            "Czechia": "CZE",
        },
    },
    {
        "key": "afcon2023", "year": 2024,
        "url": "https://en.wikipedia.org/wiki/2023_Africa_Cup_of_Nations_squads",
        "cache": "cache/wiki_afcon2023.html",
        "name_map": {
            "Ivory Coast": "CIV", "Côte d'Ivoire": "CIV", "Cote d'Ivoire": "CIV",
            "Nigeria": "NGA", "Egypt": "EGY", "South Africa": "RSA",
            "DR Congo": "COD", "Democratic Republic of the Congo": "COD",
            "Guinea": "GUI", "Senegal": "SEN", "Morocco": "MAR",
            "Ghana": "GHA", "Cameroon": "CMR", "Tunisia": "TUN",
            "Algeria": "ALG", "Cape Verde": "CPV", "Mali": "MLI",
            "Burkina Faso": "BFA", "Equatorial Guinea": "EQG",
            "Gambia": "GAM", "Namibia": "NAM", "Mozambique": "MOZ",
            "Angola": "ANG", "Tanzania": "TAN", "Kenya": "KEN",
            "Guinea-Bissau": "GNB", "Zimbabwe": "ZIM",
        },
    },
    {
        "key": "afcon2025", "year": 2025,
        "url": "https://en.wikipedia.org/wiki/2025_Africa_Cup_of_Nations_squads",
        "cache": "cache/wiki_afcon2025.html",
        "name_map": {
            "Morocco": "MAR", "Egypt": "EGY", "Nigeria": "NGA", "Senegal": "SEN",
            "Cameroon": "CMR", "Ivory Coast": "CIV", "Côte d'Ivoire": "CIV",
            "Cote d'Ivoire": "CIV", "Mali": "MLI", "Tunisia": "TUN",
            "Algeria": "ALG", "DR Congo": "COD",
            "Democratic Republic of the Congo": "COD",
            "South Africa": "RSA", "Cape Verde": "CPV", "Burkina Faso": "BFA",
            "Angola": "ANG", "Zambia": "ZAM", "Guinea": "GUI",
            "Equatorial Guinea": "EQG", "Tanzania": "TAN", "Benin": "BEN",
            "Comoros": "COM", "Rwanda": "RWA", "Gabon": "GAB",
            "Kenya": "KEN", "Zimbabwe": "ZIM", "Mozambique": "MOZ",
            "Ghana": "GHA", "Gambia": "GAM", "Namibia": "NAM",
            "Guinea-Bissau": "GNB", "Uganda": "UGA", "Libya": "LBA",
            "Sierra Leone": "SLE", "Madagascar": "MAD", "Malawi": "MAW",
            "Mauritania": "MTN", "Ethiopia": "ETH", "Togo": "TOG",
            "Liberia": "LBR",
        },
    },
    {
        "key": "asiancup2023", "year": 2024,
        "url": "https://en.wikipedia.org/wiki/2023_AFC_Asian_Cup_squads",
        "cache": "cache/wiki_asiancup2023.html",
        "name_map": {
            "Qatar": "QAT", "China": "CHN", "China PR": "CHN",
            "Tajikistan": "TJK", "Lebanon": "LIB", "Iran": "IRN",
            "Iraq": "IRQ", "Vietnam": "VIE", "Japan": "JPN",
            "Indonesia": "IDN", "India": "IND", "Bahrain": "BHR",
            "South Korea": "KOR", "Korea Republic": "KOR",
            "Jordan": "JOR", "Malaysia": "MAS", "Saudi Arabia": "KSA",
            "Kyrgyzstan": "KGZ", "Oman": "OMA", "Australia": "AUS",
            "Syria": "SYR", "Palestine": "PLE", "Thailand": "THA",
            "United Arab Emirates": "UAE", "Philippines": "PHI",
            "Hong Kong": "HKG", "Singapore": "SGP", "Uzbekistan": "UZB",
        },
    },
    {
        "key": "goldcup2023", "year": 2023,
        "url": "https://en.wikipedia.org/wiki/2023_CONCACAF_Gold_Cup_squads",
        "cache": "cache/wiki_goldcup2023.html",
        "name_map": {
            "United States": "USA", "Canada": "CAN", "Mexico": "MEX",
            "Panama": "PAN", "Haiti": "HAI", "Curaçao": "CUW",
            "Curacao": "CUW", "Jamaica": "JAM",
            "Trinidad and Tobago": "TRI", "Trinidad & Tobago": "TRI",
            "Honduras": "HON", "El Salvador": "SLV", "Guatemala": "GUA",
            "Costa Rica": "CRC", "Cuba": "CUB",
            "St. Kitts and Nevis": "SKN", "Saint Kitts and Nevis": "SKN",
            "Bermuda": "BER", "Suriname": "SUR", "Barbados": "BRB",
            "Nicaragua": "NCA",
        },
    },
    {
        "key": "goldcup2025", "year": 2025,
        "url": "https://en.wikipedia.org/wiki/2025_CONCACAF_Gold_Cup_squads",
        "cache": "cache/wiki_goldcup2025.html",
        "name_map": {
            "United States": "USA", "Canada": "CAN", "Mexico": "MEX",
            "Panama": "PAN", "Haiti": "HAI", "Curaçao": "CUW",
            "Curacao": "CUW", "Jamaica": "JAM",
            "Trinidad and Tobago": "TRI", "Trinidad & Tobago": "TRI",
            "Honduras": "HON", "El Salvador": "SLV", "Guatemala": "GUA",
            "Costa Rica": "CRC", "Cuba": "CUB", "Suriname": "SUR",
            "Guyana": "GUY", "Barbados": "BRB",
            "Antigua and Barbuda": "ATG", "Antigua & Barbuda": "ATG",
            "Belize": "BLZ", "Grenada": "GRN",
            "Dominican Republic": "DOM",
            "St. Kitts and Nevis": "SKN", "Saint Kitts and Nevis": "SKN",
            "Saint Vincent and the Grenadines": "VIN",
            "St. Vincent and the Grenadines": "VIN",
        },
    },
    {
        "key": "copa2024", "year": 2024,
        "url": "https://en.wikipedia.org/wiki/2024_Copa_Am%C3%A9rica_squads",
        "cache": "cache/wiki_copa2024.html",
        "name_map": {
            "Argentina": "ARG", "Bolivia": "BOL", "Brazil": "BRA",
            "Chile": "CHI", "Colombia": "COL", "Ecuador": "ECU",
            "Paraguay": "PAR", "Peru": "PER", "Uruguay": "URU",
            "Venezuela": "VEN", "United States": "USA", "Mexico": "MEX",
            "Canada": "CAN", "Costa Rica": "CRC", "Panama": "PAN",
            "Jamaica": "JAM",
        },
    },
    {
        "key": "ofcnc2024", "year": 2024,
        "url": "https://en.wikipedia.org/wiki/2024_OFC_Men%27s_Nations_Cup_squads",
        "cache": "cache/wiki_ofcnc2024.html",
        "name_map": {
            "New Zealand": "NZL", "Fiji": "FIJ", "Solomon Islands": "SOL",
            "New Caledonia": "NCL", "Papua New Guinea": "PNG",
            "Tahiti": "TAH", "Vanuatu": "VAN", "Samoa": "SAM",
            "Tonga": "TGA", "Cook Islands": "COK", "American Samoa": "ASA",
        },
    },
    {
        "key": "afcon2021", "year": 2022,
        "url": "https://en.wikipedia.org/wiki/2021_Africa_Cup_of_Nations_squads",
        "cache": "cache/wiki_afcon2021.html",
        "name_map": {
            "Cameroon": "CMR", "Burkina Faso": "BFA", "Ethiopia": "ETH",
            "Cape Verde": "CPV", "Senegal": "SEN", "Guinea": "GUI",
            "Zimbabwe": "ZIM", "Malawi": "MAW", "Morocco": "MAR",
            "Ghana": "GHA", "Comoros": "COM", "Gabon": "GAB",
            "Nigeria": "NGA", "Egypt": "EGY", "Sudan": "SDN",
            "Guinea-Bissau": "GNB", "Algeria": "ALG", "Sierra Leone": "SLE",
            "Equatorial Guinea": "EQG", "Ivory Coast": "CIV",
            "Côte d'Ivoire": "CIV", "Cote d'Ivoire": "CIV",
            "Tunisia": "TUN", "Mali": "MLI", "Mauritania": "MTN",
            "Gambia": "GAM",
        },
    },
    {
        "key": "wc2022", "year": 2022,
        "url": "https://en.wikipedia.org/wiki/2022_FIFA_World_Cup_squads",
        "cache": "cache/wiki_wc2022.html",
        "name_map": {
            "Wales": "WAL", "Poland": "POL", "Ecuador": "ECU",
            "Senegal": "SEN", "Netherlands": "NED", "England": "ENG",
            "Iran": "IRN", "United States": "USA", "Argentina": "ARG",
            "Saudi Arabia": "KSA", "Mexico": "MEX", "France": "FRA",
            "Australia": "AUS", "Denmark": "DEN", "Tunisia": "TUN",
            "Spain": "ESP", "Costa Rica": "CRC", "Germany": "GER",
            "Japan": "JPN", "Belgium": "BEL", "Canada": "CAN",
            "Morocco": "MAR", "Croatia": "CRO", "Brazil": "BRA",
            "Switzerland": "SUI", "Cameroon": "CMR", "Serbia": "SRB",
            "Portugal": "POR", "Ghana": "GHA", "Uruguay": "URU",
            "South Korea": "KOR", "Qatar": "QAT",
        },
    },
    {
        "key": "afcon2019", "year": 2019,
        "url": "https://en.wikipedia.org/wiki/2019_Africa_Cup_of_Nations_squads",
        "cache": "cache/wiki_afcon2019.html",
        "name_map": {
            "Egypt": "EGY", "Zimbabwe": "ZIM", "DR Congo": "COD",
            "Democratic Republic of the Congo": "COD",
            "Uganda": "UGA", "Nigeria": "NGA", "Guinea": "GUI",
            "Madagascar": "MAD", "Burundi": "BDI", "Senegal": "SEN",
            "Algeria": "ALG", "Kenya": "KEN", "Tanzania": "TAN",
            "Morocco": "MAR", "Ivory Coast": "CIV", "Côte d'Ivoire": "CIV",
            "Cote d'Ivoire": "CIV", "South Africa": "RSA", "Namibia": "NAM",
            "Tunisia": "TUN", "Mali": "MLI", "Angola": "ANG",
            "Mauritania": "MTN", "Cameroon": "CMR", "Ghana": "GHA",
            "Benin": "BEN", "Guinea-Bissau": "GNB",
        },
    },
    {
        "key": "afcon2017", "year": 2017,
        "url": "https://en.wikipedia.org/wiki/2017_Africa_Cup_of_Nations_squads",
        "cache": "cache/wiki_afcon2017.html",
        "name_map": {
            "Gabon": "GAB", "Guinea-Bissau": "GNB", "Cameroon": "CMR",
            "Burkina Faso": "BFA", "Algeria": "ALG", "Zimbabwe": "ZIM",
            "Senegal": "SEN", "Tunisia": "TUN", "Ivory Coast": "CIV",
            "Côte d'Ivoire": "CIV", "Cote d'Ivoire": "CIV",
            "DR Congo": "COD", "Democratic Republic of the Congo": "COD",
            "Morocco": "MAR", "Togo": "TOG", "Ghana": "GHA", "Mali": "MLI",
            "Egypt": "EGY", "Uganda": "UGA",
        },
    },
    {
        "key": "ofcnc2016", "year": 2016,
        "url": "https://en.wikipedia.org/wiki/2016_OFC_Nations_Cup_squads",
        "cache": "cache/wiki_ofcnc2016.html",
        "name_map": {
            "New Zealand": "NZL", "Fiji": "FIJ", "Solomon Islands": "SOL",
            "New Caledonia": "NCL", "Papua New Guinea": "PNG",
            "Tahiti": "TAH", "Vanuatu": "VAN", "Samoa": "SAM",
            "Tonga": "TGA", "Cook Islands": "COK", "American Samoa": "ASA",
        },
    },
    {
        "key": "euro2020", "year": 2021,
        "url": "https://en.wikipedia.org/wiki/UEFA_Euro_2020_squads",
        "cache": "cache/wiki_euro2020.html",
        "name_map": {
            "Italy": "ITA", "Wales": "WAL", "Switzerland": "SUI",
            "Turkey": "TUR", "Denmark": "DEN", "Finland": "FIN",
            "Belgium": "BEL", "Russia": "RUS", "Netherlands": "NED",
            "Ukraine": "UKR", "Austria": "AUT", "North Macedonia": "MKD",
            "England": "ENG", "Croatia": "CRO", "Czech Republic": "CZE",
            "Czechia": "CZE", "Scotland": "SCO", "Poland": "POL",
            "Slovakia": "SVK", "Spain": "ESP", "Sweden": "SWE",
            "Hungary": "HUN", "Portugal": "POR", "Germany": "GER",
            "France": "FRA",
        },
    },
    {
        "key": "euro2016", "year": 2016,
        "url": "https://en.wikipedia.org/wiki/UEFA_Euro_2016_squads",
        "cache": "cache/wiki_euro2016.html",
        "name_map": {
            "France": "FRA", "Romania": "ROU", "Albania": "ALB",
            "Switzerland": "SUI", "Wales": "WAL", "Slovakia": "SVK",
            "England": "ENG", "Russia": "RUS", "Germany": "GER",
            "Poland": "POL", "Northern Ireland": "NIR", "Ukraine": "UKR",
            "Spain": "ESP", "Czech Republic": "CZE", "Czechia": "CZE",
            "Turkey": "TUR", "Croatia": "CRO", "Netherlands": "NED",
            "Portugal": "POR", "Austria": "AUT", "Hungary": "HUN",
            "Iceland": "ISL", "Belgium": "BEL", "Republic of Ireland": "IRL",
            "Ireland": "IRL", "Sweden": "SWE", "Italy": "ITA",
        },
    },
    {
        "key": "asiancup2019", "year": 2019,
        "url": "https://en.wikipedia.org/wiki/2019_AFC_Asian_Cup_squads",
        "cache": "cache/wiki_asiancup2019.html",
        "name_map": {
            "United Arab Emirates": "UAE", "India": "IND", "Bahrain": "BHR",
            "Thailand": "THA", "Australia": "AUS", "Syria": "SYR",
            "Palestine": "PLE", "Jordan": "JOR", "Japan": "JPN",
            "Uzbekistan": "UZB", "Oman": "OMA", "Turkmenistan": "TKM",
            "Iran": "IRN", "Iraq": "IRQ", "Vietnam": "VIE", "Yemen": "YEM",
            "Saudi Arabia": "KSA", "Qatar": "QAT", "Lebanon": "LIB",
            "North Korea": "PRK", "Korea DPR": "PRK",
            "South Korea": "KOR", "Korea Republic": "KOR",
            "China": "CHN", "China PR": "CHN",
            "Kyrgyzstan": "KGZ", "Philippines": "PHI",
        },
    },
    {
        "key": "afcon2015", "year": 2015,
        "url": "https://en.wikipedia.org/wiki/2015_Africa_Cup_of_Nations_squads",
        "cache": "cache/wiki_afcon2015.html",
        "name_map": {
            "Equatorial Guinea": "EQG", "Congo": "CGO",
            "Republic of the Congo": "CGO", "Congo Republic": "CGO",
            "Libya": "LBA", "Burkina Faso": "BFA", "Cameroon": "CMR",
            "Guinea": "GUI", "Senegal": "SEN", "Ghana": "GHA",
            "Algeria": "ALG", "Cape Verde": "CPV", "Ivory Coast": "CIV",
            "Côte d'Ivoire": "CIV", "Cote d'Ivoire": "CIV",
            "Tunisia": "TUN", "Zambia": "ZAM", "Nigeria": "NGA",
            "DR Congo": "COD", "Democratic Republic of the Congo": "COD",
            "Ethiopia": "ETH", "Mali": "MLI", "Morocco": "MAR",
            "South Africa": "RSA", "Togo": "TOG", "Guinea-Bissau": "GNB",
            "Gabon": "GAB", "Malawi": "MAW",
        },
    },
    {
        "key": "afcon2013", "year": 2013,
        "url": "https://en.wikipedia.org/wiki/2013_Africa_Cup_of_Nations_squads",
        "cache": "cache/wiki_afcon2013.html",
        "name_map": {
            "South Africa": "RSA", "Cape Verde": "CPV", "Morocco": "MAR",
            "Angola": "ANG", "Ghana": "GHA",
            "DR Congo": "COD", "Democratic Republic of the Congo": "COD",
            "Togo": "TOG", "Niger": "NIG", "Zambia": "ZAM",
            "Nigeria": "NGA", "Ethiopia": "ETH", "Burkina Faso": "BFA",
            "Ivory Coast": "CIV", "Côte d'Ivoire": "CIV",
            "Cote d'Ivoire": "CIV", "Tunisia": "TUN", "Algeria": "ALG",
            "Mali": "MLI",
        },
    },
    {
        "key": "goldcup2021", "year": 2021,
        "url": "https://en.wikipedia.org/wiki/2021_CONCACAF_Gold_Cup_squads",
        "cache": "cache/wiki_goldcup2021.html",
        "name_map": {
            "United States": "USA", "Canada": "CAN", "Mexico": "MEX",
            "Costa Rica": "CRC", "Curaçao": "CUW", "Curacao": "CUW",
            "Honduras": "HON", "El Salvador": "SLV", "Guatemala": "GUA",
            "Haiti": "HAI", "Grenada": "GRN", "Qatar": "QAT",
            "Trinidad and Tobago": "TRI", "Trinidad & Tobago": "TRI",
            "Jamaica": "JAM", "Panama": "PAN", "Suriname": "SUR",
        },
    },
    {
        "key": "goldcup2019", "year": 2019,
        "url": "https://en.wikipedia.org/wiki/2019_CONCACAF_Gold_Cup_squads",
        "cache": "cache/wiki_goldcup2019.html",
        "name_map": {
            "United States": "USA", "Canada": "CAN", "Mexico": "MEX",
            "Costa Rica": "CRC", "Curaçao": "CUW", "Curacao": "CUW",
            "Honduras": "HON", "El Salvador": "SLV", "Guatemala": "GUA",
            "Haiti": "HAI", "Nicaragua": "NCA", "Cuba": "CUB",
            "Trinidad and Tobago": "TRI", "Trinidad & Tobago": "TRI",
            "Jamaica": "JAM", "Panama": "PAN",
            "Bermuda": "BER", "Guyana": "GUY",
        },
    },
]

# ── HTML fetch (with cache) ────────────────────────────────────────────────────
def fetch_cached_html(path, url):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if not os.path.exists(path):
        print(f"    GET {url}")
        time.sleep(FETCH_DELAY)
        r = requests.get(url, headers=UA, timeout=60)
        if r.status_code == 429:
            print("    Rate limited — waiting 15s…")
            time.sleep(15)
            r = requests.get(url, headers=UA, timeout=60)
        r.raise_for_status()
        with open(path, "w", encoding="utf-8") as f:
            f.write(r.text)
    with open(path, encoding="utf-8") as f:
        return f.read()


# ── Wikipedia squad page parser ───────────────────────────────────────────────
def parse_squad_table(table):
    """Parse one sortable squad table → list of player dicts."""
    players = []
    rows = table.select("tr")
    for tr in rows[1:]:
        cells = tr.find_all(["th", "td"])
        if len(cells) < 4:
            continue
        num_txt = cells[0].get_text(strip=True).split()[0] if cells[0].get_text(strip=True) else ""
        if not num_txt.isdigit():
            continue

        pos_raw = cells[1].get_text(" ", strip=True)
        pos_token = pos_raw.split()[-1].upper() if pos_raw else ""
        pos = POS_MAP.get(pos_token, "MF")

        # Player name: prefer link text, else text minus parentheses / annotations
        pcell = cells[2]
        link = pcell.find("a")
        if link:
            pname = link.get_text(strip=True)
        else:
            pname = re.sub(r"\(.*?\)", "", pcell.get_text(" ", strip=True)).strip()
        # Strip trailing role annotations like "(captain)", "(vice-captain)", "(GK)"
        pname = re.sub(r"\s*\(.*?\)\s*$", "", pname).strip()
        pname = re.sub(r"\s+", " ", pname).strip()

        # Date of birth (YYYY-MM-DD) from parentheses
        dob_cell = cells[3].get_text(" ", strip=True) if len(cells) > 3 else ""
        dob_m = re.search(r"\(\s*(\d{4}-\d{2}-\d{2})\s*\)", dob_cell)
        dob = dob_m.group(1) if dob_m else ""

        caps, goals, club = 0, 0, ""
        if len(cells) >= 6:
            c = cells[4].get_text(strip=True)
            g = cells[5].get_text(strip=True)
            caps = int(c) if c.isdigit() else 0
            goals = int(g) if g.isdigit() else 0
        if len(cells) >= 7:
            cl = cells[6].find_all("a")
            club = (cl[-1].get_text(strip=True) if cl
                    else cells[6].get_text(strip=True).strip())

        if pname:
            players.append({
                "number": int(num_txt),
                "position": pos,
                "name": pname,
                "birthDate": dob,
                "caps": caps,
                "goals": goals,
                "club": club,
            })
    return players


def _next_table(anchor_tag):
    """
    Find the next sortable table after anchor_tag.
    If anchor_tag is inside a mw-heading div, search from that div.
    Otherwise search from anchor_tag itself.
    """
    parent = anchor_tag.parent
    # Use the mw-heading wrapper as the anchor so siblings include the table
    if parent and parent.name == "div" and "mw-heading" in " ".join(parent.get("class") or []):
        search_from = parent
    else:
        search_from = anchor_tag

    for sib in search_from.find_next_siblings():
        classes = " ".join(sib.get("class") or []) if hasattr(sib, "get") else ""
        # Stop at next section header
        if sib.name in ("h2", "h3", "h4"):
            break
        if sib.name == "div" and "mw-heading" in classes:
            break
        # Found a sortable table directly
        if sib.name == "table" and "sortable" in classes:
            return sib
        # Table nested inside a div/p/etc.
        if hasattr(sib, "find"):
            t = sib.find("table", class_="sortable")
            if t:
                return t
    return None


def parse_wiki_squads(html, name_map):
    """Parse a Wikipedia tournament squads page. Returns {code: [player_dicts]}."""
    soup = BeautifulSoup(html, "lxml")
    teams = {}

    for tag in soup.find_all(["h2", "h3", "h4"]):
        raw = tag.get_text(strip=True)
        country = re.sub(r"\[.*?\]", "", raw).strip()
        if country not in name_map:
            continue
        code = name_map[country]
        if code in teams:
            continue

        table = _next_table(tag)
        if table is None:
            continue

        players = parse_squad_table(table)
        if players:
            teams[code] = players

    return teams


# ── Squad building ────────────────────────────────────────────────────────────
def _is_retired(birth_date):
    if not birth_date:
        return False
    try:
        return int(birth_date[:4]) < RETIRE_BEFORE
    except (ValueError, IndexError):
        return False


def _pad_to_26(players, code, info, seeds):
    """Append procedurally generated players until squad reaches 26."""
    if len(players) >= 26:
        return players[:26]

    rng = stable_rng(code + "_pad")
    lo, hi = pts_to_ovr_range(info["ranking_pts"])
    team_ovr = rng.randint(lo, hi)

    entry = seeds.get(code) or seeds.get("ENG")
    firsts, lasts = entry["first"], entry["last"]

    IDEAL = {"GK": 3, "DF": 8, "MF": 8, "FW": 7}
    pos_counts = defaultdict(int)
    for p in players:
        pos_counts[p.get("position", "MF")] += 1

    used_nums = {p["number"] for p in players}
    nxt = max(used_nums, default=0) + 1

    while len(players) < 26:
        needed = {pos: max(0, IDEAL[pos] - pos_counts[pos]) for pos in IDEAL}
        pos = max(needed, key=needed.get) if any(v > 0 for v in needed.values()) else "MF"

        while nxt in used_nums:
            nxt += 1

        pname = f"{rng.choice(firsts)} {rng.choice(lasts)}"
        age = max(18, min(36, round(rng.gauss(26, 4))))
        yr = 2026 - age
        bd = f"{yr}-{rng.randint(1,12):02d}-{rng.randint(1,28):02d}"
        ovr = max(lo, min(hi + 4, round(rng.gauss(team_ovr, 4))))
        mult = POS_STAT_MULT[pos]
        stats = {"overall": ovr, "potential": ovr + rng.randint(0, 4)}
        for stat in CORE_KEYS:
            stats[stat] = max(20, min(99, round(rng.gauss(ovr * mult[stat], 6))))
        gk_stats = _make_gk_stats(rng, ovr) if pos == "GK" else None

        players.append({
            "id": f"{code.lower()}_{nxt:03d}",
            "name": pname,
            "number": nxt,
            "position": pos,
            "birthDate": bd,
            "club": "",
            "caps": 0,
            "goals": 0,
            "stats": stats,
            "gkStats": gk_stats,
            "skillMoves": 1 if pos == "GK" else rng.choice([1, 2, 2, 3]),
            "weakFoot": rng.choice([2, 2, 3, 3, 4]),
            "preferredFoot": rng.choice(["Right", "Right", "Right", "Left"]),
            "estimated": False,
            "generated": True,
        })
        pos_counts[pos] += 1
        used_nums.add(nxt)
        nxt += 1

    return players


def build_team(code, info, wiki_players, fc26_idx, seeds, source_key, year):
    """
    Build a Layer-2 team dict from Wikipedia squad data + FC26 matching.
    Returns (team_dict, n_matched, n_estimated, n_generated, n_retired).
    """
    nation = info.get("fc26_nation", code)

    # Filter retired players
    active, n_retired = [], 0
    for wp in sorted(wiki_players, key=lambda x: x["number"]):
        if _is_retired(wp.get("birthDate", "")):
            n_retired += 1
        else:
            active.append(wp)

    team = {
        "id": code,
        "name": info["name"],
        "group": None,
        "confederation": info["confederation"],
        "tournaments": get_team_tournaments(code, info["confederation"]),
        "squad_source": source_key,
        "squad_year": year,
        "players": [],
        "generated": False,
    }

    matched_rows = []
    for wp in active:
        row, _method = match_player(wp, fc26_idx, nation)
        is_gk = wp["position"] == "GK"
        pl = {
            "id": f"{code.lower()}_{wp['number']:03d}",
            "name": wp["name"],
            "number": wp["number"],
            "position": wp["position"],
            "birthDate": wp["birthDate"],
            "club": wp.get("club", ""),
            "caps": wp.get("caps", 0),
            "goals": wp.get("goals", 0),
            "stats": None,
            "gkStats": None,
            "skillMoves": 0,
            "weakFoot": 0,
            "preferredFoot": "Right",
            "estimated": False,
        }
        if row is not None:
            pl["stats"], pl["gkStats"] = stats_from_row(row, is_gk)
            if not pl["club"]:
                pl["club"] = row.get("club_name") or ""
            pl["skillMoves"] = to_int(row.get("skill_moves")) or 0
            pl["weakFoot"] = to_int(row.get("weak_foot")) or 0
            pl["preferredFoot"] = row.get("preferred_foot") or "Right"
        team["players"].append(pl)
        matched_rows.append((pl, row))

    # Fill estimated stats for unmatched players
    _estimate_unmatched(matched_rows, lambda p: p["position"] == "GK")

    # Final safety: any player still missing stats gets procedural stats
    rng_fb = stable_rng(code + "_fb")
    lo, hi = pts_to_ovr_range(info["ranking_pts"])
    for pl in team["players"]:
        if pl.get("stats") is None or pl["stats"].get("overall") is None:
            ovr = max(lo, min(hi + 4, round(rng_fb.gauss((lo + hi) / 2, 4))))
            mult = POS_STAT_MULT.get(pl.get("position", "MF"), POS_STAT_MULT["MF"])
            pl["stats"] = {"overall": ovr, "potential": ovr + rng_fb.randint(0, 4)}
            for stat in CORE_KEYS:
                pl["stats"][stat] = max(20, min(99, round(rng_fb.gauss(ovr * mult[stat], 6))))
            if pl.get("position") == "GK" and not pl.get("gkStats"):
                pl["gkStats"] = _make_gk_stats(rng_fb, ovr)
            pl["estimated"] = True
        if pl.get("position") == "GK" and not pl.get("gkStats"):
            ovr = pl["stats"].get("overall", 65)
            pl["gkStats"] = _make_gk_stats(rng_fb, ovr)

    # Pad to exactly 26
    team["players"] = _pad_to_26(team["players"], code, info, seeds)

    n_matched = sum(
        1 for p in team["players"]
        if not p.get("estimated") and not p.get("generated")
    )
    n_estimated = sum(1 for p in team["players"] if p.get("estimated"))
    n_generated = sum(1 for p in team["players"] if p.get("generated"))

    return team, n_matched, n_estimated, n_generated, n_retired


# ── Main ───────────────────────────────────────────────────────────────────────
def main():
    print("Loading FC26 data…")
    _, fc26_idx = load_fc26()
    seeds = load_isim_seeds()

    print("Loading teams_full.json…")
    with open("teams_full.json", encoding="utf-8") as f:
        data = json.load(f)

    # Index by code; preserve original order
    orig_order = [t["id"] for t in data["teams"]]
    teams = {t["id"]: t for t in data["teams"]}

    gen_before = {c for c, t in teams.items() if t.get("generated")}
    wc_codes = {c for c, t in teams.items() if t.get("group")}
    print(f"Generated teams before: {len(gen_before)}")

    upgraded: dict[str, dict] = {}   # code → built team
    report_rows = []

    for source in WIKI_SOURCES:
        print(f"\n── {source['key']} ──")
        try:
            html = fetch_cached_html(source["cache"], source["url"])
        except Exception as e:
            print(f"  WARN: fetch failed – {e}")
            continue

        wiki_squads = parse_wiki_squads(html, source["name_map"])
        print(f"  parsed {len(wiki_squads)} teams from page")

        for code, wiki_players in sorted(wiki_squads.items()):
            if code in wc_codes:
                continue            # WC team already Layer 1
            if code not in gen_before:
                continue            # not generated, skip
            if code in upgraded:
                continue            # already upgraded by earlier source

            info = ALL_FIFA_TEAMS.get(code)
            if not info:
                print(f"  WARN: {code} not in ALL_FIFA_TEAMS")
                continue

            team, n_m, n_e, n_g, n_r = build_team(
                code, info, wiki_players, fc26_idx, seeds,
                source["key"], source["year"]
            )
            upgraded[code] = team
            tag = f"  → {code} ({info['name']}): players={len(wiki_players)}, " \
                  f"FC26={n_m}, est={n_e}, pad={n_g}, retired={n_r}"
            print(tag)
            report_rows.append((source["key"], code, info["name"],
                                 len(wiki_players), n_m, n_e, n_g, n_r))

    # Apply upgrades
    for code, team in upgraded.items():
        teams[code] = team

    # Rebuild list in original order
    all_teams = [teams[c] for c in orig_order]

    with open("teams_full.json", "w", encoding="utf-8") as f:
        json.dump({"teams": all_teams}, f, ensure_ascii=False, indent=2)
    print("\nteams_full.json updated.")

    # ── Summary ───────────────────────────────────────────────────────────────
    gen_after = [c for c in teams if teams[c].get("generated")]
    print(f"\n{'='*60}")
    print(f"Before:  {len(gen_before)} generated teams")
    print(f"Upgraded:{len(upgraded)} teams → Layer 2 (real squads)")
    print(f"After:   {len(gen_after)} generated teams")

    by_conf = defaultdict(list)
    for code in sorted(gen_after):
        by_conf[teams[code].get("confederation", "?")].append(code)
    print("\nStill generated (acceptable minor nations):")
    for conf, codes in sorted(by_conf.items()):
        print(f"  {conf} ({len(codes)}): {codes}")

    # ── Report file ───────────────────────────────────────────────────────────
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    lines = [
        "# Wiki Squads Fetch Report",
        f"Generated: {now}",
        "",
        "## Summary",
        f"| Metric | Value |",
        "|--------|-------|",
        f"| Generated before | {len(gen_before)} |",
        f"| Upgraded to Layer 2 | {len(upgraded)} |",
        f"| Still generated | {len(gen_after)} |",
        "",
        "## Upgraded Teams",
        "| Source | Code | Name | Wiki players | FC26 real | Estimated | Padded | Retired |",
        "|--------|------|------|-------------|-----------|-----------|--------|---------|",
    ]
    for row in report_rows:
        src, code, name, wp, nm, ne, ng, nr = row
        lines.append(f"| {src} | {code} | {name} | {wp} | {nm} | {ne} | {ng} | {nr} |")

    lines += ["", "## Still Generated", "| Conf | Codes |", "|------|-------|"]
    for conf, codes in sorted(by_conf.items()):
        lines.append(f"| {conf} | {', '.join(codes)} |")

    with open("REPORT_WIKI.md", "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    print("\nREPORT_WIKI.md written.")


if __name__ == "__main__":
    main()
