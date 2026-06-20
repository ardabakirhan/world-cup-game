# -*- coding: utf-8 -*-
import sys
if sys.stdout.encoding and sys.stdout.encoding.lower() not in ('utf-8', 'utf8'):
    sys.stdout = open(sys.stdout.fileno(), mode='w', encoding='utf-8', buffering=1)
"""
2026 FIFA World Cup squad + EA FC 26 stats dataset builder.
Expanded to 211 FIFA member associations (3-layer approach):
  Layer 1 - WC 2026 teams (48):  FIFA API + Wikipedia + FC26 matching
  Layer 2 - Tournament teams (~110): FIFA API + FC26 matching (no wiki)
  Layer 3 - No-tournament teams (~50): Procedurally generated stats

Outputs: teams.json, unmatched_players.json
"""
import csv
import hashlib
import json
import os
import random as _random
import re
import sys
import unicodedata
from collections import defaultdict
from datetime import datetime, timedelta

import requests
from bs4 import BeautifulSoup
from rapidfuzz import fuzz

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) DataResearch/1.0"}
ID_COMPETITION, ID_SEASON = "17", "285023"  # FIFA World Cup 2026

CONFED = {
    "AFC": ["JPN", "IRN", "UZB", "JOR", "KOR", "AUS", "QAT", "KSA", "IRQ"],
    "OFC": ["NZL"],
    "CONMEBOL": ["ARG", "BRA", "ECU", "COL", "PAR", "URU"],
    "CAF": ["MAR", "TUN", "EGY", "ALG", "GHA", "CPV", "RSA", "CIV", "SEN", "COD"],
    "UEFA": ["ENG", "FRA", "CRO", "POR", "NOR", "GER", "NED", "BEL", "ESP", "SUI",
             "AUT", "SCO", "BIH", "CZE", "SWE", "TUR"],
    "CONCACAF": ["USA", "CAN", "MEX", "PAN", "CUW", "HAI"],
}
CONFED_BY_CODE = {c: conf for conf, codes in CONFED.items() for c in codes}

WIKI_NAME_TO_CODE = {
    "Czech Republic": "CZE", "Mexico": "MEX", "South Africa": "RSA",
    "South Korea": "KOR", "Bosnia and Herzegovina": "BIH", "Canada": "CAN",
    "Qatar": "QAT", "Switzerland": "SUI", "Brazil": "BRA", "Haiti": "HAI",
    "Morocco": "MAR", "Scotland": "SCO", "Australia": "AUS", "Paraguay": "PAR",
    "Turkey": "TUR", "United States": "USA", "Curaçao": "CUW", "Ecuador": "ECU",
    "Germany": "GER", "Ivory Coast": "CIV", "Japan": "JPN", "Netherlands": "NED",
    "Sweden": "SWE", "Tunisia": "TUN", "Belgium": "BEL", "Egypt": "EGY",
    "Iran": "IRN", "New Zealand": "NZL", "Cape Verde": "CPV",
    "Saudi Arabia": "KSA", "Spain": "ESP", "Uruguay": "URU", "France": "FRA",
    "Iraq": "IRQ", "Norway": "NOR", "Senegal": "SEN", "Algeria": "ALG",
    "Argentina": "ARG", "Austria": "AUT", "Jordan": "JOR", "Colombia": "COL",
    "DR Congo": "COD", "Portugal": "POR", "Uzbekistan": "UZB", "Croatia": "CRO",
    "England": "ENG", "Ghana": "GHA", "Panama": "PAN",
}

TEAM_DISPLAY = {
    "TUR": "Türkiye", "CIV": "Côte d'Ivoire", "CUW": "Curaçao",
    "USA": "United States", "KOR": "Korea Republic", "IRN": "IR Iran",
    "RSA": "South Africa", "KSA": "Saudi Arabia", "COD": "DR Congo",
    "CPV": "Cabo Verde", "BIH": "Bosnia and Herzegovina", "CZE": "Czechia",
}

# team code -> nationality_name used in the FC26 dataset
NATIONALITY = {
    "TUR": "Türkiye", "KOR": "Korea Republic", "IRN": "Iran", "CZE": "Czechia",
    "CIV": "Côte d'Ivoire", "CPV": "Cabo Verde", "COD": "Congo DR",
    "CUW": "Curacao", "RSA": "South Africa", "KSA": "Saudi Arabia",
    "USA": "United States", "BIH": "Bosnia and Herzegovina",
    "NZL": "New Zealand", "MEX": "Mexico", "CAN": "Canada", "QAT": "Qatar",
    "SUI": "Switzerland", "BRA": "Brazil", "HAI": "Haiti", "MAR": "Morocco",
    "SCO": "Scotland", "AUS": "Australia", "PAR": "Paraguay", "ECU": "Ecuador",
    "GER": "Germany", "JPN": "Japan", "NED": "Netherlands", "SWE": "Sweden",
    "TUN": "Tunisia", "BEL": "Belgium", "EGY": "Egypt", "ESP": "Spain",
    "URU": "Uruguay", "FRA": "France", "IRQ": "Iraq", "NOR": "Norway",
    "SEN": "Senegal", "ALG": "Algeria", "ARG": "Argentina", "AUT": "Austria",
    "JOR": "Jordan", "COL": "Colombia", "POR": "Portugal", "UZB": "Uzbekistan",
    "CRO": "Croatia", "ENG": "England", "GHA": "Ghana", "PAN": "Panama",
}


