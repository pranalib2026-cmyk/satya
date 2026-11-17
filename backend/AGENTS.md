# AGENTS.md — backend

Read the repository-level [`../AGENTS.md`](../AGENTS.md) first, then this file.

## Scope

This app is the NyayaSetu API: a Fastify 5 modular monolith with TypeScript,
Zod, Drizzle ORM, and SQLite via `better-sqlite3`. It serves public content,
intake requests, and newsletter subscriptions. There is no authentication yet.

## Commands

```bash
npm install
npm run setup          # migrate + seed
npm run dev            # predev migrates, then tsx watch on :4000
npm run typecheck
npm run lint
npm test
npm run build
npm run start          # requires build
npm run db:generate
npm run db:migrate
npm run db:seed        # clears content tables only
npm run db:reset       # destructive full reset
```

Before finishing any backend change, run:

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

## Architecture rules

- `src/app.ts` composes Fastify. `src/server.ts` owns process lifecycle.
- `src/routes.ts` registers health routes outside the prefix and all business
  routes inside `env.API_PREFIX` (`/api/v1`).
- Each feature is a module under `src/modules/<feature>/`:
  - `.routes.ts` — HTTP layer, Zod schemas, status codes, OpenAPI metadata.
  - `.service.ts` — queries and business rules, accepts `AppDatabase`.
  - `.schema.ts` — optional shared schemas/transforms.
- The Drizzle client is decorated as `app.db`; use `request.server.db`.
- Keep route handlers thin. Do not put query builders in routes.
- NodeNext ESM: relative imports **must** end in `.js` (for example
  `./practices.service.js`).

## API contract

- Success: `{ data }` or `{ data, meta }`.
- Error: `{ error: { code, message, details? }, requestId }`.
- Errors go through `AppError` helpers in `src/shared/http/errors.ts`:
  `notFound`, `badRequest`, `conflict`.
- Never hand-roll an error response with a different shape.
- Pagination: use `paginationQuerySchema` and `buildPageMeta` from
  `src/shared/http/pagination.ts`. Defaults are page 1, limit 20, max 100.
- Use `FastifyPluginAsyncZod` and define `params`, `querystring`, and `body`
  schemas.
- Add `tags` and `summary` to every route; they feed Swagger.
- Health endpoints intentionally return flat objects, not the envelope.
- Route ordering matters for literal-vs-param conflicts: register
  `/matters/categories` before `/matters/:slug` and `/insights/categories`
  before `/insights/:slug`.

## Database rules

- Schema: `src/db/schema.ts`. Migrations: `drizzle/` (commit generated SQL and
  snapshots).
- After schema edits: `npm run db:generate`, review, then `npm run db:migrate`.
- Do not edit an applied migration in a shared branch; add a new one.
- Do not add ad-hoc SQL DDL at runtime.
- JSON columns use `text(..., { mode: "json" })` with explicit `$type<...>()`
  and a `sql\`'[]'\`` or `sql\`'{}'\`` default on SQLite.
- Use `timestamp_ms` with `$defaultFn(() => new Date())` for new tables and
  update `updatedAt` explicitly on writes.
- `seedDatabase` may delete only public content tables. It must **never** delete
  `intake_requests` or `newsletter_subscribers`.
- Seed content lives in `src/db/seed-data/`; keep it India-focused. Do not
  reintroduce USD packages or legacy Chicago firm copy.
- Tests use `:memory:` and run the real migrations.

## Intake and PII

`intake_requests` contains personal data: name, email, phone, jurisdiction,
summary, and adverse parties.

- Never log request bodies or full rows.
- Keep `GET /api/v1/intake/:reference` limited to non-sensitive status fields.
- Do not expose intake rows through list endpoints without an auth boundary.
- References (`NS-YYYYMMDD-XXXXXX`) are identifiers, not secrets. Never use them
  as authentication.
- Do not add an admin write/list API before authentication and authorization.
- If you add retention or deletion, document it in `docs/DATABASE.md` and
  `docs/API.md`.

## Content and compliance

- Canonical identity: NyayaSetu (न्यायसेतु), India, established 2026.
- Keep the legal notices in `src/modules/site/site.routes.ts` and route
  descriptions:
  - preliminary assessment is not legal advice
  - intake does not create an advocate-client relationship
  - no advocate solicitation/advertising under BCI Rule 36
- Do not invent advocates, bar numbers, results, offices, or phone numbers.
- `fixed-fees` seed data is explicitly content debt. Do not describe it as
  approved pricing.

## Testing rules

- Use `createTestApp()` from `test/helpers.ts`.
- Seed by default for read tests; pass `{ seed: false }` for write tests.
- Cover at least one success and one failure path per new behavior.
- Prefer `app.inject()` over starting a server.
- Update existing assertions when an envelope or status code changes.
- Update `docs/API.md` for any contract change.

## Common pitfalls

- Missing `.js` extension on a relative import: TypeScript NodeNext rejects it.
- Forgetting to register a new route plugin in `src/routes.ts`.
- Registering a param route before a literal route.
- Editing `src/db/schema.ts` without generating and committing a migration.
- Forgetting `updatedAt` on updates.
- Assuming `like` is case-insensitive on PostgreSQL (it is not; use `ilike` when
  migrating).
- Assuming `partner_ids`, `practice`, or `lead_advocate_id` are foreign keys;
  they are not.
- Running `db:seed` or `db:reset` against data you care about.
- Committing `data/`, `dist/`, `.env`, or WAL files.
- Adding Swagger docs with no `tags`/`summary`, which makes the UI harder to use.

## Definition of done

- Typecheck, lint, tests, and build pass.
- New behavior has tests.
- Errors use the standard envelope.
- No PII in logs or tracking responses.
- Migration generated and committed if the schema changed.
- `docs/API.md`, `docs/DATABASE.md`, or `docs/ARCHITECTURE.md` updated as
  applicable.
- `backend/README.md` remains accurate.
