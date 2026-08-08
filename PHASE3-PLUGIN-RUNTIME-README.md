# BeyondX Phase 3 — Plugin Runtime + Catalog Plugin

Phase 3 now treats Catalog as a first-party plugin instead of a feature hard-coded into the API runtime.

## Runtime model

- Core CMS runtime always loads Foundation, Identity, Content, Media, Schema Engine and Plugin Manager.
- Available plugins are registered with `PluginRegistry`.
- Only installed **and enabled** plugins are converted into runtime modules during API startup.
- Admin navigation comes from active plugin manifests, not from hard-coded Catalog links.
- Plugin state is persisted in the existing `module_installations` table using the `@beyondx/plugin-*` namespace.

## Catalog compatibility

The migration `20260808000100_phase3_plugin_runtime_catalog` converts an existing `@beyondx/module-catalog` installation row into `@beyondx/plugin-catalog`. Existing Phase 3 installations therefore keep Catalog enabled after upgrading.

A fresh BeyondX database does **not** seed a Catalog plugin installation. Catalog remains available in the Plugin Manager, but Product/Catalog menus and API routes are not loaded until it is installed, enabled and the API is restarted.

## Lifecycle

1. Install — creates plugin installation state and provisions plugin permissions. The plugin remains disabled.
2. Enable — marks it enabled. Restart the API to load routes/services/navigation.
3. Disable — marks it disabled. Restart the API to unload routes/services/navigation. Data is preserved.
4. Uninstall — allowed only after the plugin is disabled and no longer active. Plugin data is preserved; plugin permission definitions are removed.

Phase 3 v1 uses restart-safe activation rather than hot-loading Fastify routes. A future Plugin SDK phase can add isolated hot lifecycle handling without weakening route ownership or dependency safety.
