# BeyondX Phase 3 — Plugin Runtime + Catalog Plugin Overlay

Apply this overlay to the current Phase 3 project root. It converts Catalog from a hard-coded runtime module into the first installable BeyondX plugin.

## What changes

- Adds a generic Plugin Registry and Plugin Runtime to `@beyondx/module-system`.
- Adds the always-on Plugin Manager core module.
- Adds `plugins/catalog` as the first-party Catalog plugin manifest/factory.
- API loads Catalog only when its plugin installation is enabled at startup.
- Admin navigation is contributed by active plugins; Catalog links are no longer hard-coded.
- Adds `Settings -> Plugins` with Install / Enable / Disable / Uninstall.
- Disable preserves plugin data.
- Uninstall preserves Catalog data but removes plugin permission definitions.
- Existing Phase 3 databases are migrated from `@beyondx/module-catalog` to `@beyondx/plugin-catalog`, preserving the current enabled state.
- Fresh databases do not seed Catalog as installed.

## Apply on Windows

Extract into the BeyondX project root and Replace existing files, then run:

```powershell
pnpm install --no-frozen-lockfile
pnpm db:migrate
pnpm db:seed
```

`db:generate` is not required because this patch does not change the Prisma model schema.

Restart API/Admin and sign in again. The new access token must include `plugins.read` / `plugins.manage`.

Then run:

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

For the structural verifier:

```powershell
Move-Item .env ..\BeyondX.env.backup
pnpm verify:phase3
Move-Item ..\BeyondX.env.backup .env
```

Expected final line:

```text
Phase 3 Plugin Runtime + Platform Builder + Catalog Plugin structure verified successfully.
```

## Important runtime behavior

Plugin activation/deactivation is restart-safe in Phase 3 v1. Changing Enabled state shows `Restart required`. Restart the API and sign in again to apply route/menu changes.
