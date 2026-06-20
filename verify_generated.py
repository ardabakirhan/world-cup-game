# -*- coding: utf-8 -*-
"""Verify a generated team (SMR, MSR) has all fields needed for a tournament career."""
import json, sys

with open('app/src/data/teams.json', encoding='utf-8') as f:
    teams = json.load(f)['teams']

REQUIRED_PLAYER = {'id','name','number','position','birthDate','club','caps','goals',
                   'stats','gkStats','skillMoves','weakFoot','preferredFoot','estimated','avatar'}
REQUIRED_STATS = {'overall','potential','pace','shooting','passing','dribbling','defending','physical'}
REQUIRED_AVATAR = {'skinTone','hairStyle','hairColor','beard'}
REQUIRED_GK = {'diving','handling','kicking','reflexes','speed','positioning'}

errors = []
for code in ('SMR', 'MSR', 'AND', 'GIB'):
    team = next((t for t in teams if t['id'] == code), None)
    if not team:
        print(f'WARN: {code} not found')
        continue

    ovrs = [p['stats']['overall'] for p in team['players'] if p.get('stats')]
    print(f"{code} ({team['name']}): generated={team.get('generated')}, "
          f"players={len(team['players'])}, group={team.get('group')}, "
          f"OVR avg={sum(ovrs)/len(ovrs):.1f} min={min(ovrs)} max={max(ovrs)}")

    for p in team['players']:
        missing = REQUIRED_PLAYER - set(p.keys())
        if missing:
            errors.append(f"{code} #{p.get('number')} missing: {missing}")
        if p.get('stats'):
            miss_s = REQUIRED_STATS - set(p['stats'].keys())
            if miss_s:
                errors.append(f"{code} #{p.get('number')} stats missing: {miss_s}")
        if p['position'] == 'GK' and p.get('gkStats'):
            miss_gk = REQUIRED_GK - set(p['gkStats'].keys())
            if miss_gk:
                errors.append(f"{code} #{p.get('number')} gkStats missing: {miss_gk}")
        if 'avatar' in p:
            miss_av = REQUIRED_AVATAR - set(p['avatar'].keys())
            if miss_av:
                errors.append(f"{code} #{p.get('number')} avatar missing: {miss_av}")
        # GK must have gkStats
        if p['position'] == 'GK' and not p.get('gkStats'):
            errors.append(f"{code} #{p.get('number')} GK missing gkStats")

print()
if errors:
    print(f'ERRORS ({len(errors)}):')
    for e in errors:
        print(f'  {e}')
else:
    print('All required fields present for generated teams (SMR, MSR, AND, GIB)')

# Also verify all WC teams still have group + correct structure
wc = [t for t in teams if t.get('group')]
wc_err = 0
for t in wc:
    for p in t['players']:
        if not p.get('stats') or p['stats'].get('overall') is None:
            wc_err += 1
print(f'\nWC teams missing overall stats: {wc_err}')

# Confederation filter coverage - all 6 WC confederations present
wc_confs = set(t['confederation'] for t in wc)
expected = {'UEFA','CAF','AFC','CONCACAF','CONMEBOL','OFC'}
print(f'WC confederations covered: {sorted(wc_confs)} == expected: {not (expected - wc_confs)}')
