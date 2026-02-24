import { createServer } from "http";
import { randomUUID } from "node:crypto";
import { Server } from "socket.io";
import {
  Player,
  rollDice,
  getLegalMoves,
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
import { createGuest, lookupByToken, claimUsername } from "./auth.js";
import {
  createRoom,
  joinRoom,
  getRoom,
  removeRoom,
  findRoomBySocketId,
  getPlayerRole,
  type GameRoom,
  type PlayerConnection,
} from "./rooms.js";
import {
  joinQueue,
  leaveQueue,
  leaveQueueBySocketId,
  tryMatch,
} from "./matchmaking.js";
import { db } from "./db/index.js";
import { matches } from "./db/schema.js";

// Map socketId -> playerId for session tracking
const socketToPlayer = new Map<string, { playerId: string; displayName: string }>();

const DISCONNECT_TIMEOUT_MS = 30_000; // 30 seconds

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: process.env.WEB_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
  },
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

function movesEqual(a: Move, b: Move): boolean {
  return a.from === b.from && a.to === b.to;
}

function saveMatchResult(
  room: GameRoom,
  winnerId: string,
  winType: WinType,
  pointsWon: number,
): void {
  if (!room.gold || !room.red) return;
  const now = new Date();
  db.insert(matches)
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
  removeRoom(room.id);
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

  socket.on("register", (data?: { token?: string }) => {
    const token = data?.token;

    // Try to restore session from token
    if (token) {
      const existing = lookupByToken(token);
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
    const guest = createGuest();
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

  socket.on("claim-username", ({ username }: { username: string }) => {
    const playerInfo = socketToPlayer.get(socket.id);
    if (!playerInfo) {
      socket.emit("error", { message: "Not registered." });
      return;
    }

    const result = claimUsername(playerInfo.playerId, username);
    if (!result.ok) {
      socket.emit("username-error", { message: result.error });
      return;
    }

    // Update in-memory tracking
    const trimmed = username.trim();
    playerInfo.displayName = trimmed;
    socketToPlayer.set(socket.id, playerInfo);

    socket.emit("username-claimed", { username: trimmed });
  });

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

    // 3. Get legal moves and check the move is legal
    const legalMoves = getLegalMoves(state);
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

    // Notify opponent
    const opponentSocketId = getOpponentSocket(room, socket.id);
    if (opponentSocketId) {
      io.to(opponentSocketId).emit("opponent-disconnected");
    }

    // Start 30-second reconnection timer
    if (room.disconnectTimer) {
      clearTimeout(room.disconnectTimer);
    }

    const disconnectedRole = role;

    room.disconnectTimer = setTimeout(() => {
      // Timer expired: opponent wins by forfeit
      const forfeitRoom = getRoom(room.id);
      if (!forfeitRoom) return;

      // Determine winner (the one still connected)
      const winnerPlayer =
        disconnectedRole === Player.Gold ? Player.Red : Player.Gold;
      const winnerConn =
        winnerPlayer === Player.Gold ? forfeitRoom.gold : forfeitRoom.red;
      const winnerId = winnerConn?.playerId ?? "unknown";

      forfeitRoom.state = {
        ...forfeitRoom.state,
        phase: "GAME_OVER",
        winner: winnerPlayer,
        winType: "ya_mon",
      };

      const pointsWon = getPointsWon(
        "ya_mon",
        forfeitRoom.state.doublingCube.value,
      );

      broadcastToRoom(forfeitRoom, "game-over", {
        winner: winnerPlayer,
        winType: "ya_mon",
        pointsWon,
      });

      saveMatchResult(forfeitRoom, winnerId, "ya_mon", pointsWon);
      removeRoom(forfeitRoom.id);
    }, DISCONNECT_TIMEOUT_MS);

    // Don't remove from socketToPlayer yet -- they might reconnect
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
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Backyamon server running on port ${PORT}`);
});
