import type {
  AdminRole,
  AdminSession,
  AdminUser,
  AuditLog,
  AuthResponse,
  CatalogAttribute,
  CatalogAttributeValue,
  CatalogBrand,
  CatalogCategory,
  CatalogProduct,
  CatalogProductStatus,
  CatalogProductVariant,
  CatalogVariantStatus,
  ContentEntry,
  ContentEntryStatus,
  ContentFieldInput,
  ContentRevision,
  ContentType,
  DataFieldDefinition,
  DataRecordStatus,
  DataSchemaDefinition,
  DataSchemaKind,
  DynamicDataRecord,
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
    readonly details?: unknown,
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
      | { error?: { code?: string; message?: string; details?: unknown } }
      | null;
    const baseMessage = payload?.error?.message ?? `Request failed with HTTP ${response.status}`;
    const issueMessage = firstValidationIssue(payload?.error?.details);
    throw new ApiError(
      issueMessage ? `${baseMessage}: ${issueMessage}` : baseMessage,
      payload?.error?.code ?? "HTTP_REQUEST_FAILED",
      response.status,
      payload?.error?.details,
    );
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}


function firstValidationIssue(details: unknown): string | null {
  if (!details || typeof details !== "object" || !("issues" in details)) return null;
  const issues = (details as { issues?: unknown }).issues;
  if (!Array.isArray(issues) || issues.length === 0) return null;
  const first: unknown = issues[0];
  if (!first || typeof first !== "object") return null;
  const path = "path" in first && typeof first.path === "string" ? first.path : "";
  const message = "message" in first && typeof first.message === "string" ? first.message : "Invalid value";
  return path ? `${path} — ${message}` : message;
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
      | { error?: { code?: string; message?: string; details?: unknown } }
      | null;
    const baseMessage = payload?.error?.message ?? `Request failed with HTTP ${response.status}`;
    const issueMessage = firstValidationIssue(payload?.error?.details);
    throw new ApiError(
      issueMessage ? `${baseMessage}: ${issueMessage}` : baseMessage,
      payload?.error?.code ?? "HTTP_REQUEST_FAILED",
      response.status,
      payload?.error?.details,
    );
  }
  return response.blob();
}

export function listCatalogBrands(): Promise<{ items: CatalogBrand[] }> {
  return request<{ items: CatalogBrand[] }>("/api/v1/admin/catalog/brands");
}

export async function createCatalogBrand(input: { name: string; slug: string; description?: string | null }): Promise<CatalogBrand> {
  return (await request<{ brand: CatalogBrand }>("/api/v1/admin/catalog/brands", { method: "POST", body: JSON.stringify(input) })).brand;
}

export async function updateCatalogBrand(id: string, input: { name?: string; slug?: string; description?: string | null }): Promise<CatalogBrand> {
  return (await request<{ brand: CatalogBrand }>(`/api/v1/admin/catalog/brands/${id}`, { method: "PATCH", body: JSON.stringify(input) })).brand;
}

export function deleteCatalogBrand(id: string): Promise<void> {
  return request<void>(`/api/v1/admin/catalog/brands/${id}`, { method: "DELETE" });
}

export function listCatalogCategories(): Promise<{ items: CatalogCategory[] }> {
  return request<{ items: CatalogCategory[] }>("/api/v1/admin/catalog/categories");
}

export async function createCatalogCategory(input: { name: string; slug: string; description?: string | null; parentId?: string | null; position?: number }): Promise<CatalogCategory> {
  return (await request<{ category: CatalogCategory }>("/api/v1/admin/catalog/categories", { method: "POST", body: JSON.stringify(input) })).category;
}

export async function updateCatalogCategory(id: string, input: { name?: string; slug?: string; description?: string | null; parentId?: string | null; position?: number }): Promise<CatalogCategory> {
  return (await request<{ category: CatalogCategory }>(`/api/v1/admin/catalog/categories/${id}`, { method: "PATCH", body: JSON.stringify(input) })).category;
}

export function deleteCatalogCategory(id: string): Promise<void> {
  return request<void>(`/api/v1/admin/catalog/categories/${id}`, { method: "DELETE" });
}

export function listCatalogAttributes(): Promise<{ items: CatalogAttribute[] }> {
  return request<{ items: CatalogAttribute[] }>("/api/v1/admin/catalog/attributes");
}

