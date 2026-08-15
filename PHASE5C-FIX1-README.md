# Phase 5C Fix 1 — Next.js ESM TypeScript workspace resolution

Fixes Next.js/Webpack development resolution for `@beyondx/theme-sdk` source exports such as `./client.js` and `./types.js` when the workspace package is transpiled directly from TypeScript source.

## Apply
Extract this overlay at the BeyondX repository root and overwrite the existing file.

## Verify
```bash
pnpm --filter @beyondx/storefront typecheck
pnpm --filter @beyondx/storefront build
pnpm dev
```

Then open `http://localhost:3001`.
