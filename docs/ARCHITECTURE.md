# Architecture

## 1. System context

NyayaSetu is split into a public Next.js application and a standalone HTTP API.
The frontend currently reads static content; the backend already exposes the
same content plus intake and newsletter writes.

```text
┌──────────────────────────────┐         ┌──────────────────────────────┐
│          Browser             │         │        Search / Social        │
└──────────────┬───────────────┘         └──────────────┬───────────────┘
               │ HTTPS                                  │
               ▼                                        │
┌──────────────────────────────┐                         │
│  frontend/ — Next.js 16      │◄────────────────────────┘
│  App Router + RSC + client   │
│  components, static data     │
└──────────────┬───────────────┘
               │ HTTP JSON (future / in progress)
               ▼
┌──────────────────────────────┐
│  backend/ — Fastify 5 API    │
│  Zod validation, services,   │
│  Swagger, rate limits        │
└──────────────┬───────────────┘
               │ Drizzle ORM
               ▼
┌──────────────────────────────┐
│  SQLite (local)              │
│  PostgreSQL (production target)
└──────────────────────────────┘
```

There is no shared package or root workspace. Each app has its own
`package.json`, `node_modules`, TypeScript config, and lifecycle.

## 2. Frontend architecture

**Location:** `frontend/`

| Concern | Implementation |
| --- | --- |
| Framework | Next.js 16.4.5 App Router |
| UI runtime | React 19.3 |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 + custom CSS tokens in `src/app/globals.css` |
| Motion | Framer Motion 14 |
| 3D | Three.js + `@react-three/fiber` + `@react-three/drei` |
| Icons | `lucide-react` |
| Utilities | `clsx`, `tailwind-merge` in `src/lib/utils.ts` |

### Rendering model

- `src/app/layout.tsx` defines metadata, fonts, the navbar, footer, and
  back-to-top control.
- Most pages are server components. Pages with state or browser APIs opt into
  `"use client"` (for example `contact/page.tsx`, `practices/page.tsx`).
- Content is imported synchronously from `src/data/`.
- The Lady Justice 3D scene is isolated in
  `src/components/3d/lady-justice-canvas.tsx` and loaded from the hero section.
- The contract annotator and intake forms are client-only simulations.

### Page map

| Route | File | Notes |
| --- | --- | --- |
| `/` | `src/app/page.tsx` | Composes 11 marketing sections |
| `/practices` | `src/app/practices/page.tsx` | Practice anchors + consultation modal |
| `/people` | `src/app/people/page.tsx` | Advocate directory + vCard download |
| `/matters` | `src/app/matters/page.tsx` | Filterable representative matters |
| `/insights` | `src/app/insights/page.tsx` | Guide index + newsletter UI |
| `/insights/[slug]` | `src/app/insights/[slug]/page.tsx` | Guide detail |
| `/firm` | `src/app/firm/page.tsx` | Firm story, timeline, commitments |
| `/contact` | `src/app/contact/page.tsx` | 4-step conflict-check intake |
| `/privacy` | `src/app/privacy/page.tsx` | Privacy notice |
| `/disclaimer` | `src/app/disclaimer/page.tsx` | Legal notices |
| `not-found` | `src/app/not-found.tsx` | Custom 404 |
| `sitemap` | `src/app/sitemap.ts` | Metadata route |

See [`FRONTEND.md`](FRONTEND.md) for component-level detail and the API
integration plan.

## 3. Backend architecture

**Location:** `backend/`

The backend is a modular monolith. A process contains one Fastify instance, one
Drizzle client, and a set of feature plugins.

```text
src/server.ts
  └─ createDatabase()             better-sqlite3 + PRAGMAs + Drizzle
  └─ buildApp({ db })             Fastify instance
       ├─ @fastify/sensible
       ├─ @fastify/cors
       ├─ @fastify/helmet
       ├─ @fastify/rate-limit
       ├─ @fastify/swagger + swagger-ui   (optional)
       ├─ error handlers
       └─ registerRoutes()
            ├─ /health, /health/ready
            └─ /api/v1
                 ├─ site
                 ├─ practices
                 ├─ advocates
                 ├─ matters
                 ├─ insights
                 ├─ catalog (faqs, testimonials, fixed-fees)
                 ├─ intake
                 └─ newsletter
```

### Layers

| Layer | Responsibility | Location |
| --- | --- | --- |
| Composition root | Create DB, build app, start/stop | `src/server.ts`, `src/app.ts` |
| Routing | HTTP verbs, schemas, status codes | `src/modules/**/*.routes.ts`, `src/routes.ts` |
| Validation | Zod request schemas and transforms | route plugins, `*.schema.ts` |
| Domain/service | Query building and business rules | `src/modules/**/*.service.ts` |
| Persistence | Tables, indexes, types | `src/db/schema.ts` |
| Cross-cutting | Errors, pagination, references, config | `src/shared/`, `src/config/` |

### Key decisions

- **Database injection:** `app.decorate("db", db)` makes the Drizzle client
  available as `request.server.db`. Tests create an in-memory instance.
- **Zod type provider:** `fastify-type-provider-zod` supplies runtime validation,
  serialization, and OpenAPI generation from route schemas.
- **Synchronous SQLite:** `better-sqlite3` is synchronous. Handlers are `async`
  for Fastify ergonomics, but individual queries block the event loop. This is
  acceptable for the current low-write workload; move to PostgreSQL before
  horizontal scaling or heavy write traffic.
