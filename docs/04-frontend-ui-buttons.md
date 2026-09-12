# 04 — Frontend Screens, Buttons & Functions

Every interactive element in the UI, what it does, and which API it calls. Framework: Next.js + shadcn/ui. Routes use `/p/[projectSlug]/…`.

## 1. Screen Map

```
/                        → Landing / login
/app                     → My Projects (grid)
/app/new                 → New Project wizard
/p/[slug]                → Project Pulse dashboard (default tab)
/p/[slug]/brief          → Brief & Requirements
/p/[slug]/versions       → Branches & Versions
/p/[slug]/compare        → Version comparison view
/p/[slug]/design-sheet   → Design Sheet canvas
/p/[slug]/brand-kit      → Brand Kit editor + check results
/p/[slug]/files          → File browser
/p/[slug]/tasks          → Tasks & review comments
/p/[slug]/decisions      → Decision Log (Phase 2)
/p/[slug]/analytics      → Analytics (Phase 2, lite tiles on Pulse in MVP)
/p/[slug]/settings       → Project settings, members, watcher pairing
```

---

## 2. My Projects (`/app`)

| UI element | Function | API |
|---|---|---|
| **"+ New Project"** button | Opens wizard: name → client → deadline → paste brief (optional) → AI toggle → "Create" | `POST /projects` |
| Project card → **click** | Opens Pulse dashboard | — |
| Card ⋯ menu → **Archive / Delete / Duplicate** | Lifecycle ops | `PATCH/DELETE /projects/:id` |
| Search / filter bar | Filters by name, client, status | client-side |

## 3. Project Shell (all `/p/[slug]` pages)

| UI element | Function |
|---|---|
| Branch switcher (top bar, e.g. "Main Concept ▾") | Lists branches; selecting one calls `POST /branches/:id/switch`, refreshes all data, shows banner "Watcher synced to this branch" |
| Tab nav | Pulse · Brief · Versions · Design Sheet · Brand Kit · Files · Tasks |
| **Bell icon** | Notifications: AI job done, brand check failed, comment replied |
| **"Pair this folder" button** | Opens pairing modal: shows 8-char code + download link for the `pixelhub-watch` agent | `POST /watchers/pair` |

---

## 4. Project Pulse Dashboard (`/p/[slug]`)

The "one glance" screen.

### Tiles (computed from `GET /projects/:id/pulse`)
| Tile | Contents |
|---|---|
| **Deliverables** | "7/12 complete" + progress bar + per-requirement mini-bars (auto-updated by watcher) |
| **Requirement coverage** | Donut: fulfilled vs outstanding; overdue items in red |
| **Current version** | Branch name, v-number, age, Δ files since last snapshot |
| **Open tasks** | count + top 3 by due date |
| **Needs attention** | AI/rule-derived list: failing brand checks, past-due requirements, requirements with 0 files after >3 days, unreviewed comments |
| **AI health narrative** | Latest `PROJECT_STATUS_NARRATIVE` (e.g. "On track; risk: banner requirement has 6 revisions vs avg 2") |

### Buttons
| Button | Function | API |
|---|---|---|
| **"Refresh with AI"** (on narrative tile) | Re-runs status narrative | `POST /projects/:id/ai/status-narrative` |
| **"Snapshot version"** | Creates version on current branch; modal for label/note | `POST /branches/:id/versions` |
| **"New branch"** | Modal: name, kind (Concept/Revision/Experimental), "from branch" | `POST /projects/:id/branches` |
| Attention item → **"Fix" / "View"** | Deep-links to the offending file/requirement/brand check | — |
| Tile click-throughs | Each tile links to its tab filtered appropriately | — |

---

## 5. Brief & Requirements (`/p/[slug]/brief`)

