# PixelHub — Implementation Plan

A version-controlled creative workspace for designers: GitHub + Notion + Figma project management + AI QA.

## What this repo contains

`docs/` holds a complete, cross-referenced implementation plan for everything in the product idea. Each file is self-contained; see `00-overview.md` for the map.

## Plan documents

| # | File | Contents |
|---|---|---|
| 00 | [00-overview.md](docs/00-overview.md) | Pitch, feature checklist → doc map, guiding principles |
| 01 | [01-architecture.md](docs/01-architecture.md) | Tech stack, system components, monorepo layout, data flows |
| 02 | [02-database-schema.md](docs/02-database-schema.md) | Full PostgreSQL schema — every table, column, relation, index |
| 03 | [03-backend-api.md](docs/03-backend-api.md) | Backend modules, all REST endpoints, background jobs, logic |
| 04 | [04-frontend-ui-buttons.md](docs/04-frontend-ui-buttons.md) | Every screen, every button and exactly what it does |
| 05 | [05-versioning-branching.md](docs/05-versioning-branching.md) | Designer-friendly Git-style versioning & branching model |
| 06 | [06-file-watcher.md](docs/06-file-watcher.md) | The watcher agent + auto-deliverable tracking |
| 07 | [07-ai-workflows.md](docs/07-ai-workflows.md) | AI assistant: extraction, comparison, brand checks, project tracking |
| 08 | [08-analytics.md](docs/08-analytics.md) | The analytics layer underlying the product |
| 09 | [09-roles-permissions.md](docs/09-roles-permissions.md) | Owner / Contributor / Reviewer / Client permission matrix |
| 10 | [10-roadmap.md](docs/10-roadmap.md) | MVP scope, milestones, task breakdown, acceptance criteria |

## One-line reading order

`00` (what & why) → `01` (system) → `02`+`03` (data & API) → `04` (UI) → `05`+`06` (versioning & tracking) → `07` (AI) → `08` (analytics) → `09` (permissions) → `10` (plan/roadmap).

## Source

The product idea this plan implements: [`pixelhub-idea.md`](https://github.com/shishirastogi/pixelhub) — a version-controlled creative workspace described in full in `docs/00-overview.md`.