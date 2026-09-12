# 06 — File Watcher & Auto-Tracking

The watcher agent (`pixelhub-watch`) is what makes project state **derived, not manual**. It watches the local project folder and keeps PixelHub in sync.

## 1. Agent Overview

- **Package:** `apps/watcher` — Node 20 CLI, TypeScript, distributed as npm binary (`npx pixelhub-watch`) and later as signed installers.
- **Core libs:** `chokidar` (watching), `crypto` (SHA-256), `p-queue` (upload concurrency), `conf` (local config).
- **Config file:** `<projectRoot>/.pixelhub/config.json` + global `~/.pixelhub/credentials.json`.
- **Ignore rules:** `.pixelhubignore` (gitignore syntax) — defaults seeded: `node_modules`, `.git`, OS junk, temp files (`~$*`, `*.tmp`), cache dirs.

## 2. Pairing Flow

```
Web UI: Settings → "Pair new device" → shows 8-char code (expires 10 min)
User runs:  pixelhub-watch pair
            → asks: server URL (default prod), pairing code, local folder path
Agent:      POST /watchers/exchange {code, deviceName}
            ← { watcherToken, projectId, projectSlug, serverConfig }
Agent:      writes .pixelhub/config.json, starts watching
Server:     creates WatcherDevice row; UI shows "Maya's MacBook · online"
```

Revocation: `DELETE /watchers/:id` → token rejected on next request → agent exits with a clear re-pair message.

## 3. Watch Loop

```
start
 ├─ 1. Initial scan: walk folder (respecting .pixelhubignore), hash every file,
 │      build local manifest {path, sha256, size, mtime}
 ├─ 2. Reconcile: POST /files/ingest {events: fullManifest, mode:"full"}
 │      server replies which blobs it needs → upload queue
 ├─ 3. Watch (chokidar, awaitWriteFinish: 750ms stability threshold)
 │      events: add / change / unlink / rename(move detection)
 ├─ 4. Debounce bursts (e.g. Figma/PS export storms) → batch every 2s
 └─ 5. POST /files/ingest {events:[...], mode:"delta"} → upload → confirm
```

### Event → Server Mapping
| Local event | Sent as | Server action |
|---|---|---|
| new file | `{type:"created", path, sha256, size}` | upsert `File`, upload if new hash, run pipeline |
| modified | `{type:"modified", path, sha256}` | new `File` revision (same path, new sha256 row) |
| deleted | `{type:"deleted", path}` | soft-delete `File` |
| move/rename | `{type:"moved", from, to, sha256}` | update path (matched by sha256) |

## 4. Upload Pipeline (per confirmed file)

Server-side BullMQ chains:

```
file.confirmed
  ├─ queue:previews   → sharp thumbnails + dominant colors → FilePreview, File.imageMeta
  ├─ queue:matching   → auto-match to deliverables (§5)
  └─ queue:ai         → BRAND_CHECK (if kind ∈ {EXPORT, DELIVERABLE} and kit exists)
        └─ on FAIL/WARNING → notification + Pulse "needs attention"
```

## 5. Auto-Matching Engine (`matcher` service) — the core "auto-tracked deliverables" feature

Runs for every new/modified file. Two stages:

### Stage A — Deterministic rule matching (fast, free)
For each `ACCEPTED` requirement → open deliverables with `filePatterns`:
```
1. Glob match fileName against patterns:  "instagram_post_03.png" vs "instagram_post_*.{png,jpg}"  ✓
2. Path boost: files under /exports or /deliverables score higher
3. Duplicate guard: if deliverable already SATISFIED by same-named newer file → mark old link SUPERSEDED
4. On match: INSERT RequirementFileLink(matchedBy=WATCHER_RULE, confidence=1.0)
             deliverable.status = SATISFIED, satisfiedByFileId = file
             recompute requirement coverage → maybe FULFILLED
             Activity: requirement.fulfilled → Pulse toast "Instagram Posts 3/3 ✓"
```

### Stage B — AI matching (fallback, opt-in per project)
If Stage A matched nothing and file is in `/exports` or `/deliverables`:
- Enqueue `MATCH_FILE` with: filename, folder, image thumbnail (vision), open deliverables list.
- Model returns `{deliverableId, confidence, rationale}` — accepted automatically only if `confidence ≥ 0.85`; otherwise surfaced as a *suggestion* on the requirement row ("Did you mean to link this? [Link] [Ignore]").
- Result: `RequirementFileLink(matchedBy=AI, confidence)`.

### Feedback loop
When a user **manually links** a file → server suggests updating the deliverable's `filePatterns` to cover this filename pattern (one-click "Always match files like this") → future matches become deterministic.

## 6. Branch Switch Reconciliation

On `POST /branches/:id/switch`, server returns target manifest. Agent diff:

| Case | Agent behavior |
|---|---|
| Local file == target | nothing |
| Missing locally | download to folder |
| Local differs from target **and** local == previous known manifest | overwrite with target version (safe) |
| Local differs from target **and** has unsynced changes | **conflict** → keep local as `<name>.conflict-<branch>.<ext>`, download target, notify user |

## 7. Offline & Failure Handling

- Offline → events queued in local SQLite (`queue.db`), flushed FIFO on reconnect with original timestamps.
- Upload retries: 5 attempts, exponential backoff; per-blob resume via multipart parts.
- Hash dedupe: if sha256 already exists server-side, upload skipped — instant "sync".
- Heartbeat every 60s → `WatcherDevice.lastSeenAt` (UI status pill).

## 8. Performance Limits (MVP)

- Folders up to ~20k files / 10 GB.
- Max single file: 2 GB (multipart).
- Ignore binary巨型 source files from AI analysis (only hashes + metadata; previews attempted for psd/ai via converters only if available, else generic icon).

## 9. Security

- Token scoped to one project, stored OS-keychain where available.
- TLS everywhere; server never receives raw folder paths beyond project-relative paths (privacy).
- `.pixelhubignore` always honored locally — nothing ignored ever leaves the machine.
