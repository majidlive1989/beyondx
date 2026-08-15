# BeyondX Frontend Integration Contract

This document is the framework-independent contract between BeyondX and a website/theme.

## 1. Boundary

A frontend connects to the BeyondX **public HTTP API**. It must not import Prisma, repositories, storage adapters, Admin code or module internals.

```text
Admin -> Database -> Public API -> Frontend adapter -> UI
```

The frontend can live in a separate repository and can be deployed independently. The only required configuration is the BeyondX API base URL.

Example:

```env
BEYONDX_API_URL=https://api.example.com
```

For browser-to-API requests, the frontend origin must also be allowed by BeyondX `CORS_ORIGIN`. Server-to-server requests do not require browser CORS.

## 2. Capability discovery

```http
GET /api/v1/theme/manifest
```

Use the manifest when a generic theme needs to discover which BeyondX capabilities and endpoints are available. Do not infer backend tables or module internals from the frontend.

## 3. Site settings

```http
GET /api/v1/site/settings
```

Response:

```json
{
  "settings": {
    "id": "...",
    "schemaKey": "site-settings",
    "status": "ACTIVE",
    "values": {
      "siteName": "Example",
      "companyName": "Example LLC",
      "logo": "media-id",
      "favicon": "media-id",
      "email": "hello@example.com",
      "phone": "+1 555 000 0000",
      "siteUrl": "https://www.example.com",
      "defaultLocale": "en",
      "seoTitle": "Example",
      "seoDescription": "...",
      "seoImage": "media-id"
    }
  }
}
```

The exact `values` object is content data. Themes should gracefully tolerate optional values.

## 4. Navigation

```http
GET /api/v1/navigation
```

Response:

```json
{
  "navigation": {
    "header": [
      {
        "label": "About",
        "href": "/about",
        "style": "LINK",
        "openInNewTab": false
      }
    ],
    "footer": []
  }
}
```

Page links are resolved by BeyondX from the current published page slug. The frontend renders the returned `href`; it does not need the internal Page ID.

## 5. Pages

```http
GET /api/v1/pages?page=1&pageSize=20
GET /api/v1/pages/:slug
```

Only public ACTIVE records are delivered. A theme maps `page.values` to its own components. Common fields are `title`, `slug`, `excerpt`, `content`, `featuredImage`, `template`, `locale`, `seoTitle`, `seoDescription`, `ogImage`, `canonicalUrl` and `noIndex`.

A theme can use one generic route such as `/:slug` for all corporate pages. Framework-specific page components are not required in BeyondX.

## 6. Blog

```http
GET /api/v1/blog/posts?page=1&pageSize=20
GET /api/v1/blog/posts/:slug
GET /api/v1/blog/categories
GET /api/v1/blog/tags
```

Common Blog Post values are `title`, `slug`, `excerpt`, `content`, `featuredImage`, `category`, `tags`, `authorName`, `publishedAt`, `locale`, `isFeatured`, and SEO values.

## 7. Public media

Metadata:

```http
GET /api/v1/media/:id
```

Binary/content URL:

```http
GET /api/v1/media/:id/content
```

Only PUBLIC media should be rendered by public themes. Media fields in CMS records store a MediaAsset ID, not a storage key. Never build storage paths in a theme.

Example helper:

```ts
function mediaUrl(apiBaseUrl: string, id: string) {
  return `${apiBaseUrl}/api/v1/media/${encodeURIComponent(id)}/content`;
}
```

## 8. Contact form

```http
POST /api/v1/forms/contact
Content-Type: application/json
```

```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "phone": "+1 555 000 0000",
  "subject": "Hello",
  "message": "I would like to contact you.",
  "locale": "en",
  "pageUrl": "/contact",
  "website": ""
}
```

`website` is a honeypot and real users must leave it empty. Successful submissions are stored in the private Admin Contact Inbox. There is no public endpoint for reading submissions.

For universal themes, submitting through a server action/server route is recommended because it keeps the backend URL server-side and avoids browser CORS coupling.

## 9. SEO

Defaults:

```http
GET /api/v1/seo/config
```

Sitemap source data:

```http
GET /api/v1/seo/sitemap
```

A frontend uses these endpoints to generate metadata, canonical URLs, Open Graph tags, `robots.txt` and `sitemap.xml` on the **website domain**. BeyondX intentionally provides SEO data rather than pretending the API domain is the website domain.

Page/Post `noIndex` overrides should be respected by the frontend. Sitemap data already omits entries that should not be indexed.

## 10. Optional Theme SDK

JavaScript/TypeScript frontends can optionally use `@beyondx/theme-sdk`:

```ts
const settings = await beyondx.site.getSettings();
const navigation = await beyondx.navigation.get();
const page = await beyondx.pages.get("about");
const posts = await beyondx.blog.listPosts();
const seo = await beyondx.seo.getConfig();
```

The SDK is not the architecture boundary. It is a typed wrapper around the public API. A PHP, mobile, Vue or other client can call the same REST endpoints directly.

## 11. Caching and publishing

Public GET responses are safe to cache according to the frontend's requirements. A reference Next.js theme can use time-based revalidation. A production theme may later add webhook-driven revalidation without changing the BeyondX content model.

Private Admin APIs and private Media endpoints must never be used by public themes.

## 12. Error handling

Themes should handle these cases without exposing backend internals:

- `404` page/post/media -> render framework 404.
- API unavailable -> render an error/fallback state.
- Missing optional Site Settings -> use theme defaults.
- Empty Navigation -> render no menu or a theme fallback.
- Empty Blog -> render an empty state.

## 13. Minimal adapter pattern

Keep HTTP calls in one adapter layer:

```text
src/lib/beyondx/
├── client
├── site
├── navigation
├── pages
├── blog
├── media
├── forms
└── seo
```

UI components consume adapter functions instead of calling BeyondX endpoints everywhere. This keeps a theme replaceable and prevents backend coupling.

## 14. Deployment model

A typical deployment is fully separate:

```text
admin.example.com  -> BeyondX Admin
api.example.com    -> BeyondX API
www.example.com    -> any frontend/theme
```

The frontend can be replaced or redeployed without changing BeyondX. BeyondX can be upgraded without owning the frontend's presentation layer as long as the public API contract remains compatible.
