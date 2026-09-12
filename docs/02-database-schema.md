# 02 — Database Schema (PostgreSQL + Prisma)

Conventions: UUID primary keys (`id String @id @default(uuid())`), `createdAt`/`updatedAt` on all tables, `deletedAt DateTime?` for soft delete, enums in SCREAMING_SNAKE. Prisma model names below map 1:1 to tables.

## 1. Entity-Relationship Overview

```
User ─┬─< ProjectMember >─ Project ─┬─< Brief
      └─< Session                   ├─< Requirement >──< RequirementFileLink >── File
                                    ├─< Deliverable >──┘
                                    ├─< Branch ─< Version ─< VersionFile >── File
                                    ├─< DesignSheetItem
                                    ├─< BrandKit ─< BrandColor / BrandFont / BrandLogo / BrandRule
                                    ├─< Decision
                                    ├─< Comment >── Task
                                    ├─< AiJob
                                    ├─< BrandCheckResult
                                    └─< ActivityEvent  (feeds analytics)
Project ─< WatcherDevice
File ─< FilePreview
Version ─< VersionComparison >─ Version
```

## 2. Identity & Access

### User
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| email | text unique | citext lowercased |
| name | text | |
| avatarUrl | text? | |
| passwordHash | text? | null if magic-link only |
| createdAt / updatedAt / deletedAt | timestamps | |

### Session
| id (uuid PK) | userId FK→User | token text unique | expiresAt timestamptz |

### Project
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| name | text | |
| slug | text unique | url-safe |
| description | text? | |
| clientName | text? | |
| deadline | timestamptz? | |
| status | enum: `ACTIVE, ON_HOLD, COMPLETED, ARCHIVED` | |
| aiEnabled | bool default true | master switch for AI features |
| defaultBranchId | uuid? FK→Branch | set after first branch created |
| watcherRootPath | text? | last known local path (informational) |
| createdAt… | | |

### ProjectMember
| projectId FK | userId FK | role enum: `OWNER, CONTRIBUTOR, REVIEWER, CLIENT` | invitedBy uuid? | joinedAt |
PK: `(projectId, userId)`. See `09-roles-permissions.md`.

### WatcherDevice
| id | projectId FK | name text (e.g. "Maya's MacBook") | tokenHash text unique | pairedByUserId FK | lastSeenAt | revokedAt? |

## 3. Brief & Requirements

### Brief
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| projectId | FK | one active brief per project (unique partial index WHERE deletedAt IS NULL) |
| title | text | |
| rawText | text | the pasted/uploaded brief |
| sourceFileId | uuid? FK→File | if brief was a PDF/DOCX |
| extractedAt | timestamptz? | when AI extraction last ran |
| extractionJobId | uuid? FK→AiJob | |

### Requirement
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| projectId | FK | |
| briefId | FK? | |
| title | text | e.g. "Instagram Posts" |
| description | text? | |
| source | enum: `MANUAL, AI_EXTRACTED` | |
| status | enum: `PENDING, ACCEPTED, REJECTED, FULFILLED` | AI proposals start `PENDING`; human accepts |
| quantity | int default 1 | e.g. 3 Instagram posts |
| dueDate | timestamptz? | |
| priority | enum: `LOW, MEDIUM, HIGH` | |
| sortOrder | int | |

### Deliverable
A concrete expected output unit belonging to a requirement.
| id | requirementId FK | name text (`instagram_post_01`) | filePatterns text[] (`["instagram_post_*.{png,jpg}"]`) | status enum: `OPEN, SATISFIED` | satisfiedByFileId uuid? FK→File | satisfiedAt timestamptz? |

### RequirementFileLink (traceability)
| requirementId FK | fileId FK | linkType enum: `SATISFIES, SUPPORTS, SUPERSEDED` | matchedBy enum: `WATCHER_RULE, AI, MANUAL` | confidence float? | createdAt |
PK `(requirementId, fileId)`. **This is the requirement-traceability backbone.**

