import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { AppError } from "@beyondx/core";
import { Prisma, type PrismaClient } from "@beyondx/database";

const CART_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const CHECKOUT_TTL_MS = 30 * 60 * 1000;

export interface CommerceMutationContext {
  actorUserId?: string;
}

export interface CreatePriceInput {
  variantId: string;
  currency: string;
  unitAmount: number;
  compareAtAmount?: number | null | undefined;
  active?: boolean | undefined;
}

export interface CreateWarehouseInput {
  code: string;
  name: string;
  active?: boolean | undefined;
}

export interface AdjustStockInput {
  warehouseId: string;
  variantId: string;
  quantityDelta: number;
  lowStockThreshold?: number | undefined;
  reason?: string | undefined;
}

export interface AddCartItemInput {
  variantId: string;
  quantity: number;
}

export interface CheckoutInput {
  cartId: string;
  cartToken: string;
  warehouseId: string;
  idempotencyKey: string;
}

export class CommerceService {
  constructor(private readonly database: PrismaClient) {}

  async listPrices() {
    const rows = await this.database.commercePrice.findMany({
      include: { variant: { include: { product: true } } },
      orderBy: [{ currency: "asc" }, { updatedAt: "desc" }],
    });
    return rows.map((row) => ({
      id: row.id,
      variantId: row.variantId,
      productName: row.variant.product.name,
      variantTitle: row.variant.title,
      sku: row.variant.sku,
      currency: row.currency,
      unitAmount: row.unitAmount,
      compareAtAmount: row.compareAtAmount,
      active: row.active,
      updatedAt: row.updatedAt,
    }));
  }

  async setPrice(input: CreatePriceInput) {
    const currency = normalizeCurrency(input.currency);
    assertMoney(input.unitAmount, "unitAmount");
    if (input.compareAtAmount !== undefined && input.compareAtAmount !== null) {
      assertMoney(input.compareAtAmount, "compareAtAmount");
    }
    await this.requireActiveVariant(input.variantId);
    return this.database.commercePrice.upsert({
      where: { variantId_currency: { variantId: input.variantId, currency } },
      update: {
        unitAmount: input.unitAmount,
        compareAtAmount: input.compareAtAmount ?? null,
        active: input.active ?? true,
      },
      create: {
        variantId: input.variantId,
        currency,
        unitAmount: input.unitAmount,
        compareAtAmount: input.compareAtAmount ?? null,
        active: input.active ?? true,
      },
    });
  }

