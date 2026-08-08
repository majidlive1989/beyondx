# Phase 3 Verification — Plugin Runtime + Platform Builder + Catalog Plugin

Phase 3 is complete only after automated quality gates and the plugin lifecycle scenario pass on the target machine.

## Automated gates

Run:

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Then temporarily move `.env` out of the repository and run:

```powershell
Move-Item .env ..\BeyondX.env.backup
pnpm verify:phase3
Move-Item ..\BeyondX.env.backup .env
```

Expected final verifier line:

```text
Phase 3 Plugin Runtime + Platform Builder + Catalog Plugin structure verified successfully.
```

## Upgrade/install preparation

After extracting the patch:

```powershell
pnpm install --no-frozen-lockfile
pnpm db:migrate
pnpm db:seed
```

Then restart API/Admin and sign in again so the access token receives the latest Plugin Manager permissions.

## Manual plugin lifecycle test

For an existing Phase 3 database, Catalog is migrated to an installed/enabled plugin so current products remain available.

1. Open `Settings -> Plugins` and verify **Catalog / Active**.
2. Confirm `Catalog -> Products` and `Catalog setup` are visible.
3. Disable Catalog. The UI must display **Restart required**.
4. Restart the BeyondX API and refresh/sign in again.
5. Confirm the Catalog menu disappears.
6. Request `/api/v1/admin/catalog/products` after restart; it must be a route-not-found response because the Catalog plugin was not loaded.
7. Return to `Settings -> Plugins`. Catalog must show Installed/Disabled.
8. Enable Catalog, restart the API and sign in again.
9. Confirm Catalog navigation and Catalog APIs return.
10. Confirm existing brands/categories/products/variants are still present.
11. Disable Catalog again, restart, then Uninstall. Catalog must become Available while product data remains preserved in storage.
12. Install -> Enable -> Restart -> sign in again. Catalog must return with the preserved data.

## Fresh-install behavior

On a fresh database the seed must not create `@beyondx/plugin-catalog`. Therefore the initial Admin has no Product/Catalog navigation. Catalog appears only after Plugin Manager installation and activation.

## Builder regression

Also confirm the Phase 3 Schema Engine remains functional:

- create a Collection in Structure Builder;
- see it appear under Content;
- create/edit/delete records;
- verify required-field validation;
- verify component/dynamic-zone data survives refresh;
- when Catalog is active, `catalog.product` custom fields continue to appear in the normal Product form.
