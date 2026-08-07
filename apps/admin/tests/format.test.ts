import { describe, expect, it } from "vitest";
import type { AdminUser } from "../lib/types";

function displayName(user: Pick<AdminUser, "firstName" | "lastName">): string {
  return `${user.firstName} ${user.lastName}`.trim();
}

describe("admin identity formatting", () => {
  it("builds the visible user name", () => {
    expect(displayName({ firstName: "BeyondX", lastName: "Admin" })).toBe("BeyondX Admin");
  });
});