# ── All 211 FIFA member associations ──────────────────────────────────────────
# competition: EXTERNAL_COMP key or None (→ Layer 3 procedural)
# ranking_pts: approximate FIFA ranking points (June 2026)
# fc26_nation: nationality_name as it appears in the FC26 CSV
ALL_FIFA_TEAMS = {
    # ─── UEFA ────────────────────────────────────────────────────────────────
    "ALB": {"name": "Albania",           "confederation": "UEFA", "ranking_pts": 1485, "fc26_nation": "Albania",            "competition": "EURO2024"},
    "AND": {"name": "Andorra",           "confederation": "UEFA", "ranking_pts":  388, "fc26_nation": "Andorra",            "competition": None},
    "ARM": {"name": "Armenia",           "confederation": "UEFA", "ranking_pts": 1210, "fc26_nation": "Armenia",            "competition": None},
    "AUT": {"name": "Austria",           "confederation": "UEFA", "ranking_pts": 1540, "fc26_nation": "Austria",            "competition": "WC2026"},
    "AZE": {"name": "Azerbaijan",        "confederation": "UEFA", "ranking_pts": 1010, "fc26_nation": "Azerbaijan",         "competition": None},
    "BEL": {"name": "Belgium",           "confederation": "UEFA", "ranking_pts": 1700, "fc26_nation": "Belgium",            "competition": "WC2026"},
    "BIH": {"name": "Bosnia & Herz.",    "confederation": "UEFA", "ranking_pts": 1260, "fc26_nation": "Bosnia Herzegovina", "competition": "WC2026"},
    "BLR": {"name": "Belarus",           "confederation": "UEFA", "ranking_pts":  950, "fc26_nation": "Belarus",            "competition": None},
    "BUL": {"name": "Bulgaria",          "confederation": "UEFA", "ranking_pts": 1000, "fc26_nation": "Bulgaria",           "competition": None},
    "CRO": {"name": "Croatia",           "confederation": "UEFA", "ranking_pts": 1660, "fc26_nation": "Croatia",            "competition": "WC2026"},
    "CYP": {"name": "Cyprus",            "confederation": "UEFA", "ranking_pts":  990, "fc26_nation": "Cyprus",             "competition": None},
    "CZE": {"name": "Czechia",           "confederation": "UEFA", "ranking_pts": 1490, "fc26_nation": "Czechia",            "competition": "WC2026"},
    "DEN": {"name": "Denmark",           "confederation": "UEFA", "ranking_pts": 1610, "fc26_nation": "Denmark",            "competition": "EURO2024"},
    "ENG": {"name": "England",           "confederation": "UEFA", "ranking_pts": 1800, "fc26_nation": "England",            "competition": "WC2026"},
    "EST": {"name": "Estonia",           "confederation": "UEFA", "ranking_pts":  940, "fc26_nation": "Estonia",            "competition": None},
    "FRO": {"name": "Faroe Islands",     "confederation": "UEFA", "ranking_pts":  870, "fc26_nation": "Faroe Islands",      "competition": None},
    "FIN": {"name": "Finland",           "confederation": "UEFA", "ranking_pts": 1250, "fc26_nation": "Finland",            "competition": None},
    "FRA": {"name": "France",            "confederation": "UEFA", "ranking_pts": 1850, "fc26_nation": "France",             "competition": "WC2026"},
    "GEO": {"name": "Georgia",           "confederation": "UEFA", "ranking_pts": 1255, "fc26_nation": "Georgia",            "competition": "EURO2024"},
    "GER": {"name": "Germany",           "confederation": "UEFA", "ranking_pts": 1750, "fc26_nation": "Germany",            "competition": "WC2026"},
    "GIB": {"name": "Gibraltar",         "confederation": "UEFA", "ranking_pts":  460, "fc26_nation": "Gibraltar",          "competition": None},
    "GRE": {"name": "Greece",            "confederation": "UEFA", "ranking_pts": 1330, "fc26_nation": "Greece",             "competition": None},
    "HUN": {"name": "Hungary",           "confederation": "UEFA", "ranking_pts": 1440, "fc26_nation": "Hungary",            "competition": "EURO2024"},
    "ISL": {"name": "Iceland",           "confederation": "UEFA", "ranking_pts": 1280, "fc26_nation": "Iceland",            "competition": None},
    "IRL": {"name": "Republic of Ireland","confederation": "UEFA","ranking_pts": 1310, "fc26_nation": "Republic of Ireland","competition": None},
    "ISR": {"name": "Israel",            "confederation": "UEFA", "ranking_pts": 1180, "fc26_nation": "Israel",             "competition": "EURO2024"},
    "ITA": {"name": "Italy",             "confederation": "UEFA", "ranking_pts": 1640, "fc26_nation": "Italy",              "competition": "EURO2024"},
    "KAZ": {"name": "Kazakhstan",        "confederation": "UEFA", "ranking_pts":  890, "fc26_nation": "Kazakhstan",         "competition": None},
    "KOS": {"name": "Kosovo",            "confederation": "UEFA", "ranking_pts": 1170, "fc26_nation": "Kosovo",             "competition": None},
    "LVA": {"name": "Latvia",            "confederation": "UEFA", "ranking_pts":  920, "fc26_nation": "Latvia",             "competition": None},
    "LIE": {"name": "Liechtenstein",     "confederation": "UEFA", "ranking_pts":  430, "fc26_nation": "Liechtenstein",      "competition": None},
    "LTU": {"name": "Lithuania",         "confederation": "UEFA", "ranking_pts":  900, "fc26_nation": "Lithuania",          "competition": None},
    "LUX": {"name": "Luxembourg",        "confederation": "UEFA", "ranking_pts": 1020, "fc26_nation": "Luxembourg",         "competition": None},
    "MLT": {"name": "Malta",             "confederation": "UEFA", "ranking_pts":  860, "fc26_nation": "Malta",              "competition": None},
    "MDA": {"name": "Moldova",           "confederation": "UEFA", "ranking_pts":  960, "fc26_nation": "Moldova",            "competition": None},
    "MNE": {"name": "Montenegro",        "confederation": "UEFA", "ranking_pts": 1190, "fc26_nation": "Montenegro",         "competition": None},
    "MKD": {"name": "North Macedonia",   "confederation": "UEFA", "ranking_pts": 1240, "fc26_nation": "North Macedonia",    "competition": None},
    "NED": {"name": "Netherlands",       "confederation": "UEFA", "ranking_pts": 1740, "fc26_nation": "Netherlands",        "competition": "WC2026"},
    "NIR": {"name": "Northern Ireland",  "confederation": "UEFA", "ranking_pts": 1150, "fc26_nation": "Northern Ireland",   "competition": None},
    "NOR": {"name": "Norway",            "confederation": "UEFA", "ranking_pts": 1500, "fc26_nation": "Norway",             "competition": "WC2026"},
    "POL": {"name": "Poland",            "confederation": "UEFA", "ranking_pts": 1480, "fc26_nation": "Poland",             "competition": "EURO2024"},
    "POR": {"name": "Portugal",          "confederation": "UEFA", "ranking_pts": 1720, "fc26_nation": "Portugal",           "competition": "WC2026"},
    "ROU": {"name": "Romania",           "confederation": "UEFA", "ranking_pts": 1350, "fc26_nation": "Romania",            "competition": "EURO2024"},
    "RUS": {"name": "Russia",            "confederation": "UEFA", "ranking_pts":  800, "fc26_nation": "Russia",             "competition": None},
    "SMR": {"name": "San Marino",        "confederation": "UEFA", "ranking_pts":  265, "fc26_nation": "San Marino",         "competition": None},
    "SCO": {"name": "Scotland",          "confederation": "UEFA", "ranking_pts": 1430, "fc26_nation": "Scotland",           "competition": "WC2026"},
    "SRB": {"name": "Serbia",            "confederation": "UEFA", "ranking_pts": 1510, "fc26_nation": "Serbia",             "competition": "EURO2024"},
    "SVK": {"name": "Slovakia",          "confederation": "UEFA", "ranking_pts": 1360, "fc26_nation": "Slovakia",           "competition": "EURO2024"},
    "SVN": {"name": "Slovenia",          "confederation": "UEFA", "ranking_pts": 1290, "fc26_nation": "Slovenia",           "competition": "EURO2024"},
    "ESP": {"name": "Spain",             "confederation": "UEFA", "ranking_pts": 1840, "fc26_nation": "Spain",              "competition": "WC2026"},
    "SWE": {"name": "Sweden",            "confederation": "UEFA", "ranking_pts": 1520, "fc26_nation": "Sweden",             "competition": "WC2026"},
    "SUI": {"name": "Switzerland",       "confederation": "UEFA", "ranking_pts": 1560, "fc26_nation": "Switzerland",        "competition": "WC2026"},
    "TUR": {"name": "Türkiye",           "confederation": "UEFA", "ranking_pts": 1470, "fc26_nation": "Türkiye",            "competition": "WC2026"},
    "UKR": {"name": "Ukraine",           "confederation": "UEFA", "ranking_pts": 1475, "fc26_nation": "Ukraine",            "competition": "EURO2024"},
    "WAL": {"name": "Wales",             "confederation": "UEFA", "ranking_pts": 1310, "fc26_nation": "Wales",              "competition": None},
    # ─── AFC ─────────────────────────────────────────────────────────────────
    "AFG": {"name": "Afghanistan",       "confederation": "AFC",  "ranking_pts":  290, "fc26_nation": "Afghanistan",        "competition": None},
    "AUS": {"name": "Australia",         "confederation": "AFC",  "ranking_pts": 1430, "fc26_nation": "Australia",          "competition": "WC2026"},
    "BHR": {"name": "Bahrain",           "confederation": "AFC",  "ranking_pts":  940, "fc26_nation": "Bahrain",            "competition": "ASIANCUP2023"},
    "BAN": {"name": "Bangladesh",        "confederation": "AFC",  "ranking_pts":  490, "fc26_nation": "Bangladesh",         "competition": None},
    "BHU": {"name": "Bhutan",            "confederation": "AFC",  "ranking_pts":  260, "fc26_nation": "Bhutan",             "competition": None},
    "BRU": {"name": "Brunei",            "confederation": "AFC",  "ranking_pts":  310, "fc26_nation": "Brunei",             "competition": None},
    "CAM": {"name": "Cambodia",          "confederation": "AFC",  "ranking_pts":  540, "fc26_nation": "Cambodia",           "competition": None},
    "CHN": {"name": "China PR",          "confederation": "AFC",  "ranking_pts": 1170, "fc26_nation": "China PR",           "competition": "ASIANCUP2023"},
    "TPE": {"name": "Chinese Taipei",    "confederation": "AFC",  "ranking_pts":  480, "fc26_nation": "Chinese Taipei",     "competition": None},
    "GUM": {"name": "Guam",              "confederation": "AFC",  "ranking_pts":  380, "fc26_nation": "Guam",               "competition": None},
    "HKG": {"name": "Hong Kong",         "confederation": "AFC",  "ranking_pts":  530, "fc26_nation": "Hong Kong",          "competition": None},
    "IND": {"name": "India",             "confederation": "AFC",  "ranking_pts":  620, "fc26_nation": "India",              "competition": "ASIANCUP2023"},
    "IDN": {"name": "Indonesia",         "confederation": "AFC",  "ranking_pts":  600, "fc26_nation": "Indonesia",          "competition": "ASIANCUP2023"},
    "IRN": {"name": "IR Iran",           "confederation": "AFC",  "ranking_pts": 1650, "fc26_nation": "Iran",               "competition": "WC2026"},
    "IRQ": {"name": "Iraq",              "confederation": "AFC",  "ranking_pts": 1310, "fc26_nation": "Iraq",               "competition": "WC2026"},
    "JPN": {"name": "Japan",             "confederation": "AFC",  "ranking_pts": 1750, "fc26_nation": "Japan",              "competition": "WC2026"},
    "JOR": {"name": "Jordan",            "confederation": "AFC",  "ranking_pts": 1430, "fc26_nation": "Jordan",             "competition": "WC2026"},
    "KGZ": {"name": "Kyrgyz Republic",   "confederation": "AFC",  "ranking_pts":  840, "fc26_nation": "Kyrgyz Republic",   "competition": "ASIANCUP2023"},
    "PRK": {"name": "Korea DPR",         "confederation": "AFC",  "ranking_pts":  610, "fc26_nation": "Korea DPR",          "competition": None},
    "KOR": {"name": "Korea Republic",    "confederation": "AFC",  "ranking_pts": 1700, "fc26_nation": "Korea Republic",     "competition": "WC2026"},
    "KUW": {"name": "Kuwait",            "confederation": "AFC",  "ranking_pts":  800, "fc26_nation": "Kuwait",             "competition": None},
    "LAO": {"name": "Laos",              "confederation": "AFC",  "ranking_pts":  400, "fc26_nation": "Laos",               "competition": None},
    "LIB": {"name": "Lebanon",           "confederation": "AFC",  "ranking_pts":  630, "fc26_nation": "Lebanon",            "competition": "ASIANCUP2023"},
    "MAC": {"name": "Macau",             "confederation": "AFC",  "ranking_pts":  360, "fc26_nation": "Macau",              "competition": None},
    "MAS": {"name": "Malaysia",          "confederation": "AFC",  "ranking_pts":  690, "fc26_nation": "Malaysia",           "competition": "ASIANCUP2023"},
    "MDV": {"name": "Maldives",          "confederation": "AFC",  "ranking_pts":  480, "fc26_nation": "Maldives",           "competition": None},
    "MNG": {"name": "Mongolia",          "confederation": "AFC",  "ranking_pts":  450, "fc26_nation": "Mongolia",           "competition": None},
    "MYA": {"name": "Myanmar",           "confederation": "AFC",  "ranking_pts":  560, "fc26_nation": "Myanmar",            "competition": None},
    "NEP": {"name": "Nepal",             "confederation": "AFC",  "ranking_pts":  400, "fc26_nation": "Nepal",              "competition": None},
    "OMA": {"name": "Oman",              "confederation": "AFC",  "ranking_pts":  760, "fc26_nation": "Oman",               "competition": "ASIANCUP2023"},
    "PAK": {"name": "Pakistan",          "confederation": "AFC",  "ranking_pts":  430, "fc26_nation": "Pakistan",           "competition": None},
    "PLE": {"name": "Palestine",         "confederation": "AFC",  "ranking_pts":  590, "fc26_nation": "Palestine",          "competition": "ASIANCUP2023"},
    "PHI": {"name": "Philippines",       "confederation": "AFC",  "ranking_pts":  600, "fc26_nation": "Philippines",        "competition": "ASIANCUP2023"},
    "QAT": {"name": "Qatar",             "confederation": "AFC",  "ranking_pts": 1300, "fc26_nation": "Qatar",              "competition": "WC2026"},
    "KSA": {"name": "Saudi Arabia",      "confederation": "AFC",  "ranking_pts": 1550, "fc26_nation": "Saudi Arabia",       "competition": "WC2026"},
    "SGP": {"name": "Singapore",         "confederation": "AFC",  "ranking_pts":  620, "fc26_nation": "Singapore",          "competition": "ASIANCUP2023"},
    "SRI": {"name": "Sri Lanka",         "confederation": "AFC",  "ranking_pts":  340, "fc26_nation": "Sri Lanka",          "competition": None},
    "SYR": {"name": "Syria",             "confederation": "AFC",  "ranking_pts":  640, "fc26_nation": "Syria",              "competition": "ASIANCUP2023"},
    "TJK": {"name": "Tajikistan",        "confederation": "AFC",  "ranking_pts":  860, "fc26_nation": "Tajikistan",         "competition": "ASIANCUP2023"},
    "THA": {"name": "Thailand",          "confederation": "AFC",  "ranking_pts":  710, "fc26_nation": "Thailand",           "competition": "ASIANCUP2023"},
    "TLS": {"name": "Timor-Leste",       "confederation": "AFC",  "ranking_pts":  360, "fc26_nation": "Timor-Leste",        "competition": None},
    "TKM": {"name": "Turkmenistan",      "confederation": "AFC",  "ranking_pts":  550, "fc26_nation": "Turkmenistan",       "competition": None},
    "UAE": {"name": "UAE",               "confederation": "AFC",  "ranking_pts": 1060, "fc26_nation": "United Arab Emirates","competition": "ASIANCUP2023"},
    "UZB": {"name": "Uzbekistan",        "confederation": "AFC",  "ranking_pts": 1510, "fc26_nation": "Uzbekistan",         "competition": "WC2026"},
    "VIE": {"name": "Vietnam",           "confederation": "AFC",  "ranking_pts":  590, "fc26_nation": "Vietnam",            "competition": "ASIANCUP2023"},
    "YEM": {"name": "Yemen",             "confederation": "AFC",  "ranking_pts":  350, "fc26_nation": "Yemen",              "competition": None},
    # ─── CAF ─────────────────────────────────────────────────────────────────
    "ALG": {"name": "Algeria",           "confederation": "CAF",  "ranking_pts": 1545, "fc26_nation": "Algeria",            "competition": "WC2026"},
    "ANG": {"name": "Angola",            "confederation": "CAF",  "ranking_pts": 1090, "fc26_nation": "Angola",             "competition": "AFCON2025"},
    "BEN": {"name": "Benin",             "confederation": "CAF",  "ranking_pts":  960, "fc26_nation": "Benin",              "competition": "AFCON2025"},
    "BOT": {"name": "Botswana",          "confederation": "CAF",  "ranking_pts":  810, "fc26_nation": "Botswana",           "competition": "AFCON2025"},
    "BFA": {"name": "Burkina Faso",      "confederation": "CAF",  "ranking_pts": 1100, "fc26_nation": "Burkina Faso",       "competition": "AFCON2025"},
    "BDI": {"name": "Burundi",           "confederation": "CAF",  "ranking_pts":  710, "fc26_nation": "Burundi",            "competition": "AFCON2025"},
    "CMR": {"name": "Cameroon",          "confederation": "CAF",  "ranking_pts": 1250, "fc26_nation": "Cameroon",           "competition": "AFCON2025"},
    "CPV": {"name": "Cabo Verde",        "confederation": "CAF",  "ranking_pts": 1240, "fc26_nation": "Cape Verde",         "competition": "WC2026"},
    "CTA": {"name": "Central African Rep.","confederation":"CAF", "ranking_pts":  500, "fc26_nation": "Central African Rep.","competition": None},
    "CHA": {"name": "Chad",              "confederation": "CAF",  "ranking_pts":  440, "fc26_nation": "Chad",               "competition": None},
    "COM": {"name": "Comoros",           "confederation": "CAF",  "ranking_pts":  730, "fc26_nation": "Comoros",            "competition": "AFCON2025"},
    "CGO": {"name": "Congo",             "confederation": "CAF",  "ranking_pts":  840, "fc26_nation": "Congo",              "competition": "AFCON2025"},
    "COD": {"name": "DR Congo",          "confederation": "CAF",  "ranking_pts": 1360, "fc26_nation": "Congo DR",           "competition": "WC2026"},
    "CIV": {"name": "Côte d'Ivoire",      "confederation": "CAF",  "ranking_pts": 1390, "fc26_nation": "Côte d'Ivoire",      "competition": "WC2026"},
    "DJI": {"name": "Djibouti",          "confederation": "CAF",  "ranking_pts":  330, "fc26_nation": "Djibouti",           "competition": None},
    "EGY": {"name": "Egypt",             "confederation": "CAF",  "ranking_pts": 1440, "fc26_nation": "Egypt",              "competition": "WC2026"},
    "EQG": {"name": "Equatorial Guinea", "confederation": "CAF",  "ranking_pts":  780, "fc26_nation": "Equatorial Guinea",  "competition": "AFCON2025"},
    "ERI": {"name": "Eritrea",           "confederation": "CAF",  "ranking_pts":  350, "fc26_nation": "Eritrea",            "competition": None},
    "ETH": {"name": "Ethiopia",          "confederation": "CAF",  "ranking_pts":  790, "fc26_nation": "Ethiopia",           "competition": "AFCON2025"},
    "SWZ": {"name": "Eswatini",          "confederation": "CAF",  "ranking_pts":  600, "fc26_nation": "Eswatini",           "competition": None},
    "GAB": {"name": "Gabon",             "confederation": "CAF",  "ranking_pts":  870, "fc26_nation": "Gabon",              "competition": "AFCON2025"},
    "GAM": {"name": "Gambia",            "confederation": "CAF",  "ranking_pts":  990, "fc26_nation": "Gambia",             "competition": "AFCON2025"},
    "GHA": {"name": "Ghana",             "confederation": "CAF",  "ranking_pts": 1350, "fc26_nation": "Ghana",              "competition": "WC2026"},
    "GUI": {"name": "Guinea",            "confederation": "CAF",  "ranking_pts": 1030, "fc26_nation": "Guinea",             "competition": "AFCON2025"},
    "GNB": {"name": "Guinea-Bissau",     "confederation": "CAF",  "ranking_pts":  870, "fc26_nation": "Guinea-Bissau",      "competition": "AFCON2025"},
    "KEN": {"name": "Kenya",             "confederation": "CAF",  "ranking_pts":  960, "fc26_nation": "Kenya",              "competition": "AFCON2025"},
    "LES": {"name": "Lesotho",           "confederation": "CAF",  "ranking_pts":  570, "fc26_nation": "Lesotho",            "competition": None},
    "LBR": {"name": "Liberia",           "confederation": "CAF",  "ranking_pts":  740, "fc26_nation": "Liberia",            "competition": "AFCON2025"},
    "LBA": {"name": "Libya",             "confederation": "CAF",  "ranking_pts":  740, "fc26_nation": "Libya",              "competition": "AFCON2025"},
    "MAD": {"name": "Madagascar",        "confederation": "CAF",  "ranking_pts":  620, "fc26_nation": "Madagascar",         "competition": "AFCON2025"},
    "MAW": {"name": "Malawi",            "confederation": "CAF",  "ranking_pts":  820, "fc26_nation": "Malawi",             "competition": "AFCON2025"},
    "MLI": {"name": "Mali",              "confederation": "CAF",  "ranking_pts": 1200, "fc26_nation": "Mali",               "competition": "AFCON2025"},
    "MTN": {"name": "Mauritania",        "confederation": "CAF",  "ranking_pts":  890, "fc26_nation": "Mauritania",         "competition": "AFCON2025"},
    "MRI": {"name": "Mauritius",         "confederation": "CAF",  "ranking_pts":  540, "fc26_nation": "Mauritius",          "competition": None},
    "MAR": {"name": "Morocco",           "confederation": "CAF",  "ranking_pts": 1700, "fc26_nation": "Morocco",            "competition": "WC2026"},
    "MOZ": {"name": "Mozambique",        "confederation": "CAF",  "ranking_pts":  730, "fc26_nation": "Mozambique",         "competition": "AFCON2025"},
    "NAM": {"name": "Namibia",           "confederation": "CAF",  "ranking_pts":  760, "fc26_nation": "Namibia",            "competition": "AFCON2025"},
    "NIG": {"name": "Niger",             "confederation": "CAF",  "ranking_pts":  600, "fc26_nation": "Niger",              "competition": None},
    "NGA": {"name": "Nigeria",           "confederation": "CAF",  "ranking_pts": 1390, "fc26_nation": "Nigeria",            "competition": "AFCON2025"},
    "RWA": {"name": "Rwanda",            "confederation": "CAF",  "ranking_pts":  850, "fc26_nation": "Rwanda",             "competition": "AFCON2025"},
    "STP": {"name": "São Tomé e Príncipe","confederation": "CAF", "ranking_pts":  380, "fc26_nation": "São Tomé e Príncipe","competition": None},
    "SEN": {"name": "Senegal",           "confederation": "CAF",  "ranking_pts": 1610, "fc26_nation": "Senegal",            "competition": "WC2026"},
    "SEY": {"name": "Seychelles",        "confederation": "CAF",  "ranking_pts":  360, "fc26_nation": "Seychelles",         "competition": None},
    "SLE": {"name": "Sierra Leone",      "confederation": "CAF",  "ranking_pts":  700, "fc26_nation": "Sierra Leone",       "competition": "AFCON2025"},
    "SOM": {"name": "Somalia",           "confederation": "CAF",  "ranking_pts":  330, "fc26_nation": "Somalia",            "competition": None},
    "RSA": {"name": "South Africa",      "confederation": "CAF",  "ranking_pts": 1370, "fc26_nation": "South Africa",       "competition": "WC2026"},
    "SSD": {"name": "South Sudan",       "confederation": "CAF",  "ranking_pts":  450, "fc26_nation": "South Sudan",        "competition": None},
    "SDN": {"name": "Sudan",             "confederation": "CAF",  "ranking_pts":  560, "fc26_nation": "Sudan",              "competition": None},
    "TAN": {"name": "Tanzania",          "confederation": "CAF",  "ranking_pts":  870, "fc26_nation": "Tanzania",           "competition": "AFCON2025"},
    "TOG": {"name": "Togo",              "confederation": "CAF",  "ranking_pts":  800, "fc26_nation": "Togo",               "competition": "AFCON2025"},
    "TUN": {"name": "Tunisia",           "confederation": "CAF",  "ranking_pts": 1420, "fc26_nation": "Tunisia",            "competition": "WC2026"},
    "UGA": {"name": "Uganda",            "confederation": "CAF",  "ranking_pts":  890, "fc26_nation": "Uganda",             "competition": "AFCON2025"},
    "ZAM": {"name": "Zambia",            "confederation": "CAF",  "ranking_pts":  920, "fc26_nation": "Zambia",             "competition": "AFCON2025"},
    "ZIM": {"name": "Zimbabwe",          "confederation": "CAF",  "ranking_pts":  850, "fc26_nation": "Zimbabwe",           "competition": "AFCON2025"},
    # ─── CONCACAF ────────────────────────────────────────────────────────────
    "AIA": {"name": "Anguilla",          "confederation": "CONCACAF", "ranking_pts": 250, "fc26_nation": "Anguilla",        "competition": None},
    "ATG": {"name": "Antigua & Barbuda", "confederation": "CONCACAF", "ranking_pts": 590, "fc26_nation": "Antigua & Barbuda","competition": "GOLDCUP2025"},
    "ARU": {"name": "Aruba",             "confederation": "CONCACAF", "ranking_pts": 500, "fc26_nation": "Aruba",           "competition": None},
    "BAH": {"name": "Bahamas",           "confederation": "CONCACAF", "ranking_pts": 400, "fc26_nation": "Bahamas",         "competition": None},
    "BRB": {"name": "Barbados",          "confederation": "CONCACAF", "ranking_pts": 570, "fc26_nation": "Barbados",        "competition": "GOLDCUP2025"},
    "BLZ": {"name": "Belize",            "confederation": "CONCACAF", "ranking_pts": 490, "fc26_nation": "Belize",          "competition": "GOLDCUP2025"},
    "BER": {"name": "Bermuda",           "confederation": "CONCACAF", "ranking_pts": 540, "fc26_nation": "Bermuda",         "competition": None},
    "VGB": {"name": "British Virgin Islands","confederation":"CONCACAF","ranking_pts": 280,"fc26_nation": "British Virgin Islands","competition": None},
    "CAN": {"name": "Canada",            "confederation": "CONCACAF", "ranking_pts": 1620,"fc26_nation": "Canada",          "competition": "WC2026"},
    "CAY": {"name": "Cayman Islands",    "confederation": "CONCACAF", "ranking_pts": 300, "fc26_nation": "Cayman Islands",  "competition": None},
    "CRC": {"name": "Costa Rica",        "confederation": "CONCACAF", "ranking_pts": 1340,"fc26_nation": "Costa Rica",      "competition": "GOLDCUP2025"},
    "CUB": {"name": "Cuba",              "confederation": "CONCACAF", "ranking_pts": 580, "fc26_nation": "Cuba",            "competition": "GOLDCUP2025"},
    "CUW": {"name": "Curaçao",           "confederation": "CONCACAF", "ranking_pts": 1100,"fc26_nation": "Curacao",         "competition": "WC2026"},
    "DMA": {"name": "Dominica",          "confederation": "CONCACAF", "ranking_pts": 390, "fc26_nation": "Dominica",        "competition": None},
    "DOM": {"name": "Dominican Republic","confederation": "CONCACAF", "ranking_pts": 480, "fc26_nation": "Dominican Republic","competition": "GOLDCUP2025"},
    "SLV": {"name": "El Salvador",       "confederation": "CONCACAF", "ranking_pts": 870, "fc26_nation": "El Salvador",     "competition": "GOLDCUP2025"},
    "GRN": {"name": "Grenada",           "confederation": "CONCACAF", "ranking_pts": 530, "fc26_nation": "Grenada",         "competition": "GOLDCUP2025"},
    "GUA": {"name": "Guatemala",         "confederation": "CONCACAF", "ranking_pts": 960, "fc26_nation": "Guatemala",       "competition": "GOLDCUP2025"},
    "GUY": {"name": "Guyana",            "confederation": "CONCACAF", "ranking_pts": 560, "fc26_nation": "Guyana",          "competition": None},
    "HAI": {"name": "Haiti",             "confederation": "CONCACAF", "ranking_pts": 800, "fc26_nation": "Haiti",           "competition": "WC2026"},
    "HON": {"name": "Honduras",          "confederation": "CONCACAF", "ranking_pts": 980, "fc26_nation": "Honduras",        "competition": "GOLDCUP2025"},
    "JAM": {"name": "Jamaica",           "confederation": "CONCACAF", "ranking_pts": 1140,"fc26_nation": "Jamaica",         "competition": "GOLDCUP2025"},
    "MEX": {"name": "Mexico",            "confederation": "CONCACAF", "ranking_pts": 1540,"fc26_nation": "Mexico",          "competition": "WC2026"},
    "MSR": {"name": "Montserrat",        "confederation": "CONCACAF", "ranking_pts": 290, "fc26_nation": "Montserrat",      "competition": None},
    "NCA": {"name": "Nicaragua",         "confederation": "CONCACAF", "ranking_pts": 430, "fc26_nation": "Nicaragua",       "competition": None},
    "PAN": {"name": "Panama",            "confederation": "CONCACAF", "ranking_pts": 1200,"fc26_nation": "Panama",          "competition": "WC2026"},
    "PUR": {"name": "Puerto Rico",       "confederation": "CONCACAF", "ranking_pts": 500, "fc26_nation": "Puerto Rico",     "competition": None},
    "SKN": {"name": "St. Kitts & Nevis", "confederation": "CONCACAF", "ranking_pts": 470, "fc26_nation": "Saint Kitts And Nevis","competition": "GOLDCUP2025"},
    "LCA": {"name": "St. Lucia",         "confederation": "CONCACAF", "ranking_pts": 420, "fc26_nation": "Saint Lucia",     "competition": None},
    "VIN": {"name": "St. Vincent & Gren.","confederation":"CONCACAF", "ranking_pts": 490, "fc26_nation": "Saint Vincent",   "competition": "GOLDCUP2025"},
    "SUR": {"name": "Suriname",          "confederation": "CONCACAF", "ranking_pts": 770, "fc26_nation": "Suriname",        "competition": "GOLDCUP2025"},
    "TRI": {"name": "Trinidad & Tobago", "confederation": "CONCACAF", "ranking_pts": 1070,"fc26_nation": "Trinidad & Tobago","competition": "GOLDCUP2025"},
    "TCA": {"name": "Turks & Caicos",    "confederation": "CONCACAF", "ranking_pts": 270, "fc26_nation": "Turks And Caicos Islands","competition": None},
    "USA": {"name": "United States",     "confederation": "CONCACAF", "ranking_pts": 1680,"fc26_nation": "United States",   "competition": "WC2026"},
    "VIR": {"name": "US Virgin Islands", "confederation": "CONCACAF", "ranking_pts": 265, "fc26_nation": "US Virgin Islands","competition": None},
    # ─── CONMEBOL ────────────────────────────────────────────────────────────
    "ARG": {"name": "Argentina",         "confederation": "CONMEBOL","ranking_pts": 1900,"fc26_nation": "Argentina",        "competition": "WC2026"},
    "BOL": {"name": "Bolivia",           "confederation": "CONMEBOL","ranking_pts": 1050,"fc26_nation": "Bolivia",          "competition": "COPA2024"},
    "BRA": {"name": "Brazil",            "confederation": "CONMEBOL","ranking_pts": 1760,"fc26_nation": "Brazil",           "competition": "WC2026"},
    "CHI": {"name": "Chile",             "confederation": "CONMEBOL","ranking_pts": 1400,"fc26_nation": "Chile",            "competition": "COPA2024"},
    "COL": {"name": "Colombia",          "confederation": "CONMEBOL","ranking_pts": 1605,"fc26_nation": "Colombia",         "competition": "WC2026"},
    "ECU": {"name": "Ecuador",           "confederation": "CONMEBOL","ranking_pts": 1430,"fc26_nation": "Ecuador",          "competition": "WC2026"},
    "PAR": {"name": "Paraguay",          "confederation": "CONMEBOL","ranking_pts": 1310,"fc26_nation": "Paraguay",         "competition": "WC2026"},
    "PER": {"name": "Peru",              "confederation": "CONMEBOL","ranking_pts": 1330,"fc26_nation": "Peru",             "competition": "COPA2024"},
    "URU": {"name": "Uruguay",           "confederation": "CONMEBOL","ranking_pts": 1630,"fc26_nation": "Uruguay",          "competition": "WC2026"},
    "VEN": {"name": "Venezuela",         "confederation": "CONMEBOL","ranking_pts": 1260,"fc26_nation": "Venezuela",        "competition": "COPA2024"},
    # ─── OFC ─────────────────────────────────────────────────────────────────
    "ASA": {"name": "American Samoa",    "confederation": "OFC",  "ranking_pts":  260, "fc26_nation": "American Samoa",    "competition": "OFCNC2024"},
    "COK": {"name": "Cook Islands",      "confederation": "OFC",  "ranking_pts":  350, "fc26_nation": "Cook Islands",      "competition": "OFCNC2024"},
    "FIJ": {"name": "Fiji",              "confederation": "OFC",  "ranking_pts":  690, "fc26_nation": "Fiji",              "competition": "OFCNC2024"},
    "NCL": {"name": "New Caledonia",     "confederation": "OFC",  "ranking_pts":  520, "fc26_nation": "New Caledonia",     "competition": "OFCNC2024"},
    "NZL": {"name": "New Zealand",       "confederation": "OFC",  "ranking_pts": 1260, "fc26_nation": "New Zealand",       "competition": "WC2026"},
    "PNG": {"name": "Papua New Guinea",  "confederation": "OFC",  "ranking_pts":  610, "fc26_nation": "Papua New Guinea",  "competition": "OFCNC2024"},
    "SAM": {"name": "Samoa",             "confederation": "OFC",  "ranking_pts":  430, "fc26_nation": "Samoa",             "competition": "OFCNC2024"},
    "SOL": {"name": "Solomon Islands",   "confederation": "OFC",  "ranking_pts":  660, "fc26_nation": "Solomon Islands",   "competition": "OFCNC2024"},
    "TAH": {"name": "Tahiti",            "confederation": "OFC",  "ranking_pts":  440, "fc26_nation": "Tahiti",            "competition": "OFCNC2024"},
    "TGA": {"name": "Tonga",             "confederation": "OFC",  "ranking_pts":  380, "fc26_nation": "Tonga",             "competition": "OFCNC2024"},
    "VAN": {"name": "Vanuatu",           "confederation": "OFC",  "ranking_pts":  490, "fc26_nation": "Vanuatu",           "competition": "OFCNC2024"},
}

