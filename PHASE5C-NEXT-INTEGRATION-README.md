# BeyondX Phase 5C — Next.js Theme Integration

Phase 5C turns the Phase 5A/5B delivery contract into a runnable reference frontend. It adds a standalone Next.js App Router storefront that consumes BeyondX only through `@beyondx/theme-sdk` and public delivery APIs.

## Delivered

- New workspace app: `apps/storefront` on port `3001`.
- Next.js 15 App Router reference integration using `@beyondx/theme-sdk`.
- Server-rendered home page with live Theme capability discovery.
- Product listing with server-side search, brand/category filters and pagination.
- Product detail route with public media, variants, custom fields and optional discussions.
- Generic CMS routes for any public content type: `/content/:apiId` and `/content/:apiId/:slug`.
- Dynamic metadata for product and CMS detail pages.
- Stable public media URLs from the Theme SDK; no storage keys leak into the frontend.
- 60-second Next fetch revalidation baseline for public delivery reads.
- Responsive loading, error and not-found states.
- Capability-aware behavior: optional Catalog/Discussion integrations are discovered rather than assumed.
- Storefront-specific structural verifier coverage in `verify:phase5`.

## Local environment

The default local topology is:

- Admin: `http://localhost:3000`
- Storefront: `http://localhost:3001`
- API: `http://127.0.0.1:4000`

Environment values:

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:4000
NEXT_PUBLIC_STOREFRONT_URL=http://localhost:3001
CORS_ORIGIN=http://localhost:3000,http://localhost:3001
```

## Run

From repository root:

```bash
pnpm install
pnpm dev
```

Or run only the reference storefront:

```bash
pnpm --filter @beyondx/storefront dev
```

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm verify:phase5
```

## Manual smoke test

1. Run API, Admin and Storefront.
2. Open `http://localhost:3001` and confirm the Theme capability card loads.
3. With Catalog enabled, confirm active products render on the home page and `/products`.
4. Mark a product image PUBLIC in Media Library and confirm it renders in the storefront.
5. Mark that same image PRIVATE and confirm the next revalidated storefront response no longer exposes it.
6. Open a product detail route and confirm variants/custom fields render from the SDK response.
7. Open `/content/<apiId>` for a public CMS type and then an entry detail route.
8. View page source/metadata and confirm product/CMS title and description are server generated.
9. Stop the API and confirm the Storefront error boundary provides a recoverable error state.

## Architectural rule

`apps/storefront` must not import Prisma, database repositories, Media storage adapters, Catalog repositories or CMS internals. Its BeyondX integration boundary is `@beyondx/theme-sdk` plus standard Next.js primitives.
