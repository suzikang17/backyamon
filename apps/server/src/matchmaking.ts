import type { PlayerConnection } from "./rooms.js";

interface QueueEntry {
  player: PlayerConnection;
  joinedAt: Date;
}

const queue: QueueEntry[] = [];

export function joinQueue(player: PlayerConnection): void {
  // Don't add if already in queue
  const existing = queue.findIndex(
    (entry) => entry.player.playerId === player.playerId,
  );
  if (existing !== -1) return;

  queue.push({ player, joinedAt: new Date() });
}

export function leaveQueue(playerId: string): void {
  const index = queue.findIndex(
    (entry) => entry.player.playerId === playerId,
  );
  if (index !== -1) {
    queue.splice(index, 1);
  }
}

export function leaveQueueBySocketId(socketId: string): void {
  const index = queue.findIndex(
    (entry) => entry.player.socketId === socketId,
  );
  if (index !== -1) {
    queue.splice(index, 1);
  }
}

/**
 * Try to match two players from the queue.
 * Returns a pair of PlayerConnections if a match is found, or null.
 * First player in queue becomes Gold.
 */
export function tryMatch(): [PlayerConnection, PlayerConnection] | null {
  if (queue.length < 2) return null;

  const gold = queue.shift()!;
  const red = queue.shift()!;
  return [gold.player, red.player];
}

export function getQueueSize(): number {
  return queue.length;
}

export function isInQueue(playerId: string): boolean {
  return queue.some((entry) => entry.player.playerId === playerId);
}