export async function createCatalogAttribute(input: { name: string; slug: string; position?: number }): Promise<CatalogAttribute> {
  return (await request<{ attribute: CatalogAttribute }>("/api/v1/admin/catalog/attributes", { method: "POST", body: JSON.stringify(input) })).attribute;
}

export async function updateCatalogAttribute(id: string, input: { name?: string; slug?: string; position?: number }): Promise<CatalogAttribute> {
  return (await request<{ attribute: CatalogAttribute }>(`/api/v1/admin/catalog/attributes/${id}`, { method: "PATCH", body: JSON.stringify(input) })).attribute;
}

export function deleteCatalogAttribute(id: string): Promise<void> {
  return request<void>(`/api/v1/admin/catalog/attributes/${id}`, { method: "DELETE" });
}

export async function createCatalogAttributeValue(attributeId: string, input: { value: string; slug: string; position?: number }): Promise<CatalogAttributeValue> {
  return (await request<{ value: CatalogAttributeValue }>(`/api/v1/admin/catalog/attributes/${attributeId}/values`, { method: "POST", body: JSON.stringify(input) })).value;
}

export async function updateCatalogAttributeValue(id: string, input: { value?: string; slug?: string; position?: number }): Promise<CatalogAttributeValue> {
  return (await request<{ value: CatalogAttributeValue }>(`/api/v1/admin/catalog/attribute-values/${id}`, { method: "PATCH", body: JSON.stringify(input) })).value;
}

export function deleteCatalogAttributeValue(id: string): Promise<void> {
  return request<void>(`/api/v1/admin/catalog/attribute-values/${id}`, { method: "DELETE" });
}

export function getCatalogCustomFieldSchemas(): Promise<{
  productSchema: DataSchemaDefinition | null;
  variantSchema: DataSchemaDefinition | null;
  componentSchemas: DataSchemaDefinition[];
}> {
  return request<{
    productSchema: DataSchemaDefinition | null;
    variantSchema: DataSchemaDefinition | null;
    componentSchemas: DataSchemaDefinition[];
  }>("/api/v1/admin/catalog/custom-fields");
}

export function listCatalogProducts(input: { search?: string; status?: CatalogProductStatus; brandId?: string; categoryId?: string; page?: number; pageSize?: number } = {}): Promise<Page<CatalogProduct>> {
  const query = new URLSearchParams({ page: String(input.page ?? 1), pageSize: String(input.pageSize ?? 30) });
  if (input.search) query.set("search", input.search);
  if (input.status) query.set("status", input.status);
  if (input.brandId) query.set("brandId", input.brandId);
  if (input.categoryId) query.set("categoryId", input.categoryId);
  return request<Page<CatalogProduct>>(`/api/v1/admin/catalog/products?${query}`);
}

export async function getCatalogProduct(id: string): Promise<CatalogProduct> {
  return (await request<{ product: CatalogProduct }>(`/api/v1/admin/catalog/products/${id}`)).product;
}

export async function createCatalogProduct(input: { name: string; slug: string; description?: string | null; status?: CatalogProductStatus; brandId?: string | null; categoryIds?: string[]; mediaAssetIds?: string[]; customFields?: Record<string, unknown> }): Promise<CatalogProduct> {
  return (await request<{ product: CatalogProduct }>("/api/v1/admin/catalog/products", { method: "POST", body: JSON.stringify(input) })).product;
}

export async function updateCatalogProduct(id: string, input: { name?: string; slug?: string; description?: string | null; status?: CatalogProductStatus; brandId?: string | null; categoryIds?: string[]; mediaAssetIds?: string[]; customFields?: Record<string, unknown> }): Promise<CatalogProduct> {
  return (await request<{ product: CatalogProduct }>(`/api/v1/admin/catalog/products/${id}`, { method: "PATCH", body: JSON.stringify(input) })).product;
}

export function deleteCatalogProduct(id: string): Promise<void> {
  return request<void>(`/api/v1/admin/catalog/products/${id}`, { method: "DELETE" });
}

export async function createCatalogVariant(productId: string, input: { title: string; sku: string; status?: CatalogVariantStatus; position?: number; attributeValueIds?: string[]; customFields?: Record<string, unknown> }): Promise<CatalogProductVariant> {
  return (await request<{ variant: CatalogProductVariant }>(`/api/v1/admin/catalog/products/${productId}/variants`, { method: "POST", body: JSON.stringify(input) })).variant;
}

