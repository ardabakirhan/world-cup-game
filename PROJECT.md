# World Cup Manager — Project Handoff Document

*Last updated: June 12, 2026 (fictional calendar). Document generation: Claude Sonnet 4.6.*

---

## 1. PROJECT OVERVIEW

**What it is**: A mobile-first national team football management sim. You pick one of 211 FIFA-registered nations, create a coach avatar, and play through a continuous multi-year calendar from the 2026 World Cup to WC 2030, touching every real competition the chosen country participates in: WC 2026 group stage + KO, UEFA/CONCACAF Nations League, AFCON qualification, OFC Nations Cup, Copa América, EURO 2028, and WC 2030 qualification.

**Platform**: Android APK (primary) via Capacitor. Also runs in any modern browser as a PWA.

**Tech stack**: React 19, Vite 8, TypeScript, TailwindCSS 4, Zustand 5 (state), Capacitor 8.4 (Android bridge), `@capacitor/preferences` (persistent save), i18next (EN/TR bilingual).

**Current state** (as of June 12, 2026): Core infrastructure is fully operational. Career calendar generates correct competition paths for all 211 teams, all 6 confederations. Match engine, lineup/formation system, player condition system, and save/load all work. The Home screen runs in Calendar Hub mode. Main remaining gap is the Tactics screen expansion (currently only formation + style/press/tempo) and the EURO 2028 qualification pathway.

---

## 2. VISION & DESIGN PHILOSOPHY

The game is inspired by **Football Agent (Rongorongo)**: text-based, menu/list UI, zero 3D, deep mechanics. Think Football Manager for national teams, mobile-first. Key tenets:

- **No 3D, no graphics assets** — everything is SVG, emoji, procedural drawing, and flag icons.
- **Real calendar** — every competition runs on its real-world date. Sep 4, 2026 is when CONCACAF Nations League starts. Oct 2, 2026 is when AFCON qualifying begins. These dates are hardcoded from Wikipedia.
- **All 211 FIFA teams** — not just the 48 World Cup teams. Picking British Virgin Islands (VGB) gives a real schedule: CNL League C group → WC 2030 qual.
- **Real player data** — FC26 ratings where obtainable (76% of WC teams covered), estimated stats for others. Players have name, DOB, club, position, and `overall`/`pace`/`shooting`/`passing`/`dribbling`/`defending`/`physical` stats.
- **Photo-derived avatars** — player face photos were processed by `avatars.py` to extract `skinTone`, `hairStyle`, `hairColor`, `beard` parameters. These 4 parameters (never the photos themselves) are embedded in `teams.json`. CRITICAL CONSTRAINT: **photos must NOT be embedded in the app**, only the derived parameters.
- **Firing / expectations** — OVR-based expectation level (0–5), career grade, dismissal risk after poor competition outcomes.

---

## 3. TECH STACK

```
Framework:         React 19.2.6
Build:             Vite 8.0.12
Language:          TypeScript (strict)
Styling:           TailwindCSS 4.3 (via @tailwindcss/vite plugin)
State:             Zustand 5.0.14 with persist middleware
Persistence:       @capacitor/preferences (JSON, up to ~5MB)
Mobile:            Capacitor 8.4.0 + @capacitor/android
Flags:             circle-flags 2.8.3 (SVG, copied to src/assets/flags/)
i18n:              i18next 26.3 + react-i18next 17
Routing:           react-router-dom 7.17
```

**Capacitor config** (`app/capacitor.config.ts`):
```typescript
appId:   'com.abaki.wc26manager'
appName: 'WC26 Manager'
webDir:  'dist'
android.backgroundColor: '#0e1116'
```

**Android build**: `npm run apk` → runs `vite build && cap sync android && gradlew assembleDebug`
Requires JDK 17+. Last known APK: debug build, size unknown (production build chunk ~2.6 MB before dynamic import optimization).

---

## 4. FILE STRUCTURE

