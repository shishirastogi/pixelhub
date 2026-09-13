# 08 — Data & Analytics Layer

Analytics is the **engine under the product**, not the pitch. Its goal: turn raw activity into the *insights the Pulse dashboard and AI narratives need* — while staying almost invisible to the end user.

## 1. Data Foundation

Two sources:

1. **`ActivityEvent`** — every mutation emits one row (`file.created`, `version.created`, `requirement.fulfilled`, `branch.merged`, `comment.created`, `brand_check.failed`, …). Append-only, `meta` JSONB. This is the single source of truth for time-series analytics.
2. **`AnalyticsSnapshot`** — nightly precomputed rollups (`metrics` JSONB per project per day). Queries read snapshots, never scan raw events in the request path.

Plus live-DB derivation for "current state" numbers (e.g. `count Deliverable WHERE status=SATISFIED`), which don't need snapshots.

## 2. The Five Metric Families (from the idea doc)

### 2.1 Version Analytics
| Metric | Definition | Source |
|---|---|---|
| Branch count | active branches per project | `Branch` |
| Versions per branch | total snapshots / branch | `Version` |
| Changes per version | avg files added+modified between consecutive versions | `VersionFile` deltas |
| Time between versions | avg inter-snapshot interval | `Version.createdAt` |
| Merge frequency | `branch.merged` events / week | `ActivityEvent` |

**Insight:** *"Concept A has 4 merges this month; Main averages a v-snapshot every 2.1 days."*

### 2.2 Requirement Analytics
| Metric | Definition |
|---|---|
| Fulfilled vs outstanding | `FULFILLED` ÷ `ACCEPTED` requirements (live derivation) |
| Coverage trend | coverage % over time (snapshot series) |
| Revision count per requirement | distinct files/link changes per requirement |
| Overdue | `dueDate < now` and not fulfilled |

**Insight:** *"The banner requirement sits at 6 revisions vs the project average of 2."*

### 2.3 File Analytics
| Metric | Definition |
|---|---|
| Required vs produced | deliverables vs satisfied files |
| File type distribution | count by `extension` |
| Duplicates | files sharing `sha256` (identical content, different paths) |
| Outdated assets | `BrandLogo WHERE isCurrent=false` still referenced, or Deliverable satisfied by a `SUPERSEDED` link |
| Storage footprint | `sizeBytes` by kind |

### 2.4 Collaboration Analytics
| Metric | Definition |
|---|---|
| Contributor activity | events per `actorId` per week |
| Review turnaround | median time from `comment.created` → task resolution |
| Comment/revision cycles | comments per requirement/version; revisions triggered by comments |

**Insight:** *"Client approval typically happens after 3.2 iterations."* (mean versions from `APPROVED` back to preceding `comment` events.)

### 2.5 Design Analytics
| Metric | Definition |
|---|---|
| Color change frequency | count of versions where `colors.dominantAfter ≠ before` |
| Typography change frequency | version diffs where fonts changed |
| Layout change frequency | version diffs where layout dimension changed |
| Visual similarity | perceptual-hash distance across versions (Phase 2) |

## 3. Snapshot Schema (`AnalyticsSnapshot.metrics`)

```json
{
  "versions": { "branchCount": 3, "totalVersions": 14, "avgIntervalDays": 2.1, "mergesLast7d": 1 },
  "requirements": { "fulfilled": 6, "accepted": 10, "coveragePct": 60, "avgRevisions": 2.4, "overdue": 2 },
  "files": { "total": 87, "produced": 41, "required": 48, "duplicates": 3, "typeDistribution": {"png": 55, "ai": 12}, "outdated": 1 },
  "collaboration": { "activeContributors": 2, "comments": 19, "avgReviewTurnaroundH": 26, "approvalIterations": 3.2 },
  "design": { "colorChangeCount": 6, "fontChangeCount": 2, "layoutChangeCount": 4 },
  "ai": { "jobsRun": 12, "tokensIn": 48000, "tokensOut": 9000, "estCostUsd": 0.14 }
}
```

## 4. Computation Pipeline

```
1. Nightly cron (or `POST /analytics/recompute`):
   - Scan ActivityEvent since last snapshot
   - Recompute family metrics via SQL aggregations (not JS)
   - Derive live "current state" numbers
   - UPSERT AnalyticsSnapshot(projectId, date)
2. Request path: read latest snapshot + live deltas for "today" numbers
3. AI narrative (07 §2E) consumes the same metrics as its input
```

## 5. Where It Surfaces (product, not dashboards-first)

- **Pulse tiles:** deliverable count, coverage donut, current version, open tasks (denormalized from `GET /pulse`).
- **"Needs attention" list:** derived from overdue requirements + failing brand checks + duplicates + outdated assets — the whole point of analytics is to produce *this* list.
- **AI narrative strings:** "banner has 6 revisions vs avg 2" phrase generated from version/requirement analytics.
- **Insight cards (Phase 2):** occasional, high-signal nudges, e.g. "2 deliverables are overdue and unassigned."

## 6. Design Rules

1. Analytics must never require the user to "configure a dashboard."
2. Every metric must trace back to a concrete, actionable entity (a file, requirement, or version) via deep link.
3. Snapshot cache invalidation is event-driven (emit → mark dirty) **and** nightly; correctness over freshness on stale reads.
4. Nothing is pre-aggregated on write except `ActivityEvent` itself (no mutable counters — see `02 §12`).

## 7. Out of Scope (explicitly)

- Custom BI/query builder.
- Export/report generation beyond a simple CSV (Phase 3, only if asked).
- Multi-project portfolio analytics (Phase 3).