import { io, Socket } from "socket.io-client";
import type { Move } from "@backyamon/engine";

const DEFAULT_SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3001";

const LOCAL_STORAGE_KEY = "backyamon_guest";

interface GuestIdentity {
  playerId: string;
  displayName: string;
  username: string | null;
  token: string;
}

const USERNAME_KEY = "backyamon_username";

function loadGuestIdentity(): GuestIdentity | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.playerId && parsed.token) {
      return parsed as GuestIdentity;
    }
  } catch {
    // ignore
  }
  return null;
}

function saveGuestIdentity(identity: GuestIdentity): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(identity));
    // Also persist username separately so it survives server restarts
    if (identity.username) {
      localStorage.setItem(USERNAME_KEY, identity.username);
    }
  } catch {
    // ignore
  }
}

function getSavedUsername(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(USERNAME_KEY);
}

export class SocketClient {
  private socket: Socket;
  private serverUrl: string;
  private identity: GuestIdentity | null = null;

  constructor(serverUrl?: string) {
    this.serverUrl = serverUrl ?? DEFAULT_SERVER_URL;
    this.socket = io(this.serverUrl, {
      autoConnect: false,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 10_000,
      reconnectionAttempts: Infinity,
    });

    // Restore cached identity
    this.identity = loadGuestIdentity();
  }

  // ── Connection ───────────────────────────────────────────────────────

