import { createServer } from "http";
import { randomUUID } from "node:crypto";
import { Server } from "socket.io";
import {
  Player,
  rollDice,
  rollSingleDie,
  getLegalMoves,
  getConstrainedMoves,
  applyMove,
  endTurn,
  canMove,
  canOfferDouble,
  offerDouble,
  acceptDouble,
  declineDouble,
  checkWinner,
  getWinType,
  getPointsWon,
  type Move,
  type WinType,
} from "@backyamon/engine";
import { createGuest, lookupByToken, signInAs } from "./auth.js";
import {
  createRoom,
  joinRoom,
  getRoom,
  removeRoom,
  findRoomBySocketId,
  getPlayerRole,
  getWaitingRooms,
  type GameRoom,
  type PlayerConnection,
} from "./rooms.js";
import {
  joinQueue,
  leaveQueue,
  leaveQueueBySocketId,
  tryMatch,
} from "./matchmaking.js";
import { db, initDatabase } from "./db/index.js";
import { assets, assetReports, guests, matches } from "./db/schema.js";
import { and, desc, eq, isNotNull, or, sql } from "drizzle-orm";
import { deleteObject, getPublicUrl, getUploadUrl } from "./r2.js";

// Map socketId -> playerId for session tracking
const socketToPlayer = new Map<string, { playerId: string; displayName: string }>();

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: process.env.WEB_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
  },
  pingInterval: 10_000, // 10s — check connection frequently
  pingTimeout: 20_000,  // 20s — allow some slack before declaring dead
});

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function getOpponentSocket(room: GameRoom, mySocketId: string): string | null {
  if (room.gold?.socketId === mySocketId) return room.red?.socketId ?? null;
  if (room.red?.socketId === mySocketId) return room.gold?.socketId ?? null;
  return null;
}

function broadcastToRoom(room: GameRoom, event: string, data: unknown): void {
  if (room.gold) io.to(room.gold.socketId).emit(event, data);
  if (room.red) io.to(room.red.socketId).emit(event, data);
}

function broadcastRoomList(): void {
  io.emit("room-list", { rooms: getWaitingRooms() });
}

function movesEqual(a: Move, b: Move): boolean {
  return a.from === b.from && a.to === b.to;
}

async function saveMatchResult(
  room: GameRoom,
  winnerId: string,
  winType: WinType,
  pointsWon: number,
): Promise<void> {
  if (!room.gold || !room.red) return;
  const now = new Date();
  await db.insert(matches)
    .values({
      id: randomUUID(),
      goldPlayerId: room.gold.playerId,
      redPlayerId: room.red.playerId,
      winnerId,
      winType,
      pointsWon,
      createdAt: room.createdAt,
      completedAt: now,
    })
    .run();
}

function handleGameOver(room: GameRoom): void {
  const state = room.state;
  if (state.phase !== "GAME_OVER" || !state.winner || !state.winType) return;

  const winnerConn =
    state.winner === Player.Gold ? room.gold : room.red;
  const winnerId = winnerConn?.playerId ?? "unknown";
  const pointsWon = getPointsWon(state.winType, state.doublingCube.value);

  broadcastToRoom(room, "game-over", {
    winner: state.winner,
    winType: state.winType,
    pointsWon,
  });

  saveMatchResult(room, winnerId, state.winType, pointsWon);
  // Room persists — players can rematch or leave explicitly
}

