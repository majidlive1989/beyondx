# BeyondX Phase 4 — CMS Experience

Phase 4 is being developed as the everyday CMS experience before Commerce is resumed later.

## Milestone 4.1 — Content experience

- Publishable content models appear directly under **Content**.
- Dynamic collections from Structure Builder appear automatically under **Content**.
- Draft / publish / unpublish / archive / schedule and revision workflows are available in the content editor.
- SEO, automatic slugs and relation pickers stay inside the normal editor.
- Structure Builder remains under Settings for advanced users.

## Milestone 4.2 — Comments & Reviews

A first-party optional **Comments & Reviews** plugin adds one shared Discussion Engine instead of separate post-comment and product-review implementations.

- Content comments.
- Product reviews with optional 1–5 star ratings.
- Pending / Approved / Spam / Trash moderation.
- Public/admin replies.
- Per-source discussion settings.
- Verified-purchase flag reserved for Commerce integration.
- One moderation inbox at `/comments`.
- Content editor gets a simple **Discussion** section only while the plugin is active.
- The plugin can be enabled or disabled through the existing hot Plugin Runtime without restarting the API.

Product Editor integration will reuse this same engine when Commerce is resumed. No duplicate review subsystem should be created later.
