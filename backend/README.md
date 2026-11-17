# NyayaSetu backend

Fastify 5 + TypeScript API for NyayaSetu content, legal intake, conflict checks,
consultations, and newsletter subscriptions.

- Runtime: Node.js 22+
- Framework: Fastify 5
- Validation: Zod 4 with `fastify-type-provider-zod`
- ORM: Drizzle ORM
- Database: SQLite (`better-sqlite3`) locally; PostgreSQL is the production target
- Tests: Vitest + Fastify `inject()` + in-memory SQLite
- Docs: Swagger UI at `/docs`, OpenAPI JSON at `/docs/json`

## Quick start

```bash
cd backend
npm install
cp .env.example .env       # PowerShell: Copy-Item .env.example .env
npm run setup              # migrate + seed
npm run dev
```

The API listens on <http://localhost:4000> by default.

Verify:

```bash
curl http://localhost:4000/health
curl http://localhost:4000/health/ready
curl http://localhost:4000/api/v1/practices
```

Open:

- Swagger UI: <http://localhost:4000/docs>
- OpenAPI JSON: <http://localhost:4000/docs/json>
- API index: <http://localhost:4000/api/v1/>

## Scripts

| Script | Description |
| --- | --- |
| `npm run predev` | Applies pending migrations (runs before `dev`) |
| `npm run dev` | `tsx watch src/server.ts` |
| `npm run build` | Compile to `dist/` |
| `npm run start` | Run `dist/server.js` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run lint:fix` | ESLint with fixes |
| `npm test` | Vitest single run |
| `npm run test:watch` | Vitest watch mode |
| `npm run db:generate` | Generate a migration from schema changes |
| `npm run db:migrate` | Apply migrations |
| `npm run db:seed` | Clear and reseed public content |
| `npm run db:reset` | Delete DB, migrate, seed (destructive) |
| `npm run setup` | `db:migrate && db:seed` |

## Environment

Configuration is validated with Zod in `src/config/env.ts`. Copy
`.env.example` to `.env`.

| Variable | Default | Notes |
| --- | --- | --- |
| `NODE_ENV` | `development` | `development`, `test`, `production` |
| `HOST` | `0.0.0.0` | Bind address |
| `PORT` | `4000` | HTTP port |
| `DATABASE_URL` | `./data/nyayasetu.db` | Relative to `backend/`, or `:memory:` |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated allow-list |
| `PUBLIC_BASE_URL` | `http://localhost:4000` | Used in OpenAPI metadata/logs |
| `API_PREFIX` | `/api/v1` | Must start with `/` |
| `LOG_LEVEL` | `info` | Pino level |
| `RATE_LIMIT_MAX` | `120` | Global limit per window per IP |
| `RATE_LIMIT_WINDOW` | `1 minute` | Global window |
| `ENABLE_SWAGGER` | `true` | Disables `/docs` and `/docs/json` when false |

Invalid configuration prints field errors and exits with code 1.

Never commit `.env`. It is gitignored; `.env.example` is tracked.

## Structure

```text
backend/
├── drizzle/                     Generated migrations + snapshots
├── src/
│   ├── app.ts                   Fastify composition, plugins, Swagger
│   ├── server.ts                Process entry point, signals, listen
│   ├── routes.ts                Registers health + /api/v1 plugins
│   ├── config/env.ts            Zod-validated environment
│   ├── db/
│   │   ├── schema.ts            Drizzle tables and row types
│   │   ├── client.ts            better-sqlite3 + PRAGMAs + Drizzle
│   │   ├── migrate.ts           Migration runner
│   │   ├── seed.ts              Content seed function + CLI
│   │   ├── reset.ts             Destructive reset command
│   │   └── seed-data/           Content arrays copied/aligned from frontend
│   ├── modules/
│   │   ├── health/              Liveness + readiness
│   │   ├── site/                Brand, offices, languages, legal notices
│   │   ├── practices/           Practice areas
│   │   ├── advocates/           Advocate directory
│   │   ├── matters/             Representative matters
│   │   ├── insights/            Legal guides
│   │   ├── catalog/             FAQs, testimonials, fixed fees
│   │   ├── intake/              Assessment/conflict/consultation
│   │   └── newsletter/          Subscriptions
│   ├── shared/
│   │   ├── http/                Errors, error handler, pagination
│   │   └── lib/                 Reference generator
│   └── types/fastify.d.ts       `app.db` decorator typing
└── test/
    ├── helpers.ts               In-memory test app factory
    ├── content.test.ts          Content and health coverage
    └── intake.test.ts           Intake and newsletter coverage
```

## API

