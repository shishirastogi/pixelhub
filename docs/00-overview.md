# 00 — PixelHub: Master Plan Overview

> A version-controlled creative workspace that unifies design files, branches, requirements, references, brand assets, collaboration, and AI-powered project tracking — GitHub + Notion + Figma project management + AI QA, built specifically for designers.

## 1. Product Summary

PixelHub is a single source of truth for a design project. Everything lives inside a structured **Project**:

```
PROJECT
├── Brief & Requirements     — client requirements, deliverables, deadlines, AI-generated task checklist
├── Versions & Branches      — Main, Concept A, Concept B, Experimental
├── Design Sheet             — references, moodboards, inspiration, notes
├── Brand Assets             — logos, fonts, colors, typography, style guide
├── Project Files            — source, exports, deliverables
└── Project Intelligence     — requirement coverage, version comparison, revision history, AI recommendations
```

**Core principle:** project state is *derived automatically*, not manually maintained. A file-watcher watches the project directory and updates progress as files appear (e.g. exporting `instagram_post_03.png` moves "Instagram Posts" from 2/3 → 3/3 ✓).

## 2. Plan Document Index

| Doc | Covers |
|---|---|
| `01-architecture.md` | Tech stack, system components, monorepo layout, infrastructure |
| `02-database-schema.md` | Full PostgreSQL schema: every table, column, relation, index |
| `03-backend-api.md` | Backend modules, REST API endpoints, services, background jobs |
| `04-frontend-ui-buttons.md` | Every screen, every button, and exactly what each one does |
| `05-versioning-branching.md` | Designer-friendly Git-style versioning model & implementation |
| `06-file-watcher.md` | File-watcher agent, auto-deliverable matching, sync protocol |
| `07-ai-workflows.md` | AI requirement extraction, version comparison, brand checks, project tracking with the AI API |
| `08-analytics.md` | Version / requirement / file / collaboration / design analytics |
| `09-roles-permissions.md` | Owner, Contributor, Reviewer, Client — permission matrix |
| `10-roadmap.md` | MVP scope, milestones, task breakdown, later phases |

## 3. Feature Checklist (from the idea doc → where it is planned)

| Feature (idea doc) | Planned in | MVP? |
|---|---|---|
| Auto-tracked deliverables | `06-file-watcher.md` | ✅ |
| Branching model (Main / Concept A/B / Experimental) | `05-versioning-branching.md` | ✅ |
| Version comparison (AI-explained diffs) | `07-ai-workflows.md` §3 | ✅ (basic) |
| Requirement traceability | `02`, `03`, `06` | ✅ |
| AI project assistant (extract requirements, verify tasks, flag brand issues) | `07-ai-workflows.md` | Partially (brand checks in MVP) |
| Design Sheet (references, moodboards, notes) | `02`, `03`, `04` | ✅ (basic) |
| Brand Kit (machine-readable design system) | `02`, `03`, `07` | ✅ |
| Decision Log | `02`, `03`, `04` | ⏳ Phase 2 |
| Client review loop (comment → task → auto-check) | `04`, `07`, `09` | ⏳ Phase 2 |
| Roles (Owner / Contributor / Reviewer / Client) | `09-roles-permissions.md` | ⏳ Phase 2 (Owner only in MVP) |
| Project Pulse dashboard | `04`, `08` | ✅ |
| Analytics layer (5 categories) | `08-analytics.md` | ✅ (basic) / Phase 2 (full) |

## 4. Guiding Principles

1. **Derived state over manual state** — nothing the file system or AI can infer should ever be typed by the user.
2. **Designer vocabulary, not Git vocabulary** — "Main Concept", "Client Revision", "Experimental Direction", never "commit/rebase".
3. **Analytics is the engine, not the pitch** — dashboards surface only actionable insight ("what needs attention").
4. **AI verifies, humans decide** — AI flags inconsistencies and proposes matches; the designer confirms.
5. **Keep it simple** — boring, proven tech; monolith first; no microservices.
