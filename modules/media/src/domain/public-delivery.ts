import type { MediaAsset } from "./models.js";

export type MediaVisibility = "PRIVATE" | "PUBLIC";

const SYSTEM_METADATA_KEY = "__beyondx";

export function getMediaVisibility(asset: Pick<MediaAsset, "metadata">): MediaVisibility {
  const system = readRecord(asset.metadata?.[SYSTEM_METADATA_KEY]);
  return system?.visibility === "PUBLIC" ? "PUBLIC" : "PRIVATE";
}

export function setMediaVisibilityMetadata(
  metadata: Record<string, unknown> | null,
  visibility: MediaVisibility,
): Record<string, unknown> {
  const userMetadata = stripSystemMetadata(metadata);
  return {
    ...userMetadata,
    [SYSTEM_METADATA_KEY]: { visibility },
  };
}

export function replaceUserMediaMetadata(
  currentMetadata: Record<string, unknown> | null,
  nextUserMetadata: Record<string, unknown> | null,
): Record<string, unknown> {
  const currentSystem = readRecord(currentMetadata?.[SYSTEM_METADATA_KEY]) ?? {
    visibility: "PRIVATE",
  };
  return {
    ...stripSystemMetadata(nextUserMetadata),
    [SYSTEM_METADATA_KEY]: currentSystem,
  };
}

export function getUserMediaMetadata(
  metadata: Record<string, unknown> | null,
): Record<string, unknown> | null {
  const userMetadata = stripSystemMetadata(metadata);
  return Object.keys(userMetadata).length === 0 ? null : userMetadata;
}

function stripSystemMetadata(
  metadata: Record<string, unknown> | null,
): Record<string, unknown> {
  if (!metadata) return {};
  return Object.fromEntries(
    Object.entries(metadata).filter(([key]) => key !== SYSTEM_METADATA_KEY),
  );
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
