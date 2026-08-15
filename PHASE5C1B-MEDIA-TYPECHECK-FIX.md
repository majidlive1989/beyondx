# Phase 5C.1B Media Typecheck Fix

Fixes the Admin Site Settings typecheck failure:

`Property 'visibility' does not exist on type 'MediaAsset'.`

The page now asks `listMedia()` for `kind=IMAGE&visibility=PUBLIC` and no longer reads
`asset.visibility` directly. This keeps the Site Settings image pickers restricted to
public images while staying compatible with the current Admin `MediaAsset` typing.

Run:

```bash
pnpm --filter @beyondx/admin typecheck
pnpm typecheck
```