## 4. Versioning & Branches

### Branch
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| projectId | FK | |
| name | text | "Main Concept", "Client Revision", "Experimental Direction" |
| slug | text | unique per project |
| kind | enum: `MAIN, CONCEPT, REVISION, EXPERIMENTAL` | designer vocabulary |
| parentBranchId | uuid? FK→Branch | what it forked from |
| headVersionId | uuid? FK→Version | |
| status | enum: `ACTIVE, MERGED, ABANDONED, APPROVED` | |
| createdAt… | | |

### Version (a snapshot; = "commit" internally, "version" in UI)
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| branchId | FK | |
| number | int | per-branch increment (v1, v2, v3…) |
| label | text? | "Client round 1" |
| note | text? | designer's changelog |
| parentVersionId | uuid? FK→Version | |
| sourceBranchId / sourceVersionId | uuid? | set when this version is a **merge/adopt** of another branch |
| createdById | FK→User | |
| checksum | text | hash of file-set = dedupe identical snapshots |
| aiSummary | text? | AI-generated "what changed vs parent" |
| createdAt | | |

### VersionFile
| versionId FK | fileId FK | path text (relative path inside project) | role enum: `SOURCE, EXPORT, DELIVERABLE, ASSET` |
PK `(versionId, fileId)`.

### VersionComparison (cached AI comparison)
| id | projectId FK | baseVersionId FK | targetVersionId FK | jobId FK→AiJob | diffJson jsonb (structured: color/typography/layout/copy/composition changes) | summaryMd text | createdAt |
Unique `(baseVersionId, targetVersionId)`.

## 5. Files

### File
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| projectId | FK | |
| branchId | uuid? FK | branch it was created under |
| path | text | relative path, e.g. `exports/instagram_post_03.png` |
| fileName | text | |
| extension | text | |
| mimeType | text | |
| sizeBytes | bigint | |
| sha256 | text | content hash → dedupe & change detection |
| storageKey | text | S3 key |
| uploadedById | FK→User? | null if watcher |
| watcherDeviceId | FK? | |
| kind | enum: `SOURCE, EXPORT, DELIVERABLE, REFERENCE, BRAND_ASSET, BRIEF_DOC, OTHER` | |
| imageMeta | jsonb? | `{width, height, dominantColors[], colorPalette[]}` from `sharp` |
| analyzedAt | timestamptz? | when AI/brand checks last ran |
| createdAt / deletedAt | | |
Indexes: `(projectId, path)`, `(sha256)`, `(projectId, extension)`.

### FilePreview
| fileId FK | kind enum: `THUMB, MEDIUM, FULL` | storageKey text | width int | height int |

## 6. Design Sheet (research canvas)

### DesignSheetItem
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| projectId | FK | |
| type | enum: `IMAGE, URL, NOTE, COLOR, FILE_REF` | |
| title | text? | |
| content | text? | note body / url / hex color |
| fileId | uuid? FK→File | for IMAGE / FILE_REF |
| positionX / positionY | float | canvas coords |
| width / height | float? | |
| boardGroup | text? | moodboard grouping ("Moodboard A") |
| linkedDecisionId | uuid? FK→Decision | "the decision this reference informed" |
| linkedRequirementId | uuid? FK | optional traceability |
| createdAt… | | |

## 7. Brand Kit

### BrandKit
| id | projectId FK (unique) | name text | styleGuideFileId FK? | guidelinesText text? |

### BrandColor
| id | brandKitId FK | name text ("Primary Blue") | hex text | role enum: `PRIMARY, SECONDARY, ACCENT, NEUTRAL, BACKGROUND, TEXT` | tolerance int default 10 | ΔE tolerance for checks |

### BrandFont
| id | brandKitId FK | family text | role enum: `HEADING, BODY, MONO, OTHER` | fallbacks text[] | sourceUrl text? | fileId FK? (font file) |

