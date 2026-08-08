# BeyondX Phase 4 — Commerce Plugin + Hot Plugin Lifecycle

This cumulative overlay applies over the verified Phase 3 project.

## Phase 4 goals

- Hot plugin enable/disable without restarting the API service.
- Commerce remains a first-party plugin, not a CMS core feature.
- Commerce depends on the Catalog plugin.
- Pricing, warehouses, stock levels, stock movements, carts, checkout and orders.
- Integer minor-unit money values to avoid floating-point currency errors.
- Guest cart tokens stored only as hashes.
- Idempotent checkout and atomic stock reservation.
- Admin UI, OpenAPI, tests and `verify:phase4`.

## Install

```powershell
pnpm install --no-frozen-lockfile
pnpm db:generate
pnpm db:migrate
```

Do not reset the database.

## Quality gate

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Then temporarily move `.env` outside the project root and run:

```powershell
pnpm verify:phase4
```

See `PHASE4-VERIFICATION.md` for the manual hot-plugin and commerce workflow checks.
