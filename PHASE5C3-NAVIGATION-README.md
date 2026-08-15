# BeyondX Phase 5C.3 — Navigation

This overlay continues the verified 5C.2/5C.2B corporate CMS checkpoint.

## Admin UX

A dedicated **Navigation** workspace is added to the Content sidebar.

The editor manages **Header menu** and **Footer menu on one screen**:

- Add Page, Blog or Custom links.
- Choose an existing ACTIVE Page from a dropdown.
- Use Blog without typing `/blog`.
- Use custom relative or absolute URLs.
- Set the visible label.
- Move links up/down without opening another page.
- Disable a link without deleting it.
- Optional Open in new tab.
- Optional Button / CTA style.
- One **Save navigation** action publishes both menus.
- Built-in order preview.

The underlying Schema Engine models stay hidden from everyday navigation.

## Data model

No Prisma migration is required. The existing Schema Engine is reused.

System schemas seeded idempotently:

- `site-navigation-item` — reusable COMPONENT
- `site-navigation` — public SINGLE type

`site-navigation` contains repeatable `headerItems` and `footerItems`.

## Public API / Scalar

```http
GET /api/v1/navigation
```

Example:

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

Page links are resolved server-side from the current ACTIVE `site-page` slug.
The public API does not expose the internal page relation ID.

Disabled links and links to unpublished/missing pages are omitted.

## Theme SDK

```ts
const navigation = await beyondx.navigation.get();

navigation.header
navigation.footer
```

The Theme manifest adds `navigation: true` and `/api/v1/navigation`.

## Apply

Extract over the BeyondX project after 5C.2B, then run:

```bash
pnpm db:seed
pnpm --filter @beyondx/admin typecheck
pnpm --filter @beyondx/module-schema typecheck
pnpm --filter @beyondx/theme-sdk typecheck
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm verify:phase5
```

`pnpm db:generate` and `pnpm db:migrate` are not required because there is no Prisma schema change.

## Manual smoke test

1. Restart API/Admin after `pnpm db:seed`.
2. Confirm **Navigation** appears in the sidebar.
3. Add Home/About/Blog to Header.
4. Add Contact and a custom Privacy link to Footer.
5. Move items up/down and save.
6. Open Scalar and confirm `GET /api/v1/navigation`.
7. Confirm Header/Footer order matches Admin.
8. Disable one item, save, and confirm it disappears from the public response.
9. Unpublish a linked Page and confirm the public navigation omits that link.