# External tournament competition / season IDs (approximate — graceful 404 fallback)
EXTERNAL_COMP = {
    "EURO2024":     ("3",   "284153"),
    "COPA2024":     ("104", "283800"),
    "AFCON2025":    ("34",  "285100"),
    "ASIANCUP2023": ("1",   "278452"),
    "GOLDCUP2025":  ("30",  "285200"),
    "OFCNC2024":    ("45",  "283000"),
    "WC2022":       ("17",  "255711"),
}

# Position distribution for 26-man squad (Layer 3)
SQUAD_POSITIONS = [("GK", 3), ("DF", 8), ("MF", 8), ("FW", 7)]

# Stat multipliers per position for procedural generation
POS_STAT_MULT = {
    "GK": {"pace": 0.55, "shooting": 0.35, "passing": 0.60, "dribbling": 0.50, "defending": 0.55, "physical": 0.80},
    "DF": {"pace": 0.80, "shooting": 0.50, "passing": 0.72, "dribbling": 0.65, "defending": 1.30, "physical": 1.10},
    "MF": {"pace": 0.90, "shooting": 0.82, "passing": 1.20, "dribbling": 1.10, "defending": 0.88, "physical": 0.90},
    "FW": {"pace": 1.20, "shooting": 1.30, "passing": 0.78, "dribbling": 1.20, "defending": 0.48, "physical": 0.80},
}