```
world_cup_game/
├── PROJECT.md                      ← this file
├── teams_full.json                 ← source dataset: 211 teams, all players (UTF-8)
├── teams.json                      ← used by data pipeline; NOT the app bundle
├── teams_wc2026.json               ← WC 2026-only subset (48 teams)
├── fc26_players.csv                ← FC26 source ratings (raw from API)
├── fifa_squads_raw.json            ← FIFA API raw squad data
├── confederation_map.json          ← team → confederation mapping
├── build_dataset.py                ← main data pipeline (combines API + wiki + FC26)
├── merge_avatars.py                ← merges avatar params back into teams_full.json
├── validate.py / validate_full.py  ← data validation scripts
├── avatars.py                      ← photo → avatar params extraction (OpenCV)
├── second_pass.py                  ← FC26 re-matching pass
├── analyze_unmatched.py            ← audit tool for unmatched players
├── fetch_wiki_squads.py            ← Wikipedia squad scraper
├── download_legacy.py              ← FC25/FC24 fallback ratings
├── REPORT.md / REPORT_FULL.md      ← data pipeline reports
├── cache/                          ← cached HTML/JSON from APIs (wiki, FIFA)
├── face_cache/                     ← player face photo cache (not bundled!)
│
└── app/                            ← THE REACT APPLICATION
    ├── package.json
    ├── vite.config.ts
    ├── capacitor.config.ts
    ├── index.html
    ├── public/
    │   ├── favicon.svg
    │   └── icons.svg               ← sprite sheet for UI icons
    ├── scripts/
    │   ├── calibrate.ts            ← match engine calibration (npx tsx)
    │   ├── playthrough.ts          ← automated career playthrough test
    │   └── avatar-preview.*        ← avatar generator preview page
    └── src/
        ├── main.tsx                ← ReactDOM.createRoot
        ├── App.tsx                 ← Router: routes to all screens
        ├── index.css               ← CSS variables, base styles
        ├── assets/flags/           ← 211 SVG flag files (from circle-flags npm)
        ├── i18n/
        │   ├── en.json             ← English strings
        │   ├── tr.json             ← Turkish strings
        │   └── index.ts            ← i18next init
        ├── data/
        │   ├── teams.json          ← THE BUNDLED DATASET (211 teams, all players)
        │   ├── teams.ts            ← TEAMS array loader, getTeam(), teamAvgOverall()
        │   ├── types.ts            ← Team, Player, PlayerStats, GkStats, TournamentRef
        │   ├── tournaments.ts      ← Tournament metadata (IDs, names)
        │   ├── nationalities.ts    ← ISO → country name map (for coach creator)
        │   └── teamColors.ts       ← Primary colors per team (for UI accents)
        ├── components/
        │   ├── Avatar.tsx          ← <Avatar params={...} size={n} /> React component
        │   ├── avatarGen.ts        ← avatarSvg() pure SVG generator + SKIN/HAIR_COLORS palettes
        │   ├── Flag.tsx            ← <Flag code="ITA" size={24} /> + FIFA_TO_ISO map
        │   ├── PitchView.tsx       ← Interactive pitch diagram for lineup editing
        │   ├── EventDialog.tsx     ← Modal for match events (injury sub, etc.)
        │   ├── TabBar.tsx          ← Bottom navigation bar
        │   └── ui.tsx              ← Shared primitives: Card, Modal, OvrBadge,
        │                              Segmented, StatBar, Spinner, etc.
        ├── domain/
        │   ├── types.ts            ← GameState, PlayerState, Lineup, Tactics, Fixture, etc.
        │   ├── rng.ts              ← makeRng(seed) → seeded Mulberry32 PRNG
        │   ├── ai/
        │   │   └── lineup.ts       ← autoPickXI(), buildSide(), isAvailable(), roleScore()
        │   ├── engine/
        │   │   ├── matchEngine.ts  ← MatchSim class + simulateMatch() + TUNING constants
        │   │   ├── ratings.ts      ← teamRatings(), tacticEffect(), conditionFactor()
        │   │   └── formations.ts   ← FORMATIONS map: formation key → 11 FormationSlot[]
        │   ├── events/
        │   │   └── eventPool.ts    ← Random narrative events (morale, press, injuries)
        │   ├── player/
        │   │   └── condition.ts    ← applyMatchOutcome(), dailyRecovery(), prepActionEffect()
        │   ├── tournament/
        │   │   ├── bracket.ts      ← buildNextRound(), buildR32(), champion(), matchWinner()
        │   │   ├── schedule.ts     ← buildGroupFixtures(), TIMELINE, teamFixture()
        │   │   └── standings.ts    ← groupStandings() — zero changes needed here
        │   └── calendar/           ← NEW (v3) — the multi-year career engine
        │       ├── calendar.types.ts     ← CalendarWindow, ScheduledMatch, QualGroup, NLGroup, etc.
        │       ├── competitionCalendar.ts ← WINDOW_DEFS[], windowStartDay/EndDay(), WC2030_QUAL_FORMATS
        │       ├── nationsLeague.ts      ← NL_2627_GROUPS (14 real groups, hardcoded from Wikipedia)
        │       ├── qualification.ts      ← drawWC2030QualGroups(), buildQualFixtures(),
        │       │                            drawCNLGroups(), buildCNLGroupFixtures(),
        │       │                            drawAFCONQualGroups(), buildAFCONQualFixtures(),
        │       │                            buildNLGroupFixtures(), buildFriendlyFixtures(),
        │       │                            buildTournamentGroupFixtures(), seedSort(),
        │       │                            distributeIntoGroups(), checkFiringAfterCompetition(),
        │       │                            calcCompetitionGrade()
        │       └── calendar.engine.ts    ← generateCareerCalendar(), simulateWindowMatches(),
        │                                    getNextUserMatch(), getNextFriendly(), etc.
        ├── screens/
        │   ├── MainMenu.tsx        ← Title screen + 3 save slots
        │   ├── NewGame.tsx         ← 4-step flow: Coach → Avatar → Team → Preview
        │   ├── TeamSelect.tsx      ← 211-team list with confederation filter
        │   ├── Home.tsx            ← Calendar Hub (main game screen)
        │   ├── MatchLive.tsx       ← Live match simulation UI
        │   ├── Tactics.tsx         ← Formation + lineup + style/press/tempo
        │   ├── Tournament.tsx      ← Competition standings/bracket view
        │   ├── Squad.tsx           ← Squad overview (all 26 players)
        │   ├── PlayerDetail.tsx    ← Individual player stats + condition
        │   ├── Summary.tsx         ← End-of-competition summary + grade
        │   └── Profile.tsx         ← Coach profile + career history
        └── store/
            └── gameStore.ts        ← Zustand store (all state + actions)
```

