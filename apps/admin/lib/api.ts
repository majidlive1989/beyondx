import type {
  AdminRole,
  AdminSession,
  AdminUser,
  AuditLog,
  AuthResponse,
  ContentEntry,
  ContentEntryStatus,
  ContentFieldInput,
  ContentRevision,
  ContentType,
  MediaAsset,
  Page,
  Permission,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4000";
const ACCESS_TOKEN_KEY = "beyondx.admin.access-token";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function getAccessToken(): string | null {
  return typeof window === "undefined" ? null : window.sessionStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) window.sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
  else window.sessionStorage.removeItem(ACCESS_TOKEN_KEY);
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  retry = true,
  includeAuth = true,
): Promise<T> {
  const headers = new Headers(init.headers);
  const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;
  if (init.body && !isFormData && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const token = includeAuth ? getAccessToken() : null;
  if (token) headers.set("authorization", `Bearer ${token}`);

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });

  if (response.status === 401 && retry && includeAuth && !path.endsWith("/auth/refresh")) {
    const refreshed = await refreshSession().catch(() => null);
    if (refreshed) return request<T>(path, init, false, true);
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: { code?: string; message?: string } }
      | null;
    throw new ApiError(
      payload?.error?.message ?? `Request failed with HTTP ${response.status}`,
      payload?.error?.code ?? "HTTP_REQUEST_FAILED",
      response.status,
    );
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  setAccessToken(null);
  const result = await request<AuthResponse>(
    "/api/v1/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ email, password }),
    },
    false,
    false,
  );
  setAccessToken(result.accessToken);
  return result;
}

export async function refreshSession(): Promise<AuthResponse> {
  try {
    const result = await request<AuthResponse>(
      "/api/v1/auth/refresh",
      {
        method: "POST",
        body: JSON.stringify({}),
      },
      false,
      false,
    );
    setAccessToken(result.accessToken);
    return result;
  } catch (error) {
    setAccessToken(null);
    throw error;
  }
}

export async function logout(): Promise<void> {
  await request<void>("/api/v1/auth/logout", { method: "POST" }).catch(() => undefined);
  setAccessToken(null);
}

export async function getMe(): Promise<AdminUser> {
  return (await request<{ user: AdminUser }>("/api/v1/auth/me")).user;
}

export async function updateProfile(input: {
  firstName?: string;
  lastName?: string;
}): Promise<AdminUser> {
  return (
    await request<{ user: AdminUser }>("/api/v1/auth/me", {
      method: "PATCH",
      body: JSON.stringify(input),
    })
  ).user;
}

export function listUsers(search = ""): Promise<Page<AdminUser>> {
  const query = new URLSearchParams({ page: "1", pageSize: "100" });
  if (search) query.set("search", search);
  return request<Page<AdminUser>>(`/api/v1/admin/users?${query}`);
}

export async function createUser(input: { email: string; password: string; firstName: string; lastName: string; roleIds: string[]; emailVerified?: boolean }): Promise<AdminUser> {
  return (await request<{ user: AdminUser }>("/api/v1/admin/users", { method: "POST", body: JSON.stringify(input) })).user;
}

export function listSessions(): Promise<Page<AdminSession>> {
  return request<Page<AdminSession>>("/api/v1/admin/sessions?page=1&pageSize=100");
}

export function revokeSession(id: string): Promise<void> {
  return request<void>(`/api/v1/admin/sessions/${id}`, { method: "DELETE" });
}

export function listAuditLogs(): Promise<Page<AuditLog>> {
  return request<Page<AuditLog>>("/api/v1/admin/audit-logs?page=1&pageSize=100");
}

export async function updateUser(
  id: string,
  input: Partial<Pick<AdminUser, "firstName" | "lastName" | "email" | "status">>,
): Promise<AdminUser> {
  return (
    await request<{ user: AdminUser }>(`/api/v1/admin/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    })
  ).user;
}

export async function assignUserRoles(id: string, roleIds: string[]): Promise<AdminUser> {
  return (
    await request<{ user: AdminUser }>(`/api/v1/admin/users/${id}/roles`, {
      method: "PUT",
      body: JSON.stringify({ roleIds }),
    })
  ).user;
}

export async function listRoles(): Promise<AdminRole[]> {
  return (await request<{ roles: AdminRole[] }>("/api/v1/admin/roles")).roles;
}

export async function listPermissions(): Promise<Permission[]> {
  return (await request<{ permissions: Permission[] }>("/api/v1/admin/permissions")).permissions;
}

export async function createRole(input: {
  name: string;
  description: string;
  permissionIds: string[];
}): Promise<AdminRole> {
  return (
    await request<{ role: AdminRole }>("/api/v1/admin/roles", {
      method: "POST",
      body: JSON.stringify(input),
    })
  ).role;
}

export async function updateRole(
  id: string,
  input: { description?: string; permissionIds?: string[] },
): Promise<AdminRole> {
  return (
    await request<{ role: AdminRole }>(`/api/v1/admin/roles/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    })
  ).role;
}

export function verifyEmail(token: string): Promise<{ verified: true }> {
  return request("/api/v1/auth/email/verify", {
    method: "POST",
    body: JSON.stringify({ token }),
  }, false, false);
}

export function resetPassword(token: string, password: string): Promise<{ reset: true }> {
  return request("/api/v1/auth/password/reset", {
    method: "POST",
    body: JSON.stringify({ token, password }),
  }, false, false);
}


export async function listContentTypes(): Promise<ContentType[]> {
  return (await request<{ items: ContentType[] }>("/api/v1/admin/content-types")).items;
}

