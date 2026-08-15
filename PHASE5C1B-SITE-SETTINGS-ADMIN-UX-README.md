# BeyondX Phase 5C.1B — Site Settings Admin UX

This overlay is applied **after Phase 5C.1 Corporate Site Globals**.

It does not introduce a second settings backend. It improves the Admin UX over the existing
`site-settings` SINGLE schema and the existing repeatable `site-social-link` component.

## What changes

- `Site settings` in the sidebar opens a dedicated `/site-settings` editor.
- Settings are grouped into General, Branding, Contact, Social, Footer and SEO.
- Social networks are an explicit repeater with **+ Add social network**.
- Each social item has Platform, optional Label, URL and Open-in-new-tab.
- Supported presets: Instagram, Facebook, LinkedIn, X/Twitter, YouTube, Telegram,
  WhatsApp, TikTok, GitHub and Custom.
- The reusable `site-social-link` component gets a seeded `platform` ENUM field.
- Theme SDK social link typing includes `SiteSocialPlatform`.
- Logo, favicon and OG image selectors show PUBLIC images from Media Library.

## Apply

Extract the ZIP over the BeyondX root after the previous 5C.1 patch, then run:

```bash
pnpm db:generate
pnpm db:seed
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm verify:phase5
```

No Prisma migration is required. `pnpm db:seed` idempotently adds the new social platform field.

## Manual smoke test

1. Open Admin → Content → Site settings.
2. Confirm the dedicated settings editor opens.
3. In Social networks click **+ Add social network** three times.
4. Configure e.g. Instagram, LinkedIn and WhatsApp with different URLs.
5. Save settings.
6. Refresh the page and confirm all three items persist.
7. Confirm `GET /api/v1/data/site-settings?page=1&pageSize=1` returns all three
   objects inside `values.socialLinks`.