---

## 5. DATA ARCHITECTURE

### 5a. `app/src/data/teams.json` (THE BUNDLED FILE)

This is what the app actually loads. Built by `build_dataset.py` + `merge_avatars.py`.

**Team object**:
```jsonc
{
  "id": "ITA",                   // FIFA 3-letter trigram (primary key everywhere)
  "name": "Italy",               // Display name
  "group": "C",                  // WC 2026 group (null if not qualified)
  "confederation": "UEFA",       // UEFA | CAF | AFC | CONCACAF | CONMEBOL | OFC
  "tournaments": [               // competitions this team is relevant to
    { "id": "WC_2026", "qualified": true, "group": "C" },
    { "id": "NL_2627",  "qualified": true, "confederation_member": true },
    { "id": "EURO_2028","qualified": false,"confederation_member": true }
  ],
  "players": [ /* 26 players — see 5b */ ]
}
```

**Note**: The `teams_full.json` source also has `ranking_pts` (FIFA ranking points, used for group seeding) and `data_tier` on individual teams/players, but these may NOT be in the app bundle (verify with `build_dataset.py` output settings).

### 5b. Player object

```jsonc
{
  "id": "ita_001",              // "{team_lower}_{003-pad index}"
  "name": "Gianluigi Donnarumma",
  "number": 1,                  // jersey number
  "position": "GK",             // GK | DF | MF | FW
  "birthDate": "1999-02-25",
  "club": "Paris SG",
  "caps": 78,
  "goals": 0,
  "stats": {
    "overall": 89,
    "potential": 90,            // null for estimated players
    "pace": null,               // null for GKs and estimated
    "shooting": null,
    "passing": 55,
    "dribbling": 45,
    "defending": 18,
    "physical": 67
  },
  "gkStats": {                  // null for non-GKs
    "diving": 90, "handling": 85, "kicking": 78,
    "reflexes": 91, "speed": 52, "positioning": 88
  },
  "skillMoves": 2,              // 1–5
  "weakFoot": 3,                // 1–5
  "preferredFoot": "Right",
  "estimated": false,           // true = stats are algorithmically estimated
  "source": "FC26",             // "FC26" | "FC25" | "FC24" | "estimate"
  "avatar": {                   // derived from player photo by avatars.py
    "skinTone": 2,              // 0–7 (light→dark)
    "hairStyle": "short",       // short|buzz|curly|wavy|fade|long|bun|afro|receding|bald
    "hairColor": "black",       // black|darkbrown|brown|blonde|red|gray
    "beard": "stubble",         // none|stubble|full|mustache|goatee
    "fromPhoto": true           // was derived from a real photo (not randomly generated)
  }
}
```

### 5c. Avatar system

`app/src/components/avatarGen.ts` — pure SVG generator. Given `AvatarParams {skinTone, hairStyle, hairColor, beard, glasses?}`, returns a 64×64 SVG string representing a flat-style cartoon face. Works in both browser (React) and Node (data pipeline scripts).

- `SKIN[0..7]` — 8 skin tone hex values
- `HAIR_COLORS` — 6 hair color hex values
- Player avatars come from `avatars.py` (OpenCV face analysis) → 4 params → stored in `teams.json`
- Coach avatars are created in the NewGame 4-step flow by the user
- Fallback: if no avatar on player, `avatarGen.ts` generates one seeded from player ID

**CRITICAL**: `face_cache/*.png` and photos in `app/scripts/avatar-*.png` must NOT be committed or bundled. Only the 4 numeric/string params go in the JSON.

### 5d. Data tiers (pipeline concept, not a field in the app JSON)

The pipeline `build_dataset.py` uses 3 tiers internally:
- **Tier 1** (48 WC 2026 teams): Full FC26 stats, Wikipedia squads, FIFA API squad validation
- **Tier 2** (remaining "notable" non-WC teams, ~80): Wikipedia squads + FC25/FC24 fallback ratings
- **Tier 3** (all other 211 - covered): Estimated stats from OVR formula based on FIFA ranking and recent results

76% match rate for Tier 1 teams (948/1248 players matched from FC26), 300 estimated.

---

## 6. COMPLETED FEATURES

### ✅ Match Engine (`app/src/domain/engine/matchEngine.ts`)

`MatchSim` class — event-driven 90-minute simulation (+ ET, penalties for KO games).

**Key TUNING constants** (all in one export for calibration):
```typescript
basePerMin:      0.113   // chance probability per team-minute at equal midfields
midExp:          2.5     // midfield-share exponent
convBase:        0.095   // P(goal | chance) at equal strength
convPower:       2       // att/def ratio sensitivity
convMin/Max:     0.025/0.4
penPerChance:    0.035
penScoreBase:    0.76
injPerMin:       0.0007
yellowPerMin:    0.019
redPerMin:       0.00035
momentumMult:    1.1     // after a goal
trailingLatePush:1.28   // losing team after 70'
leadingLateShell:0.85
fatiguePerMin:   0.3
```

