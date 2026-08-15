# BeyondX Phase 5C.4 — Contact Forms + Inbox

This overlay continues the verified 5C.3 Navigation checkpoint and follows the Admin rule:
**simple by default, advanced when needed**.

## What the Admin sees

A single new everyday workspace:

```text
MESSAGES
└── Contact inbox
```

The underlying `contact-submission` Schema Engine collection is hidden from the normal Content list.
Editors do not need to work with raw generated records.

## Contact inbox

`/contact-submissions`

- All / New / Read / Archived filters.
- Search the currently loaded page by name, email, phone, subject or message.
- 50 messages per page with Previous / Next pagination.
- Two-pane inbox on desktop, stacked responsive layout on smaller screens.
- Opening a New message marks it Read automatically.
- Mark unread.
- Archive / Move to inbox.
- Delete.
- Reply by email using the user's local email client.
- Shows phone, locale and source page when supplied.

No outbound-email/SMTP system is introduced here; delivery notifications remain a later infrastructure concern.

## Data model

No Prisma migration is required. The existing Schema Engine stores a private system collection:

- `contact-submission`
- `publicRead: false`

Fields:

- name
- email
- phone
- subject
- message
- locale
- pageUrl

Schema record status is intentionally reused as the inbox workflow:

- `DRAFT` = New
- `ACTIVE` = Read
- `ARCHIVED` = Archived

This avoids adding a second status system.

## Public API / Scalar

```http
POST /api/v1/forms/contact
```

Example request:

```json
{
  "name": "Ali Example",
  "email": "ali@example.com",
  "phone": "+971500000000",
  "subject": "Project question",
  "message": "Please contact me.",
  "locale": "en",
  "pageUrl": "/contact"
}
```

Success:

```json
{ "submitted": true }
```

Validation limits are enforced before storage. A `website` honeypot field is supported for simple bot filtering;
if it is filled, the API returns success without creating an inbox record. Request ID/IP/User-Agent can be written to the existing audit path, but they are not stored in the contact record itself.

There is intentionally **no public GET endpoint for submissions**. The private schema remains unreadable through generic public Dynamic Data routes.

## Theme SDK

```ts
await beyondx.forms.submit("contact", {
  name: "Ali Example",
  email: "ali@example.com",
  message: "Hello from the website",
  pageUrl: "/contact",
});
```

The Theme manifest now advertises:

- `capabilities.forms = true`
- `endpoints.contactForm = "/api/v1/forms/contact"`

## Apply

Extract this ZIP over the BeyondX repository after 5C.3, then run:

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

`pnpm db:generate` / `pnpm db:migrate` are not required because Prisma schema is unchanged.

## Manual smoke test

1. Restart API/Admin after `pnpm db:seed`.
2. Confirm **Messages → Contact inbox** appears in Admin.
3. Confirm `POST /api/v1/forms/contact` appears under **Forms** in Scalar.
4. Submit a real message from Scalar.
5. Confirm it appears as **New** in Contact inbox.
6. Open it and confirm it changes to **Read**.
7. Mark unread, archive, then move it back to inbox.
8. Test Reply by email.
9. Submit with a non-empty `website` honeypot and confirm the API returns success but no inbox record is created.