All business routes are under `/api/v1`.

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health` | Liveness (no DB) |
| `GET` | `/health/ready` | Readiness (`select 1`) |
| `GET` | `/api/v1/` | API index |
| `GET` | `/api/v1/site` | Site configuration |
| `GET` | `/api/v1/practices` | List practice areas |
| `GET` | `/api/v1/practices/:slug` | Practice by slug or id |
| `GET` | `/api/v1/advocates` | Paginated directory |
| `GET` | `/api/v1/advocates/:id` | Advocate by id |
| `GET` | `/api/v1/matters` | Paginated matters |
| `GET` | `/api/v1/matters/categories` | Distinct categories |
| `GET` | `/api/v1/matters/:slug` | Matter by slug or id |
| `GET` | `/api/v1/insights` | Paginated guides |
| `GET` | `/api/v1/insights/categories` | Distinct categories |
| `GET` | `/api/v1/insights/:slug` | Guide by slug or id |
| `GET` | `/api/v1/catalog` | FAQs + testimonials + fixed fees |
| `GET` | `/api/v1/faqs` | FAQs |
| `GET` | `/api/v1/testimonials` | Testimonials |
| `GET` | `/api/v1/fixed-fees` | Fixed-fee packages |
| `POST` | `/api/v1/intake` | Create an intake request |
| `GET` | `/api/v1/intake/:reference` | Limited status tracking |
| `POST` | `/api/v1/newsletter` | Subscribe / resubscribe |

Success envelope: `{ "data": ..., "meta"?: ... }`.

Error envelope:

```json
{
  "error": { "code": "validation_error", "message": "Request validation failed.", "details": [] },
  "requestId": "req-1"
}
```

Rate limits: global 120/min, intake 10/min, newsletter 5/min (per IP).

Full contract: [`../docs/API.md`](../docs/API.md).

## Conventions

### Module layout

```text
src/modules/example/
├── example.routes.ts      FastifyPluginAsyncZod
├── example.service.ts     DB queries and business rules
└── example.schema.ts      Optional shared schemas
```

### Rules

- Relative imports include `.js` (NodeNext ESM).
- Routes validate and shape HTTP; services own queries.
- Access the database via `request.server.db`.
- Use `AppError` helpers (`notFound`, `badRequest`, `conflict`) for failures.
- Use `buildPageMeta` and `paginationQuerySchema` for lists.
- Register new route plugins in `src/routes.ts` inside the `/api/v1` scope.
- Add OpenAPI `tags` and `summary` to every route.
- Add response schemas when you need a documented payload or strict
  serialization (currently most read routes omit them).

### Adding a feature

1. Add the table to `src/db/schema.ts`.
2. `npm run db:generate` and review the SQL.
3. `npm run db:migrate`.
4. Add `src/modules/<feature>/<feature>.service.ts`.
5. Add `<feature>.routes.ts` with Zod schemas.
6. Register in `src/routes.ts`.
7. Add seed data if it is public content.
8. Add tests in `test/`.
9. Update `docs/API.md` and `docs/DATABASE.md`.

## Database

Local file: `data/nyayasetu.db` (gitignored, including `-wal`/`-shm`).

```bash
npm run db:generate    # after schema edits
npm run db:migrate
npm run db:seed        # content only; preserves intake/newsletter
npm run db:reset       # destructive full reset
```

Seed volume: 6 practices, 7 advocates, 6 matters, 9 insights, 6 FAQs,
4 testimonials, 3 fixed fees.

`seedDatabase` clears only content tables. Never change it to delete
`intake_requests` or `newsletter_subscribers`.

Full schema and PostgreSQL path: [`../docs/DATABASE.md`](../docs/DATABASE.md).

## Testing

```bash
npm test
```

Tests:

- Use `:memory:` SQLite.
- Run the real migrations.
- Seed by default; pass `{ seed: false }` for write-only suites.
- Use `buildApp({ db, logger: false })` and `app.inject()`.
- Do not open a network port.

Current suites cover health, readiness, practices, advocate filters, insight
pagination, 404 envelopes, intake creation/tracking, urgency aliases, consent and
email validation, and newsletter idempotency.

When changing API behavior, update tests and [`../docs/API.md`](../docs/API.md).

## Production notes

Before deploying:

- Set `NODE_ENV=production`.
- Set `ENABLE_SWAGGER=false` unless the docs are intentionally public.
- Set a strict `CORS_ORIGINS` and real `PUBLIC_BASE_URL`.
- Run migrations as a release step, then start `node dist/server.js`.
- Put the process behind TLS and a reverse proxy.
- Use PostgreSQL for multi-instance or serverless hosting. SQLite needs a
  persistent disk and a single writer.
- Do not log request bodies containing intake PII.
- Add backups, error tracking, and retention/deletion jobs.

There is no authentication yet. Do not expose admin functionality or assume a
user identity until auth is implemented.

## Troubleshooting

### `better-sqlite3` install fails

Confirm Node 22+, install a C++ toolchain, then:

```bash
npm rebuild better-sqlite3
```

### `no such table`

```bash
npm run db:migrate
```

### `SQLITE_BUSY` / database is locked

Stop duplicate backend processes. Do not run `db:reset` while the API is running.
The client sets a 5-second busy timeout.

### CORS failure

Add the exact frontend origin (including protocol and port) to `CORS_ORIGINS`
and restart. Do not use `*` outside local experiments.

### Swagger missing

Set `ENABLE_SWAGGER=true` and restart. It is disabled under `NODE_ENV=test` by
the Vitest config.

### 429 responses

Global 120/min, intake 10/min, newsletter 5/min. Check `retry-after`.

## Known content debt

`src/db/seed-data/fixed-fees.ts` still contains USD packages and legacy firm
language. Do not treat the amounts as approved India pricing. See
[`../docs/CONTENT.md`](../docs/CONTENT.md).

## Related documentation

- [`../README.md`](../README.md) — repository overview
- [`../AGENTS.md`](../AGENTS.md) — agent rules
- [`AGENTS.md`](AGENTS.md) — backend-specific agent rules
- [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md)
- [`../docs/API.md`](../docs/API.md)
- [`../docs/DATABASE.md`](../docs/DATABASE.md)
- [`../docs/DEVELOPMENT.md`](../docs/DEVELOPMENT.md)
- [`../docs/adr/0001-backend-stack.md`](../docs/adr/0001-backend-stack.md)
