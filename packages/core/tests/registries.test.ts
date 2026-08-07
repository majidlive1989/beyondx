import { describe, expect, it } from "vitest";
import { ExtensionRegistry, HttpRouteRegistry, PermissionRegistry } from "../src/index.js";
import type { HttpRouteDefinition } from "../src/index.js";

describe("platform contribution registries", () => {
  it("registers public routes and rejects duplicates", () => {
    const routes = new HttpRouteRegistry();
    const route: HttpRouteDefinition = {
      method: "GET",
      path: "/api/v1/example",
      summary: "Example",
      tags: ["Example"],
      public: true,
      handler: () => Promise.resolve({ body: { ok: true } }),
    };
    routes.register("@beyondx/example", route);
    expect(() => routes.register("@beyondx/example", route)).toThrow(/already registered/);
  });

  it("requires permissions for protected routes", () => {
    const routes = new HttpRouteRegistry();
    expect(() =>
      routes.register("@beyondx/example", {
        method: "GET",
        path: "/api/v1/private",
        summary: "Private",
        tags: ["Example"],
        public: false,
        handler: () => Promise.resolve({ body: null }),
      }),
    ).toThrow(/requires a permission/);
  });

  it("registers permissions and generic extension contributions", () => {
    const permissions = new PermissionRegistry();
    permissions.register({
      id: "platform.status.read",
      description: "Read status",
      module: "platform",
    });
    const extensions = new ExtensionRegistry();
    extensions.register("platform.repositories", "platform", { token: "repository" });
    expect(permissions.has("platform.status.read")).toBe(true);
    expect(extensions.list("platform.repositories")).toHaveLength(1);
  });
});
