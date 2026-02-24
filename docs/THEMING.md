# Backyamon Theming Guide

Backyamon wraps standard backgammon in a Rastafarian island aesthetic -- reggae music, dub sound system culture, and Caribbean visuals.

## Color Palette

| Name | Hex | Usage |
|---|---|---|
| Rasta Green | `#006B3F` | Board points (alternating), UI accents, "legal move" highlights |
| Rasta Gold | `#FFD700` | Board points (alternating), Gold player pieces, win celebrations |
| Rasta Red | `#CE1126` | Red player pieces, alerts, dramatic moments |
| Dark Background | `#1A1A0E` | Page background, PixiJS canvas background |
| Sand | `#F4E1C1` | Text on dark backgrounds, subtle UI elements |
| Ocean Blue | `#0077BE` | Background accents, wave animations |
| Wood | `#8B4513` | Board frame |
| Bamboo | `#D4A857` | Board frame accents |

Defined in `apps/web/src/lib/theme.ts`.

## Element Mapping

| Traditional Backgammon | Backyamon | Visual Description |
|---|---|---|
| Board | Board | Carved wood/bamboo frame, beach scene background |
| Points (triangles) | Points | Alternating green and gold triangles |
| Bar (middle divider) | **Babylon** | Dark concrete/urban aesthetic contrasting the island vibes |
| Home tray (bearing off area) | **Zion** | Golden glow, lush greenery |
| Checkers | Pieces | Lion heads (Gold vs Red), with unlockable sets |
| Dice | Sound System Speakers | Styled as small speaker boxes |
| Doubles | **BOOMSHOT!** | Flash effect with text on doubles |
| Doubling cube | **Turn It Up** | Amplifier dial / knob |
| Move timer | Burning Incense | Incense stick that burns down |
| Single win | **Ya Mon** (1x) | -- |
| Gammon | **Big Ya Mon** (2x) | -- |
| Backgammon | **MASSIVE Ya Mon** (3x) | -- |
| Player avatars | DJ / Soundsystem Portraits | Character portraits in reggae style |
| Menus | Street Signs | Hand-painted Jamaican street sign aesthetic |
| Chat phrases | Preset Patois | "Ya mon!", "Irie!", "Respect!", "Wha gwaan?" |

## Audio Design

### Reactive Stem Layering

Music is built from stems (audio loops at the same BPM and key) that fade in and out based on game state. Managed by `SoundManager` in `apps/web/src/audio/SoundManager.ts` using Howler.js.

**Stems:**

| Stem | Content | When Active |
|---|---|---|
| Base | Kick, snare, hi-hat (chill dub/reggae rhythm) | Always playing |
| Melodic | Skank guitar, keys | Normal play, even game |
| Bass | Deep bass line, intensified rhythm | Competitive moments: pieces on bar, bear-off race |
| Dub FX | Echo, reverb hits, siren stabs | Key moments: captures, doubles, dramatic turns |
| Victory Riddim | Full track | Win screen |

**State-driven transitions:**

| Game State | Active Stems |
|---|---|
| Chill / even game | Base + Melodic |
| Opponent has pieces on bar | Base + Melodic + Bass |
| Bear-off race (both players bearing off) | Base + Bass (percussion intensifies) |
| Doubling cube offered | Dub FX layer (dramatic siren / air horn) |
| Game over (win) | Victory Riddim (full track) |
| Game over (loss) | Somber fade-out |

### Sound Effects

| Trigger | Sound |
|---|---|
| Dice roll | Snare drum hit |
| Piece placed on point | Bass note (pitch varies by board position) |
| Piece captured (hit) | Deep 808 boom + echo |
| Enter from Babylon (bar) | Rising reverb whoosh |
| Bear off into Zion | Wave crash + steel drum ting |
| Good move | "Ya Mon!" voice clip |
| Risky blot left | Crowd "ohhh!" |

### Audio Assets

- 4-5 music stems (royalty-free reggae loops or custom produced, synced to same BPM/key)
- ~15 sound effects
- ~5 voice clips

