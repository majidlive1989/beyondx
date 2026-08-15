import { describe, expect, it } from "vitest";
import { displayValue } from "../lib/values";

// Keep this test framework-agnostic: the Next build validates route/metadata integration.
describe("storefront value rendering", () => {
  it("renders schema-driven values safely", () => {
    expect(displayValue({ battery: 1500 })).toContain('"battery": 1500');
    expect(displayValue(null)).toBe("—");
    expect(displayValue(true)).toBe("true");
  });
});
