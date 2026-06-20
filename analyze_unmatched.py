# -*- coding: utf-8 -*-
"""Diagnose remaining unmatched players: which have FC26-licensed clubs?"""
import csv
import json
from collections import Counter

from build_dataset import norm

u = json.load(open("unmatched_players.json", encoding="utf-8"))
print("unmatched:", len(u))
print(Counter(x["team"] for x in u).most_common())

clubs = set()
leagues = set()
with open("fc26_players.csv", encoding="utf-8", errors="replace") as f:
    for row in csv.DictReader(f):
        clubs.add(row["club_name"])
        leagues.add(row["league_name"])
nclubs = {norm(c) for c in clubs if c}

inlg = [x for x in u if x["club"] and norm(x["club"]) in nclubs]
print("\nunmatched whose club IS in FC26 (exact club-name hit):", len(inlg))
for x in inlg[:40]:
    print(" ", x["team"], x["name"], "|", x["birthDate"], "|", x["club"])

print("\nsample of unmatched club names NOT in FC26:")
notin = Counter(x["club"] for x in u if x["club"] and norm(x["club"]) not in nclubs)
for c, n in notin.most_common(25):
    print(f"  {n:2d}  {c}")
