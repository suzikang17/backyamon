# Backyamon - Game Design Document

**Date:** 2026-02-23
**Status:** Approved

## Overview

Backyamon ("Ya Mon!") is a web-based backgammon game with full Rastafarian cultural theming. It features a reactive reggae soundtrack, rich 2D animations, online multiplayer, AI opponents, and a cosmetic progression system. Free to play, passion project.

## Architecture

Three-layer architecture:

```
┌─────────────────────────────────────────┐
│           Next.js App Shell             │
│  (lobby, auth, profiles, menus, chat)   │
├─────────────────────────────────────────┤
│         PixiJS Game Canvas              │
│  (board, pieces, dice, animations,      │
│   drag-and-drop, visual effects)        │
├─────────────────────────────────────────┤
│          Game Engine Layer              │
│  (backgammon rules, AI, game state)     │
└──────────┬──────────────────────────────┘
           │
     Socket.io / WebSocket
           │
┌──────────┴──────────────────────────────┐
│          Node.js Server                 │
│  (matchmaking, game rooms, state sync,  │
│   leaderboards, persistence)            │
└─────────────────────────────────────────┘
```

**Key principle:** The game logic is a pure TypeScript module (`@backyamon/engine`) shared between client and server. This enables:
- Client-side AI (no server needed for single-player)
- Server-side move validation (prevents cheating in multiplayer)
- Offline play after initial page load (PWA-style asset caching)

### Tech Stack

- **Next.js 14+** (App Router) - web shell, auth, API routes
- **PixiJS 8** - lightweight 2D renderer for the game board
- **Howler.js** - audio engine for reactive soundtrack + sound effects
- **Socket.io** - real-time multiplayer communication
- **SQLite via Drizzle ORM** (Postgres later) - persistence for accounts, leaderboards, match history

## Game Logic & Rules Engine

Pure TypeScript module with no UI dependencies.

### Core Types

- `GameState` - full board state: 24 points, bar, bear-off trays, current player, dice, doubling cube value
- `Move` - a single piece movement (from -> to)
- `Turn` - a set of moves for one roll (must use all dice when possible)
- `GamePhase` - `ROLLING` -> `MOVING` -> `CHECKING_WIN` -> `GAME_OVER`

### Key Functions

- `getLegalMoves(state, dice)` - returns all valid moves for a roll
- `applyMove(state, move)` - returns new state (immutable)
- `evaluateBoard(state)` - heuristic scoring for AI
- `checkWinner(state)` - detects win type (Ya Mon, Big Ya Mon, Massive Ya Mon)

### Rules Coverage

- Forced moves (must use both dice if possible, higher die if only one works)
- Hitting and entering from the bar (Babylon)
- Bearing off rules
- Doubling cube ("Turn It Up" knob)
- Crawford rule for match play

### Scoring

| Traditional     | Backyamon Name    | Multiplier |
|-----------------|-------------------|------------|
| Single win      | Ya Mon            | 1x         |
| Gammon          | Big Ya Mon        | 2x         |
| Backgammon      | MASSIVE Ya Mon    | 3x         |

Doubling cube ("Turn It Up") multiplies the stake: 1, 2, 4, 8, etc.
Match play to a set number of points with Crawford rule enforced.

### AI Opponents (3 tiers)

- **Beach Bum** (easy) - picks random legal moves
- **Selector** (medium) - weighted heuristic: prioritizes making points, avoids blots
- **King Tubby** (hard) - minimax with alpha-beta pruning, ~3 moves deep

AI runs client-side with artificial 0.5-2s thinking delay.

## Visual Design & Theming

### Color Palette

- Primary: Rasta green `#006B3F`, gold `#FFD700`, red `#CE1126`
- Background: Deep black/dark brown `#1A1A0E`
- Accents: Sand `#F4E1C1`, ocean blue `#0077BE`

### Board Design

- Board frame: carved wood / bamboo aesthetic
- Points alternate between green and gold
- Background scene: beach with palm trees, subtle animated waves
- Bar (middle) = "Babylon" - city/concrete aesthetic contrasting the island vibes
- Home trays = "Zion" - golden glow, lush greenery

### Pieces

- Default set: small lion heads (gold vs red)
- Unlockable sets: coconuts, vinyl records, gold coins, conch shells, drums
- Subtle idle bob animation
- Hit animation: piece gets "pulled" to Babylon with a bass rumble

### Dice