  connect(options?: {
    maxRetries?: number;
    onRetry?: (attempt: number, maxRetries: number) => void;
  }): Promise<void> {
    const maxRetries = options?.maxRetries ?? 5;
    const onRetry = options?.onRetry;

    const tryOnce = (): Promise<void> =>
      new Promise((resolve, reject) => {
        if (this.socket.connected) {
          resolve();
          return;
        }

        const onConnect = () => {
          this.socket.off("connect_error", onError);
          resolve();
        };

        const onError = (err: Error) => {
          this.socket.off("connect", onConnect);
          this.socket.disconnect();
          reject(err);
        };

        this.socket.once("connect", onConnect);
        this.socket.once("connect_error", onError);
        this.socket.connect();
      });

    const run = async (): Promise<void> => {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          await tryOnce();
          return;
        } catch (err) {
          if (attempt === maxRetries) throw err;
          onRetry?.(attempt, maxRetries);
          // Exponential backoff: 1s, 2s, 4s, 8s, 16s...
          await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
        }
      }
    };

    return run();
  }

  disconnect(): void {
    this.socket.disconnect();
  }

  isConnected(): boolean {
    return this.socket.connected;
  }

  // ── Auth ─────────────────────────────────────────────────────────────

  register(): Promise<GuestIdentity> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Registration timed out"));
      }, 10_000);

      this.socket.once(
        "registered",
        (data: {
          playerId: string;
          displayName: string;
          username: string | null;
          token: string;
        }) => {
          clearTimeout(timeout);
          this.identity = {
            playerId: data.playerId,
            displayName: data.displayName,
            username: data.username,
            token: data.token,
          };
          saveGuestIdentity(this.identity);

          // If server didn't return a username but we have one saved locally
          // (e.g. server restarted), try to reclaim it automatically
          if (!data.username) {
            const saved = getSavedUsername();
            if (saved) {
              this.claimUsername(saved)
                .then(() => resolve(this.identity!))
                .catch(() => resolve(this.identity!)); // resolve either way
              return;
            }
          }

          resolve(this.identity);
        }
      );

      this.socket.once("error", (data: { message: string }) => {
        clearTimeout(timeout);
        reject(new Error(data.message));
      });

      // Send token for session restoration if available
      const cached = loadGuestIdentity();
      this.socket.emit("register", cached?.token ? { token: cached.token } : {});
    });
  }

  claimUsername(username: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Claim username timed out"));
      }, 10_000);

      this.socket.once("username-claimed", (data: { username: string; token?: string }) => {
        clearTimeout(timeout);
        if (this.identity) {
          this.identity.username = data.username;
          this.identity.displayName = data.username;
          if (data.token) this.identity.token = data.token;
          saveGuestIdentity(this.identity);
        }
        resolve(data.username);
      });

      this.socket.once("username-error", (data: { message: string }) => {
        clearTimeout(timeout);
        reject(new Error(data.message));
      });

      this.socket.emit("claim-username", { username });
    });
  }

  getIdentity(): GuestIdentity | null {
    return this.identity;
  }

  // ── Room Management ─────────────────────────────────────────────────

  createRoom(roomName?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Create room timed out"));
      }, 10_000);

      this.socket.once("room-created", (data: { roomId: string }) => {
        clearTimeout(timeout);
        resolve(data.roomId);
      });

      this.socket.once("error", (data: { message: string }) => {
        clearTimeout(timeout);
        reject(new Error(data.message));
      });

      this.socket.emit("create-room", roomName ? { roomName } : {});
    });
  }

  joinRoom(roomId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Join room timed out"));
      }, 10_000);

      const onJoined = () => {
        clearTimeout(timeout);
        this.socket.off("error", onError);
        resolve();
      };

      const onError = (data: { message: string }) => {
        clearTimeout(timeout);
        this.socket.off("room-joined", onJoined);
        reject(new Error(data.message));
      };

      this.socket.once("room-joined", onJoined);
      this.socket.once("error", onError);

      this.socket.emit("join-room", { roomId: roomId.toUpperCase() });
    });
  }

  quickMatch(): Promise<void> {
    return new Promise<void>((resolve) => {
      // Just emit - we listen for match-found / room-joined elsewhere
      this.socket.emit("quick-match");
      resolve();
    });
  }

  leaveQueue(): void {
    this.socket.emit("leave-queue");
  }

  listPlayers(): void {
    this.socket.emit("list-players");
  }

  listRooms(): void {
    this.socket.emit("list-rooms");
  }

  getPlayerProfile(username: string): Promise<{
    username: string;
    wins: number;
    losses: number;
    winPct: number;
    recentMatches: {
      id: string;
      opponent: string;
      result: "win" | "loss";
      winType: string;
      pointsWon: number;
      completedAt: string;
    }[];
    headToHead: {
      opponent: string;
      wins: number;
      losses: number;
    }[];
  }> {
    return this.emitWithAck("get-player-profile", { username });
  }

  getRecentMatches(limit?: number): Promise<{
    matches: {
      id: string;
      goldPlayer: string;
      redPlayer: string;
      winner: string;
      winType: string;
      pointsWon: number;
      completedAt: string;
    }[];
  }> {
    return this.emitWithAck("get-recent-matches", { limit });
  }

  // ── Game Actions ─────────────────────────────────────────────────────

  rollDice(): void {
    this.socket.emit("roll-dice");
  }

  makeMove(move: Move): void {
    this.socket.emit("make-move", { move });
  }

  endTurn(): void {
    this.socket.emit("end-turn");
  }

  offerDouble(): void {
    this.socket.emit("offer-double");
  }

  respondToDouble(accept: boolean): void {
    this.socket.emit("respond-double", { accept });
  }

  reconnectToGame(playerId: string, roomId: string): void {
    this.socket.emit("reconnect-to-game", { playerId, roomId });
  }

  leaveRoom(roomId: string): void {
    this.socket.emit("leave-room", { roomId });
  }

  /**
   * Register a callback that fires when socket.io auto-reconnects.
   * Useful for re-joining a game room after a transient disconnect.
   */
  onReconnect(callback: () => void): () => void {
    this.socket.io.on("reconnect", callback);
    return () => this.socket.io.off("reconnect", callback);
  }

  // ── Assets ──────────────────────────────────────────────────────────

  private emitWithAck<T>(event: string, data: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      this.socket.emit(event, data, (res: { error?: string } & T) => {
        if (res.error) reject(new Error(res.error));
        else resolve(res);
      });
    });
  }

  createAsset(data: {
    type: "piece" | "sfx" | "music";
    title: string;
    metadata: string;
    needsUpload: boolean;
    contentType?: string;
    fileSize?: number;
  }): Promise<{ id: string; uploadUrl?: string }> {
    return this.emitWithAck("create-asset", data);
  }

  listMyAssets(type?: string): Promise<{ assets: unknown[] }> {
    return this.emitWithAck("list-my-assets", { type });
  }

  listGallery(type?: string): Promise<{ assets: unknown[] }> {
    return this.emitWithAck("list-gallery", { type });
  }

  publishAsset(assetId: string): Promise<void> {
    return this.emitWithAck("publish-asset", { assetId });
  }

  deleteAsset(assetId: string): Promise<void> {
    return this.emitWithAck("delete-asset", { assetId });
  }

  reportAsset(assetId: string, reason: string): Promise<void> {
    return this.emitWithAck("report-asset", { assetId, reason });
  }

  // ── Event Listeners ──────────────────────────────────────────────────

  on(event: string, callback: (...args: unknown[]) => void): void {
    this.socket.on(event, callback);
  }

  off(event: string, callback: (...args: unknown[]) => void): void {
    this.socket.off(event, callback);
  }

  // ── Lifecycle ────────────────────────────────────────────────────────

  destroy(): void {
    this.socket.removeAllListeners();
    this.socket.disconnect();
  }
}
