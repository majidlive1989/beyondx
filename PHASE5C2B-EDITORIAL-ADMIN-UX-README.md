# BeyondX Phase 5C.2B — Editorial Admin UX

This overlay is applied after Phase 5C.2 Corporate Pages + Blog.

## Goal

Reduce daily Admin navigation and let an editor create a complete blog post from one screen.

## Sidebar

Before: Blog posts, Blog categories, Blog tags.

After: **Blog**. Category and Tag models stay in the Schema Engine and remain available for advanced bulk management, but they are removed from the main sidebar.

## Blog workspace

`/blog` includes All/Draft/Published/Archived counters, search and one-click New post.

## One-screen post editor

`/blog/new` and `/blog/post/:id` include Title, Slug, Excerpt, Content, Featured image, Author, Publish date, Locale, Featured flag, Category, inline Category creation, Tag chips, inline Tag creation and a collapsible SEO section.

Sticky actions provide Save draft, Publish/Update published, Archive and Delete.

The editor continues to store data in the existing `blog-post`, `blog-category` and `blog-tag` Schema Engine records, so the Phase 5C.2 public API and Theme SDK do not change.

## Apply

```bash
pnpm --filter @beyondx/admin typecheck
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm verify:phase5
```

No database migration, Prisma generation or seed is required for this UX overlay.

## Manual smoke test

1. Restart Admin.
2. Confirm sidebar shows **Blog**, not Blog posts / Blog categories / Blog tags.
3. Open Blog → New post.
4. Enter Title, Excerpt and Content.
5. Create a new Category inline.
6. Create two Tags inline and confirm they appear as chips.
7. Select a Featured image.
8. Open SEO and add SEO title/description.
9. Save draft, refresh and confirm values persist.
10. Publish, return to Blog and confirm the post appears as Published.
