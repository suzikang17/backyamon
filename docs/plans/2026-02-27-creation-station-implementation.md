# Creation Station Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a community creation system where players design custom pieces (via tldraw), upload sound effects and music, and equip them in-game.

**Architecture:** New Next.js routes (`/create/*`, `/my-stuff`, `/gallery`) with tldraw for piece design, file uploads via R2 presigned URLs, and Turso for all metadata. PieceRenderer and SoundManager get custom asset loading paths. Existing SQLite migrates to Turso.

**Tech Stack:** tldraw, Cloudflare R2 (@aws-sdk/client-s3), Turso (@libsql/client + drizzle-orm/libsql), Howler.js (existing), PixiJS (existing)

---

### Task 1: Migrate from better-sqlite3 to Turso

**Files:**
- Modify: `apps/server/package.json`
- Modify: `apps/server/src/db/index.ts`
- Modify: `apps/server/src/db/schema.ts`
- Create: `apps/server/.env.example`

**Step 1: Install Turso dependencies**

Run:
```bash
cd apps/server && npm install @libsql/client drizzle-orm@latest && npm uninstall better-sqlite3 @types/better-sqlite3
```

**Step 2: Create a Turso database**

Run:
```bash
turso db create backyamon
turso db show backyamon --url
turso db tokens create backyamon
```

Save the URL and token.

**Step 3: Update the DB client**

Replace `apps/server/src/db/index.ts`:

```typescript
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema.js";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || "file:backyamon.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export const db = drizzle(client, { schema });
```

Note: `file:backyamon.db` fallback keeps local dev working without Turso.

**Step 4: Update schema to use libsql-compatible types**

The schema in `apps/server/src/db/schema.ts` uses `sqliteTable` from drizzle-orm which works with both drivers. No schema changes needed — just verify the imports.

**Step 5: Move inline CREATE TABLE statements to drizzle migrations**

The current `db/index.ts` has raw `sqlite.exec(CREATE TABLE ...)` statements. Replace with:

```bash
cd apps/server && npx drizzle-kit generate && npx drizzle-kit migrate
```

Create `apps/server/drizzle.config.ts`:

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL || "file:backyamon.db",
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
});
```

**Step 6: Create .env.example**

Create `apps/server/.env.example`:

```
TURSO_DATABASE_URL=libsql://your-db-name-your-org.turso.io
TURSO_AUTH_TOKEN=your-token
WEB_URL=http://localhost:3000
```

**Step 7: Test that existing functionality works**

Run the server and verify:
- Guest registration via socket
- Username claiming
- Room creation and game play
- Player listing with W/L stats

**Step 8: Commit**

```bash
git add -A && git commit -m "feat: migrate from better-sqlite3 to Turso (libsql)"
```

---

### Task 2: Add asset tables to the schema

**Files:**
- Modify: `apps/server/src/db/schema.ts`

**Step 1: Add assets and asset_reports tables**

Append to `apps/server/src/db/schema.ts`:

```typescript
export const assets = sqliteTable("assets", {
  id: text("id").primaryKey(),
  creatorId: text("creator_id").notNull(),
  type: text("type").notNull(), // 'piece' | 'sfx' | 'music'
  title: text("title").notNull(),
  status: text("status").notNull().default("private"), // 'private' | 'published' | 'removed'
  metadata: text("metadata"), // JSON string
  r2Key: text("r2_key"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const assetReports = sqliteTable("asset_reports", {
  id: text("id").primaryKey(),
  assetId: text("asset_id").notNull(),
  reporterId: text("reporter_id").notNull(),
  reason: text("reason").notNull(),
  createdAt: integer("created_at").notNull(),
});
```

**Step 2: Generate and run migration**

```bash
cd apps/server && npx drizzle-kit generate && npx drizzle-kit migrate
```

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: add assets and asset_reports tables"
```

---

### Task 3: Set up Cloudflare R2 and presigned URL endpoint

**Files:**
- Modify: `apps/server/package.json`
- Create: `apps/server/src/r2.ts`
- Modify: `apps/server/src/index.ts`

**Step 1: Install AWS S3 SDK (R2 is S3-compatible)**

```bash
cd apps/server && npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

**Step 2: Create R2 client module**

Create `apps/server/src/r2.ts`:

```typescript
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || "";
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || "";
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || "";
const R2_BUCKET = process.env.R2_BUCKET || "backyamon-assets";

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

export async function getUploadUrl(key: string, contentType: string, maxSize: number): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    ContentType: contentType,
    ContentLength: maxSize,
  });
  return getSignedUrl(s3, command, { expiresIn: 300 });
}

