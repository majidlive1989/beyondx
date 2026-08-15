# Phase 5C.1B Media compatibility typecheck fix

This fixes the current Admin typecheck error without requiring the local
`listMedia()` TypeScript signature to already include the Phase 5B `visibility` option.

The Site Settings page now:
- calls `listMedia({ kind: "IMAGE" })`, which is valid on both old and new Admin clients;
- checks `visibility` safely at runtime through a local compatibility helper;
- excludes assets explicitly returned as `PRIVATE`;
- remains compatible with the newer Phase 5B `MediaAsset.visibility` response.

Run:

```bash
pnpm --filter @beyondx/admin typecheck
pnpm typecheck
```
