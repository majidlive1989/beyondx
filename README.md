# BeyondX Phase 3 — Auto Slug + Category Validation Fix

Apply over the current BeyondX Phase 3 project.

Changes:
- Auto-generates slugs from names for Brand, Category, Attribute, Attribute Value and Product.
- Slug is no longer manually editable in normal Admin forms.
- Existing slugs are preserved on edit to avoid breaking URLs.
- Empty Category create fields are omitted instead of sending null values.
- API validation errors now surface the first failing field/path in Admin.
- Catalog slug normalization accepts Unicode letters/numbers as well as Latin.

No Prisma schema or migration changes.
