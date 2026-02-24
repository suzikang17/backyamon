import { Player, type PointState } from "./types";

// Standard backgammon starting positions
// Index = point number - 1 (0-indexed)
// Gold moves from point 1 -> 24 (index 0 -> 23)
// Red moves from point 24 -> 1 (index 23 -> 0)
export const INITIAL_POSITIONS: PointState[] = Array.from(
  { length: 24 },
  (): PointState => null,
);

// Gold pieces (moving toward point 24)
// Point 1 (idx 0): 2, Point 12 (idx 11): 5, Point 17 (idx 16): 3, Point 19 (idx 18): 5
INITIAL_POSITIONS[0] = { player: Player.Gold, count: 2 };
INITIAL_POSITIONS[11] = { player: Player.Gold, count: 5 };
INITIAL_POSITIONS[16] = { player: Player.Gold, count: 3 };
INITIAL_POSITIONS[18] = { player: Player.Gold, count: 5 };

// Red pieces (moving toward point 1)
// Point 24 (idx 23): 2, Point 13 (idx 12): 5, Point 8 (idx 7): 3, Point 6 (idx 5): 5
INITIAL_POSITIONS[23] = { player: Player.Red, count: 2 };
INITIAL_POSITIONS[12] = { player: Player.Red, count: 5 };
INITIAL_POSITIONS[7] = { player: Player.Red, count: 3 };
INITIAL_POSITIONS[5] = { player: Player.Red, count: 5 };

export const PIECES_PER_PLAYER = 15;
export const POINTS_COUNT = 24;

// Home board ranges (inclusive indices)
// Gold home board: points 19-24 (indices 18-23)
// Red home board: points 1-6 (indices 0-5)
export const HOME_BOARD_START: Record<Player, number> = {
  [Player.Gold]: 18,
  [Player.Red]: 0,
};
export const HOME_BOARD_END: Record<Player, number> = {
  [Player.Gold]: 23,
  [Player.Red]: 5,
};

// Movement direction: Gold ascends (+1), Red descends (-1)
export const MOVE_DIRECTION: Record<Player, number> = {
  [Player.Gold]: 1,
  [Player.Red]: -1,
};
