# BeyondX — Phase 5C Next.js Theme Integration

BeyondX is a modular digital product platform. The current checkpoint includes the Theme Delivery Bridge, typed Theme SDK, explicit public/private Media Delivery and a runnable Next.js reference storefront.

## Phase 5 delivery checkpoints

- **5A** — Theme Delivery Bridge + typed `@beyondx/theme-sdk`
- **5B** — Public/Private Media Delivery
- **5C** — Next.js App Router reference integration

The reference frontend lives in `apps/storefront` and runs on `http://localhost:3001` during local development. It intentionally consumes BeyondX through the public Theme SDK instead of importing backend/database internals.

See `PHASE5C-NEXT-INTEGRATION-README.md` for setup, verification and smoke-test instructions.
