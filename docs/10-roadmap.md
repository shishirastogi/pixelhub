# 10 — Roadmap, Milestones & Task Breakdown

Phased delivery aligned to the idea doc's MVP scope. "Must work" → Phase 1; "Can wait" → Phase 2+.

## 1. Phase 0 — Foundations (spike + scaffolding)

- [ ] Monorepo scaffold (pnpm + Turborepo), shared `packages/types` zod contracts
- [ ] docker-compose: Postgres, Redis, MinIO
- [ ] Prisma schema (all tables from `02`) + migration
- [ ] Auth (email/password + sessions), `User` + `Session`
- [ ] `ActivityEvent` emitter + `ActivityService`
- [ ] CI: lint, typecheck, test, migration safety check

## 2. Phase 1 — MVP ("Must work")

### 2.1 Project core
- [ ] Project CRUD; auto-create "Main Concept" branch + empty BrandKit on create
- [ ] Project Pulse aggregate endpoint + dashboard page (tiles from `04 §4`)

### 2.2 Brief & Requirements
- [ ] Brief save (text + uploaded file)
- [ ] Requirement + Deliverable CRUD (manual creation with file patterns)
- [ ] Accept/dismiss flow (UI-ready even before AI; `source=MANUAL` first)
- [ ] Requirement coverage derivation + traceability links (`RequirementFileLink`)

### 2.3 File watcher & auto-tracking (the core loop)
- [ ] `pixelhub-watch` CLI: pair, scan, hash, watch, ignore rules
- [ ] `POST /files/ingest` + pre-signed upload + confirm pipeline
- [ ] Preview generation (`sharp`) + `File.imageMeta`
- [ ] Stage A deterministic matcher → install `package.json` configurable action for auto-fulfilled deliverables
- [ ] Pulse live updates (deliverable 2/3 → 3/3 ✓)

### 2.4 Versioning & branching (basic)
- [ ] Branch CRUD (kinds, parent), switch
- [ ] Snapshot version + checksum dedupe
- [ ] Version timeline + detail view
- [ ] Adopt-into-main (merge) with file-picker conflict UI
- [ ] Mechanical comparison (files added/removed/modified + color/typography facets from imageMeta)

### 2.5 Brand kit + checks (simple)
- [ ] BrandKit CRUD (colors/fonts/logos/rules)
- [ ] Deterministic color ΔE check + logo/font semantic check via AI
- [ ] `BrandCheckResult` list on Brand Kit page + Pulse "needs attention"

### 2.6 Minimal AI tie-in (small, decoupled)
- [ ] `AiProvider` abstraction + `AiJob` lifecycle (openai impl)
- [ ] `EXTRACT_REQUIREMENTS` (PENDING proposals) — proves the proposal/acceptance loop end-to-end

**Phase 1 exit criteria:** a designer creates a project, pastes a brief, sets deliverables with patterns, pairs a folder, drops files, watches requirements flip to fulfilled, snapshots versions, and sees brand inconsistencies flagged.

## 3. Phase 2 — "Can wait" (from idea doc)

- [ ] Full AI requirement extraction UX polish (confidence, bulk accept, uncertainties panel)
- [ ] `COMPARE_VERSIONS` AI semantic explanation (designer-English) + compare-view tabs
- [ ] `GENERATE_TASKS` + `MATCH_FILE` AI fallback + self-verification of deliverables
- [ ] Client review portal (`/review`) + comment → task → auto-recheck loop
- [ ] Decision Log with linked references
- [ ] Deep visual-similarity diffing (perceptual hashes / embeddings)
- [ ] Roles & permissions (full matrix) + invitations
- [ ] `PROJECT_STATUS_NARRATIVE` always-on AI tracking
- [ ] Analytics insight cards (high-signal nudges)

## 4. Phase 3 — Post-MVP (nice to have / scale)

- [ ] Multi-project portfolio analytics
- [ ] Branch graph visualization
- [ ] Desktop installer (Tauri) bundling the watcher + app
- [ ] Plugins (Figma/Adobe export integration, Slack client-review notifications)
- [ ] Ownership transfer, SSO/org accounts, audit log export

## 5. Suggested Development Order & Dependencies

```
P0 auth/db → P1 project core → P1 brief/requirements (manual) 
   → P1 WATCHER + auto-tracking (highest-value, hardest) 
   → P1 versioning/branching → P1 brand kit 
   → P1 minimal AI (extract) 
   → P2 everything else
```
The watcher is the riskiest piece — spike it early, parallel to project core.

## 6. Cross-Cutting Milestones (every phase)

- [ ] Tests pass (unit + integration + Playwright core loop)
- [ ] Docs updated (`docs/*`), API contracts in sync with `packages/types`
- [ ] Analytics/`ActivityEvent` coverage confirmed for each new mutation
- [ ] Role/permission middleware audited against `09` matrix

## 7. Acceptance Criteria Reference (map to idea doc)

| Idea doc item | Acceptance | Phase |
|---|---|---|
| Auto-tracked deliverables | export `instagram_post_03.png` flips requirement 2/3→3/3 | P1 |
| Branching model | create Concept A, snapshot, adopt into Main | P1 |
| Version comparison | side-by-side + color/typo facets + (P2) AI explanation | P1/P2 |
| Requirement traceability | each file → requirement link, unmet surfaced | P1 |
| AI assistant | extract → propose → verify → flag brand issues | P1/P2 |
| Design Sheet | canvas w/ images/URLs/notes/colors | P1 (basic) |
| Brand Kit | machine-readable system AI checks against | P1 |
| Decision Log | decision/reason/reference/version/status | P2 |
| Client review loop | comment→task→auto-check next upload | P2 |
| Roles | 4-role matrix enforced | P2 |
| Pulse dashboard | deliverables/coverage/version/tasks/attention | P1 |
| Analytics layer | 5 families → insights engine | P1 (basic)/P2 |