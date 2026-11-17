# NyayaSetu

**Legal Help Should Be Clear. Justice Should Be Accessible.**

NyayaSetu is an India-focused legal platform concept: a public marketing site, a
preliminary legal-assessment and intake flow, a verified advocate directory, and
a content API for practice areas, representative matters, legal guides, FAQs,
testimonials, and newsletters.

> **Important:** NyayaSetu provides an AI-assisted preliminary legal assessment
> and advocate-discovery platform. It is **not** a law firm and does not replace
> independent advice from a licensed advocate under the Advocates Act, 1961.
> Submitting an intake request does **not** create an advocate-client
> relationship. Advocates listed on the platform do not solicit work or
> advertise, in compliance with Rule 36, Chapter II, Part VI of the Bar Council
> of India Rules.

---

## Repository map

This repository is a lightweight monorepo with two independent applications.
There is no root `package.json`; install and run each app from its own folder.

```text
NyayaSetu/
├── frontend/                 Next.js 16 marketing site and intake UI
│   ├── src/app/              App Router pages
│   ├── src/components/       Layout, sections, and UI primitives
│   ├── src/data/             Static content (migration source for the API)
│   └── scripts/predev.js     Frees port 3000 before `next dev`
├── backend/                  Fastify 5 + TypeScript + Drizzle + SQLite API
│   ├── src/modules/          Feature modules (routes + services + schemas)
│   ├── src/db/               Drizzle schema, migrations, seed data
│   ├── drizzle/              Generated SQL migrations and snapshots
│   └── test/                 Vitest integration tests (in-memory SQLite)
├── docs/                     Architecture, API, database, frontend, roadmap
└── .gitignore
```

| App | Stack | Local URL |
| --- | --- | --- |
| `frontend/` | Next.js 16.4.5, React 19.3, TypeScript, Tailwind CSS 4, Framer Motion, Three.js | <http://localhost:3000> |
| `backend/` | Node.js 22+, Fastify 5, TypeScript, Zod 4, Drizzle ORM, SQLite (`better-sqlite3`), Pino, Vitest | <http://localhost:4000> |

---

## Quick start

### Prerequisites

- Node.js **22 or newer** (verified with Node 24)
- npm 10 or newer
- Optional: a C++ build toolchain for `better-sqlite3` if no prebuilt binary is
  available for your platform

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env        # Windows PowerShell: Copy-Item .env.example .env
npm run setup               # apply migrations + seed content
npm run dev                 # http://localhost:4000
```

`npm run dev` also runs `predev`, which applies pending migrations before the
server starts. It does **not** re-seed, so local intake data is preserved.

Useful backend commands:

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run start
npm run db:reset            # destructive: recreate DB + reseed
```

- Swagger UI: <http://localhost:4000/docs>
- OpenAPI JSON: <http://localhost:4000/docs/json>
- Liveness: <http://localhost:4000/health>
- Readiness: <http://localhost:4000/health/ready>

### 2. Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev                 # http://localhost:3000
```

`predev` clears a stale `.next/dev/lock` and kills whatever is listening on port
3000 before starting Next.js. This is intentional for this project; do not run
two frontend dev servers on the same machine.

### 3. Run both

- Keep the backend on port **4000** and the frontend on port **3000**.
- The backend CORS allow-list defaults to `http://localhost:3000`.
- The frontend currently reads static content from `frontend/src/data/`; API
  integration is the next milestone. See `docs/FRONTEND.md`.

---

## API at a glance

All business endpoints are mounted under `/api/v1`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Liveness probe |
| `GET` | `/health/ready` | Database readiness probe |
| `GET` | `/api/v1/site` | Brand, offices, languages, support, legal notices |
| `GET` | `/api/v1/practices` | List practice areas |
| `GET` | `/api/v1/practices/:slug` | Practice area by slug or id |
| `GET` | `/api/v1/advocates` | Paginated advocate directory |
| `GET` | `/api/v1/advocates/:id` | Advocate by id |
| `GET` | `/api/v1/matters` | Paginated representative matters |
| `GET` | `/api/v1/matters/categories` | Matter categories |
| `GET` | `/api/v1/matters/:slug` | Matter by slug or id |
| `GET` | `/api/v1/insights` | Paginated legal guides |
| `GET` | `/api/v1/insights/categories` | Insight categories |
| `GET` | `/api/v1/insights/:slug` | Insight by slug or id |
| `GET` | `/api/v1/catalog` | FAQs + testimonials + fixed fees |
| `GET` | `/api/v1/faqs` | FAQs |
| `GET` | `/api/v1/testimonials` | Testimonials |
| `GET` | `/api/v1/fixed-fees` | Fixed-fee packages (legacy content, see below) |
| `POST` | `/api/v1/intake` | Legal assessment, conflict check, or consultation |
| `GET` | `/api/v1/intake/:reference` | Limited intake status by reference |
| `POST` | `/api/v1/newsletter` | Idempotent newsletter subscription |