- Styled as sound system speaker boxes
- Roll animation with reggae drum hit on landing
- Doubles get a "BOOMSHOT!" flash effect

### UI Elements

- "Turn It Up" doubling knob: amplifier dial
- Move timer (multiplayer): burning incense stick
- Player avatars: DJ/soundsystem character portraits
- Menus: hand-painted Jamaican street sign aesthetic

### Animations

- Piece movement: smooth ease-out slide with subtle trail
- Bearing off: piece catches a wave and surfs off-screen into Zion
- Winning: full-screen celebration - lion roar, gold particles, "YA MON!" text
- Getting gammoned: rain clouds roll in over the board

## Audio & Soundtrack

### Reactive Layered Music

Music is built from stems that layer in/out based on game state:

- **Base layer** (always playing): chill dub/reggae rhythm (kick, snare, hi-hat)
- **Melodic layer** (normal play): skank guitar, keys
- **Bass layer** (competitive moments): intensifies when pieces on bar, racing to bear off
- **Dub FX layer** (key moments): echo/reverb hits on captures, doubles
- **Victory riddim**: full track kicks in on win

### State-Driven Transitions

- Chill / even game -> base + melodic (laid back)
- Opponent on the bar -> bass layer kicks in
- Bear-off race -> percussion intensifies
- Doubling offered -> dramatic dub siren / air horn stab
- Game over -> full victory riddim or somber fade-out

### Sound Effects

- Dice roll -> snare drum hit
- Piece placed -> bass note (pitch varies by board position)
- Piece captured -> deep 808 boom + echo
- Enter from Babylon -> rising reverb whoosh
- Bear off -> wave crash + steel drum ting
- "Ya Mon!" voice clip on good moves
- Crowd "ohhh!" on risky blots

### Implementation

- Howler.js manages audio sprites and stem layering
- Stems are pre-produced audio loops synced to same BPM/key
- `SoundManager` class watches game state and crossfades layers
- Volume/mute controls in settings

### Audio Assets Needed

- ~4-5 music stems (royalty-free reggae loops or custom)
- ~15 sound effects
- ~5 voice clips

## Multiplayer & Infrastructure

### Three Play Modes

**Local (pass-and-play):**
- Engine + renderer only, board flips between turns
- No server needed, works offline

**vs AI:**
- Engine runs client-side
- No server needed, works offline (PWA-cached assets)

**Online multiplayer:**
- Socket.io rooms (1 room per game, 2 players)
- Server holds authoritative game state, validates all moves
- Client sends intended moves, server confirms or rejects
- Opponent sees animated moves in real-time

### Server Architecture (Node.js)

- **Auth:** email/password or guest accounts
- **Matchmaking:** quick match (ELO-based), private room (invite link), ranked match
- **Game Rooms (Socket.io):** state sync, move validation, turn timer, disconnect handling (30s reconnect)
- **Persistence (SQLite -> Postgres):** user accounts, match history, ELO ratings, unlocked cosmetics
- **Chat:** preset phrases only (fun and safe)

### Preset Chat Phrases

- "Ya mon!" / "Irie!" / "Respect!" / "Big up!"
- "No way!" / "Wha gwaan?" / "Easy nuh!"
- "Good game!" / "One more?"

### Progression System (post-MVP)

- XP earned per game (win or lose, more for wins)
- Levels unlock cosmetics: board skins, piece sets, riddims, avatars
- Purely cosmetic, no pay-to-win

## MVP & Phased Rollout

### v1.0 - "First Riddim" (MVP)

- Full backgammon rules engine
- Themed board, one piece set (lion heads), dice
- vs AI (all 3 difficulties)
- Online multiplayer (quick match + invite links)
- Reactive layered soundtrack (base + 2-3 stems)
- Core sound effects (~10)
- Guest accounts (play immediately, no sign-up friction)
- Basic responsive layout (desktop + tablet)

### v1.1 - "Sound System"

- Local pass-and-play
- User accounts with profiles
- Match history
- 2-3 additional piece sets & 1 alternate board skin
- Preset chat phrases
- Mobile-optimized layout

### v1.2 - "Selector's Choice"

- Ranked matchmaking with ELO
- Leaderboards
- XP progression system
- More unlockable cosmetics (boards, pieces, riddims)
- Additional music stems

### v1.3 - "Road to Zion" (stretch)

- Story mode - journey through themed opponents
- Friend lists
- Spectator mode
- Tournament brackets
