# ADR 0001 — Backend stack: Fastify + Drizzle + SQLite

- **Status:** Accepted
- **Date:** 2026-11-17
- **Deciders:** NyayaSetu engineering
- **Supersedes:** None

## Context

NyayaSetu needs an API for public content, legal intake, and newsletter
subscriptions. The frontend is a Next.js 16 application with static data. The
team is small, the immediate environment has no Docker or PostgreSQL, and the
first goal is a working, well-typed backend that a new contributor can run in
minutes.

Requirements:

- Strong TypeScript support and runtime validation.
- Fast local startup with no external services.
- Typed database access and migrations.
- OpenAPI documentation for frontend integration.
- Basic production security middleware.
- A clear path to PostgreSQL later.
- Low operational overhead while the product is being validated.

## Decision

Use:

| Concern | Choice |
| --- | --- |
| Runtime | Node.js 22+ |
| Framework | Fastify 5 |
| Language | TypeScript, NodeNext ESM |
| Validation / serialization | Zod 4 + `fastify-type-provider-zod` |
| ORM | Drizzle ORM |
| Local database | SQLite via `better-sqlite3` |
| Logging | Pino (+ `pino-pretty` in development) |
| API docs | `@fastify/swagger` + `@fastify/swagger-ui` |
| Security | `@fastify/helmet`, `@fastify/cors`, `@fastify/rate-limit` |
| Tests | Vitest + Fastify `inject()` + in-memory SQLite |
| Lint / build | ESLint 9 + `typescript-eslint`, `tsc` |

The backend is a modular monolith organized by feature:

```text
src/modules/<feature>/
├── <feature>.routes.ts
├── <feature>.service.ts
└── <feature>.schema.ts
```

Routes are thin; services own queries and business rules; Drizzle owns
persistence. The database client is injected into Fastify and accessed through
`request.server.db`.

## Why these choices

### Fastify 5

- Mature plugin model and schema-first routing.
- Excellent performance for a small JSON API.
- `inject()` makes integration tests fast and port-free.
- First-class support for the Zod type provider.
- Less framework surface area than NestJS for a small team.

### Zod 4 + type provider

- One schema validates requests and drives OpenAPI.
- Runtime validation is mandatory at the public boundary.
- Transforms handle normalization such as legacy urgency aliases and pagination
  coercion.
- No separate DTO layer is needed at this scale.

### Drizzle ORM

- SQL-like, typed queries without a heavy runtime.
- Explicit schema in TypeScript and generated SQL migrations.
- Easy to inspect and review.
- Supports SQLite now and PostgreSQL with a driver/schema conversion.

### SQLite for local and early environments

- Zero external services; the repo runs with `npm install` and `npm run setup`.
- Synchronous driver keeps the code simple.
- In-memory databases make tests deterministic.
- WAL mode, foreign keys, and a busy timeout are sufficient for low-write local
  use.

### Vitest

- Fast, TypeScript-native, works well with ESM.
- `app.inject()` gives route-level integration coverage without network flakiness.

## Consequences

### Positive

- A new developer can run the API without Docker.
- Strong typing end-to-end, from Zod request to Drizzle row.
- Swagger stays close to the implementation.
- Tests run in seconds and do not require a database server.
- The module pattern is easy to extend.

### Negative / risks

- `better-sqlite3` is a native module; installation needs a prebuilt binary or a
  C++ toolchain.
- SQLite allows a single writer and is unsuitable for serverless or multi-instance
  deployments without a shared database.
- Synchronous queries block the event loop; heavy writes or long reports would
  degrade latency.
- JSON columns are stored as text; filtering with `LIKE` is pragmatic, not
  scalable.
- There are no enforced foreign keys between content tables.
- Fastify's lower abstraction means the team owns more conventions than with
  NestJS.
- Zod response serialization is currently only applied where response schemas
  exist; adding them is a follow-up.

### Mitigations

- Document PostgreSQL migration steps in [`../DATABASE.md`](../DATABASE.md).
- Keep `DATABASE_URL` as the only database switch.
- Set `NODE_ENV=production`, disable Swagger, and restrict CORS in production.
- Add response schemas and normalize relationships before scale.
- Add CI and dependency scanning.
- Do not log request bodies containing intake PII.

## Alternatives considered

| Alternative | Why not now |
| --- | --- |
| PostgreSQL from day one | No local PostgreSQL/Docker in the initial environment; adds setup friction before product validation |
| Prisma | Strong tooling, but a heavier runtime and less SQL-like control; Drizzle fits the small, explicit schema better |
| NestJS | More structure than needed for a small modular monolith; higher learning and boilerplate cost |
| Express | Fewer built-in schemas, validation, and OpenAPI integration; more glue code |
| Python (FastAPI) | Viable, but the team and frontend are TypeScript-first; one language reduces context switching |
| tRPC | Excellent for a tightly coupled TS monorepo, but this repo has independent apps and a public API that benefits from OpenAPI and plain HTTP |
| Serverless functions + hosted DB | Premature; increases vendor coupling and cold-start/complexity before the product is validated |

## Follow-up decisions

1. When and how to migrate to PostgreSQL (trigger: multi-instance deploy, write
   contention, or reporting needs).
2. Authentication and admin authorization model.
3. Notification provider and outbox design.
4. AI assessment provider, safety policy, and data retention.
5. Whether to move to a package workspace once shared types are needed.

## References

- [`../ARCHITECTURE.md`](../ARCHITECTURE.md)
- [`../DATABASE.md`](../DATABASE.md)
- [`../API.md`](../API.md)
- [`../ROADMAP.md`](../ROADMAP.md)
