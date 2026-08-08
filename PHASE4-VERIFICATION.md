# Phase 4 Verification

Phase 4 is complete only when all automated and manual gates pass on the target machine.

## Automated

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `pnpm verify:phase4` with `.env` temporarily outside the repository root

## Manual hot-plugin lifecycle

1. Keep API and Admin running.
2. Disable Catalog while Commerce is disabled: Catalog navigation disappears immediately and Catalog API returns 404, without restarting API.
3. Enable Catalog: navigation and API return immediately.
4. Install + enable Commerce: Commerce navigation appears immediately.
5. Attempt to disable Catalog while Commerce is active: operation is rejected because Commerce depends on Catalog.
6. Disable Commerce: Commerce navigation disappears immediately and Commerce API returns 404; data remains.
7. Enable Commerce again: navigation/routes return without restart.

## Manual commerce workflow

1. Create an active Catalog product and active variant.
2. In Commerce, create a warehouse.
3. Set a price in integer minor units (for example USD `1299` = $12.99).
4. Add stock to the variant and confirm available quantity.
5. `POST /api/v1/commerce/carts`, store returned `cartToken` securely for the test.
6. Add an item using `x-cart-token`.
7. Checkout with warehouse + a unique idempotency key.
8. Confirm available stock decreases by the reserved quantity while on-hand is unchanged.
9. Submit the same idempotency key again and confirm the same order is returned rather than duplicated.
10. Confirm the order: reserved stock and on-hand both decrease and a SALE movement is recorded.
11. Alternative path: create another order then cancel it; reserved stock is released and on-hand is unchanged.
12. Restart API/Admin and confirm prices, warehouses, stock, orders and plugin state persist.