**Calibration results** (1000 random matches, `npx tsx scripts/calibrate.ts`):
- Target: avg 2.4–3.1 goals/match, draw rate 20–28%
- Favourite win rate by OVR gap: 0–2 OVR ≈50%, 3–5 ≈65%, 6–9 ≈77%, 10+ ≈90%

**Files**: `matchEngine.ts` (MatchSim), `ratings.ts` (teamRatings, tacticEffect, effectiveness), `formations.ts` (all formation slot definitions).

**Stats flow**: Player `stats.overall` → `makeEnginePlayer()` → `teamRatings()` (ATT/MID/DEF/GK weighted composites) → `MatchSim` chance generation. Condition factors (`form`, `morale`, `fitness`) multiply effectiveness ~0.78–1.16.

### ✅ Formation / Lineup System

`app/src/domain/engine/formations.ts` — FORMATIONS map covering standard 4-back, 3-back, 5-back variants (4-3-3, 4-4-2, 4-2-3-1, 3-5-2, 5-3-2, etc.).

`app/src/domain/ai/lineup.ts` — `autoPickXI()` (best available 11 for chosen formation), `buildSide()` (assembles MatchSim Side from game state), `isAvailable()` (respects injury + suspension), `roleScore()` (position suitability ranking).

### ✅ Player Condition System (`condition.ts`)

- **Fitness**: 0–100. Drains per match (fatiguePerMin × minutes). Recovers +14/day on rest days. Affects `conditionFactor()`.
- **Form**: 1–10, starts 6. +0.8 win / -0.8 loss. Mean-reverts toward 6 at 6% per day.
- **Morale**: 1–10, starts 7. Win +1.0, loss -1.2, draw +0.1. Bench unused -0.2.
- **Cards**: yellow accumulation → suspension after 2. Red → 1-match ban.
- **Injuries**: `injuredUntilDay = currentDay + rand(2..8)`. Sets fitness ≤ 40.
- **Prep actions**: attack/defense/setpieces (boost + drain fitness), rest (+10 fitness), talk (+0.6 morale), press (+0.2 morale).

### ✅ 211-Team Dataset

`app/src/data/teams.json` — all 211 FIFA-registered national teams. Each has 26 players.

Data sources: FIFA API squads, Wikipedia squad tables, FC26 CSV (via SoFIFA-style scrape), FC25/FC24 fallbacks, algorithmic estimation for lower-tier teams.

Top players by OVR: Salah 91, Mbappé 91, Van Dijk 90, Rodri 90, Dembélé 90, Bellingham 90, Haaland 90.

### ✅ Avatar System

`app/src/components/avatarGen.ts` → `avatarSvg(params, size)` → 64×64 SVG.
`app/src/components/Avatar.tsx` → `<Avatar params={...} size={n} />` React wrapper.
Coach avatar editable via 5 sliders in `NewGame.tsx` step 2.
Player avatar displayed in `PlayerDetail.tsx` and `MatchLive.tsx`.
`avatars.py` — OpenCV pipeline: reads `face_cache/`, crops face, classifies skin/hair/beard → writes params back to `teams_full.json`.

### ✅ Career System (Expectation + Firing)

`domain/types.ts`:
```typescript
expectationLevel(avgOvr, difficulty): 0..5
// 0=honorable (OVR<65), 1=groups, 2=R16, 3=QF, 4=SF, 5=champion
achievementLevel(eliminatedRound): 0..6
```

`qualification.ts` — `checkFiringAfterCompetition()` and `calcCompetitionGrade()` (stubs exist in the file; full implementation needed — see Section 8).

`GameState` fields: `fired`, `warningCount`, `trophyPass`, `competitionHistory: CompetitionResult[]`.

### ✅ Save / Load (3 slots)

`gameStore.ts` — `saveToSlot(n)`, `loadFromSlot(n)`, `listSlots()`, `deleteSlot(n)`.
Storage: `@capacitor/preferences` (key `save_N`). Also stores slot metadata (team, coach name, day, timestamp) at `save_N_meta`.
**SAVE_VERSION = 3** (bumped when career calendar added). `migrate()` resets old saves.

### ✅ Main Menu + New Game Flow

`MainMenu.tsx` — Title screen, 3 save slot cards (shows coach name + team + date).
`NewGame.tsx` — 4 steps:
1. Coach name + nationality
2. Avatar editor (skin/hair/beard/glasses sliders)
3. Team selection (→ TeamSelect.tsx, confederation filter)
4. Career preview (schedule + expectation level + difficulty)
→ Calls `initCareer()` on confirm.

### ✅ Flags (All 211 Teams)

`app/src/components/Flag.tsx` — `FIFA_TO_ISO` map (211 entries) + Vite glob import of all SVGs from `src/assets/flags/`.
SVGs sourced from `circle-flags` npm package and copied to assets folder.
UK home nations: `gb-eng`, `gb-sct`, `gb-wls`, `gb-nir` (non-ISO2, supported by circle-flags).
Fallback: 3-letter text badge if no SVG found.

### ✅ Calendar System — Full Career Calendar (v3)

See Section 13 for full details. Summary:
- `generateCareerCalendar(teamCode, allTeams)` called once by `initCareer()`
- Returns `{ windows, schedule, qualGroups, nlGroups }`
- All 211 teams get a correct schedule: WC teams play WC → confederation competition → summer 2027 → WC 2030 qual
- Non-WC teams play pre-season friendlies → confederation competition → summer 2027 → WC 2030 qual
- Confederations all covered: UEFA NL, CONCACAF NL, AFCON qual, OFC NC, CONMEBOL/AFC friendlies