### BrandLogo
| id | brandKitId FK | name text | variant enum: `PRIMARY, MONO, ICON, WORDMARK` | fileId FK→File | isCurrent bool default true | outdated assets flagged when `isCurrent=false` still in use |

### BrandRule
| id | brandKitId FK | ruleType enum: `MIN_CLEAR_SPACE, MIN_SIZE, FORBIDDEN_COLOR, FORBIDDEN_FONT, USAGE_NOTE` | payload jsonb | severity enum: `INFO, WARNING, ERROR` |

### BrandCheckResult
| id | projectId FK | fileId FK | jobId FK→AiJob | checkType enum: `COLOR, FONT, LOGO, RULE` | status enum: `PASS, WARNING, FAIL` | findings jsonb `[{rule, expected, found, message, severity}]` | resolvedAt timestamptz? | createdAt |

## 8. Collaboration: Comments, Tasks, Decisions

### Comment
| id | projectId FK | versionId FK? | fileId FK? | parentCommentId FK? (threads) | authorId FK→User | body text | anchorJson jsonb? (x/y pin on image, or element selector) | status enum: `OPEN, RESOLVED` | convertedTaskId FK? |

### Task
| id | projectId FK | title text | description text? | source enum: `MANUAL, AI_EXTRACTED, COMMENT, AI_RECOMMENDATION` | status enum: `TODO, IN_PROGRESS, DONE, CANCELLED` | assigneeId FK? | requirementId FK? | commentId FK? | checklistJson jsonb? | dueDate? | createdAt… |

### Decision (Decision Log)
| id | projectId FK | title text | decision text | reason text | status enum: `PROPOSED, DECIDED, SUPERSEDED, REVISITED` | versionId FK? | designSheetItemId FK? | decidedById FK? | decidedAt? | supersedesId FK? (self) |

## 9. AI Infrastructure

### AiJob
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| projectId | FK | |
| type | enum: `EXTRACT_REQUIREMENTS, GENERATE_TASKS, COMPARE_VERSIONS, BRAND_CHECK, MATCH_FILE, PROJECT_STATUS_NARRATIVE` | |
| status | enum: `QUEUED, RUNNING, SUCCEEDED, FAILED, CANCELLED` | |
| inputJson | jsonb | prompt context refs (ids, not raw blobs) |
| resultJson | jsonb? | validated structured output |
| error | text? | |
| model | text? | e.g. `gpt-4o-mini` |
| tokensIn / tokensOut | int? | cost tracking |
| requestedById | FK→User? | |
| startedAt / finishedAt / createdAt | | |

## 10. Activity & Analytics

### ActivityEvent (append-only; source for all analytics)
| id | projectId FK | actorId FK? (null = system/watcher) | type text (`file.created`, `version.created`, `requirement.fulfilled`, `branch.merged`, `comment.created`, …) | entityType text | entityId uuid | meta jsonb | createdAt (indexed) |

### AnalyticsSnapshot (precomputed daily rollups per project)
| id | projectId FK | date date | metrics jsonb — see `08-analytics.md` for exact shape | computedAt |
Unique `(projectId, date)`.

## 11. Key Indexes & Constraints Summary

- `File (projectId, path)` unique (within project, one live row per path)
- `Version (branchId, number)` unique
- `Branch (projectId, slug)` unique
- `ActivityEvent (projectId, createdAt)` — analytics scans
- `BrandCheckResult (fileId, createdAt)` — latest status per file
- `RequirementFileLink (requirementId, fileId)` PK
- Partial unique: one non-deleted `Brief` per project

## 12. Derived State Rules (no stored counters)

Deliverable/requirement progress (e.g. 2/3) is **computed on read** from `Deliverable.status` / `RequirementFileLink`, or cached in `AnalyticsSnapshot`. Never store mutable counters — they drift; derivation keeps the file system as the source of truth.
