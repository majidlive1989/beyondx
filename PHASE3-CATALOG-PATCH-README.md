# BeyondX Phase 3 — Strapi-style Schema Engine + Catalog Builder overlay

Apply this archive to the current BeyondX repository root and overwrite matching files. It keeps Phase 0, Identity, Media and the existing CMS groundwork.

New in this Phase 3 revision:
- shared `@beyondx/module-schema`
- Admin Data Model Builder (`/builder`)
- generated data manager (`/data/{schemaKey}`)
- generated dynamic data APIs
- Collection / Single / System Extension schema kinds
- TEXT, LONG_TEXT, NUMBER, BOOLEAN, DATE, JSON, ENUM, MEDIA and RELATION fields
- Product and Variant system-extension schemas
- Catalog Product/Variant custom fields validated by Schema Engine
- Media Library picker in generated forms
- RBAC, Audit Log and Prisma persistence

After extraction:

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

Do not reset the database.

New migration:

```text
20260807000400_phase3_schema_engine
```

Then run `pnpm verify:phase3` with `.env` temporarily outside the repository.