  listWarehouses() {
    return this.database.commerceWarehouse.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] });
  }

  createWarehouse(input: CreateWarehouseInput) {
    const code = input.code.trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9_-]{1,31}$/.test(code)) {
      throw new AppError({
        code: "COMMERCE_WAREHOUSE_CODE_INVALID",
        message: "Warehouse code must contain 2-32 letters, numbers, underscores or hyphens",
        statusCode: 400,
      });
    }
    return this.database.commerceWarehouse.create({
      data: { code, name: input.name.trim(), active: input.active ?? true },
    });
  }

  async listStock(warehouseId?: string) {
    const rows = await this.database.commerceStockLevel.findMany({
      ...(warehouseId ? { where: { warehouseId } } : {}),
      include: { warehouse: true, variant: { include: { product: true } } },
      orderBy: [{ updatedAt: "desc" }],
    });
    return rows.map((row) => ({
      id: row.id,
      warehouseId: row.warehouseId,
      warehouse: row.warehouse.name,
      variantId: row.variantId,
      productName: row.variant.product.name,
      variantTitle: row.variant.title,
      sku: row.variant.sku,
      onHand: row.onHand,
      reserved: row.reserved,
      available: row.onHand - row.reserved,
      lowStockThreshold: row.lowStockThreshold,
      lowStock: row.onHand - row.reserved <= row.lowStockThreshold,
      updatedAt: row.updatedAt,
    }));
  }

  async adjustStock(input: AdjustStockInput, context: CommerceMutationContext = {}) {
    if (!Number.isInteger(input.quantityDelta) || input.quantityDelta === 0) {
      throw new AppError({
        code: "COMMERCE_STOCK_DELTA_INVALID",
        message: "Stock adjustment must be a non-zero integer",
        statusCode: 400,
      });
    }
    if (input.lowStockThreshold !== undefined && (!Number.isInteger(input.lowStockThreshold) || input.lowStockThreshold < 0)) {
      throw new AppError({
        code: "COMMERCE_LOW_STOCK_THRESHOLD_INVALID",
        message: "Low stock threshold must be a non-negative integer",
        statusCode: 400,
      });
    }
    await Promise.all([
      this.requireWarehouse(input.warehouseId),
      this.requireActiveVariant(input.variantId),
    ]);

    await this.database.$transaction(async (tx) => {
      await tx.commerceStockLevel.upsert({
        where: { warehouseId_variantId: { warehouseId: input.warehouseId, variantId: input.variantId } },
        update: input.lowStockThreshold === undefined ? {} : { lowStockThreshold: input.lowStockThreshold },
        create: {
          warehouseId: input.warehouseId,
          variantId: input.variantId,
          onHand: 0,
          reserved: 0,
          lowStockThreshold: input.lowStockThreshold ?? 0,
        },
      });
      const affected = await tx.$executeRaw`
        UPDATE commerce_stock_levels
        SET "onHand" = "onHand" + ${input.quantityDelta}, "updatedAt" = NOW()
        WHERE "warehouseId" = ${input.warehouseId}
          AND "variantId" = ${input.variantId}
          AND "onHand" + ${input.quantityDelta} >= reserved
          AND "onHand" + ${input.quantityDelta} >= 0
      `;
      if (affected !== 1) {
        throw new AppError({
          code: "COMMERCE_STOCK_ADJUSTMENT_CONFLICT",
          message: "Adjustment would make stock negative or lower than the reserved quantity",
          statusCode: 409,
        });
      }
      await tx.commerceStockMovement.create({
        data: {
          warehouseId: input.warehouseId,
          variantId: input.variantId,
          type: input.quantityDelta > 0 ? "RECEIVE" : "ADJUSTMENT",
          onHandDelta: input.quantityDelta,
          reservedDelta: 0,
          reason: input.reason?.trim() || null,
          actorUserId: context.actorUserId ?? null,
        },
      });
    });
    return (await this.listStock(input.warehouseId)).find((row) => row.variantId === input.variantId);
  }

  listStockMovements(limit = 100) {
    return this.database.commerceStockMovement.findMany({
      take: Math.min(Math.max(limit, 1), 250),
      include: { warehouse: true, variant: { include: { product: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async createCart(currencyInput: string) {
    const currency = normalizeCurrency(currencyInput);
    const token = randomBytes(32).toString("base64url");
    const cart = await this.database.commerceCart.create({
      data: {
        accessTokenHash: hashToken(token),
        currency,
        expiresAt: new Date(Date.now() + CART_TTL_MS),
      },
    });
    return { cart: await this.serializeCart(cart.id), cartToken: token };
  }

  async getCart(cartId: string, token: string) {
    await this.authorizeCart(cartId, token);
    return this.serializeCart(cartId);
  }

  async addCartItem(cartId: string, token: string, input: AddCartItemInput) {
    const cart = await this.authorizeCart(cartId, token);
    this.assertCartMutable(cart.status, cart.expiresAt);
    if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 999) {
      throw new AppError({ code: "COMMERCE_CART_QUANTITY_INVALID", message: "Quantity must be between 1 and 999", statusCode: 400 });
    }
    await this.requirePricedVariant(input.variantId, cart.currency);
    await this.database.commerceCartItem.upsert({
      where: { cartId_variantId: { cartId, variantId: input.variantId } },
      update: { quantity: input.quantity },
      create: { cartId, variantId: input.variantId, quantity: input.quantity },
    });
    return this.serializeCart(cartId);
  }

  async updateCartItem(cartId: string, token: string, variantId: string, quantity: number) {
    const cart = await this.authorizeCart(cartId, token);
    this.assertCartMutable(cart.status, cart.expiresAt);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
      throw new AppError({ code: "COMMERCE_CART_QUANTITY_INVALID", message: "Quantity must be between 1 and 999", statusCode: 400 });
    }
    const updated = await this.database.commerceCartItem.updateMany({ where: { cartId, variantId }, data: { quantity } });
    if (updated.count !== 1) throw new AppError({ code: "COMMERCE_CART_ITEM_NOT_FOUND", message: "Cart item was not found", statusCode: 404 });
    return this.serializeCart(cartId);
  }

  async removeCartItem(cartId: string, token: string, variantId: string) {
    const cart = await this.authorizeCart(cartId, token);
    this.assertCartMutable(cart.status, cart.expiresAt);
    await this.database.commerceCartItem.deleteMany({ where: { cartId, variantId } });
    return this.serializeCart(cartId);
  }

  async checkout(input: CheckoutInput) {
    const previous = await this.database.commerceCheckoutSession.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: { order: { include: { items: true } } },
    });
    if (previous?.order) return previous.order;

    const authorized = await this.authorizeCart(input.cartId, input.cartToken);
    this.assertCartMutable(authorized.status, authorized.expiresAt);
    await this.requireWarehouse(input.warehouseId);

    return this.database.$transaction(async (tx) => {
      const cart = await tx.commerceCart.findUnique({
        where: { id: input.cartId },
        include: { items: { include: { variant: { include: { product: true } } } } },
      });
      if (!cart || cart.status !== "ACTIVE" || cart.expiresAt <= new Date()) {
        throw new AppError({ code: "COMMERCE_CART_NOT_ACTIVE", message: "Cart is no longer active", statusCode: 409 });
      }
      if (cart.items.length === 0) {
        throw new AppError({ code: "COMMERCE_CART_EMPTY", message: "Cart must contain at least one item", statusCode: 409 });
      }

      const prices = await tx.commercePrice.findMany({
        where: { variantId: { in: cart.items.map((item) => item.variantId) }, currency: cart.currency, active: true },
      });
      const priceByVariant = new Map(prices.map((price) => [price.variantId, price]));
      if (priceByVariant.size !== cart.items.length) {
        throw new AppError({ code: "COMMERCE_PRICE_MISSING", message: "Every cart item requires an active price", statusCode: 409 });
      }

      for (const item of cart.items) {
        const affected = await tx.$executeRaw`
          UPDATE commerce_stock_levels
          SET reserved = reserved + ${item.quantity}, "updatedAt" = NOW()
          WHERE "warehouseId" = ${input.warehouseId}
            AND "variantId" = ${item.variantId}
            AND "onHand" - reserved >= ${item.quantity}
        `;
        if (affected !== 1) {
          throw new AppError({
            code: "COMMERCE_INSUFFICIENT_STOCK",
            message: `Insufficient available stock for SKU ${item.variant.sku}`,
            statusCode: 409,
            details: { variantId: item.variantId, sku: item.variant.sku },
          });
        }
        await tx.commerceStockMovement.create({
          data: {
            warehouseId: input.warehouseId,
            variantId: item.variantId,
            type: "RESERVE",
            onHandDelta: 0,
            reservedDelta: item.quantity,
            referenceType: "cart",
            referenceId: cart.id,
          },
        });
      }

      const checkout = await tx.commerceCheckoutSession.create({
        data: {
          cartId: cart.id,
          warehouseId: input.warehouseId,
          idempotencyKey: input.idempotencyKey,
          status: "COMPLETED",
          expiresAt: new Date(Date.now() + CHECKOUT_TTL_MS),
          completedAt: new Date(),
        },
      });
      const subtotalAmount = cart.items.reduce((sum, item) => {
        const price = priceByVariant.get(item.variantId);
        return sum + (price?.unitAmount ?? 0) * item.quantity;
      }, 0);
      const order = await tx.commerceOrder.create({
        data: {
          orderNumber: createOrderNumber(),
          cartId: cart.id,
          checkoutSessionId: checkout.id,
          status: "PENDING_PAYMENT",
          currency: cart.currency,
          subtotalAmount,
          totalAmount: subtotalAmount,
          items: {
            create: cart.items.map((item) => {
              const price = priceByVariant.get(item.variantId);
              if (!price) throw new AppError({ code: "COMMERCE_PRICE_MISSING", message: "Cart item price disappeared", statusCode: 409 });
              return {
                variantId: item.variantId,
                sku: item.variant.sku,
                title: `${item.variant.product.name} — ${item.variant.title}`,
                quantity: item.quantity,
                unitAmount: price.unitAmount,
                lineTotalAmount: price.unitAmount * item.quantity,
              };
            }),
          },
        },
        include: { items: true },
      });
      await tx.commerceCart.update({ where: { id: cart.id }, data: { status: "CONVERTED" } });
      return order;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  listOrders() {
    return this.database.commerceOrder.findMany({
      include: { items: true, checkoutSession: { include: { warehouse: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  getOrder(id: string) {
    return this.database.commerceOrder.findUnique({
      where: { id },
      include: { items: true, checkoutSession: { include: { warehouse: true } } },
    });
  }

  async confirmOrder(id: string, context: CommerceMutationContext = {}) {
    return this.database.$transaction(async (tx) => {
      const order = await tx.commerceOrder.findUnique({
        where: { id },
        include: { items: true, checkoutSession: true },
      });
      if (!order) throw new AppError({ code: "COMMERCE_ORDER_NOT_FOUND", message: "Order was not found", statusCode: 404 });
      if (order.status === "CONFIRMED") return order;
      if (order.status !== "PENDING_PAYMENT") throw new AppError({ code: "COMMERCE_ORDER_STATE_INVALID", message: "Only pending orders can be confirmed", statusCode: 409 });

      for (const item of order.items) {
        const affected = await tx.$executeRaw`
          UPDATE commerce_stock_levels
          SET "onHand" = "onHand" - ${item.quantity}, reserved = reserved - ${item.quantity}, "updatedAt" = NOW()
          WHERE "warehouseId" = ${order.checkoutSession.warehouseId}
            AND "variantId" = ${item.variantId}
            AND "onHand" >= ${item.quantity}
            AND reserved >= ${item.quantity}
        `;
        if (affected !== 1) throw new AppError({ code: "COMMERCE_STOCK_INVARIANT_FAILED", message: `Reserved stock is missing for SKU ${item.sku}`, statusCode: 409 });
        await tx.commerceStockMovement.create({
          data: {
            warehouseId: order.checkoutSession.warehouseId,
            variantId: item.variantId,
            type: "SALE",
            onHandDelta: -item.quantity,
            reservedDelta: -item.quantity,
            referenceType: "order",
            referenceId: order.id,
            actorUserId: context.actorUserId ?? null,
          },
        });
      }
      return tx.commerceOrder.update({ where: { id }, data: { status: "CONFIRMED" }, include: { items: true } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async cancelOrder(id: string, context: CommerceMutationContext = {}) {
    return this.database.$transaction(async (tx) => {
      const order = await tx.commerceOrder.findUnique({
        where: { id },
        include: { items: true, checkoutSession: true },
      });
      if (!order) throw new AppError({ code: "COMMERCE_ORDER_NOT_FOUND", message: "Order was not found", statusCode: 404 });
      if (order.status === "CANCELLED") return order;
      if (order.status === "CONFIRMED") throw new AppError({ code: "COMMERCE_ORDER_STATE_INVALID", message: "Confirmed orders cannot be cancelled by the commerce engine", statusCode: 409 });

      for (const item of order.items) {
        const affected = await tx.$executeRaw`
          UPDATE commerce_stock_levels
          SET reserved = reserved - ${item.quantity}, "updatedAt" = NOW()
          WHERE "warehouseId" = ${order.checkoutSession.warehouseId}
            AND "variantId" = ${item.variantId}
            AND reserved >= ${item.quantity}
        `;
        if (affected !== 1) throw new AppError({ code: "COMMERCE_STOCK_INVARIANT_FAILED", message: `Reserved stock is missing for SKU ${item.sku}`, statusCode: 409 });
        await tx.commerceStockMovement.create({
          data: {
            warehouseId: order.checkoutSession.warehouseId,
            variantId: item.variantId,
            type: "RELEASE",
            onHandDelta: 0,
            reservedDelta: -item.quantity,
            referenceType: "order",
            referenceId: order.id,
            actorUserId: context.actorUserId ?? null,
          },
        });
      }
      return tx.commerceOrder.update({
        where: { id },
        data: { status: "CANCELLED", cancelledAt: new Date() },
        include: { items: true },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async authorizeCart(cartId: string, token: string) {
    const cart = await this.database.commerceCart.findUnique({ where: { id: cartId } });
    if (!cart || !secureEqual(cart.accessTokenHash, hashToken(token))) {
      throw new AppError({ code: "COMMERCE_CART_NOT_FOUND", message: "Cart was not found", statusCode: 404 });
    }
    if (cart.status === "ACTIVE" && cart.expiresAt <= new Date()) {
      return this.database.commerceCart.update({ where: { id: cart.id }, data: { status: "EXPIRED" } });
    }
    return cart;
  }

  private assertCartMutable(status: string, expiresAt: Date): void {
    if (status !== "ACTIVE" || expiresAt <= new Date()) {
      throw new AppError({ code: "COMMERCE_CART_NOT_ACTIVE", message: "Cart is no longer active", statusCode: 409 });
    }
  }

  private async serializeCart(cartId: string) {
    const cart = await this.database.commerceCart.findUnique({
      where: { id: cartId },
      include: { items: { include: { variant: { include: { product: true } } } } },
    });
    if (!cart) throw new AppError({ code: "COMMERCE_CART_NOT_FOUND", message: "Cart was not found", statusCode: 404 });
    const prices = cart.items.length === 0 ? [] : await this.database.commercePrice.findMany({
      where: { variantId: { in: cart.items.map((item) => item.variantId) }, currency: cart.currency, active: true },
    });
    const priceByVariant = new Map(prices.map((price) => [price.variantId, price]));
    const items = cart.items.map((item) => {
      const unitAmount = priceByVariant.get(item.variantId)?.unitAmount ?? null;
      return {
        variantId: item.variantId,
        sku: item.variant.sku,
        title: `${item.variant.product.name} — ${item.variant.title}`,
        quantity: item.quantity,
        unitAmount,
        lineTotalAmount: unitAmount === null ? null : unitAmount * item.quantity,
      };
    });
    return {
      id: cart.id,
      status: cart.status,
      currency: cart.currency,
      expiresAt: cart.expiresAt,
      items,
      subtotalAmount: items.reduce((sum, item) => sum + (item.lineTotalAmount ?? 0), 0),
      updatedAt: cart.updatedAt,
    };
  }

  private async requireActiveVariant(variantId: string) {
    const variant = await this.database.productVariant.findFirst({
      where: { id: variantId, status: "ACTIVE", product: { status: "ACTIVE" } },
      include: { product: true },
    });
    if (!variant) throw new AppError({ code: "COMMERCE_VARIANT_NOT_AVAILABLE", message: "Variant is not active or its product is not active", statusCode: 409 });
    return variant;
  }

  private async requirePricedVariant(variantId: string, currency: string) {
    const [variant, price] = await Promise.all([
      this.requireActiveVariant(variantId),
      this.database.commercePrice.findUnique({ where: { variantId_currency: { variantId, currency } } }),
    ]);
    if (!price?.active) throw new AppError({ code: "COMMERCE_PRICE_MISSING", message: `No active ${currency} price exists for this variant`, statusCode: 409 });
    return { variant, price };
  }

  private async requireWarehouse(id: string) {
    const warehouse = await this.database.commerceWarehouse.findFirst({ where: { id, active: true } });
    if (!warehouse) throw new AppError({ code: "COMMERCE_WAREHOUSE_NOT_FOUND", message: "Active warehouse was not found", statusCode: 404 });
    return warehouse;
  }
}

function normalizeCurrency(value: string): string {
  const currency = value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new AppError({ code: "COMMERCE_CURRENCY_INVALID", message: "Currency must be a 3-letter ISO code", statusCode: 400 });
  return currency;
}

function assertMoney(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new AppError({ code: "COMMERCE_MONEY_INVALID", message: `${field} must be a non-negative integer in minor currency units`, statusCode: 400 });
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function secureEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function createOrderNumber(): string {
  const day = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `BX-${day}-${randomBytes(5).toString("hex").toUpperCase()}`;
}
