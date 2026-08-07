# Changelog

## 0.3.0 — Phase 2 CMS and Content

- Added modular `@beyondx/module-content` CMS.
- Added ContentType, FieldDefinition, ContentEntry, ContentRevision and EntryRelation persistence.
- Added Draft / Published / Archived lifecycle and revision history.
- Added locale, slug and SEO metadata support.
- Added entry relations and scheduled publishing.
- Added protected CMS administration APIs and public published-content APIs.
- Added CMS RBAC permissions and idempotent seed updates.
- Added mobile-first Content and Content Types Admin pages.
- Converted the Admin shell to mobile-first off-canvas navigation.
- Added mobile card layouts for users, sessions and audit history.
- Added Phase 2 migration, tests and `verify:phase2`.


## 0.2.0 — Phase 1 Identity and Access Management

### Added

- Independent `@beyondx/module-identity` with domain, application, infrastructure and API layers.
- User, role, permission, session, audit, email-verification and password-reset Prisma models.
- Real Phase 1 PostgreSQL migration.
- Registration, login, refresh rotation, logout, logout-all and profile APIs.
- Email verification and password-reset workflows with SMTP delivery.
- bcrypt password hashing, signed access tokens and opaque refresh-token hashing.
- Session-family reuse detection and revocation.
- Login attempt tracking and temporary account lockout.
- RBAC permission guard and administration APIs for users, roles, sessions and audit logs.
- Idempotent `SUPER_ADMIN`, `ADMIN` and `USER` seed from environment configuration.
- Next.js Admin application with login, dashboard, profile, users, roles, sessions and audit pages.
- Bearer authentication in OpenAPI and Scalar.
- Phase 1 tests and `verify:phase1`.

### Changed

- API runtime now composes the Identity module after Foundation.
- API package, database package and repository version advanced to `0.2.0`.
- Docker Compose includes the Admin application and Phase 1 environment settings.
- Documentation and Windows installation instructions now cover Phase 1.

### Security

- Refresh tokens are never stored in plaintext.
- System roles cannot be modified or deleted.
- Administrators cannot disable themselves or change their own role assignments.
- Invalid and expired access tokens use the standard BeyondX error envelope.

## 0.1.1 - 2026-08-06

### Fixed

- Fixed the Fastify `onSend` hook so it always completes via its callback.
- Restored responses for `/health`, `/ready`, `/openapi.json`, `/docs`, and module-contributed routes.
- Prevented API integration tests from timing out while waiting for a response that was never finalized.

### Fixed

- Changed `GetPlatformInfoService` to a type-only import in the Foundation platform route so strict ESLint `consistent-type-imports` passes.
## 0.1.0-phase0-fix-v4 - 2026-08-06

- Fixed Scalar Fastify `routePrefix` typechecking with a validated absolute-route type guard.
- Preserved the previously verified configuration package and all other Phase 0 behavior.

## 0.1.0-phase0-fix-v3 - 2026-08-06

- Fixed typed event bus lint failures caused by unnecessary assertions and non-thenable values passed to `Promise.allSettled`.
- Made API documentation tests compatible with canonical `/docs` and `/docs/` routing.
- Removed avoidable type assertions from configuration and registry tests.
- Pinned direct dependency versions to prevent caret-based upgrades from changing Phase 0 behavior during installation.
- Removed invalid Turbo test output declarations when coverage is not generated.


All notable BeyondX changes are documented here.

## [0.1.0] - 2026-08-06

### Added

- Complete Phase 0 monorepo configuration for apps, packages, and future modules.
- Strict shared TypeScript, ESLint, Prettier, Husky, Turborepo, and Vitest configuration.
- Fastify API with versioned platform route, liveness, readiness, OpenAPI JSON, Scalar documentation, request IDs, structured errors, CORS, security headers, and rate limiting.
- Core service container, health registry, HTTP route registry, permission registry, generic extension points, module lifecycle contracts, runtime status, and application error types.
- Dependency-aware module registry with duplicate, missing dependency, and circular dependency validation.
- Executable `@beyondx/module-foundation` package that registers a service, API route, permission, health check, extension metadata, lifecycle events, and platform identity.
- Typed asynchronous event bus with unsubscribe support and aggregated handler failures.
- Environment validation package and complete `.env.example`.
- Prisma/PostgreSQL package with initial migration, platform metadata, module installation tracking, and idempotent seed.
- Redis and PostgreSQL readiness checks.
- Docker Compose services for PostgreSQL, Redis, Mailpit, and the API plus a non-root runtime image.
- Real unit, validation, permission, lifecycle, and API route tests.
- `verify:phase0` structural and workspace consistency validation.

### Fixed

- Corrected service-token formatting so object-backed tokens use their stable `key` instead of default object stringification.
- Reworked no-op asynchronous test and module callbacks to satisfy strict `require-await` linting without disabling rules.
- Preserved the concrete Pino logger generic across the Fastify application, route registry adapter, and global error handler.
- Switched the Redis client import to the constructable named `Redis` export for NodeNext TypeScript compatibility.
- Marked the root package as ESM so the flat ESLint configuration loads without the module-type warning.
- Hardened all remaining strict-lint boundaries for unknown errors, event rejection reasons, typed mocks, and HTTP response parsing.
- Repaired the Phase 0 verification lifecycle-method regular expression.
- Narrowed Fastify error-handler inputs before reading validation and HTTP status metadata, resolving strict `unknown` errors.
- Added development conditional exports for every internal package so `pnpm dev` loads TypeScript sources instead of requiring prebuilt `dist` files.

### Changed

- Expanded the original minimal `Kernel`, event utility, and module registry instead of replacing the project with a new codebase.
- Replaced the placeholder API test command with executable Vitest suites.

### Architecture notes

- Monitoring remains a future independent module with a separate panel. Phase 0 exposes only reusable health and module lifecycle foundations required by it.
## 0.2.1 - Phase 1 lint correction

- Changed Admin authentication context operations from method signatures to function-property signatures to satisfy `@typescript-eslint/unbound-method` without disabling the rule.
