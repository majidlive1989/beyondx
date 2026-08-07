CREATE TABLE "platform_metadata" (
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "platform_metadata_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "module_installations" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "module_installations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "module_installations_name_key" ON "module_installations"("name");
CREATE INDEX "module_installations_enabled_idx" ON "module_installations"("enabled");
