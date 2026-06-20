# -*- coding: utf-8 -*-
"""Final validation of teams.json."""
import json
from collections import Counter

d = json.load(open("teams.json", encoding="utf-8"))
teams = d["teams"]
print("teams:", len(teams))

issues = []
est_by_team = Counter()
for t in teams:
    ps = t["players"]
    if len(ps) != 26:
        issues.append(f"{t['id']}: {len(ps)} players")
    posc = Counter(p["position"] for p in ps)
    if posc.get("GK", 0) < 3:
        issues.append(f"{t['id']}: only {posc.get('GK',0)} GKs")
    nums = [p["number"] for p in ps]
    if sorted(nums) != list(range(1, 27)):
        issues.append(f"{t['id']}: jersey numbers not 1..26: {sorted(nums)}")
    for p in ps:
        est_by_team[t["id"]] += p["estimated"]
        if not p["stats"] or p["stats"].get("overall") is None:
            issues.append(f"{t['id']} {p['name']}: missing overall")
        if p["position"] == "GK" and not p["gkStats"]:
            issues.append(f"{t['id']} {p['name']}: GK without gkStats")
        if p["position"] != "GK" and any(
                p["stats"].get(k) is None for k in
                ("pace", "shooting", "passing", "dribbling", "defending", "physical")):
            issues.append(f"{t['id']} {p['name']}: outfielder with null core stat")
        if not p["birthDate"]:
            issues.append(f"{t['id']} {p['name']}: missing birthDate")
        if not p["club"]:
            issues.append(f"{t['id']} {p['name']}: missing club")

print("issues:", len(issues))
for i in issues[:40]:
    print(" ", i)

print("\nestimated players per team (worst 12):")
for tc, n in est_by_team.most_common(12):
    print(f"  {tc}: {n}/26")

print("\ngroups:", Counter(t["group"] for t in teams))
print("confederations:", Counter(t["confederation"] for t in teams))

tur = next(t for t in teams if t["id"] == "TUR")
print(f"\nTürkiye ({tur['group']}, {tur['confederation']}):")
for p in sorted(tur["players"], key=lambda x: x["number"]):
    s = p["stats"]
    print(f"  #{p['number']:2d} {p['position']} {p['name']:28s} {p['club']:24s} "
          f"OVR {s['overall']}{' EST' if p['estimated'] else ''} "
          f"caps {p['caps']}")

caps_check = [(p["caps"], p["name"], t["id"]) for t in teams for p in t["players"]]
print("\nmost caps:", sorted(caps_check, reverse=True)[:5])
