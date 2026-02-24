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

// Reggae legends + iconic words — single words used as room names
const ROOM_NAMES = [
  // Legendary artists
  "MARLEY", "TOSH", "PERRY", "CLIFF", "TUBBY", "SHAGGY", "SHABBA",
  "BANTON", "SIZZLA", "CAPLETON", "ELEPHANT", "BEENIE", "BOUNTY",
  "YELLOWMAN", "BARRINGTON", "HORACE", "TOOTS", "ALTON", "DESMOND",
  "BURNING", "ISAACS", "COCOA", "SCRATCH", "SCIENTIST", "SKATALITES",
  "ABYSSINIANS", "GLADIATORS", "CONGOS", "WAILING", "UPSETTERS",
  "MAYTALS", "HEPTONES", "PARAGONS", "MELODIANS", "ETHIOPIANS",
  "CHRONIXX", "PROTOJE", "KOFFEE", "POPCAAN", "ALKALINE",
  "SEAN", "DAMIAN", "ZIGGY", "STEPHEN", "CEDELLA",
  // Iconic reggae words
  "RIDDIM", "ZION", "EXODUS", "KAYA", "UPRISING", "BURNIN",
  "KINGSTON", "TRENCHTOWN", "ROCKSTEADY", "DANCEHALL", "DUBPLATE",
  "IRIE", "ROOTS", "DUB", "BASHMENT", "STEPPA",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateRoomName(): string {
  let name: string;
  do {
    name = pick(ROOM_NAMES);
  } while (rooms.has(name)); // Ensure uniqueness
  return name;
}

function normalizeRoomId(id: string): string {
  return id.trim().toUpperCase().replace(/\s+/g, "-");
}

export function createRoom(player: PlayerConnection, customName?: string): GameRoom {
  let id: string;
  if (customName) {
    id = normalizeRoomId(customName);
    if (id.length < 2 || id.length > 30) {
      throw new Error("Room name must be 2-30 characters.");
    }
    if (rooms.has(id)) {
      throw new Error("Room name already taken. Try another!");
    }
  } else {
    id = generateRoomName();
  }
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
  const room = rooms.get(normalizeRoomId(roomId));
  if (!room) return null;
  if (room.red !== null) return null; // Room is full
  if (room.gold && room.gold.playerId === player.playerId) return null; // Can't join your own room
  room.red = player;
  return room;
}

export function getRoom(roomId: string): GameRoom | undefined {
  return rooms.get(normalizeRoomId(roomId));
}

export function removeRoom(roomId: string): void {
  const normalized = normalizeRoomId(roomId);
  const room = rooms.get(normalized);
  if (room?.disconnectTimer) {
    clearTimeout(room.disconnectTimer);
  }
  rooms.delete(normalized);
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

export interface WaitingRoom {
  id: string;
  hostName: string;
  createdAt: string;
}

export function getWaitingRooms(): WaitingRoom[] {
  const waiting: WaitingRoom[] = [];
  for (const room of rooms.values()) {
    if (room.gold && room.red === null) {
      waiting.push({
        id: room.id,
        hostName: room.gold.displayName,
        createdAt: room.createdAt.toISOString(),
      });
    }
  }
  return waiting;
}
