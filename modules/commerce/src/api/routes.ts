import { AppError, type HttpRequestContext, type HttpRouteDefinition } from "@beyondx/core";
import { parseInput } from "@beyondx/validation";
import { z } from "zod";
import type { CommerceService } from "../application/commerce-service.js";

const idParams = z.object({ id: z.string().min(1) });
const cartItemParams = z.object({ id: z.string().min(1), variantId: z.string().min(1) });
const priceInput = z.object({
  variantId: z.string().min(1),
  currency: z.string().length(3),
  unitAmount: z.number().int().nonnegative(),
  compareAtAmount: z.number().int().nonnegative().nullable().optional(),
  active: z.boolean().optional(),
});
const warehouseInput = z.object({
  code: z.string().min(2).max(32),
  name: z.string().min(1).max(120),
  active: z.boolean().optional(),
});
const stockInput = z.object({
  warehouseId: z.string().min(1),
  variantId: z.string().min(1),
  quantityDelta: z.number().int().refine((value) => value !== 0),
  lowStockThreshold: z.number().int().nonnegative().optional(),
  reason: z.string().max(250).optional(),
});
const cartCreateInput = z.object({ currency: z.string().length(3).default("USD") });
const cartItemInput = z.object({ variantId: z.string().min(1), quantity: z.number().int().min(1).max(999) });
const quantityInput = z.object({ quantity: z.number().int().min(1).max(999) });
const checkoutInput = z.object({
  cartId: z.string().min(1),
  warehouseId: z.string().min(1),
  idempotencyKey: z.string().min(8).max(160),
});

const idParamsJsonSchema = {
  type: "object",
  required: ["id"],
  properties: { id: { type: "string", minLength: 1 } },
};
const cartItemParamsJsonSchema = {
  type: "object",
  required: ["id", "variantId"],
  properties: {
    id: { type: "string", minLength: 1 },
    variantId: { type: "string", minLength: 1 },
  },
};
const priceBodyJsonSchema = {
  type: "object",
  required: ["variantId", "currency", "unitAmount"],
  properties: {
    variantId: { type: "string", minLength: 1 },
    currency: { type: "string", minLength: 3, maxLength: 3 },
    unitAmount: { type: "integer", minimum: 0 },
    compareAtAmount: { anyOf: [{ type: "integer", minimum: 0 }, { type: "null" }] },
    active: { type: "boolean" },
  },
};
const warehouseBodyJsonSchema = {
  type: "object",
  required: ["code", "name"],
  properties: {
    code: { type: "string", minLength: 2, maxLength: 32 },
    name: { type: "string", minLength: 1, maxLength: 120 },
    active: { type: "boolean" },
  },
};
const stockBodyJsonSchema = {
  type: "object",
  required: ["warehouseId", "variantId", "quantityDelta"],
  properties: {
    warehouseId: { type: "string", minLength: 1 },
    variantId: { type: "string", minLength: 1 },
    quantityDelta: { type: "integer", not: { const: 0 } },
    lowStockThreshold: { type: "integer", minimum: 0 },
    reason: { type: "string", maxLength: 250 },
  },
};
const stockQueryJsonSchema = {
  type: "object",
  properties: { warehouseId: { type: "string", minLength: 1 } },
};
const cartCreateBodyJsonSchema = {
  type: "object",
  properties: { currency: { type: "string", minLength: 3, maxLength: 3, default: "USD" } },
};
const cartItemBodyJsonSchema = {
  type: "object",
  required: ["variantId", "quantity"],
  properties: {
    variantId: { type: "string", minLength: 1 },
    quantity: { type: "integer", minimum: 1, maximum: 999 },
  },
};
const quantityBodyJsonSchema = {
  type: "object",
  required: ["quantity"],
  properties: { quantity: { type: "integer", minimum: 1, maximum: 999 } },
};
const checkoutBodyJsonSchema = {
  type: "object",
  required: ["cartId", "warehouseId", "idempotencyKey"],
  properties: {
    cartId: { type: "string", minLength: 1 },
    warehouseId: { type: "string", minLength: 1 },
    idempotencyKey: { type: "string", minLength: 8, maxLength: 160 },
  },
};
const cartTokenHeadersJsonSchema = {
  type: "object",
  required: ["x-cart-token"],
  properties: { "x-cart-token": { type: "string", minLength: 1 } },
};

