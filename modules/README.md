# BeyondX modules

Business capabilities live in independent workspace packages under this directory. Modules depend on platform contracts, register their own routes, services, permissions, health checks and event handlers, and communicate through public exports or events rather than private implementation imports.

## Current modules

- `@beyondx/module-foundation` — platform identity and status contribution from Phase 0.
- `@beyondx/module-identity` — authentication, users, RBAC, sessions, recovery and audit from Phase 1.

Every module contains a package manifest, `module.json`, TypeScript configuration, layered source code and real tests.

## CMS groundwork for Phase 6

`@beyondx/module-content` is retained from earlier development as isolated Phase 6 groundwork. It is not part of the Phase 2 Media dependency chain.

## Phase 2 Media Module

`@beyondx/module-media` owns media metadata, secure upload validation, storage adapters and image inspection. The existing `@beyondx/module-content` package is retained as Phase 6 groundwork and is not a dependency of Media.

## Phase 3 Catalog Module

`@beyondx/module-catalog` owns products, variants, globally unique SKUs, brands, category hierarchy, attributes/values and product-to-media relationships. It depends on the Media Module for reusable image assets but deliberately excludes inventory, cart, checkout and orders, which belong to Phase 4 Commerce.
