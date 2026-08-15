# BeyondX Phase 5C.2 — Corporate Pages + Blog

This overlay continues the corporate-site path after 5C.1/5C.1B/5C.1C.

## Delivered

### Schema-driven Admin content

Idempotent system schemas are seeded on the existing Schema Engine:

- `site-page` → **Pages**
- `blog-post` → **Blog posts**
- `blog-category` → **Blog categories**
- `blog-tag` → **Blog tags**

The Admin sidebar promotes those four models near Site settings instead of treating them
as anonymous generated collections.

### Page fields

Title, auto UID/slug, excerpt, rich-text content, featured image, template,
sort order, locale, SEO title/description, OG image, canonical URL and no-index.

### Blog post fields

Title, auto UID/slug, excerpt, rich-text content, featured image, category,
repeatable tags, author, published-at, locale, featured flag and SEO fields.

Category and Tag are real Schema Engine relations.

### Explicit public APIs / Scalar

- `GET /api/v1/pages`
- `GET /api/v1/pages/:slug`
- `GET /api/v1/blog/posts`
- `GET /api/v1/blog/posts/:slug`
- `GET /api/v1/blog/categories`
- `GET /api/v1/blog/tags`

Only `ACTIVE` records from public schemas are delivered.

Slug lookup is implemented in the Schema repository against the JSON record value,
so detail pages do not need to scan whole collections.

### Theme SDK

```ts
const pages = await beyondx.pages.list({ page: 1, pageSize: 20 });
const about = await beyondx.pages.get("about");

const posts = await beyondx.blog.listPosts({ page: 1, pageSize: 12 });
const post = await beyondx.blog.getPost("hello-beyondx");
const categories = await beyondx.blog.listCategories();
const tags = await beyondx.blog.listTags();
```

Theme manifest adds `corporateContent: true` and advertises all six endpoints.

## Apply

Extract this ZIP over the BeyondX repository after the 5C.1 line, then run:

```bash
pnpm db:generate
pnpm db:seed
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm verify:phase5
```

No Prisma migration is required. Existing `DataSchema`, `DataField` and `DataRecord`
tables are reused.

## Manual smoke test

1. Restart API/Admin after applying.
2. Confirm Admin sidebar contains Pages, Blog posts, Blog categories and Blog tags.
3. Create an ACTIVE Page named `About`; leave slug blank so UID generation creates `about`.
4. Confirm `GET /api/v1/pages/about` appears in Scalar and returns the record.
5. Create an ACTIVE Blog category and tag.
6. Create an ACTIVE Blog post, assign its category/tag relations and save.
7. Confirm the post appears in `GET /api/v1/blog/posts` and its slug detail endpoint.
8. For any image shown publicly, mark the Media asset PUBLIC in Media Library.

## Deferred to the next checkpoints

Navigation, contact-form submissions and final SEO/sitemap/robots delivery remain outside 5C.2.
