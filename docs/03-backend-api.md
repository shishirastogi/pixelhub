# 03 — Backend Implementation Plan & API

## 1. Module Breakdown

Each module = one folder under `apps/web/server/modules/<name>/` containing `router.ts` (endpoints), `service.ts` (business logic), `repo.ts` (Prisma queries). All request/response bodies validated with zod schemas from `packages/types`.

| Module | Responsibility |
|---|---|
| `auth` | signup, login, magic link, sessions |
| `projects` | project CRUD, pulse summary, members |
| `briefs` | brief CRUD, trigger AI extraction |
| `requirements` | requirement + deliverable CRUD, accept/reject AI proposals, coverage calc |
| `branches` | branch CRUD, switch, merge ("adopt"), archive |
| `versions` | create snapshot, list history, compare trigger, timeline |
| `files` | ingest from watcher, web upload (pre-signed URLs), previews, linking to requirements |
| `brandkit` | brand kit CRUD, brand check trigger, results |
| `design-sheet` | canvas items CRUD, bulk position updates |
| `decisions` | decision log CRUD |
| `comments` | comments/threads, resolve, convert-to-task |
| `tasks` | task CRUD, checklist, auto-generated tasks |
| `ai` | AiJob submission, status polling, provider abstraction |
| `analytics` | pulse dashboard data, rollup computation |
| `watchers` | device pairing, sync protocol endpoints |
| `activity` | activity feed, event emission helper used by all modules |

**Cross-cutting:** `ActivityService.emit(type, entity, meta)` called inside every mutation — single funnel feeding analytics + activity feed.

## 2. REST API Endpoints

Base: `/api/v1`. Auth via session cookie (web) or `Authorization: Bearer <watcher token>` (agent).

### Auth
| Method & Path | Function |
|---|---|
| `POST /auth/signup` | create account + default workspace |
| `POST /auth/login` | email+password → session cookie |
| `POST /auth/magic-link` | send login email |
| `POST /auth/logout` | kill session |
| `GET /auth/me` | current user + project memberships |

### Projects & Pulse
| Method & Path | Function |
|---|---|
| `GET /projects` | list my projects (role included) |
| `POST /projects` | create project → auto-creates `main` branch ("Main Concept") + empty BrandKit |
| `GET /projects/:id` | project detail |
| `PATCH /projects/:id` | rename, deadline, status, aiEnabled |
| `DELETE /projects/:id` | soft delete |
| `GET /projects/:id/pulse` | **Project Pulse**: `{deliverables:{done,total}, requirementCoveragePct, openTasks, currentBranch, latestVersion, attentionItems[]}` — attention items computed server-side (unmet requirements past due, failing brand checks, stale branches) |
| `GET /projects/:id/activity` | paginated activity feed |

### Brief & Requirements
| Method & Path | Function |
|---|---|
| `PUT /projects/:id/brief` | create/replace brief text (or link brief file) |
| `POST /projects/:id/brief/extract` | enqueue `EXTRACT_REQUIREMENTS` AiJob → returns jobId |
| `GET /projects/:id/requirements?status=` | list requirements with live coverage (`deliverablesSatisfied/total`) |
| `POST /projects/:id/requirements` | manual create |
| `PATCH /requirements/:id` | edit, accept AI proposal (`status: ACCEPTED`) |
| `DELETE /requirements/:id` | reject/remove |
| `POST /requirements/:id/generate-tasks` | enqueue `GENERATE_TASKS` AI job for checklist |
| `GET /requirements/:id/files` | linked files (traceability view) |
| `POST /requirements/:id/link-file` | manual link `{fileId}` |
| `DELETE /requirements/:id/link-file/:fileId` | unlink |
| `POST /requirements/:id/deliverables` | add deliverable with filePatterns |
| `PATCH /deliverables/:id` | edit patterns/quantity |
| `POST /deliverables/:id/rematch` | re-run matcher against existing files |

