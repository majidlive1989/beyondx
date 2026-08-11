# Phase 4 Verification — CMS Experience

Phase 4 remains **IN PROGRESS**. Do not tag it complete until all CMS Experience milestones and manual tests pass.

## Required quality gates

```powershell
pnpm install --no-frozen-lockfile
pnpm db:generate
pnpm db:migrate
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

For structural verification, temporarily move `.env` outside the project root, then run:

```powershell
pnpm verify:phase4
```

Expected final line for this milestone:

```text
Phase 4 CMS Experience + Discussion Plugin structure verified successfully.
```

## Manual Discussion test

1. Settings → Plugins → install and enable **Comments & Reviews**.
2. Do not restart the API; confirm `Comments & reviews` appears under Content immediately.
3. Open a published content entry. The **Discussion** section should appear and allow comments to be enabled/disabled.
4. Submit a public comment through Scalar (`POST /api/v1/discussions`). It must enter `PENDING`.
5. Open Comments & reviews and approve it. The public thread endpoint must then return it.
6. Mark it Spam, return it to Pending, approve it, reply to it, Trash it, then permanently delete it.
7. For an active product, submit a `REVIEW` with rating 1–5. The moderation inbox must show the product source and rating.
8. Disable the plugin without an API restart. Its menu and APIs must become inactive while data remains in the database.
9. Re-enable it and confirm the moderation data returns.