### ✅ Nations League 2026-27 (real groups)

`nationsLeague.ts` — 14 real groups hardcoded from Wikipedia:
- League A: 4 groups × 4 teams (FRA/ITA/BEL/TUR, GER/NED/SRB/GRE, ESP/CRO/ENG/CZE, POR/DEN/NOR/WAL)
- League B: 4 groups × 4 teams
- League C: 4 groups × 4 teams
- League D: 2 groups × 3 teams (GIB/MLT/LIE, AZE/LTU/AND)

### ✅ Home Screen — Calendar Hub

`Home.tsx` — shows next match, upcoming 3 matches, current group standings, world news ticker, prep actions. Detects career mode (`g.schedule.length > 0`) vs legacy mode.

### ✅ Bilingual (TR/EN)

All strings in `i18n/en.json` and `i18n/tr.json`. Language toggle persists in GameState.

### ✅ Android APK Build

Working via `npm run apk`. Package ID `com.abaki.wc26manager`.

---

## 7. IN PROGRESS / PARTIALLY DONE

### Tactics Screen (basic version exists, expansion needed)

`Tactics.tsx` currently has:
- Formation picker (grouped by back line: 4/3/5 defenders)
- Pitch view (drag-and-drop lineup) and List view
- Style toggle: defensive / balanced / attacking
- Press toggle: low / mid / high
- Tempo toggle: slow / normal / fast
- Autopick button (auto-fills best XI)
- Ratings bar (ATT/MID/DEF/GK)
- **✅ Captain & Vice-Captain selection** (gold C / silver VC badges, squad picker with search, bonus note)
- **✅ Set piece taker designations** (corner, free kick, penalty, long throw)
- **✅ Opposition instructions** (man-to-man: tight / normal / space)
- **✅ Tactical presets** (3 save slots)
- **✅ Mentality / sliders panel**

**MISSING** (not yet implemented):
- Pre-match briefing / opposition scouting view (prompt exists in 10A)
- In-match tactical adjustments (currently only sub window)

### Firing / Expectations

`checkFiringAfterCompetition()` and `calcCompetitionGrade()` exist in `qualification.ts` but are not fully wired to gameStore. The `resolveQualification(windowId)` action exists in gameStore but needs to compute grades, check firing, update `wcQualState` / `euroQualState`, and call `checkFiringAfterCompetition()`.

### CNL Knockout / Promotion-Relegation

The CONCACAF Nations League group stage is generated (Sep–Nov 2026). The promotion/relegation playoff and League A finals (Mar 2027 window) are NOT generated. The `NL_2627_KO` and `NL_2627_FINALS` windows are defined but only populated for UEFA.

### `skipFriendly()` Action

`skipFriendly(matchId)` is declared in gameStore Actions interface but the implementation is a stub. Should mark friendly simulated=true without result, advance date, and give fitness recovery bonus.

### World News Generator

`simulateWindowMatches()` in `calendar.engine.ts` exists and returns `string[]` world news, but the quality is basic. A proper generator would pick top-5 notable results (upsets, high scores, clinching qualification).

### EURO 2028 Qualification

EURO 2028 is defined as a WINDOW_DEF and present in the calendar. However, the EURO 2028 qualification pathway (Sep 2027 – Mar 2028 UEFA qual groups) is NOT implemented — UEFA teams currently go straight from NL 2026-27 → WC 2030 Qual → EURO 2028. Need separate EURO_2028_QUAL window and qual group draw.

---

## 8. NOT YET STARTED (priority order)

1. **Tactics expansion** — player roles (CDM/CM/CAM distinction), set piece takers, opposition instructions (see Section 10A for full prompt)
2. **EURO 2028 qualification** — Sep–Nov 2027 UEFA qual groups (12 groups, qualifying top 2 + best 3rd → finals)
3. **CNL KO stage** — CONCACAF Nations League promotion/relegation playoffs (Mar 2027)
4. **`resolveQualification()` full implementation** — wiring grade calculation + firing check + state updates
5. **World news generator improvement** — better narrative, upset detection, milestone announcements
6. **NL Finals bracket** — UEFA NL Finals KO matches (Jun 2027, 4 teams)
7. **Bundle size optimization** — main JS chunk is ~2.6 MB; teams.json alone is ~1.5 MB. Should be dynamic imported.
8. **Play Store release prep** — release signing key, icon/splash assets, package name finalization, store listing
9. **Sound effects** — match events, crowd noise (currently muted; `music`/`sfx` booleans in GameState but no audio loaded)
10. **AFC Asian Cup 2027 qualification** — currently AFC teams just get FRIENDLY_SEP_2026; real AFC 3rd round qual needs implementation
11. **In-match tactical adjustments** — changing formation/style during MatchLive
12. **Press conference events** — more varied event pool for press/morale narratives

---

## 9. KNOWN BUGS