### Branches & Versions
| Method & Path | Function |
|---|---|
| `GET /projects/:id/branches` | branch list with head version + file counts |
| `POST /projects/:id/branches` | create `{name, kind, fromBranchId}` → seeds first version by copying head `VersionFile` rows |
| `PATCH /branches/:id` | rename, set status (`APPROVED`, `ABANDONED`) |
| `POST /branches/:id/switch` | set project `defaultBranchId`; returns watcher sync payload so the local folder can be reconciled |
| `POST /branches/:id/merge` | "Adopt into Main": creates a version on target branch whose file-set = union/file-selection; records `sourceBranchId/VersionId` |
| `GET /branches/:id/versions` | version timeline for branch |
| `POST /branches/:id/versions` | create snapshot `{label, note}` from current live file set of that branch; computes checksum; dedupes no-op snapshots |
| `GET /versions/:id` | detail + files + aiSummary |
| `POST /versions/compare` | `{baseVersionId, targetVersionId}` → returns cached `VersionComparison` or enqueues `COMPARE_VERSIONS` job |
| `GET /versions/compare/:jobId` | poll comparison result |

### Files
| Method & Path | Function |
|---|---|
| `POST /projects/:id/files/ingest` | **watcher**: batch of `{path, sha256, size, event: created/modified/deleted}`; server diffs vs known state, returns `{uploadUrls: [{path, presignedUrl}]}`, then watcher PUTs blobs to S3 and calls `POST /files/confirm` |
| `POST /projects/:id/files/upload-url` | web upload: pre-signed PUT |
| `POST /projects/:id/files/confirm` | finalize upload → create File row → enqueue preview + match + brand-check jobs |
| `GET /projects/:id/files?kind=&branchId=&q=` | file browser |
| `GET /files/:id` | detail + previews + linked requirements + brand check status |
| `DELETE /files/:id` | soft delete (keeps version history intact) |
| `GET /files/:id/download` | pre-signed GET |
| `POST /files/:id/recheck-brand` | enqueue `BRAND_CHECK` |

### Brand Kit
| Method & Path | Function |
|---|---|
| `GET /projects/:id/brand-kit` | kit with colors/fonts/logos/rules |
| `PUT /projects/:id/brand-kit` | upsert full kit (simple MVP: whole-object save) |
| `POST /projects/:id/brand-kit/check` | run checks against all current exports (or `{fileIds}` subset) |
| `GET /projects/:id/brand-checks` | results list, filter by status/severity |
| `POST /brand-checks/:id/resolve` | mark finding handled |

### Design Sheet
| Method & Path | Function |
|---|---|
| `GET /projects/:id/design-sheet` | all items |
| `POST /projects/:id/design-sheet` | add item (image/url/note/color/file ref) |
| `PATCH /design-sheet/:itemId` | edit / move (position) / link to decision or requirement |
| `DELETE /design-sheet/:itemId` | remove |
| `POST /projects/:id/design-sheet/positions` | bulk save drag-drop layout |

### Decisions
| `GET/POST /projects/:id/decisions`, `PATCH /decisions/:id` | decision log CRUD + status transitions (`PROPOSED→DECIDED→SUPERSEDED`) |

### Comments & Tasks
| Method & Path | Function |
|---|---|
| `GET /versions/:id/comments` | comments on a version (with anchors) |
| `POST /comments` | create `{versionId?, fileId?, body, anchor?}` |
| `POST /comments/:id/resolve` / `POST /comments/:id/convert-to-task` | review loop |
| `GET /projects/:id/tasks?status=` | task board data |
| `POST /projects/:id/tasks` | create |
| `PATCH /tasks/:id` | status/assignee/edits |

### AI Jobs
| Method & Path | Function |
|---|---|
| `POST /projects/:id/ai/status-narrative` | enqueue PROJECT_STATUS_NARRATIVE ("explain where this project stands") |
| `GET /ai-jobs/:id` | status + result (polled by UI) |
| `GET /projects/:id/ai-jobs` | job history + token usage |

