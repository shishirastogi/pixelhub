# 05 — Versioning & Branching Model

Git's power, designer's vocabulary. No commits, rebases, or conflicts — instead: **branches, snapshots, adoption, comparison**.

## 1. Concepts & Vocabulary Mapping

| Designer term (UI) | Engineer term (code/DB) | Meaning |
|---|---|---|
| Branch | `Branch` | A line of exploration: Main Concept, Concept A, Client Revision, Experimental |
| Version / Snapshot | `Version` | Immutable named snapshot of the branch's files at a moment |
| Adopt into Main | merge | Bring another branch's files onto a target branch as a new version |
| Switch branch | checkout | Change which branch is "live"; watcher reconciles the local folder |
| Restore | revert | Create a *new* version copying an old version's file set (never rewrite history) |
| Branch kinds | `MAIN / CONCEPT / REVISION / EXPERIMENTAL` | Purely semantic labels with colors; MAIN is protected |

## 2. Data Model Recap

- `Branch` → belongs to project, has `headVersionId`, `parentBranchId`, `kind`, `status`.
- `Version` → append-only, `(branchId, number)` unique, `checksum` = hash of `(path, fileSha256)` pairs.
- `VersionFile` → immutable join between version and files; **files are content-addressed by SHA-256**, so storage is deduplicated across versions/branches automatically.

## 3. Default Structure on Project Creation

1. Create project.
2. Create branch **"Main Concept"** (`kind=MAIN`, slug `main`) → set as `defaultBranchId`.
3. Create branch **"Experimental"** (`kind=EXPERIMENTAL`) as an always-available sandbox (optional per wizard choice).
4. First version `v1` ("Project start") is created on Main as soon as the first files are ingested.

## 4. Core Operations

### 4.1 Create Branch ("New branch")
```
Input: name, kind, fromBranchId (default: current)
1. INSERT Branch (parentBranchId = fromBranch)
2. Copy head version's VersionFile rows into a new v1 Version on the new branch
   → branch instantly has full file context, zero blob copying (content-addressed)
3. Activity: branch.created
```

### 4.2 Snapshot ("Snapshot version")
```
1. Gather live files for branch: File WHERE branchId AND deletedAt IS NULL
2. checksum = sha256(join(sort(path + ':' + sha256)))
3. IF checksum == headVersion.checksum → 409 "No changes since v{n}"
4. INSERT Version(number = prev+1, checksum, parent = head)
5. INSERT VersionFile rows; UPDATE Branch.headVersionId
6. Enqueue AI: summarize delta vs parent → Version.aiSummary (async)
7. Activity: version.created
```

### 4.3 Switch Branch
- Server: sets `defaultBranchId`, returns to watcher a **target manifest** (list of `path → sha256` for branch head).
- Watcher: reconciles local folder: downloads missing/changed files to a staging subfolder, never silently overwrites unsynced local changes — conflicts surfaced to user (see `06 §6`).
- UI: all tabs refetch scoped to new branch.

### 4.4 Adopt into Main (Merge)
```
Input: sourceBranchId, targetBranchId (default MAIN), optional fileSelection
1. Determine file set: source live files (or user's selection)
2. On target branch:
   - for each selected path: upsert File row (same sha256 → reuse; new content → new File row pointing at same/new S3 blob)
   - paths deleted in source stay untouched in MVP (no destructive merges)
3. Create Version on target with sourceBranchId/sourceVersionId set
4. Source branch status → MERGED (optional)
5. Activity: branch.merged → feeds merge-frequency analytics
```
MVP conflict policy: if the same path diverged on both branches, UI shows both thumbnails and the picker pre-selects the source ("adopt" intent); user can override per file.

### 4.5 Restore
Creates a new head version whose `VersionFile` rows are copied from the chosen old version + marks superseded live files as deleted (soft). History is never mutated.

### 4.6 Branch Lifecycle States
`ACTIVE → APPROVED` (client signed off this direction) · `ACTIVE → MERGED` (adopted) · `ACTIVE → ABANDONED` (kept for history, grayed out).

## 5. Version Comparison (Mechanical Layer)

`POST /versions/compare` produces a structured `diffJson`; AI explanation builds on this (see `07 §3`):

```json
{
  "files": {
    "added":   [{ "path": "exports/banner_v2.png", "fileId": "…" }],
    "removed": [{ "path": "exports/old_hero.jpg" }],
    "modified":[{ "path": "exports/instagram_post_01.png", "fromFileId": "…", "toFileId": "…" }],
    "renamed": [{ "from": "a.png", "to": "b.png", "confidence": 0.98 }]
  },
  "colors":    { "dominantBefore": ["#E11D48"], "dominantAfter": ["#2563EB"], "paletteShift": "warm→cool" },
  "typography":{ "detectedFontsBefore": ["Inter"], "detectedFontsAfter": ["Inter", "Playfair Display"] },
  "counts":    { "filesBefore": 42, "filesAfter": 45 }
}
```
Rename detection: same `sha256`, different path → rename (confidence 1.0); similar path + similar size → candidate rename. Color/typography facets come from `File.imageMeta` (sharp palette extraction) and AI vision on key deliverables.

## 6. Timeline UI Rules

- Versions show as cards: `v4 · "Client round 1" · 12 files · 2h ago · ✨ AI summary`.
- Merge versions carry a link badge: "adopted from Concept A v3".
- Branches displayable as a simple horizontal graph (branch lanes, nodes = versions, arrows = adoption). MVP: list-per-branch; graph in Phase 2.

## 7. Storage Strategy

- Blobs in S3 keyed by `sha256` (`blobs/ab/cd/abcd…`) → automatic cross-version/cross-branch dedupe.
- Previews (`sharp`): `previews/<fileId>/<kind>.webp`.
- Retention: soft-deleted files' blobs purged after 30 days by a cleanup job, **unless** referenced by any `VersionFile`.

## 8. Edge Cases

| Case | Handling |
|---|---|
| Snapshot with zero files | Allowed ("empty start") |
| Identical snapshot | Rejected 409 (checksum dedupe) |
| File deleted locally | Watcher sends `deleted` event → `File.deletedAt` set; next snapshot excludes it |
| Same file on 2 branches | One blob, two `File` rows (per-branch path independence) |
| Adopt when target has newer edits | File-picker conflict UI; explicit user choice required |
| Watcher offline during snapshots | Versions only capture *known* file state; sync backlog processed first |
