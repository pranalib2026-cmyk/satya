# Roadmap

This roadmap reflects the repository as of November 2026. It separates what is
already working from what is planned. Adjust sequencing with the product owner;
do not treat unchecked items as implemented.

## Guiding constraints

- Local development must stay simple: no Docker requirement for the default path.
- The backend remains the content source of truth once integration begins.
- Compliance copy ships with the product, not after it.
- No feature may imply an advocate-client relationship or guaranteed outcome.
- PostgreSQL is the production database target; SQLite is the local/default path.

---

## Phase 0 — Foundation (done)

- [x] Next.js 16 frontend with App Router, Tailwind 4, Framer Motion, Three.js.
- [x] India-focused marketing pages and static content.
- [x] Fastify 5 + TypeScript backend scaffold.
- [x] Zod validation and typed route schemas.
- [x] Drizzle schema with 9 tables and generated migration.
- [x] Seed data for practices, advocates, matters, insights, FAQs, testimonials,
      and fixed fees.
- [x] Read APIs for content.
- [x] Intake API with three kinds and reference tracking.
- [x] Newsletter subscription with idempotent upsert.
- [x] Helmet, CORS, rate limiting, Pino logging, Swagger UI.
- [x] Vitest integration tests with in-memory SQLite.
- [x] Architecture, API, database, frontend, content, and development docs.

---

## Phase 1 — Connect frontend to API (next)

### 1.1 API client and configuration

- [ ] Add `NEXT_PUBLIC_API_URL` (or a server-only equivalent) and document it.
- [ ] Create `frontend/src/lib/api.ts` with typed envelope parsing and errors.
- [ ] Decide cache/revalidation policy per endpoint.
- [ ] Add a shared error boundary/fallback for API failures.

### 1.2 Read-path migration

- [ ] `/site` → navbar, footer, contact, and legal notices.
- [ ] `/practices` → home slider and practices page.
- [ ] `/advocates` → people page, including pagination/filter wiring.
- [ ] `/matters` + `/matters/categories` → matters page.
- [ ] `/insights` + `/insights/categories` → insights index and detail.
- [ ] `/catalog` → FAQs, testimonials, fixed-fee section.
- [ ] Remove static arrays only after every consumer is migrated.

### 1.3 Write-path migration

- [ ] `/contact` form → `POST /api/v1/intake` (`kind: "conflict-check"` or
      `legal-assessment`).
- [ ] Home conflict section → same endpoint.
- [ ] Quick consultation modal → `kind: "consultation"` with preferred slot.
- [ ] Display returned `reference`, `nextStep`, and `trackingUrl`.
- [ ] Map server validation errors to form fields.
- [ ] Handle `429` with a clear retry message.
- [ ] `/insights` newsletter form → `POST /api/v1/newsletter`; remove the
      simulated success.

### 1.4 Content cleanup

- [ ] Complete the P0 items in [`CONTENT.md`](CONTENT.md).
- [ ] Replace USD fixed-fee packages with approved INR content or hide them.
- [ ] Fix sitemap base URL, metadata, and not-found copy.
- [ ] Rename the frontend package and remove legacy CSS comments.
- [ ] Align insight categories between data, tabs, and API.

### 1.5 Quality

- [ ] Add frontend tests for intake mapping and form validation.
- [ ] Add a smoke test or Playwright flow for intake submission.
- [ ] Add API response schemas so OpenAPI includes response shapes.
- [ ] Add an OpenAPI example generation check to CI.

**Exit criteria:** the public site reads content from the API, all forms create
real records, and no user-facing legacy firm copy remains.

---

## Phase 2 — Operations and admin

### 2.1 Authentication and authorization

- [ ] Choose an auth approach (session cookies or JWT with refresh).
- [ ] Add `users`, `roles`, and optional `organizations` tables.
- [ ] Protect admin routes; keep public content routes open.
- [ ] Add rate limits and audit logs for privileged actions.
- [ ] Add CSRF protection if using cookies.

### 2.2 Intake operations

- [ ] Admin list/detail endpoints with filters by kind, status, urgency, date.
- [ ] Status transitions (`received` → `in-review` → `matched` → `closed` /
      `rejected`) with `updatedAt` writes and an audit trail.
- [ ] Internal notes separate from client-visible fields.
- [ ] Assignment to an advocate or intake counsel.
- [ ] Retention policy and deletion/anonymization job.
- [ ] Export for the conflicts desk.

### 2.3 Content management

- [ ] Admin CRUD for practices, advocates, matters, insights, FAQs,
      testimonials, and fees.
- [ ] Draft/publish workflow and slug uniqueness checks.
- [ ] Image upload or validated external URL fields.
- [ ] Preview support for the frontend.

### 2.4 Notifications

- [ ] Transactional email provider adapter.
- [ ] Outbox table with retries and idempotency keys.
- [ ] Intake acknowledgement and status-change emails.
- [ ] Newsletter double opt-in and unsubscribe endpoint.
- [ ] Optional WhatsApp notification provider.

