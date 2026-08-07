export const MEDIA_PERMISSIONS = Object.freeze([
  { id: "media.assets.read", description: "Read media assets and file content" },
  { id: "media.assets.upload", description: "Upload media assets" },
  { id: "media.assets.update", description: "Update media metadata and image accessibility text" },
  { id: "media.assets.delete", description: "Delete media assets" },
] as const);

export type MediaPermission = (typeof MEDIA_PERMISSIONS)[number]["id"];
