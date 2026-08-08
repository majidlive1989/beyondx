# BeyondX Phase 4 — Commerce Plugin

Phase 4 keeps BeyondX CMS core small and installs commerce as a first-party plugin.

## Architecture

- `@beyondx/plugin-commerce` depends on the Catalog plugin.
- Plugin enable/disable is hot: API restart is not required.
- Disabled plugin routes immediately return `404 PLUGIN_ROUTE_INACTIVE` and navigation disappears.
- Plugin data is preserved while disabled or uninstalled.
- Pricing uses integer minor currency units to avoid floating-point money errors.
- Inventory tracks on-hand, reserved and available stock per warehouse and variant.
- Checkout uses serializable transactions, idempotency keys and atomic stock reservation.
- Orders snapshot SKU, title, quantity and unit amount.
- `commerce.order` and `commerce.cart` are exposed as Schema Engine system extensions.

## Install on the current BeyondX project

```powershell
pnpm install --no-frozen-lockfile
pnpm db:generate
pnpm db:migrate
```

Do not reset the database.

After the API/Admin are running, open `Settings → Plugins`, install and enable **Commerce**. Catalog must already be installed and active.

## Quality gate

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Then move `.env` outside the project root before running:

```powershell
pnpm verify:phase4
```