| Bug | File | Likely fix |
|-----|------|-----------|
| `qualGroups` overwrite: WC2030 qual draw used assignment (`=`) instead of `.push()`, erasing AFCON qual groups | `calendar.engine.ts` line ~180 | Fixed in last session; verify `.push(...wc2030Groups)` is in place |
| UEFA SUMMER_2027 match added to schedule without window | `calendar.engine.ts` | Fixed in last session; verify `windows.push(makeWindow('SUMMER_2027', ...))` is present |
| `findNLGroup` and `windowEndDay` still imported but unused after refactor | `calendar.engine.ts` | Remove unused imports (causes TS warning, not error) |
| `scheduleMatch.round` type: calendar matches use `NL_MD1`, `QUAL_MD1` etc. which are not in the `Round` union | `domain/types.ts` | Extend Round type or cast as `string` in calendar matches |
| `groupStandings()` receives `ScheduledMatch[]` cast as `Fixture[]` in Home.tsx | `Home.tsx` line ~50 | `groupStandings` should accept both types or ScheduledMatch should extend Fixture |
| Injury recovery `randInt(rng, 2, 8)` uses career match day index, not calendar date — may be inconsistent in career mode | `condition.ts` line ~70 | Verify `o.day` is career day (it is; fine as-is) |
| Copa América 2027 group draw uses top-N by OVR instead of qualification results | `calendar.engine.ts` | After AFCON/Copa qual implemented, filter by `qualified=true` in tournaments[] |

---

## 10. PENDING PROMPTS

### 10A. TACTICS EXPANSION PROMPT (full text — ready to send)

```
TASK: Expand the Tactics screen with the following additions.
Do NOT break existing formation picker, pitch view, or style/press/tempo toggles.
All new features go BELOW the existing cards in Tactics.tsx.

CRITICAL CONSTRAINT: Photos must not be embedded. Only derived avatar params.

## A) PLAYER ROLES (within formation slot)

Each formation slot has a `role: Position` (GK/DF/MF/FW). 
Add a sub-role system for MF and FW slots:

MF sub-roles: 'CDM' | 'CM' | 'CAM' | 'WM' (wide midfielder)
FW sub-roles: 'CF' | 'SS' | 'WF' (centre-forward, second striker, wide forward)
DF sub-roles: 'CB' | 'LB' | 'RB' | 'LWB' | 'RWB'

Store as: `lineup.roles: (string | null)[]` — one per slot, parallel to `starters`.
Add to GameState in domain/types.ts and persist in gameStore.

Display: next to each player name in list view and as a small badge on pitch chip.
Tap slot in list view → player picker → second step: role picker for that slot.

Effect on engine: `ratings.ts` already uses slotRole. 
Sub-roles refine `positionPenalty()`:
  - CDM playing CM: 0.97 (minor penalty), CDM playing CAM: 0.88
  - CM playing CDM: 0.98, CM playing CAM: 0.95
  - WF playing CF: 0.92, CF playing WF: 0.90
  - CB playing as fullback: 0.90, fullback playing CB: 0.93

These multipliers are applied INSIDE `positionPenalty()`, using the sub-role
instead of the broad Position when both are provided.

## B) SET PIECE TAKERS

Add a card: "Set Pieces" with 3 pickers:
  - Corner taker (default: highest passing MF/FW)
  - Free kick taker (default: highest shooting FW, then MF)
  - Penalty taker (default: highest shooting FW)

Store as `lineup.setpieces: { corner: string|null, freekick: string|null, penalty: string|null }`.
Add to Lineup interface in domain/types.ts.

In MatchSim (`matchEngine.ts`): when a pen_goal/pen_miss event fires, 
use the penalty taker's stats.shooting (instead of a random FW) 
— multiply `penScoreBase` by (shooter.shooting / avgTeamShooting).

## C) OPPOSITION INSTRUCTIONS

Add a card: "Opposition" (shown only when a next match is available, 
so pass nextOpponentId as prop or read from gameStore).

Shows the opponent's top 3 players by overall (from TEAMS data).
For each, a toggle: "Mark tightly" | "Normal" | "Give space"
Store as `tactics.oppositionInstructions: Record<string, 'tight'|'normal'|'space'>`.

Engine effect (apply in ratings.ts `tacticEffect()` or in matchEngine.ts):
  - tight: that player's effective OVR reduced by 8% (but our MF tracking
    that player fatigue +30% faster)
  - space: that player gets +5% OVR but our fatigue normal

## D) PRE-MATCH SCOUTING PANEL

Before the user starts MatchLive, show a "Scout Report" modal in Home.tsx
(not in Tactics.tsx — this is Home.tsx territory):
  - Opponent's last 3 results (from g.schedule, already simulated)
  - Opponent's avg OVR and top 3 players
  - Your form vs opponent's form (simple bar comparison)
  - Recommended tactics hint (e.g. "They press high — use slow tempo")

This is a read-only display. No new state needed.

## IMPLEMENTATION ORDER:
1. Add sub-roles to Lineup + GameState types
2. Update Tactics.tsx list view + pitch chip to show sub-role badge  
3. Add role picker step in PlayerPicker modal
4. Update positionPenalty() for sub-roles
5. Add set piece takers to Lineup interface + Tactics.tsx card
6. Wire penalty taker into matchEngine.ts penScoreBase calculation
7. Add opposition instructions to Tactics interface + Tactics.tsx card
8. Wire opposition instructions into matchEngine.ts
9. Add Scout Report modal to Home.tsx (triggered by "Prepare →" button)

After implementation: npx tsc --noEmit && npx vite build
```

