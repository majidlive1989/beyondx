# BeyondX Phase 3 — Schema Engine + Catalog Builder Overlay

This overlay upgrades the existing Phase 3 Catalog implementation into a Strapi-style schema-driven platform while preserving Foundation, Identity, Media, existing CMS groundwork, and Catalog.

## What changes

- Adds `@beyondx/module-schema`.
- Adds Collection, Single, and protected System Extension schema kinds.
- Adds dynamic field definitions: Text, Long Text, Number, Boolean, Date, JSON, Enum, Media, Relation.
- Adds generated dynamic data APIs and generated Admin record forms.
- Adds `/builder` for schema management and `/data/{schemaKey}` for dynamic records.
- Extends Catalog Product and Variant using protected `catalog.product` / `catalog.variant` schemas.
- Catalog custom fields are rendered without changing Catalog code.
- Dynamic Media fields use the existing Media Library.
- Adds RBAC, audit logging, validation, and public-read controls.

## Apply

Extract this ZIP into the current BeyondX project root and overwrite matching files.

Do not reset the database.

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

For structural verification, temporarily move `.env` outside the project if the verifier requires it:

```powershell
Move-Item .env ..\BeyondX.env.backup
pnpm verify:phase3
Move-Item ..\BeyondX.env.backup .env
```

Expected output:

```text
Phase 3 Schema Engine + Catalog Builder structure verified successfully.
```

## Manual proof of dynamic modularity

1. Start BeyondX with `pnpm dev`.
2. Open `/builder`.
3. Open the protected Product system schema.
4. Add a required NUMBER field:
   - Label: Battery Capacity
   - Key: `batteryCapacity`
5. Open `/catalog` and create/edit a product.
6. `Battery Capacity` must appear automatically without any Catalog code change.
7. In `/builder`, create a Collection named `FAQ` with key `faq`.
8. Add `question` and `answer` fields.
9. Open `/data/faq` and create a record.
10. If Public Read is enabled and the record is ACTIVE, verify `GET /api/v1/data/faq` in Scalar.

## Migration

New migration:

```text
20260807000400_phase3_schema_engine
```

The existing Phase 3 Catalog migration remains unchanged.