export async function getDownloadUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
  });
  return getSignedUrl(s3, command, { expiresIn: 3600 });
}

export async function deleteObject(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
}

export function getPublicUrl(key: string): string {
  const publicDomain = process.env.R2_PUBLIC_DOMAIN;
  if (publicDomain) return `${publicDomain}/${key}`;
  return `https://${R2_BUCKET}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;
}
```

**Step 3: Add R2 env vars to .env.example**

Append to `apps/server/.env.example`:

```
R2_ACCOUNT_ID=your-cf-account-id
R2_ACCESS_KEY_ID=your-r2-access-key
R2_SECRET_ACCESS_KEY=your-r2-secret-key
R2_BUCKET=backyamon-assets
R2_PUBLIC_DOMAIN=https://assets.backyamon.com
```

**Step 4: Add asset API socket events to the server**

Add to `apps/server/src/index.ts` inside the `io.on("connection")` handler, after existing event handlers:

```typescript
import { randomUUID } from "crypto";
import { getUploadUrl, getPublicUrl } from "./r2.js";
import { assets } from "./db/schema.js";
import { eq, and, desc } from "drizzle-orm";

// --- Asset events ---

socket.on("create-asset", async (data: {
  type: "piece" | "sfx" | "music";
  title: string;
  metadata: string; // JSON
  needsUpload: boolean; // true for audio, false for pieces (SVG stored in metadata)
  contentType?: string;
  fileSize?: number;
}, callback) => {
  if (!guest) return callback({ error: "Not registered" });

  const id = randomUUID();
  const now = Date.now();
  let r2Key: string | null = null;
  let uploadUrl: string | null = null;

  if (data.needsUpload && data.contentType && data.fileSize) {
    r2Key = `${data.type}/${guest.id}/${id}`;
    uploadUrl = await getUploadUrl(r2Key, data.contentType, data.fileSize);
  }

  await db.insert(assets).values({
    id,
    creatorId: guest.id,
    type: data.type,
    title: data.title,
    status: "private",
    metadata: data.metadata,
    r2Key,
    createdAt: now,
    updatedAt: now,
  });

  callback({ id, uploadUrl });
});

socket.on("list-my-assets", async (data: { type?: string }, callback) => {
  if (!guest) return callback({ error: "Not registered" });

  const conditions = [eq(assets.creatorId, guest.id)];
  if (data.type) conditions.push(eq(assets.type, data.type));

  const results = await db.select().from(assets)
    .where(and(...conditions))
    .orderBy(desc(assets.createdAt))
    .all();

  callback({ assets: results });
});

socket.on("list-gallery", async (data: { type?: string }, callback) => {
  const conditions = [eq(assets.status, "published")];
  if (data.type) conditions.push(eq(assets.type, data.type));

  const results = await db.select().from(assets)
    .where(and(...conditions))
    .orderBy(desc(assets.createdAt))
    .all();

  // Resolve R2 URLs for audio assets
  const withUrls = results.map((a) => ({
    ...a,
    url: a.r2Key ? getPublicUrl(a.r2Key) : null,
  }));

  callback({ assets: withUrls });
});

socket.on("publish-asset", async (data: { assetId: string }, callback) => {
  if (!guest) return callback({ error: "Not registered" });

  await db.update(assets)
    .set({ status: "published", updatedAt: Date.now() })
    .where(and(eq(assets.id, data.assetId), eq(assets.creatorId, guest.id)));

  callback({ ok: true });
});

socket.on("delete-asset", async (data: { assetId: string }, callback) => {
  if (!guest) return callback({ error: "Not registered" });

  const [asset] = await db.select().from(assets)
    .where(and(eq(assets.id, data.assetId), eq(assets.creatorId, guest.id)))
    .all();

  if (!asset) return callback({ error: "Not found" });

  if (asset.r2Key) {
    const { deleteObject } = await import("./r2.js");
    await deleteObject(asset.r2Key);
  }

  await db.delete(assets)
    .where(eq(assets.id, data.assetId));

  callback({ ok: true });
});

socket.on("report-asset", async (data: { assetId: string; reason: string }, callback) => {
  if (!guest) return callback({ error: "Not registered" });

  await db.insert(assetReports).values({
    id: randomUUID(),
    assetId: data.assetId,
    reporterId: guest.id,
    reason: data.reason,
    createdAt: Date.now(),
  });

  // Auto-hide if 3+ reports
  const { assetReports: arTable } = await import("./db/schema.js");
  const reports = await db.select().from(arTable)
    .where(eq(arTable.assetId, data.assetId)).all();

  if (reports.length >= 3) {
    await db.update(assets)
      .set({ status: "removed", updatedAt: Date.now() })
      .where(eq(assets.id, data.assetId));
  }

  callback({ ok: true });
});
```

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: R2 client and asset CRUD socket events"
```

---

### Task 4: Add asset socket methods to the web client

**Files:**
- Modify: `apps/web/src/multiplayer/SocketClient.ts`

**Step 1: Add asset methods to SocketClient**

Add these methods to the SocketClient class:

```typescript
async createAsset(data: {
  type: "piece" | "sfx" | "music";
  title: string;
  metadata: string;
  needsUpload: boolean;
  contentType?: string;
  fileSize?: number;
}): Promise<{ id: string; uploadUrl?: string }> {
  return new Promise((resolve, reject) => {
    this.socket.emit("create-asset", data, (res: any) => {
      if (res.error) reject(new Error(res.error));
      else resolve(res);
    });
  });
}

async listMyAssets(type?: string): Promise<{ assets: any[] }> {
  return new Promise((resolve, reject) => {
    this.socket.emit("list-my-assets", { type }, (res: any) => {
      if (res.error) reject(new Error(res.error));
      else resolve(res);
    });
  });
}

async listGallery(type?: string): Promise<{ assets: any[] }> {
  return new Promise((resolve, reject) => {
    this.socket.emit("list-gallery", { type }, (res: any) => {
      if (res.error) reject(new Error(res.error));
      else resolve(res);
    });
  });
}

async publishAsset(assetId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    this.socket.emit("publish-asset", { assetId }, (res: any) => {
      if (res.error) reject(new Error(res.error));
      else resolve();
    });
  });
}

