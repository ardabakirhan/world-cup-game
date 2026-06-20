# -*- coding: utf-8 -*-
"""Audit second-pass matches: list non-exact methods for manual review."""
import json

log = json.load(open("second_pass_log.json", encoding="utf-8"))
print("total new matches:", len(log))
fuzzy = [l for l in log if not l["method"].startswith("exact")]
print("non-exact methods:", len(fuzzy))
for l in fuzzy:
    print(f"  {l['team']} {l['player']} -> {l['matched']} "
          f"({l['club_then']}, {l['dob']}, OVR {l['overall']}) [{l['source']} {l['method']}]")