export async function createContentType(input: {
  name: string;
  apiId: string;
  description?: string | null;
  fields: ContentFieldInput[];
}): Promise<ContentType> {
  return (
    await request<{ contentType: ContentType }>("/api/v1/admin/content-types", {
      method: "POST",
      body: JSON.stringify(input),
    })
  ).contentType;
}

export async function updateContentType(
  id: string,
  input: { name?: string; description?: string | null; fields?: ContentFieldInput[] },
): Promise<ContentType> {
  return (
    await request<{ contentType: ContentType }>(`/api/v1/admin/content-types/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    })
  ).contentType;
}

export function deleteContentType(id: string): Promise<void> {
  return request<void>(`/api/v1/admin/content-types/${id}`, { method: "DELETE" });
}

export function listContentEntries(input: {
  search?: string;
  contentTypeId?: string;
  status?: ContentEntryStatus;
  locale?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<Page<ContentEntry>> {
  const query = new URLSearchParams({
    page: String(input.page ?? 1),
    pageSize: String(input.pageSize ?? 50),
  });
  if (input.search) query.set("search", input.search);
  if (input.contentTypeId) query.set("contentTypeId", input.contentTypeId);
  if (input.status) query.set("status", input.status);
  if (input.locale) query.set("locale", input.locale);
  return request<Page<ContentEntry>>(`/api/v1/admin/content-entries?${query}`);
}

export async function createContentEntry(input: {
  contentTypeId: string;
  slug: string;
  locale: string;
  data: Record<string, unknown>;
  seoTitle?: string | null;
  seoDescription?: string | null;
  seoMetadata?: Record<string, unknown> | null;
  relations?: Array<{ fieldKey: string; targetEntryId: string }>;
}): Promise<ContentEntry> {
  return (
    await request<{ entry: ContentEntry }>("/api/v1/admin/content-entries", {
      method: "POST",
      body: JSON.stringify(input),
    })
  ).entry;
}

export async function updateContentEntry(
  id: string,
  input: {
    slug?: string;
    locale?: string;
    data?: Record<string, unknown>;
    seoTitle?: string | null;
    seoDescription?: string | null;
    seoMetadata?: Record<string, unknown> | null;
    relations?: Array<{ fieldKey: string; targetEntryId: string }>;
  },
): Promise<ContentEntry> {
  return (
    await request<{ entry: ContentEntry }>(`/api/v1/admin/content-entries/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    })
  ).entry;
}

export function deleteContentEntry(id: string): Promise<void> {
  return request<void>(`/api/v1/admin/content-entries/${id}`, { method: "DELETE" });
}

async function contentAction(path: string): Promise<ContentEntry> {
  return (await request<{ entry: ContentEntry }>(path, { method: "POST" })).entry;
}

export function publishContentEntry(id: string): Promise<ContentEntry> {
  return contentAction(`/api/v1/admin/content-entries/${id}/publish`);
}

export function unpublishContentEntry(id: string): Promise<ContentEntry> {
  return contentAction(`/api/v1/admin/content-entries/${id}/unpublish`);
}

export function archiveContentEntry(id: string): Promise<ContentEntry> {
  return contentAction(`/api/v1/admin/content-entries/${id}/archive`);
}

export async function scheduleContentEntry(id: string, scheduledPublishAt: string | null): Promise<ContentEntry> {
  return (
    await request<{ entry: ContentEntry }>(`/api/v1/admin/content-entries/${id}/schedule`, {
      method: "POST",
      body: JSON.stringify({ scheduledPublishAt }),
    })
  ).entry;
}

export async function listContentRevisions(id: string): Promise<ContentRevision[]> {
  return (await request<{ items: ContentRevision[] }>(`/api/v1/admin/content-entries/${id}/revisions`)).items;
}

export function listMedia(input: {
  search?: string;
  kind?: "IMAGE" | "FILE";
  page?: number;
  pageSize?: number;
} = {}): Promise<Page<MediaAsset>> {
  const query = new URLSearchParams({
    page: String(input.page ?? 1),
    pageSize: String(input.pageSize ?? 24),
  });
  if (input.search) query.set("search", input.search);
  if (input.kind) query.set("kind", input.kind);
  return request<Page<MediaAsset>>(`/api/v1/admin/media?${query}`);
}

export async function uploadMedia(input: {
  file: File;
  title?: string;
  altText?: string;
}): Promise<MediaAsset> {
  const form = new FormData();
  form.set("file", input.file);
  if (input.title) form.set("title", input.title);
  if (input.altText) form.set("altText", input.altText);
  return (
    await request<{ asset: MediaAsset }>("/api/v1/admin/media", {
      method: "POST",
      body: form,
    })
  ).asset;
}

export async function updateMedia(
  id: string,
  input: {
    title?: string | null;
    altText?: string | null;
    metadata?: Record<string, unknown> | null;
  },
): Promise<MediaAsset> {
  return (
    await request<{ asset: MediaAsset }>(`/api/v1/admin/media/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    })
  ).asset;
}

export function deleteMedia(id: string): Promise<void> {
  return request<void>(`/api/v1/admin/media/${id}`, { method: "DELETE" });
}

export async function fetchMediaContent(id: string): Promise<Blob> {
  const token = getAccessToken();
  const headers = new Headers();
  if (token) headers.set("authorization", `Bearer ${token}`);
  const response = await fetch(`${API_URL}/api/v1/admin/media/${id}/content`, {
    headers,
    credentials: "include",
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: { code?: string; message?: string } }
      | null;
    throw new ApiError(
      payload?.error?.message ?? `Request failed with HTTP ${response.status}`,
      payload?.error?.code ?? "HTTP_REQUEST_FAILED",
      response.status,
    );
  }
  return response.blob();
}
