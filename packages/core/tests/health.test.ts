import { describe, expect, it } from "vitest";
import { HealthRegistry } from "../src/index.js";

describe("HealthRegistry", () => {
  it("returns a normalized healthy result", async () => {
    const registry = new HealthRegistry();
    registry.register({
      id: "database",
      check: () => Promise.resolve({ status: "healthy", message: "reachable" }),
    });
    const [result] = await registry.runAll();
    expect(result).toMatchObject({ id: "database", status: "healthy", critical: true });
  });

  it("turns thrown errors into unhealthy results", async () => {
    const registry = new HealthRegistry();
    registry.register({
      id: "redis",
      check: () => Promise.reject(new Error("offline")),
    });
    const [result] = await registry.runAll();
    expect(result?.status).toBe("unhealthy");
    expect(result?.message).toBe("offline");
  });
});