async deleteAsset(assetId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    this.socket.emit("delete-asset", { assetId }, (res: any) => {
      if (res.error) reject(new Error(res.error));
      else resolve();
    });
  });
}

async reportAsset(assetId: string, reason: string): Promise<void> {
  return new Promise((resolve, reject) => {
    this.socket.emit("report-asset", { assetId, reason }, (res: any) => {
      if (res.error) reject(new Error(res.error));
      else resolve();
    });
  });
}
```

**Step 2: Commit**

```bash
git add -A && git commit -m "feat: add asset CRUD methods to SocketClient"
```

---

### Task 5: Create the Creation Station hub page

**Files:**
- Create: `apps/web/src/app/create/page.tsx`

**Step 1: Create the hub route**

Create `apps/web/src/app/create/page.tsx`:

```tsx
import Link from "next/link";

const assetTypes = [
  {
    type: "piece",
    title: "Design a Piece",
    description: "Draw custom checker designs using shapes and freehand tools",
    href: "/create/piece",
    accent: "#FFD700",
  },
  {
    type: "sfx",
    title: "Upload Sound Effect",
    description: "Add custom sounds for dice rolls, moves, victories and more",
    href: "/create/sound",
    accent: "#006B3F",
  },
  {
    type: "music",
    title: "Upload Music",
    description: "Add background music tracks that play during games",
    href: "/create/music",
    accent: "#CE1126",
  },
];

