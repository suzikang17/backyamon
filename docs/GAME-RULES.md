# Backyamon Game Rules

Backyamon follows standard backgammon rules with Rastafarian-themed terminology. This document maps every rule to its implementation in `@backyamon/engine`.

## Board Setup

The board has **24 points** (triangles), numbered 1 through 24. Each player starts with **15 pieces**.

- **Gold** pieces move ascending: point 1 toward point 24.
- **Red** pieces move descending: point 24 toward point 1.

Starting positions (standard backgammon):

| Point | Gold | Red |
|-------|------|-----|
| 1 (index 0) | 2 | -- |
| 6 (index 5) | -- | 5 |
| 8 (index 7) | -- | 3 |
| 12 (index 11) | 5 | -- |
| 13 (index 12) | -- | 5 |
| 17 (index 16) | 3 | -- |
| 19 (index 18) | 5 | -- |
| 24 (index 23) | -- | 2 |

Both players have 15 pieces total. All other points start empty.

**Engine reference**: `constants.ts` defines `INITIAL_POSITIONS`. `state.ts` provides `createInitialState()`.

## Movement

Players alternate turns. On each turn:

1. Roll two dice.
2. Move pieces according to the dice values. Each die is a separate move.
3. Gold moves in the ascending direction (+1 per pip). Red moves in the descending direction (-1 per pip).

A piece can land on a point that is:
- Empty
- Occupied by the player's own pieces (any number)
- Occupied by exactly one opponent piece (a **blot** -- this triggers a hit)

A piece **cannot** land on a point occupied by two or more opponent pieces (a **made point**).

**Engine reference**: `moves.ts` provides `getLegalMoves()` and `applyMove()`.

## Dice and Move Selection

- Roll two six-sided dice at the start of each turn.
- **Doubles**: If both dice show the same value, the player gets four moves of that value instead of two.
- Each die value must be used as a separate move.

**Engine reference**: `dice.ts` provides `rollDice()` and `getDiceMoveCounts()`.

## Forced Move Rules

Players must use as many dice as legally possible:

1. If both dice can be used, both **must** be used.
2. If only one die can be used, the **higher** die must be used (if it has a legal move).
3. If no legal moves exist, the turn is forfeited.

**Engine reference**: `turn.ts` provides `getAllLegalTurns()` for forced move validation.

## Hitting and the Bar ("Babylon")

When a piece lands on a point with exactly one opponent piece (a blot), the opponent's piece is **hit** and sent to the **bar**.

In Backyamon, the bar is called **"Babylon"** -- the concrete-styled divider in the center of the board.

A player with pieces on Babylon **must** re-enter them before making any other move. To re-enter:
- Gold enters on points 1-6 (the die value determines which point).
- Red enters on points 19-24 (the die value determines which point, counting from 24).

If the entry point is blocked (2+ opponent pieces), that die cannot be used for entry. If no entry is possible, the turn is forfeited.

**Engine reference**: `moves.ts` handles bar entry in `getLegalMoves()` (forces `from: "bar"` when pieces are on the bar).

## Bearing Off ("Zion")

Once **all 15** of a player's pieces are in their home board, they may begin **bearing off** -- removing pieces from the board entirely.

In Backyamon, bearing off is called reaching **"Zion"** -- the golden, lush home tray.

Home boards:
- Gold's home board: points 19-24 (indices 18-23)
- Red's home board: points 1-6 (indices 0-5)

Bearing off rules:
- A die roll matching the point's distance from the edge bears off that piece exactly.
- If no piece sits on the exact point, a **higher** die value can bear off the piece farthest from the edge.
- If a higher die is rolled but pieces exist farther back, the die must be used to move a piece within the home board instead.
- A player **cannot** bear off if any piece is outside the home board or on the bar.

**Engine reference**: `bearing-off.ts` provides `canBearOff()` and `getBearOffMoves()`.

## Win Types

The game ends when one player bears off all 15 pieces. The type of win determines the point multiplier:

| Traditional | Backyamon Name | Multiplier | Condition |
|---|---|---|---|
| Single game | **Ya Mon** | 1x | Opponent has borne off at least one piece |
| Gammon | **Big Ya Mon** | 2x | Opponent has borne off zero pieces |
| Backgammon | **MASSIVE Ya Mon** | 3x | Opponent has borne off zero pieces AND has a piece on the bar or in the winner's home board |

**Engine reference**: `winner.ts` provides `checkWinner()`, `getWinType()`, and `getPointsWon()`.

## "Turn It Up" Doubling Cube

The doubling cube (called **"Turn It Up"**) is an amplifier dial that tracks the game's stake. It starts at **1** and can be doubled to 2, 4, 8, 16, etc.

Rules:
- Before rolling, a player may offer to double the stakes ("Turn It Up").
- The opponent can **accept** (cube value doubles, ownership transfers to the acceptor) or **decline** (opponent concedes the game at the current stake).
- Only the player who owns the cube (or either player if the cube is centered) can offer a double.
- A centered cube means neither player has doubled yet -- either player may offer first.

Points won = win type multiplier x doubling cube value.

**Engine reference**: `doubling.ts` provides `canOfferDouble()`, `offerDouble()`, `acceptDouble()`, `declineDouble()`.

## Crawford Rule

In match play (playing to a set number of points):

- When one player is **exactly one point away** from winning the match, the next game is the **Crawford game**.
- During the Crawford game, the doubling cube **cannot** be used by either player.
- After the Crawford game, doubling resumes normally.

This prevents the trailing player from immediately doubling to force an all-or-nothing game.

**Engine reference**: The `isCrawford` flag on `GameState` is checked by `canOfferDouble()`.

## Match Play

A match is played to a set number of points (`matchLength` on `GameState`). After each game, the winner earns points based on the win type and doubling cube value. The first player to reach or exceed the target score wins the match.

Match state is tracked in `GameState.matchScore`.

## Play Modes

| Mode | Description | Server Required |
|---|---|---|
| **vs AI** | Play against Beach Bum (easy), Selector (medium), or King Tubby (hard). AI runs client-side. | No |
| **Online** | Real-time multiplayer via Socket.io. Server validates all moves. | Yes |
| **Local (pass-and-play)** | Two players share one device. Board flips between turns. | No |
