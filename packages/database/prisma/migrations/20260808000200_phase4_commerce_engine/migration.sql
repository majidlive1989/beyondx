CREATE TYPE "CommerceCartStatus" AS ENUM ('ACTIVE', 'CONVERTED', 'ABANDONED', 'EXPIRED');
CREATE TYPE "CommerceCheckoutStatus" AS ENUM ('OPEN', 'COMPLETED', 'CANCELLED', 'EXPIRED');
CREATE TYPE "CommerceOrderStatus" AS ENUM ('PENDING_PAYMENT', 'CONFIRMED', 'CANCELLED');
CREATE TYPE "CommerceStockMovementType" AS ENUM ('ADJUSTMENT', 'RECEIVE', 'RESERVE', 'RELEASE', 'SALE');

CREATE TABLE "commerce_prices" (
  "id" TEXT NOT NULL,
  "variantId" TEXT NOT NULL,
  "currency" TEXT NOT NULL,
  "unitAmount" INTEGER NOT NULL,
  "compareAtAmount" INTEGER,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "commerce_prices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "commerce_warehouses" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "commerce_warehouses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "commerce_stock_levels" (
  "id" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "variantId" TEXT NOT NULL,
  "onHand" INTEGER NOT NULL DEFAULT 0,
  "reserved" INTEGER NOT NULL DEFAULT 0,
  "lowStockThreshold" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "commerce_stock_levels_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "commerce_stock_nonnegative" CHECK ("onHand" >= 0 AND "reserved" >= 0 AND "reserved" <= "onHand")
);

CREATE TABLE "commerce_stock_movements" (
  "id" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "variantId" TEXT NOT NULL,
  "type" "CommerceStockMovementType" NOT NULL,
  "onHandDelta" INTEGER NOT NULL,
  "reservedDelta" INTEGER NOT NULL DEFAULT 0,
  "reason" TEXT,
  "referenceType" TEXT,
  "referenceId" TEXT,
  "actorUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "commerce_stock_movements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "commerce_carts" (
  "id" TEXT NOT NULL,
  "accessTokenHash" TEXT NOT NULL,
  "userId" TEXT,
  "status" "CommerceCartStatus" NOT NULL DEFAULT 'ACTIVE',
  "currency" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "commerce_carts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "commerce_cart_items" (
  "id" TEXT NOT NULL,
  "cartId" TEXT NOT NULL,
  "variantId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "commerce_cart_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "commerce_cart_item_quantity_positive" CHECK ("quantity" > 0)
);

CREATE TABLE "commerce_checkout_sessions" (
  "id" TEXT NOT NULL,
  "cartId" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "status" "CommerceCheckoutStatus" NOT NULL DEFAULT 'OPEN',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "commerce_checkout_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "commerce_orders" (
  "id" TEXT NOT NULL,
  "orderNumber" TEXT NOT NULL,
  "cartId" TEXT NOT NULL,
  "checkoutSessionId" TEXT NOT NULL,
  "userId" TEXT,
  "status" "CommerceOrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
  "currency" TEXT NOT NULL,
  "subtotalAmount" INTEGER NOT NULL,
  "totalAmount" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "cancelledAt" TIMESTAMP(3),
  CONSTRAINT "commerce_orders_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "commerce_order_amounts_nonnegative" CHECK ("subtotalAmount" >= 0 AND "totalAmount" >= 0)
);

CREATE TABLE "commerce_order_items" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "variantId" TEXT NOT NULL,
  "sku" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitAmount" INTEGER NOT NULL,
  "lineTotalAmount" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "commerce_order_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "commerce_order_item_values_valid" CHECK ("quantity" > 0 AND "unitAmount" >= 0 AND "lineTotalAmount" >= 0)
);

CREATE UNIQUE INDEX "commerce_prices_variantId_currency_key" ON "commerce_prices"("variantId", "currency");
CREATE INDEX "commerce_prices_currency_active_idx" ON "commerce_prices"("currency", "active");
CREATE UNIQUE INDEX "commerce_warehouses_code_key" ON "commerce_warehouses"("code");
CREATE INDEX "commerce_warehouses_active_name_idx" ON "commerce_warehouses"("active", "name");
CREATE UNIQUE INDEX "commerce_stock_levels_warehouseId_variantId_key" ON "commerce_stock_levels"("warehouseId", "variantId");
CREATE INDEX "commerce_stock_levels_variantId_idx" ON "commerce_stock_levels"("variantId");
CREATE INDEX "commerce_stock_levels_warehouseId_updatedAt_idx" ON "commerce_stock_levels"("warehouseId", "updatedAt");
CREATE INDEX "commerce_stock_movements_variantId_createdAt_idx" ON "commerce_stock_movements"("variantId", "createdAt");
CREATE INDEX "commerce_stock_movements_warehouseId_createdAt_idx" ON "commerce_stock_movements"("warehouseId", "createdAt");
CREATE INDEX "commerce_stock_movements_referenceType_referenceId_idx" ON "commerce_stock_movements"("referenceType", "referenceId");
CREATE UNIQUE INDEX "commerce_carts_accessTokenHash_key" ON "commerce_carts"("accessTokenHash");
CREATE INDEX "commerce_carts_status_expiresAt_idx" ON "commerce_carts"("status", "expiresAt");
CREATE INDEX "commerce_carts_userId_status_idx" ON "commerce_carts"("userId", "status");
CREATE UNIQUE INDEX "commerce_cart_items_cartId_variantId_key" ON "commerce_cart_items"("cartId", "variantId");
CREATE INDEX "commerce_cart_items_variantId_idx" ON "commerce_cart_items"("variantId");
CREATE UNIQUE INDEX "commerce_checkout_sessions_cartId_key" ON "commerce_checkout_sessions"("cartId");
CREATE UNIQUE INDEX "commerce_checkout_sessions_idempotencyKey_key" ON "commerce_checkout_sessions"("idempotencyKey");
CREATE INDEX "commerce_checkout_sessions_status_expiresAt_idx" ON "commerce_checkout_sessions"("status", "expiresAt");
CREATE UNIQUE INDEX "commerce_orders_orderNumber_key" ON "commerce_orders"("orderNumber");
CREATE UNIQUE INDEX "commerce_orders_cartId_key" ON "commerce_orders"("cartId");
CREATE UNIQUE INDEX "commerce_orders_checkoutSessionId_key" ON "commerce_orders"("checkoutSessionId");
CREATE INDEX "commerce_orders_status_createdAt_idx" ON "commerce_orders"("status", "createdAt");
CREATE INDEX "commerce_orders_userId_createdAt_idx" ON "commerce_orders"("userId", "createdAt");
CREATE INDEX "commerce_order_items_orderId_idx" ON "commerce_order_items"("orderId");
CREATE INDEX "commerce_order_items_variantId_idx" ON "commerce_order_items"("variantId");

ALTER TABLE "commerce_prices" ADD CONSTRAINT "commerce_prices_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "catalog_product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "commerce_stock_levels" ADD CONSTRAINT "commerce_stock_levels_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "commerce_warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "commerce_stock_levels" ADD CONSTRAINT "commerce_stock_levels_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "catalog_product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "commerce_stock_movements" ADD CONSTRAINT "commerce_stock_movements_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "commerce_warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commerce_stock_movements" ADD CONSTRAINT "commerce_stock_movements_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "catalog_product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commerce_cart_items" ADD CONSTRAINT "commerce_cart_items_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "commerce_carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "commerce_cart_items" ADD CONSTRAINT "commerce_cart_items_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "catalog_product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commerce_checkout_sessions" ADD CONSTRAINT "commerce_checkout_sessions_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "commerce_carts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commerce_checkout_sessions" ADD CONSTRAINT "commerce_checkout_sessions_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "commerce_warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commerce_orders" ADD CONSTRAINT "commerce_orders_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "commerce_carts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commerce_orders" ADD CONSTRAINT "commerce_orders_checkoutSessionId_fkey" FOREIGN KEY ("checkoutSessionId") REFERENCES "commerce_checkout_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commerce_order_items" ADD CONSTRAINT "commerce_order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "commerce_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "commerce_order_items" ADD CONSTRAINT "commerce_order_items_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "catalog_product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
