# -*- coding: utf-8 -*-
"""Audit risky matches (weak methods or DOB mismatches) for false positives."""
import json

log = json.load(open("match_log.json", encoding="utf-8"))
risky = [m for m in log
         if m["method"].startswith(("club+jersey", "nation+fuzzy", "club+fuzzy",
                                    "neardob", "dob+club"))
         or (m["wikiDob"] and m["fc26Dob"] != m["wikiDob"])]
print("risky:", len(risky))
for m in risky:
    print(f"{m['team']} {m['wiki']} ({m['wikiClub']}, {m['wikiDob']}) -> "
          f"{m['fc26']} ({m['fc26Club']}, {m['fc26Dob']}) [{m['method']}]")
