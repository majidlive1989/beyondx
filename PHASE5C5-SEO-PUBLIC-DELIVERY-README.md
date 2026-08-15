# BeyondX Phase 5C.5 — SEO + Public Delivery

This checkpoint completes the SEO data contract needed before the Corporate Starter Theme in 5C.6.
It keeps the Admin workflow simple: global SEO stays inside **Site settings**, while Page and Blog
records keep their existing per-entry SEO fields.

## Admin UX

`Site settings → SEO` now includes:

- **Website URL** — canonical site origin/base URL.
- **Default locale**.
- **Default SEO title**.
- **Default SEO description**.
- **Default social / OG image**.
- **Allow search engines to index this website**.

The indexing switch is useful for staging/private deployments. Existing Site Settings records remain
compatible; after `pnpm db:seed`, the two new fields are added idempotently.

Page and Blog SEO already support:

- `seoTitle`
- `seoDescription`
- `ogImage`
- `canonicalUrl`
- `noIndex`

No duplicate SEO editor is introduced.

## Public API / Scalar

### SEO defaults

```http
GET /api/v1/seo/config
```

Example:

```json
{
  "seo": {
    "siteUrl": "https://example.com",
    "siteName": "Example",
    "defaultTitle": "Example Company",
    "defaultDescription": "Corporate website",
    "defaultImageId": "media-123",
    "defaultLocale": "en",
    "indexingAllowed": true
  }
}
```

`siteUrl` is normalized by removing the trailing slash. Invalid/non-http(s) values are delivered as
`null` rather than being trusted as canonical origins.

### Sitemap source

```http
GET /api/v1/seo/sitemap
```

Example:

```json
{
  "entries": [
    {
      "path": "/",
      "kind": "PAGE",
      "slug": "home",
      "locale": "en",
      "lastModified": "2026-08-15T00:00:00.000Z"
    },
    {
      "path": "/blog/hello-beyondx",
      "kind": "BLOG_POST",
      "slug": "hello-beyondx",
      "locale": "en",
      "lastModified": "2026-08-15T01:00:00.000Z"
    }
  ]
}
```

Rules:

- only ACTIVE public Pages and Blog Posts are included;
- `noIndex: true` records are excluded;
- `home` maps to `/`;
- Blog Posts map to `/blog/:slug`;
- when global indexing is disabled, the sitemap source returns an empty list;
- collections are paged internally in batches of 100 so sitemap generation is not limited to one page.

## Why the API returns sitemap data instead of `/sitemap.xml`

BeyondX is headless. The public website domain — not necessarily the API domain — must own its actual
`/sitemap.xml` and `/robots.txt` routes. Therefore 5C.5 exposes a stable typed SEO source. In 5C.6,
the Corporate Starter Theme will use this source from Next.js `sitemap.ts`, `robots.ts` and metadata.

This avoids publishing canonical SEO files on the wrong host when API and frontend are deployed on
separate domains.

## Theme SDK

```ts
const seo = await beyondx.seo.getConfig();
const sitemap = await beyondx.seo.getSitemap();

seo.indexingAllowed;
seo.siteUrl;
sitemap.entries;
```

The Theme manifest advertises:

```text
seo: true
/api/v1/seo/config
/api/v1/seo/sitemap
```

## Apply

Extract the ZIP over the verified Phase 5C.4 checkout, including the Theme SDK lint fix, then run:

```bash
pnpm db:seed
pnpm --filter @beyondx/module-schema typecheck
pnpm --filter @beyondx/theme-sdk lint
pnpm --filter @beyondx/theme-sdk typecheck
pnpm --filter @beyondx/admin typecheck
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm verify:phase5
```

No Prisma migration is required.

## Manual smoke test

1. Open **Site settings → SEO**.
2. Set Website URL to `https://example.com` and keep indexing enabled.
3. Save settings.
4. Confirm Scalar exposes `GET /api/v1/seo/config` and `GET /api/v1/seo/sitemap`.
5. Confirm the config returns the Website URL and defaults.
6. Create/publish an About Page and a Blog Post.
7. Confirm both appear in the sitemap source.
8. Set `noIndex` on one record and confirm it disappears from sitemap output.
9. Disable **Allow search engines to index this website** and confirm sitemap entries become empty.
10. Re-enable indexing before production if the site should be discoverable.

## Next checkpoint

**5C.6 — Corporate Starter Theme + Integration Guide + E2E** will consume this contract and produce:

- Next.js metadata;
- canonical URLs;
- Open Graph images;
- `robots.txt`;
- `sitemap.xml`;
- Site Settings / Navigation / Pages / Blog / Media / Contact Form E2E.