# CONCACAF teams eligible as Copa América 2027 invited guests (top 6 by ranking)
COPA_INVITEES = {"USA", "CAN", "MEX", "CRC", "JAM", "TRI"}

# Tournament slot sizes (for the report)
TOURNAMENT_SLOTS = {
    "WC_2026":        48,
    "EURO_2028":      24,
    "COPA_2027":      16,
    "AFCON_2027":     24,
    "ASIAN_CUP_2027": 24,
    "GOLD_CUP_2027":  16,
    "OFC_2027":        8,
}


def get_team_tournaments(code, confederation, wc_group=None):
    """Return list of tournament membership dicts for this team."""
    result = []

    # ── WC 2026 ───────────────────────────────────────────────────────────────
    if wc_group is not None:
        result.append({"id": "WC_2026", "qualified": True, "group": wc_group})

    # ── Confederation-based future tournaments ────────────────────────────────
    if confederation == "UEFA":
        result.append({
            "id": "EURO_2028",
            "qualified": False,
            "confederation_member": True,
        })
    elif confederation == "CONMEBOL":
        result.append({
            "id": "COPA_2027",
            "qualified": True,   # all 10 CONMEBOL teams participate by right
            "confederation_member": True,
        })
    elif confederation == "CAF":
        result.append({
            "id": "AFCON_2027",
            "qualified": False,
            "confederation_member": True,
        })
    elif confederation == "AFC":
        result.append({
            "id": "ASIAN_CUP_2027",
            "qualified": False,
            "confederation_member": True,
        })
    elif confederation == "CONCACAF":
        result.append({
            "id": "GOLD_CUP_2027",
            "qualified": False,
            "confederation_member": True,
        })
        if code in COPA_INVITEES:
            result.append({
                "id": "COPA_2027",
                "qualified": False,
                "potential_invitee": True,
            })
    elif confederation == "OFC":
        result.append({
            "id": "OFC_2027",
            "qualified": False,
            "confederation_member": True,
        })

    return result