export async function updateCatalogVariant(id: string, input: { title?: string; sku?: string; status?: CatalogVariantStatus; position?: number; attributeValueIds?: string[]; customFields?: Record<string, unknown> }): Promise<CatalogProductVariant> {
  return (await request<{ variant: CatalogProductVariant }>(`/api/v1/admin/catalog/variants/${id}`, { method: "PATCH", body: JSON.stringify(input) })).variant;
}

export function deleteCatalogVariant(id: string): Promise<void> {
  return request<void>(`/api/v1/admin/catalog/variants/${id}`, { method: "DELETE" });
}

export function listDataSchemas(): Promise<{ items: DataSchemaDefinition[] }> {
  return request<{ items: DataSchemaDefinition[] }>("/api/v1/admin/schemas");
}

export function listRuntimeDataSchemas(): Promise<{ items: DataSchemaDefinition[] }> {
  return request<{ items: DataSchemaDefinition[] }>("/api/v1/admin/runtime-schemas");
}

export async function createDataSchema(input: { key: string; displayName: string; pluralName: string; description?: string | null; kind?: Exclude<DataSchemaKind, "SYSTEM_EXTENSION">; publicRead?: boolean }): Promise<DataSchemaDefinition> {
  return (await request<{ schema: DataSchemaDefinition }>("/api/v1/admin/schemas", { method: "POST", body: JSON.stringify(input) })).schema;
}

export async function updateDataSchema(id: string, input: { displayName?: string; pluralName?: string; description?: string | null; publicRead?: boolean }): Promise<DataSchemaDefinition> {
  return (await request<{ schema: DataSchemaDefinition }>(`/api/v1/admin/schemas/${id}`, { method: "PATCH", body: JSON.stringify(input) })).schema;
}

export function deleteDataSchema(id: string): Promise<void> {
  return request<void>(`/api/v1/admin/schemas/${id}`, { method: "DELETE" });
}

export async function createDataField(schemaId: string, input: { key: string; label: string; type: DataFieldDefinition["type"]; required?: boolean; repeatable?: boolean; position?: number; validation?: Record<string, unknown> | null; settings?: Record<string, unknown> | null; relationTargetSchemaId?: string | null }): Promise<DataSchemaDefinition> {
  return (await request<{ schema: DataSchemaDefinition }>(`/api/v1/admin/schemas/${schemaId}/fields`, { method: "POST", body: JSON.stringify(input) })).schema;
}

export async function updateDataField(id: string, input: { label?: string; required?: boolean; repeatable?: boolean; position?: number; validation?: Record<string, unknown> | null; settings?: Record<string, unknown> | null; relationTargetSchemaId?: string | null }): Promise<DataSchemaDefinition> {
  return (await request<{ schema: DataSchemaDefinition }>(`/api/v1/admin/schema-fields/${id}`, { method: "PATCH", body: JSON.stringify(input) })).schema;
}

export async function deleteDataField(id: string): Promise<DataSchemaDefinition> {
  return (await request<{ schema: DataSchemaDefinition }>(`/api/v1/admin/schema-fields/${id}`, { method: "DELETE" })).schema;
}

export function listDynamicRecords(schemaKey: string, input: { page?: number; pageSize?: number; status?: DataRecordStatus } = {}): Promise<Page<DynamicDataRecord>> {
  const query = new URLSearchParams({ page: String(input.page ?? 1), pageSize: String(input.pageSize ?? 30) });
  if (input.status) query.set("status", input.status);
  return request<Page<DynamicDataRecord>>(`/api/v1/admin/data/${encodeURIComponent(schemaKey)}?${query}`);
}

export async function createDynamicRecord(schemaKey: string, input: { status?: DataRecordStatus; values: Record<string, unknown> }): Promise<DynamicDataRecord> {
  return (await request<{ record: DynamicDataRecord }>(`/api/v1/admin/data/${encodeURIComponent(schemaKey)}`, { method: "POST", body: JSON.stringify(input) })).record;
}

export async function updateDynamicRecord(schemaKey: string, id: string, input: { status?: DataRecordStatus; values?: Record<string, unknown> }): Promise<DynamicDataRecord> {
  return (await request<{ record: DynamicDataRecord }>(`/api/v1/admin/data/${encodeURIComponent(schemaKey)}/${id}`, { method: "PATCH", body: JSON.stringify(input) })).record;
}

export function deleteDynamicRecord(schemaKey: string, id: string): Promise<void> {
  return request<void>(`/api/v1/admin/data/${encodeURIComponent(schemaKey)}/${id}`, { method: "DELETE" });
}
