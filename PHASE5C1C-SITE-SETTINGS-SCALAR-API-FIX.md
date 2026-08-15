# BeyondX Phase 5C.1C — Site Settings Scalar/API Fix

This patch fixes the Site Settings API documentation mismatch.

Before this patch, `beyondx.site.getSettings()` used the generic Dynamic Data route:

`GET /api/v1/data/:schemaKey`

with `schemaKey=site-settings`.

That means the request could resolve at runtime, but Scalar/OpenAPI would only show the
generic parameterized route, not a dedicated Site Settings endpoint.

## Added

A real public Fastify route:

`GET /api/v1/site/settings`

It is registered explicitly, so it appears in Scalar/OpenAPI.

Response:

```json
{
  "settings": {
    "id": "settings-1",
    "schemaId": "...",
    "schemaKey": "site-settings",
    "status": "ACTIVE",
    "values": {},
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

When there is no ACTIVE Site Settings record, `settings` is `null`.

The Theme manifest and `@beyondx/theme-sdk` now use this explicit route.

## Apply

Extract over the BeyondX project after 5C.1/5C.1B, then run:

```bash
pnpm --filter @beyondx/module-schema typecheck
pnpm --filter @beyondx/theme-sdk typecheck
pnpm typecheck
pnpm test
pnpm build
pnpm verify:phase5
```

Restart the API after applying, then open Scalar and look for:

`GET /api/v1/site/settings`

No database migration or seed change is required by this fix.
