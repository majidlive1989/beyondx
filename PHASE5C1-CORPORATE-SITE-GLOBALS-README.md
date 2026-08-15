# BeyondX Phase 5C.1 — Corporate Site Globals

This patch starts the general-purpose CMS/theme path for a simple corporate website with a blog.
It reuses the existing Schema Engine and Media module instead of adding a parallel settings subsystem.

## What is added

- Protected system `COMPONENT` schema: `site-social-link`.
- Protected system `SINGLE` schema: `site-settings`, with public read enabled.
- Generated Admin editing through the existing Data/Content UI.
- Theme manifest capability `siteGlobals: true`.
- Theme endpoint contract: `/api/v1/data/site-settings`.
- Typed Theme SDK helper: `client.site.getSettings()`.

## Site settings fields

`siteName`, `companyName`, `tagline`, `description`, `email`, `phone`, `address`,
`logo`, `favicon`, `socialLinks`, `footerText`, `copyrightText`, `defaultLocale`,
`seoTitle`, `seoDescription`, and `seoImage`.

Media fields store `MediaAsset` IDs. Public logo/favicon/SEO assets must be marked `PUBLIC`
in the Media Library before a public theme can render them.

## Why this comes before the store

A corporate + blog theme needs stable site-wide identity and SEO data before Pages, Blog,
Navigation and Contact Forms are wired end-to-end. Those will build on this contract.

## Apply

Extract this ZIP over the current BeyondX repository root (current baseline: Phase 5B / main).

```bash
pnpm install
pnpm db:generate
pnpm db:seed
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm verify:phase5
```

No new Prisma migration is required. Existing `DataSchema`, `DataField`, and `DataRecord`
storage is reused; `pnpm db:seed` installs/updates the system schemas idempotently.

## Smoke test

1. Start API/Admin and sign in.
2. Open the generated **Site settings** single type in Admin.
3. Create/update its single record and set it to `ACTIVE`.
4. Mark logo/favicon/SEO image assets `PUBLIC` when they should be visible publicly.
5. Verify:
   `GET /api/v1/data/site-settings?page=1&pageSize=1`
6. Confirm the response contains the active `site-settings` record.

## Theme SDK

```ts
const settings = await beyondx.site.getSettings();

if (settings) {
  console.log(settings.values.siteName);
  console.log(settings.values.companyName);

  if (settings.values.logo) {
    console.log(beyondx.media.url(settings.values.logo));
  }
}
```

## Next patch

Phase 5C.2 should build the corporate content contract: Pages + Blog conventions,
then Navigation, Contact Forms, and final SEO/public delivery polish.
