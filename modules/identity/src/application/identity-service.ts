import { randomUUID } from "node:crypto";
import { AppError, type AccessTokenAuthenticator, type HttpPrincipal } from "@beyondx/core";
import { DEFAULT_ROLE_NAMES } from "../domain/permissions.js";
import {
  toPublicUser,
  type IdentityAuditLog,
  type IdentityRole,
  type IdentitySession,
  type IdentityUser,
  type Page,
  type PublicIdentityUser,
  type UserStatus,
} from "../domain/models.js";
import type {
  IdentityRepository,
  Mailer,
  PasswordHasher,
  RequestMetadata,
  TokenService,
} from "./contracts.js";

export interface IdentityServiceOptions {
  adminUrl: string;
  refreshCookieName: string;
  refreshCookieSecure: boolean;
  loginMaxAttempts: number;
  loginLockMinutes: number;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
  user: PublicIdentityUser;
}

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export class IdentityService implements AccessTokenAuthenticator {
  constructor(
    private readonly repository: IdentityRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokens: TokenService,
    private readonly mailer: Mailer,
    private readonly options: IdentityServiceOptions,
  ) {}

  async register(input: RegisterInput, metadata: RequestMetadata): Promise<AuthResult> {
    const email = normalizeEmail(input.email);
    if (await this.repository.findUserByEmail(email)) {
      throw new AppError({
        code: "IDENTITY_EMAIL_ALREADY_REGISTERED",
        message: "An account with this email already exists",
        statusCode: 409,
      });
    }

    const user = await this.repository.createUser({
      email,
      passwordHash: await this.passwordHasher.hash(input.password),
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      roleNames: [DEFAULT_ROLE_NAMES.user],
    });
    await this.repository.createAuditLog({
      actorUserId: user.id,
      action: "identity.user.registered",
      targetType: "User",
      targetId: user.id,
      ...auditMetadata(metadata),
    });
    await this.sendEmailVerification(user);
    return this.createAuthenticatedSession(user, metadata);
  }

  async login(input: LoginInput, metadata: RequestMetadata): Promise<AuthResult> {
    const user = await this.repository.findUserByEmail(normalizeEmail(input.email));
    const invalidCredentials = (): AppError =>
      new AppError({
        code: "IDENTITY_INVALID_CREDENTIALS",
        message: "Email or password is invalid",
        statusCode: 401,
      });

    if (!user) throw invalidCredentials();
    if (user.status !== "ACTIVE") {
      throw new AppError({
        code: "IDENTITY_ACCOUNT_UNAVAILABLE",
        message: "This account is not available",
        statusCode: 403,
      });
    }

    const now = new Date();
    if (user.lockedUntil && user.lockedUntil > now) {
      throw new AppError({
        code: "IDENTITY_ACCOUNT_TEMPORARILY_LOCKED",
        message: "Too many failed login attempts. Try again later",
        statusCode: 423,
        details: { lockedUntil: user.lockedUntil.toISOString() },
      });
    }

    if (!(await this.passwordHasher.verify(input.password, user.passwordHash))) {
      const failedAttempts = user.failedLoginAttempts + 1;
      const lockedUntil =
        failedAttempts >= this.options.loginMaxAttempts
          ? new Date(now.getTime() + this.options.loginLockMinutes * 60_000)
          : null;
      await this.repository.recordFailedLogin(user.id, failedAttempts, lockedUntil);
      await this.repository.createAuditLog({
        actorUserId: user.id,
        action: "identity.login.failed",
        targetType: "User",
        targetId: user.id,
        metadata: { failedAttempts, locked: lockedUntil !== null },
        ...auditMetadata(metadata),
      });
      throw invalidCredentials();
    }

    await this.repository.recordSuccessfulLogin(user.id, now);
    const refreshedUser = (await this.repository.findUserById(user.id)) ?? user;
    await this.repository.createAuditLog({
      actorUserId: user.id,
      action: "identity.login.succeeded",
      targetType: "User",
      targetId: user.id,
      ...auditMetadata(metadata),
    });
    return this.createAuthenticatedSession(refreshedUser, metadata);
  }

  async refresh(refreshToken: string, metadata: RequestMetadata): Promise<AuthResult> {
    const tokenHash = this.tokens.hashOpaqueToken(refreshToken);
    const session = await this.repository.findSessionByRefreshTokenHash(tokenHash);
    const now = new Date();
    if (!session) throw invalidRefreshToken();

    if (session.revokedAt) {
      await this.repository.revokeSessionFamily(session.familyId, now);
      await this.repository.createAuditLog({
        actorUserId: session.userId,
        action: "identity.refresh.reuse-detected",
        targetType: "Session",
        targetId: session.id,
        ...auditMetadata(metadata),
      });
      throw new AppError({
        code: "IDENTITY_REFRESH_TOKEN_REUSED",
        message: "Refresh token reuse was detected; the session family was revoked",
        statusCode: 401,
      });
    }
    if (session.expiresAt <= now || !session.user || session.user.status !== "ACTIVE") {
      await this.repository.revokeSession(session.id, now);
      throw invalidRefreshToken();
    }

    const replacementToken = this.tokens.createOpaqueToken();
    let replacement: IdentitySession;
    try {
      replacement = await this.repository.rotateSession(
        session.id,
        {
          userId: session.userId,
          refreshTokenHash: this.tokens.hashOpaqueToken(replacementToken),
          familyId: session.familyId,
          expiresAt: this.tokens.refreshTokenExpiresAt(now),
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
        },
        now,
      );
    } catch (error) {
      if (error instanceof AppError && error.code === "IDENTITY_SESSION_ROTATION_CONFLICT") {
        await this.repository.revokeSessionFamily(session.familyId, now);
        await this.repository.createAuditLog({
          actorUserId: session.userId,
          action: "identity.refresh.reuse-detected",
          targetType: "Session",
          targetId: session.id,
          metadata: { reason: "rotation-conflict" },
          ...auditMetadata(metadata),
        });
        throw new AppError({
          code: "IDENTITY_REFRESH_TOKEN_REUSED",
          message: "Refresh token reuse was detected; the session family was revoked",
          statusCode: 401,
          cause: error,
        });
      }
      throw error;
    }
    await this.repository.createAuditLog({
      actorUserId: session.userId,
      action: "identity.session.rotated",
      targetType: "Session",
      targetId: replacement.id,
      ...auditMetadata(metadata),
    });
    return {
      accessToken: this.tokens.createAccessToken({
        user: session.user,
        sessionId: replacement.id,
      }),
      refreshToken: replacementToken,
      refreshTokenExpiresAt: replacement.expiresAt,
      user: toPublicUser(session.user),
    };
  }

  async logout(refreshToken: string | null, userId: string, metadata: RequestMetadata): Promise<void> {
    if (refreshToken) {
      await this.repository.revokeSessionByRefreshHash(
        this.tokens.hashOpaqueToken(refreshToken),
        new Date(),
      );
    }
    await this.repository.createAuditLog({
      actorUserId: userId,
      action: "identity.logout",
      targetType: "User",
      targetId: userId,
      ...auditMetadata(metadata),
    });
  }

  async logoutAll(userId: string, metadata: RequestMetadata): Promise<number> {
    const count = await this.repository.revokeAllUserSessions(userId, new Date());
    await this.repository.createAuditLog({
      actorUserId: userId,
      action: "identity.logout-all",
      targetType: "User",
      targetId: userId,
      metadata: { revokedSessions: count },
      ...auditMetadata(metadata),
    });
    return count;
  }

  async authenticateAccessToken(token: string): Promise<HttpPrincipal> {
    const claims = this.tokens.verifyAccessToken(token);
    const user = await this.repository.findUserById(claims.sub);
    if (!user || user.status !== "ACTIVE") {
      throw new AppError({
        code: "IDENTITY_ACCESS_TOKEN_REVOKED",
        message: "Access token is no longer valid",
        statusCode: 401,
      });
    }
    const session = await this.repository.findSessionById(claims.sid);
    if (!session || session.userId !== user.id || session.revokedAt || session.expiresAt <= new Date()) {
      throw new AppError({
        code: "IDENTITY_SESSION_REVOKED",
        message: "Session is no longer active",
        statusCode: 401,
      });
    }
    return { subject: user.id, permissions: new Set(user.permissions) };
  }

  async me(userId: string): Promise<PublicIdentityUser> {
    return toPublicUser(await this.requireUser(userId));
  }

  async updateProfile(
    userId: string,
    input: { firstName?: string; lastName?: string },
    metadata: RequestMetadata,
  ): Promise<PublicIdentityUser> {
    const user = await this.repository.updateUser(userId, {
      ...(input.firstName === undefined ? {} : { firstName: input.firstName.trim() }),
      ...(input.lastName === undefined ? {} : { lastName: input.lastName.trim() }),
    });
    await this.repository.createAuditLog({
      actorUserId: userId,
      action: "identity.profile.updated",
      targetType: "User",
      targetId: userId,
      ...auditMetadata(metadata),
    });
    return toPublicUser(user);
  }

  async requestEmailVerification(email: string): Promise<void> {
    const user = await this.repository.findUserByEmail(normalizeEmail(email));
    if (user && !user.emailVerifiedAt) await this.sendEmailVerification(user);
  }

  async verifyEmail(token: string, metadata: RequestMetadata): Promise<void> {
    const tokenHash = this.tokens.hashOpaqueToken(token);
    const consumed = await this.repository.consumeOneTimeToken("email-verification", tokenHash, new Date());
    if (!consumed) {
      throw new AppError({
        code: "IDENTITY_INVALID_EMAIL_VERIFICATION_TOKEN",
        message: "Email verification token is invalid or expired",
        statusCode: 400,
      });
    }
    await this.repository.markEmailVerified(consumed.userId, new Date());
    await this.repository.createAuditLog({
      actorUserId: consumed.userId,
      action: "identity.email.verified",
      targetType: "User",
      targetId: consumed.userId,
      ...auditMetadata(metadata),
    });
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.repository.findUserByEmail(normalizeEmail(email));
    if (!user) return;
    await this.repository.invalidateOneTimeTokens("password-reset", user.id, new Date());
    const token = this.tokens.createOpaqueToken();
    await this.repository.createOneTimeToken(
      "password-reset",
      user.id,
      this.tokens.hashOpaqueToken(token),
      this.tokens.oneTimeTokenExpiresAt("password-reset"),
    );
    const link = `${this.options.adminUrl.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(token)}`;
    await this.mailer.send({
      to: user.email,
      subject: "Reset your BeyondX password",
      text: `Reset your password: ${link}`,
      html: `<p>Hello ${escapeHtml(user.firstName)},</p><p><a href="${escapeHtml(link)}">Reset your BeyondX password</a>.</p><p>If you did not request this, ignore this email.</p>`,
    });
  }

  async resetPassword(token: string, newPassword: string, metadata: RequestMetadata): Promise<void> {
    const consumed = await this.repository.consumeOneTimeToken(
      "password-reset",
      this.tokens.hashOpaqueToken(token),
      new Date(),
    );
    if (!consumed) {
      throw new AppError({
        code: "IDENTITY_INVALID_PASSWORD_RESET_TOKEN",
        message: "Password reset token is invalid or expired",
        statusCode: 400,
      });
    }
    await this.repository.updatePassword(
      consumed.userId,
      await this.passwordHasher.hash(newPassword),
    );
    await this.repository.revokeAllUserSessions(consumed.userId, new Date());
    await this.repository.createAuditLog({
      actorUserId: consumed.userId,
      action: "identity.password.reset",
      targetType: "User",
      targetId: consumed.userId,
      ...auditMetadata(metadata),
    });
  }

  listUsers(input: {
    page: number;
    pageSize: number;
    search?: string;
    status?: UserStatus;
  }): Promise<Page<IdentityUser>> {
    return this.repository.listUsers(input);
  }

  async createUser(
    actorUserId: string,
    input: RegisterInput & { roleIds: string[]; status?: UserStatus; emailVerified?: boolean },
    metadata: RequestMetadata,
  ): Promise<PublicIdentityUser> {
    const email = normalizeEmail(input.email);
    if (await this.repository.findUserByEmail(email)) {
      throw new AppError({
        code: "IDENTITY_EMAIL_ALREADY_REGISTERED",
        message: "An account with this email already exists",
        statusCode: 409,
      });
    }
    const roleNames = await this.resolveRoleNames(input.roleIds);
    const user = await this.repository.createUser({
      email,
      passwordHash: await this.passwordHasher.hash(input.password),
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      roleNames,
      emailVerifiedAt: input.emailVerified ? new Date() : null,
    });
    if (input.status && input.status !== "ACTIVE") {
      await this.repository.updateUser(user.id, { status: input.status });
    }
    await this.repository.createAuditLog({
      actorUserId,
      action: "identity.user.created",
      targetType: "User",
      targetId: user.id,
      metadata: { roleIds: input.roleIds },
      ...auditMetadata(metadata),
    });
    return toPublicUser((await this.repository.findUserById(user.id)) ?? user);
  }

  async updateUser(
    actorUserId: string,
    userId: string,
    input: { firstName?: string; lastName?: string; email?: string; status?: UserStatus },
    metadata: RequestMetadata,
  ): Promise<PublicIdentityUser> {
    await this.requireUser(userId);
    if (actorUserId === userId && input.status && input.status !== "ACTIVE") {
      throw new AppError({
        code: "IDENTITY_SELF_DISABLE_FORBIDDEN",
        message: "You cannot suspend or disable your own account",
        statusCode: 409,
      });
    }
    const user = await this.repository.updateUser(userId, {
      ...input,
      ...(input.email === undefined ? {} : { email: normalizeEmail(input.email) }),
    });
    if (input.status && input.status !== "ACTIVE") {
      await this.repository.revokeAllUserSessions(userId, new Date());
    }
    await this.repository.createAuditLog({
      actorUserId,
      action: "identity.user.updated",
      targetType: "User",
      targetId: userId,
      metadata: input,
      ...auditMetadata(metadata),
    });
    return toPublicUser(user);
  }

  async assignRoles(
    actorUserId: string,
    userId: string,
    roleIds: string[],
    metadata: RequestMetadata,
  ): Promise<PublicIdentityUser> {
    await this.requireUser(userId);
    if (actorUserId === userId) {
      throw new AppError({
        code: "IDENTITY_SELF_ROLE_CHANGE_FORBIDDEN",
        message: "You cannot change your own role assignments",
        statusCode: 409,
      });
    }
    for (const roleId of roleIds) {
      if (!(await this.repository.findRoleById(roleId))) {
        throw new AppError({
          code: "IDENTITY_ROLE_NOT_FOUND",
          message: `Role was not found: ${roleId}`,
          statusCode: 404,
        });
      }
    }
    const user = await this.repository.assignUserRoles(userId, [...new Set(roleIds)]);
    await this.repository.createAuditLog({
      actorUserId,
      action: "identity.user.roles-assigned",
      targetType: "User",
      targetId: userId,
      metadata: { roleIds },
      ...auditMetadata(metadata),
    });
    return toPublicUser(user);
  }

  listRoles(): Promise<IdentityRole[]> {
    return this.repository.listRoles();
  }

  listPermissions(): Promise<Array<{ id: string; description: string; module: string }>> {
    return this.repository.listPermissions();
  }

  async createRole(
    actorUserId: string,
    input: { name: string; description?: string | null; permissionIds: string[] },
    metadata: RequestMetadata,
  ): Promise<IdentityRole> {
    const permissionIds = [...new Set(input.permissionIds)];
    await this.validatePermissionIds(permissionIds);
    const role = await this.repository.createRole({
      name: normalizeRoleName(input.name),
      description: input.description ?? null,
      permissionIds,
    });
    await this.repository.createAuditLog({
      actorUserId,
      action: "identity.role.created",
      targetType: "Role",
      targetId: role.id,
      metadata: { permissionIds: input.permissionIds },
      ...auditMetadata(metadata),
    });
    return role;
  }

  async updateRole(
    actorUserId: string,
    roleId: string,
    input: { name?: string; description?: string | null; permissionIds?: string[] },
    metadata: RequestMetadata,
  ): Promise<IdentityRole> {
    const existing = await this.repository.findRoleById(roleId);
    if (!existing) throw roleNotFound();
    if (existing.system) {
      throw new AppError({
        code: "IDENTITY_SYSTEM_ROLE_IMMUTABLE",
        message: "System roles cannot be modified",
        statusCode: 409,
      });
    }
    const permissionIds =
      input.permissionIds === undefined ? undefined : [...new Set(input.permissionIds)];
    if (permissionIds !== undefined) await this.validatePermissionIds(permissionIds);
    const role = await this.repository.updateRole(roleId, {
      ...input,
      ...(input.name === undefined ? {} : { name: normalizeRoleName(input.name) }),
      ...(permissionIds === undefined ? {} : { permissionIds }),
    });
    await this.repository.createAuditLog({
      actorUserId,
      action: "identity.role.updated",
      targetType: "Role",
      targetId: roleId,
      metadata: input,
      ...auditMetadata(metadata),
    });
    return role;
  }

  async deleteRole(actorUserId: string, roleId: string, metadata: RequestMetadata): Promise<void> {
    const role = await this.repository.findRoleById(roleId);
    if (!role) throw roleNotFound();
    if (role.system) {
      throw new AppError({
        code: "IDENTITY_SYSTEM_ROLE_IMMUTABLE",
        message: "System roles cannot be deleted",
        statusCode: 409,
      });
    }
    await this.repository.deleteRole(roleId);
    await this.repository.createAuditLog({
      actorUserId,
      action: "identity.role.deleted",
      targetType: "Role",
      targetId: roleId,
      ...auditMetadata(metadata),
    });
  }

  listUserSessions(userId: string): Promise<IdentitySession[]> {
    return this.repository.listUserSessions(userId);
  }

  listSessions(input: { page: number; pageSize: number; userId?: string }): Promise<Page<IdentitySession>> {
    return this.repository.listSessions(input);
  }

  async revokeOwnSession(userId: string, sessionId: string, metadata: RequestMetadata): Promise<void> {
    const sessions = await this.repository.listUserSessions(userId);
    if (!sessions.some((session) => session.id === sessionId)) {
      throw new AppError({
        code: "IDENTITY_SESSION_NOT_FOUND",
        message: "Session was not found",
        statusCode: 404,
      });
    }
    await this.repository.revokeSession(sessionId, new Date());
    await this.repository.createAuditLog({
      actorUserId: userId,
      action: "identity.session.revoked",
      targetType: "Session",
      targetId: sessionId,
      ...auditMetadata(metadata),
    });
  }

  async revokeAnySession(actorUserId: string, sessionId: string, metadata: RequestMetadata): Promise<void> {
    await this.repository.revokeSession(sessionId, new Date());
    await this.repository.createAuditLog({
      actorUserId,
      action: "identity.session.admin-revoked",
      targetType: "Session",
      targetId: sessionId,
      ...auditMetadata(metadata),
    });
  }

  listAuditLogs(input: { page: number; pageSize: number }): Promise<Page<IdentityAuditLog>> {
    return this.repository.listAuditLogs(input);
  }

  refreshCookie(refreshToken: string, expiresAt: Date): string {
    return serializeCookie(this.options.refreshCookieName, refreshToken, {
      expires: expiresAt,
      secure: this.options.refreshCookieSecure,
      httpOnly: true,
      sameSite: "Lax",
      path: "/api/v1/auth",
    });
  }

  clearRefreshCookie(): string {
    return serializeCookie(this.options.refreshCookieName, "", {
      expires: new Date(0),
      secure: this.options.refreshCookieSecure,
      httpOnly: true,
      sameSite: "Lax",
      path: "/api/v1/auth",
    });
  }

  refreshCookieName(): string {
    return this.options.refreshCookieName;
  }

  private async createAuthenticatedSession(
    user: IdentityUser,
    metadata: RequestMetadata,
  ): Promise<AuthResult> {
    const refreshToken = this.tokens.createOpaqueToken();
    const session = await this.repository.createSession({
      userId: user.id,
      refreshTokenHash: this.tokens.hashOpaqueToken(refreshToken),
      familyId: randomUUID(),
      expiresAt: this.tokens.refreshTokenExpiresAt(),
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });
    return {
      accessToken: this.tokens.createAccessToken({ user, sessionId: session.id }),
      refreshToken,
      refreshTokenExpiresAt: session.expiresAt,
      user: toPublicUser(user),
    };
  }

  private async sendEmailVerification(user: IdentityUser): Promise<void> {
    await this.repository.invalidateOneTimeTokens("email-verification", user.id, new Date());
    const token = this.tokens.createOpaqueToken();
    await this.repository.createOneTimeToken(
      "email-verification",
      user.id,
      this.tokens.hashOpaqueToken(token),
      this.tokens.oneTimeTokenExpiresAt("email-verification"),
    );
    const link = `${this.options.adminUrl.replace(/\/$/, "")}/verify-email?token=${encodeURIComponent(token)}`;
    await this.mailer.send({
      to: user.email,
      subject: "Verify your BeyondX email",
      text: `Verify your email: ${link}`,
      html: `<p>Hello ${escapeHtml(user.firstName)},</p><p><a href="${escapeHtml(link)}">Verify your BeyondX email</a>.</p>`,
    });
  }

  private async requireUser(userId: string): Promise<IdentityUser> {
    const user = await this.repository.findUserById(userId);
    if (!user) {
      throw new AppError({
        code: "IDENTITY_USER_NOT_FOUND",
        message: "User was not found",
        statusCode: 404,
      });
    }
    return user;
  }

  private async resolveRoleNames(roleIds: string[]): Promise<string[]> {
    const names: string[] = [];
    for (const roleId of roleIds) {
      const role = await this.repository.findRoleById(roleId);
      if (!role) throw roleNotFound();
      names.push(role.name);
    }
    return names.length ? names : [DEFAULT_ROLE_NAMES.user];
  }

  private async validatePermissionIds(permissionIds: string[]): Promise<void> {
    const available = new Set((await this.repository.listPermissions()).map((permission) => permission.id));
    const missing = permissionIds.filter((permissionId) => !available.has(permissionId));
    if (missing.length > 0) {
      throw new AppError({
        code: "IDENTITY_PERMISSION_NOT_FOUND",
        message: "One or more permissions were not found",
        statusCode: 400,
        details: { permissionIds: missing },
      });
    }
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeRoleName(name: string): string {
  return name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_");
}

function auditMetadata(metadata: RequestMetadata): {
  requestId: string;
  ipAddress: string;
  userAgent: string | null;
} {
  return {
    requestId: metadata.requestId,
    ipAddress: metadata.ipAddress,
    userAgent: metadata.userAgent,
  };
}

function invalidRefreshToken(): AppError {
  return new AppError({
    code: "IDENTITY_INVALID_REFRESH_TOKEN",
    message: "Refresh token is invalid or expired",
    statusCode: 401,
  });
}

function roleNotFound(): AppError {
  return new AppError({
    code: "IDENTITY_ROLE_NOT_FOUND",
    message: "Role was not found",
    statusCode: 404,
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

interface CookieOptions {
  expires: Date;
  secure: boolean;
  httpOnly: boolean;
  sameSite: "Lax" | "Strict" | "None";
  path: string;
}

function serializeCookie(name: string, value: string, options: CookieOptions): string {
  const parts = [
    `${encodeURIComponent(name)}=${encodeURIComponent(value)}`,
    `Path=${options.path}`,
    `Expires=${options.expires.toUTCString()}`,
    `SameSite=${options.sameSite}`,
  ];
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");
  return parts.join("; ");
}
