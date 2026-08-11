# BeyondX Phase 5B — Public Media Delivery

This overlay extends the verified Phase 5A Theme Delivery Bridge.

## Goals

- Public/private media delivery without exposing storage paths.
- PRIVATE by default for old and new assets.
- Stable public metadata endpoint: `GET /api/v1/media/:id`.
- Stable public content endpoint: `GET /api/v1/media/:id/content`.
- Admin visibility endpoint: `PATCH /api/v1/admin/media/:id/visibility`.
- Theme manifest reports `publicMedia: true`.
- `@beyondx/theme-sdk` exposes `media.get()`, `media.url()` and `media.metadataUrl()`.
- Public delivery includes `ETag`, `Cache-Control`, `X-Content-Type-Options: nosniff`, and a cross-origin resource policy suitable for a separately hosted Theme.

## Security model

Media is PRIVATE unless explicitly marked PUBLIC. Existing assets that do not contain the internal BeyondX visibility marker are treated as PRIVATE. Public endpoints return 404 for PRIVATE assets so they do not disclose private asset existence.

The visibility marker is stored inside reserved media metadata (`__beyondx`) so Phase 5B does not require a Prisma schema migration or overwrite the current database schema. User-facing metadata serialization removes this internal key.

## Install

Extract this ZIP over the current BeyondX project checkpoint.

No database reset or migration is needed.

Run:

```powershell
pnpm --filter @beyondx/module-media lint
pnpm --filter @beyondx/module-media typecheck
pnpm --filter @beyondx/module-media test

pnpm --filter @beyondx/module-theme lint
pnpm --filter @beyondx/module-theme typecheck
pnpm --filter @beyondx/module-theme test

pnpm --filter @beyondx/theme-sdk lint
pnpm --filter @beyondx/theme-sdk typecheck
pnpm --filter @beyondx/theme-sdk test
```

Then run the repository gates:

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Manual smoke test

1. Start the API with `pnpm dev`.
2. Open `/api/v1/theme/manifest` and confirm `capabilities.publicMedia` is `true`.
3. Pick an existing media ID from Admin Media.
4. With an authenticated Admin request, call:

```http
PATCH /api/v1/admin/media/<MEDIA_ID>/visibility
Content-Type: application/json

{ "visibility": "PUBLIC" }
```

5. Open `http://127.0.0.1:4000/api/v1/media/<MEDIA_ID>`.
6. Open `http://127.0.0.1:4000/api/v1/media/<MEDIA_ID>/content`.
7. Change visibility back to PRIVATE and confirm both public routes return 404.

## Theme SDK

```ts
const media = await beyondx.media.get(mediaId);
const imageUrl = beyondx.media.url(media);
```

For Catalog media returned by a product, its `id` is enough:

```ts
const product = await beyondx.catalog.getProduct("example-product");
const imageUrl = beyondx.media.url(product.media[0]);
```

The URL is storage-agnostic. A future S3 adapter can change storage implementation without changing Theme code.