def norm(s):
    """Unicode-normalize a name: strip accents, lowercase, collapse punctuation."""
    if not s:
        return ""
    s = s.replace("ı", "i").replace("İ", "I").replace("ø", "o").replace("Ø", "O")
    s = s.replace("ð", "d").replace("Þ", "th").replace("þ", "th").replace("ß", "ss")
    s = s.replace("Ł", "L").replace("ł", "l").replace("đ", "d").replace("Đ", "D")
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.encode("ascii", "ignore").decode()
    s = re.sub(r"[-''.]", " ", s.lower())
    return re.sub(r"\s+", " ", s).strip()


def fetch_cached(path, url, binary=False):
    if not os.path.exists(path):
        r = requests.get(url, headers=UA, timeout=60)
        r.raise_for_status()
        mode, data = ("wb", r.content) if binary else ("w", r.text)
        with open(path, mode, **({} if binary else {"encoding": "utf-8"})) as f:
            f.write(data)
    enc = {} if binary else {"encoding": "utf-8"}
    with open(path, "rb" if binary else "r", **enc) as f:
        return f.read()


# ---------------------------------------------------------------- FIFA API
def load_fifa():
    squads = json.loads(fetch_cached(
        "fifa_squads_raw.json",
        f"https://api.fifa.com/api/v3/teams/squads/all/{ID_COMPETITION}/{ID_SEASON}?language=en"))
    matches = json.loads(fetch_cached(
        "fifa_matches.json",
        f"https://api.fifa.com/api/v3/calendar/matches?idCompetition={ID_COMPETITION}"
        f"&idSeason={ID_SEASON}&count=500&language=en"))

    groups = {}
    for m in matches.get("Results", []):
        gn = m.get("GroupName") or []
        if gn and m.get("Home") and m.get("Away"):
            g = gn[0]["Description"].replace("Group ", "")
            for side in ("Home", "Away"):
                c = m[side].get("IdCountry")
                if c:
                    groups[c] = g

    teams = {}
    for t in squads["Results"]:
        code = t["IdCountry"]
        teams[code] = {
            "name": t["TeamName"][0]["Description"],
            "players": [{
                "name": p["PlayerName"][0]["Description"],
                "number": p.get("JerseyNum"),
                "birthDate": (p.get("BirthDate") or "")[:10],
                "position": (p.get("PositionLocalized") or [{}])[0].get("Description", ""),
                "height": p.get("Height"),
                "weight": p.get("Weight"),
            } for p in t["Players"]],
        }
    return teams, groups


