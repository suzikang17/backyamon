# Creation Station — Design Document

## Overview

A community creation system where players design custom game assets — piece artwork, sound effects, and music tracks — using in-browser tools and file uploads. Creations are personal by default with an option to publish to a public gallery.

## Decisions

- **Individual assets**, not themed packs. Players submit one piece design, one SFX, etc. Mix and match freely.
- **Drawing tool**: tldraw embedded with shape + freehand modes for piece design. Constrained canvas with SVG export.
- **Audio**: File upload (MP3/WAV) for v1. In-browser audio tool is a future enhancement.
- **Curation**: Personal-first. Creations are private until the creator publishes them. Community gallery with reporting for moderation.
- **Storage**: Cloudflare R2 for binary assets, Turso (hosted libSQL) for all metadata. Migrate existing SQLite (guests, matches) to Turso at the same time.
- **Architecture**: New routes in the existing Next.js app (`/create/*`, `/gallery`). tldraw loaded via dynamic import to avoid bloating the game bundle.

## Asset Types

### Piece Designs

- **Canvas**: Fixed 128×128 SVG viewport in tldraw, circular guide showing the piece boundary
- **Variants**: Creator designs both Gold and Red versions (or designs one and we auto-tint the other)
- **Output**: SVG string stored as text in Turso, PNG thumbnail rasterized and stored in R2 for gallery display
- **In-game rendering**: PixiJS loads SVG as a texture via `Texture.from(svgString)`. PieceRenderer gets a new `custom` piece set path alongside the existing procedural sets (coconut, vinyl, lion)
- **Constraints**: Must read clearly at small sizes (~20–40px diameter on mobile). Gallery preview shows actual in-game size.

### Sound Effects

- **Upload**: MP3 or WAV, max 5 seconds, max 2MB
- **SFX slots**: Creator picks which game event the sound replaces: `dice-roll`, `piece-move`, `piece-hit`, `bear-off`, `victory`, `defeat`, `double-offered`, `turn-start`
- **Storage**: Audio file in R2, metadata (title, slot, creator, R2 URL) in Turso
- **In-game loading**: SoundManager gets a method to load custom SFX URLs. Falls back to default MP3/synth if custom asset fails to load.

### Music Tracks

- **Upload**: MP3 only, max 3 minutes, max 10MB. Should loop cleanly (creator responsibility).
- **Storage**: Audio file in R2, metadata in Turso
- **In-game playback**: Replaces the procedural MusicEngine output. Loaded via Howler.js with `loop: true`. Player picks their track in a settings/customization screen before starting a game.

## Data Model (Turso)

### New Tables

```sql
assets (
  id          TEXT PRIMARY KEY,     -- UUID
  creator_id  TEXT NOT NULL,        -- FK → guests.id
  type        TEXT NOT NULL,        -- 'piece' | 'sfx' | 'music'
  title       TEXT NOT NULL,        -- Creator-chosen name
  status      TEXT NOT NULL,        -- 'private' | 'published' | 'removed'
  metadata    TEXT,                 -- JSON: type-specific data (sfx_slot, svg_gold, svg_red, etc.)
  r2_key      TEXT,                 -- R2 object key for binary assets (audio files, thumbnails)
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
)

asset_reports (
  id          TEXT PRIMARY KEY,
  asset_id    TEXT NOT NULL,        -- FK → assets.id
  reporter_id TEXT NOT NULL,        -- FK → guests.id
  reason      TEXT NOT NULL,
  created_at  INTEGER NOT NULL
)
```

### Metadata JSON by Type

- **piece**: `{ svg_gold: string, svg_red: string, thumbnail_key: string }`
- **sfx**: `{ slot: string, duration_ms: number, file_size: number }`
- **music**: `{ duration_ms: number, file_size: number }`

### Existing Tables (migrated to Turso)

`guests` and `matches` move to Turso unchanged. The migration is: export SQLite → import to Turso, update the Drizzle connection config.

## Routes & Pages

| Route | Purpose |
|-------|---------|
| `/create` | Hub page — choose what to create (piece, SFX, music) |
| `/create/piece` | tldraw canvas for designing pieces + preview + save |
| `/create/sound` | Upload SFX, pick slot, preview, save |
| `/create/music` | Upload music track, preview, save |
| `/my-stuff` | Personal collection — all your creations, equip/unequip |
| `/gallery` | Public gallery — browse published assets, search, equip |

## Key Flows

### Creating a Piece

1. User navigates to `/create/piece`
2. tldraw canvas loads with 128×128 viewport, circular guide overlay
3. User draws using shapes and/or freehand tools
4. User clicks "Preview" → see the piece rendered at actual game size on a mini board mockup
5. User names the piece, saves → SVG extracted from tldraw, stored in Turso. PNG thumbnail rasterized and uploaded to R2.
6. Piece appears in `/my-stuff` and can be equipped for games.

### Uploading Audio

1. User navigates to `/create/sound` or `/create/music`
2. User drags/drops or selects a file. Client-side validation (format, size, duration).
3. Preview playback in browser.
4. For SFX: pick which slot it replaces from a dropdown.
5. User names it, saves → file uploaded to R2 via presigned URL, metadata written to Turso.
6. Appears in `/my-stuff`.

### Equipping Assets

1. User visits `/my-stuff` (or `/gallery` for published assets)
2. Clicks "Use This" on any asset
3. Preference stored in `localStorage` (and optionally synced to Turso guest record): `{ pieceSet: assetId, sfx: { dice-roll: assetId, ... }, music: assetId }`
4. GameCanvas and SoundManager read these preferences on init and load custom assets

### Publishing to Gallery

1. From `/my-stuff`, creator clicks "Publish" on an asset
2. Asset status changes from `private` to `published`
3. Appears in `/gallery` for all users
4. Other users can report inappropriate content → creates `asset_reports` row
5. Auto-hide after N reports (simple threshold-based moderation)

## Technical Details

### tldraw Integration

- Dynamic import: `const Tldraw = dynamic(() => import('@tldraw/tldraw'), { ssr: false })`
- Custom UI: hide tldraw's default toolbar, show a simplified palette (basic shapes, freehand, color picker, eraser)
- Fixed canvas: lock zoom/pan, set viewport to 128×128
- SVG export: use tldraw's `editor.getSvgString()` API

### R2 Upload Flow

1. Client requests a presigned upload URL from the server (`POST /api/assets/upload-url`)
2. Server generates a presigned PUT URL via R2 SDK, returns it
3. Client uploads directly to R2 using the presigned URL (no file passes through the server)
4. Client confirms upload to server with the R2 key
5. Server writes asset metadata to Turso

### PieceRenderer Changes

- Add a `custom` branch to `createPiece()` that loads an SVG texture instead of drawing procedurally
- Cache textures per asset ID to avoid re-parsing SVGs each render
- Fallback to the default piece set (lion) if custom SVG fails to load

### SoundManager Changes

- Add `loadCustomSFX(slot: string, url: string)` method
- Custom SFX loaded via Howler.js from R2 URLs
- Add `loadCustomMusic(url: string)` method that bypasses the procedural MusicEngine
- Preferences read from localStorage on init

## Out of Scope (v1)

- Board color themes / custom board designs
- In-browser audio creation tool
- Themed asset packs / bundles
- Voting / ranking in the gallery
- Asset comments or social features
- Animated pieces
- Opponent seeing your custom assets (your customizations are local to you)
