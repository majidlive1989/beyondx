# BeyondX Phase 2 Verification — Media Module

Status: **Verification Pending on target workstation**

Phase 2 follows `BeyondX-Roadmap-Checklist.xlsx`:

- Media Library
- Upload
- Storage Adapter
- Image Management

## Implemented

### Database & migration
- `MediaAsset` persistence with file identity, MIME, size, SHA-256 checksum, dimensions, alt text, title, metadata and uploader.
- `MediaKind` (`IMAGE`, `FILE`).
- Phase 2 migration: `20260807000200_phase2_media`.

### Storage
- `StorageAdapter` contract.
- `LocalStorageAdapter` implementation.
- Local storage root is configurable.
- Docker named volume persists media independently of the application container.

### Upload validation
- Multipart upload through `@fastify/multipart`.
- File size limits at Fastify and service layers.
- Content signature detection for PNG, JPEG, GIF, WebP and PDF.
- Browser-declared MIME is compared with detected MIME.
- SHA-256 checksum generated for every asset.
- PNG/JPEG/GIF/WebP dimensions are extracted without a heavyweight image-processing runtime.

### API
- `GET /api/v1/admin/media`
- `POST /api/v1/admin/media`
- `GET /api/v1/admin/media/:id`
- `PATCH /api/v1/admin/media/:id`
- `GET /api/v1/admin/media/:id/content`
- `DELETE /api/v1/admin/media/:id`
- Scalar/OpenAPI Media tag and multipart upload schema.

### RBAC
- `media.assets.read`
- `media.assets.upload`
- `media.assets.update`
- `media.assets.delete`

`SUPER_ADMIN` and `ADMIN` receive the Media permissions through the idempotent seed.

### Admin UI
- `/media`
- Mobile-first media cards.
- Upload form.
- Search and image/file filter.
- Selected-image preview loaded only on demand.
- Image title and alt-text editing.
- Delete action.
- Existing Users, Sessions and Audit views also have mobile card views.

### Tests added
- File signature and image dimension inspection.
- Media upload and persistence behavior.
- MIME spoof rejection.
- Image-only alt text rule.
- Media module registration, permissions and health.

## Required final verification on Windows

```powershell
pnpm install --no-frozen-lockfile
pnpm db:generate
pnpm db:migrate
pnpm db:seed

pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Then temporarily move `.env` out of the project:

```powershell
Move-Item .env ..\BeyondX.env.backup
pnpm verify:phase2
Move-Item ..\BeyondX.env.backup .env
```

Expected final verifier output:

```text
Phase 2 Media Module structure verified successfully.
```

## Manual acceptance scenario

1. Start the platform with `pnpm dev`.
2. Log into `http://127.0.0.1:3000`.
3. Open `/media`.
4. Upload a PNG/JPEG/WebP/GIF or PDF.
5. Confirm the asset remains after refreshing the browser.
6. For an image, confirm detected dimensions are visible.
7. Change title/alt text and refresh; confirm persistence.
8. Preview the selected image.
9. Delete the asset and refresh; confirm it no longer appears.
10. Confirm `/docs` contains the Media routes and multipart upload endpoint.

The package must not be renamed `Complete` until all commands and the manual scenario pass on the target workstation.

## Transition note from the earlier CMS-labelled Phase 2 build

An earlier development build used the superseded PDF roadmap and could have applied the migration `20260807000100_phase2_content`. The canonical Excel roadmap now defines Phase 2 as Media. This clean package intentionally contains no CMS module or CMS migration.

Do **not** point Prisma migrate-dev at a database that already records `20260807000100_phase2_content` while testing this clean package. Preserve that database and create a fresh development database (recommended), or reset it only if its data is disposable. This avoids silently deleting content created during the superseded build.

## Compatibility note

The pre-existing `@beyondx/module-content` CMS groundwork is intentionally retained. Phase 2 verification evaluates the Media Module only; Media has no dependency on Content.