# --------------------------------------------------------------- Wikipedia
POS_MAP = {"GK": "GK", "DF": "DF", "MF": "MF", "FW": "FW"}


def load_wiki():
    html = fetch_cached("wiki_squads.html",
                        "https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_squads")
    soup = BeautifulSoup(html, "lxml")
    teams = {}
    for h3 in soup.select("h3"):
        country = h3.get_text(strip=True)
        if country not in WIKI_NAME_TO_CODE:
            continue
        code = WIKI_NAME_TO_CODE[country]
        table = h3.find_parent().find_next("table", class_="sortable")
        if table is None:
            continue
        players = []
        for tr in table.select("tr")[1:]:
            cells = tr.find_all(["th", "td"])
            if len(cells) < 7:
                continue
            num_txt = cells[0].get_text(strip=True)
            if not num_txt.isdigit():
                continue
            pos_txt = cells[1].get_text(" ", strip=True)
            pos = POS_MAP.get(pos_txt.split()[-1].upper(), "")
            pcell = cells[2]
            link = pcell.find("a")
            pname = (link.get_text(strip=True) if link else
                     re.sub(r"\(.*?\)", "", pcell.get_text(" ", strip=True)).strip())
            dob_m = re.search(r"\(\s*(\d{4}-\d{2}-\d{2})\s*\)", cells[3].get_text(" ", strip=True))
            caps = cells[4].get_text(strip=True)
            goals = cells[5].get_text(strip=True)
            club_link = cells[6].find_all("a")
            club = club_link[-1].get_text(strip=True) if club_link else cells[6].get_text(strip=True)
            players.append({
                "number": int(num_txt),
                "position": pos,
                "name": pname,
                "birthDate": dob_m.group(1) if dob_m else "",
                "caps": int(caps) if caps.isdigit() else 0,
                "goals": int(goals) if goals.isdigit() else 0,
                "club": club,
            })
        if players:
            teams[code] = players
    return teams


# ------------------------------------------------------------------ FC 26
GK_COLS = ["goalkeeping_diving", "goalkeeping_handling", "goalkeeping_kicking",
           "goalkeeping_reflexes", "goalkeeping_speed", "goalkeeping_positioning"]
GK_KEYS = ["diving", "handling", "kicking", "reflexes", "speed", "positioning"]
CORE_COLS = ["pace", "shooting", "passing", "dribbling", "defending", "physic"]
CORE_KEYS = ["pace", "shooting", "passing", "dribbling", "defending", "physical"]


def to_int(v):
    try:
        return int(float(v))
    except (ValueError, TypeError):
        return None


def load_fc26():
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
    players = [r for _, r in best.values()]

    by_dob = defaultdict(list)
    by_name = defaultdict(list)
    by_club = defaultdict(list)
    by_nation = defaultdict(list)
    for p in players:
        p["_short"] = norm(p["short_name"])
        p["_long"] = norm(p["long_name"])
        p["_club"] = norm(p.get("club_name") or "")
        by_dob[p["dob"]].append(p)
        by_name[p["_long"]].append(p)
        if p["_short"] != p["_long"]:
            by_name[p["_short"]].append(p)
        if p["_club"]:
            by_club[p["_club"]].append(p)
        by_nation[p["nationality_name"]].append(p)
    return players, {"dob": by_dob, "name": by_name, "club": by_club,
                     "nation": by_nation}


# --------------------------------------------------------------- Matching
def name_score(wname, p):
    return max(fuzz.token_sort_ratio(wname, p["_long"]),
               fuzz.token_sort_ratio(wname, p["_short"]),
               fuzz.partial_token_sort_ratio(wname, p["_long"]),
               fuzz.token_set_ratio(wname, p["_long"]) - 2)


def club_score(wclub, pclub):
    if not wclub or not pclub:
        return 0
    wt, pt = set(wclub.split()), set(pclub.split())
    if wt <= pt or pt <= wt:
        return 100
    if min(len(wclub), len(pclub)) < 6:
        return fuzz.ratio(wclub, pclub)
    return max(fuzz.token_set_ratio(wclub, pclub), fuzz.partial_ratio(wclub, pclub))


def near_dates(dob, days=5):
    try:
        d = datetime.strptime(dob, "%Y-%m-%d")
    except ValueError:
        return []
    return [(d + timedelta(n)).strftime("%Y-%m-%d")
            for n in range(-days, days + 1) if n != 0]


def dob_close(d1, d2, days=5):
    try:
        return abs((datetime.strptime(d1, "%Y-%m-%d")
                    - datetime.strptime(d2, "%Y-%m-%d")).days) <= days
    except (ValueError, TypeError):
        return False


def match_player(wp, idx, nation):
    """Return (fc26_row, method) or (None, None)."""
    wname = norm(wp["name"])
    wclub = norm(wp.get("club", ""))
    single_token = len(wname.split()) < 2
    strong = 95 if single_token else 86

    pending = None
    cands = idx["name"].get(wname, [])
    for p in cands:
        if p["dob"] == wp.get("birthDate") or dob_close(p["dob"], wp.get("birthDate", "")):
            return p, "exact_name+dob"
    for p in cands:
        if club_score(wclub, p["_club"]) >= 75:
            return p, "exact_name+club"
    if len(cands) == 1:
        pending = cands[0]

    best, best_s = None, 0
    for p in idx["dob"].get(wp.get("birthDate", ""), []):
        s = name_score(wname, p)
        if s > best_s:
            best, best_s = p, s
    if best is not None and best_s >= 72:
        return best, f"dob+fuzzy({best_s:.0f})"

    for p in idx["dob"].get(wp.get("birthDate", ""), []):
        if club_score(wclub, p["_club"]) >= 72 and name_score(wname, p) >= 40:
            return p, "dob+club"

    for d in near_dates(wp.get("birthDate", "")):
        for p in idx["dob"].get(d, []):
            if name_score(wname, p) >= 85:
                return p, "neardob+fuzzy"

    best, best_s = None, 0
    for p in idx["nation"].get(nation, []):
        s = name_score(wname, p)
        if s > best_s:
            best, best_s = p, s
    if best is not None and best_s >= strong and (
            club_score(wclub, best["_club"]) >= 70 or not best["_club"]):
        return best, f"nation+fuzzy({best_s:.0f})"

    posg = "GK" if wp.get("position") == "GK" else "OUT"
    pool = []
    for cname, plist in idx["club"].items():
        if club_score(wclub, cname) >= 88:
            pool.extend(plist)
    best, best_s = None, 0
    for p in pool:
        s = name_score(wname, p)
        if s > best_s:
            best, best_s = p, s
    if best is not None and best_s >= max(85, strong):
        return best, f"club+fuzzy({best_s:.0f})"
    for p in pool:
        pj = to_int(p.get("club_jersey_number"))
        ppos = "GK" if "GK" in (p.get("player_positions") or "") else "OUT"
        if pj == wp.get("number") and ppos == posg and name_score(wname, p) >= 60:
            return p, "club+jersey+pos"

    if pending is not None and pending.get("nationality_name") == nation:
        return pending, "exact_name_unverified"
    return None, None


def stats_from_row(p, is_gk):
    stats = {"overall": to_int(p["overall"]), "potential": to_int(p["potential"])}
    for k, c in zip(CORE_KEYS, CORE_COLS):
        stats[k] = to_int(p.get(c))
    gk = None
    if is_gk:
        gk = {k: to_int(p.get(c)) for k, c in zip(GK_KEYS, GK_COLS)}
    return stats, gk


# ─── Layer 2/3 helpers ───────────────────────────────────────────────────────

def load_isim_seeds():
    with open("isim_seeds.json", encoding="utf-8") as f:
        return json.load(f)


def pts_to_ovr_range(pts):
    if pts >= 1800: return (83, 87)
    if pts >= 1500: return (78, 82)
    if pts >= 1200: return (73, 77)
    if pts >= 900:  return (68, 72)
    if pts >= 600:  return (62, 67)
    return (55, 61)


def stable_rng(seed_str):
    h = int(hashlib.md5(seed_str.encode()).hexdigest()[:8], 16)
    return _random.Random(h)


def _make_gk_stats(rng, ovr):
    return {
        "diving":      max(30, min(99, round(rng.gauss(ovr,     5)))),
        "handling":    max(30, min(99, round(rng.gauss(ovr - 2, 5)))),
        "kicking":     max(20, min(80, round(rng.gauss(ovr - 8, 8)))),
        "reflexes":    max(30, min(99, round(rng.gauss(ovr + 1, 5)))),
        "speed":       max(20, min(75, round(rng.gauss(45,      10)))),
        "positioning": max(30, min(99, round(rng.gauss(ovr - 1, 5)))),
    }


