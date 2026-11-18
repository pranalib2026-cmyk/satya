# AGENTS.md — NyayaSetu repository guide

This file is the entry point for any AI coding agent working in this repository.
Read it before editing. Then read the document that matches your task.

## What this project is

NyayaSetu is an India-focused legal platform with two independent apps:

- `frontend/` — Next.js 16 marketing site, advocate directory, matter ledger,
  insights, and a multi-step intake UI. Content is still static in
  `frontend/src/data/`.
- `backend/` — Fastify 5 + TypeScript API with Drizzle ORM over SQLite. It
  serves public content, intake requests, and newsletter subscriptions.

There is **no root package manager workspace**. Run commands from `frontend/`
or `backend/`.

## Read order

1. `README.md` — product and quick start.
2. `docs/ARCHITECTURE.md` — how the pieces fit.
3. `docs/API.md` — endpoint contract if touching API or integration.
4. `docs/DATABASE.md` — schema and migration rules.
5. `docs/FRONTEND.md` — routes, components, migration plan.
6. `docs/CONTENT.md` — canonical copy and known content debt.
7. `docs/ROADMAP.md` — current scope and sequencing.
8. `backend/AGENTS.md` or `frontend/AGENTS.md` — stack-specific rules.

## Repository map

```text
frontend/src/app/            App Router pages
frontend/src/components/     layout/, sections/, ui/, 3d/
frontend/src/data/           static content arrays
frontend/src/types/          shared frontend types
backend/src/modules/         feature modules (routes + services + schemas)
backend/src/db/              schema, client, migrate, seed, seed-data
backend/src/shared/          HTTP helpers, pagination, errors, references
backend/drizzle/             generated migrations (commit these)
backend/test/                Vitest integration tests
docs/                        project documentation and ADRs
```

## Commands

### Backend (`backend/`)

```bash
npm install
npm run setup          # migrate + seed
npm run dev            # predev migrates, then tsx watch on :4000
npm run typecheck
npm run lint
npm test
npm run build
npm run start
npm run db:generate    # generate migration after schema change
npm run db:migrate
npm run db:seed        # destructive for content tables only
npm run db:reset       # destructive for everything (drops DB file)
```

### Frontend (`frontend/`)

```bash
npm install
npm run dev            # predev clears port 3000 / stale Next lock
npm run build
npm run start
npm run lint
```

## Non-negotiable conventions

### API

- Business routes live under `/api/v1` (`env.API_PREFIX`). Health routes are
  outside the prefix.
- Success: `{ "data": ..., "meta"?: ... }`.
- Error: `{ "error": { "code", "message", "details"? }, "requestId" }`.
- Pagination metadata comes from `buildPageMeta` in
  `backend/src/shared/http/pagination.ts`.
- Throw `AppError` helpers (`notFound`, `badRequest`, `conflict`) from services
  or routes; never hand-roll a divergent error body.
- Validate input with Zod at the route boundary. Do not trust raw request data.
- Register new route plugins in `backend/src/routes.ts`.

### Backend code

- NodeNext ESM: relative imports **must end in `.js`**, even in TypeScript.
- Use `FastifyPluginAsyncZod` for route plugins.
- Access the database through `request.server.db`; it is decorated in
  `backend/src/app.ts`.
- Keep route handlers thin. Put filtering/query logic in the module's service.
- Use `drizzle-kit generate` to create migrations. Commit the generated SQL and
  snapshot in `backend/drizzle/`.
- Never commit `backend/data/`, `backend/dist/`, `backend/.env`, or WAL files.
- Seed content changes belong in `backend/src/db/seed-data/`, and the seed must
  remain idempotent for public content tables.
- Intake and newsletter rows are user data: `seedDatabase` must not delete them.

### Frontend code

- This is **Next.js 16**, which has breaking changes relative to many training
  corpora. Before using an unfamiliar API, read the bundled docs under
  `frontend/node_modules/next/dist/docs/` as instructed by
  `frontend/AGENTS.md`.
- Preserve the existing visual system: warm paper palette, serif display type,
  mono labels, square borders, restrained motion.
- `frontend/scripts/predev.js` intentionally kills processes on port 3000.
  Do not remove it without replacing the behavior.
- Static data is the current source of truth. If you switch a page to the API,
  keep the static data until the API path is verified end-to-end.
- Do not add a client-side data fetch for content that can be rendered on the
  server.

### Content and compliance

- Canonical identity: **NyayaSetu (न्यायसेतु)**, India, established 2026.
- Do not reintroduce Chicago/Illinois "Ellery Kowal LLP" copy. It is legacy
  template content and is tracked in `docs/CONTENT.md`.
- Never remove or weaken:
  - "preliminary AI assessment is not legal advice"
  - "submitting an intake does not create an advocate-client relationship"
  - the Bar Council of India non-solicitation/non-advertising position
- Fixed-fee packages currently use USD and legacy firm language. Do not present
  them as approved India pricing; see content debt.
- Do not invent advocates, bar enrollments, office addresses, phone numbers, or
  case results. Use existing seed/test data unless the user supplies new facts.

## Verification gates

Before reporting work complete, run the checks relevant to your change.

Backend change:

```bash
cd backend
npm run typecheck
npm run lint
npm test
npm run build
```

Frontend change:

```bash
cd frontend
npm run lint
npm run build
```

Documentation-only change: verify links and command accuracy; no build needed.

## Working with the database

- Local DB path: `backend/data/nyayasetu.db` (gitignored).
- Tests use `:memory:` via `createTestApp()` in `backend/test/helpers.ts`.
- `db:seed` clears and reinserts only content tables, preserving intake and
  newsletter data.
- `db:reset` deletes the SQLite file (plus `-wal`/`-shm`) and recreates it.

## Known traps

- **Markdown gitignore:** root `.gitignore` ignores `*.md` with explicit
  negations. New documentation must live under `docs/`, `backend/`, or
  `frontend/`, or be named `README.md` / `AGENTS.md`, otherwise Git ignores it.
- **Env example:** `.env*` is ignored, but `**/.env.example` is explicitly
  unignored.
- **Pre-existing changes:** the working tree may already contain unrelated
  edits (for example `frontend/package-lock.json`,
  `frontend/src/app/globals.css`, `frontend/src/components/sections/
  practices-slider.tsx`). Do not revert unrelated work.
- **Native module:** `better-sqlite3` needs a prebuilt binary or a C++ toolchain.
- **Rate limits:** global 120/min; intake 10/min; newsletter 5/min.
- **Swagger:** enabled by default in development; disable with
  `ENABLE_SWAGGER=false`.

## When you change behavior

Update the matching documentation in the same change:

- Route or payload → `docs/API.md` and Swagger schema.
- Table, column, or migration → `docs/DATABASE.md`.
- Architecture or integration pattern → `docs/ARCHITECTURE.md`.
- Page, data source, or env var → `docs/FRONTEND.md`.
- Scope or sequencing → `docs/ROADMAP.md`.