### 10B. CALENDAR FIX PROMPT (COMPLETED)

This was executed in the previous session. All 211 teams now have correct Sep–Nov 2026 competition assignments. No action needed.

---

## 11. MATCH ENGINE DETAILS

**File**: `app/src/domain/engine/matchEngine.ts`

The `MatchSim` class runs a minute-by-minute simulation:

1. Each minute: compute chance probability for each team based on midfield share
   - Chance prob = `basePerMin × (midShare^midExp)`
   - If chance occurs → roll `convBase × (att/def)^convPower` for goal
   - Penalty check: `penPerChance` chance → `penScoreBase × (shooterOvr/avgOvr)` success
2. Momentum: after goal, scorer's team gets `momentumMult` for next `momentumMins` minutes
3. Late game: trailing team gets `trailingLatePush` (×1.28) after 70', leader gets shell (`leadingLateShell` ×0.85)
4. Fatigue: each player's fitness drops `fatiguePerMin × 0.3` per minute
5. Cards: yellow (`yellowPerMin`), red (`redPerMin`) — applied to random field player
6. Injuries: `injPerMin` per player in XI
7. HT substitution window (user): up to 3 subs total
8. ET: if knockout and level after 90', 2×15 min ET
9. Penalties: alternating kicks, stops when winner determined

**Tactics wiring** (current): `tacticEffect(tactics)` returns `{attMult, defMult, chanceMult, oppMidMult, fatigueMult}`. These multiply the relevant stats before chance calculation. Works but is simple — no sub-role granularity yet.

**Injury system**: `injuredUntilDay = currentDay + rand(2..8)`. Check: `isAvailable(p, states, day)` returns false if `states[p.id].injuredUntilDay > day`.

**Morale system**: Win +1.0, draw +0.1, loss -1.2 for starters. Bench unused −0.2 (prevents happy reserves). Scorer +0.5 extra. Form tracks individual, morale tracks individual.

**Calibration script**: `app/scripts/calibrate.ts` — 1000 random matches + 20 full WC tournaments. Run: `cd app && npx tsx scripts/calibrate.ts`.

---

## 12. CAREER SYSTEM DETAILS

**Expectation bands** (`domain/types.ts`):
```typescript
expectationLevel(avgOvr, difficulty):
  OVR ≥ 85 → 5 (champion expected)
  OVR ≥ 80 → 4 (finalist)
  OVR ≥ 75 → 3 (semifinal)
  OVR ≥ 70 → 2 (quarterfinal)
  OVR ≥ 65 → 1 (group stage exit OK)
  OVR < 65 → 0 (honorable mention)
  + hard mode: +1 to all
```

**Firing conditions** (partially implemented in `qualification.ts`):
- `calcCompetitionGrade(achieved, expected)` → 'A'..'F'
- `checkFiringAfterCompetition(result, rank, history, difficulty, trophyPass)` → 'fired'|'warned'|'free_pass_used'|'ok'
- Rules: trophy win → sets `trophyPass` (1 free pass); rank 1–5 + WC qual failure → fired (unless trophyPass); 2× consecutive D/F → warned; 3× → fired
- Hard mode: rank 1–10 fires on qual failure

**Career history** (`CareerEntry[]`): stores tournament, team, coach, round, grade, fired flag.

**Profile screen** (`Profile.tsx`): shows career history table + achievements.

---

## 13. CALENDAR SYSTEM DETAILS

**CAREER_EPOCH**: Day 0 = June 11, 2026. All `ScheduledMatch.day` values are offsets in days from this date.

`dateToCareerDay({ year, month, day })` converts a real date to career day offset.
`careerDayToDate(n)` is the reverse.

**CalendarWindow** type:
```typescript
{
  id: string           // 'NL_2627_GROUP', 'WC2030_QUAL', etc.
  type: 'wc'|'tournament'|'nations_league'|'qual'|'friendly'
  competition: string  // display label
  dateStart: GameDate
  dateEnd: GameDate
  userParticipates: boolean   // false = world simulation only
  teamsInvolved: string[]
}
```

**Window ordering** (for all teams, in time order):
```
Jun 2026:         WC_2026 (WC teams) or FRIENDLY_JUN_2026 (non-WC)
Sep–Nov 2026:     NL_2627_GROUP (UEFA) | CNL_2627_GROUP (CONCACAF) |
                  AFCON_QUAL_2627 (CAF) | OFC_NC_2026 (OFC) |
                  FRIENDLY_SEP_2026 (CONMEBOL/AFC)
Dec 2026:         FRIENDLY_DEC_2026 (non-UEFA gap filler)
Mar 2027:         NL_2627_KO (UEFA)
Jun 2027:         NL_2627_FINALS (UEFA) | AFCON_QUAL_2627 continued (CAF)
Jun–Jul 2027:     SUMMER_2027 (AFCON_2027/ASIAN_CUP/GOLD_CUP/COPA_2027/OFC_2027)
Sep 2027–Mar 2029:WC2030_QUAL (all confederations)
Jun–Jul 2028:     EURO_2028 (UEFA)
Jun–Jul 2030:     WC_2030
```

