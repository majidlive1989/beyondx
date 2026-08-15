# BeyondX Phase 5C.6 — Headless Boundary + External Reference Theme

Phase 5C.6 closes Phase 5 by making the frontend boundary explicit.

## Core change

The old `apps/storefront` reference application is removed from the BeyondX repository. BeyondX Core now contains only the API/Admin platform plus reusable packages/modules/plugins.

The frontend integration contract is HTTP-first. `@beyondx/theme-sdk` stays in Core as an optional typed convenience client.

## Why

A BeyondX installation must be able to serve multiple unrelated frontends without changing the backend:

```text
BeyondX API
├── Next.js website
├── Nuxt/Vue website
├── PHP/Laravel website
├── mobile application
└── future commerce storefront
```

Backend owns data. Frontend owns presentation.

## Repository cleanup

Removed:

- `apps/storefront/`
- `PHASE5C-NEXT-INTEGRATION-README.md`
- `PHASE5C-FIX1-README.md`
- `NEXT_PUBLIC_STOREFRONT_URL` from root environment/turbo config
- bundled-storefront lockfile importer (removed by the following `pnpm install`)

Kept:

- public REST endpoints
- Theme Delivery Manifest
- `@beyondx/theme-sdk`
- Site Settings
- Pages + Blog
- Navigation
- Public Media Delivery
- Contact Form
- SEO delivery

## Apply from overlay ZIP on Windows

Extract the Phase 5C.6 Core ZIP over the repository root, then run:

```bash
pnpm phase5c6:cleanup
pnpm install
```

The cross-platform cleanup script is idempotent. It deletes the old bundled storefront and obsolete storefront-only docs if they still exist.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm verify:phase5
```

`verify:phase5` now also runs `verify:headless`, which rejects a bundled `apps/storefront` and rejects reintroduction of the removed storefront environment variable.

No Prisma migration and no database seed are required for this checkpoint.

## External reference theme

The separate `BeyondX-Corporate-Starter` package is **not** part of this repository. It is a standalone Next.js application using only the public BeyondX REST API.

It demonstrates:

- Site Settings -> logo/site identity/footer/contact details
- Navigation -> dynamic Header/Footer links
- Pages -> generic dynamic page route
- Blog -> archive + single post
- Media -> public MediaAsset URLs
- Contact -> public form submission into Admin Inbox
- SEO -> metadata/canonical/Open Graph
- SEO delivery -> `robots.txt` + `sitemap.xml`

The starter exists to prove the public contract, not to make Next.js a BeyondX requirement.
