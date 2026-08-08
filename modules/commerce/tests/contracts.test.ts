import { describe, expect, it } from "vitest";
import { createCommerceRoutes } from "../src/api/routes.js";
import type { CommerceService } from "../src/application/commerce-service.js";
import { COMMERCE_PERMISSIONS } from "../src/domain/permissions.js";

const service = {} as CommerceService;

describe("Commerce contracts", () => {
  it("registers pricing, inventory, cart, checkout and order routes", () => {
    const routes = createCommerceRoutes(service);
    const paths = routes.map((route) => `${route.method} ${route.path}`);

    expect(paths).toEqual(
      expect.arrayContaining([
        "GET /api/v1/admin/commerce/prices",
        "POST /api/v1/admin/commerce/prices",
        "GET /api/v1/admin/commerce/stock",
        "POST /api/v1/admin/commerce/stock/adjust",
        "POST /api/v1/commerce/carts",
        "POST /api/v1/commerce/carts/:id/items",
        "POST /api/v1/commerce/checkout",
        "GET /api/v1/admin/commerce/orders",
        "POST /api/v1/admin/commerce/orders/:id/confirm",
        "POST /api/v1/admin/commerce/orders/:id/cancel",
      ]),
    );
  });

  it("keeps commerce permissions scoped to the plugin", () => {
    expect(COMMERCE_PERMISSIONS.map((permission) => permission.id)).toEqual([
      "commerce.pricing.read",
      "commerce.pricing.manage",
      "commerce.inventory.read",
      "commerce.inventory.manage",
      "commerce.orders.read",
      "commerce.orders.manage",
    ]);
  });
});
