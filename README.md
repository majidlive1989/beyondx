# BeyondX

**BeyondX — Build Any Digital Product**

BeyondX is a modular, API-first TypeScript platform for composing CMS, commerce, SaaS, booking, marketplace, education and custom digital products from independent modules.

This repository is the Phase 1 evolution of the approved Phase 0 foundation. It preserves the kernel, module system, typed events, health checks, PostgreSQL/Prisma, Redis, OpenAPI and Scalar documentation, then adds a complete Identity and Access Management module plus a Next.js administration application.

## Phase 1 capabilities

- User registration and authenticated profile management
- Email verification and password-reset flows
- Password hashing with configurable bcrypt cost
- Short-lived signed access tokens
- Opaque refresh tokens stored only as hashes
- Refresh-token rotation and session-family reuse detection
- Logout, logout-all and per-session revocation
- Login lockout after repeated failed attempts
- Role-based access control with users, roles and permissions
- Administrative user, role, permission, session and audit APIs
- Idempotent `SUPER_ADMIN`, `ADMIN` and `USER` seed
- Next.js Admin pages for login, dashboard, profile, users, roles, sessions and audit history
- OpenAPI Bearer authentication scheme and Scalar API reference
- Real Prisma migration and repository integration test support

## Repository structure

```text
beyondx/
├── apps/
│   ├── api/                  # Fastify API
│   └── admin/                # Next.js administration application
├── modules/
│   ├── foundation/           # Phase 0 platform module
│   └── identity/             # Phase 1 IAM module
├── packages/
│   ├── core/
│   ├── database/
│   ├── events/
│   ├── module-system/
│   ├── config/
│   ├── logger/
│   ├── validation/
│   └── testing/
├── scripts/
├── docker/
├── docker-compose.yml
└── Dockerfile
```

## Requirements

- Node.js 22+
- pnpm 10+
- Docker Desktop or Docker Engine with Compose

## First-time setup

```bash
cp .env.example .env
pnpm install --no-frozen-lockfile
docker compose up -d postgres redis mailpit
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm verify:phase1
pnpm dev
```

Generate separate secrets for `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Do not reuse the same value and do not commit `.env`.

## Development URLs

| Surface | URL |
| --- | --- |
| Admin | `http://127.0.0.1:3000/login` |
| API liveness | `http://127.0.0.1:4000/health` |
| API readiness | `http://127.0.0.1:4000/ready` |
| OpenAPI | `http://127.0.0.1:4000/openapi.json` |
| Scalar API reference | `http://127.0.0.1:4000/docs` |
| Foundation route | `http://127.0.0.1:4000/api/v1/platform` |
| Mailpit | `http://127.0.0.1:8025` |

The seeded administrator credentials come from `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env`.

## Running applications separately

Infrastructure:

```bash
docker compose up -d postgres redis mailpit
```

API:

```bash
pnpm exec dotenv -e .env -- pnpm --filter @beyondx/api dev
```

Admin:

```bash
pnpm exec dotenv -e .env -- pnpm --filter @beyondx/admin dev
```

All development tasks:

```bash
pnpm dev
```

## Identity API

Public endpoints:

```text
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/email/verification/request
POST /api/v1/auth/email/verify
POST /api/v1/auth/password/forgot
POST /api/v1/auth/password/reset
```

Authenticated endpoints:

```text
GET    /api/v1/auth/me
PATCH  /api/v1/auth/me
POST   /api/v1/auth/logout
POST   /api/v1/auth/logout-all
GET    /api/v1/auth/sessions
DELETE /api/v1/auth/sessions/:id
```

Administrative endpoints are available under `/api/v1/admin` for users, roles, permissions, sessions and audit logs. Open Scalar for the complete schemas and permission requirements.

## Authentication behavior

The login and registration responses return an access token and set the refresh token as an `HttpOnly` cookie. API clients may alternatively submit the refresh token in the refresh request body. Protected endpoints require:

```http
Authorization: Bearer <access-token>
```

Refresh rotation revokes the previous session. Reuse of an already rotated token revokes the entire session family.

## Database workflows

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:migrate:deploy
pnpm db:seed
pnpm db:studio
```

Every schema change must have a checked-in migration. `db:push` is not the standard Phase delivery workflow.

Run the repository integration test against a prepared test database:

```bash
RUN_DATABASE_TESTS=true pnpm --filter @beyondx/module-identity test
```

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm verify:phase1
```

`verify:phase1` first runs the Phase 0 structural verifier and then checks all Phase 1 artifacts, models, migration, routes, seed requirements and ZIP exclusions.

## Production notes

- Replace all example credentials and secrets.
- Set `REFRESH_COOKIE_SECURE=true` behind HTTPS.
- Restrict CORS to known application origins.
- Run `pnpm db:migrate:deploy`, not development migration commands.
- Keep the API and Admin behind a trusted TLS reverse proxy.
- Review retention requirements for sessions, audit logs and one-time tokens.
