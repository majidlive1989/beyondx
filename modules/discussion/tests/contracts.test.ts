import { describe, expect, it } from "vitest";
import { DISCUSSION_PERMISSIONS } from "../src/domain/permissions.js";

describe("Discussion permissions", () => {
  it("keeps moderation, replies and settings independently permissioned", () => {
    expect(DISCUSSION_PERMISSIONS.map((permission) => permission.id)).toEqual([
      "discussion.entries.read",
      "discussion.entries.moderate",
      "discussion.entries.reply",
      "discussion.entries.delete",
      "discussion.settings.manage",
    ]);
  });
});
