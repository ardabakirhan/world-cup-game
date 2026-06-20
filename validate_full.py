# -*- coding: utf-8 -*-
import json
from collections import defaultdict

with open('app/src/data/teams.json', encoding='utf-8') as f:
    data = json.load(f)

teams = data['teams']
print(f'Total teams: {len(teams)}')
print()

# Layer distribution
wc   = [t for t in teams if t.get('group')]
gen  = [t for t in teams if t.get('generated')]
l2   = [t for t in teams if not t.get('group') and not t.get('generated')]
print(f'Layer 1 (WC 2026):   {len(wc)} teams  (group != null)')
print(f'Layer 2 (ext squad): {len(l2)} teams  (no group, not generated)')
print(f'Layer 3 (generated): {len(gen)} teams')
print()

# Confederation distribution
conf_counts = defaultdict(int)
for t in teams:
    conf_counts[t['confederation']] += 1
print('Confederation breakdown:')
for c in ('UEFA', 'CAF', 'AFC', 'CONCACAF', 'CONMEBOL', 'OFC'):
    total_c = [t for t in teams if t['confederation'] == c]
    wc_c    = [t for t in total_c if t.get('group')]
    nonwc_c = [t for t in total_c if not t.get('group')]
    print(f'  {c}: {len(wc_c)} WC + {len(nonwc_c)} non-WC = {len(total_c)} total')
print()

# WC confederation keys (for filter bar)
wc_confs = sorted(set(t['confederation'] for t in wc))
print(f'Confederations present in WC teams: {wc_confs}')
print()

# Player count validation
bad = [t for t in teams if len(t['players']) != 26]
print(f'Teams with != 26 players: {len(bad)}')
if bad:
    for t in bad[:5]:
        print(f'  {t["id"]}: {len(t["players"])} players')
print()

# Avatar coverage
no_av = sum(1 for t in teams for p in t['players'] if 'avatar' not in p)
print(f'Players missing avatar: {no_av}')
photo  = sum(1 for t in teams for p in t['players'] if p.get('avatar', {}).get('fromPhoto'))
fallbk = sum(1 for t in teams for p in t['players'] if 'avatar' in p and not p['avatar'].get('fromPhoto'))
print(f'Photo-derived avatars:  {photo}')
print(f'Fallback avatars:       {fallbk}')
print()

# OVR sanity checks
smr = next((t for t in teams if t['id'] == 'SMR'), None)
if smr:
    ovrs = [p['stats']['overall'] for p in smr['players'] if p.get('stats')]
    print(f'San Marino OVRs: min={min(ovrs)} max={max(ovrs)} avg={sum(ovrs)/len(ovrs):.1f} (expected 55-61)')

# Key WC players
tur = next((t for t in teams if t['id'] == 'TUR'), None)
if tur:
    calha = next((p for p in tur['players'] if 'alhanoglu' in p['name'].lower()), None)
    arda  = next((p for p in tur['players'] if 'Arda' in p['name']), None)
    if calha:
        print(f'Calhanoglu OVR: {calha["stats"]["overall"]} (expected 86)')
    if arda:
        print(f'Arda Guler OVR: {arda["stats"]["overall"]} (expected 81)')
print()

# Non-WC groups should be null
null_group = sum(1 for t in teams if t.get('group') is None and not t.get('generated'))
wc_group   = sum(1 for t in teams if t.get('group') is not None)
gen_group  = sum(1 for t in teams if t.get('generated') and t.get('group') is None)
print(f'WC teams (group != null): {wc_group}')
print(f'Non-WC non-generated (group null): {null_group}')
print(f'Generated (group null): {gen_group}')

# Verify WC teams have correct groups (12 groups A-L, 4 per group)
from collections import Counter
group_ctr = Counter(t['group'] for t in wc)
print(f'\nGroup distribution: {dict(sorted(group_ctr.items()))}')
groups_of_4 = [g for g, n in group_ctr.items() if n == 4]
print(f'Groups with exactly 4 teams: {len(groups_of_4)}/12')