function cartToken(context: HttpRequestContext): string {
  const raw = context.headers["x-cart-token"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value?.trim()) {
    throw new AppError({
      code: "COMMERCE_CART_TOKEN_REQUIRED",
      message: "x-cart-token header is required",
      statusCode: 401,
    });
  }
  return value.trim();
}

function actor(context: HttpRequestContext): { actorUserId?: string } {
  return context.principal ? { actorUserId: context.principal.subject } : {};
}

export function createCommerceRoutes(service: CommerceService): HttpRouteDefinition[] {
  return [
    {
      method: "GET",
      path: "/api/v1/admin/commerce/prices",
      summary: "List variant prices",
      tags: ["Commerce Admin"],
      public: false,
      permission: "commerce.pricing.read",
      handler: async () => ({ body: { items: await service.listPrices() } }),
    },
    {
      method: "POST",
      path: "/api/v1/admin/commerce/prices",
      summary: "Create or update a variant price",
      tags: ["Commerce Admin"],
      public: false,
      permission: "commerce.pricing.manage",
      schema: { body: priceBodyJsonSchema },
      handler: async (context) => ({
        statusCode: 201,
        body: { price: await service.setPrice(parseInput(priceInput, context.body)) },
      }),
    },
    {
      method: "GET",
      path: "/api/v1/admin/commerce/warehouses",
      summary: "List warehouses",
      tags: ["Commerce Admin"],
      public: false,
      permission: "commerce.inventory.read",
      handler: async () => ({ body: { items: await service.listWarehouses() } }),
    },
    {
      method: "POST",
      path: "/api/v1/admin/commerce/warehouses",
      summary: "Create a warehouse",
      tags: ["Commerce Admin"],
      public: false,
      permission: "commerce.inventory.manage",
      schema: { body: warehouseBodyJsonSchema },
      handler: async (context) => ({
        statusCode: 201,
        body: { warehouse: await service.createWarehouse(parseInput(warehouseInput, context.body)) },
      }),
    },
    {
      method: "GET",
      path: "/api/v1/admin/commerce/stock",
      summary: "List stock levels",
      tags: ["Commerce Admin"],
      public: false,
      permission: "commerce.inventory.read",
      schema: { querystring: stockQueryJsonSchema },
      handler: async (context) => {
        const query = parseInput(z.object({ warehouseId: z.string().min(1).optional() }), context.query);
        return { body: { items: await service.listStock(query.warehouseId) } };
      },
    },
    {
      method: "POST",
      path: "/api/v1/admin/commerce/stock/adjust",
      summary: "Adjust stock",
      tags: ["Commerce Admin"],
      public: false,
      permission: "commerce.inventory.manage",
      schema: { body: stockBodyJsonSchema },
      handler: async (context) => ({
        body: { stock: await service.adjustStock(parseInput(stockInput, context.body), actor(context)) },
      }),
    },
    {
      method: "GET",
      path: "/api/v1/admin/commerce/stock-movements",
      summary: "List stock movements",
      tags: ["Commerce Admin"],
      public: false,
      permission: "commerce.inventory.read",
      handler: async () => ({ body: { items: await service.listStockMovements() } }),
    },
    {
      method: "GET",
      path: "/api/v1/admin/commerce/orders",
      summary: "List orders",
      tags: ["Commerce Admin"],
      public: false,
      permission: "commerce.orders.read",
      handler: async () => ({ body: { items: await service.listOrders() } }),
    },
    {
      method: "GET",
      path: "/api/v1/admin/commerce/orders/:id",
      summary: "Get an order",
      tags: ["Commerce Admin"],
      public: false,
      permission: "commerce.orders.read",
      schema: { params: idParamsJsonSchema },
      handler: async (context) => {
        const { id } = parseInput(idParams, context.params);
        const order = await service.getOrder(id);
        if (!order) throw new AppError({ code: "COMMERCE_ORDER_NOT_FOUND", message: "Order was not found", statusCode: 404 });
        return { body: { order } };
      },
    },
    ...(["confirm", "cancel"] as const).map(
      (action): HttpRouteDefinition => ({
        method: "POST",
        path: `/api/v1/admin/commerce/orders/:id/${action}`,
        summary: `${action === "confirm" ? "Confirm" : "Cancel"} an order`,
        tags: ["Commerce Admin"],
        public: false,
        permission: "commerce.orders.manage",
        schema: { params: idParamsJsonSchema },
        handler: async (context) => {
          const { id } = parseInput(idParams, context.params);
          const order = action === "confirm"
            ? await service.confirmOrder(id, actor(context))
            : await service.cancelOrder(id, actor(context));
          return { body: { order } };
        },
      }),
    ),
    {
      method: "POST",
      path: "/api/v1/commerce/carts",
      summary: "Create a guest cart",
      tags: ["Commerce"],
      public: true,
      schema: { body: cartCreateBodyJsonSchema },
      handler: async (context) => ({
        statusCode: 201,
        body: await service.createCart(parseInput(cartCreateInput, context.body).currency),
      }),
    },
    {
      method: "GET",
      path: "/api/v1/commerce/carts/:id",
      summary: "Get a guest cart",
      tags: ["Commerce"],
      public: true,
      schema: { params: idParamsJsonSchema, headers: cartTokenHeadersJsonSchema },
      handler: async (context) => {
        const { id } = parseInput(idParams, context.params);
        return { body: { cart: await service.getCart(id, cartToken(context)) } };
      },
    },
    {
      method: "POST",
      path: "/api/v1/commerce/carts/:id/items",
      summary: "Add or replace a cart item",
      tags: ["Commerce"],
      public: true,
      schema: { params: idParamsJsonSchema, headers: cartTokenHeadersJsonSchema, body: cartItemBodyJsonSchema },
      handler: async (context) => {
        const { id } = parseInput(idParams, context.params);
        return { body: { cart: await service.addCartItem(id, cartToken(context), parseInput(cartItemInput, context.body)) } };
      },
    },
    {
      method: "PATCH",
      path: "/api/v1/commerce/carts/:id/items/:variantId",
      summary: "Update a cart item quantity",
      tags: ["Commerce"],
      public: true,
      schema: { params: cartItemParamsJsonSchema, headers: cartTokenHeadersJsonSchema, body: quantityBodyJsonSchema },
      handler: async (context) => {
        const { id, variantId } = parseInput(cartItemParams, context.params);
        const { quantity } = parseInput(quantityInput, context.body);
        return { body: { cart: await service.updateCartItem(id, cartToken(context), variantId, quantity) } };
      },
    },
    {
      method: "DELETE",
      path: "/api/v1/commerce/carts/:id/items/:variantId",
      summary: "Remove a cart item",
      tags: ["Commerce"],
      public: true,
      schema: { params: cartItemParamsJsonSchema, headers: cartTokenHeadersJsonSchema },
      handler: async (context) => {
        const { id, variantId } = parseInput(cartItemParams, context.params);
        return { body: { cart: await service.removeCartItem(id, cartToken(context), variantId) } };
      },
    },
    {
      method: "POST",
      path: "/api/v1/commerce/checkout",
      summary: "Checkout a cart and reserve inventory",
      tags: ["Commerce"],
      public: true,
      schema: { headers: cartTokenHeadersJsonSchema, body: checkoutBodyJsonSchema },
      handler: async (context) => {
        const input = parseInput(checkoutInput, context.body);
        return {
          statusCode: 201,
          body: { order: await service.checkout({ ...input, cartToken: cartToken(context) }) },
        };
      },
    },
  ];
}