| UI element | Function | API |
|---|---|---|
| Brief text editor + **"Save brief"** | Saves raw brief | `PUT /projects/:id/brief` |
| **"Upload brief file"** | PDF/DOCX upload; text extracted & stored | `POST /files/upload-url` + confirm, `PUT /brief` |
| **"✨ Extract requirements"** | Runs AI extraction; spinner with job polling; results appear as *proposed* cards with dashed border | `POST /brief/extract`, poll `GET /ai-jobs/:id` |
| Proposed requirement → **"✓ Accept"** | Promotes `PENDING→ACCEPTED`; deliverables & file patterns become active for matching | `PATCH /requirements/:id` |
| Proposed requirement → **"✗ Dismiss"** | Sets `REJECTED` (hidden) | `PATCH` |
| **"+ Add requirement"** | Manual create modal: title, qty, due, priority, deliverables w/ file patterns — pattern field has a helper ("`instagram_post_*.{png,jpg}`") | `POST /requirements` |
| Requirement row → **expand** | Shows deliverables: `instagram_post_01 ✓ › instagram_post_01.png`, plus linked-file thumbnails | `GET /requirements/:id/files` |
| **"Generate task checklist"** per requirement | AI generates actionable tasks | `POST /requirements/:id/generate-tasks` |
| Requirement ⋯ → **Edit / Delete / Re-match files** | `Re-match` re-runs matcher against all project files | `PATCH/DELETE`, `POST /deliverables/:id/rematch` |
| **"Link file"** on a deliverable | File picker modal to manually satisfy/trace | `POST /requirements/:id/link-file` |
| **Coverage filter chips** | All / Fulfilled / Outstanding / Overdue | client-side on `GET` data |

---

## 6. Branches & Versions (`/p/[slug]/versions`)

Layout: left = branch rail; center = version timeline of selected branch; right = detail pane.

| UI element | Function | API |
|---|---|---|
| **"+ New branch"** | Modal: name, kind (dropdown w/ friendly descriptions: *Concept — "explore a direction"*, *Revision — "client feedback round"*, *Experimental — "safe to break things"*), source branch | `POST /projects/:id/branches` |
| Branch card → **"Switch to"** | Sets active branch; prompts watcher to reconcile folder | `POST /branches/:id/switch` |
| Branch ⋯ → **Rename / Mark as Approved / Mark Abandoned** | Status changes; Approved shows badge | `PATCH /branches/:id` |
| Branch → **"Adopt into Main"** (merge) | Confirmation modal showing files that will change; creates merge version | `POST /branches/:id/merge` |
| **"Snapshot current state"** | New version on selected branch; label + note fields | `POST /branches/:id/versions` |
| Version row → **click** | Detail pane: file list, note, AI summary ("what changed vs previous") | `GET /versions/:id` |
| Version checkboxes + **"Compare selected (2)"** | Disabled unless exactly 2 selected → opens compare view | `POST /versions/compare` |
| Version ⋯ → **"Restore as new version"** | Creates a new version whose file set = this version's (non-destructive rollback) | `POST /branches/:id/versions` with `restoreFrom` |

## 7. Version Comparison View (`/p/[slug]/compare`)

*Designer language, not git diff.*

| UI element | Function |
|---|---|
| Base/target version selectors + **"Compare"** | Runs/loads comparison |
| Tabs: **Files · Colors · Typography · Layout · Copy · Summary(AI)** | Each tab renders that facet from `VersionComparison.diffJson` |
| File diff rows | side-by-side previews, status chip: Added / Removed / Modified / Renamed |
| Image diff hover | A/B slider (onion-skin) overlay of the two previews |
| **"Explain changes with AI"** | If only mechanical diff cached, enqueues full semantic AI comparison |
| **"Save as decision"** | Creates a Decision Log entry prefilled with the summary | `POST /decisions` |

---

## 8. Design Sheet (`/p/[slug]/design-sheet`)

Infinite canvas (react-flow or custom pan/zoom).

