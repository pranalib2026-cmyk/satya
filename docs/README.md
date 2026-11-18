# NyayaSetu documentation

This folder is the shared knowledge base for humans and AI agents. Start with
the path that matches your role.

## Recommended reading paths

### New developer

1. [`../README.md`](../README.md) — product summary and quick start.
2. [`DEVELOPMENT.md`](DEVELOPMENT.md) — setup, scripts, troubleshooting.
3. [`ARCHITECTURE.md`](ARCHITECTURE.md) — how the apps fit together.
4. [`API.md`](API.md) — endpoint contract.
5. [`DATABASE.md`](DATABASE.md) — schema and migrations.
6. [`FRONTEND.md`](FRONTEND.md) — pages, components, data layer.
7. [`CONTENT.md`](CONTENT.md) — copy rules and content debt.

### Backend contributor

1. [`../backend/README.md`](../backend/README.md)
2. [`../backend/AGENTS.md`](../backend/AGENTS.md)
3. [`API.md`](API.md)
4. [`DATABASE.md`](DATABASE.md)
5. [`adr/0001-backend-stack.md`](adr/0001-backend-stack.md)

### Frontend contributor

1. [`../frontend/README.md`](../frontend/README.md)
2. [`../frontend/AGENTS.md`](../frontend/AGENTS.md)
3. [`FRONTEND.md`](FRONTEND.md)
4. [`CONTENT.md`](CONTENT.md)
5. [`API.md`](API.md) — when wiring data

### AI agent

1. [`../AGENTS.md`](../AGENTS.md)
2. The stack-specific agent file (`backend/AGENTS.md` or
   `frontend/AGENTS.md`).
3. The document for the area you are changing.

## Document index

| Document | Purpose | Update when |
| --- | --- | --- |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | System context, layers, request lifecycle, deployment | Boundaries or integration patterns change |
| [`API.md`](API.md) | Endpoints, parameters, envelopes, errors, examples | A route, payload, or status code changes |
| [`DATABASE.md`](DATABASE.md) | Tables, relationships, migrations, seeding, Postgres path | Schema or migration workflow changes |
| [`DEVELOPMENT.md`](DEVELOPMENT.md) | Install, run, test, and troubleshoot both apps | Scripts, prerequisites, or ports change |
| [`FRONTEND.md`](FRONTEND.md) | Routes, components, data layer, API migration plan | Pages, data sources, or env vars change |
| [`CONTENT.md`](CONTENT.md) | Canonical facts, compliance copy, content debt | Copy or seed content changes |
| [`ROADMAP.md`](ROADMAP.md) | Phases, priorities, known gaps | Scope or sequencing changes |
| [`adr/0001-backend-stack.md`](adr/0001-backend-stack.md) | Backend stack decision record | Superseded by a later ADR |

## Documentation conventions

- Write for a teammate who has never seen the repo.
- Prefer concrete commands and file paths over abstractions.
- Keep examples runnable from the stated working directory.
- Record known debt explicitly instead of silently documenting the ideal state.
- Do not remove the legal disclaimers from product copy.
