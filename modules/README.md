# BeyondX modules

Business capabilities live in independent workspace packages under this directory. Modules depend on platform contracts, register their own routes, services, permissions, health checks and event handlers, and communicate through public exports or events rather than private implementation imports.

## Current modules

- `@beyondx/module-foundation` — platform identity and status contribution from Phase 0.
- `@beyondx/module-identity` — authentication, users, RBAC, sessions, recovery and audit from Phase 1.

Every module contains a package manifest, `module.json`, TypeScript configuration, layered source code and real tests.