### Analytics
| Method & Path | Function |
|---|---|
| `GET /projects/:id/analytics/versions` | version cadence, revisions per deliverable |
| `GET /projects/:id/analytics/requirements` | fulfilled vs outstanding over time |
| `GET /projects/:id/analytics/files` | required vs produced, type distribution, duplicates, outdated |
| `GET /projects/:id/analytics/collaboration` | activity, review turnaround |
| `POST /projects/:id/analytics/recompute` | force rollup rebuild |

### Watchers (device pairing & sync)
| Method & Path | Function |
|---|---|
| `POST /projects/:id/watchers/pair` | web: generates 8-char pairing code |
| `POST /watchers/exchange` | agent: code → long-lived watcher token |
| `GET /watchers/config` | agent: project state — ignore rules, current branch, known path/manifest |
| `DELETE /watchers/:id` | revoke device |

## 3. Background Jobs (BullMQ queues)

| Queue | Job | Trigger | Output |
|---|---|---|---|
| `previews` | generate thumbs via `sharp` + dominant color extraction | file confirmed | `FilePreview` rows, `File.imageMeta` |
| `matching` | auto-match file → deliverables/requirements | file confirmed | `RequirementFileLink`, deliverable status |
| `ai` | EXTRACT_REQUIREMENTS | brief saved + user clicks Extract | PENDING `Requirement`s + `Deliverable`s with filePatterns |
| `ai` | GENERATE_TASKS | user clicks "Generate checklist" | `Task` rows (source=AI_EXTRACTED) |
| `ai` | COMPARE_VERSIONS | compare requested | `VersionComparison` + summary |
| `ai` | BRAND_CHECK | file confirmed (EXPORT/DELIVERABLE) or manual | `BrandCheckResult` |
| `ai` | MATCH_FILE (fallback) | rule-based match found nothing | AI proposes links → `RequirementFileLink` with `matchedBy=AI` |
| `ai` | PROJECT_STATUS_NARRATIVE | user clicks "AI summary" | stored narrative shown on Pulse |
| `analytics` | rollups | cron nightly + after key events | `AnalyticsSnapshot` |

All AI jobs implement: idempotency key, retry ×3 with backoff, zod-validated output, token accounting on `AiJob`.

## 4. Business Logic Highlights

### Requirement coverage (derived)
```
coverage(requirement) = satisfied deliverables / total deliverables
requirement.status = FULFILLED when coverage == 1
project requirementCoveragePct = FULFILLED requirements / ACCEPTED requirements
```
Recomputed inside the same transaction whenever a `RequirementFileLink` changes.

### Snapshot creation (version)
1. Gather branch's current live files (`File` where branchId, not deleted).
2. checksum = sha256 of sorted `(path, sha256)` pairs. If equals parent's → return 409 "No changes to snapshot".
3. Insert `Version` + copy `VersionFile` rows.
4. Enqueue AI summary (diff vs parent) — non-blocking.

### Merge = "Adopt into target branch"
Copy source branch's live file set (or selected files) onto target branch → new version with `sourceBranchId` set → activity event `branch.merged`. No conflicts in MVP: last-write-wins per path with a file-picker UI for overlaps (Phase 2).

## 5. Error & Validation Conventions

- Errors: `{ error: { code: "REQUIREMENT_NOT_FOUND", message, details? } }` with proper HTTP status.
- All mutations: zod body validation → 422 on failure.
- AuthZ middleware: `requireRole(projectId, [OWNER, ...])` per `09-roles-permissions.md`.
- Rate limits: AI endpoints 10/min/user; ingest 300/min/device.

## 6. Testing Strategy

- Unit: services (matcher, coverage calc, checksum/dedupe) — Vitest.
- Integration: API tests with testcontainers Postgres; S3 mocked with MinIO.
- AI: recorded fixtures (deterministic seeds/cached responses) — never hit the real API in CI.
- E2E: Playwright for the core loop: create project → add brief → extract → accept → drop file (simulate watcher) → requirement flips to fulfilled.
