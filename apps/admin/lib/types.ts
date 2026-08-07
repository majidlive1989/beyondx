export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: "ACTIVE" | "SUSPENDED" | "DISABLED";
  emailVerified: boolean;
  lastLoginAt: string | null;
  roles: Array<{ id: string; name: string }>;
  permissions: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AdminRole {
  id: string;
  name: string;
  description: string | null;
  system: boolean;
  permissions: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Permission {
  id: string;
  description: string;
  module: string;
}

export interface AuthResponse {
  accessToken: string;
  tokenType: "Bearer";
  user: AdminUser;
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
}

export interface AdminSession {
  id: string; userId: string; familyId: string; expiresAt: string; revokedAt: string | null; userAgent: string | null; ipAddress: string | null; lastUsedAt: string; createdAt: string;
}
export interface AuditLog {
  id: string; actorUserId: string | null; action: string; targetType: string; targetId: string | null; requestId: string | null; ipAddress: string | null; userAgent: string | null; metadata: Record<string, unknown> | null; createdAt: string;
}
