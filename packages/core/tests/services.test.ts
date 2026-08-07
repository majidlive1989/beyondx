import { describe, expect, it } from "vitest";
import { ServiceContainer } from "../src/index.js";

describe("ServiceContainer", () => {
  it("creates singleton services once", () => {
    const container = new ServiceContainer();
    let calls = 0;
    container.registerFactory("clock", () => ({ id: ++calls }));
    expect(container.resolve<{ id: number }>("clock")).toBe(container.resolve("clock"));
    expect(calls).toBe(1);
  });
  it("rejects duplicate registrations", () => {
    const container = new ServiceContainer();
    container.registerValue("value", 1);
    expect(() => container.registerValue("value", 2)).toThrow(/already registered/);
  });
});
