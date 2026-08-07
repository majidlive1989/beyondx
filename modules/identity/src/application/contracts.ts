import type {
  IdentityAuditLog,
  IdentityRole,
  IdentitySession,
  IdentityUser,
  Page,
  PaginationInput,
  UserStatus,
} from "../domain/models.js";

export type OneTimeTokenKind = "email-verification" | "password-reset";

export interface CreateUserRecordInput {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  roleNames: string[];
  emailVerifiedAt?: Date | null;
}

export interface UpdateUserRecordInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  status?: UserStatus;
}

export interface CreateSessionRecordInput {
  userId: string;
  refreshTokenHash: string;
  familyId: string;
  expiresAt: Date;
  userAgent?: string | null;
  ipAddress?: string | null;
}

export interface CreateAuditRecordInput {
  actorUserId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  requestId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface IdentityRepository {
  findUserByEmail(email: string): Promise<IdentityUser | null>;
  findUserById(id: string): Promise<IdentityUser | null>;
  createUser(input: CreateUserRecordInput): Promise<IdentityUser>;
  updateUser(id: string, input: UpdateUserRecordInput): Promise<IdentityUser>;
  updatePassword(userId: string, passwordHash: string): Promise<void>;
  recordFailedLogin(userId: string, failedAttempts: number, lockedUntil: Date | null): Promise<void>;
  recordSuccessfulLogin(userId: string, at: Date): Promise<void>;
  markEmailVerified(userId: string, at: Date): Promise<void>;

  createSession(input: CreateSessionRecordInput): Promise<IdentitySession>;
  findSessionById(id: string): Promise<IdentitySession | null>;
  findSessionByRefreshTokenHash(hash: string): Promise<IdentitySession | null>;
  rotateSession(currentSessionId: string, replacement: CreateSessionRecordInput, at: Date): Promise<IdentitySession>;
  revokeSession(sessionId: string, at: Date): Promise<void>;
  revokeSessionByRefreshHash(hash: string, at: Date): Promise<void>;
  revokeAllUserSessions(userId: string, at: Date): Promise<number>;
  revokeSessionFamily(familyId: string, at: Date): Promise<number>;
  listUserSessions(userId: string): Promise<IdentitySession[]>;
  listSessions(input: PaginationInput & { userId?: string }): Promise<Page<IdentitySession>>;

  createOneTimeToken(kind: OneTimeTokenKind, userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  consumeOneTimeToken(kind: OneTimeTokenKind, tokenHash: string, at: Date): Promise<{ userId: string } | null>;
  invalidateOneTimeTokens(kind: OneTimeTokenKind, userId: string, at: Date): Promise<void>;

  listUsers(input: PaginationInput & { search?: string; status?: UserStatus }): Promise<Page<IdentityUser>>;
  assignUserRoles(userId: string, roleIds: string[]): Promise<IdentityUser>;
  listRoles(): Promise<IdentityRole[]>;
  findRoleById(id: string): Promise<IdentityRole | null>;
  createRole(input: { name: string; description?: string | null; permissionIds: string[] }): Promise<IdentityRole>;
  updateRole(id: string, input: { name?: string; description?: string | null; permissionIds?: string[] }): Promise<IdentityRole>;
  deleteRole(id: string): Promise<void>;
  listPermissions(): Promise<Array<{ id: string; description: string; module: string }>>;

  createAuditLog(input: CreateAuditRecordInput): Promise<void>;
  listAuditLogs(input: PaginationInput): Promise<Page<IdentityAuditLog>>;
}

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, hash: string): Promise<boolean>;
}

export interface AccessTokenClaims {
  sub: string;
  sid: string;
  email: string;
  permissions: string[];
  iat: number;
  exp: number;
  jti: string;
}

export interface TokenService {
  createAccessToken(input: { user: IdentityUser; sessionId: string }): string;
  verifyAccessToken(token: string): AccessTokenClaims;
  createOpaqueToken(): string;
  hashOpaqueToken(token: string): string;
  refreshTokenExpiresAt(now?: Date): Date;
  oneTimeTokenExpiresAt(kind: OneTimeTokenKind, now?: Date): Date;
}

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

export interface RequestMetadata {
  requestId: string;
  ipAddress: string;
  userAgent: string | null;
}