def generate_procedural_team(code, info, seeds):
    """Layer 3: generate 26 procedurally generated players for a team."""
    rng = stable_rng(code)
    lo, hi = pts_to_ovr_range(info["ranking_pts"])
    team_ovr = rng.randint(lo, hi)

    entry = seeds.get(code) or seeds.get("ENG")  # English fallback
    firsts = entry["first"]
    lasts  = entry["last"]

    # Pre-generate a pool of unique names
    name_pool = [f"{rng.choice(firsts)} {rng.choice(lasts)}" for _ in range(60)]

    players = []
    num = 1
    for pos, count in SQUAD_POSITIONS:
        mult = POS_STAT_MULT[pos]
        for _ in range(count):
            # Pick a unique name from pool
            pname = name_pool[(num - 1) % len(name_pool)]
            age = max(18, min(36, round(rng.gauss(26, 4))))
            yr = 2026 - age
            bd = f"{yr}-{rng.randint(1,12):02d}-{rng.randint(1,28):02d}"

            ovr = max(lo, min(hi + 4, round(rng.gauss(team_ovr, 4))))
            stats = {"overall": ovr, "potential": ovr + rng.randint(0, 4)}
            for stat in CORE_KEYS:
                base = ovr * mult[stat]
                stats[stat] = max(20, min(99, round(rng.gauss(base, 6))))

            gk_stats = _make_gk_stats(rng, stats["overall"]) if pos == "GK" else None

            players.append({
                "id": f"{code.lower()}_{num:03d}",
                "name": pname,
                "number": num,
                "position": pos,
                "birthDate": bd,
                "club": "",
                "caps": 0,
                "goals": 0,
                "stats": stats,
                "gkStats": gk_stats,
                "skillMoves": 1 if pos == "GK" else rng.choice([1, 2, 2, 3]),
                "weakFoot":   rng.choice([2, 2, 3, 3, 4]),
                "preferredFoot": rng.choice(["Right", "Right", "Right", "Left"]),
                "estimated": False,
                "generated": True,
            })
            num += 1

    return {
        "id":            code,
        "name":          info["name"],
        "group":         None,
        "confederation": info["confederation"],
        "tournaments":   get_team_tournaments(code, info["confederation"]),
        "players":       players,
        "generated":     True,
    }


def load_external_squads(comp_id, season_id):
    """Fetch (or load from cache) all squads for an external tournament.
    Returns dict: team_code → raw FIFA squad object."""
    os.makedirs("cache", exist_ok=True)
    cache = f"cache/squads_{comp_id}_{season_id}.json"
    if not os.path.exists(cache):
        try:
            url = (f"https://api.fifa.com/api/v3/teams/squads/all"
                   f"/{comp_id}/{season_id}?language=en")
            r = requests.get(url, headers=UA, timeout=60)
            if r.status_code != 200:
                with open(cache, "w") as f:
                    json.dump({"Results": []}, f)
            else:
                with open(cache, "w", encoding="utf-8") as f:
                    f.write(r.text)
        except Exception as e:
            print(f"  WARN fetch {comp_id}/{season_id}: {e}")
            with open(cache, "w") as f:
                json.dump({"Results": []}, f)

    with open(cache, encoding="utf-8") as f:
        try:
            data = json.load(f)
        except Exception:
            data = {}

    result = {}
    for t in (data or {}).get("Results", []):
        code = t.get("IdCountry")
        if code:
            result[code] = t
    return result


def _estimate_unmatched(matched_rows, is_gk_fn):
    """Fill estimated stats for players without a FC26 match (same logic as WC layer)."""
    for pl, row in matched_rows:
        if row is not None:
            continue
        peers = [q for q, r in matched_rows
                 if r is not None and q["position"] == pl["position"]]
        factor = 0.875
        if not peers:
            peers = [q for q, r in matched_rows if r is not None]
            factor = 0.80
        if not peers:
            continue
        agg = {}
        for key in ["overall", "potential"] + CORE_KEYS:
            vals = [q["stats"][key] for q in peers if q["stats"] and q["stats"].get(key)]
            agg[key] = round(sum(vals) / len(vals) * factor) if vals else None
        if agg.get("potential") and agg.get("overall"):
            agg["potential"] = max(agg["potential"], agg["overall"] + 2)
        pl["stats"] = agg
        if pl["position"] == "GK":
            gk_peers = [q for q, r in matched_rows if r is not None and q["gkStats"]]
            if gk_peers:
                pl["gkStats"] = {
                    k: round(sum(q["gkStats"][k] for q in gk_peers if q["gkStats"].get(k))
                             / max(1, len([q for q in gk_peers if q["gkStats"].get(k)]))
                             * factor)
                    for k in GK_KEYS}
            elif pl["stats"] and pl["stats"].get("overall"):
                ov = pl["stats"]["overall"]
                pl["gkStats"] = {"diving": ov, "handling": ov - 2,
                                 "kicking": ov - 8, "reflexes": ov + 1,
                                 "speed": 45, "positioning": ov - 1}
        pl["skillMoves"], pl["weakFoot"] = (1, 3) if pl["position"] == "GK" else (2, 3)
        pl["estimated"] = True


POSMAP_FIFA = {
    "Goalkeeper": "GK", "Defender": "DF", "Midfielder": "MF", "Forward": "FW"
}


def process_layer2_team(code, info, squad_data, fc26_idx, name_seeds):
    """Layer 2: process a non-WC tournament team.
    squad_data is a raw FIFA API team object (same format as WC squads).
    Returns team dict or None if squad is empty."""
    nation = info["fc26_nation"]

    raw_players = squad_data.get("Players", [])
    if not raw_players:
        return None

    wp_list = []
    for p in raw_players:
        pname_raw = (p.get("PlayerName") or [{}])[0].get("Description", "")
        pname = " ".join(w.title() if w.isupper() else w for w in pname_raw.split())
        pos_raw = (p.get("PositionLocalized") or [{}])[0].get("Description", "")
        wp_list.append({
            "number":    p.get("JerseyNum") or (len(wp_list) + 1),
            "position":  POSMAP_FIFA.get(pos_raw, "MF"),
            "name":      pname,
            "birthDate": (p.get("BirthDate") or "")[:10],
            "caps": 0, "goals": 0, "club": "",
        })

    team = {
        "id":            code,
        "name":          info["name"],
        "group":         None,
        "confederation": info["confederation"],
        "tournaments":   get_team_tournaments(code, info["confederation"]),
        "players":       [],
    }
    matched_rows = []
    for wp in sorted(wp_list, key=lambda x: x["number"]):
        row, method = match_player(wp, fc26_idx, nation)
        is_gk = wp["position"] == "GK"
        pl = {
            "id":            f"{code.lower()}_{wp['number']:03d}",
            "name":          wp["name"],
            "number":        wp["number"],
            "position":      wp["position"],
            "birthDate":     wp["birthDate"],
            "club":          "",
            "caps":          0,
            "goals":         0,
            "stats":         None,
            "gkStats":       None,
            "skillMoves":    0,
            "weakFoot":      0,
            "preferredFoot": "Right",
            "estimated":     False,
        }
        if row is not None:
            pl["stats"], pl["gkStats"] = stats_from_row(row, is_gk)
            pl["club"]         = row.get("club_name") or ""
            pl["skillMoves"]   = to_int(row.get("skill_moves")) or 0
            pl["weakFoot"]     = to_int(row.get("weak_foot")) or 0
            pl["preferredFoot"]= row.get("preferred_foot") or "Right"
        team["players"].append(pl)
        matched_rows.append((pl, row))

    _estimate_unmatched(matched_rows, lambda p: p["position"] == "GK")
    return team