**Exit criteria:** staff can process intake end-to-end without direct database
access, and every notification is retry-safe.

---

## Phase 3 — Production hardening

### 3.1 PostgreSQL

- [ ] Add PostgreSQL driver and convert schema.
- [ ] Regenerate migrations for PostgreSQL.
- [ ] Normalize JSON filters (languages, partner ids, practice links).
- [ ] Add connection pooling and health checks.
- [ ] Backfill or reseed production data.
- [ ] Document the migration runbook.

### 3.2 Deployment

- [ ] Container image or Node build pipeline for the API.
- [ ] Frontend deployment with environment-specific API URL.
- [ ] Managed secrets; no `.env` in images.
- [ ] TLS reverse proxy, request size limits, and access logs.
- [ ] Migration release step before process start.
- [ ] Backups and restore drill.
- [ ] Staging environment with seeded non-production data.

### 3.3 Observability and reliability

- [ ] Error tracking (for example Sentry) for both apps.
- [ ] Request latency and error-rate metrics.
- [ ] Structured audit logs for admin actions.
- [ ] Alerting on readiness failures and 5xx spikes.
- [ ] Graceful shutdown verified under load.
- [ ] Load test the public read endpoints.

### 3.4 Security and privacy

- [ ] Threat model for intake, admin, and notifications.
- [ ] PII inventory and retention schedule (India DPDP Act alignment).
- [ ] Data deletion and access-request procedures.
- [ ] Dependency and container scanning in CI.
- [ ] Penetration test before public launch.
- [ ] Privacy policy reviewed by counsel.

**Exit criteria:** the API runs on PostgreSQL behind TLS, has backups, alerts,
audit logs, and a documented incident/retention process.

---

## Phase 4 — Product expansion

### 4.1 Preliminary assessment

- [ ] Define the assessment input and output contract.
- [ ] Add an `assessments` table and status lifecycle.
- [ ] Integrate an LLM provider behind a server-side adapter.
- [ ] Add prompt/version tracking, safety filters, and human review.
- [ ] Return "information, not advice" with citations and next steps.
- [ ] Never persist sensitive free text longer than necessary.

### 4.2 Advocate matching

- [ ] Normalize practice, language, jurisdiction, court, and availability.
- [ ] Add matching rules and a ranked result contract.
- [ ] Add advocate opt-in, verification status, and conflict-aware exclusion.
- [ ] Add advocate-facing profile management.
- [ ] Track match acceptance and outcomes.

### 4.3 Court tracking

- [ ] Add `cases`, `hearings`, and `case_events`.
- [ ] Integrate a court-data source or manual clerk workflow.
- [ ] Add client-visible timelines and notifications.
- [ ] Handle PII and case sensitivity carefully.

### 4.4 Payments and fees

- [ ] Replace display-only fee strings with structured amounts/currency.
- [ ] Add a payment provider adapter and `orders` table.
- [ ] Reconcile consultation and package payments.
- [ ] Add invoices/receipts and refund handling.
- [ ] Keep fee copy and charged amounts consistent.

### 4.5 Multilingual delivery

- [ ] Add locale columns or translation tables for content.
- [ ] Add UI localization for the six supported languages.
- [ ] Add language-aware search and advocate filters.
- [ ] Review legal notices with translators.

---

## Immediate backend backlog

Ordered suggestions for the next backend iteration:

1. Add response schemas to routes so OpenAPI documents payloads, not just
   requests.
2. Add tests for practices detail 404, matter/insight categories, catalog
   ordering, and advocate pagination boundaries.
3. Add an `admin` auth boundary before any write endpoints.
4. Add intake status transitions and an audit table.
5. Add a `notifications` outbox and email adapter.
6. Add a retention/anonymization command for intake and newsletter data.
7. Add structured request logging that excludes bodies.
8. Add a `GET /api/v1/health` alias or document the current split clearly (health
   is outside `/api/v1` by design).
9. Add CI for typecheck, lint, test, and build.
10. Plan the PostgreSQL conversion before any multi-instance deployment.

---

## Known gaps

| Area | Gap |
| --- | --- |
| Auth | No users, roles, sessions, or API keys |
| Admin | No content or intake management API |
| AI | No assessment service; frontend interactions are simulated |
| Matching | No advocate ranking or availability model |
| Court tracking | Not implemented |
| Payments | Not implemented; fee text is display-only |
| Notifications | No email/WhatsApp delivery or outbox |
| Localization | Language list exists; no translated content |
| Testing | Backend integration tests only; no frontend/E2E suite |
| CI/CD | No pipeline in the repository |
| Production DB | SQLite only; PostgreSQL migration not started |
| Content | Legacy Chicago/Illinois copy and USD fees remain |

## Definition of done (general)

A feature is done when:

- The API contract and validation are documented.
- Tests cover success and failure paths.
- Errors use the standard envelope.
- PII handling and compliance copy are reviewed.
- The frontend has loading, empty, and error states.
- `docs/` is updated in the same change.
- Typecheck, lint, tests, and builds pass.