- **No authentication yet:** all endpoints are public. Admin/auth is a roadmap
  item. Do not assume a user identity exists.
- **Thin routes:** route handlers validate, call a service, and shape the
  response. Filtering and query building live in services.
- **Consistent envelopes:** success is `{ data, meta? }`; errors are
  `{ error, requestId }`. Health checks are the deliberate exception and return
  flat status objects for probes.

### Request lifecycle

1. Fastify receives the request and assigns `request.id`.
2. Rate limit runs on request.
3. Zod validates params/query/body.
4. The route calls a service with `request.server.db`.
5. The service returns typed rows or throws an `AppError`.
6. The type provider serializes the response using the schema/validator.
7. `setErrorHandler` maps `AppError`, Zod errors, and Fastify client errors to
   the standard error envelope; unknown errors become `500 internal_error` and
   are logged.

### Module pattern

```text
src/modules/example/
├── example.routes.ts      FastifyPluginAsyncZod, schemas, HTTP status
├── example.service.ts     pure DB queries and business logic
└── example.schema.ts      shared Zod schemas (optional)
```

A new module is registered in `src/routes.ts` inside the `/api/v1` scope.

## 4. Data flow: current vs target

### Current

```text
frontend/src/data/*.ts ──► React pages
backend seed-data/*.ts ──► SQLite ──► API (not consumed by frontend)
```

The two content sets were aligned manually. Neither is generated from the
other, so changes must be applied in both places until the frontend switches to
API reads.

### Target

```text
backend seed/DB ──► Fastify API ──► Next.js server components
                                  └─ client forms POST /intake, /newsletter
```

Recommended migration order:

1. Add a typed API client in `frontend/src/lib/api.ts`.
2. Move read-only pages (site, practices, advocates, matters, insights) to
   server-side fetches with revalidation.
3. Wire the intake form to `POST /api/v1/intake` and show the returned reference.
4. Wire the newsletter form to `POST /api/v1/newsletter`.
5. Delete static arrays only after every consumer is migrated.

## 5. Data model

Nine tables, all defined in `backend/src/db/schema.ts`:

| Table | Purpose |
| --- | --- |
| `practices` | Practice areas, fee bands, scope, forums, results |
| `advocates` | Verified advocate directory |
| `matters` | Representative matters / outcomes |
| `insights` | Legal guides and publications |
| `faqs` | Public FAQs |
| `testimonials` | Client quotes |
| `fixed_fees` | Fixed-fee packages (currently legacy content) |
| `intake_requests` | Legal assessment, conflict check, consultation |
| `newsletter_subscribers` | Idempotent email subscriptions |

Full column and index documentation is in [`DATABASE.md`](DATABASE.md).

## 6. Security and compliance

Implemented:

- Helmet security headers (CSP disabled for Swagger UI compatibility).
- CORS allow-list from `CORS_ORIGINS`.
- Global and per-route rate limits.
- Zod validation and bounded string lengths.
- Intake tracking returns only non-sensitive status fields.
- Email normalization for intake and newsletter.
- Human-readable but non-secret intake references.
- Structured logs via Pino.

Not implemented:

- Authentication, authorization, admin roles, or audit trails.
- CSRF protection for cookie-based sessions (no sessions exist yet).
- Encryption at rest beyond the host filesystem.
- Email/WhatsApp delivery, captcha, or bot protection.
- PII retention automation.
- Secrets management beyond environment variables.

Compliance guardrails:

- Preliminary assessment is not legal advice.
- Intake does not create an advocate-client relationship.
- No advocate solicitation or advertising (BCI Rule 36).
- Do not log request bodies containing intake PII.

## 7. Deployment topology

### Local development

```text
localhost:3000  Next.js dev server
localhost:4000  Fastify + SQLite file
```

### Target production

```text
Vercel / Node host ──► Next.js
Render / Fly / Railway / VPS ──► Fastify container or Node process
                                  └─ PostgreSQL managed instance
```

Constraints:

- SQLite requires a single writer and a persistent disk. It is unsuitable for
  serverless or multi-instance deployments.
- Set `NODE_ENV=production`, `ENABLE_SWAGGER=false`, a strict `CORS_ORIGINS`,
  and a real `PUBLIC_BASE_URL`.
- Run migrations as a release step before starting the new process.
- Add a reverse proxy with TLS, request size limits, and access logs.
- Replace the SQLite driver with `drizzle-orm/node-postgres` (or `postgres-js`)
  and regenerate migrations for PostgreSQL.

## 8. Extension points

| Need | Suggested approach |
| --- | --- |
| Admin content editing | Add auth + `POST/PATCH/DELETE` routes and an audit table |
| AI assessment | Add an `assessment` module; persist inputs/results; never return advice as final legal advice |
| Advocate matching | Join on `practice`, `languages`, jurisdiction, and availability; add a matching table |
| Court tracking | Add `cases`, `hearings`, `case_events`; integrate a court-data provider |
| Payments | Add a payment provider adapter and an `orders` table; keep fee text separate from charged amounts |
| Email/WhatsApp | Add an outbox table and background worker; retries must be idempotent |
| Multilingual content | Add locale columns or translation tables; current language list is metadata only |
| Observability | Add OpenTelemetry, request IDs in responses, and error tracking |

See [`ROADMAP.md`](ROADMAP.md) for sequencing.