export default function CreatePage() {
  return (
    <div className="animated-bg flex min-h-screen flex-col items-center justify-center px-4">
      <div className="rasta-stripe-bar fixed top-0 left-0 right-0 flex h-2 z-50">
        <div className="rasta-segment flex-1 bg-[#006B3F] origin-top" />
        <div className="rasta-segment flex-1 bg-[#FFD700] origin-top" />
        <div className="rasta-segment flex-1 bg-[#CE1126] origin-top" />
      </div>

      <h1 className="animate-fade-in font-heading text-3xl sm:text-4xl md:text-5xl text-[#FFD700] mb-2 tracking-wide title-glow">
        Creation Station
      </h1>
      <p className="animate-fade-in text-[#D4A857] text-lg mb-10 font-heading">
        Make it yours
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 w-full max-w-xs sm:max-w-3xl">
        {assetTypes.map((item, index) => (
          <Link
            key={item.type}
            href={item.href}
            className="animate-fade-in-up group rounded-2xl bg-[#2a2a1e] p-6 text-left shadow-lg game-card cursor-pointer"
            style={{
              borderWidth: "2px",
              borderStyle: "solid",
              borderColor: item.accent,
              animationDelay: `${(index + 1) * 0.1}s`,
            }}
          >
            <h3 className="font-heading text-2xl mb-2" style={{ color: item.accent }}>
              {item.title}
            </h3>
            <p className="text-[#F4E1C1] text-sm font-heading">{item.description}</p>
            <div
              className="mt-4 h-1 rounded-full opacity-60 transition-opacity duration-200 group-hover:opacity-100"
              style={{ backgroundColor: item.accent }}
            />
          </Link>
        ))}
      </div>

      <div className="flex gap-4 mt-10">
        <Link
          href="/my-stuff"
          className="text-[#D4A857] hover:text-[#FFD700] transition-colors text-lg min-h-[44px] flex items-center interactive-btn font-heading"
        >
          My Creations
        </Link>
        <span className="text-[#F4E1C1]/30 flex items-center">|</span>
        <Link
          href="/gallery"
          className="text-[#D4A857] hover:text-[#FFD700] transition-colors text-lg min-h-[44px] flex items-center interactive-btn font-heading"
        >
          Gallery
        </Link>
      </div>

      <Link
        href="/"
        className="mt-6 text-[#D4A857] hover:text-[#FFD700] transition-colors text-lg min-h-[44px] flex items-center interactive-btn font-heading"
      >
        &larr; Back to Menu
      </Link>

      <div className="rasta-stripe-bar fixed bottom-0 left-0 right-0 flex h-2 z-50">
        <div className="rasta-segment flex-1 bg-[#006B3F] origin-bottom" />
        <div className="rasta-segment flex-1 bg-[#FFD700] origin-bottom" />
        <div className="rasta-segment flex-1 bg-[#CE1126] origin-bottom" />
      </div>
    </div>
  );
}
```

**Step 2: Add Creation Station link to MainMenu**

Modify `apps/web/src/components/MainMenu.tsx` — add a link between "Play Online" and "Local Game":

```tsx
<Link
  href="/create"
  className="animate-fade-in-up animate-delay-350 w-full rounded-2xl wood-btn wood-btn-bamboo px-6 sm:px-8 py-3 sm:py-4 text-lg sm:text-xl font-bold text-[#1A1A0E] text-center shadow-lg interactive-btn hover:shadow-[0_0_20px_rgba(212,168,87,0.4)] font-heading"
>
  Creation Station
</Link>
```

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: creation station hub page and main menu link"
```

---

### Task 6: Piece designer page with tldraw

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/src/app/create/piece/page.tsx`
- Create: `apps/web/src/components/PieceDesigner.tsx`

**Step 1: Install tldraw**

```bash
cd apps/web && npm install tldraw
```

**Step 2: Create the PieceDesigner component**

Create `apps/web/src/components/PieceDesigner.tsx`. This is the core drawing component:

- Embeds tldraw with a constrained 128×128 viewport
- Shows a circular guide overlay for the piece boundary
- Has a "Preview" mode showing the piece at actual game size
- Exports SVG via tldraw's API
- Lets the user design Gold and Red variants (tab between them)

Key implementation notes:
- Use `dynamic(() => import('tldraw'), { ssr: false })` for Next.js compatibility
- Lock camera: `<Tldraw camera={{ x: 0, y: 0, z: 1 }} options={{ ...lockCamera }}>`
- Custom toolbar: hide default tldraw UI, show simplified tools (draw, rectangle, ellipse, arrow, eraser, color picker)
- SVG export: `editor.getSvgString({ ids: editor.getCurrentPageShapeIds() })`
- Auto-tint option: duplicate Gold SVG and hue-shift for Red variant

**Step 3: Create the piece designer page**

Create `apps/web/src/app/create/piece/page.tsx`:

- Wraps PieceDesigner with the standard page chrome (rasta stripes, heading, back link)
- Has a title input field
- Save button that: extracts SVG, creates asset via SocketClient, navigates to /my-stuff
- Preview panel showing the piece at various sizes (40px, 30px, 20px) on a mini board mockup

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: piece designer page with tldraw canvas"
```

---

### Task 7: Sound effect upload page

**Files:**
- Create: `apps/web/src/app/create/sound/page.tsx`

**Step 1: Create the SFX upload page**