| UI element | Function | API |
|---|---|---|
| Toolbar: **🖼 Add image · 🔗 Add URL · 📝 Add note · 🎨 Add color · 📎 File from project** | Creates item at canvas center | `POST /design-sheet` |
| Drag items / resize | Position/size persisted on mouse-up (debounced bulk save) | `POST /design-sheet/positions` |
| Item → **"Link to decision / requirement"** | Connects reference → the choice it informed | `PATCH /design-sheet/:id` |
| **"New board"** (group) | Named moodboard grouping; collapse/expand | implicit via `boardGroup` |
| URL item | Auto-fetches og:image/title for preview | backend fetch on create |
| Item ⋯ → **Delete / Duplicate** | standard | `DELETE/POST` |

## 9. Brand Kit (`/p/[slug]/brand-kit`)

| UI element | Function | API |
|---|---|---|
| Colors section: **"+ Add color"** | swatch picker, name, role, ΔE tolerance slider | `PUT /brand-kit` (whole-kit save) |
| Fonts: **"+ Add font"** | family, role, upload font file or source URL | same |
| Logos: **"+ Add logo"** | upload variant; **"Mark as current"** toggle; outdated variants visually flagged | same |
| Rules: **"+ Add rule"** | dropdown type (min clear space, forbidden color/font, usage note) + payload form + severity | same |
| Guidelines text area + **Save** | free-text usage guidelines AI reads during checks | same |
| **"Run brand check"** | Checks all current export/deliverable files | `POST /brand-kit/check` |
| Results list | per file: ✓ pass / ⚠ warning / ✗ fail, expandable findings ("Found #FF0033 — not in palette; closest: Primary Red #E11D48, ΔE 14") | `GET /brand-checks` |
| Finding → **"Re-check"** | after design fix | `POST /files/:id/recheck-brand` |
| Finding → **"Mark resolved"** | human override with note | `POST /brand-checks/:id/resolve` |

## 10. Files (`/p/[slug]/files`)

| UI element | Function | API |
|---|---|---|
| **"Upload files"** (drag-drop zone too) | pre-signed upload; on confirm runs preview + match + brand-check | upload-url + confirm |
| Filters: kind (Source/Export/Deliverable/Reference), branch, type, search | server-side query | `GET /files?…` |
| File row: linked-requirement chips, brand status dot, "in v3" badge | from `GET /files/:id` |
| File ⋯ → **Download / Link to requirement / Delete** | | download-url, link, DELETE |
| **Duplicates banner** | "3 files share identical content" → dedupe suggestion | from file analytics |
| Watcher status pill (top) | "Watching: 2 devices · Maya's MacBook · 2m ago" | `GET /watchers` info |

## 11. Tasks & Review (`/p/[slug]/tasks`)

| UI element | Function | API |
|---|---|---|
| Board/list toggle; columns To do · In progress · Done | `PATCH /tasks/:id` on drag |
| **"+ New task"** | manual task | `POST /tasks` |
| Task card badges | source: ✨AI / 💬from comment / · requirement link |
| Comments panel (per version/file) | anchored pins on image preview (click image → drop pin → type) | `POST /comments` |
| Comment → **"Resolve"** | closes thread | `POST /comments/:id/resolve` |
| Comment → **"→ Task"** | converts comment into linked task; next relevant upload auto-marks when requirement re-checked | `POST /comments/:id/convert-to-task` |

## 12. Settings (`/p/[slug]/settings`)

| Element | Function |
|---|---|
| General | rename, deadline, client, status, **AI features toggle** (`aiEnabled`) |
| Members | invite by email, role dropdown (Owner/Contributor/Reviewer/Client), remove |
| **Watcher devices** | "Pair new device" (code + agent download), list devices, **Revoke** |
| Ignore rules editor | edits `.pixelhubignore` template synced to watchers |
| Danger zone | archive / delete project |

## 13. Global UX Behaviors

- **Job feedback**: every ✨AI action → toast with live job status ("Extracting requirements… done — 6 proposed"); failures show retry.
- **Optimistic UI** for task/member/link ops; server-confirmed for snapshots & merges.
- **Empty states** are instructional: e.g. Files tab with no watcher → "Pair your project folder to start auto-tracking" + button.
- **Permissions**: buttons hidden/disabled per role (see `09`): Clients see only Pulse (read-only), versions, and comment box.
