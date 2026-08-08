-- Phase 3: treat Catalog as an installable first-party plugin.
-- Existing Phase 3 installations keep Catalog enabled after the migration.
-- Fresh databases do not receive a Catalog installation row automatically.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "module_installations" WHERE "name" = '@beyondx/module-catalog'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM "module_installations" WHERE "name" = '@beyondx/plugin-catalog'
    ) THEN
      DELETE FROM "module_installations" WHERE "name" = '@beyondx/module-catalog';
    ELSE
      UPDATE "module_installations"
      SET
        "name" = '@beyondx/plugin-catalog',
        "version" = '1.0.0',
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "name" = '@beyondx/module-catalog';
    END IF;
  END IF;
END $$;

UPDATE "permissions"
SET "module" = '@beyondx/plugin-catalog', "updatedAt" = CURRENT_TIMESTAMP
WHERE "module" = '@beyondx/module-catalog';