Create `apps/web/src/app/create/sound/page.tsx`:

- File input accepting `.mp3,.wav` with drag-and-drop zone
- Client-side validation: max 5 seconds duration, max 2MB file size
- Duration check via `new Audio()` element and `loadedmetadata` event
- Dropdown to pick SFX slot: dice-roll, piece-move, piece-hit, bear-off, victory, defeat, double-offered, turn-start
- Preview button that plays the audio
- Title input
- Save flow: call `createAsset()` with `needsUpload: true`, get presigned URL, upload to R2 via `fetch(url, { method: 'PUT', body: file })`, navigate to /my-stuff

**Step 2: Commit**

```bash
git add -A && git commit -m "feat: sound effect upload page"
```

---

### Task 8: Music upload page

**Files:**
- Create: `apps/web/src/app/create/music/page.tsx`

**Step 1: Create the music upload page**

Very similar to the SFX page but with different constraints:

- File input: `.mp3` only
- Max 3 minutes, max 10MB
- Preview with play/pause controls and a progress bar
- Title input
- Same upload flow via presigned URLs

**Step 2: Commit**

```bash
git add -A && git commit -m "feat: music upload page"
```

---

### Task 9: My Stuff page (personal collection)

**Files:**
- Create: `apps/web/src/app/my-stuff/page.tsx`

**Step 1: Create the personal collection page**

- Connects via SocketClient, calls `listMyAssets()`
- Tab filter: All / Pieces / Sound Effects / Music
- Grid display of assets with:
  - Pieces: SVG thumbnail preview
  - Audio: play button + duration label
  - Title, creation date
  - "Equip" toggle button (saves to localStorage)
  - "Publish" button (if status is private)
  - "Delete" button with confirmation
- Currently equipped assets shown with a highlight/badge
- Empty state: "No creations yet — head to the Creation Station!"

**Step 2: Commit**

```bash
git add -A && git commit -m "feat: my-stuff personal collection page"
```

---

### Task 10: Gallery page (public assets)

**Files:**
- Create: `apps/web/src/app/gallery/page.tsx`

**Step 1: Create the gallery page**

- Calls `listGallery()` — no auth required to browse
- Same tab filter and grid display as My Stuff
- "Equip" button to use someone else's published asset
- "Report" button (opens a reason dropdown: inappropriate, offensive, spam)
- Creator name shown on each card
- No edit/delete (those are only on My Stuff)

**Step 2: Commit**

```bash
git add -A && git commit -m "feat: public gallery page"
```

---

### Task 11: Asset preferences in localStorage

**Files:**
- Create: `apps/web/src/lib/assetPreferences.ts`

**Step 1: Create the preferences module**

Create `apps/web/src/lib/assetPreferences.ts`:

```typescript
const PREFS_KEY = "backyamon_custom_assets";

export interface AssetPreferences {
  pieceSet?: string; // asset ID or null for default
  sfx?: Partial<Record<string, string>>; // slot → asset ID
  music?: string; // asset ID or null for default
}

export function getAssetPreferences(): AssetPreferences {
  if (typeof window === "undefined") return {};
  const raw = localStorage.getItem(PREFS_KEY);
  return raw ? JSON.parse(raw) : {};
}

export function setAssetPreference(
  key: keyof AssetPreferences,
  value: AssetPreferences[typeof key]
): void {
  const prefs = getAssetPreferences();
  (prefs as any)[key] = value;
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

export function clearAssetPreference(key: keyof AssetPreferences): void {
  const prefs = getAssetPreferences();
  delete prefs[key];
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}
```

**Step 2: Commit**

```bash
git add -A && git commit -m "feat: asset preferences localStorage module"
```

---

### Task 12: PieceRenderer — custom SVG piece support

**Files:**
- Modify: `apps/web/src/game/PieceRenderer.ts`

**Step 1: Add custom SVG rendering path**

Update the `PieceSet` type and `createPiece()` method:

```typescript
export type PieceSet = "coconut" | "vinyl" | "lion" | "custom";

// Add to class:
private customSvgs: { gold: string; red: string } | null = null;
private textureCache: Map<string, Texture> = new Map();

setCustomSvgs(gold: string, red: string): void {
  this.customSvgs = { gold, red };
}

private createPiece(player: Player, radius: number): Container {
  switch (this.pieceSet) {
    case "custom":
      return this.createCustomPiece(player, radius);
    case "coconut":
      return this.createCoconutPiece(player, radius);
    case "vinyl":
      return this.createVinylPiece(player, radius);
    case "lion":
    default:
      return this.createLionPiece(player, radius);
  }
}

private createCustomPiece(player: Player, radius: number): Container {
  const container = new Container();
  const svgStr = player === Player.Gold ? this.customSvgs?.gold : this.customSvgs?.red;

  if (!svgStr) return this.createLionPiece(player, radius); // fallback

  const cacheKey = `${player}-${radius}`;
  let texture = this.textureCache.get(cacheKey);

  if (!texture) {
    // Create texture from SVG string
    const blob = new Blob([svgStr], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    texture = Texture.from(url);
    this.textureCache.set(cacheKey, texture);
  }

  const sprite = new Sprite(texture);
  sprite.width = radius * 2;
  sprite.height = radius * 2;
  sprite.anchor.set(0.5);
  container.addChild(sprite);

  return container;
}
```

**Step 2: Load custom pieces on game init**

Modify `apps/web/src/components/GameCanvas.tsx` and `OnlineGameCanvas.tsx` — in the init function, after creating the controller, check asset preferences:

```typescript
import { getAssetPreferences } from "@/lib/assetPreferences";

// Inside init(), after controller is created:
const prefs = getAssetPreferences();
if (prefs.pieceSet) {
  // Fetch the piece asset metadata to get SVG strings
  // Pass to controller's pieceRenderer
}
```

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: custom SVG piece rendering in PieceRenderer"
```

---

### Task 13: SoundManager — custom audio loading

**Files:**
- Modify: `apps/web/src/audio/SoundManager.ts`

**Step 1: Add custom SFX and music loading methods**

Add to SoundManager class:

```typescript
private customHowls: Map<string, Howl> = new Map();
private customMusic: Howl | null = null;

loadCustomSFX(slot: SFXName, url: string): void {
  const howl = new Howl({
    src: [url],
    volume: this._volume,
    preload: true,
    onloaderror: () => {
      this.customHowls.delete(slot);
    },
  });
  this.customHowls.set(slot, howl);
}

loadCustomMusic(url: string): void {
  this.customMusic = new Howl({
    src: [url],
    volume: this._volume * 0.4,
    loop: true,
    preload: true,
  });
}
```

**Step 2: Update playSFX to check custom sounds first**

```typescript
playSFX(name: SFXName): void {
  if (this.destroyed || this._muted) return;

  // Try custom SFX first
  const custom = this.customHowls.get(name);
  if (custom) {
    custom.volume(this._volume);
    custom.play();
    return;
  }

  // ... existing Howl and synthetic fallback logic
}
```

**Step 3: Update startMusic to use custom track if loaded**

```typescript
startMusic(): void {
  this.resumeContext();
  if (this.customMusic) {
    this.customMusic.play();
  } else {
    this.music.start();
  }
  this.startAmbience();
}

stopMusic(): void {
  if (this.customMusic) {
    this.customMusic.stop();
  } else {
    this.music.stop();
  }
  this.stopAmbience();
}
```

**Step 4: Load preferences on init**

Add to `GameCanvas.tsx` and `OnlineGameCanvas.tsx` init:

```typescript
const prefs = getAssetPreferences();
if (prefs.sfx) {
  for (const [slot, assetId] of Object.entries(prefs.sfx)) {
    // Fetch asset URL and call soundManager.loadCustomSFX(slot, url)
  }
}
if (prefs.music) {
  // Fetch asset URL and call soundManager.loadCustomMusic(url)
}
```

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: custom SFX and music loading in SoundManager"
```

---

### Task 14: Integration testing and polish

**Step 1: End-to-end flow testing**

Test manually:
1. Create a piece via `/create/piece` → verify SVG saved, appears in `/my-stuff`
2. Upload an SFX via `/create/sound` → verify file in R2, appears in `/my-stuff`
3. Upload music via `/create/music` → verify same
4. Equip each type → start a singleplayer game → verify custom assets load
5. Publish a piece → verify it appears in `/gallery`
6. Equip from gallery → verify it works in game
7. Report an asset → verify report is recorded

**Step 2: Error handling**

- Asset loading failures fall back gracefully to defaults
- Upload failures show clear error messages
- Oversized/wrong-format files rejected client-side before upload

**Step 3: Commit**

```bash
git add -A && git commit -m "fix: polish and error handling for creation station"
```
