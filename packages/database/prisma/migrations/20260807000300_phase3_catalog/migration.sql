CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
CREATE TYPE "ProductVariantStatus" AS ENUM ('ACTIVE', 'DISABLED');

CREATE TABLE "catalog_brands" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "catalog_brands_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "catalog_categories" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "parentId" TEXT,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "catalog_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "catalog_attributes" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "catalog_attributes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "catalog_attribute_values" (
  "id" TEXT NOT NULL,
  "attributeId" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "catalog_attribute_values_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "catalog_products" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT',
  "brandId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "catalog_products_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "catalog_product_categories" (
  "productId" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "catalog_product_categories_pkey" PRIMARY KEY ("productId", "categoryId")
);

CREATE TABLE "catalog_product_variants" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "sku" TEXT NOT NULL,
  "status" "ProductVariantStatus" NOT NULL DEFAULT 'ACTIVE',
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "catalog_product_variants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "catalog_variant_attribute_values" (
  "variantId" TEXT NOT NULL,
  "attributeId" TEXT NOT NULL,
  "attributeValueId" TEXT NOT NULL,
  CONSTRAINT "catalog_variant_attribute_values_pkey" PRIMARY KEY ("variantId", "attributeId")
);

CREATE TABLE "catalog_product_media" (
  "productId" TEXT NOT NULL,
  "mediaAssetId" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "catalog_product_media_pkey" PRIMARY KEY ("productId", "mediaAssetId")
);

CREATE UNIQUE INDEX "catalog_brands_name_key" ON "catalog_brands"("name");
CREATE UNIQUE INDEX "catalog_brands_slug_key" ON "catalog_brands"("slug");
CREATE INDEX "catalog_brands_name_idx" ON "catalog_brands"("name");

CREATE UNIQUE INDEX "catalog_categories_slug_key" ON "catalog_categories"("slug");
CREATE INDEX "catalog_categories_parentId_position_idx" ON "catalog_categories"("parentId", "position");
CREATE INDEX "catalog_categories_name_idx" ON "catalog_categories"("name");

CREATE UNIQUE INDEX "catalog_attributes_slug_key" ON "catalog_attributes"("slug");
CREATE INDEX "catalog_attributes_position_name_idx" ON "catalog_attributes"("position", "name");

CREATE UNIQUE INDEX "catalog_attribute_values_attributeId_slug_key" ON "catalog_attribute_values"("attributeId", "slug");
CREATE INDEX "catalog_attribute_values_attributeId_position_idx" ON "catalog_attribute_values"("attributeId", "position");

CREATE UNIQUE INDEX "catalog_products_slug_key" ON "catalog_products"("slug");
CREATE INDEX "catalog_products_status_updatedAt_idx" ON "catalog_products"("status", "updatedAt");
CREATE INDEX "catalog_products_brandId_status_idx" ON "catalog_products"("brandId", "status");
CREATE INDEX "catalog_products_name_idx" ON "catalog_products"("name");

CREATE INDEX "catalog_product_categories_categoryId_productId_idx" ON "catalog_product_categories"("categoryId", "productId");

CREATE UNIQUE INDEX "catalog_product_variants_sku_key" ON "catalog_product_variants"("sku");
CREATE INDEX "catalog_product_variants_productId_position_idx" ON "catalog_product_variants"("productId", "position");
CREATE INDEX "catalog_product_variants_productId_status_idx" ON "catalog_product_variants"("productId", "status");

CREATE UNIQUE INDEX "catalog_variant_attribute_values_variantId_attributeValueId_key" ON "catalog_variant_attribute_values"("variantId", "attributeValueId");
CREATE INDEX "catalog_variant_attribute_values_attributeValueId_idx" ON "catalog_variant_attribute_values"("attributeValueId");

CREATE INDEX "catalog_product_media_mediaAssetId_idx" ON "catalog_product_media"("mediaAssetId");
CREATE INDEX "catalog_product_media_productId_position_idx" ON "catalog_product_media"("productId", "position");

ALTER TABLE "catalog_categories" ADD CONSTRAINT "catalog_categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "catalog_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "catalog_attribute_values" ADD CONSTRAINT "catalog_attribute_values_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "catalog_attributes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "catalog_products" ADD CONSTRAINT "catalog_products_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "catalog_brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "catalog_product_categories" ADD CONSTRAINT "catalog_product_categories_productId_fkey" FOREIGN KEY ("productId") REFERENCES "catalog_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "catalog_product_categories" ADD CONSTRAINT "catalog_product_categories_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "catalog_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "catalog_product_variants" ADD CONSTRAINT "catalog_product_variants_productId_fkey" FOREIGN KEY ("productId") REFERENCES "catalog_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "catalog_variant_attribute_values" ADD CONSTRAINT "catalog_variant_attribute_values_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "catalog_product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "catalog_variant_attribute_values" ADD CONSTRAINT "catalog_variant_attribute_values_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "catalog_attributes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "catalog_variant_attribute_values" ADD CONSTRAINT "catalog_variant_attribute_values_attributeValueId_fkey" FOREIGN KEY ("attributeValueId") REFERENCES "catalog_attribute_values"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "catalog_product_media" ADD CONSTRAINT "catalog_product_media_productId_fkey" FOREIGN KEY ("productId") REFERENCES "catalog_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "catalog_product_media" ADD CONSTRAINT "catalog_product_media_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
