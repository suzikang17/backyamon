import { Player, createInitialState, type GameState } from "@backyamon/engine";

export interface PlayerConnection {
  socketId: string;
  playerId: string;
  displayName: string;
}

export interface GameRoom {
  id: string; // Short room code (6 chars)
  gold: PlayerConnection | null;
  red: PlayerConnection | null;
  state: GameState;
  createdAt: Date;
  disconnectTimer: NodeJS.Timeout | null;
}

const rooms = new Map<string, GameRoom>();

const ROOM_CODE_LENGTH = 6;
const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Avoid ambiguous chars (I, O, 0, 1)

function generateRoomCode(): string {
  let code: string;
  do {
    code = "";
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
      code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
    }
  } while (rooms.has(code)); // Ensure uniqueness
  return code;
}

export function createRoom(player: PlayerConnection): GameRoom {
  const id = generateRoomCode();
  const room: GameRoom = {
    id,
    gold: player,
    red: null,
    state: createInitialState(),
    createdAt: new Date(),
    disconnectTimer: null,
  };
  rooms.set(id, room);
  return room;
}

export function joinRoom(
  roomId: string,
  player: PlayerConnection,
): GameRoom | null {
  const room = rooms.get(roomId.toUpperCase());
  if (!room) return null;
  if (room.red !== null) return null; // Room is full
  if (room.gold && room.gold.playerId === player.playerId) return null; // Can't join your own room
  room.red = player;
  return room;
}

export function getRoom(roomId: string): GameRoom | undefined {
  return rooms.get(roomId.toUpperCase());
}

export function removeRoom(roomId: string): void {
  const room = rooms.get(roomId.toUpperCase());
  if (room?.disconnectTimer) {
    clearTimeout(room.disconnectTimer);
  }
  rooms.delete(roomId.toUpperCase());
}

export function findRoomBySocketId(socketId: string): GameRoom | undefined {
  for (const room of rooms.values()) {
    if (
      room.gold?.socketId === socketId ||
      room.red?.socketId === socketId
    ) {
      return room;
    }
  }
  return undefined;
}

export function findRoomByPlayerId(playerId: string): GameRoom | undefined {
  for (const room of rooms.values()) {
    if (
      room.gold?.playerId === playerId ||
      room.red?.playerId === playerId
    ) {
      return room;
    }
  }
  return undefined;
}

export function getPlayerRole(
  room: GameRoom,
  socketId: string,
): Player | null {
  if (room.gold?.socketId === socketId) return Player.Gold;
  if (room.red?.socketId === socketId) return Player.Red;
  return null;
}

export function getAllRooms(): Map<string, GameRoom> {
  return rooms;
}