## Visual Design

### Board

- **Frame**: Carved wood/bamboo rectangle with a visible border
- **Points**: 24 alternating green (`#006B3F`) and gold (`#FFD700`) triangles
- **Background**: Beach scene with palm trees, subtle animated waves (sine-wave displacement)
- **Babylon (bar)**: Dark, urban-textured center divider
- **Zion (home tray)**: Golden gradient with subtle glow and greenery accents

### Pieces

- **Default set**: Small lion heads, Gold vs Red colored
- **Unlockable sets** (post-MVP): Coconuts, vinyl records, gold coins, conch shells, drums
- **Idle animation**: Gentle floating bob (sine wave on Y, ~2px amplitude)
- **Move animation**: Smooth ease-out slide with subtle motion trail
- **Hit animation**: Piece gets "pulled" to Babylon with a bounce and bass rumble SFX
- **Bear off animation**: Piece catches a wave and surfs off-screen into Zion
- **Stacking**: Max 5 pieces drawn per point; overflow shows a count number

### Dice

- Styled as sound system speaker boxes
- **Roll animation**: Tumble (rotate + bounce) for ~1 second before landing
- **Doubles**: "BOOMSHOT!" flash effect (text scales up and fades out)
- Used dice are grayed out

### Win/Loss Animations

| Win Type | Animation |
|---|---|
| Ya Mon | Gold particle explosion + "YA MON!" text |
| Big Ya Mon | Larger explosion + lion roar audio cue |
| MASSIVE Ya Mon | Full-screen takeover: dark-to-gold transition, particles, dramatic text |
| Loss (gammon) | Rain clouds roll in over the board |

### UI Chrome

- **Turn It Up dial**: Visual amplifier knob showing current doubling cube value
- **Move timer (multiplayer)**: Burning incense stick
- **Player avatars**: DJ/soundsystem character portraits
- **Menus**: Hand-painted Jamaican street sign aesthetic
- **Button hovers**: Glow in Rasta colors
- **Title text**: Animated with subtle reggae bounce

## AI Characters

Three AI opponents, each with a distinct personality and play style:

| Name | Difficulty | Personality | Play Style |
|---|---|---|---|
| **Beach Bum** | Easy | Laid-back, chill, no rush | Random legal moves. Never doubles aggressively. Good for learning. |
| **Selector** | Medium | Focused, musical, methodical | Weighted heuristic: prioritizes making points (+10), avoids blots (-15), values home board presence (+5), penalizes bar (-20). Evaluates all legal turns, picks highest score. |
| **King Tubby** | Hard | Intense, legendary, calculating | Minimax with alpha-beta pruning, 3 moves deep. Uses Selector's evaluation at leaf nodes. Considers opponent's best response. Prunes losing branches. |

AI runs client-side with an artificial thinking delay of 0.5-2 seconds for natural pacing.

## Preset Chat Phrases (Multiplayer)

No free-text chat. Players choose from themed preset phrases:

- "Ya mon!" / "Irie!" / "Respect!" / "Big up!"
- "No way!" / "Wha gwaan?" / "Easy nuh!"
- "Good game!" / "One more?"

## Phased Rollout Names

Each release version has a themed name from Jamaican music culture:

| Version | Name | Focus |
|---|---|---|
| v1.0 | **First Riddim** | MVP: full rules engine, AI, online multiplayer, reactive soundtrack, core SFX |
| v1.1 | **Sound System** | Local pass-and-play, user accounts, match history, extra cosmetics, preset chat, mobile layout |
| v1.2 | **Selector's Choice** | Ranked ELO matchmaking, leaderboards, XP progression, unlockable cosmetics, more stems |
| v1.3 | **Road to Zion** | Story mode, friend lists, spectator mode, tournament brackets |

## Cosmetic Progression (Post-MVP)

- XP earned per game (win or lose; more for wins)
- Levels unlock cosmetics: board skins, piece sets, riddims (music), avatars
- Purely cosmetic -- no pay-to-win mechanics