Success responses use `{ "data": ..., "meta"?: ... }`. Errors use
`{ "error": { "code", "message", "details"? }, "requestId" }`. Full request and
response documentation lives in [`docs/API.md`](docs/API.md) and the live
Swagger UI.

---

## Environment

Backend variables are validated with Zod at boot. Copy
[`backend/.env.example`](backend/.env.example) and adjust as needed.

| Variable | Default | Notes |
| --- | --- | --- |
| `NODE_ENV` | `development` | `development`, `test`, or `production` |
| `HOST` | `0.0.0.0` | Bind address |
| `PORT` | `4000` | API port |
| `DATABASE_URL` | `./data/nyayasetu.db` | SQLite file or `:memory:` |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated allow-list |
| `PUBLIC_BASE_URL` | `http://localhost:4000` | Used in OpenAPI metadata |
| `API_PREFIX` | `/api/v1` | Must start with `/` |
| `LOG_LEVEL` | `info` | Pino level |
| `RATE_LIMIT_MAX` | `120` | Global requests per window per IP |
| `RATE_LIMIT_WINDOW` | `1 minute` | Global rate-limit window |
| `ENABLE_SWAGGER` | `true` | Set `false` to disable `/docs` |

The frontend has no environment contract yet. When API integration begins, add
`NEXT_PUBLIC_API_URL` and document it in `docs/FRONTEND.md`.

---

## Documentation

| Document | What it covers |
| --- | --- |
| [`docs/README.md`](docs/README.md) | Documentation index and recommended reading paths |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System design, request lifecycle, deployment topology |
| [`docs/API.md`](docs/API.md) | Endpoint contract, parameters, envelopes, examples |
| [`docs/DATABASE.md`](docs/DATABASE.md) | Tables, relationships, migrations, seeding, Postgres path |
| [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) | Setup, scripts, workflows, troubleshooting |
| [`docs/FRONTEND.md`](docs/FRONTEND.md) | Routes, components, data layer, API migration plan |
| [`docs/CONTENT.md`](docs/CONTENT.md) | Canonical copy, content-debt register, compliance guardrails |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Phased delivery plan and known gaps |
| [`docs/adr/0001-backend-stack.md`](docs/adr/0001-backend-stack.md) | Why Fastify + Drizzle + SQLite |
| [`backend/README.md`](backend/README.md) | Backend-specific setup and module conventions |
| [`backend/AGENTS.md`](backend/AGENTS.md) | Rules for AI agents working in the backend |
| [`frontend/README.md`](frontend/README.md) | Frontend-specific setup and structure |
| [`frontend/AGENTS.md`](frontend/AGENTS.md) | Rules for AI agents working in the frontend |

---

## Current status

- ✅ Backend scaffold with 9 tables, generated migration, and seed data.
- ✅ Read-only content API for site config, practices, advocates, matters,
  insights, catalog, and categories.
- ✅ Intake API for legal assessment, conflict check, and consultation, with
  human-readable reference tracking.
- ✅ Newsletter subscription with idempotent upsert.
- ✅ Swagger/OpenAPI, CORS, Helmet, rate limiting, structured logging.
- ✅ Vitest integration tests using in-memory SQLite.
- ⏳ Frontend still consumes static arrays in `frontend/src/data/`.
- ⏳ No authentication or admin write API yet.
- ⚠️ Mixed legacy content: several pages still contain "Ellery Kowal LLP"
  Chicago/Illinois copy, and seeded fixed-fee packages use USD. Treat this as
  content debt, not as canonical product copy. See
  [`docs/CONTENT.md`](docs/CONTENT.md).

---

## Conventions

- **API envelope:** `{ data, meta? }` for success, `{ error, requestId }` for
  failures.
- **Validation:** Zod schemas at the route boundary; services accept plain typed
  input.
- **Database:** SQLite locally; use Drizzle migrations, never ad-hoc schema
  changes.
- **Backend module layout:** `src/modules/<feature>/<feature>.routes.ts`,
  `<feature>.service.ts`, optional `<feature>.schema.ts`.
- **TypeScript imports:** backend uses NodeNext, so relative imports include the
  `.js` extension.
- **Testing:** add or update Vitest coverage for any behavior change.
- **Compliance:** never remove the "not legal advice" and "no advocate-client
  relationship" notices from public copy or API descriptions.

---

## License

No license has been declared for this repository. Treat it as private and
proprietary until a license is added.
