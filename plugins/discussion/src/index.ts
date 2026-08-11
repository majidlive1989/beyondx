import type { PrismaClient } from "@beyondx/database";
import { DiscussionModule, DISCUSSION_PERMISSIONS } from "@beyondx/module-discussion";
import type { PluginDefinition, PluginManifest } from "@beyondx/module-system";

export const DISCUSSION_PLUGIN_MANIFEST: PluginManifest = Object.freeze({
  id: "discussion",
  packageName: "@beyondx/plugin-discussion",
  displayName: "Comments & Reviews",
  version: "1.0.0",
  description: "Moderated comments for published content and ratings/reviews for products",
  requiredModules: ["@beyondx/module-foundation", "@beyondx/module-identity", "@beyondx/module-content"],
  pluginDependencies: [],
  permissions: DISCUSSION_PERMISSIONS.map((permission) => ({ ...permission })),
  capabilities: [
    "discussion.comments",
    "discussion.product-reviews",
    "discussion.ratings",
    "discussion.replies",
    "discussion.moderation",
  ],
  adminNavigation: [
    {
      group: "Content",
      href: "/comments",
      label: "Comments & reviews",
      permission: "discussion.entries.read",
    },
  ],
});

export function createDiscussionPlugin(database: PrismaClient): PluginDefinition {
  return {
    manifest: DISCUSSION_PLUGIN_MANIFEST,
    createModule: () => new DiscussionModule({ database }),
  };
}
