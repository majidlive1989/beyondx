# BeyondX Phase 4 — CMS Discussion Plugin Overlay

Milestone 4.2 adds a first-party optional **Comments & Reviews** plugin to the current CMS Experience checkpoint.

## What it adds

- One shared Discussion Engine for content comments and product reviews.
- Moderation states: Pending, Approved, Spam and Trash.
- Public replies and admin/team replies.
- Optional 1–5 star product ratings.
- Per-content/product discussion settings.
- Admin moderation inbox at `/comments`.
- Discussion settings inside the normal content editor when the plugin is active.
- Plugin navigation appears/disappears through the existing hot Plugin Runtime without API restart.
- Product discussion endpoints are unavailable while Catalog is disabled.
- Discussion data is preserved when the plugin is disabled/uninstalled.

## Apply on Windows

Extract this ZIP over the current BeyondX project root and replace matching files. Do not reset the database.

Run:

```powershell
pnpm install --no-frozen-lockfile
pnpm db:generate
pnpm db:migrate
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Then start development:

```powershell
pnpm dev
```

In **Settings → Plugins**, install and enable **Comments & Reviews**. If the current JWT predates the new permissions and the menu does not appear, sign out and sign back in once.

For structural verification, temporarily move `.env` outside the project root and run:

```powershell
pnpm verify:phase4
```

Expected final line:

```text
Phase 4 CMS Experience + Discussion Plugin structure verified successfully.
```

Phase 4 remains IN PROGRESS until the CMS Experience manual tests and quality gates pass.
