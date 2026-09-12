# 01 — Architecture & Tech Stack

## 1. High-Level Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                        CLIENTS                                  │
│  Web App (React/Next.js)        Desktop Watcher Agent (Node)    │
│  - Dashboard, projects, AI UI   - chokidar file watching        │
│  - Version compare viewer       - hashing, diff sync, uploads   │
└──────────────┬──────────────────────────────┬──────────────────┘
               │ HTTPS/JSON (REST)             │ HTTPS (sync protocol)
               ▼                               ▼
┌────────────────────────────────────────────────────────────────┐
│                  BACKEND API (Node.js + Fastify)                │
│  Modules: auth │ projects │ requirements │ versions/branches    │
│           files │ brand-kit │ design-sheet │ decisions │        │
│           comments/tasks │ analytics │ ai-orchestrator          │
│                                                                 │
│  Background workers (BullMQ on Redis):                          │
│   - ai-requirement-extraction   - ai-version-comparison         │
│   - ai-brand-consistency        - ai-file-matching              │
│   - thumbnail/preview generation- analytics rollups             │
└──────┬───────────────┬──────────────────┬─────────────────────┘
       ▼               ▼                  ▼
┌────────────┐  ┌────────────┐  ┌────────────────────┐  ┌───────────────┐
│ PostgreSQL │  │   Redis    │  │ Object storage     │  │ AI Provider   │
│ (Prisma)   │  │ (queues,   │  │ (S3/MinIO): files, │  │ API (OpenAI / │
│            │  │ cache,     │  │ versions, previews │  │ Anthropic)    │
│            │  │ sessions)  │  │                    │  │               │
└────────────┘  └────────────┘  └────────────────────┘  └───────────────┘
```

## 2. Tech Stack Choices

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript everywhere | One language, shared types between web, API, watcher |
| Web frontend | Next.js 14 (App Router) + React + TailwindCSS + shadcn/ui | Fast, conventional, great component library |
| Backend API | Fastify (Node) — or Next.js Route Handlers for MVP | Simple, fast, schema-validated (zod) |
| ORM / DB | PostgreSQL 15 + Prisma | Relational data model fits perfectly; JSONB for AI artifacts |
| Queue | BullMQ + Redis | AI jobs are slow → must be async with retries |
| Storage | S3-compatible (MinIO locally, AWS S3 in prod) | Large design files, versioned blobs |
| File watcher | Node CLI agent using `chokidar` + `crypto` (SHA-256) | Cross-platform, battle-tested |
| AI | OpenAI API (`gpt-4o` / `gpt-4o-mini`) — provider-abstracted behind `AiProvider` interface | vision + text in one API; swappable to Anthropic later |
| Auth | Email/password + magic link via `lucia` or Auth.js; sessions in DB | Simple, self-hosted |
| Image processing | `sharp` (thumbnails, color histograms) | Fast native module |
| Monorepo | pnpm workspaces + Turborepo | Share types/utils across apps |

> **MVP simplification:** single Next.js app (API routes + pages) + one separate watcher CLI package. Split into a standalone Fastify service only when the API surface stabilizes.

## 3. Monorepo Layout

```
pixelhub/
├── apps/
│   ├── web/                 # Next.js app (UI + API routes for MVP)
│   │   ├── app/             # routes (dashboard, project, settings…)
│   │   ├── components/      # UI components (one per button/panel in doc 04)
│   │   ├── lib/             # client helpers
│   │   └── server/          # services, db access, AI orchestrator
│   └── watcher/             # Node CLI: pixelhub-watch
│       ├── src/index.ts     # CLI entry
│       ├── src/watcher.ts   # chokidar logic
│       ├── src/sync.ts      # diff + upload protocol
│       └── src/matcher.ts   # local filename pre-matching
├── packages/
│   ├── db/                  # Prisma schema + client + migrations
│   ├── types/               # shared TS types & zod schemas (API contracts)
│   ├── ai/                  # AiProvider interface, prompts, parsers
│   └── config/              # eslint, tsconfig, env schema
├── docs/                    # ← this plan
└── docker-compose.yml       # postgres + redis + minio for local dev
```

## 4. Request / Data Flows

### 4.1 File appears → deliverable auto-checked (core loop)
1. Watcher detects `instagram_post_03.png` created in `exports/`.
2. Watcher hashes file (SHA-256), checks ignore rules (`.pixelhubignore`), uploads metadata → `POST /api/files/ingest`.
3. Backend stores `File` row, uploads blob to S3, enqueues `file-match` job.
4. Matcher (rules + AI fallback, see `07`) links file → `Deliverable` / `Requirement`.
5. Requirement status recomputed (2/3 → 3/3 ✓), `Project Pulse` cache invalidated.
6. Web client gets update via polling (MVP) / SSE (later).

### 4.2 AI job flow (generic)
1. User action (e.g. "Extract requirements from brief") → API creates `AiJob` row + enqueues BullMQ job.
2. Worker calls AI provider with prompt + context from DB, validates response against zod schema.
3. Structured result saved (`AiJob.result`, plus domain rows e.g. proposed `Requirement`s in `PENDING` state).
4. UI shows proposals; user accepts/rejects → rows become active. **AI proposes, human disposes.**

## 5. Environments & Config

| Env | Purpose |
|---|---|
| `local` | docker-compose: postgres, redis, minio; `pnpm dev` |
| `staging` | deployed pre-prod with real AI keys (rate-limited) |
| `prod` | Vercel/Railway + managed Postgres + S3 |

Required env vars: `DATABASE_URL`, `REDIS_URL`, `S3_ENDPOINT/KEY/SECRET/BUCKET`, `AI_PROVIDER`, `OPENAI_API_KEY`, `AUTH_SECRET`, `WATCHER_TOKEN_SECRET`.

## 6. Security & Privacy Basics

- All file uploads via pre-signed URLs; backend never proxies large blobs.
- Briefs/files may contain confidential client work → AI calls must send **minimum necessary context**; per-project toggle `aiEnabled`.
- Watcher authenticates with a per-project pairing token (scoped, revocable).
- Soft-delete everything user-facing (`deletedAt`) for 30-day recovery.
