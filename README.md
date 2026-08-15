# BeyondX — Headless Platform Core

BeyondX is a modular, API-first backend and Admin platform. The core repository deliberately does **not** bundle a website or storefront.

## Architecture boundary

```text
BeyondX Admin -> BeyondX API -> Public REST contract -> Any frontend
```

BeyondX owns data, validation, permissions, publishing and delivery contracts. Frontends own layout, components, styling, rendering and framework-specific behavior.

A frontend may use Next.js, Nuxt/Vue, React, PHP/Laravel, mobile clients or any other stack that can call HTTP APIs. `@beyondx/theme-sdk` is an optional typed JavaScript convenience layer; the public REST API remains the canonical integration boundary.

## Core applications

- `apps/api` — BeyondX API
- `apps/admin` — BeyondX Admin
- `modules/*` — feature modules
- `plugins/*` — optional runtime plugins
- `packages/theme-sdk` — optional typed client for JavaScript/TypeScript frontends

There is intentionally no `apps/storefront` in this repository.

## Public website contract

The corporate delivery contract currently includes:

- `GET /api/v1/theme/manifest`
- `GET /api/v1/site/settings`
- `GET /api/v1/navigation`
- `GET /api/v1/pages`
- `GET /api/v1/pages/:slug`
- `GET /api/v1/blog/posts`
- `GET /api/v1/blog/posts/:slug`
- `GET /api/v1/blog/categories`
- `GET /api/v1/blog/tags`
- `GET /api/v1/media/:id`
- `GET /api/v1/media/:id/content`
- `POST /api/v1/forms/contact`
- `GET /api/v1/seo/config`
- `GET /api/v1/seo/sitemap`

See `docs/FRONTEND-INTEGRATION-CONTRACT.md` for the framework-independent contract and `PHASE5C6-HEADLESS-INTEGRATION-README.md` for this checkpoint.

## Verification

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm verify:phase5
```

`pnpm verify:phase5` includes a headless-boundary check that fails if a bundled `apps/storefront` is reintroduced.
