# BeyondX Phase 5C.4 — Theme SDK lint fix

Fixes `@typescript-eslint/restrict-template-expressions` in `packages/theme-sdk/src/client.ts`.

The public SDK contract still exposes `PublicFormName`, while the implementation parameter is widened to `string` only for the internal runtime guard. This prevents TypeScript from narrowing the impossible branch to `never` and keeps runtime validation for plain JavaScript callers.

Apply over the current 5C.4 tree and run:

```bash
pnpm --filter @beyondx/theme-sdk lint
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm verify:phase5
```
