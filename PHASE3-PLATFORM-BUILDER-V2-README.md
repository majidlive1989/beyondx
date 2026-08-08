# Phase 3 Platform Builder v2 overlay

This overlay continues the Phase 3 Strapi-style architecture. It adds reusable Components, Dynamic Zones, UID fields with optional generation/uniqueness, Rich Text source fields, validation rules, cycle protection, nested generated Admin forms, and Catalog custom-field component rendering.

Apply it on top of the current Phase 3 project that already contains Catalog + Schema Engine. Do not delete CMS groundwork, Identity or Media. Run `pnpm db:generate`, `pnpm db:migrate`, then the normal lint/typecheck/test/build verification sequence.
