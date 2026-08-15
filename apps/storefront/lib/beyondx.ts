import { createBeyondXThemeClient, type BeyondXFetch } from "@beyondx/theme-sdk";

interface NextFetchInit extends RequestInit {
  next?: {
    revalidate?: number;
    tags?: string[];
  };
}

const API_URL = process.env.NEXT_PUBLIC_API_URL?.trim() || "http://127.0.0.1:4000";
const REVALIDATE_SECONDS = 60;

const storefrontFetch: BeyondXFetch = (input, init) => {
  const request: NextFetchInit = {
    ...init,
    next: { revalidate: REVALIDATE_SECONDS, tags: ["beyondx-storefront"] },
  };
  return fetch(input, request);
};

export const beyondx = createBeyondXThemeClient({
  baseUrl: API_URL,
  fetch: storefrontFetch,
});

export function mediaUrl(assetOrId: string | { id: string }): string {
  return beyondx.media.url(assetOrId);
}

export function apiBaseUrl(): string {
  return API_URL;
}
