# Phase 5A — Theme Delivery Bridge + SDK

This checkpoint starts Phase 5 without closing Phase 4. It provides the first stable contract for connecting a frontend theme to BeyondX.

## Added

- `@beyondx/module-theme`
  - public `GET /api/v1/theme/manifest`
  - runtime capability discovery for Catalog, Discussion and Commerce plugins
  - no database migration
- `@beyondx/theme-sdk`
  - browser/SSR safe fetch client
  - published CMS content
  - public dynamic collections
  - Catalog products, brands and categories when Catalog is active
  - public comments/reviews when Discussion is active
  - normalized BeyondX API errors
- `verify:phase5`

## Theme connection

Add the theme origin to `CORS_ORIGIN` in the local `.env`, for example:

```env
CORS_ORIGIN=http://localhost:3000,http://localhost:3001,http://localhost:5173
```

Then a theme can use:

```ts
import { createBeyondXThemeClient } from "@beyondx/theme-sdk";

const beyondx = createBeyondXThemeClient({ baseUrl: "http://127.0.0.1:4000" });
const manifest = await beyondx.manifest();
const articles = await beyondx.content.list("article", { locale: "fa" });

if (manifest.capabilities.catalog) {
  const products = await beyondx.catalog.listProducts({ pageSize: 12 });
  console.log(products.items);
}
```

## Important current limitation

Public binary Media delivery is intentionally **not** enabled in 5A yet. The manifest reports `publicMedia: false`. This avoids accidentally exposing private uploads. Public/private media delivery will be the next Theme SDK milestone before Phase 5 is considered complete.

## Gates

```powershell
pnpm install --no-frozen-lockfile
pnpm --filter @beyondx/module-theme lint
pnpm --filter @beyondx/module-theme typecheck
pnpm --filter @beyondx/module-theme test
pnpm --filter @beyondx/theme-sdk lint
pnpm --filter @beyondx/theme-sdk typecheck
pnpm --filter @beyondx/theme-sdk test
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Do not tag Phase 5 complete at this checkpoint.
