export const CONTENT_PERMISSIONS = Object.freeze([
  { id: "content.types.read", description: "Read content types and field definitions" },
  { id: "content.types.create", description: "Create content types" },
  { id: "content.types.update", description: "Update content types and field definitions" },
  { id: "content.types.delete", description: "Delete unused content types" },
  { id: "content.entries.read", description: "Read CMS entries" },
  { id: "content.entries.create", description: "Create CMS entries" },
  { id: "content.entries.update", description: "Update CMS entries" },
  { id: "content.entries.delete", description: "Delete CMS entries" },
  { id: "content.entries.publish", description: "Publish, unpublish and schedule CMS entries" },
  { id: "content.entries.archive", description: "Archive CMS entries" },
  { id: "content.revisions.read", description: "Read CMS revision history" },
] as const);

export type ContentPermission = (typeof CONTENT_PERMISSIONS)[number]["id"];