**NL groups**: Stored in `GameState.nlGroups` (reuses `NLGroup` type with league: 'A'|'B'|'C'|'D').
UEFA NL groups are hardcoded. CONCACAF NL groups are procedurally drawn by `drawCNLGroups()` at career start.

**`generateCareerCalendar()` flow**:
1. Check if team is WC 2026 qualified → window 1
2. Generate UEFA NL fixtures (always, for world simulation) → add NL window if user is UEFA
3. Draw CONCACAF NL groups → generate CNL fixtures → add CNL window if user is CONCACAF
4. Draw AFCON qual groups → generate AFCON qual fixtures → add AFCON_QUAL window if user is CAF
5. Build OFC NC groups → generate OFC NC fixtures → add OFC_NC window if user is OFC
6. Add FRIENDLY_SEP_2026 if user is CONMEBOL or AFC
7. Add FRIENDLY_DEC_2026 for all non-UEFA teams
8. SUMMER_2027: build continental tournament group fixtures for all confederations
9. WC 2030 qual: draw groups per confederation → build fixtures → all teams get WC2030_QUAL window
10. UEFA gets EURO_2028; all get WC_2030

**Simulating world matches**: `simulateWindowMatches(windowId, schedule, allTeams, playerStates, seed)` iterates all non-user matches in the window, calls `simulateMatch()`, marks `simulated=true`, returns world news strings.

**AFCON qual dates** (hardcoded in `qualification.ts`):
Oct 2, Oct 5, Nov 13, Nov 16, 2026 → Mar 25, Mar 28, Jun 2, Jun 5, 2027

**WC 2030 qual dates** (hardcoded in `qualification.ts`):
Sep 4, Oct 9, Nov 13, 2027 → Mar 21, Jun 6, Sep 6, Oct 11, Nov 15, 2028 → Mar 21, 2029

---

## 14. HOW TO RUN

```bash
# Browser dev server
cd app
npm run dev               # runs Vite dev server on http://localhost:5173

# Type check only
npx tsc --noEmit

# Production build
npx vite build

# Debug Android APK (requires JDK 17 + Android SDK)
npm run apk               # build → cap sync → gradlew assembleDebug
# Output: android/app/build/outputs/apk/debug/app-debug.apk

# Match engine calibration
npx tsx scripts/calibrate.ts

# Automated playthrough test
npx tsx scripts/playthrough.ts

# Data pipeline (rebuild teams.json from source)
cd ..   # project root
python build_dataset.py           # builds teams_full.json from API cache
python merge_avatars.py           # merges avatar params → teams_full.json
python validate_full.py           # validates all 211 teams
# Then copy teams_full.json → app/src/data/teams.json manually

# Avatar extraction (requires OpenCV, face photos in face_cache/)
python avatars.py
```

---

## 15. ANDROID BUILD STATUS

- **Capacitor version**: 8.4.0 (latest as of Jun 2026)
- **JDK requirement**: JDK 17 (JDK 21 also works)
- **Package ID**: `com.abaki.wc26manager`
- **App name**: `WC26 Manager`
- **Background color**: `#0e1116` (dark)
- **Known Android issues**: None known beyond standard Capacitor web-to-native quirks
- **Bundle size concern**: Main JS chunk is ~2.6 MB (teams.json ~1.5 MB inline). Should be split via dynamic import before release. Not blocking for debug APK.
- **Last successful build**: Debug APK, all 211 teams, SAVE_VERSION 3

---

## 16. HANDOFF NOTES FOR NEXT AGENT

### Current state
Everything compiles clean: `npx tsc --noEmit` → 0 errors, `npx vite build` → success (315 modules). Career calendar works for all 6 confederations. All 5 validation teams (BVI, Nigeria, Italy, New Zealand, Bolivia) have correct competition schedules with no empty windows.

### What to tackle first
1. **Tactics expansion** (see Section 10A for full prompt — it is complete and ready to paste)
2. `resolveQualification()` full wiring (grade calculation + firing check)
3. EURO 2028 qualification pathway
4. Bundle size optimization (dynamic import for teams.json)

### What NOT to break
- `matchEngine.ts`, `ratings.ts`, `bracket.ts`, `standings.ts`, `condition.ts` — these are competition-agnostic and working. Do not refactor them.
- `generateCareerCalendar()` — complex, working. Only add to it, don't restructure.
- `teams.json` structure — `build_dataset.py` regenerates it. Don't manually edit the bundle.
- The avatar constraint: **NEVER embed photos**. Only `{skinTone, hairStyle, hairColor, beard}` in JSON.
- SAVE_VERSION is 3. If you change `GameState` shape, bump to 4 and reset `migrate()`.

### Vision reminder
This should feel like **Football Manager but for national teams, mobile-first, text-based deep sim**. Every match should feel meaningful because the calendar is real and the stakes (qualifying for WC 2030, not getting fired, EURO 2028) are real. Resist the urge to add 3D or graphics. The flat-style avatar system and text-based match events are intentional design choices.

### Development rhythm
- Work in `app/src/` only (never edit `teams.json` by hand for data changes)
- After any significant change: `npx tsc --noEmit && npx vite build`
- After calendar changes: also run the validate_schedule script or check BVI/Nigeria/Italy/NZL/Bolivia schedules manually
- The todo list in Claude's session will be stale — use this document instead