function processMatchmaking(): void {
  let pair = tryMatch();
  while (pair) {
    const [goldPlayer, redPlayer] = pair;
    const room = createRoom(goldPlayer);
    joinRoom(room.id, redPlayer);

    // Notify both players about the match
    io.to(goldPlayer.socketId).emit("match-found", { roomId: room.id });
    io.to(redPlayer.socketId).emit("match-found", { roomId: room.id });

    // Join socket.io room
    const goldSocket = io.sockets.sockets.get(goldPlayer.socketId);
    const redSocket = io.sockets.sockets.get(redPlayer.socketId);
    if (goldSocket) goldSocket.join(room.id);
    if (redSocket) redSocket.join(room.id);

    // Notify both players the game has started
    io.to(goldPlayer.socketId).emit("room-joined", {
      roomId: room.id,
      player: Player.Gold,
      state: room.state,
      opponent: { displayName: redPlayer.displayName },
    });
    io.to(redPlayer.socketId).emit("room-joined", {
      roomId: room.id,
      player: Player.Red,
      state: room.state,
      opponent: { displayName: goldPlayer.displayName },
    });

    broadcastToRoom(room, "game-start", { state: room.state });

    pair = tryMatch();
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Socket.io Connection Handler
// ────────────────────────────────────────────────────────────────────────────

io.on("connection", (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // ── Registration ──────────────────────────────────────────────────────

  socket.on("register", async (data?: { token?: string }) => {
    // Wait for database to be ready before processing
    if (!dbReady) {
      // Poll until ready (max ~5s)
      for (let i = 0; i < 50 && !dbReady; i++) {
        await new Promise((r) => setTimeout(r, 100));
      }
      if (!dbReady) {
        socket.emit("error", { message: "Server is starting up. Please try again." });
        return;
      }
    }

    const token = data?.token;

    // Try to restore session from token
    if (token) {
      const existing = await lookupByToken(token);
      if (existing) {
        const displayName = existing.username ?? existing.displayName;
        socketToPlayer.set(socket.id, {
          playerId: existing.id,
          displayName,
        });
        socket.emit("registered", {
          playerId: existing.id,
          displayName,
          username: existing.username,
          token: existing.token,
        });
        return;
      }
    }

    // No valid token: create new guest
    const guest = await createGuest();
    socketToPlayer.set(socket.id, {
      playerId: guest.id,
      displayName: guest.displayName,
    });
    socket.emit("registered", {
      playerId: guest.id,
      displayName: guest.displayName,
      username: null,
      token: guest.token,
    });
  });

  socket.on("claim-username", async ({ username }: { username: string }) => {
    const playerInfo = socketToPlayer.get(socket.id);
    if (!playerInfo) {
      socket.emit("username-error", { message: "Not registered. Try refreshing." });
      return;
    }

    const result = await signInAs(playerInfo.playerId, username);
    if (!result.ok) {
      socket.emit("username-error", { message: result.error });
      return;
    }

    // Update in-memory tracking (guest ID may have changed if switching to existing username)
    socketToPlayer.set(socket.id, {
      playerId: result.guest.id,
      displayName: result.guest.displayName,
    });

    socket.emit("username-claimed", {
      username: result.guest.username,
      token: result.guest.token,
    });
  });

  // ── Room Listing ─────────────────────────────────────────────────────

  socket.on("list-rooms", () => {
    socket.emit("room-list", { rooms: getWaitingRooms() });
  });

  // ── Player Listing ──────────────────────────────────────────────────

  socket.on("list-players", async () => {
    const rows = await db
      .select({
        username: guests.username,
        createdAt: guests.createdAt,
        wins: sql<number>`(SELECT COUNT(*) FROM matches WHERE winner_id = ${guests.id})`,
        losses: sql<number>`(SELECT COUNT(*) FROM matches WHERE (gold_player_id = ${guests.id} OR red_player_id = ${guests.id}) AND winner_id IS NOT NULL AND winner_id != ${guests.id})`,
      })
      .from(guests)
      .where(isNotNull(guests.username))
      .all();

    socket.emit("player-list", { players: rows });
  });

  // ── Player Profile ─────────────────────────────────────────────────

  socket.on(
    "get-player-profile",
    async (data: { username: string }, callback) => {
      // 1. Look up the guest by username
      const [guest] = await db
        .select()
        .from(guests)
        .where(eq(guests.username, data.username))
        .all();

      if (!guest) return callback({ error: "Player not found" });

      const playerId = guest.id;

      // 2. Query wins (matches where winnerId = playerId)
      const [{ count: wins }] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(matches)
        .where(eq(matches.winnerId, playerId))
        .all();

      // 3. Query losses (player participated AND winnerId != playerId AND winnerId IS NOT NULL)
      const [{ count: losses }] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(matches)
        .where(
          and(
            or(
              eq(matches.goldPlayerId, playerId),
              eq(matches.redPlayerId, playerId),
            ),
            isNotNull(matches.winnerId),
            sql`${matches.winnerId} != ${playerId}`,
          ),
        )
        .all();

      // 4. Calculate winPct
      const total = wins + losses;
      const winPct = total > 0 ? Math.round((wins / total) * 100) : 0;

      // 5. Get last 20 matches where this player participated, ordered by completedAt desc
      const recentMatchRows = await db
        .select()
        .from(matches)
        .where(
          and(
            or(
              eq(matches.goldPlayerId, playerId),
              eq(matches.redPlayerId, playerId),
            ),
            isNotNull(matches.completedAt),
          ),
        )
        .orderBy(desc(matches.completedAt))
        .limit(20)
        .all();

      // 6. Resolve opponent usernames by looking up guest IDs
      const opponentIds = new Set<string>();
      for (const m of recentMatchRows) {
        const opId = m.goldPlayerId === playerId ? m.redPlayerId : m.goldPlayerId;
        opponentIds.add(opId);
      }

      const opponentMap = new Map<string, string>();
      if (opponentIds.size > 0) {
        const opponentRows = await db
          .select({ id: guests.id, username: guests.username, displayName: guests.displayName })
          .from(guests)
          .where(sql`${guests.id} IN (${sql.join([...opponentIds].map(id => sql`${id}`), sql`, `)})`)
          .all();
        for (const row of opponentRows) {
          opponentMap.set(row.id, row.username ?? row.displayName);
        }
      }

      const recentMatches = recentMatchRows.map((m) => {
        const opId = m.goldPlayerId === playerId ? m.redPlayerId : m.goldPlayerId;
        return {
          id: m.id,
          opponent: opponentMap.get(opId) ?? "Unknown",
          result: m.winnerId === playerId ? "win" : m.winnerId ? "loss" : "incomplete",
          winType: m.winType,
          pointsWon: m.pointsWon,
          completedAt: m.completedAt,
        };
      });

      // 7. Build head-to-head aggregation from ALL matches (not just recent 20)
      const allMatchRows = await db
        .select()
        .from(matches)
        .where(
          and(
            or(
              eq(matches.goldPlayerId, playerId),
              eq(matches.redPlayerId, playerId),
            ),
            isNotNull(matches.winnerId),
          ),
        )
        .all();

      // Also resolve opponent IDs from all matches for head-to-head
      const allOpponentIds = new Set<string>();
      for (const m of allMatchRows) {
        const opId = m.goldPlayerId === playerId ? m.redPlayerId : m.goldPlayerId;
        allOpponentIds.add(opId);
      }

      // Fetch any opponent names we don't already have
      const missingIds = [...allOpponentIds].filter(id => !opponentMap.has(id));
      if (missingIds.length > 0) {
        const extraRows = await db
          .select({ id: guests.id, username: guests.username, displayName: guests.displayName })
          .from(guests)
          .where(sql`${guests.id} IN (${sql.join(missingIds.map(id => sql`${id}`), sql`, `)})`)
          .all();
        for (const row of extraRows) {
          opponentMap.set(row.id, row.username ?? row.displayName);
        }
      }

      const h2hMap = new Map<string, { opponent: string; wins: number; losses: number }>();
      for (const m of allMatchRows) {
        const opId = m.goldPlayerId === playerId ? m.redPlayerId : m.goldPlayerId;
        const opName = opponentMap.get(opId) ?? "Unknown";
        if (!h2hMap.has(opId)) {
          h2hMap.set(opId, { opponent: opName, wins: 0, losses: 0 });
        }
        const record = h2hMap.get(opId)!;
        if (m.winnerId === playerId) {
          record.wins++;
        } else {
          record.losses++;
        }
      }

      const headToHead = [...h2hMap.values()];

      // 8. Return via callback
      callback({
        username: guest.username,
        wins,
        losses,
        winPct,
        recentMatches,
        headToHead,
      });
    },
  );

  // ── Room Creation ─────────────────────────────────────────────────────

  socket.on("create-room", (data?: { roomName?: string }) => {
    const playerInfo = socketToPlayer.get(socket.id);
    if (!playerInfo) {
      socket.emit("error", { message: "Not registered. Call register first." });
      return;
    }

    const conn: PlayerConnection = {
      socketId: socket.id,
      playerId: playerInfo.playerId,
      displayName: playerInfo.displayName,
    };

    try {
      const room = createRoom(conn, data?.roomName);
      socket.join(room.id);
      socket.emit("room-created", { roomId: room.id });
      broadcastRoomList();
    } catch (err) {
      socket.emit("error", {
        message: err instanceof Error ? err.message : "Failed to create room.",
      });
    }
  });

  // ── Join Room ─────────────────────────────────────────────────────────

  socket.on("join-room", ({ roomId }: { roomId: string }) => {
    const playerInfo = socketToPlayer.get(socket.id);
    if (!playerInfo) {
      socket.emit("error", { message: "Not registered. Call register first." });
      return;
    }

    if (!roomId) {
      socket.emit("error", { message: "Room ID is required." });
      return;
    }

    const conn: PlayerConnection = {
      socketId: socket.id,
      playerId: playerInfo.playerId,
      displayName: playerInfo.displayName,
    };

    const room = joinRoom(roomId, conn);
    if (!room) {
      socket.emit("error", {
        message: "Room not found, full, or you cannot join your own room.",
      });
      return;
    }

    socket.join(room.id);

    // Notify the joiner
    socket.emit("room-joined", {
      roomId: room.id,
      player: Player.Red,
      state: room.state,
      opponent: room.gold
        ? { displayName: room.gold.displayName }
        : null,
    });

    // Notify the creator
    if (room.gold) {
      io.to(room.gold.socketId).emit("room-joined", {
        roomId: room.id,
        player: Player.Gold,
        state: room.state,
        opponent: { displayName: conn.displayName },
      });
    }

    // Game starts now
    broadcastToRoom(room, "game-start", { state: room.state });
    broadcastRoomList();
  });

  // ── Quick Match (Matchmaking) ─────────────────────────────────────────

  socket.on("quick-match", () => {
    const playerInfo = socketToPlayer.get(socket.id);
    if (!playerInfo) {
      socket.emit("error", { message: "Not registered. Call register first." });
      return;
    }

    const conn: PlayerConnection = {
      socketId: socket.id,
      playerId: playerInfo.playerId,
      displayName: playerInfo.displayName,
    };

    joinQueue(conn);
    processMatchmaking();
  });

  // ── Leave Queue ───────────────────────────────────────────────────────

  socket.on("leave-queue", () => {
    const playerInfo = socketToPlayer.get(socket.id);
    if (playerInfo) {
      leaveQueue(playerInfo.playerId);
    }
  });

  // ── Roll Dice ─────────────────────────────────────────────────────────

  socket.on("roll-dice", () => {
    const room = findRoomBySocketId(socket.id);
    if (!room) {
      socket.emit("error", { message: "Not in a game room." });
      return;
    }

    const role = getPlayerRole(room, socket.id);
    if (!role) {
      socket.emit("error", { message: "Not a player in this room." });
      return;
    }

    const state = room.state;

    // Handle opening roll — either player can trigger it
    if (state.phase === "OPENING_ROLL") {
      const goldDie = rollSingleDie();
      const redDie = rollSingleDie();

      if (goldDie === redDie) {
        broadcastToRoom(room, "opening-roll-tied", { goldDie, redDie });
        return;
      }

      const firstPlayer = goldDie > redDie ? Player.Gold : Player.Red;
      const dice = rollDice([Math.max(goldDie, redDie), Math.min(goldDie, redDie)]);
      state.currentPlayer = firstPlayer;
      state.dice = dice;
      state.phase = "MOVING";
      room.state = state;

      if (!canMove(state)) {
        room.state = endTurn(state);
        broadcastToRoom(room, "opening-roll-result", {
          goldDie, redDie, firstPlayer, dice,
        });
        broadcastToRoom(room, "turn-ended", {
          state: room.state,
          currentPlayer: room.state.currentPlayer,
        });
        if (room.state.phase === "GAME_OVER") handleGameOver(room);
        return;
      }

      broadcastToRoom(room, "opening-roll-result", {
        goldDie, redDie, firstPlayer, dice,
      });
      return;
    }

    // Verify it's the sender's turn
    if (state.currentPlayer !== role) {
      socket.emit("error", { message: "Not your turn." });
      return;
    }

    // Verify we are in ROLLING phase
    if (state.phase !== "ROLLING") {
      socket.emit("error", { message: "Cannot roll dice right now." });
      return;
    }

    // Roll dice
    const dice = rollDice();
    state.dice = dice;
    state.phase = "MOVING";

    // Check if the player can move at all; if not, auto-end turn
    if (!canMove(state)) {
      room.state = endTurn(state);
      broadcastToRoom(room, "dice-rolled", { dice });
      broadcastToRoom(room, "turn-ended", {
        state: room.state,
        currentPlayer: room.state.currentPlayer,
      });

      if (room.state.phase === "GAME_OVER") {
        handleGameOver(room);
      }
      return;
    }

    broadcastToRoom(room, "dice-rolled", { dice });
  });

  // ── Make Move ─────────────────────────────────────────────────────────

  socket.on("make-move", ({ move }: { move: Move }) => {
    const room = findRoomBySocketId(socket.id);
    if (!room) {
      socket.emit("error", { message: "Not in a game room." });
      return;
    }

    const role = getPlayerRole(room, socket.id);
    if (!role) {
      socket.emit("error", { message: "Not a player in this room." });
      return;
    }

    const state = room.state;

    // 1. Verify it's the sender's turn
    if (state.currentPlayer !== role) {
      socket.emit("error", { message: "Not your turn." });
      return;
    }

    // 2. Verify game phase is MOVING
    if (state.phase !== "MOVING") {
      socket.emit("error", { message: "Cannot make moves right now." });
      return;
    }

    // 3. Get constrained legal moves (enforces must-use-higher-die / maximize dice)
    const legalMoves = getConstrainedMoves(state);
    const isLegal = legalMoves.some((lm) => movesEqual(lm, move));
    if (!isLegal) {
      socket.emit("error", { message: "Illegal move." });
      return;
    }

    // 4. Apply the move
    room.state = applyMove(state, move);

    // 5. Broadcast to both players
    broadcastToRoom(room, "move-made", { move, state: room.state });

    // 6. Check for winner after bearing off
    const winner = checkWinner(room.state);
    if (winner) {
      const winType = getWinType(room.state, winner);
      room.state = {
        ...room.state,
        phase: "GAME_OVER",
        winner,
        winType,
      };
      handleGameOver(room);
      return;
    }

    // 7. If no more legal moves after this move, auto-end turn
    if (!canMove(room.state)) {
      room.state = endTurn(room.state);
      broadcastToRoom(room, "turn-ended", {
        state: room.state,
        currentPlayer: room.state.currentPlayer,
      });

      if (room.state.phase === "GAME_OVER") {
        handleGameOver(room);
      }
    }
  });

  // ── End Turn ──────────────────────────────────────────────────────────

  socket.on("end-turn", () => {
    const room = findRoomBySocketId(socket.id);
    if (!room) {
      socket.emit("error", { message: "Not in a game room." });
      return;
    }

    const role = getPlayerRole(room, socket.id);
    if (!role) {
      socket.emit("error", { message: "Not a player in this room." });
      return;
    }

    const state = room.state;

    if (state.currentPlayer !== role) {
      socket.emit("error", { message: "Not your turn." });
      return;
    }

    if (state.phase !== "MOVING") {
      socket.emit("error", { message: "Cannot end turn right now." });
      return;
    }

    // Only allow ending turn if there are no legal moves remaining
    if (canMove(state)) {
      socket.emit("error", {
        message: "You still have legal moves available.",
      });
      return;
    }

    room.state = endTurn(state);
    broadcastToRoom(room, "turn-ended", {
      state: room.state,
      currentPlayer: room.state.currentPlayer,
    });

    if (room.state.phase === "GAME_OVER") {
      handleGameOver(room);
    }
  });

  // ── Offer Double ──────────────────────────────────────────────────────

  socket.on("offer-double", () => {
    const room = findRoomBySocketId(socket.id);
    if (!room) {
      socket.emit("error", { message: "Not in a game room." });
      return;
    }

    const role = getPlayerRole(room, socket.id);
    if (!role) {
      socket.emit("error", { message: "Not a player in this room." });
      return;
    }

    const state = room.state;

    if (state.currentPlayer !== role) {
      socket.emit("error", { message: "Not your turn." });
      return;
    }

    if (!canOfferDouble(state)) {
      socket.emit("error", { message: "Cannot offer double right now." });
      return;
    }

    room.state = offerDouble(state);

    const opponentSocketId = getOpponentSocket(room, socket.id);
    if (opponentSocketId) {
      io.to(opponentSocketId).emit("double-offered", {
        currentCubeValue: room.state.doublingCube.value,
      });
    }
  });

  // ── Respond to Double ─────────────────────────────────────────────────

  socket.on("respond-double", ({ accept }: { accept: boolean }) => {
    const room = findRoomBySocketId(socket.id);
    if (!room) {
      socket.emit("error", { message: "Not in a game room." });
      return;
    }

    const role = getPlayerRole(room, socket.id);
    if (!role) {
      socket.emit("error", { message: "Not a player in this room." });
      return;
    }

    const state = room.state;

    if (state.phase !== "DOUBLING") {
      socket.emit("error", { message: "No double offer pending." });
      return;
    }

    // The responder is the opponent of the current player (who offered)
    if (state.currentPlayer === role) {
      socket.emit("error", {
        message: "You cannot respond to your own double offer.",
      });
      return;
    }

    if (accept) {
      room.state = acceptDouble(state);
    } else {
      room.state = declineDouble(state);
    }

    broadcastToRoom(room, "double-response", {
      accepted: accept,
      state: room.state,
    });

    if (room.state.phase === "GAME_OVER") {
      handleGameOver(room);
    }
  });

  // ── Disconnect Handling ───────────────────────────────────────────────

  socket.on("disconnect", () => {
    console.log(`Player disconnected: ${socket.id}`);

    // Remove from matchmaking queue
    leaveQueueBySocketId(socket.id);

    const room = findRoomBySocketId(socket.id);
    if (!room) {
      socketToPlayer.delete(socket.id);
      return;
    }

    const role = getPlayerRole(room, socket.id);
    if (!role) {
      socketToPlayer.delete(socket.id);
      return;
    }

    // Notify opponent — room persists, no forfeit timer
    const opponentSocketId = getOpponentSocket(room, socket.id);
    if (opponentSocketId) {
      io.to(opponentSocketId).emit("opponent-disconnected");
    }

    // Don't remove from socketToPlayer — they might reconnect
  });

  // ── Reconnection ────────────────────────────────────────────────────

  socket.on(
    "reconnect-to-game",
    ({ playerId, roomId }: { playerId: string; roomId: string }) => {
      const room = getRoom(roomId);
      if (!room) {
        socket.emit("error", { message: "Room no longer exists." });
        return;
      }

      // Find which role this player had
      let reconnectedRole: Player | null = null;
      if (room.gold?.playerId === playerId) {
        reconnectedRole = Player.Gold;
        room.gold.socketId = socket.id;
      } else if (room.red?.playerId === playerId) {
        reconnectedRole = Player.Red;
        room.red.socketId = socket.id;
      }

      if (!reconnectedRole) {
        socket.emit("error", { message: "You are not a player in this room." });
        return;
      }

      // Update session tracking
      const displayName =
        reconnectedRole === Player.Gold
          ? room.gold!.displayName
          : room.red!.displayName;
      socketToPlayer.set(socket.id, { playerId, displayName });

      // Cancel disconnect timer
      if (room.disconnectTimer) {
        clearTimeout(room.disconnectTimer);
        room.disconnectTimer = null;
      }

      // Join socket.io room
      socket.join(room.id);

      // Notify the reconnected player of current state
      const reconnectOpponent =
        reconnectedRole === Player.Gold ? room.red : room.gold;
      socket.emit("room-joined", {
        roomId: room.id,
        player: reconnectedRole,
        state: room.state,
        opponent: reconnectOpponent
          ? { displayName: reconnectOpponent.displayName }
          : null,
      });

      // Notify the opponent
      const opponentSocketId = getOpponentSocket(room, socket.id);
      if (opponentSocketId) {
        io.to(opponentSocketId).emit("opponent-reconnected");
      }
    },
  );

  // ── Leave / Delete Room ──────────────────────────────────────────────

  socket.on("leave-room", ({ roomId }: { roomId: string }) => {
    const room = getRoom(roomId);
    if (!room) return;

    const role = getPlayerRole(room, socket.id);
    socket.leave(room.id);

    // Notify opponent before removing
    const opponentSocketId = getOpponentSocket(room, socket.id);
    if (opponentSocketId) {
      io.to(opponentSocketId).emit("opponent-left");
    }

    // Clear the leaving player's slot
    if (role === Player.Gold) room.gold = null;
    if (role === Player.Red) room.red = null;

    // If both slots empty, remove room entirely
    if (!room.gold && !room.red) {
      removeRoom(room.id);
    }

    broadcastRoomList();
  });

  // ── Asset Creation Station ────────────────────────────────────────────

  socket.on(
    "create-asset",
    async (
      data: {
        type: "piece" | "sfx" | "music";
        title: string;
        metadata: string;
        needsUpload: boolean;
        contentType?: string;
        fileSize?: number;
      },
      callback,
    ) => {
      const guest = socketToPlayer.get(socket.id);
      if (!guest) return callback({ error: "Not registered" });

      // Basic validation
      if (!data.title || data.title.length > 100) return callback({ error: "Invalid title" });
      if (!["piece", "sfx", "music"].includes(data.type)) return callback({ error: "Invalid type" });
      if (data.metadata && data.metadata.length > 500_000) return callback({ error: "Metadata too large" });

      const id = randomUUID();
      const now = Date.now();
      let r2Key: string | null = null;
      let uploadUrl: string | null = null;

      if (data.needsUpload && data.contentType && data.fileSize) {
        r2Key = `${data.type}/${guest.playerId}/${id}`;
        uploadUrl = await getUploadUrl(r2Key, data.contentType, data.fileSize);
      }

      await db.insert(assets)
        .values({
          id,
          creatorId: guest.playerId,
          type: data.type,
          title: data.title,
          status: "private",
          metadata: data.metadata,
          r2Key,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      callback({ id, uploadUrl });
    },
  );

  socket.on(
    "list-my-assets",
    async (data: { type?: string }, callback) => {
      const guest = socketToPlayer.get(socket.id);
      if (!guest) return callback({ error: "Not registered" });

      const condition = data.type
        ? and(eq(assets.creatorId, guest.playerId), eq(assets.type, data.type))
        : eq(assets.creatorId, guest.playerId);

      const results = await db
        .select()
        .from(assets)
        .where(condition)
        .orderBy(desc(assets.createdAt))
        .all();

      const withUrls = results.map((a) => ({
        ...a,
        url: a.r2Key ? getPublicUrl(a.r2Key) : null,
      }));

      callback({ assets: withUrls });
    },
  );

  socket.on("list-gallery", async (data: { type?: string }, callback) => {
    const condition = data.type
      ? and(eq(assets.status, "published"), eq(assets.type, data.type))
      : eq(assets.status, "published");

    const results = await db
      .select()
      .from(assets)
      .where(condition)
      .orderBy(desc(assets.createdAt))
      .all();

    const withUrls = results.map((a) => ({
      ...a,
      url: a.r2Key ? getPublicUrl(a.r2Key) : null,
    }));

    callback({ assets: withUrls });
  });

  socket.on(
    "publish-asset",
    async (data: { assetId: string }, callback) => {
      const guest = socketToPlayer.get(socket.id);
      if (!guest) return callback({ error: "Not registered" });

      await db.update(assets)
        .set({ status: "published", updatedAt: Date.now() })
        .where(
          and(eq(assets.id, data.assetId), eq(assets.creatorId, guest.playerId)),
        )
        .run();

      callback({ ok: true });
    },
  );

  socket.on(
    "delete-asset",
    async (data: { assetId: string }, callback) => {
      const guest = socketToPlayer.get(socket.id);
      if (!guest) return callback({ error: "Not registered" });

      const [asset] = await db
        .select()
        .from(assets)
        .where(
          and(eq(assets.id, data.assetId), eq(assets.creatorId, guest.playerId)),
        )
        .all();

      if (!asset) return callback({ error: "Not found" });

      if (asset.r2Key) {
        await deleteObject(asset.r2Key);
      }

      await db.delete(assets).where(eq(assets.id, data.assetId)).run();
      callback({ ok: true });
    },
  );

  socket.on(
    "report-asset",
    async (data: { assetId: string; reason: string }, callback) => {
      const guest = socketToPlayer.get(socket.id);
      if (!guest) return callback({ error: "Not registered" });

      // Check for duplicate report
      const existingReport = await db
        .select()
        .from(assetReports)
        .where(
          and(
            eq(assetReports.assetId, data.assetId),
            eq(assetReports.reporterId, guest.playerId),
          ),
        )
        .all();
      if (existingReport.length > 0) return callback({ error: "Already reported" });

      await db.insert(assetReports)
        .values({
          id: randomUUID(),
          assetId: data.assetId,
          reporterId: guest.playerId,
          reason: data.reason,
          createdAt: Date.now(),
        })
        .run();

      // Auto-hide if 3+ reports
      const reports = await db
        .select()
        .from(assetReports)
        .where(eq(assetReports.assetId, data.assetId))
        .all();

      if (reports.length >= 3) {
        await db.update(assets)
          .set({ status: "removed", updatedAt: Date.now() })
          .where(eq(assets.id, data.assetId))
          .run();
      }

      callback({ ok: true });
    },
  );
});

const PORT = process.env.PORT || 3001;

// Track whether the database is ready
let dbReady = false;

// Start listening immediately so Render's port scan succeeds,
// then initialize the database in the background
httpServer.listen(PORT, () => {
  console.log(`Backyamon server running on port ${PORT}`);
  console.log("Initializing database...");
  initDatabase()
    .then(() => {
      dbReady = true;
      console.log("Database initialized successfully");
    })
    .catch((err: unknown) => {
      console.error("Failed to initialize database:", err);
      process.exit(1);
    });
});
