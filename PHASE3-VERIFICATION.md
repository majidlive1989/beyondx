# Phase 3 — Platform Builder + Catalog verification

Phase 3 now establishes the Strapi-style platform layer for BeyondX while keeping critical commerce invariants code-defined. The Builder can create Collection Types, Single Types and reusable Components. Fields support Text, Long Text, Rich Text source, UID, Number, Boolean, Date, JSON, Enum, Media, Relation, Component and Dynamic Zone. Product and Variant remain strong Catalog models and can be extended with the same schema engine.

## Required commands

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

Do not reset the database. Phase 3 migrations are:

```text
20260807000300_phase3_catalog
20260807000400_phase3_schema_engine
20260807000500_phase3_platform_builder_v2
```

For structural verification, temporarily move the real `.env` out of the project:

```powershell
Move-Item .env ..\BeyondX.env.backup
pnpm verify:phase3
Move-Item ..\BeyondX.env.backup .env
```

Expected final line:

```text
Phase 3 Platform Builder + Catalog structure verified successfully.
```

## Platform Builder scenario

Open `http://127.0.0.1:3000/builder`.

1. Create a COMPONENT called `SEO` with key `component.seo`.
2. Add required TEXT `metaTitle` and LONG_TEXT `metaDescription`.
3. Create a COLLECTION called `Article` with key `article`.
4. Add TEXT `title` and UID `slug`; configure slug to generate from `title`.
5. Add COMPONENT `seo` pointing to `SEO`.
6. Create two more components such as `Hero` and `Text block`.
7. Add a DYNAMIC_ZONE `blocks` to Article and allow those components.
8. Open `/data/article`; the generated form must render the nested SEO fields and add/remove dynamic blocks.
9. Save an Article with a blank UID; it must generate a URL-safe slug.
10. Creating another Article with the same generated UID must conflict.
11. Refresh/restart and verify nested component and dynamic-zone data persists.
12. Attempt to make components reference each other in a cycle; the API must reject it.

## Catalog integration scenario

1. Select protected `Product custom fields` in Builder.
2. Add normal fields or a reusable COMPONENT.
3. Open `/catalog`; Product forms must render those schema-driven fields without Catalog code changes.
4. Save, refresh and confirm persistence.
5. Media fields must select assets from Media Library.

## Catalog core scenario

1. Create a Brand and Category.
2. Create Attributes and values.
3. Create a DRAFT Product and choose Media.
4. Create a Variant with a globally unique SKU.
5. Duplicate SKU must conflict.
6. Two values from the same Attribute on one Variant must be rejected.
7. Product can become ACTIVE only after an active Variant exists.
8. Public Catalog APIs return only ACTIVE data.

## Regression checks

- Identity login and RBAC still work.
- `/media`, `/content`, and `/content-types` still open.
- System extension schemas cannot be deleted.
- Component schemas have no standalone records or public endpoint.
- Inventory, Cart, Checkout and Orders remain Phase 4.
