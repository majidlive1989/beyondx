export type UserStatus = "ACTIVE" | "SUSPENDED" | "DISABLED";

export interface IdentityRole {
  id: string;
  name: string;
  description: string | null;
  system: boolean;
  permissions: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IdentityUser {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  status: UserStatus;
  emailVerifiedAt: Date | null;
  lastLoginAt: Date | null;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  roles: IdentityRole[];
  permissions: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicIdentityUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: UserStatus;
  emailVerified: boolean;
  lastLoginAt: string | null;
  roles: Array<{ id: string; name: string }>;
  permissions: string[];
  createdAt: string;
  updatedAt: string;
}

export interface IdentitySession {
  id: string;
  userId: string;
  refreshTokenHash: string;
  familyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedBySessionId: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  lastUsedAt: Date;
  createdAt: Date;
  user?: IdentityUser;
}

export interface IdentityAuditLog {
  id: string;
  actorUserId: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  requestId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export interface PaginationInput {
  page: number;
  pageSize: number;
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
}

export function toPublicUser(user: IdentityUser): PublicIdentityUser {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    status: user.status,
    emailVerified: user.emailVerifiedAt !== null,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    roles: user.roles.map((role) => ({ id: role.id, name: role.name })),
    permissions: [...user.permissions].sort(),
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}