# ------------------------------------------------------------------- Main
def main():
    fifa_teams, groups = load_fifa()
    wiki_teams = load_wiki()
    fc26_all, idx = load_fc26()

    out_teams, unmatched, report, match_log = [], [], [], []
    n_total = n_matched = 0
    method_counter = defaultdict(int)

    # ── Layer 1: WC 2026 (existing logic) ────────────────────────────────────
    wc_codes = set(groups.keys())
    for code in sorted(groups, key=lambda c: (groups[c], c)):
        wplayers = wiki_teams.get(code, [])
        fifa_t = fifa_teams.get(code, {"name": code, "players": []})
        if len(fifa_t["players"]) != 26:
            report.append(f"WARN {code}: FIFA API squad has {len(fifa_t['players'])} players")
        if len(wplayers) < 26:
            have = {p["number"] for p in wplayers}
            posmap = {"Goalkeeper": "GK", "Defender": "DF",
                      "Midfielder": "MF", "Forward": "FW"}
            for fp in fifa_t["players"]:
                if fp["number"] in have or fp["number"] is None:
                    continue
                name = " ".join(w.title() if w.isupper() else w
                                for w in fp["name"].split())
                wplayers.append({"number": fp["number"],
                                 "position": posmap.get(fp["position"], "MF"),
                                 "name": name, "birthDate": fp["birthDate"],
                                 "caps": 0, "goals": 0, "club": ""})
                report.append(f"INFO {code}: #{fp['number']} {name} backfilled from FIFA API")
            if len(wplayers) != 26:
                report.append(f"WARN {code}: squad has {len(wplayers)} players")

        info = ALL_FIFA_TEAMS.get(code, {})
        confed = CONFED_BY_CODE.get(code, info.get("confederation", ""))
        team = {
            "id":            code,
            "name":          TEAM_DISPLAY.get(code, fifa_t["name"]),
            "group":         groups[code],
            "confederation": confed,
            "tournaments":   get_team_tournaments(code, confed, groups[code]),
            "players":       [],
        }
        matched_rows = []
        for wp in sorted(wplayers, key=lambda x: x["number"]):
            n_total += 1
            row, method = match_player(wp, idx, NATIONALITY.get(code, info.get("fc26_nation", code)))
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
                n_matched += 1
                method_counter[method.split("(")[0]] += 1
                match_log.append({
                    "team": code, "wiki": wp["name"], "wikiClub": wp.get("club"),
                    "fc26": row["short_name"], "fc26Club": row.get("club_name"),
                    "fc26Dob": row["dob"], "wikiDob": wp.get("birthDate"),
                    "method": method})
                pl["stats"], pl["gkStats"] = stats_from_row(row, is_gk)
                if not pl["club"]:
                    pl["club"] = row.get("club_name") or ""
                pl["skillMoves"]    = to_int(row.get("skill_moves")) or 0
                pl["weakFoot"]      = to_int(row.get("weak_foot")) or 0
                pl["preferredFoot"] = row.get("preferred_foot") or "Right"
                pl["_method"] = method
            else:
                unmatched.append({"team": code, **{k: wp[k] for k in
                                  ("name", "number", "position", "birthDate", "club")
                                  if k in wp}})
            team["players"].append(pl)
            matched_rows.append((pl, row))

        _estimate_unmatched(matched_rows, lambda p: p["position"] == "GK")
        for pl in team["players"]:
            pl.pop("_method", None)
        out_teams.append(team)

    # ── Layer 2/3: All other FIFA members ────────────────────────────────────
    name_seeds = load_isim_seeds()

    # Pre-load external tournament squads (one HTTP call per comp, all cached)
    needed_comps = {info["competition"]
                    for info in ALL_FIFA_TEAMS.values()
                    if info.get("competition") and info["competition"] != "WC2026"}
    ext_squads: dict[str, dict] = {}  # team_code → FIFA squad object
    for comp_key in sorted(needed_comps):
        if comp_key not in EXTERNAL_COMP:
            continue
        comp_id, season_id = EXTERNAL_COMP[comp_key]
        print(f"  Loading {comp_key} ({comp_id}/{season_id})…")
        fetched = load_external_squads(comp_id, season_id)
        for t_code, squad in fetched.items():
            if t_code not in wc_codes and t_code not in ext_squads:
                ext_squads[t_code] = squad

    n_layer2 = n_layer3 = 0
    for code, info in sorted(ALL_FIFA_TEAMS.items()):
        if code in wc_codes:
            continue  # already processed above

        if code in ext_squads:
            team = process_layer2_team(code, info, ext_squads[code], idx, name_seeds)
            if team:
                out_teams.append(team)
                n_layer2 += 1
                continue

        # Layer 3: procedural
        team = generate_procedural_team(code, info, name_seeds)
        out_teams.append(team)
        n_layer3 += 1

    # ── Write outputs ─────────────────────────────────────────────────────────
    # teams_full.json — all 211 teams with full player data + tournaments
    with open("teams_full.json", "w", encoding="utf-8") as f:
        json.dump({"teams": out_teams}, f, ensure_ascii=False, indent=2)

    # teams_wc2026.json — only the 48 WC teams (backward compatibility)
    wc_teams = [t for t in out_teams if t.get("group")]
    with open("teams_wc2026.json", "w", encoding="utf-8") as f:
        json.dump({"teams": wc_teams}, f, ensure_ascii=False, indent=2)

    # confederation_map.json — lightweight: code → {name, confederation, tournaments}
    conf_map = {
        t["id"]: {
            "name":          t["name"],
            "confederation": t["confederation"],
            "tournaments":   t.get("tournaments", []),
        }
        for t in out_teams
    }
    with open("confederation_map.json", "w", encoding="utf-8") as f:
        json.dump(conf_map, f, ensure_ascii=False, indent=2)

    # name_seeds.json — copy of isim_seeds.json (canonical output name)
    import shutil
    shutil.copy("isim_seeds.json", "name_seeds.json")

    # debug files
    with open("unmatched_players.json", "w", encoding="utf-8") as f:
        json.dump(unmatched, f, ensure_ascii=False, indent=2)
    with open("match_log.json", "w", encoding="utf-8") as f:
        json.dump(match_log, f, ensure_ascii=False, indent=2)

    # ── Build report data ─────────────────────────────────────────────────────
    wc_players = sum(len(t["players"]) for t in out_teams if t.get("group"))
    match_pct = n_matched / max(1, n_total) * 100

    # Tournament coverage counts
    tour_counts: dict[str, dict] = {tid: {"members": 0, "qualified": 0, "candidate": 0, "invitee": 0}
                                     for tid in TOURNAMENT_SLOTS}
    for t in out_teams:
        for tr in t.get("tournaments", []):
            tid = tr["id"]
            if tid not in tour_counts:
                continue
            tour_counts[tid]["members"] += 1
            if tr.get("qualified"):
                tour_counts[tid]["qualified"] += 1
            elif tr.get("potential_invitee"):
                tour_counts[tid]["invitee"] += 1
            else:
                tour_counts[tid]["candidate"] += 1

    # Coverage by confederation
    conf_stats: dict[str, dict] = defaultdict(lambda: {"total": 0, "matched": 0, "estimated": 0, "generated": 0})
    for t in out_teams:
        c = t["confederation"]
        conf_stats[c]["total"] += len(t["players"])
        for p in t["players"]:
            if p.get("generated"):
                conf_stats[c]["generated"] += 1
            elif p.get("estimated"):
                conf_stats[c]["estimated"] += 1
            else:
                conf_stats[c]["matched"] += 1

    # Top 20 players
    allp = [(p["stats"]["overall"], p["name"], t["id"], p.get("estimated"), p.get("generated"))
            for t in out_teams for p in t["players"]
            if p["stats"] and p["stats"].get("overall")]
    top20 = sorted(allp, reverse=True)[:20]

    # ── Print summary ─────────────────────────────────────────────────────────
    print(f"\ntotal teams: {len(out_teams)}")
    print(f"  WC 2026 (Layer 1): {len(wc_codes)} teams, {wc_players} players")
    print(f"  tournament ext (Layer 2): {n_layer2} teams")
    print(f"  procedural (Layer 3): {n_layer3} teams")
    print(f"WC FC26 match rate: {n_matched}/{n_total} ({match_pct:.1f}%)")
    print("match methods:", dict(sorted(method_counter.items(), key=lambda x: -x[1])))
    for line in report:
        print(line)
    print("\nTop 20 by overall:")
    for ov, name, tc, est, gen in top20:
        tag = " [GEN]" if gen else (" [EST]" if est else "")
        print(f"  {ov}  {name} ({tc}){tag}")

    # ── Write REPORT_FULL.md ──────────────────────────────────────────────────
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    lines = [
        "# World Cup Game — Full Dataset Report",
        f"Generated: {now}",
        "",
        "## Summary",
        f"| Metric | Value |",
        f"|--------|-------|",
        f"| Total teams | {len(out_teams)} |",
        f"| Layer 1 — WC 2026 (real FC26 data) | {len(wc_codes)} teams · {wc_players} players |",
        f"| Layer 2 — External tournament (FC26 matched) | {n_layer2} teams |",
        f"| Layer 3 — Procedurally generated | {n_layer3} teams |",
        f"| WC 2026 FC26 match rate | {n_matched}/{n_total} ({match_pct:.1f}%) |",
        "",
        "## Match Methods (WC 2026)",
        "| Method | Count |",
        "|--------|-------|",
    ]
    for method, cnt in sorted(method_counter.items(), key=lambda x: -x[1]):
        lines.append(f"| {method} | {cnt} |")

    lines += [
        "",
        "## Tournament Coverage",
        "| Tournament | Slots | Members | Qualified | Candidates | Pot. Invitees |",
        "|------------|-------|---------|-----------|------------|---------------|",
    ]
    for tid, slots in TOURNAMENT_SLOTS.items():
        tc = tour_counts[tid]
        lines.append(
            f"| {tid} | {slots} | {tc['members']} | {tc['qualified']} "
            f"| {tc['candidate']} | {tc['invitee']} |"
        )

    lines += [
        "",
        "## Coverage by Confederation",
        "| Confederation | Players | FC26 Real | Estimated | Generated | Real% |",
        "|---------------|---------|-----------|-----------|-----------|-------|",
    ]
    for conf in ("UEFA", "AFC", "CAF", "CONCACAF", "CONMEBOL", "OFC"):
        cs = conf_stats[conf]
        real_pct = cs["matched"] / max(1, cs["total"]) * 100
        lines.append(
            f"| {conf} | {cs['total']} | {cs['matched']} "
            f"| {cs['estimated']} | {cs['generated']} | {real_pct:.0f}% |"
        )

    lines += [
        "",
        "## Top 20 Players",
        "| OVR | Name | Team | Notes |",
        "|-----|------|------|-------|",
    ]
    for ov, name, tc, est, gen in top20:
        tag = "Generated" if gen else ("Estimated" if est else "FC26 real")
        lines.append(f"| {ov} | {name} | {tc} | {tag} |")

    lines += [
        "",
        "## Warnings",
    ]
    for line in report:
        lines.append(f"- {line}")

    with open("REPORT_FULL.md", "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")

    print("\nOutput files written:")
    print("  teams_full.json  teams_wc2026.json  confederation_map.json")
    print("  name_seeds.json  REPORT_FULL.md")


if __name__ == "__main__":
    main()
