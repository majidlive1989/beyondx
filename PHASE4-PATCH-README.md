# BeyondX Phase 4 Commerce + Hot Plugin Lifecycle Overlay Patch

Apply this ZIP over the current verified Phase 3 project root and replace matching files.

## What this patch adds

- Hot plugin enable/disable without API service restart.
- Dynamic plugin API route gating and dynamic OpenAPI filtering.
- Immediate Admin navigation refresh after plugin state changes.
- First-party Commerce plugin that depends on Catalog.
- Variant pricing in integer minor currency units.
- Warehouses, stock levels, reservation-aware availability and stock movement ledger.
- Secure guest carts using opaque cart tokens stored only as SHA-256 hashes.
- Idempotent checkout with serializable transactions and atomic stock reservation.
- Pending/confirmed/cancelled orders with item snapshots.
- Commerce Admin UI and OpenAPI request schemas.
- Phase 4 Prisma migration, tests and verifier.

## Install

```powershell
pnpm install --no-frozen-lockfile
pnpm db:generate
pnpm db:migrate
```

Do not reset the database. `pnpm db:seed` is not required for Commerce; plugin permissions are provisioned when the plugin is installed.

Then run:

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

For verification, temporarily move `.env` outside the project root and run `pnpm verify:phase4`, then restore `.env`.

Phase 4 remains verification-pending until the target machine passes all automated and manual checks in `PHASE4-VERIFICATION.md`.
