# BeyondX Phase 2 Media Overlay Patch

Apply this patch to the CURRENT BeyondX workspace that already contains Phase 0 + Phase 1 + the early CMS groundwork.

This patch intentionally preserves `modules/content`, CMS database models, CMS Admin pages and the existing content migration. It adds the Phase 2 Media Module beside them.

After extraction at the repository root, run:

```powershell
pnpm install --no-frozen-lockfile
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Then temporarily move `.env` outside the repo and run `pnpm verify:phase2`, restoring `.env` afterward.

Do not delete or reset the existing database. The new migration is `20260807000200_phase2_media` and is designed to run after the retained CMS groundwork migration.
